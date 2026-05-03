import crypto from "crypto";
import { logger } from "./logger";

/**
 * A small embedded list of the most commonly used passwords (and obvious
 * variants). Sourced from the top entries of public breached-password
 * compilations (e.g., SecLists "10-million-password-list-top-N"). The list is
 * intentionally short — the HaveIBeenPwned k-anonymity check (see
 * `checkPasswordBreached`) is the deeper signal. This local list exists so we
 * always reject the obvious offenders even when the HIBP API is unreachable.
 *
 * Stored lowercased and compared case-insensitively.
 */
const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
  [
    "password",
    "password1",
    "password!",
    "password123",
    "passw0rd",
    "p@ssw0rd",
    "p@ssword",
    "passwords",
    "12345678",
    "123456789",
    "1234567890",
    "qwerty123",
    "qwertyuiop",
    "qwerty1234",
    "1q2w3e4r",
    "1q2w3e4r5t",
    "1qaz2wsx",
    "1qazxsw2",
    "zaq12wsx",
    "abc12345",
    "abcd1234",
    "abcdef123",
    "asdf1234",
    "asdfasdf",
    "asdfghjkl",
    "iloveyou",
    "iloveyou1",
    "iloveyou2",
    "iloveyou123",
    "letmein",
    "letmein1",
    "letmein123",
    "welcome",
    "welcome1",
    "welcome123",
    "welcome2024",
    "welcome2025",
    "welcome2026",
    "monkey",
    "monkey1",
    "monkey123",
    "dragon",
    "dragon1",
    "dragon123",
    "master",
    "master1",
    "master123",
    "sunshine",
    "sunshine1",
    "princess",
    "princess1",
    "football",
    "football1",
    "baseball",
    "baseball1",
    "basketball",
    "shadow",
    "shadow1",
    "michael1",
    "jennifer",
    "superman",
    "batman",
    "trustno1",
    "starwars",
    "computer",
    "internet",
    "secret",
    "secret1",
    "secret123",
    "freedom",
    "whatever",
    "whatever1",
    "ninja",
    "azerty",
    "azerty123",
    "qazwsx",
    "qazwsxedc",
    "zxcvbnm",
    "zxcvbn",
    "admin",
    "admin1",
    "admin123",
    "admin1234",
    "administrator",
    "root",
    "root123",
    "rootroot",
    "toor",
    "test1234",
    "test12345",
    "test123",
    "testtest",
    "default",
    "changeme",
    "changeme1",
    "changeme123",
    "newpassword",
    "newpassword1",
    "newpassword123",
    "temp1234",
    "temppassword",
    "demo1234",
    "guest1234",
    "guestguest",
    "minecraft",
    "thomas1",
    "jordan1",
    "harley1",
    "robert1",
    "matthew1",
    "andrew1",
    "joshua1",
    "anthony1",
    "william1",
    "daniel1",
    "summer1",
    "winter1",
    "spring1",
    "autumn1",
    "soccer1",
    "hockey1",
    "tigger1",
    "purple1",
    "yellow1",
    "orange1",
    "buster1",
    "snoopy1",
    "garfield",
    "pokemon",
    "pikachu",
    "charlie1",
    "smokey1",
    "cookie1",
    "scooby1",
    "rocky1",
    "babygirl",
    "babyboy",
    "killer1",
    "thunder",
    "ranger",
    "hunter1",
    "samsung",
    "iphone",
    "android",
    "google",
    "google1",
    "facebook",
    "instagram",
    "twitter1",
    "youtube",
    "linkedin",
    "passport",
    "lifehack",
    "lifehacks",
    "mino",
    "mino123",
    "mino1234",
    "minominomino",
  ].map((p) => p.toLowerCase()),
);

/**
 * Number of distinct alphabet "buckets" the password mixes. Used as a
 * lightweight diversity signal alongside the common-passwords list and the
 * HIBP check. Doesn't cap entropy — it's a sanity floor.
 */
function characterBuckets(password: string): number {
  let buckets = 0;
  if (/[a-z]/.test(password)) buckets += 1;
  if (/[A-Z]/.test(password)) buckets += 1;
  if (/\d/.test(password)) buckets += 1;
  // Anything that isn't a letter or digit counts as a "symbol" bucket.
  if (/[^a-zA-Z0-9]/.test(password)) buckets += 1;
  return buckets;
}

function isMostlyNumeric(password: string): boolean {
  const digitMatches = password.match(/\d/g);
  const digitCount = digitMatches ? digitMatches.length : 0;
  return digitCount / password.length >= 0.7;
}

/**
 * Extracts the local-part (text before the `@`) from an email address. Returns
 * null if no `@` is present. Comparisons against the password are
 * case-insensitive.
 */
function emailLocalPart(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return null;
  return email.slice(0, at).toLowerCase();
}

export interface PasswordPolicyContext {
  /**
   * The user's email, when known. The local-part is compared against the
   * password to block the "use your username as your password" footgun. May be
   * null for accounts that don't have an email on file.
   */
  email: string | null | undefined;
}

