import * as oidc from "openid-client";
import crypto from "crypto";
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { and, desc, eq, isNull } from "drizzle-orm";
import rateLimit from "express-rate-limit";
import {
  GetCurrentAuthUserResponse,
  ExchangeMobileAuthorizationCodeBody,
  ExchangeMobileAuthorizationCodeResponse,
  ListRecentSecurityEventsResponse,
  LogoutMobileSessionResponse,
  RegisterWithPasswordBody,
  LoginWithPasswordBody,
  RequestPasswordResetBody,
  ResetPasswordBody,
  ChangePasswordBody,
} from "@workspace/api-zod";
import { db, securityEventsTable, usersTable } from "@workspace/db";
import {
  captureSessionContext,
  clearSession,
  getOidcConfig,
  getSession,
  getSessionId,
  createSession,
  deleteSession,
  deleteSessionsByUserId,
  deleteOtherSessionsForUser,
  hashPassword,
  listSessionsForUser,
  publicSessionId,
  verifyPassword,
  SESSION_COOKIE,
  SESSION_TTL,
  ISSUER_URL,
  type SessionData,
} from "../lib/auth";
import { logger } from "../lib/logger";
import { resolveLocation } from "../lib/geoip";
import { assertAcceptablePassword } from "../lib/passwordPolicy";
import { requireAuth } from "../middlewares/requireAuth";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  sendNewSignInEmail,
  isEmailDeliveryConfigured,
  APP_ORIGIN,
} from "../lib/email";

const OIDC_COOKIE_TTL = 10 * 60 * 1000;

const passwordRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Please try again later." },
  skipSuccessfulRequests: false,
});

function requireJsonContentType(req: Request, res: Response, next: NextFunction) {
  const ct = req.headers["content-type"] ?? "";
  if (!ct.includes("application/json")) {
    res.status(415).json({ error: "Content-Type must be application/json." });
    return;
  }
  next();
}

// Reject cross-origin requests to password auth endpoints.
// Browsers always send an Origin header on cross-origin requests (including
// credentialed fetch), so checking it here blocks CSRF-based forced login/
// account-binding attacks regardless of CORS preflight behaviour.
function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers["origin"];
  if (origin !== undefined) {
    const serverOrigin = getOrigin(req);
    if (origin !== serverOrigin) {
      res.status(403).json({ error: "Cross-origin requests are not permitted on this endpoint." });
      return;
    }
  }
  next();
}

const router: IRouter = Router();

type SecurityEventType =
  | "login_password"
  | "login_oidc"
  | "password_reset"
  | "password_changed";

// Pull the (ipAddress, userAgent) tuple we associate with this request. The
// User-Agent is truncated to 500 chars to match the column length and prevent
// pathological clients from blowing up the audit log.
function extractRequestContext(req: Request): {
  ipAddress: string | null;
  userAgent: string | null;
} {
  const userAgentHeader = req.headers["user-agent"];
  const userAgent =
    typeof userAgentHeader === "string" ? userAgentHeader.slice(0, 500) : null;
  return { ipAddress: req.ip ?? null, userAgent };
}

// Record a security-relevant event for the given user. Failures are swallowed
// (with a logged error) because losing an audit-log row must never block the
// user-facing action that triggered it (e.g. a successful sign-in).
async function recordSecurityEvent(
  userId: string,
  eventType: SecurityEventType,
  req: Request,
): Promise<void> {
  try {
    const { ipAddress, userAgent } = extractRequestContext(req);
    await db.insert(securityEventsTable).values({
      userId,
      eventType,
      ipAddress,
      userAgent,
    });
  } catch (err) {
    logger.error(
      { err, userId, eventType },
      "Failed to record security event",
    );
  }
}

