import mysql from "mysql2/promise";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const dbUrl = process.env.DATABASE_URL;

async function check() {
  console.log("Connecting to", dbUrl);
  // parse url
  const url = new URL(dbUrl!);
  const conn = await mysql.createConnection({
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.substring(1),
  });

  const [rows] = await conn.query(
    'SELECT * FROM configs WHERE `key` = "aiConfig"'
  );
  console.log("--- aiConfig Raw Rows ---");
  console.log(rows);

  const [allRows] = await conn.query("SELECT * FROM configs");
  console.log("--- All Configs ---");
  console.log(allRows);

  // let's do an update to see if it works
  console.log("--- Forcing Update ---");
  await conn.execute(
    'INSERT INTO configs (`key`, `value`) VALUES ("aiConfig", ?) ON DUPLICATE KEY UPDATE `value` = ?',
    [JSON.stringify({ test: "manual" }), JSON.stringify({ test: "manual" })]
  );

  const [rows2] = await conn.query(
    'SELECT * FROM configs WHERE `key` = "aiConfig"'
  );
  console.log("--- aiConfig After Manual Update ---");
  console.log(rows2);

  await conn.end();
}

check().catch(console.error);
