/**
 * Single shared Kysely instance, used by every repository. Repositories import `db` from here —
 * nothing else in the app should construct its own Pool or Kysely instance.
 */
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import type { DB } from './schema';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set — check your .env file');
}

const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
});

export const db = new Kysely<DB>({ dialect });