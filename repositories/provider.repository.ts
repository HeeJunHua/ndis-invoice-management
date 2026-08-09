/**
 * Repository for the provider table. Raw data access only — validation lives
 * in services/provider.service.ts.
 */
import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable, Updateable } from 'kysely';

export type ProviderRow = DB['provider'];
export type NewProvider = Insertable<ProviderRow>;
export type ProviderUpdate = Updateable<ProviderRow>;

const providerRepository = {
  async findById(id: number) {
    return db
      .selectFrom('provider')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  },

  async findByAbn(abn: string) {
    return db
      .selectFrom('provider')
      .selectAll()
      .where('abn', '=', abn)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  },

  async list() {
    return db
      .selectFrom('provider')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .execute();
  },

  async create(input: NewProvider) {
    return db.insertInto('provider').values(input).returningAll().executeTakeFirstOrThrow();
  },

  async update(id: number, input: ProviderUpdate) {
    return db
      .updateTable('provider')
      .set({ ...input, updated_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },
  async setActiveStatus(id: number, active: boolean) {
    return db
      .updateTable('provider')
      .set({ deactivated_at: active ? null : new Date(), updated_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },
  async softDelete(id: number) {
    return db
      .updateTable('provider')
      .set({ deleted_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },
};

export default providerRepository;