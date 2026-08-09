import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable, Updateable } from 'kysely';
import { sql } from 'kysely';

export type NewRateSet = Insertable<DB['rate_set']>;
export type RateSetUpdate = Updateable<DB['rate_set']>;

const rateSetRepository = {
  async findById(id: number) {
    return db
      .selectFrom('rate_set')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  },

  async list() {
    return db
      .selectFrom('rate_set')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('start_date', 'desc')
      .execute();
  },

  async create(input: NewRateSet) {
    return db.insertInto('rate_set').values(input).returningAll().executeTakeFirstOrThrow();
  },

  async update(id: number, input: RateSetUpdate) {
    return db
      .updateTable('rate_set')
      .set({ ...input, updated_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },

  async softDelete(id: number) {
    return db
      .updateTable('rate_set')
      .set({ deleted_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },


  async findOverlapping(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    return db
      .selectFrom('rate_set')
      .selectAll()
      .where('deleted_at', 'is', null)
      .where('start_date', '<=', end)
      .where((eb) => eb.or([eb('end_date', 'is', null), eb('end_date', '>=', start)]))
      .execute();
  },

  async setActiveStatus(id: number, active: boolean) {
    return db
      .updateTable('rate_set')
      .set({ deactivated_at: active ? null : new Date(), updated_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },
  async getPriceTable(rateSetId: number) {
    return db
      .selectFrom('rate_set_support_item as rssi')
      .leftJoin('rate_set_category as rsc', 'rsc.id', 'rssi.category_id')
      .leftJoin('rate_set_support_item_price as rssip', 'rssip.support_item_id', 'rssi.id')
      .leftJoin('rate_set_support_item_attribute as rssia', 'rssia.support_item_id', 'rssi.id')
      .leftJoin('rate_set_support_item_type as rssit', 'rssit.id', 'rssip.type_id')
      .select([
        'rssi.id',
        'rssi.item_number as support_item_number',
        'rssi.item_name as support_item_name',
        'rsc.category_number as support_category_number',
        'rsc.category_name as support_category_name',
        'rssi.unit',

        sql<string>`MIN(rssip.start_date)`.as('start_date'),
        sql<string>`MAX(rssip.end_date)`.as('end_date'),

        // Type Logic (Assistive Tech / Category 05 shows '-' while other non-AT quotables fallback to 'Quotable Supports')
        sql<string>`
          COALESCE(
            MAX(rssit.label),
            CASE 
              WHEN rsc.category_number IN ('5', '05') OR rssi.item_number LIKE '05_%' THEN NULL
              WHEN BOOL_OR(rssia.attribute_code = 'IS_QUOTE_REQUIRED' AND rssia.value = true) 
              THEN 'Quotable Supports' 
            END
          )
        `.as('type'),

        // Regional Prices
        sql<number>`MAX(CASE WHEN rssip.pricing_region_code = 'ACT' THEN rssip.unit_price END)`.as('act'),
        sql<number>`MAX(CASE WHEN rssip.pricing_region_code = 'NSW' THEN rssip.unit_price END)`.as('nsw'),
        sql<number>`MAX(CASE WHEN rssip.pricing_region_code = 'NT' THEN rssip.unit_price END)`.as('nt'),
        sql<number>`MAX(CASE WHEN rssip.pricing_region_code = 'QLD' THEN rssip.unit_price END)`.as('qld'),
        sql<number>`MAX(CASE WHEN rssip.pricing_region_code = 'SA' THEN rssip.unit_price END)`.as('sa'),
        sql<number>`MAX(CASE WHEN rssip.pricing_region_code = 'TAS' THEN rssip.unit_price END)`.as('tas'),
        sql<number>`MAX(CASE WHEN rssip.pricing_region_code = 'VIC' THEN rssip.unit_price END)`.as('vic'),
        sql<number>`MAX(CASE WHEN rssip.pricing_region_code = 'WA' THEN rssip.unit_price END)`.as('wa'),
        
        // FIXED: Handles 'REMOTE' / 'REM' and 'VERY_REMOTE' / 'VREM'
        sql<number>`MAX(CASE WHEN UPPER(rssip.pricing_region_code) IN ('REM', 'REMOTE') THEN rssip.unit_price END)`.as('remote'),
        sql<number>`MAX(CASE WHEN UPPER(rssip.pricing_region_code) IN ('VREM', 'VERY_REMOTE', 'VERY REMOTE') THEN rssip.unit_price END)`.as('very_remote'),

        // Attributes
        sql<boolean>`COALESCE(BOOL_OR(rssia.attribute_code = 'IS_QUOTE_REQUIRED' AND rssia.value = true), false)`.as('quote'),
        sql<boolean>`COALESCE(BOOL_OR(rssia.attribute_code = 'IS_NF2F_SUPPORT_PROVISION' AND rssia.value = true), false)`.as('non_face_to_face'),
        sql<boolean>`COALESCE(BOOL_OR(rssia.attribute_code = 'IS_PROVIDER_TRAVEL' AND rssia.value = true), false)`.as('provider_travel'),
        sql<boolean>`COALESCE(BOOL_OR(rssia.attribute_code = 'IS_SHORT_NOTICE_CANCEL' AND rssia.value = true), false)`.as('short_notice_cancellations'),
        sql<boolean>`COALESCE(BOOL_OR(rssia.attribute_code = 'IS_NDIA_REQUESTED_REPORTS' AND rssia.value = true), false)`.as('ndia_requested_reports'),
        sql<boolean>`COALESCE(BOOL_OR(rssia.attribute_code = 'IS_IRREGULAR_SIL_SUPPORTS' AND rssia.value = true), false)`.as('irregular_sil_supports'),
      ])
      .where('rssi.rate_set_id', '=', rateSetId)
      .where('rssi.deleted_at', 'is', null)
      .groupBy([
        'rssi.id',
        'rssi.item_number',
        'rssi.item_name',
        'rsc.category_number',
        'rsc.category_name',
        'rssi.unit',
      ])
      .orderBy('rssi.sorting', 'asc')
      .orderBy('rssi.item_number', 'asc')
      .execute();
  }
};

export default rateSetRepository;