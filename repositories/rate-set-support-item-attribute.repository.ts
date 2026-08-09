import { db } from '@/db';

const rateSetSupportItemAttributeRepository = {
  async upsert(supportItemId: number, attributeCode: string, value: boolean) {
    return db
      .insertInto('rate_set_support_item_attribute')
      .values({ support_item_id: supportItemId, attribute_code: attributeCode, value })
      .onConflict((oc) =>
        oc.columns(['support_item_id', 'attribute_code']).doUpdateSet({ value }),
      )
      .execute();
  },
    /**
   * Just the IS_QUOTE_REQUIRED flag per support item in a rate set —
   * used to show the "Quote" column in the price table view.
   */
  async listQuoteFlagsForRateSet(rateSetId: number) {
    return db
      .selectFrom('rate_set_support_item_attribute as a')
      .innerJoin('rate_set_support_item as si', 'si.id', 'a.support_item_id')
      .select(['si.id as support_item_id', 'a.value'])
      .where('si.rate_set_id', '=', rateSetId)
      .where('a.attribute_code', '=', 'IS_QUOTE_REQUIRED')
      .execute();
  },
};

export default rateSetSupportItemAttributeRepository;