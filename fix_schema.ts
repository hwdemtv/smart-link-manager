import "dotenv/config";
import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function fixSchema() {
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to DB");
    process.exit(1);
  }

  console.log("Applying schema fixes...");

  const queries = [
    "ALTER TABLE links ADD COLUMN isDeleted INT DEFAULT 0 NOT NULL",
    "CREATE INDEX shortCodeIdx ON links (shortCode)",
    "CREATE INDEX userIdIdx ON links (userId)",
    "CREATE INDEX domainIdx ON links (customDomain)",
    "CREATE INDEX shortCodeDomainIdx ON links (shortCode, customDomain)",
    "CREATE INDEX isDeletedIdx ON links (isDeleted)",
    "CREATE INDEX groupIdIdx ON links (groupId)",
    "CREATE INDEX originalShortCodeIdx ON links (originalShortCode)",
    "CREATE INDEX userIdDeletedIdx ON links (userId, isDeleted)",
    "CREATE INDEX userIdDeletedExpiresIdx ON links (userId, isDeleted, expiresAt)"
  ];

  for (const query of queries) {
    try {
      console.log(`Executing: ${query}`);
      await db.execute(sql.raw(query));
      console.log("Success.");
    } catch (err: any) {
      console.warn(`Warning/Error on query: ${query}`);
      console.warn(err.message);
    }
  }

  console.log("Schema fix attempt complete.");
  process.exit(0);
}

fixSchema().catch(console.error);
