
import mysql from 'mysql2/promise';
import 'dotenv/config';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found");
    return;
  }

  const connection = await mysql.createConnection(connectionString);
  console.log("Connected to database");

  try {
    console.log("Adding passwordHash column to links table...");
    await connection.execute(`
      ALTER TABLE links ADD COLUMN passwordHash VARCHAR(256) AFTER expiresAt;
    `);
    console.log("Column added successfully");
  } catch (error: any) {
    if (error.code === 'ER_DUP_COLUMN_NAME') {
      console.log("Column already exists");
    } else {
      console.error("Error adding column:", error);
    }
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
