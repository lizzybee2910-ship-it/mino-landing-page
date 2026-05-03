import { pgEnum, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const waitlistRoleEnum = pgEnum("waitlist_role", [
  "provider",
  "clinic_owner",
  "partner",
  "patient",
  "other",
]);

export const waitlistSignupsTable = pgTable("waitlist_signups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: waitlistRoleEnum("role").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type WaitlistSignup = typeof waitlistSignupsTable.$inferSelect;
export type InsertWaitlistSignup = typeof waitlistSignupsTable.$inferInsert;
