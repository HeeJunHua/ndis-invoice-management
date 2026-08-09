import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable } from 'kysely';
import { sql } from 'kysely';

export type NewRateSetSupportItemPrice = Insertable<DB['rate_set_support_item_price']>;

const rateSetSupportItemPriceRepository = {
  async upsert(input: NewRateSetSupportItemPrice) {
    return db
      .insertInto('rate_set_support_item_price')
      .values(input)
      .onConflict((oc) =>
        oc
          .columns(['rate_set_id', 'support_item_id', 'type_id', 'pricing_region_code', 'start_date', 'end_date'])
          .doUpdateSet({ unit_price: input.unit_price, updated_at: new Date() }),
      )
      .execute();
  },

  async findBestMatch(params: {
    rateSetId: number;
    supportItemId: number;
    pricingRegionCode: string;
    startDate: string;
    endDate: string;
  }) {
    const start = new Date(params.startDate);
    const end = new Date(params.endDate);
    return db
      .selectFrom('rate_set_support_item_price')
      .selectAll()
      .where('rate_set_id', '=', params.rateSetId)
      .where('support_item_id', '=', params.supportItemId)
      .where('pricing_region_code', '=', params.pricingRegionCode)
      .where('start_date', '<=', end)
      .where((eb) => eb.or([eb('end_date', 'is', null), eb('end_date', '>=', start)]))
      .orderBy(sql`start_date desc`)
      .orderBy(sql`end_date desc nulls last`)
      .orderBy(sql`id desc`)
      .executeTakeFirst();
  },
  async listForRateSet(rateSetId: number) {
    return db
      .selectFrom('rate_set_support_item_price as p')
      .innerJoin('rate_set_support_item as si', 'si.id', 'p.support_item_id')
      .innerJoin('rate_set_category as c', 'c.id', 'si.category_id')
      .leftJoin('rate_set_support_item_type as t', 't.id', 'p.type_id')
      .select([
        'si.id as support_item_id',
        'si.item_number',
        'si.item_name',
        'si.unit',
        'c.category_number',
        'c.category_name',
        'p.start_date',
        'p.end_date',
        'p.pricing_region_code',
        'p.unit_price',
        't.label as type_label',
      ])
      .where('p.rate_set_id', '=', rateSetId)
      .where('si.deleted_at', 'is', null)
      .execute();
  },
};

export default rateSetSupportItemPriceRepository;