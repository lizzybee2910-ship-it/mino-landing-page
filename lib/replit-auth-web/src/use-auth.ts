import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

export interface RegisterInput {
  email: string;
  password: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface PasswordLoginInput {
  email: string;
  password: string;
}

export interface RegisterResult {
  /**
   * The newly created and authenticated user, if the account was activated
   * immediately. Null when email verification is required before a session
   * can be issued.
   */
  user: AuthUser | null;
  /** True when the account was created but requires email verification. */
  requiresVerification: boolean;
  /**
   * Plaintext verification token included in non-production environments only,
   * to enable end-to-end testing of the verification flow without a real email
   * delivery service. Never present in production.
   */
  devVerificationToken?: string;
}

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Begin the OIDC (Replit) login flow by redirecting the browser. */
  login: () => void;
  /** Sign in with email + password. Throws on failure with a user-facing message. */
  loginWithPassword: (input: PasswordLoginInput) => Promise<AuthUser>;
  /**
   * Create a new account with email + password. Throws on failure.
   * Check result.requiresVerification to determine whether the user must
   * verify their email before they can log in.
   */
  register: (input: RegisterInput) => Promise<RegisterResult>;
  /** Force a re-fetch of the current authenticated user. */
  refresh: () => Promise<void>;
  logout: () => void;
}

async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/user", { credentials: "include" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = (await res.json()) as { user: AuthUser | null };
  return data.user ?? null;
}

async function postJson<T>(
  url: string,
  body: unknown,
  fallbackError: string,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // ignore parse error; we'll fall through
  }

  if (!res.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      typeof (payload as { error: unknown }).error === "string"
        ? (payload as { error: string }).error
        : fallbackError;
    throw new Error(message);
  }

  return payload as T;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const next = await fetchCurrentUser();
      setUser(next);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetchCurrentUser()
      .then((next) => {
        if (!cancelled) {
          setUser(next);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(() => {
    const base = import.meta.env.BASE_URL.replace(/\/+$/, "") || "/";
    window.location.href = `/api/login?returnTo=${encodeURIComponent(base)}`;
  }, []);

  const loginWithPassword = useCallback(
    async (input: PasswordLoginInput) => {
      const result = await postJson<{ user: AuthUser }>(
        "/api/auth/password-login",
        input,
        "Sign in failed.",
      );
      setUser(result.user);
      setIsLoading(false);
      return result.user;
    },
    [],
  );

  const register = useCallback(async (input: RegisterInput): Promise<RegisterResult> => {
    const result = await postJson<{
      user?: AuthUser;
      requiresVerification?: boolean;
      devVerificationToken?: string;
    }>("/api/auth/register", input, "Account creation failed.");
    if (result.user) {
      setUser(result.user);
      setIsLoading(false);
      return { user: result.user, requiresVerification: false };
    }
    return {
      user: null,
      requiresVerification: result.requiresVerification ?? false,
      devVerificationToken: result.devVerificationToken,
    };
  }, []);

  const logout = useCallback(() => {
    window.location.href = "/api/logout";
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    loginWithPassword,
    register,
    refresh,
    logout,
  };
}
