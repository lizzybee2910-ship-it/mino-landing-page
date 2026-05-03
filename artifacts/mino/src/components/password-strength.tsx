import { useMemo } from "react";
import {
  evaluatePasswordStrength,
  type PasswordStrength,
  type StrengthTier,
} from "@/lib/password-strength";

interface PasswordStrengthMeterProps {
  password: string;
  email?: string | null;
  /**
   * Stable id used to associate the meter with the password input via
   * aria-describedby. Each form on a page should pass a unique value.
   */
  id: string;
}

const TIER_SEGMENTS: Record<StrengthTier, number> = {
  empty: 0,
  weak: 1,
  fair: 2,
  good: 3,
  strong: 4,
};

const TIER_BAR_CLASS: Record<StrengthTier, string> = {
  empty: "bg-mino-forest/15",
  weak: "bg-red-600",
  fair: "bg-amber-500",
  good: "bg-mino-sage-deep",
  strong: "bg-mino-forest",
};

const TIER_TEXT_CLASS: Record<StrengthTier, string> = {
  empty: "text-mino-forest/50",
  weak: "text-red-700",
  fair: "text-amber-700",
  good: "text-mino-sage-deep",
  strong: "text-mino-forest",
};

export function PasswordStrengthMeter({
  password,
  email,
  id,
}: PasswordStrengthMeterProps) {
  const strength: PasswordStrength = useMemo(
    () => evaluatePasswordStrength(password, email ?? null),
    [password, email],
  );

  const filledSegments = TIER_SEGMENTS[strength.tier];

  return (
    <div
      id={id}
      data-testid={`${id}-root`}
      data-tier={strength.tier}
      data-all-passed={strength.allPassed ? "true" : "false"}
      className="-mt-1 flex flex-col gap-3"
    >
      <div className="flex items-center gap-3">
        <div
          className="flex flex-1 gap-1"
          aria-hidden="true"
          data-testid={`${id}-bar`}
        >
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 transition-colors ${
                i < filledSegments
                  ? TIER_BAR_CLASS[strength.tier]
                  : "bg-mino-forest/10"
              }`}
            />
          ))}
        </div>
        <span
          data-testid={`${id}-tier`}
          className={`mino-eyebrow text-xs ${TIER_TEXT_CLASS[strength.tier]}`}
          role="status"
          aria-live="polite"
        >
          {strength.tierLabel}
        </span>
      </div>

      <ul
        className="flex flex-col gap-1.5"
        data-testid={`${id}-rules`}
      >
        {strength.rules.map((rule) => (
          <li
            key={rule.id}
            data-testid={`${id}-rule-${rule.id}`}
            data-passed={rule.passed ? "true" : "false"}
            className={`flex items-start gap-2 font-serif text-sm ${
              rule.passed ? "text-mino-forest/85" : "text-mino-forest/55"
            }`}
          >
            <span
              aria-hidden="true"
              className={`mt-[0.45rem] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full ${
                rule.passed
                  ? "bg-mino-sage-deep"
                  : "border border-mino-forest/30 bg-transparent"
              }`}
            />
            <span>
              <span className="sr-only">
                {rule.passed ? "Met: " : "Not yet met: "}
              </span>
              {rule.label}
            </span>
          </li>
        ))}
      </ul>

      <p
        data-testid={`${id}-breach-note`}
        className="font-serif text-xs italic text-mino-forest/50"
      >
        We also check your password against known data breaches when you
        submit.
      </p>
    </div>
  );
}
