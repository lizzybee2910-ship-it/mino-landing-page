import { describe, expect, test } from "vitest";

import { resolveLocation } from "./geoip";

describe("resolveLocation", () => {
  test("returns null for missing inputs", () => {
    expect(resolveLocation(null)).toBeNull();
    expect(resolveLocation(undefined)).toBeNull();
    expect(resolveLocation("")).toBeNull();
    expect(resolveLocation("   ")).toBeNull();
  });

  test("returns null for private / loopback IPs", () => {
    // geoip-lite knows these ranges are reserved and does not resolve them.
    expect(resolveLocation("127.0.0.1")).toBeNull();
    expect(resolveLocation("10.0.0.1")).toBeNull();
    expect(resolveLocation("192.168.1.1")).toBeNull();
    expect(resolveLocation("172.16.0.1")).toBeNull();
  });

  test("returns null for obviously malformed input", () => {
    expect(resolveLocation("not-an-ip")).toBeNull();
  });

  test("returns null for the IPv4-mapped form of a loopback address", () => {
    // Express on Node sometimes hands us `::ffff:127.0.0.1` for IPv4 callers
    // when the socket binds dual-stack — we strip the prefix before lookup
    // so the loopback case still returns null instead of an unrelated city.
    expect(resolveLocation("::ffff:127.0.0.1")).toBeNull();
  });

  test("returns a non-empty location string for a well-known public IP", () => {
    // 8.8.8.8 (Google Public DNS) is consistently mapped to the United
    // States in every published GeoLite snapshot, so this is a stable
    // smoke test that the embedded data file is being read.
    const location = resolveLocation("8.8.8.8");
    expect(location).not.toBeNull();
    expect(location).toMatch(/United States|US/);
  });
});