// Email the account owner when a sign-in arrives from an (ipAddress, userAgent)
// pair we have never seen on this account before. Mirrors the bank / Google
// "new sign-in" pattern: any time the security_events table has no row for the
// same userId + IP + UA, we treat the device as unfamiliar and send a heads-up
// so the member can react quickly if it wasn't them.
//
// Must be invoked BEFORE the matching recordSecurityEvent insert, otherwise the
// row we just wrote would itself look like prior history and suppress the
// notification. Failures (DB lookup or email delivery) are logged and swallowed
// — they must never roll back the sign-in (mirrors /auth/reset-password).
async function notifyIfNewSignInDevice(
  userId: string,
  email: string | null,
  req: Request,
): Promise<void> {
  if (!email) return;
  try {
    const { ipAddress, userAgent } = extractRequestContext(req);

    const ipCondition =
      ipAddress === null
        ? isNull(securityEventsTable.ipAddress)
        : eq(securityEventsTable.ipAddress, ipAddress);
    const uaCondition =
      userAgent === null
        ? isNull(securityEventsTable.userAgent)
        : eq(securityEventsTable.userAgent, userAgent);

    const [existing] = await db
      .select({ id: securityEventsTable.id })
      .from(securityEventsTable)
      .where(
        and(eq(securityEventsTable.userId, userId), ipCondition, uaCondition),
      )
      .limit(1);

    if (existing) {
      // Familiar (userId, IP, UA) combo — sign-in is from a device we've seen
      // before on this account, so no heads-up email is warranted.
      return;
    }

    await sendNewSignInEmail(email, {
      signedInAt: new Date(),
      ipAddress,
      userAgent,
      appOrigin: APP_ORIGIN ?? getOrigin(req),
    });
  } catch (err) {
    // Swallow failures so a flaky DB lookup or email provider can't roll back
    // the sign-in itself. Log so operators can investigate.
    logger.error(
      { err, userId },
      "New sign-in notification email delivery failed",
    );
  }
}

function getOrigin(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host =
    req.headers["x-forwarded-host"] || req.headers["host"] || "localhost";
  return `${proto}://${host}`;
}

function setSessionCookie(res: Response, sid: string) {
  res.cookie(SESSION_COOKIE, sid, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL,
  });
}

function setOidcCookie(res: Response, name: string, value: string) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: OIDC_COOKIE_TTL,
  });
}

function getSafeReturnTo(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

async function upsertUser(claims: Record<string, unknown>) {
  const rawEmail = typeof claims.email === "string" ? claims.email : null;
  // Lowercase for consistency with the password auth path so an account
  // is uniquely identified by its email regardless of provider.
  const normalizedEmail = rawEmail ? rawEmail.trim().toLowerCase() : null;
  const firstName = (claims.first_name as string) || null;
  const lastName = (claims.last_name as string) || null;
  const profileImageUrl = (claims.profile_image_url || claims.picture) as string | null;

  // If the OIDC email already belongs to a password-registered account, update
  // that existing record in-place rather than failing on the unique constraint.
  // This prevents an attacker who pre-registered an email via password signup
  // from blocking the real owner's OIDC login.
  if (normalizedEmail) {
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    if (existing && existing.id !== (claims.sub as string)) {
      // If oidcSub already matches this OIDC subject the account was already
      // reconciled on a previous login. Return the existing account directly
      // to avoid repeated session-revocation churn.
      if (existing.oidcSub === (claims.sub as string)) {
        // Update mutable profile fields from fresh OIDC claims without
        // touching any security-sensitive columns.
        const [refreshed] = await db
          .update(usersTable)
          .set({
            firstName: firstName ?? existing.firstName,
            lastName: lastName ?? existing.lastName,
            profileImageUrl: profileImageUrl ?? existing.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.email, normalizedEmail))
          .returning();
        return refreshed;
      }

      if (existing.emailVerified !== "true") {
        // Unverified account — treat as an untrusted pre-registration (potential
        // attacker). Revoke any sessions, null the password credential, and
        // transfer ownership to the OIDC provider who has verified the email.
        await deleteSessionsByUserId(existing.id);
        const [updated] = await db
          .update(usersTable)
          .set({
            passwordHash: null,
            emailVerified: "true",
            emailVerificationToken: null,
            emailVerificationTokenExpiresAt: null,
            oidcSub: claims.sub as string,
            firstName: firstName ?? existing.firstName,
            lastName: lastName ?? existing.lastName,
            profileImageUrl: profileImageUrl ?? existing.profileImageUrl,
            updatedAt: new Date(),
          })
          .where(eq(usersTable.email, normalizedEmail))
          .returning();
        return updated;
      }

      // Verified password account — this is a legitimate user adding OIDC as
      // a second login method. Keep passwordHash intact; record oidcSub so
      // future OIDC logins hit the fast path and only update mutable profile
      // fields without touching any security-sensitive columns.
      const [updated] = await db
        .update(usersTable)
        .set({
          emailVerificationToken: null,
          emailVerificationTokenExpiresAt: null,
          oidcSub: claims.sub as string,
          firstName: firstName ?? existing.firstName,
          lastName: lastName ?? existing.lastName,
          profileImageUrl: profileImageUrl ?? existing.profileImageUrl,
          updatedAt: new Date(),
        })
        .where(eq(usersTable.email, normalizedEmail))
        .returning();
      return updated;
    }
  }

  // OIDC-authenticated users are always verified (the provider confirms email).
  const userData = {
    id: claims.sub as string,
    email: normalizedEmail,
    emailVerified: "true" as const,
    firstName,
    lastName,
    profileImageUrl,
  };

  const [user] = await db
    .insert(usersTable)
    .values(userData)
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        ...userData,
        updatedAt: new Date(),
      },
    })
    .returning();
  return user;
}

