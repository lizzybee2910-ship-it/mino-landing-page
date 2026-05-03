import { useEffect, useState } from "react";
import { Link, useSearch } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";

function parseSearch(search: string) {
  const params = new URLSearchParams(search);
  return {
    token: params.get("token") ?? "",
    next: params.get("next") ?? "/learn",
  };
}

export default function VerifyEmailPage() {
  const { refresh } = useAuth();
  const search = useSearch();
  const { token, next } = parseSearch(search);

  const [state, setState] = useState<"idle" | "working" | "ok" | "fail">(
    token ? "working" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!token) return;

    (async () => {
      try {
        const res = await fetch("/api/auth/verify-email", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!res.ok) {
          let msg = "Verification failed.";
          try {
            const body = await res.json();
            if (body && typeof body.error === "string") msg = body.error;
          } catch {
            // ignore
          }
          if (!cancelled) {
            setState("fail");
            setError(msg);
          }
          return;
        }
        await refresh();
        if (!cancelled) setState("ok");
      } catch (err) {
        if (!cancelled) {
          setState("fail");
          setError(err instanceof Error ? err.message : "Verification failed.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, refresh]);

  return (
    <main
      data-testid="page-verify-email"
      className="min-h-screen bg-mino-cream pt-32 pb-24 px-6"
    >
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="mino-rule" />
          <span className="mino-eyebrow text-mino-sage-deep">Members</span>
        </div>
        <h1 className="font-serif text-4xl text-mino-forest mb-6">
          Verify email
        </h1>

        {state === "idle" && (
          <p className="font-serif text-base text-mino-forest/85">
            Open the verification link from your registration email to continue.
          </p>
        )}
        {state === "working" && (
          <p
            data-testid="verify-status-working"
            className="font-serif text-base text-mino-forest/85"
          >
            Verifying…
          </p>
        )}
        {state === "ok" && (
          <div data-testid="verify-status-ok" className="flex flex-col gap-4">
            <p className="font-serif text-base text-mino-forest">
              Your email is verified. Welcome to (mino).
            </p>
            <Link
              href={next}
              data-testid="link-after-verify"
              className="inline-flex w-full items-center justify-center gap-2 mino-eyebrow text-mino-cream bg-mino-forest hover:bg-mino-ink transition-colors px-5 py-3"
            >
              Continue
            </Link>
          </div>
        )}
        {state === "fail" && (
          <div data-testid="verify-status-fail" className="flex flex-col gap-4">
            <p className="font-serif text-base text-red-700">
              {error ?? "Verification failed."}
            </p>
            <Link
              href={`/login?next=${encodeURIComponent(next)}`}
              className="font-serif text-sm text-mino-forest underline underline-offset-4"
            >
              ← Back to sign in
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
