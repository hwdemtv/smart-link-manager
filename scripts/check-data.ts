import mysql from "mysql2/promise";
import "dotenv/config";

async function checkData() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);

  try {
    // Check links count
    const [linksResult] = await connection.query(
      "SELECT COUNT(*) as count FROM links"
    );
    console.log("Links count:", linksResult);

    // Check usage_logs count
    const [usageResult] = await connection.query(
      "SELECT COUNT(*) as count FROM usage_logs"
    );
    console.log("Usage logs count:", usageResult);

    // Check link_stats count
    const [statsResult] = await connection.query(
      "SELECT COUNT(*) as count FROM link_stats"
    );
    console.log("Link stats count:", statsResult);

    // Show recent usage_logs
    const [recentLogs] = await connection.query(
      "SELECT * FROM usage_logs ORDER BY date DESC LIMIT 10"
    );
    console.log("Recent usage logs:", recentLogs);

    // Show tenants with link counts
    const [tenantLinks] = await connection.query(`
      SELECT t.name, COUNT(l.id) as link_count, SUM(l.clickCount) as total_clicks
      FROM tenants t
      LEFT JOIN links l ON t.id = l.tenantId
      GROUP BY t.id
    `);
    console.log("Tenant link stats:", tenantLinks);
  } finally {
    await connection.end();
  }
}

checkData().catch(console.error);
