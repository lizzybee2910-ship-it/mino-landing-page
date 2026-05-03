import { useEffect, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@workspace/replit-auth-web";

interface RequireAuthProps {
  children: ReactNode;
  /** Optional explicit login path. Defaults to "/login". */
  loginPath?: string;
}

/**
 * Route guard. While auth is resolving we render a quiet placeholder. If the
 * caller is not authenticated, we redirect them to /login with a `next=`
 * query so they land back here after a successful sign-in.
 */
export function RequireAuth({ children, loginPath = "/login" }: RequireAuthProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      const next = encodeURIComponent(location || "/");
      navigate(`${loginPath}?next=${next}`, { replace: true });
    }
  }, [isLoading, isAuthenticated, location, loginPath, navigate]);

  if (isLoading) {
    return (
      <div
        data-testid="require-auth-loading"
        className="min-h-[70vh] flex items-center justify-center bg-mino-cream"
      >
        <span className="mino-eyebrow text-mino-sage-deep">Loading…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
