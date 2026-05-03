import { useTheme } from "@/hooks/use-theme";

type Tone = "cream" | "forest";

const TONES: Record<
  Tone,
  { active: string; idle: string; sep: string }
> = {
  cream: {
    active: "text-mino-cream",
    idle: "text-mino-cream/40 hover:text-mino-cream/70",
    sep: "text-mino-cream/30",
  },
  forest: {
    active: "text-mino-forest",
    idle: "text-mino-forest/40 hover:text-mino-forest/85",
    sep: "text-mino-forest/30",
  },
};

export function ThemeToggle({
  tone = "cream",
  className = "",
}: {
  tone?: Tone;
  className?: string;
}) {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const t = TONES[tone];

  return (
    <div
      role="group"
      aria-label="Color theme"
      data-testid="theme-toggle"
      className={`mino-eyebrow inline-flex items-center gap-2 select-none ${className}`}
    >
      <button
        type="button"
        data-testid="theme-toggle-day"
        aria-pressed={!isDark}
        aria-label="Use day (light) theme"
        onClick={() => setTheme("light")}
        className={`transition-colors ${isDark ? t.idle : t.active}`}
      >
        Day
      </button>
      <span className={t.sep} aria-hidden="true">
        ·
      </span>
      <button
        type="button"
        data-testid="theme-toggle-night"
        aria-pressed={isDark}
        aria-label="Use night (dark) theme"
        onClick={() => setTheme("dark")}
        className={`transition-colors ${isDark ? t.active : t.idle}`}
      >
        Night
      </button>
    </div>
  );
}
