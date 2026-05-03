import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import crypto from "node:crypto";

vi.mock("./logger", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  validatePasswordPolicy,
  checkPasswordBreached,
  assertAcceptablePassword,
} from "./passwordPolicy";

const NO_EMAIL = { email: null };

describe("validatePasswordPolicy", () => {
  test("rejects passwords shorter than 8 characters", () => {
    const result = validatePasswordPolicy("Ab1!", NO_EMAIL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/at least 8/i);
    }
  });

  test.each([
    "password",
    "Password1",
    "PASSWORD",
    "Password!",
    "letmein123",
    "qwerty123",
    "iloveyou",
    "welcome2026",
  ])("rejects common password %j", (pw) => {
    const result = validatePasswordPolicy(pw, NO_EMAIL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/commonly used/i);
    }
  });

  test("rejects passwords made of a single repeated character", () => {
    const result = validatePasswordPolicy("aaaaaaaa", NO_EMAIL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/single repeated character/i);
    }
  });

  test("rejects passwords that are mostly numeric", () => {
    // 9 of 10 chars are digits → 90% numeric, well over 70% threshold.
    const result = validatePasswordPolicy("123456789a", NO_EMAIL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/mostly of numbers/i);
    }
  });

  test("rejects passwords that lack character diversity", () => {
    // All-lowercase, not common, not single-char, not mostly-numeric → only
    // diversity rule should fire.
    const result = validatePasswordPolicy("abcdefghij", NO_EMAIL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/mix of at least two/i);
    }
  });

  test("rejects passwords containing the email local-part", () => {
    const result = validatePasswordPolicy("AlphaBeta123", {
      email: "alphabeta@example.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/email address/i);
    }
  });

  test("rejects passwords containing the email local-part case-insensitively", () => {
    const result = validatePasswordPolicy("ZooKeeper99", {
      email: "ZOOKEEPER@example.com",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/email address/i);
    }
  });

  test("ignores email checks when local-part is shorter than 3 characters", () => {
    // local-part "ab" is only 2 chars, so the rule should not fire even
    // though the password technically contains it.
    const result = validatePasswordPolicy("absolutely1Q", {
      email: "ab@example.com",
    });
    expect(result.ok).toBe(true);
  });

  test("accepts a strong, mixed-case, alphanumeric password with no email", () => {
    const result = validatePasswordPolicy("CorrectHorseBattery42", NO_EMAIL);
    expect(result.ok).toBe(true);
  });

  test("accepts a strong password when email local-part is unrelated", () => {
    const result = validatePasswordPolicy("CorrectHorseBattery42", {
      email: "someone@example.com",
    });
    expect(result.ok).toBe(true);
  });
});

describe("checkPasswordBreached", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function buildHibpResponse(
    password: string,
    count: number,
    {
      includeNoise = true,
    }: { includeNoise?: boolean } = {},
  ): string {
    const sha1 = crypto
      .createHash("sha1")
      .update(password, "utf8")
      .digest("hex")
      .toUpperCase();
    const suffix = sha1.slice(5);
    const lines: string[] = [];
    if (includeNoise) {
      // A few decoy rows so we know the matcher actually compares suffixes.
      lines.push("0000000000000000000000000000000000A:7");
      lines.push("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:42");
    }
    if (count > 0) {
      lines.push(`${suffix}:${count}`);
    } else {
      // Padded entries the API injects when "Add-Padding" is set carry count=0.
      lines.push(`${suffix}:0`);
    }
    return lines.join("\r\n") + "\n";
  }

  test("flags a password whose SHA1 suffix appears with a non-zero count", async () => {
    const password = "ThisIsADefinitelyBreachedPassword!";
    const body = buildHibpResponse(password, 5);
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(body, { status: 200 }),
    );

    const result = await checkPasswordBreached(password);
    expect(result).toEqual({ breached: true, checked: true });

    // Verify we only ever sent the first 5 hex characters of the digest.
    const fetchCalls = (
      globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    ).mock.calls;
    expect(fetchCalls).toHaveLength(1);
    const [url] = fetchCalls[0]!;
    const sha1Prefix = crypto
      .createHash("sha1")
      .update(password, "utf8")
      .digest("hex")
      .toUpperCase()
      .slice(0, 5);
    expect(String(url)).toBe(
      `https://api.pwnedpasswords.com/range/${sha1Prefix}`,
    );
  });

  test("returns not-breached when the suffix is absent from the response", async () => {
    const otherSuffix = "0123456789ABCDEF0123456789ABCDEF012";
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(`${otherSuffix}:9\n`, { status: 200 }),
    );

    const result = await checkPasswordBreached(
      "AnotherStrongPassphrase!42",
    );
    expect(result).toEqual({ breached: false, checked: true });
  });

  test("treats padded count=0 entries as not breached", async () => {
    const password = "PaddedSuffixTest123!";
    const body = buildHibpResponse(password, 0);
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(body, { status: 200 }),
    );

    const result = await checkPasswordBreached(password);
    expect(result).toEqual({ breached: false, checked: true });
  });

  test("fails open (checked=false) when the upstream returns a non-2xx", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("oops", { status: 503 }),
    );

    const result = await checkPasswordBreached("YetAnotherStrong!Pass99");
    expect(result).toEqual({ breached: false, checked: false });
  });

  test("fails open (checked=false) on network errors", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new TypeError("network down"),
    );

    const result = await checkPasswordBreached("StrongTopazPlanet42!");
    expect(result).toEqual({ breached: false, checked: false });
  });
});

describe("assertAcceptablePassword", () => {
  beforeEach(() => {
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("short-circuits on offline policy failures without hitting HIBP", async () => {
    const result = await assertAcceptablePassword("password", NO_EMAIL);
    expect(result.ok).toBe(false);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  test("rejects passwords flagged by HIBP even if offline policy passes", async () => {
    const password = "OfflinePoliciesPass99!";
    const sha1 = crypto
      .createHash("sha1")
      .update(password, "utf8")
      .digest("hex")
      .toUpperCase();
    const body = `${sha1.slice(5)}:1234\n`;
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response(body, { status: 200 }),
    );

    const result = await assertAcceptablePassword(password, NO_EMAIL);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/known data breach/i);
    }
  });

  test("accepts passwords that pass both offline policy and HIBP", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      new Response("0123456789ABCDEF0123456789ABCDEF012:9\n", { status: 200 }),
    );

    const result = await assertAcceptablePassword(
      "OfflinePoliciesPass99!",
      NO_EMAIL,
    );
    expect(result.ok).toBe(true);
  });

  test("fail-open: an HIBP outage does not block a strong password", async () => {
    (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("ENOTFOUND"),
    );

    const result = await assertAcceptablePassword(
      "OfflinePoliciesPass99!",
      NO_EMAIL,
    );
    expect(result.ok).toBe(true);
  });
});
