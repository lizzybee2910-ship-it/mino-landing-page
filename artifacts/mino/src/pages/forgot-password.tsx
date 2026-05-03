import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import { homeHref } from "@/lib/links";

interface RequestResponse {
  message: string;
  devResetToken?: string;
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/request-password-reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      let payload: RequestResponse | null = null;
      try {
        payload = (await res.json()) as RequestResponse;
      } catch {
        // ignore parse error
      }
      if (!res.ok) {
        const msg =
          payload && typeof payload === "object" && "error" in payload
            ? String((payload as unknown as { error: unknown }).error)
            : "Could not send reset email.";
        throw new Error(msg);
      }
      setDevToken(payload?.devResetToken ?? null);
      setSubmitted(true);
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email.");
      setBusy(false);
    }
  }

  return (
    <main
      data-testid="page-forgot-password"
      className="min-h-screen bg-mino-cream pt-32 pb-24 px-6"
    >
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="mino-rule" />
          <span className="mino-eyebrow text-mino-sage-deep">Members</span>
        </div>
        <h1 className="font-serif text-4xl text-mino-forest mb-3">
          Reset your password
        </h1>
        <p className="font-serif text-lg text-mino-forest/85 mb-10">
          Enter the email address on your (mino) account. We will send a
          one-time link to choose a new password.
        </p>

        {submitted ? (
          <div data-testid="forgot-pending" className="flex flex-col gap-4">
            <p className="font-serif text-base text-mino-forest/90">
              If an account exists for <strong>{email}</strong>, a password
              reset email is on its way. Check your inbox — the link expires in
              1 hour.
            </p>
            {devToken && (
              <div
                data-testid="dev-reset-token"
                className="border border-amber-400 bg-amber-50 p-4 text-xs text-amber-900 font-mono break-all"
              >
                <p className="font-semibold mb-2 not-italic">
                  Development reset token
                </p>
                <Link
                  href={`/reset-password?token=${encodeURIComponent(devToken)}`}
                  data-testid="link-reset-password"
                  className="text-amber-900 underline underline-offset-4 not-italic"
                >
                  Open the reset page →
                </Link>
                <p className="mt-3 select-all">{devToken}</p>
              </div>
            )}
            <Link
              href="/login"
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
            data-testid="form-forgot-password"
          >
            <FieldLabel htmlFor="forgot-email">Email</FieldLabel>
            <input
              id="forgot-email"
              type="email"
              required
              autoComplete="email"
              data-testid="input-forgot-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />

            {error && (
              <p
                data-testid="error-forgot-password"
                className="font-serif text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              data-testid="button-forgot-submit"
              className={`${primaryButtonClass} mt-2`}
            >
              {busy ? "Sending…" : "Email me a reset link"}
            </button>
          </form>
        )}

        <p className="mt-8 font-serif text-sm text-mino-forest/85">
          Remembered it?{" "}
          <Link
            href="/login"
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
