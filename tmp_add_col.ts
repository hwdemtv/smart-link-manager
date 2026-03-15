import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function forceUpdateDB() {
  const db = await getDb();
  if (!db) {
    console.log("Failed to connect to DB");
    process.exit(1);
  }
  try {
    console.log("Attempting to add 'tags' column to links table...");
    await db.execute(sql`ALTER TABLE links ADD COLUMN tags json;`);
    console.log("Success! 'tags' column created.");
  } catch (error: any) {
    if (error.code === 'ER_DUP_FIELDNAME' || error.message?.includes('Duplicate column name')) {
      console.log("Column 'tags' already exists. Skipping.");
    } else {
      console.error("Failed to add column:", error);
    }
  } finally {
    process.exit(0);
  }
}

forceUpdateDB();