router.get("/auth/user", (req: Request, res: Response) => {
  res.json(
    GetCurrentAuthUserResponse.parse({
      user: req.isAuthenticated() ? req.user : null,
    }),
  );
});

router.post("/auth/register", passwordRateLimit, requireSameOrigin, requireJsonContentType, async (req: Request, res: Response) => {
  const parsed = RegisterWithPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    });
    return;
  }

  const { email, password, firstName, lastName } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  // Reject obviously-weak / breached passwords before doing the expensive
  // bcrypt hash so we don't pay that cost for inputs we're going to discard.
  const policy = await assertAcceptablePassword(password, {
    email: normalizedEmail,
  });
  if (!policy.ok) {
    res.status(400).json({ error: policy.error });
    return;
  }

  const passwordHash = await hashPassword(password);

  // Generate the verification token before the INSERT so the hash is written
  // atomically in the same statement. This eliminates the partial-failure
  // window where a restart between INSERT and a follow-up UPDATE would leave
  // the row with emailVerified="false" and no token — a state that the legacy
  // backfill would then incorrectly promote to verified.
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationTokenHash = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  // Upsert strategy: if the email is already registered but still unverified
  // (pending confirmation), overwrite the pending slot so the most recent
  // registration attempt holds the token — this prevents an attacker who
  // pre-registered the address from permanently blocking a legitimate user's
  // password registration. If the email belongs to a *verified* account (real
  // owner has confirmed ownership) the conditional DO UPDATE is skipped and
  // RETURNING comes back empty, which we surface as a 409.
  // Tokens are valid for 24 hours. After expiry the verify-email endpoint
  // rejects them even if the hash matches, preventing indefinite reuse.
  const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const inserted = await db
    .insert(usersTable)
    .values({
      email: normalizedEmail,
      firstName: firstName ?? null,
      lastName: lastName ?? null,
      passwordHash,
      emailVerificationToken: verificationTokenHash,
      emailVerificationTokenExpiresAt: tokenExpiresAt,
    })
    .onConflictDoUpdate({
      target: usersTable.email,
      // Only overwrite the row when the existing account is still unverified.
      // If emailVerified = 'true' the WHERE condition is false, DO UPDATE is
      // skipped, and RETURNING returns nothing — treated as 409 below.
      setWhere: eq(usersTable.emailVerified, "false"),
      set: {
        passwordHash,
        emailVerificationToken: verificationTokenHash,
        emailVerificationTokenExpiresAt: tokenExpiresAt,
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  const user = inserted[0];
  if (!user) {
    res
      .status(409)
      .json({ error: "An account with this email already exists." });
    return;
  }

  // Attempt to deliver the verification token via email.
  // sendVerificationEmail is a no-op (with a warning log) when RESEND_API_KEY
  // is not configured, so the registration response still succeeds.
  try {
    await sendVerificationEmail(user.email!, verificationToken, APP_ORIGIN ?? getOrigin(req));
  } catch {
    // Email delivery failed (e.g. Resend API error). The account was created
    // and the token is stored — the user can request a resend via
    // POST /auth/resend-verification. Log and continue so registration doesn't
    // surface an opaque 500 to the browser.
    logger.error({ userId: user.id }, "Verification email delivery failed");
  }

  // In non-production environments include the plaintext token in the response
  // so the verification flow can be exercised end-to-end without a real email
  // delivery service. This field is NEVER included when NODE_ENV === 'production'.
  const devFields =
    process.env.NODE_ENV !== "production"
      ? { devVerificationToken: verificationToken }
      : {};

  res.status(201).json({
    message:
      process.env.NODE_ENV !== "production"
        ? "Account created. Use the devVerificationToken field (non-production only) to call POST /auth/verify-email and activate the account."
        : isEmailDeliveryConfigured()
          ? "Account created. Please check your email to verify your address."
          : "Account created. Email delivery is not yet configured — contact the administrator to verify your account.",
    requiresVerification: true,
    ...devFields,
  });
});

router.post(
  "/auth/verify-email",
  passwordRateLimit,
  requireJsonContentType,
  async (req: Request, res: Response) => {
    const { token } = req.body ?? {};
    if (typeof token !== "string" || !token) {
      res.status(400).json({ error: "Verification token is required." });
      return;
    }

    // Hash the submitted token before comparing so the stored value is never
    // returned to callers even if they can read the query response.
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.emailVerificationToken, tokenHash))
      .limit(1);

    if (!user) {
      res.status(400).json({ error: "Invalid or expired verification token." });
      return;
    }

    // Reject tokens past their expiry window. This check happens after the
    // hash lookup so we don't leak whether a token exists at all.
    if (
      user.emailVerificationTokenExpiresAt &&
      user.emailVerificationTokenExpiresAt < new Date()
    ) {
      res.status(400).json({ error: "Invalid or expired verification token." });
      return;
    }

    await db
      .update(usersTable)
      .set({
        emailVerified: "true",
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
      })
      .where(eq(usersTable.id, user.id));

    const sessionData: SessionData = {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
      },
      provider: "password",
      ...captureSessionContext(req),
    };

    const sid = await createSession(sessionData);
    setSessionCookie(res, sid);
    res.json(GetCurrentAuthUserResponse.parse({ user: sessionData.user }));
  },
);

