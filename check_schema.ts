import "dotenv/config";
import { getDb } from "./server/db";
import { sql } from "drizzle-orm";

async function check() {
  console.log("Connecting to DB...");
  const db = await getDb();
  if (!db) {
    console.error("Failed to connect to DB");
    process.exit(1);
  }
  
  console.log("Checking 'links' table structure...");
  try {
    const [rows] = await db.execute(sql`DESCRIBE links`);
    console.log("Table 'links' fields:");
    console.log(JSON.stringify(rows, null, 2));

    const [indices] = await db.execute(sql`SHOW INDEX FROM links`);
    console.log("Table 'links' indices:");
    console.log(JSON.stringify(indices, null, 2));
  } catch (err) {
    console.error("Error describing 'links' table:", err);
  }

  console.log("\nChecking 'users' table structure...");
  try {
    const [rows] = await db.execute(sql`DESCRIBE users`);
    console.log("Table 'users' fields:");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error("Error describing 'users' table:", err);
  }

  process.exit(0);
}

check().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
