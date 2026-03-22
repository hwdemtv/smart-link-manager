import mysql from 'mysql2/promise';
import 'dotenv/config';

async function migrate() {
  const connection = await mysql.createConnection(process.env.DATABASE_URL!);

  console.log('Adding missing foreign keys...');

  try {
    // Add missing foreign keys with shorter names
    const foreignKeys = [
      { name: 'fk_scr_requested_plan', sql:
        'ALTER TABLE subscription_change_requests ADD CONSTRAINT fk_scr_requested_plan FOREIGN KEY (requestedPlanId) REFERENCES subscription_plans(id)' },
      { name: 'fk_scr_current_plan', sql:
        'ALTER TABLE subscription_change_requests ADD CONSTRAINT fk_scr_current_plan FOREIGN KEY (currentPlanId) REFERENCES subscription_plans(id)' },
    ];

    for (const fk of foreignKeys) {
      try {
        await connection.query(fk.sql);
        console.log(`Foreign key ${fk.name} added`);
      } catch (err: any) {
        if (err.code === 'ER_FK_EXISTS' || err.message?.includes('already exists')) {
          console.log(`Foreign key ${fk.name} already exists`);
        } else {
          console.warn(`Warning adding foreign key ${fk.name}:`, err.message);
        }
      }
    }

    console.log('Migration completed successfully!');
  } catch (error: any) {
    console.error('Migration error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

migrate().catch(console.error);