// Allow users whose verification email was lost, delayed, or never delivered
// to request a fresh token. This endpoint always returns 200 regardless of
// whether the email exists to avoid disclosing account information.
router.post(
  "/auth/resend-verification",
  passwordRateLimit,
  requireSameOrigin,
  requireJsonContentType,
  async (req: Request, res: Response) => {
    const { email } = req.body ?? {};
    if (typeof email !== "string" || !email) {
      res.status(400).json({ error: "Email address is required." });
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    // Always respond with the same message to avoid leaking account existence.
    const successResponse = {
      message: "If an unverified account exists for that address, a new verification email has been sent.",
    };

    // No account, already verified, or no password hash (OIDC-only) — nothing to do.
    if (!user || user.emailVerified === "true" || !user.passwordHash) {
      res.json(successResponse);
      return;
    }

    // Issue a fresh token so the new email supersedes any stale link.
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const verificationTokenHash = crypto
      .createHash("sha256")
      .update(verificationToken)
      .digest("hex");
    const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db
      .update(usersTable)
      .set({
        emailVerificationToken: verificationTokenHash,
        emailVerificationTokenExpiresAt: tokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    try {
      await sendVerificationEmail(user.email!, verificationToken, APP_ORIGIN ?? getOrigin(req));
    } catch {
      logger.error({ userId: user.id }, "Resend verification email delivery failed");
    }

    res.json(successResponse);
  },
);

// Begin a password reset round-trip. Emails a one-time link if the address
// belongs to a verified password account. Always responds 200 (with the same
// message) regardless of whether the account exists, so attackers cannot use
// this endpoint to enumerate registered users.
router.post(
  "/auth/request-password-reset",
  passwordRateLimit,
  requireSameOrigin,
  requireJsonContentType,
  async (req: Request, res: Response) => {
    const parsed = RequestPasswordResetBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      });
      return;
    }

    const { email } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const successResponse = {
      message:
        "If an account exists for that address, a password reset email has been sent.",
    };

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, normalizedEmail))
      .limit(1);

    // Skip emailing when:
    //  - the address is not registered,
    //  - the account has no password credential (OIDC-only — there is nothing
    //    to reset; the user should sign in via Replit), or
    //  - the email has not been verified yet (a successful reset would let an
    //    attacker who knows the address bypass the verify step entirely).
    if (
      !user ||
      !user.passwordHash ||
      user.emailVerified !== "true"
    ) {
      res.json(successResponse);
      return;
    }

    // Issue a fresh single-use token. Reset tokens are short-lived (1 hour)
    // because they grant unauthenticated control of the account.
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");
    const tokenExpiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db
      .update(usersTable)
      .set({
        passwordResetToken: resetTokenHash,
        passwordResetTokenExpiresAt: tokenExpiresAt,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    try {
      await sendPasswordResetEmail(
        user.email!,
        resetToken,
        APP_ORIGIN ?? getOrigin(req),
      );
    } catch {
      logger.error(
        { userId: user.id },
        "Password reset email delivery failed",
      );
    }

    // In non-production environments include the plaintext token in the
    // response so the reset flow can be exercised end-to-end without a real
    // email delivery service. NEVER included when NODE_ENV === 'production'.
    const devFields =
      process.env.NODE_ENV !== "production"
        ? { devResetToken: resetToken }
        : {};

    res.json({ ...successResponse, ...devFields });
  },
);

