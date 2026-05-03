import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@workspace/replit-auth-web";
import { fetchAdminStatus } from "@/lib/learn-api";

/**
 * Returns whether the currently signed-in member has admin privileges.
 * Wraps a TanStack query against /api/learn/admin/status. Disabled
 * while auth is still resolving or when the caller is signed out so
 * we never speculatively call the endpoint without a session cookie.
 */
export function useAdminStatus(): { isAdmin: boolean; isLoading: boolean } {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["learn", "admin", "status"],
    queryFn: fetchAdminStatus,
    enabled: !authLoading && isAuthenticated,
    staleTime: 60_000,
  });
  if (!isAuthenticated) return { isAdmin: false, isLoading: false };
  return { isAdmin: data?.isAdmin === true, isLoading };
}
