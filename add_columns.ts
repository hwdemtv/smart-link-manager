import "dotenv/config";
import mysql from "mysql2/promise";

async function main() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);

  try {
    await connection.query(
      "ALTER TABLE `users` ADD COLUMN `isActive` INT NOT NULL DEFAULT 1;"
    );
    console.log("Added isActive column to users table.");
  } catch (err: any) {
    if (err.code !== "ER_DUP_FIELDNAME") {
      console.error(err);
    } else {
      console.log("isActive column already exists.");
    }
  }

  try {
    await connection.query(
      "ALTER TABLE `users` ADD COLUMN `lastIpAddress` VARCHAR(45);"
    );
    console.log("Added lastIpAddress column to users table.");
  } catch (err: any) {
    if (err.code !== "ER_DUP_FIELDNAME") {
      console.error(err);
    } else {
      console.log("lastIpAddress column already exists.");
    }
  }

  await connection.end();
}

main().catch(console.error);
