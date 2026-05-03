import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { homeHref } from "@/lib/links";

function getNextFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  const next = params.get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/learn";
  return next;
}

export default function LoginPage() {
  const { loginWithPassword, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const next = getNextFromSearch(search);

  // If the user is already authenticated when they land here, bounce to the
  // intended destination. Avoids the awkward "logged in but staring at a
  // login form" state when the route guard redirects pre-emptively.
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      navigate(next, { replace: true });
    }
  }, [isLoading, isAuthenticated, next, navigate]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await loginWithPassword({ email, password });
      // Hard reload onto the next page so every useAuth() consumer (nav, etc.)
      // re-fetches its session immediately.
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setBusy(false);
    }
  }

  return (
    <main
      data-testid="page-login"
      className="min-h-screen bg-mino-cream pt-32 pb-24 px-6"
    >
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="mino-rule" />
          <span className="mino-eyebrow text-mino-sage-deep">Members</span>
        </div>
        <h1 className="font-serif text-4xl text-mino-forest mb-3">Sign in</h1>
        <p className="font-serif text-lg text-mino-forest/85 mb-10">
          Continue your protocol. Access the full (mino) education library.
        </p>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
          data-testid="form-login"
        >
          <FieldLabel htmlFor="login-email">Email</FieldLabel>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            data-testid="input-login-email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />

          <FieldLabel htmlFor="login-password">Password</FieldLabel>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            data-testid="input-login-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />

          {error && (
            <p
              data-testid="error-login"
              className="font-serif text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            data-testid="button-login-submit"
            className={`${primaryButtonClass} mt-2`}
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 font-serif text-sm text-mino-forest/85">
          <Link
            href="/forgot-password"
            data-testid="link-forgot-password"
            className="text-mino-forest underline underline-offset-4"
          >
            Forgot password?
          </Link>
        </p>

        <p className="mt-4 font-serif text-sm text-mino-forest/85">
          New to (mino)?{" "}
          <Link
            href={`/signup?next=${encodeURIComponent(next)}`}
            data-testid="link-to-signup"
            className="text-mino-forest underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
        <p className="mt-3 font-serif text-sm text-mino-forest/50">
          <Link href={homeHref()} className="hover:text-mino-forest/90">
            ← Back to (mino)
          </Link>
        </p>
      </div>
    </main>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mino-eyebrow text-mino-sage-deep -mb-3"
    >
      {children}
    </label>
  );
}

const inputClass =
  "w-full bg-mino-cream border border-mino-forest/20 focus:border-mino-forest/60 outline-none px-3 py-2.5 font-serif text-mino-forest placeholder:text-mino-forest/40 transition-colors";

const primaryButtonClass =
  "inline-flex w-full items-center justify-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-5 py-3";
