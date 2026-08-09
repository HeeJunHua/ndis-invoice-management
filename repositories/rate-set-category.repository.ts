import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable } from 'kysely';

export type NewRateSetCategory = Insertable<DB['rate_set_category']>;

const rateSetCategoryRepository = {
  async listActiveByRateSet(rateSetId: number) {
    return db
      .selectFrom('rate_set_category')
      .selectAll()
      .where('rate_set_id', '=', rateSetId)
      .where('deleted_at', 'is', null)
      .execute();
  },

  async upsert(input: NewRateSetCategory) {
    return db
      .insertInto('rate_set_category')
      .values(input)
      .onConflict((oc) =>
        oc
          .columns(['rate_set_id', 'category_number'])
          .where('deleted_at', 'is', null)
          .doUpdateSet({
            category_name: input.category_name,
            sorting: input.sorting,
            updated_at: new Date(),
            deleted_at: null,
          }),
      )
      .returningAll()
      .executeTakeFirstOrThrow();
  },

  async softDeleteMissing(rateSetId: number, keepCategoryNumbers: string[]) {
    let query = db
      .updateTable('rate_set_category')
      .set({ deleted_at: new Date() })
      .where('rate_set_id', '=', rateSetId)
      .where('deleted_at', 'is', null);

    if (keepCategoryNumbers.length > 0) {
      query = query.where('category_number', 'not in', keepCategoryNumbers);
    }
    return query.execute();
  },

  async findById(id: number) {
    return db
      .selectFrom('rate_set_category')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  },
};

export default rateSetCategoryRepository;