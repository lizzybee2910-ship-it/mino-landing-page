import geoip from "geoip-lite";

import { logger } from "./logger";

// Country code → human-readable country name. We keep this list short and
// only cover the countries we expect to see most often in production. Codes
// not in the table fall through to the raw ISO-3166 alpha-2 (e.g. "DE"),
// which is still recognisable enough at a glance to flag a sign-in from an
// unfamiliar location.
const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  CA: "Canada",
  GB: "United Kingdom",
  IE: "Ireland",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  NL: "Netherlands",
  BE: "Belgium",
  CH: "Switzerland",
  AT: "Austria",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  PT: "Portugal",
  PL: "Poland",
  CZ: "Czechia",
  GR: "Greece",
  TR: "Türkiye",
  IL: "Israel",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
  EG: "Egypt",
  ZA: "South Africa",
  NG: "Nigeria",
  KE: "Kenya",
  IN: "India",
  PK: "Pakistan",
  BD: "Bangladesh",
  CN: "China",
  HK: "Hong Kong",
  TW: "Taiwan",
  JP: "Japan",
  KR: "South Korea",
  SG: "Singapore",
  MY: "Malaysia",
  TH: "Thailand",
  VN: "Vietnam",
  PH: "Philippines",
  ID: "Indonesia",
  AU: "Australia",
  NZ: "New Zealand",
  MX: "Mexico",
  BR: "Brazil",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  PE: "Peru",
  RU: "Russia",
  UA: "Ukraine",
};

function expandCountry(code: string): string {
  return COUNTRY_NAMES[code.toUpperCase()] ?? code.toUpperCase();
}

// Strip a leading IPv4-mapped IPv6 prefix (`::ffff:`) so geoip-lite, which
// dispatches on string format, hits the IPv4 lookup path.
function normalizeIp(ip: string): string {
  if (ip.startsWith("::ffff:")) return ip.slice("::ffff:".length);
  return ip;
}

// Resolve an IP address to a coarse "City, Country" string for display in
// the security-activity feed. Returns null for missing/private/unresolvable
// IPs so callers can render their own "Unknown location" fallback consistently
// across event types. We never throw — losing geolocation must not block the
// rest of the response.
export function resolveLocation(rawIp: string | null | undefined): string | null {
  if (!rawIp || typeof rawIp !== "string") return null;

  const ip = normalizeIp(rawIp.trim());
  if (!ip) return null;

  try {
    const lookup = geoip.lookup(ip);
    if (!lookup) return null;

    const city = lookup.city?.trim();
    const country = lookup.country?.trim();

    if (city && country) return `${city}, ${expandCountry(country)}`;
    if (country) return expandCountry(country);
    return null;
  } catch (err) {
    // Data file missing/corrupt or any other unexpected failure: log once
    // and treat as "unknown" rather than 500-ing the security-events list.
    logger.error({ err, ip }, "geoip lookup failed");
    return null;
  }
}
