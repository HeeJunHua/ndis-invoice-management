import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable } from 'kysely';

export type NewRateSetSupportItem = Insertable<DB['rate_set_support_item']>;

const rateSetSupportItemRepository = {
  async listActiveByRateSet(rateSetId: number) {
    return db
      .selectFrom('rate_set_support_item')
      .selectAll()
      .where('rate_set_id', '=', rateSetId)
      .where('deleted_at', 'is', null)
      .execute();
  },

  async upsert(input: NewRateSetSupportItem) {
    return db
      .insertInto('rate_set_support_item')
      .values(input)
      .onConflict((oc) =>
        oc
          .columns(['rate_set_id', 'category_id', 'item_number'])
          .where('deleted_at', 'is', null)
          .doUpdateSet({
            item_name: input.item_name,
            unit: input.unit,
            sorting: input.sorting,
            updated_at: new Date(),
            deleted_at: null,
          }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  },

  async softDeleteMissing(rateSetId: number, keepItemNumbers: string[]) {
    let query = db
      .updateTable('rate_set_support_item')
      .set({ deleted_at: new Date() })
      .where('rate_set_id', '=', rateSetId)
      .where('deleted_at', 'is', null);

    if (keepItemNumbers.length > 0) {
      query = query.where('item_number', 'not in', keepItemNumbers);
    }
    return query.execute();
  },

  async findById(id: number) {
    return db
      .selectFrom('rate_set_support_item')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  },
};

export default rateSetSupportItemRepository;