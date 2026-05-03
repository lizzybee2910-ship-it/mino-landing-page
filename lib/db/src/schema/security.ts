import { index, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";
import { usersTable } from "./auth";

export const securityEventsTable = pgTable(
  "security_events",
  {
    id: varchar("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: varchar("user_id")
      .notNull()
      .references(() => usersTable.id, { onDelete: "cascade" }),
    eventType: varchar("event_type").notNull(),
    ipAddress: varchar("ip_address"),
    userAgent: varchar("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("security_events_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
  ],
);

export type SecurityEvent = typeof securityEventsTable.$inferSelect;
export type NewSecurityEvent = typeof securityEventsTable.$inferInsert;
