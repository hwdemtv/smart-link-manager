import "dotenv/config";
import mysql from "mysql2/promise";

async function run() {
  const connectionUrl = process.env.DATABASE_URL;
  if (!connectionUrl) {
    throw new Error("Missing DATABASE_URL");
  }

  const conn = await mysql.createConnection(connectionUrl);
  console.log("Connected to database to drop tenantId columns...");

  const tables = [
    "users",
    "links",
    "domains",
    "usage_logs",
    "audit_logs",
    "api_keys",
    "notifications"
  ];

  for (const table of tables) {
    try {
      // 1. Try to drop foreign key first (assume conventional fk name)
      const fkName = `${table}_tenantId_tenants_id_fk`;
      try {
        await conn.query(`ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${fkName}\``);
        console.log(`✅ Dropped FK ${fkName} from ${table}`);
      } catch (fkErr: any) {
         // ignore
      }

      // 2. Drop the column
      await conn.query(`ALTER TABLE \`${table}\` DROP COLUMN \`tenantId\``);
      console.log(`✅ Dropped column tenantId from ${table}`);
    } catch (err: any) {
      if (err.code === "ER_CANT_DROP_FIELD_OR_KEY") {
         console.log(`ℹ️ Column tenantId does not exist in ${table}, skipping.`);
      } else {
         console.error(`❌ Error altering ${table}:`, err.message);
      }
    }
  }

  await conn.end();
  console.log("Cleanup finished.");
}

run().catch(console.error);
