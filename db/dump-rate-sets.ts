import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { DB } from './schema';

async function dumpRateSets() {
  const db = new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    }),
  });
  const rateSets = await db.selectFrom('rate_set').selectAll().execute();
  console.log(JSON.stringify(rateSets, null, 2));
  await db.destroy();
}

dumpRateSets();
