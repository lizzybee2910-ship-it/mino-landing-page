import { type Request, type Response, type NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";

/**
 * Require an authenticated session whose user record is flagged as an
 * admin. Use after `requireAuth` for surfaces that only the editorial
 * team should reach (handout authoring, future course CRUD, etc.).
 *
 * Admin status is read live from the `users` table on every request so
 * a flipped `is_admin` column takes effect immediately without forcing
 * the affected member to sign out and back in.
 */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  const [row] = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, req.user!.id));
  if (!row || !row.isAdmin) {
    res.status(403).json({ error: "Admin access required." });
    return;
  }
  next();
}

/**
 * Lightweight check used by GET /api/learn/admin/status so the React UI
 * can decide whether to show admin-only navigation without having to
 * speculatively call a 403-prone admin endpoint.
 */
export async function isUserAdmin(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ isAdmin: usersTable.isAdmin })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  return row?.isAdmin === true;
}