// Consume a password-reset token and set a new password. Tokens are
// single-use: the stored hash is cleared in the same UPDATE that writes the
// new password, and any active sessions are revoked so a previously
// compromised browser cannot continue to act as the user.
router.post(
  "/auth/reset-password",
  passwordRateLimit,
  requireJsonContentType,
  async (req: Request, res: Response) => {
    const parsed = ResetPasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      });
      return;
    }

    const { token, password } = parsed.data;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.passwordResetToken, tokenHash))
      .limit(1);

    // Use the same opaque error for "token not found" and "token expired" so
    // we don't leak whether a hash existed at all.
    if (!user) {
      res.status(400).json({ error: "Invalid or expired reset token." });
      return;
    }

    if (
      user.passwordResetTokenExpiresAt &&
      user.passwordResetTokenExpiresAt < new Date()
    ) {
      res.status(400).json({ error: "Invalid or expired reset token." });
      return;
    }

    // Even though the caller proved control of the inbox, we still want their
    // *new* password to clear the same weak/breached bar as a fresh signup.
    const policy = await assertAcceptablePassword(password, {
      email: user.email,
    });
    if (!policy.ok) {
      res.status(400).json({ error: policy.error });
      return;
    }

    const passwordHash = await hashPassword(password);

    await db
      .update(usersTable)
      .set({
        passwordHash,
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        // A successful reset implies the user controls the inbox, so any
        // previously unverified account is now provably owned by them.
        emailVerified: "true",
        emailVerificationToken: null,
        emailVerificationTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    // Invalidate every existing session for this user. Anyone holding a stale
    // cookie (including a stolen one) is forced back through sign-in with the
    // new password.
    await deleteSessionsByUserId(user.id);

    // Persist an audit-log row so the account owner can see this event in
    // their recent-activity panel even if the change-notification email is
    // deleted or never arrives.
    await recordSecurityEvent(user.id, "password_reset", req);

    // Notify the account owner out-of-band that their password just changed.
    // This is the only signal a legitimate user gets if an attacker briefly
    // controls their inbox and forces a reset, so it must run after the
    // credential rotation has succeeded. Failure to deliver must not roll
    // back the password change — the user's new password is already live.
    if (user.email) {
      try {
        await sendPasswordChangedEmail(user.email, {
          changedAt: new Date(),
          ipAddress: req.ip ?? null,
          userAgent:
            typeof req.headers["user-agent"] === "string"
              ? req.headers["user-agent"]
              : null,
        });
      } catch {
        logger.error(
          { userId: user.id },
          "Password changed notification email delivery failed",
        );
      }
    }

    res.json({
      message: "Password updated. You can now sign in with your new password.",
    });
  },
);

