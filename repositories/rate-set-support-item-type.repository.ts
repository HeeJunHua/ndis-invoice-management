import { db } from '@/db';

const rateSetSupportItemTypeRepository = {
  async upsert(code: string, label: string) {
    return db
      .insertInto('rate_set_support_item_type')
      .values({ code, label })
      .onConflict((oc) => oc.column('code').doUpdateSet({ label }))
      .returningAll()
      .executeTakeFirstOrThrow();
  },
};

export default rateSetSupportItemTypeRepository;