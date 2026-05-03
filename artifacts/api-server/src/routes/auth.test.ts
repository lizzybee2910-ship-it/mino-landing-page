import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";
import crypto from "node:crypto";
import express, { type Express } from "express";
import cookieParser from "cookie-parser";
import request from "supertest";

// ---------------------------------------------------------------------------
// Module mocks. These are hoisted by vitest so they apply before the route
// module under test imports them.
// ---------------------------------------------------------------------------

// Replace `@workspace/db` with a stub. The routes only ever use the `db`
// query builder fluently — they never read fields off the table objects in
// ways that require real drizzle Column instances. Each test primes the
// next response in a queue.
vi.mock("@workspace/db", () => {
  type Result = unknown;
  const queues: { select: Result[][]; insert: Result[][]; update: Result[][] } =
    { select: [], insert: [], update: [] };

  function makeChain(rows: Result[]) {
    const out: Record<string, unknown> = {};
    const passthrough = () => out;
    const resolveRows = () => Promise.resolve(rows);
    out.from = passthrough;
    out.where = passthrough;
    out.set = passthrough;
    out.values = passthrough;
    out.onConflictDoUpdate = passthrough;
    out.limit = resolveRows;
    out.returning = resolveRows;
    // Make the chain itself thenable so `await db.update(...).set(...).where(...)`
    // resolves to whatever was primed (mirrors drizzle's promise-y query
    // builder behaviour).
    (out as unknown as PromiseLike<Result[]>).then = ((
      onfulfilled: (value: Result[]) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(rows).then(onfulfilled, onrejected)) as PromiseLike<
      Result[]
    >["then"];
    return out;
  }

  const db = {
    select: () => makeChain(queues.select.shift() ?? []),
    insert: () => makeChain(queues.insert.shift() ?? []),
    update: () => makeChain(queues.update.shift() ?? []),
    delete: () => makeChain([]),
  };

  // The schema objects are passed to drizzle helpers like `eq()` but never
  // serialized in our mocks, so any object placeholder works.
  const tableStub = new Proxy(
    {},
    { get: (_t, key) => (typeof key === "string" ? key : "") },
  );

  return {
    db,
    usersTable: tableStub,
    sessionsTable: tableStub,
    securityEventsTable: tableStub,
    __dbQueues: queues,
  };
});

// Replace email delivery with no-op spies so tests don't try to talk to Resend.
vi.mock("../lib/email", () => ({
  sendVerificationEmail: vi.fn(async () => {}),
  sendPasswordResetEmail: vi.fn(async () => {}),
  sendPasswordChangedEmail: vi.fn(async () => {}),
  sendNewSignInEmail: vi.fn(async () => {}),
  isEmailDeliveryConfigured: vi.fn(() => true),
  APP_ORIGIN: null,
}));

// Replace the auth library so tests don't need a session DB or bcrypt rounds.
// The route under test still does the real work for password-policy checks —
// only DB / crypto / OIDC helpers are stubbed.
const authStubs = {
  hashPassword: vi.fn(async (pw: string) => `hashed:${pw}`),
  verifyPassword: vi.fn(async () => true),
  createSession: vi.fn(async () => "stub-session-id"),
  deleteSession: vi.fn(async () => {}),
  deleteSessionsByUserId: vi.fn(async () => {}),
  deleteOtherSessionsForUser: vi.fn(async () => {}),
  listSessionsForUser: vi.fn(async () => [] as unknown[]),
  getSession: vi.fn(async () => null as unknown),
  getSessionId: vi.fn((req: { cookies?: Record<string, string> }) => {
    return req.cookies?.["sid"];
  }),
  clearSession: vi.fn(async () => {}),
  captureSessionContext: vi.fn(() => ({
    createdAt: Date.now(),
    userAgent: null,
    ipAddress: null,
  })),
  publicSessionId: vi.fn((sid: string) => `pub:${sid}`),
  getOidcConfig: vi.fn(async () => ({})),
};

vi.mock("../lib/auth", () => ({
  ...authStubs,
  SESSION_COOKIE: "sid",
  SESSION_TTL: 7 * 24 * 60 * 60 * 1000,
  ISSUER_URL: "https://replit.com/oidc",
  BCRYPT_COST: 4,
}));

// ---------------------------------------------------------------------------
// Test harness. We build a minimal Express app that mounts only the auth
// router under /api so we don't pull in the whole src/app.ts (which insists
// on a populated environment). The router internally registers
// authMiddleware-equivalent behaviour through getSession; we drive that via
// the mocked authStubs.getSession above.
// ---------------------------------------------------------------------------

let app: Express;
let dbQueues: {
  select: unknown[][];
  insert: unknown[][];
  update: unknown[][];
};

beforeAll(async () => {
  // Pull in the live router after mocks are wired.
  const authRouter = (await import("./auth")).default;
  const dbModule = (await import("@workspace/db")) as unknown as {
    __dbQueues: typeof dbQueues;
  };
  dbQueues = dbModule.__dbQueues;

  // The auth router relies on a sibling authMiddleware to populate
  // req.isAuthenticated / req.user before /auth/change-password runs.
  // Re-implement just enough of that here using the mocked getSession so
  // the routes see a realistic request shape.
  const { getSession, getSessionId } = await import("../lib/auth");

  app = express();
  app.set("trust proxy", 1);
  app.use(cookieParser());
  app.use(express.json());
  app.use(async (req, _res, next) => {
    req.isAuthenticated = function (this: typeof req) {
      return this.user != null;
    } as typeof req.isAuthenticated;
    const sid = getSessionId(req);
    if (!sid) {
      next();
      return;
    }
    const session = (await getSession(sid)) as
      | { user?: { id: string; email: string | null } }
      | null;
    if (session?.user) {
      req.user = session.user as typeof req.user;
    }
    next();
  });
  app.use("/api", authRouter);
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  // Reset queues & all stub call records between tests.
  dbQueues.select.length = 0;
  dbQueues.insert.length = 0;
  dbQueues.update.length = 0;
  authStubs.hashPassword.mockClear();
  authStubs.verifyPassword.mockClear();
  authStubs.createSession.mockClear();
  authStubs.deleteSession.mockClear();
  authStubs.deleteSessionsByUserId.mockClear();
  authStubs.deleteOtherSessionsForUser.mockClear();
  authStubs.listSessionsForUser.mockReset();
  authStubs.listSessionsForUser.mockResolvedValue([]);
  authStubs.getSession.mockReset();
  authStubs.getSession.mockResolvedValue(null);
  authStubs.verifyPassword.mockResolvedValue(true);
  // HIBP path: default to "not breached" so a strong password passes.
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response("0123456789ABCDEF0123456789ABCDEF012:9\n", { status: 200 }),
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

// A password that satisfies every rule in passwordPolicy (length, mix of
// case + digits, not common, not all numeric, not single char, doesn't
// contain the email local-part used in tests).
const STRONG_PASSWORD = "TastyOrbital99Quill";

// A representative weak password — present in the local common-passwords
// list, so the policy rejects it without ever reaching the HIBP step.
const WEAK_PASSWORD = "password123";

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "user-1",
    email: "alice@example.com",
    firstName: "Alice",
    lastName: "Example",
    profileImageUrl: null,
    passwordHash: "hashed:OldOrbital42!Quill",
    emailVerified: "true",
    emailVerificationToken: null,
    emailVerificationTokenExpiresAt: null,
    passwordResetToken: null,
    passwordResetTokenExpiresAt: null,
    oidcSub: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe("POST /api/auth/register", () => {
  test("rejects a weak password with 400 + policy error", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send({
        email: "newuser@example.com",
        password: WEAK_PASSWORD,
        firstName: "New",
        lastName: "User",
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commonly used/i);
    // Policy fired before the DB insert.
    expect(authStubs.hashPassword).not.toHaveBeenCalled();
    expect(dbQueues.insert).toHaveLength(0);
  });

  test("accepts a strong password and creates the account", async () => {
    const inserted = makeUser({
      id: "user-2",
      email: "newuser@example.com",
      passwordHash: `hashed:${STRONG_PASSWORD}`,
      emailVerified: "false",
    });
    dbQueues.insert.push([inserted]);

    const res = await request(app)
      .post("/api/auth/register")
      .set("Content-Type", "application/json")
      .send({
        email: "newuser@example.com",
        password: STRONG_PASSWORD,
        firstName: "New",
        lastName: "User",
      });

    expect(res.status).toBe(201);
    expect(res.body.requiresVerification).toBe(true);
    expect(authStubs.hashPassword).toHaveBeenCalledWith(STRONG_PASSWORD);
  });
});

describe("POST /api/auth/reset-password", () => {
  test("rejects a weak new password with 400 + policy error", async () => {
    const token = "raw-reset-token";
    // The route looks up the user by the SHA-256 hash of the submitted
    // token. Our mock ignores the actual filter and returns whatever's
    // primed, so a non-empty array is enough to get past the lookup and
    // exercise the policy check.
    dbQueues.select.push([
      makeUser({
        passwordResetToken: crypto
          .createHash("sha256")
          .update(token)
          .digest("hex"),
        passwordResetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }),
    ]);

    const res = await request(app)
      .post("/api/auth/reset-password")
      .set("Content-Type", "application/json")
      .send({ token, password: WEAK_PASSWORD });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commonly used/i);
    // Policy must run before the password is hashed and persisted.
    expect(authStubs.hashPassword).not.toHaveBeenCalled();
    expect(dbQueues.update).toHaveLength(0);
  });

  test("accepts a strong new password and rotates the credential", async () => {
    const token = "raw-reset-token";
    dbQueues.select.push([
      makeUser({
        passwordResetToken: crypto
          .createHash("sha256")
          .update(token)
          .digest("hex"),
        passwordResetTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }),
    ]);
    dbQueues.update.push([]); // password update result (unused)

    const res = await request(app)
      .post("/api/auth/reset-password")
      .set("Content-Type", "application/json")
      .send({ token, password: STRONG_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
    expect(authStubs.hashPassword).toHaveBeenCalledWith(STRONG_PASSWORD);
    expect(authStubs.deleteSessionsByUserId).toHaveBeenCalledWith("user-1");
  });
});

describe("POST /api/auth/login (new-device email notification)", () => {
  async function getEmailModule() {
    return (await import("../lib/email")) as unknown as {
      sendNewSignInEmail: ReturnType<typeof vi.fn>;
    };
  }

  test("emails the member when no prior security_events row matches", async () => {
    const { sendNewSignInEmail } = await getEmailModule();
    sendNewSignInEmail.mockClear();

    const user = makeUser();
    // 1) user lookup by email, 2) familiarity lookup in security_events
    dbQueues.select.push([user]);
    dbQueues.select.push([]); // no prior matching events → unfamiliar device
    dbQueues.insert.push([]); // recordSecurityEvent insert

    const res = await request(app)
      .post("/api/auth/password-login")
      .set("Content-Type", "application/json")
      .send({ email: user.email, password: "doesnt-matter-stub-accepts" });

    expect(res.status).toBe(200);
    expect(sendNewSignInEmail).toHaveBeenCalledTimes(1);
    expect(sendNewSignInEmail).toHaveBeenCalledWith(
      user.email,
      expect.objectContaining({
        signedInAt: expect.any(Date),
        appOrigin: expect.any(String),
      }),
    );
  });

  test("does not email when a prior security_events row matches the device", async () => {
    const { sendNewSignInEmail } = await getEmailModule();
    sendNewSignInEmail.mockClear();

    const user = makeUser();
    dbQueues.select.push([user]); // user lookup
    // Familiarity lookup returns a row → device has been seen before.
    dbQueues.select.push([{ id: "prior-event-id" }]);
    dbQueues.insert.push([]);

    const res = await request(app)
      .post("/api/auth/password-login")
      .set("Content-Type", "application/json")
      .send({ email: user.email, password: "doesnt-matter-stub-accepts" });

    expect(res.status).toBe(200);
    expect(sendNewSignInEmail).not.toHaveBeenCalled();
  });

  test("login still succeeds when the new-device email delivery throws", async () => {
    const { sendNewSignInEmail } = await getEmailModule();
    sendNewSignInEmail.mockClear();
    sendNewSignInEmail.mockRejectedValueOnce(new Error("resend down"));

    const user = makeUser();
    dbQueues.select.push([user]);
    dbQueues.select.push([]); // unfamiliar device
    dbQueues.insert.push([]);

    const res = await request(app)
      .post("/api/auth/password-login")
      .set("Content-Type", "application/json")
      .send({ email: user.email, password: "doesnt-matter-stub-accepts" });

    expect(res.status).toBe(200);
    expect(sendNewSignInEmail).toHaveBeenCalledTimes(1);
    // Even though the email throws, the session was created and the response
    // shape mirrors a normal successful login.
    expect(authStubs.createSession).toHaveBeenCalled();
    expect(res.body.user).toMatchObject({ id: user.id, email: user.email });
  });
});

describe("POST /api/auth/change-password", () => {
  function primeAuthenticatedSession(user = makeUser()) {
    authStubs.getSession.mockResolvedValue({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      },
      provider: "password",
    });
    return user;
  }

  test("rejects a weak new password with 400 + policy error", async () => {
    const user = primeAuthenticatedSession();
    dbQueues.select.push([user]); // the user-by-id lookup inside the route

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Content-Type", "application/json")
      .set("Cookie", "sid=fake-sid")
      .send({
        currentPassword: "anything-our-stub-accepts",
        newPassword: WEAK_PASSWORD,
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/commonly used/i);
    // verifyPassword runs *before* the policy check (so the endpoint can't
    // be used as an unauthenticated weak-password oracle), but the new
    // password must never be hashed when policy fails.
    expect(authStubs.verifyPassword).toHaveBeenCalled();
    expect(authStubs.hashPassword).not.toHaveBeenCalled();
    expect(dbQueues.update).toHaveLength(0);
  });

  test("accepts a strong new password and rotates the credential", async () => {
    const user = primeAuthenticatedSession();
    dbQueues.select.push([user]);
    dbQueues.update.push([]); // password update

    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Content-Type", "application/json")
      .set("Cookie", "sid=fake-sid")
      .send({
        currentPassword: "anything-our-stub-accepts",
        newPassword: STRONG_PASSWORD,
      });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/updated/i);
    expect(authStubs.hashPassword).toHaveBeenCalledWith(STRONG_PASSWORD);
    expect(authStubs.deleteOtherSessionsForUser).toHaveBeenCalledWith(
      user.id,
      "fake-sid",
    );
  });

  test("returns 401 without a session cookie (sanity check)", async () => {
    const res = await request(app)
      .post("/api/auth/change-password")
      .set("Content-Type", "application/json")
      .send({
        currentPassword: "x",
        newPassword: STRONG_PASSWORD,
      });

    expect(res.status).toBe(401);
  });
});

describe("POST /api/auth/password-login", () => {
  test("issues a session cookie when credentials are valid", async () => {
    dbQueues.select.push([makeUser()]);
    authStubs.verifyPassword.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/password-login")
      .set("Content-Type", "application/json")
      .send({ email: "alice@example.com", password: STRONG_PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe("alice@example.com");
    expect(res.body.user.id).toBe("user-1");
    expect(authStubs.verifyPassword).toHaveBeenCalledWith(
      STRONG_PASSWORD,
      "hashed:OldOrbital42!Quill",
    );
    expect(authStubs.createSession).toHaveBeenCalledTimes(1);
    // setSessionCookie writes the SESSION_COOKIE name.
    const cookies = res.headers["set-cookie"];
    const cookieList = Array.isArray(cookies) ? cookies : [cookies];
    expect(cookieList.some((c) => c.startsWith("sid=stub-session-id"))).toBe(
      true,
    );
  });

  test("returns 401 with a generic message when the password is wrong", async () => {
    dbQueues.select.push([makeUser()]);
    authStubs.verifyPassword.mockResolvedValue(false);

    const res = await request(app)
      .post("/api/auth/password-login")
      .set("Content-Type", "application/json")
      .send({ email: "alice@example.com", password: STRONG_PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid email or password/i);
    expect(authStubs.createSession).not.toHaveBeenCalled();
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  test("returns 403 when the account email is not verified", async () => {
    dbQueues.select.push([makeUser({ emailVerified: "false" })]);
    authStubs.verifyPassword.mockResolvedValue(true);

    const res = await request(app)
      .post("/api/auth/password-login")
      .set("Content-Type", "application/json")
      .send({ email: "alice@example.com", password: STRONG_PASSWORD });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not verified/i);
    // Verification check fires before the password check, so we never even
    // reach verifyPassword and definitely never mint a session.
    expect(authStubs.verifyPassword).not.toHaveBeenCalled();
    expect(authStubs.createSession).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/verify-email", () => {
  test("activates the account and signs the user in for a valid token", async () => {
    const token = "raw-verify-token";
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    dbQueues.select.push([
      makeUser({
        emailVerified: "false",
        emailVerificationToken: tokenHash,
        emailVerificationTokenExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
      }),
    ]);
    dbQueues.update.push([]);

    const res = await request(app)
      .post("/api/auth/verify-email")
      .set("Content-Type", "application/json")
      .send({ token });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe("user-1");
    expect(res.body.user.email).toBe("alice@example.com");
    expect(authStubs.createSession).toHaveBeenCalledTimes(1);
    const cookies = res.headers["set-cookie"];
    const cookieList = Array.isArray(cookies) ? cookies : [cookies];
    expect(cookieList.some((c) => c.startsWith("sid=stub-session-id"))).toBe(
      true,
    );
  });

  test("returns 400 when the token does not match any pending verification", async () => {
    dbQueues.select.push([]); // no row matches the hashed token

    const res = await request(app)
      .post("/api/auth/verify-email")
      .set("Content-Type", "application/json")
      .send({ token: "totally-bogus-token" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
    expect(authStubs.createSession).not.toHaveBeenCalled();
  });

  test("returns 400 when the verification token is expired", async () => {
    const token = "expired-token";
    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");
    dbQueues.select.push([
      makeUser({
        emailVerified: "false",
        emailVerificationToken: tokenHash,
        // Already expired one second ago.
        emailVerificationTokenExpiresAt: new Date(Date.now() - 1000),
      }),
    ]);

    const res = await request(app)
      .post("/api/auth/verify-email")
      .set("Content-Type", "application/json")
      .send({ token });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid or expired/i);
    expect(authStubs.createSession).not.toHaveBeenCalled();
    // The expired-token branch must not flip emailVerified to "true".
    expect(dbQueues.update).toHaveLength(0);
  });
});

describe("POST /api/auth/request-password-reset", () => {
  test("issues a reset token for a verified account with a password", async () => {
    dbQueues.select.push([makeUser()]);
    dbQueues.update.push([]); // token-write update

    const res = await request(app)
      .post("/api/auth/request-password-reset")
      .set("Content-Type", "application/json")
      .send({ email: "alice@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
    // Non-production response includes the dev token so the flow is testable
    // without a real email provider.
    expect(typeof res.body.devResetToken).toBe("string");
    expect(res.body.devResetToken.length).toBeGreaterThan(16);
    // The token-write update must have run.
    expect(dbQueues.update).toHaveLength(0); // consumed by the route
  });

  test("returns the same generic message when the email is unknown", async () => {
    dbQueues.select.push([]); // no user

    const res = await request(app)
      .post("/api/auth/request-password-reset")
      .set("Content-Type", "application/json")
      .send({ email: "ghost@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
    // No dev token because no row was found and no UPDATE ran.
    expect(res.body.devResetToken).toBeUndefined();
  });

  test("returns the same generic message for an unverified account", async () => {
    dbQueues.select.push([makeUser({ emailVerified: "false" })]);

    const res = await request(app)
      .post("/api/auth/request-password-reset")
      .set("Content-Type", "application/json")
      .send({ email: "alice@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/if an account exists/i);
    // Must NOT mint a token: doing so would let a probe bypass verification.
    expect(res.body.devResetToken).toBeUndefined();
  });
});

describe("GET /api/auth/sessions", () => {
  function primeAuthenticatedSession(user = makeUser()) {
    authStubs.getSession.mockResolvedValue({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      },
      provider: "password",
    });
    return user;
  }

  test("returns 401 without a session cookie", async () => {
    const res = await request(app).get("/api/auth/sessions");
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/sign in/i);
  });

  test("returns the caller's sessions with the current one flagged", async () => {
    primeAuthenticatedSession();
    const createdAt = Date.now() - 5 * 60 * 1000;
    authStubs.listSessionsForUser.mockResolvedValue([
      {
        sid: "current-sid",
        sess: {
          user: { id: "user-1" },
          createdAt,
          userAgent: "TestAgent/1.0",
          ipAddress: "203.0.113.4",
        },
        expire: new Date(Date.now() + 60 * 60 * 1000),
      },
      {
        sid: "other-sid",
        sess: {
          user: { id: "user-1" },
          createdAt: createdAt - 60 * 1000,
          userAgent: "OtherAgent/2.0",
          ipAddress: "198.51.100.7",
        },
        expire: new Date(Date.now() + 60 * 60 * 1000),
      },
    ]);

    const res = await request(app)
      .get("/api/auth/sessions")
      .set("Cookie", "sid=current-sid");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.sessions)).toBe(true);
    expect(res.body.sessions).toHaveLength(2);

    const current = res.body.sessions.find(
      (s: { id: string }) => s.id === "pub:current-sid",
    );
    const other = res.body.sessions.find(
      (s: { id: string }) => s.id === "pub:other-sid",
    );
    expect(current).toBeDefined();
    expect(other).toBeDefined();
    expect(current.isCurrent).toBe(true);
    expect(other.isCurrent).toBe(false);
    expect(current.userAgent).toBe("TestAgent/1.0");
    expect(current.ipAddress).toBe("203.0.113.4");
  });
});

describe("POST /api/auth/sessions/:id/revoke", () => {
  function primeAuthenticatedSession(user = makeUser()) {
    authStubs.getSession.mockResolvedValue({
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      },
      provider: "password",
    });
    return user;
  }

  test("returns 401 without a session cookie", async () => {
    const res = await request(app)
      .post("/api/auth/sessions/pub:any-sid/revoke")
      .set("Content-Type", "application/json")
      .send({});

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/sign in/i);
    expect(authStubs.deleteSession).not.toHaveBeenCalled();
  });

  test("revokes another session and reports signedOut: false", async () => {
    primeAuthenticatedSession();
    authStubs.listSessionsForUser.mockResolvedValue([
      {
        sid: "current-sid",
        sess: { user: { id: "user-1" }, createdAt: Date.now() },
        expire: new Date(Date.now() + 60 * 60 * 1000),
      },
      {
        sid: "other-sid",
        sess: { user: { id: "user-1" }, createdAt: Date.now() - 60_000 },
        expire: new Date(Date.now() + 60 * 60 * 1000),
      },
    ]);

    const res = await request(app)
      .post(`/api/auth/sessions/${encodeURIComponent("pub:other-sid")}/revoke`)
      .set("Content-Type", "application/json")
      .set("Cookie", "sid=current-sid")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(true);
    expect(res.body.signedOut).toBe(false);
    expect(authStubs.deleteSession).toHaveBeenCalledWith("other-sid");
    // Caller's own cookie must NOT be cleared when revoking a different device.
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  test("revoking the current session clears the cookie and signals signedOut", async () => {
    primeAuthenticatedSession();
    authStubs.listSessionsForUser.mockResolvedValue([
      {
        sid: "current-sid",
        sess: { user: { id: "user-1" }, createdAt: Date.now() },
        expire: new Date(Date.now() + 60 * 60 * 1000),
      },
    ]);

    const res = await request(app)
      .post(
        `/api/auth/sessions/${encodeURIComponent("pub:current-sid")}/revoke`,
      )
      .set("Content-Type", "application/json")
      .set("Cookie", "sid=current-sid")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(true);
    expect(res.body.signedOut).toBe(true);
    expect(authStubs.deleteSession).toHaveBeenCalledWith("current-sid");
    const cookies = res.headers["set-cookie"];
    const cookieList = Array.isArray(cookies) ? cookies : [cookies];
    // clearCookie writes a sid=; with an Expires in the past.
    expect(cookieList.some((c) => /^sid=;/.test(c))).toBe(true);
  });

  test("returns 404 when the public id does not match any of the caller's sessions", async () => {
    primeAuthenticatedSession();
    authStubs.listSessionsForUser.mockResolvedValue([
      {
        sid: "current-sid",
        sess: { user: { id: "user-1" }, createdAt: Date.now() },
        expire: new Date(Date.now() + 60 * 60 * 1000),
      },
    ]);

    const res = await request(app)
      .post(
        `/api/auth/sessions/${encodeURIComponent("pub:someone-elses-sid")}/revoke`,
      )
      .set("Content-Type", "application/json")
      .set("Cookie", "sid=current-sid")
      .send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not found/i);
    expect(authStubs.deleteSession).not.toHaveBeenCalled();
  });
});
