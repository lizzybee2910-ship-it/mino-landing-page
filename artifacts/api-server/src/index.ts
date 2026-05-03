import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

// One-time idempotent migration: promote legacy users (those whose rows
// predate the emailVerified column) to emailVerified=true so they are not
// locked out. Safe to run on every startup because:
//   - New registrations now set emailVerificationToken atomically in the same
//     INSERT statement, so a new unverified user always has a token (non-NULL)
//     and is never matched by this query.
//   - The query is already idempotent (WHERE emailVerified = 'false' AND
//     emailVerificationToken IS NULL cannot match any row twice).
// Once all legacy rows have been promoted this function becomes a no-op.
async function backfillLegacyEmailVerified() {
  try {
    const result = await db
      .update(usersTable)
      .set({ emailVerified: "true" })
      .where(
        and(
          eq(usersTable.emailVerified, "false"),
          isNull(usersTable.emailVerificationToken),
        ),
      )
      .returning({ id: usersTable.id });
    if (result.length > 0) {
      logger.info(
        { count: result.length },
        "Promoted legacy users to emailVerified=true",
      );
    }
  } catch (err) {
    logger.error({ err }, "Failed to backfill emailVerified for legacy users");
  }
}

backfillLegacyEmailVerified().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
});