// Rotate the password for a user who is already signed in. Unlike
// /auth/reset-password (which is unauthenticated and consumes an emailed
// token) this endpoint requires a live session and re-verifies the current
// password before accepting a new one. On success every *other* session for
// the user is revoked so a stolen cookie can't keep acting as them, but the
// caller's current session is preserved so they don't have to sign back in
// on the device they just changed the password from.
router.post(
  "/auth/change-password",
  passwordRateLimit,
  requireSameOrigin,
  requireJsonContentType,
  requireAuth,
  async (req: Request, res: Response) => {
    const parsed = ChangePasswordBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: parsed.error.issues[0]?.message ?? "Invalid input",
      });
      return;
    }

    const { currentPassword, newPassword } = parsed.data;
    const userId = req.user!.id;

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    // The session pointed at a user that no longer exists. Treat the same as
    // an unauthenticated request rather than 500-ing.
    if (!user) {
      res.status(401).json({ error: "Sign in to continue." });
      return;
    }

    // OIDC-only accounts have no password to rotate. Surface a clear 403
    // instead of pretending the current password was wrong.
    if (!user.passwordHash) {
      res.status(403).json({
        error:
          "This account signs in with Replit and does not have a password to change.",
      });
      return;
    }

    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      res.status(401).json({ error: "Current password is incorrect." });
      return;
    }

    // Run policy checks after the current-password verification so an
    // unauthenticated probe can't use this endpoint as an oracle for which
    // strings appear in our common-password list or HIBP.
    const policy = await assertAcceptablePassword(newPassword, {
      email: user.email,
    });
    if (!policy.ok) {
      res.status(400).json({ error: policy.error });
      return;
    }

    const passwordHash = await hashPassword(newPassword);

    await db
      .update(usersTable)
      .set({
        passwordHash,
        // Any in-flight reset token is now stale — invalidate it so an
        // attacker holding the emailed link can't use it after the rotation.
        passwordResetToken: null,
        passwordResetTokenExpiresAt: null,
        updatedAt: new Date(),
      })
      .where(eq(usersTable.id, user.id));

    // Revoke every session except the caller's current one. getSessionId is
    // guaranteed to return a value here because requireAuth already proved
    // the request carries a valid session.
    const currentSid = getSessionId(req);
    if (currentSid) {
      await deleteOtherSessionsForUser(user.id, currentSid);
    }

    await recordSecurityEvent(user.id, "password_changed", req);

    res.json({
      message: "Password updated. Other devices have been signed out.",
    });
  },
);

// List every active session belonging to the signed-in user. The response is
// designed for the /account "active devices" UI: each row carries an opaque
// public id (a hash of the underlying session token, not the token itself —
// see publicSessionId), the timestamp the session was created, and the
// User-Agent / IP captured at creation time so members can recognise their
// own browsers vs. a suspicious one. The session that issued this request is
// flagged via isCurrent so the UI can mark it.
router.get(
  "/auth/sessions",
  requireAuth,
  async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const currentSid = getSessionId(req);
    const currentPublicId = currentSid ? publicSessionId(currentSid) : null;

    const rows = await listSessionsForUser(userId);

    // Sort newest first so the "Current session" tag tends to appear at
    // the top of the list (current session was just created, or refreshed
    // recently). Falls back to expire as a stable tiebreaker.
    const sessions = rows
      .map((row) => {
        const sess = row.sess as unknown as SessionData;
        const createdAtMs =
          typeof sess.createdAt === "number"
            ? sess.createdAt
            : // Pre-tracking sessions: estimate creation time from the row's
              // expiry minus the standard TTL. Off by however much the OIDC
              // refresh path has bumped expire, but always non-null so the
              // UI can render a date instead of "unknown".
              row.expire.getTime() - SESSION_TTL;
        const id = publicSessionId(row.sid);
        return {
          id,
          createdAt: new Date(createdAtMs).toISOString(),
          userAgent: sess.userAgent ?? null,
          ipAddress: sess.ipAddress ?? null,
          isCurrent: currentPublicId !== null && id === currentPublicId,
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    res.json({ sessions });
  },
);

// Revoke a single session by its opaque public id. The id passed in the URL
// is the hash returned by GET /auth/sessions, never the raw session token —
// scoping is enforced by recomputing the hash for every row owned by the
// caller and matching, so this endpoint cannot be used to delete sessions
// that don't belong to the requester. Revoking the caller's *own* current
// session also clears the cookie and signals signedOut: true so the client
// can redirect to /.
router.post(
  "/auth/sessions/:id/revoke",
  requireSameOrigin,
  requireAuth,
  async (req: Request, res: Response) => {
    const targetId = req.params.id;
    if (typeof targetId !== "string" || targetId.length === 0) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    const userId = req.user!.id;
    const currentSid = getSessionId(req);

    // Look up the caller's sessions and find the one whose hash matches
    // the requested id. We do the matching server-side so the raw sid never
    // leaves the database: even an attacker who guesses another user's
    // public id can't use it because we filter by user first.
    const rows = await listSessionsForUser(userId);
    const match = rows.find((row) => publicSessionId(row.sid) === targetId);

    if (!match) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    const isCurrent = currentSid !== undefined && match.sid === currentSid;

    await deleteSession(match.sid);

    if (isCurrent) {
      // Caller revoked their own session — clear the cookie so the next
      // request from this browser is unauthenticated, and tell the client
      // to redirect home.
      res.clearCookie(SESSION_COOKIE, { path: "/" });
    }

    res.json({ revoked: true, signedOut: isCurrent });
  },
);

router.post("/auth/password-login", passwordRateLimit, requireSameOrigin, requireJsonContentType, async (req: Request, res: Response) => {
  const parsed = LoginWithPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    });
    return;
  }

  const { email, password } = parsed.data;
  const normalizedEmail = email.trim().toLowerCase();

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.email, normalizedEmail))
    .limit(1);

  // Use a generic message for both "no user" and "wrong password" so we don't
  // disclose which emails have accounts.
  if (!user || !user.passwordHash) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  // Block logins for unverified accounts. Attackers who pre-registered a
  // victim's email cannot obtain an authenticated session until the real
  // owner verifies mailbox access via POST /auth/verify-email.
  if (user.emailVerified !== "true") {
    res.status(403).json({
      error: "Email address not verified. Check your inbox for the verification link.",
    });
    return;
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password." });
    return;
  }

  const sessionData: SessionData = {
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    },
    provider: "password",
    ...captureSessionContext(req),
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  // Run the unfamiliar-device check before recording so the row we are about
  // to insert doesn't itself match the "have we seen this combo?" lookup.
  await notifyIfNewSignInDevice(user.id, user.email, req);
  await recordSecurityEvent(user.id, "login_password", req);
  res.json(GetCurrentAuthUserResponse.parse({ user: sessionData.user }));
});

