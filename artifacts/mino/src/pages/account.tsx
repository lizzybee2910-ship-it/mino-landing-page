import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";
import {
  useListRecentSecurityEvents,
  type SecurityEvent,
} from "@workspace/api-client-react";
import { homeHref } from "@/lib/links";
import { PasswordStrengthMeter } from "@/components/password-strength";

interface ActiveSession {
  id: string;
  createdAt: string;
  userAgent: string | null;
  ipAddress: string | null;
  isCurrent: boolean;
}

export default function AccountPage() {
  const { user } = useAuth();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Choose a new password that differs from the current one.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
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
            : "Could not update password.";
        throw new Error(msg);
      }
      setMessage(
        payload?.message ??
          "Password updated. Other devices have been signed out.",
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setBusy(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not update password.",
      );
      setBusy(false);
    }
  }

  return (
    <main
      data-testid="page-account"
      className="min-h-screen bg-mino-cream pt-32 pb-24 px-6"
    >
      <div className="max-w-md mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <span className="mino-rule" />
          <span className="mino-eyebrow text-mino-sage-deep">Account</span>
        </div>
        <h1 className="font-serif text-4xl text-mino-forest mb-3">
          Change password
        </h1>
        <p className="font-serif text-lg text-mino-forest/85 mb-2">
          Signed in as{" "}
          <span data-testid="account-email" className="text-mino-forest">
            {user?.email ?? "—"}
          </span>
          .
        </p>
        <p className="font-serif text-base text-mino-forest/85 mb-10">
          Enter your current password to choose a new one. Updating your
          password signs every other device out of (mino).
        </p>

        <form
          onSubmit={onSubmit}
          className="flex flex-col gap-4"
          data-testid="form-change-password"
        >
          <FieldLabel htmlFor="account-current">Current password</FieldLabel>
          <input
            id="account-current"
            type="password"
            required
            autoComplete="current-password"
            data-testid="input-account-current"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
          />

          <FieldLabel htmlFor="account-new">
            New password (min 8 characters, not a common or breached password)
          </FieldLabel>
          <input
            id="account-new"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            data-testid="input-account-new"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
            aria-describedby="account-password-strength"
          />
          <PasswordStrengthMeter
            id="account-password-strength"
            password={newPassword}
            email={user?.email ?? null}
          />

          <FieldLabel htmlFor="account-confirm">
            Confirm new password
          </FieldLabel>
          <input
            id="account-confirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            data-testid="input-account-confirm"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClass}
          />

          {error && (
            <p
              data-testid="error-account"
              className="font-serif text-sm text-red-700"
            >
              {error}
            </p>
          )}
          {message && (
            <p
              data-testid="message-account"
              className="font-serif text-sm text-mino-forest"
            >
              {message}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            data-testid="button-account-submit"
            className={`${primaryButtonClass} mt-2`}
          >
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>

        <ActiveSessions />

        <p className="mt-8 font-serif text-sm text-mino-forest/85">
          Forgot your current password?{" "}
          <Link
            href="/forgot-password"
            data-testid="link-account-forgot"
            className="text-mino-forest underline underline-offset-4"
          >
            Send a reset email
          </Link>
        </p>

        <SecurityActivityPanel />

        <p className="mt-8 font-serif text-sm text-mino-forest/50">
          <Link href={homeHref()} className="hover:text-mino-forest/90">
            ← Back to (mino)
          </Link>
        </p>
      </div>
    </main>
  );
}

function ActiveSessions() {
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoadError(null);
    try {
      const res = await fetch("/api/auth/sessions", {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as { sessions: ActiveSession[] };
      setSessions(data.sessions);
    } catch {
      setLoadError("Could not load active sessions.");
    }
  }, []);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  async function onRevoke(session: ActiveSession) {
    setActionError(null);
    setRevoking(session.id);
    try {
      const res = await fetch(
        `/api/auth/sessions/${encodeURIComponent(session.id)}/revoke`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      let payload: { signedOut?: boolean; error?: string } | null = null;
      try {
        payload = await res.json();
      } catch {
        // ignore parse error
      }
      if (!res.ok) {
        throw new Error(
          (payload && payload.error) || "Could not sign that device out.",
        );
      }
      if (payload?.signedOut) {
        // The caller revoked their own session — the cookie has already
        // been cleared on the server. Send them home so the auth-gated
        // pages don't briefly render their stale state.
        window.location.assign("/");
        return;
      }
      // Optimistic local removal so the UI updates instantly; reload from
      // the server to stay in sync if anything else changed.
      setSessions((prev) =>
        prev ? prev.filter((s) => s.id !== session.id) : prev,
      );
      await loadSessions();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Could not sign that device out.",
      );
    } finally {
      setRevoking(null);
    }
  }

  return (
    <section className="mt-14" data-testid="section-active-sessions">
      <div className="flex items-center gap-3 mb-4">
        <span className="mino-rule" />
        <span className="mino-eyebrow text-mino-sage-deep">
          Active sessions
        </span>
      </div>
      <h2 className="font-serif text-2xl text-mino-forest mb-2">
        Where you're signed in
      </h2>
      <p className="font-serif text-base text-mino-forest/85 mb-6">
        Sign out individual devices without changing your password.
      </p>

      {loadError && (
        <p
          data-testid="error-sessions-load"
          className="font-serif text-sm text-red-700"
        >
          {loadError}
        </p>
      )}

      {actionError && (
        <p
          data-testid="error-sessions-action"
          className="font-serif text-sm text-red-700 mb-3"
        >
          {actionError}
        </p>
      )}

      {sessions === null && !loadError && (
        <p
          data-testid="loading-sessions"
          className="font-serif text-sm text-mino-forest/60"
        >
          Loading sessions…
        </p>
      )}

      {sessions && sessions.length === 0 && (
        <p className="font-serif text-sm text-mino-forest/60">
          No active sessions.
        </p>
      )}

      {sessions && sessions.length > 0 && (
        <ul
          className="flex flex-col gap-3"
          data-testid="list-active-sessions"
        >
          {sessions.map((session) => (
            <li
              key={session.id}
              data-testid={`session-row-${session.id}`}
              data-current={session.isCurrent ? "true" : "false"}
              className="border border-mino-forest/15 px-4 py-3 flex items-start justify-between gap-4"
            >
              <div className="flex flex-col gap-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-serif text-mino-forest text-base truncate">
                    {describeUserAgent(session.userAgent)}
                  </span>
                  {session.isCurrent && (
                    <span
                      data-testid="badge-current-session"
                      className="mino-eyebrow text-xs text-mino-sage-deep border border-mino-sage-deep/40 px-2 py-0.5"
                    >
                      Current session
                    </span>
                  )}
                </div>
                <p className="font-serif text-xs text-mino-forest/60">
                  Signed in {formatCreatedAt(session.createdAt)}
                  {session.ipAddress ? ` · ${session.ipAddress}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => onRevoke(session)}
                disabled={revoking === session.id}
                data-testid={`button-revoke-${session.id}`}
                className="mino-eyebrow text-xs text-mino-forest border border-mino-forest/30 hover:border-mino-forest disabled:opacity-50 disabled:cursor-not-allowed transition-colors px-3 py-2 whitespace-nowrap"
              >
                {revoking === session.id ? "Signing out…" : "Sign out"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SecurityActivityPanel() {
  const { data, isLoading, isError } = useListRecentSecurityEvents();

  return (
    <section
      data-testid="section-security-activity"
      className="mt-14 border-t border-mino-forest/15 pt-8"
    >
      <div className="flex items-center gap-3 mb-3">
        <span className="mino-rule" />
        <span className="mino-eyebrow text-mino-sage-deep">
          Recent security activity
        </span>
      </div>
      <p className="font-serif text-sm text-mino-forest/85 mb-5">
        The last ten sign-ins and password changes on this account. If anything
        here looks unfamiliar,{" "}
        <Link
          href="/forgot-password"
          className="text-mino-forest underline underline-offset-4"
        >
          reset your password
        </Link>{" "}
        right away.
      </p>

      {isLoading && (
        <p
          data-testid="security-activity-loading"
          className="font-serif text-sm text-mino-forest/60"
        >
          Loading recent activity…
        </p>
      )}

      {isError && (
        <p
          data-testid="security-activity-error"
          className="font-serif text-sm text-red-700"
        >
          Could not load recent activity. Try refreshing the page.
        </p>
      )}

      {!isLoading && !isError && data && data.events.length === 0 && (
        <p
          data-testid="security-activity-empty"
          className="font-serif text-sm text-mino-forest/60"
        >
          No security activity recorded yet.
        </p>
      )}

      {!isLoading && !isError && data && data.events.length > 0 && (
        <ul
          data-testid="security-activity-list"
          className="flex flex-col divide-y divide-mino-forest/10 border-y border-mino-forest/10"
        >
          {data.events.map((event) => (
            <SecurityActivityRow key={event.id} event={event} />
          ))}
        </ul>
      )}
    </section>
  );
}

function describeUserAgent(ua: string | null): string {
  if (!ua) return "Unknown device";
  const browser = ua.includes("Edg")
    ? "Edge"
    : ua.includes("Chrome")
      ? "Chrome"
      : ua.includes("Safari")
        ? "Safari"
        : ua.includes("Firefox")
          ? "Firefox"
          : null;
  const platform = ua.includes("iPhone")
    ? "iPhone"
    : ua.includes("iPad")
      ? "iPad"
      : ua.includes("Android")
        ? "Android"
        : ua.includes("Mac OS")
          ? "macOS"
          : ua.includes("Windows")
            ? "Windows"
            : ua.includes("Linux")
              ? "Linux"
              : null;
  if (browser && platform) return `${browser} on ${platform}`;
  if (browser) return browser;
  if (platform) return platform;
  return "Unknown device";
}

function formatCreatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function SecurityActivityRow({ event }: { event: SecurityEvent }) {
  return (
    <li
      data-testid={`security-activity-row-${event.id}`}
      className="py-3 flex flex-col gap-0.5"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span
          data-testid={`security-activity-type-${event.id}`}
          className="font-serif text-base text-mino-forest"
        >
          {labelForEventType(event.eventType)}
        </span>
        <span
          data-testid={`security-activity-when-${event.id}`}
          className="font-serif text-xs text-mino-forest/60 whitespace-nowrap"
        >
          {formatTimestamp(event.createdAt)}
        </span>
      </div>
      <p className="font-serif text-xs text-mino-forest/60">
        <span data-testid={`security-activity-ua-${event.id}`}>
          {summarizeUserAgent(event.userAgent)}
        </span>
        {" · "}
        <span data-testid={`security-activity-location-${event.id}`}>
          {event.location ?? "Unknown location"}
        </span>
        {" · "}
        <span data-testid={`security-activity-ip-${event.id}`}>
          {event.ipAddress ?? "Unknown IP"}
        </span>
      </p>
    </li>
  );
}

function labelForEventType(eventType: string): string {
  switch (eventType) {
    case "login_password":
      return "Signed in with password";
    case "login_oidc":
      return "Signed in with Replit";
    case "password_reset":
      return "Password reset";
    case "password_changed":
      return "Password changed";
    default:
      return eventType;
  }
}

function formatTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

// Render a compact, recognisable label for the user agent string instead of
// the raw header — the full UA is noisy and rarely useful at a glance.
function summarizeUserAgent(userAgent: string | null): string {
  if (!userAgent) return "Unknown device";
  const ua = userAgent;
  let os = "Unknown OS";
  if (/Windows/i.test(ua)) os = "Windows";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Mac OS X|Macintosh/i.test(ua)) os = "macOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let browser = "Unknown browser";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  return `${browser} on ${os}`;
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
