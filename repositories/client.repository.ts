/**
 * Repository for the client table. Raw data access only — validation and
 * business rules live in services/client.service.ts.
 */
import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable, Updateable } from 'kysely';

export type ClientRow = DB['client'];
export type NewClient = Insertable<ClientRow>;
export type ClientUpdate = Updateable<ClientRow>;

const clientRepository = {
  async findById(id: number) {
    return db
      .selectFrom('client')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  },

  async findByNdisNumber(ndisNumber: string) {
    return db
      .selectFrom('client')
      .selectAll()
      .where('ndis_number', '=', ndisNumber)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  },

  async list() {
    return db
      .selectFrom('client')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .execute();
  },

  async create(input: NewClient) {
    return db.insertInto('client').values(input).returningAll().executeTakeFirstOrThrow();
  },

  async update(id: number, input: ClientUpdate) {
    return db
      .updateTable('client')
      .set({ ...input, updated_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },

  async setActiveStatus(id: number, active: boolean) {
    return db
      .updateTable('client')
      .set({ deactivated_at: active ? null : new Date(), updated_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },

  async softDelete(id: number) {
    return db
      .updateTable('client')
      .set({ deleted_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },
};

export default clientRepository;