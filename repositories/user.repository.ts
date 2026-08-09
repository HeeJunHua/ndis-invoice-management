import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable, Updateable } from 'kysely';

export type NewAppUser = Insertable<DB['app_user']>;
export type AppUserUpdate = Updateable<DB['app_user']>;

const userRepository = {
  async findById(id: number) {
    return db.selectFrom('app_user').selectAll().where('id', '=', id).where('deleted_at', 'is', null).executeTakeFirst();
  },
  async findByEmail(email: string) {
    return db.selectFrom('app_user').selectAll().where('email', '=', email).where('deleted_at', 'is', null).executeTakeFirst();
  },
  async list() {
    return db.selectFrom('app_user').selectAll().orderBy('created_at', 'desc').execute();
  },
  async create(input: NewAppUser) {
    return db.insertInto('app_user').values(input).returningAll().executeTakeFirstOrThrow();
  },
  async update(id: number, input: AppUserUpdate) {
    return db.updateTable('app_user').set({ ...input, updated_at: new Date() }).where('id', '=', id).where('deleted_at', 'is', null).returningAll().executeTakeFirst();
  },
  async softDelete(id: number) {
    return db .updateTable('app_user') .set({ deleted_at: new Date() }) .where('id', '=', id) .where('deleted_at', 'is', null) .returningAll() .executeTakeFirst();
  },
};
export default userRepository;