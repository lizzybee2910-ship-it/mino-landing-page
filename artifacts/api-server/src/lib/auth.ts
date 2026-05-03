import * as client from "openid-client";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { type Request, type Response } from "express";
import { db, sessionsTable } from "@workspace/db";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import type { AuthUser } from "@workspace/api-zod";

export const ISSUER_URL = process.env.ISSUER_URL ?? "https://replit.com/oidc";
export const SESSION_COOKIE = "sid";
export const SESSION_TTL = 7 * 24 * 60 * 60 * 1000;
export const BCRYPT_COST = 12;

export type AuthProvider = "replit" | "password";

export interface SessionData {
  user: AuthUser;
  /**
   * Identifies how the session was established. "replit" sessions carry an
   * OIDC access/refresh token and may be refreshed; "password" sessions are
   * self-contained and do not require token refresh.
   */
  provider?: AuthProvider;
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  /**
   * Epoch milliseconds the session was first established. Captured at
   * createSession time so the /account "active sessions" UI can show
   * when each device signed in. Preserved across refreshIfExpired since
   * we only mutate the OIDC token fields on refresh.
   */
  createdAt?: number;
  /**
   * Raw User-Agent header captured at session creation. Stored so members
   * can recognise their devices in the active-sessions UI without us
   * having to parse it server-side.
   */
  userAgent?: string | null;
  /**
   * IP address captured at session creation. Stored verbatim from the
   * Express trust-proxy-aware `req.ip` and used purely as a hint to the
   * member ("a session signed in from 1.2.3.4"); never used for auth.
   */
  ipAddress?: string | null;
}

/**
 * Snapshot the current request's device/network fingerprint so it can be
 * stored alongside a freshly created SessionData. Kept tiny on purpose:
 *   - userAgent is truncated to 512 chars to avoid pathological headers
 *     bloating the sessions row.
 *   - ipAddress is whatever Express resolved via `trust proxy` (the real
 *     client IP after the Replit reverse proxy), or null when unknown.
 *   - createdAt is set here (not inside createSession) so callers can
 *     also use it to seed pre-existing-session migrations consistently.
 */
export function captureSessionContext(
  req: Request,
): Pick<SessionData, "createdAt" | "userAgent" | "ipAddress"> {
  const uaHeader = req.headers["user-agent"];
  const userAgent =
    typeof uaHeader === "string" && uaHeader.length > 0
      ? uaHeader.slice(0, 512)
      : null;
  const ipAddress = typeof req.ip === "string" && req.ip.length > 0 ? req.ip : null;
  return {
    createdAt: Date.now(),
    userAgent,
    ipAddress,
  };
}

/**
 * Derive the public-facing identifier for a session row. We never expose
 * the raw `sid` (which is a bearer token) to the browser — instead we hash
 * it so the /auth/sessions response can be safely consumed by JavaScript
 * without granting any new way to impersonate the user.
 */
export function publicSessionId(sid: string): string {
  return crypto.createHash("sha256").update(sid).digest("hex");
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let oidcConfig: client.Configuration | null = null;

export async function getOidcConfig(): Promise<client.Configuration> {
  if (!oidcConfig) {
    oidcConfig = await client.discovery(
      new URL(ISSUER_URL),
      process.env.REPL_ID!,
    );
  }
  return oidcConfig;
}

export async function createSession(data: SessionData): Promise<string> {
  const sid = crypto.randomBytes(32).toString("hex");
  // Stamp createdAt at insert time when the caller didn't supply it. This
  // keeps the active-sessions UI accurate even for legacy callers that
  // don't pass captureSessionContext().
  const stamped: SessionData = { createdAt: Date.now(), ...data };
  await db.insert(sessionsTable).values({
    sid,
    sess: stamped as unknown as Record<string, unknown>,
    expire: new Date(Date.now() + SESSION_TTL),
  });
  return sid;
}

export async function getSession(sid: string): Promise<SessionData | null> {
  const [row] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.sid, sid));

  if (!row || row.expire < new Date()) {
    if (row) await deleteSession(sid);
    return null;
  }

  return row.sess as unknown as SessionData;
}

export async function updateSession(
  sid: string,
  data: SessionData,
): Promise<void> {
  await db
    .update(sessionsTable)
    .set({
      sess: data as unknown as Record<string, unknown>,
      expire: new Date(Date.now() + SESSION_TTL),
    })
    .where(eq(sessionsTable.sid, sid));
}

export async function deleteSession(sid: string): Promise<void> {
  await db.delete(sessionsTable).where(eq(sessionsTable.sid, sid));
}

/**
 * List every unexpired session row that belongs to the given user. Used by
 * the /auth/sessions endpoint to render the "active devices" UI. We filter
 * expired rows in SQL so the caller doesn't need to reproduce the same
 * comparison clientside, and we order newest-first so the current device
 * tends to surface near the top.
 */
export async function listSessionsForUser(
  userId: string,
): Promise<(typeof sessionsTable.$inferSelect)[]> {
  return db
    .select()
    .from(sessionsTable)
    .where(
      and(
        sql`${sessionsTable.sess}->'user'->>'id' = ${userId}`,
        gt(sessionsTable.expire, new Date()),
      ),
    );
}

/**
 * Delete all sessions belonging to a user. Used when ownership of an account
 * is transferred (e.g., an OIDC login reclaims an email that was pre-registered
 * by a password-account attacker) so any existing attacker sessions are revoked.
 */
export async function deleteSessionsByUserId(userId: string): Promise<void> {
  await db
    .delete(sessionsTable)
    .where(sql`${sessionsTable.sess}->'user'->>'id' = ${userId}`);
}

/**
 * Delete every session belonging to a user *except* the one identified by
 * `keepSid`. Used when a signed-in user rotates their own password so the
 * caller stays logged in on the current device while every other browser /
 * stolen cookie is forced through sign-in again with the new credential.
 */
export async function deleteOtherSessionsForUser(
  userId: string,
  keepSid: string,
): Promise<void> {
  await db
    .delete(sessionsTable)
    .where(
      and(
        sql`${sessionsTable.sess}->'user'->>'id' = ${userId}`,
        ne(sessionsTable.sid, keepSid),
      ),
    );
}

export async function clearSession(
  res: Response,
  sid?: string,
): Promise<void> {
  if (sid) await deleteSession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
}

export function getSessionId(req: Request): string | undefined {
  const authHeader = req.headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.cookies?.[SESSION_COOKIE];
}