router.get(
  "/auth/security-events",
  requireAuth,
  async (req: Request, res: Response) => {
    const userId = req.user!.id;

    // Limit to ten so the panel stays scannable. Newest first so the most
    // recent activity is the first thing the member sees.
    const rows = await db
      .select({
        id: securityEventsTable.id,
        eventType: securityEventsTable.eventType,
        ipAddress: securityEventsTable.ipAddress,
        userAgent: securityEventsTable.userAgent,
        createdAt: securityEventsTable.createdAt,
      })
      .from(securityEventsTable)
      .where(eq(securityEventsTable.userId, userId))
      .orderBy(desc(securityEventsTable.createdAt))
      .limit(10);

    res.json(
      ListRecentSecurityEventsResponse.parse({
        events: rows.map((row) => ({
          id: row.id,
          eventType: row.eventType,
          ipAddress: row.ipAddress,
          // Resolved server-side so the raw IP never has to be reverse-looked
          // up in the browser. Best-effort: null when the IP is missing,
          // private, or not in the GeoIP dataset — the client renders an
          // "Unknown location" fallback in that case.
          location: resolveLocation(row.ipAddress),
          userAgent: row.userAgent,
          createdAt: row.createdAt.toISOString(),
        })),
      }),
    );
  },
);

router.get("/login", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const returnTo = getSafeReturnTo(req.query.returnTo);

  const state = oidc.randomState();
  const nonce = oidc.randomNonce();
  const codeVerifier = oidc.randomPKCECodeVerifier();
  const codeChallenge = await oidc.calculatePKCECodeChallenge(codeVerifier);

  const redirectTo = oidc.buildAuthorizationUrl(config, {
    redirect_uri: callbackUrl,
    scope: "openid email profile offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    prompt: "login consent",
    state,
    nonce,
  });

  setOidcCookie(res, "code_verifier", codeVerifier);
  setOidcCookie(res, "nonce", nonce);
  setOidcCookie(res, "state", state);
  setOidcCookie(res, "return_to", returnTo);

  res.redirect(redirectTo.href);
});

