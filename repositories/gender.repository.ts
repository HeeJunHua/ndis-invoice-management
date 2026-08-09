/**
 * Repository for the gender table. Simple lookup table — no soft delete
 * (per schema, gender only has deactivated_at, not deleted_at).
 */
import { db } from '@/db';

const genderRepository = {
  async findById(id: number) {
    return db
      .selectFrom('gender')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
  },

  async list() {
    return db
      .selectFrom('gender')
      .selectAll()
      .orderBy('id')
      .execute();
  },

  async create(input: any) {
    return db.insertInto('gender').values(input).returningAll().executeTakeFirstOrThrow();
  },

  async update(id: number, input: any) {
    return db
      .updateTable('gender')
      .set({ ...input, updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  },

  async softDelete(id: number) {
    return db
      .updateTable('gender')
      .set({ deactivated_at: new Date() })
      .where('id', '=', id)
      .where('deactivated_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },
  
  async setGenderStatus(id: number, active: boolean) {
    return db
      .updateTable('gender')
      .set({ deactivated_at: active ? null : new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  },
};

export default genderRepository;