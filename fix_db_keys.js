const mysql = require('mysql2/promise');

async function run() {
  console.log("=== Manual DB Table Creation (api_keys) ===");
  const connection = await mysql.createConnection('mysql://smart-link-manager:8800257@192.168.31.99:3306/smart-link-manager');
  
  try {
    console.log("Executing DDL...");
    await connection.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id int AUTO_INCREMENT NOT NULL,
        tenantId int NOT NULL,
        userId int NOT NULL,
        name varchar(255) NOT NULL,
        prefix varchar(16) NOT NULL,
        keyHash varchar(256) NOT NULL,
        lastUsedAt timestamp NULL ,
        expiresAt timestamp NULL,
        isActive int NOT NULL DEFAULT 1,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT api_keys_id PRIMARY KEY(id)
      )
    `);
    console.log("✅ Table api_keys created (or already exists).");
  } catch (err) {
    console.error("❌ Failed to create table:", err.message);
  } finally {
    await connection.end();
  }
}

run();