// Query params are not validated because the OIDC provider may include
// parameters not expressed in the schema.
router.get("/callback", async (req: Request, res: Response) => {
  const config = await getOidcConfig();
  const callbackUrl = `${getOrigin(req)}/api/callback`;

  const codeVerifier = req.cookies?.code_verifier;
  const nonce = req.cookies?.nonce;
  const expectedState = req.cookies?.state;

  if (!codeVerifier || !expectedState) {
    res.redirect("/api/login");
    return;
  }

  const currentUrl = new URL(
    `${callbackUrl}?${new URL(req.url, `http://${req.headers.host}`).searchParams}`,
  );

  let tokens: oidc.TokenEndpointResponse & oidc.TokenEndpointResponseHelpers;
  try {
    tokens = await oidc.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: codeVerifier,
      expectedNonce: nonce,
      expectedState,
      idTokenExpected: true,
    });
  } catch {
    res.redirect("/api/login");
    return;
  }

  const returnTo = getSafeReturnTo(req.cookies?.return_to);

  res.clearCookie("code_verifier", { path: "/" });
  res.clearCookie("nonce", { path: "/" });
  res.clearCookie("state", { path: "/" });
  res.clearCookie("return_to", { path: "/" });

  const claims = tokens.claims();
  if (!claims) {
    res.redirect("/api/login");
    return;
  }

  const dbUser = await upsertUser(
    claims as unknown as Record<string, unknown>,
  );

  const now = Math.floor(Date.now() / 1000);
  const sessionData: SessionData = {
    user: {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.firstName,
      lastName: dbUser.lastName,
      profileImageUrl: dbUser.profileImageUrl,
    },
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
    ...captureSessionContext(req),
  };

  const sid = await createSession(sessionData);
  setSessionCookie(res, sid);
  await notifyIfNewSignInDevice(dbUser.id, dbUser.email, req);
  await recordSecurityEvent(dbUser.id, "login_oidc", req);
  res.redirect(returnTo);
});

router.get("/logout", async (req: Request, res: Response) => {
  const origin = getOrigin(req);
  const sid = getSessionId(req);

  // Look at the session before we clear it so we know whether to bounce
  // through the OIDC end-session URL (Replit-authenticated users) or just
  // go home (password-authenticated users).
  const existing = sid ? await getSession(sid) : null;
  await clearSession(res, sid);

  if (existing && existing.provider !== "password" && existing.access_token) {
    const config = await getOidcConfig();
    const endSessionUrl = oidc.buildEndSessionUrl(config, {
      client_id: process.env.REPL_ID!,
      post_logout_redirect_uri: origin,
    });
    res.redirect(endSessionUrl.href);
    return;
  }

  res.redirect("/");
});

router.post(
  "/mobile-auth/token-exchange",
  async (req: Request, res: Response) => {
    const parsed = ExchangeMobileAuthorizationCodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required parameters" });
      return;
    }

    const { code, code_verifier, redirect_uri, state, nonce } = parsed.data;

    try {
      const config = await getOidcConfig();

      const callbackUrl = new URL(redirect_uri);
      callbackUrl.searchParams.set("code", code);
      callbackUrl.searchParams.set("state", state);
      callbackUrl.searchParams.set("iss", ISSUER_URL);

      const tokens = await oidc.authorizationCodeGrant(config, callbackUrl, {
        pkceCodeVerifier: code_verifier,
        expectedNonce: nonce ?? undefined,
        expectedState: state,
        idTokenExpected: true,
      });

      const claims = tokens.claims();
      if (!claims) {
        res.status(401).json({ error: "No claims in ID token" });
        return;
      }

      const dbUser = await upsertUser(
        claims as unknown as Record<string, unknown>,
      );

      const now = Math.floor(Date.now() / 1000);
      const sessionData: SessionData = {
        user: {
          id: dbUser.id,
          email: dbUser.email,
          firstName: dbUser.firstName,
          lastName: dbUser.lastName,
          profileImageUrl: dbUser.profileImageUrl,
        },
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: tokens.expiresIn() ? now + tokens.expiresIn()! : claims.exp,
        ...captureSessionContext(req),
      };

      const sid = await createSession(sessionData);
      await notifyIfNewSignInDevice(dbUser.id, dbUser.email, req);
      await recordSecurityEvent(dbUser.id, "login_oidc", req);
      res.json(ExchangeMobileAuthorizationCodeResponse.parse({ token: sid }));
    } catch (err) {
      req.log.error({ err }, "Mobile token exchange error");
      res.status(500).json({ error: "Token exchange failed" });
    }
  },
);

router.post("/mobile-auth/logout", async (req: Request, res: Response) => {
  const sid = getSessionId(req);
  if (sid) {
    await deleteSession(sid);
  }
  res.json(LogoutMobileSessionResponse.parse({ success: true }));
});

export default router;
