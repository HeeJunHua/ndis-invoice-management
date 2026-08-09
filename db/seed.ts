import * as fs from 'fs';
import * as path from 'path';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';

async function seed() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — check your .env file');
  }

  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    }),
  });

  try {
    const seedFilePath = path.join(__dirname, '..', 'db_seed.sql');
    const seedSql = fs.readFileSync(seedFilePath, 'utf-8');

    console.log('Running seed script...');
    await sql.raw(seedSql).execute(db);
    console.log('Seed completed successfully.');
  } catch (error) {
    console.error('Seed run failed:');
    console.error(error);
    await db.destroy();
    process.exit(1);
  }

  await db.destroy();
}

seed();