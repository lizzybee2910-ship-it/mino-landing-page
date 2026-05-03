import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import { homeHref } from "@/lib/links";
import { PasswordStrengthMeter } from "@/components/password-strength";

function getNextFromSearch(search: string): string {
  const params = new URLSearchParams(search);
  const next = params.get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/learn";
  return next;
}

export default function SignupPage() {
  const { register, isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();
  const search = useSearch();

  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  const next = getNextFromSearch(search);

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
      const result = await register({
        email,
        password,
        firstName: firstName.trim() || null,
      });
      if (result.requiresVerification) {
        setPending(true);
        setDevToken(result.devVerificationToken ?? null);
        setBusy(false);
      } else {
        window.location.href = next;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Account creation failed.");
      setBusy(false);
    }
  }

  return (
    <main
      data-testid="page-signup"
      className="min-h-screen bg-mino-cream pt-32 pb-24 px-6"
    >
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="mino-rule" />
          <span className="mino-eyebrow text-mino-sage-deep">Members</span>
        </div>
        <h1 className="font-serif text-4xl text-mino-forest mb-3">
          Create your account
        </h1>
        <p className="font-serif text-lg text-mino-forest/85 mb-10">
          Free access to every (mino) course — clinical references, protocols,
          and revenue playbooks.
        </p>

        {pending ? (
          <div
            data-testid="signup-pending"
            className="flex flex-col gap-4"
          >
            <p className="font-serif text-base text-mino-forest/90">
              Account created for <strong>{email}</strong>. Verify your email
              to activate the account.
            </p>
            {devToken && (
              <div
                data-testid="dev-verification-token"
                className="border border-amber-400 bg-amber-50 p-4 text-xs text-amber-900 font-mono break-all"
              >
                <p className="font-semibold mb-2 not-italic">
                  Development verification token
                </p>
                <Link
                  href={`/verify-email?token=${encodeURIComponent(devToken)}&next=${encodeURIComponent(next)}`}
                  data-testid="link-verify-email"
                  className="text-amber-900 underline underline-offset-4 not-italic"
                >
                  Verify with this token →
                </Link>
                <p className="mt-3 select-all">{devToken}</p>
              </div>
            )}
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              data-testid="link-back-to-login"
              className="font-serif text-sm text-mino-forest underline underline-offset-4 mt-4"
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
            data-testid="form-signup-page"
          >
            <FieldLabel htmlFor="signup-name">First name (optional)</FieldLabel>
            <input
              id="signup-name"
              type="text"
              autoComplete="given-name"
              data-testid="input-signup-page-firstname"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className={inputClass}
            />

            <FieldLabel htmlFor="signup-email">Email</FieldLabel>
            <input
              id="signup-email"
              type="email"
              required
              autoComplete="email"
              data-testid="input-signup-page-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />

            <FieldLabel htmlFor="signup-password">
              Password (min 8 characters, not a common or breached password)
            </FieldLabel>
            <input
              id="signup-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              data-testid="input-signup-page-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              aria-describedby="signup-password-strength"
            />
            <PasswordStrengthMeter
              id="signup-password-strength"
              password={password}
              email={email}
            />

            {error && (
              <p
                data-testid="error-signup-page"
                className="font-serif text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              data-testid="button-signup-submit"
              className={`${primaryButtonClass} mt-2`}
            >
              {busy ? "Creating account…" : "Create account"}
            </button>
          </form>
        )}

        <p className="mt-8 font-serif text-sm text-mino-forest/85">
          Already a member?{" "}
          <Link
            href={`/login?next=${encodeURIComponent(next)}`}
            data-testid="link-to-login"
            className="text-mino-forest underline underline-offset-4"
          >
            Sign in
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
