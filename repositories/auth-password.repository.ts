/**
 * Repository for the auth_password table. Stores only the password hash — never
 * plaintext. Hashing/verification (argon2) happens in the auth service, not here.
 */
import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable, Updateable } from 'kysely';

export type AuthPasswordRow = DB['auth_password'];
export type NewAuthPassword = Insertable<AuthPasswordRow>;
export type AuthPasswordUpdate = Updateable<AuthPasswordRow>;

const authPasswordRepository = {
  /**
   * Fetches the password record for a user. Returns undefined if the user
   * has no password set yet (shouldn't normally happen post-seed, but keeps
   * this repository honest about what the table can contain).
   */
  async findByUserId(userId: number) {
    return db
      .selectFrom('auth_password')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();
  },

  /**
   * Creates the initial password record for a newly created user.
   */
  async create(input: NewAuthPassword) {
    return db
      .insertInto('auth_password')
      .values(input)
      .returningAll()
      .executeTakeFirstOrThrow();
  },

  /**
   * Updates a user's password hash (e.g. on "change my own password").
   * Always bumps password_updated_at to the current time.
   */
  async updateHash(userId: number, passwordHash: string) {
    return db
      .updateTable('auth_password')
      .set({ password_hash: passwordHash, password_updated_at: new Date() })
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();
  },
};

export default authPasswordRepository;