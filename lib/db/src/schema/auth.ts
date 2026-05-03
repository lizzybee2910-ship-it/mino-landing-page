import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessionsTable = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const usersTable = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  // Bcrypt hash for users who signed up with email + password.
  // NULL for users who signed in via Replit OIDC only.
  passwordHash: varchar("password_hash"),
  // Whether the user has verified ownership of their email address.
  // OIDC-authenticated accounts are always true (provider verifies the email).
  // Password-registered accounts start as false until verified via OIDC or
  // a future email delivery mechanism.
  emailVerified: varchar("email_verified").notNull().default("false"),
  // One-time token (SHA-256 hash of plaintext) issued at password registration.
  // NULL once verified or for accounts created via OIDC.
  emailVerificationToken: varchar("email_verification_token"),
  // Expiry time for the verification token. Tokens older than this are rejected
  // even if the hash matches, preventing indefinite use of stale tokens.
  emailVerificationTokenExpiresAt: timestamp("email_verification_token_expires_at", {
    withTimezone: true,
  }),
  // One-time token (SHA-256 hash of plaintext) issued when a user requests a
  // password reset. NULL when no reset is in flight. Cleared as soon as the
  // token is consumed by POST /auth/reset-password so a single reset link
  // cannot be replayed.
  passwordResetToken: varchar("password_reset_token"),
  // Expiry time for the password reset token. Tokens older than this are
  // rejected even if the hash matches, limiting the blast radius of a leaked
  // reset email.
  passwordResetTokenExpiresAt: timestamp("password_reset_token_expires_at", {
    withTimezone: true,
  }),
  // OIDC subject (claims.sub) that has claimed this account. Set during the
  // first OIDC login that matches this email so subsequent OIDC logins skip
  // the reconciliation path and avoid session-revocation churn.
  oidcSub: varchar("oidc_sub"),
  // Whether this account can author / manage course handouts (and any
  // future admin-gated surface). Defaults to false; flipped manually in
  // the database for trusted editorial team members.
  isAdmin: boolean("is_admin").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type UpsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;
