/**
 * Client-side mirror of the offline password rules in
 * `artifacts/api-server/src/lib/passwordPolicy.ts`. Used to give members
 * live "is this password acceptable yet?" feedback as they type.
 *
 * The HaveIBeenPwned breach check intentionally remains server-side only:
 * the plaintext password must never leave the user's machine for a
 * third-party API, so the UI advertises a final "we'll check this against
 * known data breaches when you submit" step instead of running it here.
 *
 * Keep this list and the rule set in sync with the server file — if you
 * tighten one side, tighten the other.
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

function characterBuckets(password: string): number {
  let buckets = 0;
  if (/[a-z]/.test(password)) buckets += 1;
  if (/[A-Z]/.test(password)) buckets += 1;
  if (/\d/.test(password)) buckets += 1;
  if (/[^a-zA-Z0-9]/.test(password)) buckets += 1;
  return buckets;
}

function isMostlyNumeric(password: string): boolean {
  if (!password) return false;
  const digitMatches = password.match(/\d/g);
  const digitCount = digitMatches ? digitMatches.length : 0;
  return digitCount / password.length >= 0.7;
}

function emailLocalPart(email: string | null | undefined): string | null {
  if (!email) return null;
  const at = email.indexOf("@");
  if (at <= 0) return null;
  return email.slice(0, at).toLowerCase();
}

export type RuleId =
  | "length"
  | "variety"
  | "notMostlyNumeric"
  | "notSingleChar"
  | "notCommon"
  | "notEmail";

export interface RuleResult {
  id: RuleId;
  label: string;
  passed: boolean;
}

export type StrengthTier = "empty" | "weak" | "fair" | "good" | "strong";

export interface PasswordStrength {
  /** All offline rules, in display order. */
  rules: RuleResult[];
  /** True when every offline rule passes (server still runs the breach check). */
  allPassed: boolean;
  /** Coarse bucket suitable for a 4-segment meter. */
  tier: StrengthTier;
  /** Short copy describing the tier, e.g. "Strong". */
  tierLabel: string;
}

/**
 * Pure, synchronous evaluation of the same offline rules the API enforces.
 * `email` is optional — when present, the local-part check fires.
 */
export function evaluatePasswordStrength(
  password: string,
  email?: string | null,
): PasswordStrength {
  if (!password) {
    return {
      rules: defaultRules(email),
      allPassed: false,
      tier: "empty",
      tierLabel: "Enter a password",
    };
  }

  const lowered = password.toLowerCase();
  const local = emailLocalPart(email);

  const rules: RuleResult[] = [
    {
      id: "length",
      label: "At least 8 characters",
      passed: password.length >= 8,
    },
    {
      id: "variety",
      label:
        "Mix of at least two of: lowercase, uppercase, numbers, or symbols",
      passed: characterBuckets(password) >= 2,
    },
    {
      id: "notMostlyNumeric",
      label: "Not made up mostly of numbers",
      passed: !isMostlyNumeric(password),
    },
    {
      id: "notSingleChar",
      label: "More than one distinct character",
      passed: new Set(password).size > 1,
    },
    {
      id: "notCommon",
      label: "Not one of the most common passwords",
      passed: !COMMON_PASSWORDS.has(lowered),
    },
    {
      id: "notEmail",
      label: "Doesn't contain your email address",
      passed:
        !local ||
        local.length < 3 ||
        (lowered !== local && !lowered.includes(local)),
    },
  ];

  const allPassed = rules.every((r) => r.passed);
  const passedCount = rules.filter((r) => r.passed).length;
  const lengthRule = rules.find((r) => r.id === "length");

  let tier: StrengthTier;
  let tierLabel: string;
  if (!allPassed) {
    // A password that doesn't even meet the length floor is always "weak",
    // regardless of how many other (mostly trivial) rules it happens to
    // satisfy — otherwise "abc" would be labelled "almost there".
    if (!lengthRule?.passed || passedCount <= 2) {
      tier = "weak";
      tierLabel = "Weak";
    } else {
      tier = "fair";
      tierLabel = "Almost there";
    }
  } else if (password.length >= 14) {
    tier = "strong";
    tierLabel = "Strong";
  } else {
    tier = "good";
    tierLabel = "Good";
  }

  return { rules, allPassed, tier, tierLabel };
}

function defaultRules(email?: string | null): RuleResult[] {
  return [
    { id: "length", label: "At least 8 characters", passed: false },
    {
      id: "variety",
      label:
        "Mix of at least two of: lowercase, uppercase, numbers, or symbols",
      passed: false,
    },
    {
      id: "notMostlyNumeric",
      label: "Not made up mostly of numbers",
      passed: false,
    },
    {
      id: "notSingleChar",
      label: "More than one distinct character",
      passed: false,
    },
    {
      id: "notCommon",
      label: "Not one of the most common passwords",
      passed: false,
    },
    {
      id: "notEmail",
      label: email
        ? "Doesn't contain your email address"
        : "Doesn't contain your email address",
      passed: false,
    },
  ];
}
