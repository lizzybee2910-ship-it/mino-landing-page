import { type Request, type Response, type NextFunction } from "express";

/**
 * Require an authenticated session. Pair with `authMiddleware` (which
 * populates `req.user` when a valid session cookie is present).
 */
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    res.status(401).json({ error: "Sign in to continue." });
    return;
  }
  next();
}