export type PasswordPolicyResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Synchronous, offline checks. Always run before the HIBP round-trip so an
 * obviously-weak password fails fast without leaving the server.
 */
export function validatePasswordPolicy(
  password: string,
  ctx: PasswordPolicyContext,
): PasswordPolicyResult {
  // Length is already enforced by the API zod schemas (min 8) but re-check
  // here so the helper is safe to call from anywhere without depending on a
  // particular caller having validated first.
  if (password.length < 8) {
    return {
      ok: false,
      error: "Password must be at least 8 characters.",
    };
  }

  const lowered = password.toLowerCase();

  if (COMMON_PASSWORDS.has(lowered)) {
    return {
      ok: false,
      error:
        "This password is one of the most commonly used passwords on the internet. Choose something less guessable.",
    };
  }

  // A single repeated character (e.g. "aaaaaaaa", "11111111") trivially meets
  // the 8-character floor but offers no security. Treat anything with only
  // one distinct character as obviously weak.
  if (new Set(password).size === 1) {
    return {
      ok: false,
      error:
        "Passwords made of a single repeated character are too easy to guess. Mix in some other characters.",
    };
  }

  if (isMostlyNumeric(password)) {
    return {
      ok: false,
      error:
        "Passwords made up mostly of numbers are too easy to guess. Add some letters or symbols.",
    };
  }

  if (characterBuckets(password) < 2) {
    return {
      ok: false,
      error:
        "Use a mix of at least two of: lowercase letters, uppercase letters, numbers, or symbols.",
    };
  }

  const local = emailLocalPart(ctx.email ?? null);
  if (local && local.length >= 3) {
    if (lowered === local || lowered.includes(local)) {
      return {
        ok: false,
        error:
          "Don't use your email address (or part of it) as your password.",
      };
    }
  }

  return { ok: true };
}

/**
 * How long we wait for the HaveIBeenPwned range API before giving up and
 * letting the password through. Kept short so a flaky upstream can't stall the
 * registration / reset / change flows.
 */
const HIBP_TIMEOUT_MS = 1500;

/**
 * Queries the HaveIBeenPwned "Pwned Passwords" range API using the k-anonymity
 * model: we send only the first 5 hex chars of the password's SHA-1 digest and
 * look for the remaining suffix in the response body. The plaintext password
 * never leaves this process.
 *
 * Fails open (returns false) on any network/parse error so an HIBP outage
 * doesn't break account flows. The caller is expected to log the outcome.
 */
export async function checkPasswordBreached(
  password: string,
): Promise<{ breached: boolean; checked: boolean }> {
  const sha1 = crypto
    .createHash("sha1")
    .update(password, "utf8")
    .digest("hex")
    .toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);

  try {
    const res = await fetch(
      `https://api.pwnedpasswords.com/range/${prefix}`,
      {
        method: "GET",
        headers: {
          "Add-Padding": "true",
          "User-Agent": "mino-password-policy",
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timeout);

    if (!res.ok) {
      return { breached: false, checked: false };
    }

    const body = await res.text();
    // Each line is "<35-char-suffix>:<count>". Find a line whose suffix matches
    // ours. Suffix matches are case-insensitive per the HIBP spec.
    const lines = body.split(/\r?\n/);
    for (const line of lines) {
      const colon = line.indexOf(":");
      if (colon === -1) continue;
      const lineSuffix = line.slice(0, colon).trim().toUpperCase();
      if (lineSuffix === suffix) {
        const countStr = line.slice(colon + 1).trim();
        const count = Number.parseInt(countStr, 10);
        // The padding header injects synthetic entries with count=0; treat
        // those as not-breached even though the suffix happens to match.
        if (Number.isFinite(count) && count > 0) {
          return { breached: true, checked: true };
        }
      }
    }
    return { breached: false, checked: true };
  } catch {
    clearTimeout(timeout);
    return { breached: false, checked: false };
  }
}

/**
 * One-stop check used by the auth routes. Runs the cheap offline policy
 * checks first; only if those pass does it consult HIBP. The HIBP step is
 * best-effort — a network failure won't block account creation, but a
 * confirmed breach hit will.
 */
export async function assertAcceptablePassword(
  password: string,
  ctx: PasswordPolicyContext,
): Promise<PasswordPolicyResult> {
  const offline = validatePasswordPolicy(password, ctx);
  if (!offline.ok) return offline;

  const hibp = await checkPasswordBreached(password);
  if (hibp.breached) {
    return {
      ok: false,
      error:
        "This password has appeared in a known data breach. Choose a different one.",
    };
  }
  if (!hibp.checked) {
    // Don't block the user, but leave a breadcrumb so we can spot extended
    // HIBP outages in production logs.
    logger.warn(
      "HaveIBeenPwned breach check skipped (network/timeout); allowing password.",
    );
  }
  return { ok: true };
}
