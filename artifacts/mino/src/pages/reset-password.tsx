import { useState, type FormEvent } from "react";
import { Link, useSearch } from "wouter";
import { homeHref } from "@/lib/links";
import { PasswordStrengthMeter } from "@/components/password-strength";

function parseSearch(search: string) {
  const params = new URLSearchParams(search);
  return {
    token: params.get("token") ?? "",
  };
}

export default function ResetPasswordPage() {
  const search = useSearch();
  const { token } = parseSearch(search);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      let payload: { error?: string; message?: string } | null = null;
      try {
        payload = await res.json();
      } catch {
        // ignore parse error
      }
      if (!res.ok) {
        const msg =
          payload && typeof payload.error === "string"
            ? payload.error
            : "Could not reset password.";
        throw new Error(msg);
      }
      setDone(true);
      setBusy(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password.");
      setBusy(false);
    }
  }

  return (
    <main
      data-testid="page-reset-password"
      className="min-h-screen bg-mino-cream pt-32 pb-24 px-6"
    >
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="mino-rule" />
          <span className="mino-eyebrow text-mino-sage-deep">Members</span>
        </div>
        <h1 className="font-serif text-4xl text-mino-forest mb-3">
          Choose a new password
        </h1>
        <p className="font-serif text-lg text-mino-forest/85 mb-10">
          Set a new password for your (mino) account. Reset links expire one
          hour after they are sent.
        </p>

        {!token ? (
          <div data-testid="reset-no-token" className="flex flex-col gap-4">
            <p className="font-serif text-base text-red-700">
              This page needs a reset token. Use the link from your password
              reset email, or request a new one.
            </p>
            <Link
              href="/forgot-password"
              data-testid="link-request-reset"
              className="font-serif text-sm text-mino-forest underline underline-offset-4"
            >
              Request a new reset link →
            </Link>
          </div>
        ) : done ? (
          <div data-testid="reset-success" className="flex flex-col gap-4">
            <p className="font-serif text-base text-mino-forest">
              Your password has been updated. Sign in to continue.
            </p>
            <Link
              href="/login"
              data-testid="link-after-reset"
              className="inline-flex w-full items-center justify-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink transition-colors px-5 py-3"
            >
              Sign in
            </Link>
          </div>
        ) : (
          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-4"
            data-testid="form-reset-password"
          >
            <FieldLabel htmlFor="reset-password">
              New password (min 8 characters, not a common or breached password)
            </FieldLabel>
            <input
              id="reset-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              data-testid="input-reset-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass}
              aria-describedby="reset-password-strength"
            />
            <PasswordStrengthMeter
              id="reset-password-strength"
              password={password}
            />

            <FieldLabel htmlFor="reset-confirm">Confirm password</FieldLabel>
            <input
              id="reset-confirm"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              data-testid="input-reset-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />

            {error && (
              <p
                data-testid="error-reset-password"
                className="font-serif text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              data-testid="button-reset-submit"
              className={`${primaryButtonClass} mt-2`}
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
        )}

        <p className="mt-8 font-serif text-sm text-mino-forest/85">
          Need a new link?{" "}
          <Link
            href="/forgot-password"
            data-testid="link-to-forgot"
            className="text-mino-forest underline underline-offset-4"
          >
            Request a reset email
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
