/**
 * Repository for the app_user table. Handles raw data access only — no password
 * hashing, session logic, or permission checks (those live in services).
 * All reads exclude soft-deleted rows by default, per the project's deletion strategy.
 */
import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable, Updateable } from 'kysely';

export type AppUserRow = DB['app_user'];
export type NewAppUser = Insertable<AppUserRow>;
export type AppUserUpdate = Updateable<AppUserRow>;

const appUserRepository = {
  /**
   * Finds a single active (non-deleted) user by id.
   */
  async findById(id: number) {
    return db
      .selectFrom('app_user')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  },

  /**
   * Finds a single active user by email. Used by the auth service during login.
   * citext on the email column makes this comparison case-insensitive at the DB level.
   */
  async findByEmail(email: string) {
    return db
      .selectFrom('app_user')
      .selectAll()
      .where('email', '=', email)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  },

  /**
   * Lists active users, most recently created first.
   */
  async list() {
    return db
      .selectFrom('app_user')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .execute();
  },

  /**
   * Creates a new user record. Returns the full inserted row.
   */
  async create(input: NewAppUser) {
    return db
      .insertInto('app_user')
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  },

  /**
   * Updates an active user's mutable fields. Always bumps updated_at.
   * Returns undefined if no active row matched the id.
   */
  async update(id: number, input: AppUserUpdate) {
    return db
      .updateTable('app_user')
      .set({ ...input, updated_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },

  /**
   * Soft-deletes a user by setting deleted_at. Historical references
   * (e.g. audit_log.actor_user_id) remain intact since nothing is actually removed.
   */
  async softDelete(id: number) {
    return db
      .updateTable('app_user')
      .set({ deleted_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },
};

export default appUserRepository;