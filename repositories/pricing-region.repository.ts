import { db } from '@/db';

const pricingRegionRepository = {
  async findByCode(code: string) {
    return db
      .selectFrom('rate_set_support_item_pricing_region')
      .selectAll()
      .where('code', '=', code)
      .where('deactivated_at', 'is', null)
      .executeTakeFirst();
  },

  async upsert(code: string, label: string, fullLabel: string) {
    return db
      .insertInto('rate_set_support_item_pricing_region')
      .values({ code, label, full_label: fullLabel })
      .onConflict((oc) => oc.column('code').doUpdateSet({ label, full_label: fullLabel }))
      .execute();
  },

  async list() {
    return db
      .selectFrom('rate_set_support_item_pricing_region')
      .selectAll()
      .where('deactivated_at', 'is', null)
      .orderBy('code')
      .execute();
  },

  async softDelete(code: string) {
    return db
      .updateTable('rate_set_support_item_pricing_region')
      .set({ deactivated_at: new Date() })
      .where('code', '=', code)
      .where('deactivated_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },
};

export default pricingRegionRepository;