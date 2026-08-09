import { db } from '@/db';
import type { DB } from '@/db/schema';
import { sql } from 'kysely';

export type SupportItemRow = DB['rate_set_support_item'];

const supportItemRepository = {
  async listForDropdown() {
    return db
      .selectFrom('rate_set_support_item as rssi')
      .leftJoin('rate_set_support_item_price as rssip', 'rssip.support_item_id', 'rssi.id')
      .leftJoin('rate_set_support_item_attribute as rssia', 'rssia.support_item_id', 'rssi.id')
      .select([
        'rssi.id',
        'rssi.category_id',
        'rssi.item_number as support_item_number',
        'rssi.item_name as support_item_name',
        'rssi.unit',
        sql<number | null>`MAX(rssip.unit_price)`.as('max_rate'),
        sql<boolean>`COALESCE(BOOL_OR(rssia.attribute_code = 'IS_QUOTE_REQUIRED' AND rssia.value = true), false)`.as('quote'),
      ])
      .where('rssi.deleted_at', 'is', null)
      .groupBy(['rssi.id', 'rssi.category_id', 'rssi.item_number', 'rssi.item_name', 'rssi.unit'])
      .orderBy('rssi.item_number', 'asc')
      .execute();
  },
};

export default supportItemRepository;