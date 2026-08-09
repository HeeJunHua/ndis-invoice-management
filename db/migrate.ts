import * as path from 'path';
import { Kysely, PostgresDialect } from 'kysely';
import { Migrator } from 'kysely/migration';
import { Pool } from 'pg';
import { WindowsSafeFileMigrationProvider } from './migration-provider';

async function migrateToLatest() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — check your .env file');
  }

  const db = new Kysely<any>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: new WindowsSafeFileMigrationProvider(path.join(__dirname, 'migrations')),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`migration "${it.migrationName}" applied`);
    } else if (it.status === 'Error') {
      console.error(`migration "${it.migrationName}" failed`);
    }
  });

  if (error) {
    console.error('Migration run failed:');
    console.error(error);
    await db.destroy();
    process.exit(1);
  }

  await db.destroy();
}

migrateToLatest();