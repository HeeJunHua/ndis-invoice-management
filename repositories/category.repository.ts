import { db } from '@/db';
import type { DB } from '@/db/schema';

export type CategoryRow = DB['rate_set_category'];

const categoryRepository = {
  async list() {
    return db
      .selectFrom('rate_set_category')
      .select(['id', 'category_number', 'category_name'])
      .orderBy('category_number', 'asc')
      .execute();
  },
};

export default categoryRepository;