import { createConnection } from 'mysql2/promise';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('❌ 未找到 DATABASE_URL 环境变量');
  process.exit(1);
}

async function fix() {
  console.log('🚀 开始修复数据库结构...');
  
  // 从 URL 解析连接信息
  // 格式: mysql://user:password@host:port/database
  const url = new URL(dbUrl!);
  const config = {
    host: url.hostname,
    port: parseInt(url.port) || 3306,
    user: url.username,
    password: url.password,
    database: url.pathname.substring(1),
  };

  const connection = await createConnection(config);

  try {
    // 1. 检查并创建 configs 表
    console.log('--- 检查 configs 表 ---');
    await connection.query(`
      CREATE TABLE IF NOT EXISTS \`configs\` (
        \`key\` varchar(255) NOT NULL,
        \`value\` text,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`key\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('✅ configs 表已就绪');

    // 2. 检查并补齐 links 表字段
    console.log('--- 检查 links 表字段 ---');
    const [columns] = await connection.query('DESCRIBE `links`');
    const columnNames = (columns as any[]).map(c => c.Field);

    const missingColumns = [
      { name: 'seoTitle', type: 'varchar(255) DEFAULT NULL' },
      { name: 'seoDescription', type: 'text DEFAULT NULL' },
      { name: 'seoImage', type: 'text DEFAULT NULL' },
      { name: 'abTestEnabled', type: "int(11) NOT NULL DEFAULT '0'" },
      { name: 'abTestUrl', type: 'text DEFAULT NULL' },
      { name: 'abTestRatio', type: "int(11) NOT NULL DEFAULT '50'" }
    ];

    for (const col of missingColumns) {
      if (!columnNames.includes(col.name)) {
        console.log(`➕ 正在添加字段: ${col.name}...`);
        await connection.query(`ALTER TABLE \`links\` ADD COLUMN \`${col.name}\` ${col.type}`);
        console.log(`✅ ${col.name} 添加成功`);
      } else {
        console.log(`ℹ️ 字段 ${col.name} 已存在，跳过`);
      }
    }

    console.log('\n✨ 数据库结构修复完成！请刷新网页重试。');
  } catch (error: any) {
    console.error('❌ 修复失败:', error.message);
  } finally {
    await connection.end();
  }
}

fix();
