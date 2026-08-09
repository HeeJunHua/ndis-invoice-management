import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS btree_gist`.execute(db);

  await db.schema
    .createTable('rate_set')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('start_date', 'timestamptz', (col) => col.notNull())
    .addColumn('end_date', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deactivated_at', 'timestamptz')
    .addColumn('deleted_at', 'timestamptz')
    .addCheckConstraint(
      'rate_set_valid_range_chk',
      sql`end_date IS NULL OR start_date <= end_date`,
    )
    .execute();

  await sql`
    ALTER TABLE rate_set
    ADD CONSTRAINT rate_set_no_overlap_excl
    EXCLUDE USING gist (
      tstzrange(start_date, coalesce(end_date, 'infinity'::timestamptz), '[]') WITH &&
    )
    WHERE (deleted_at IS NULL)
  `.execute(db);

  await db.schema
    .createTable('rate_set_category')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('rate_set_id', 'integer', (col) => col.notNull().references('rate_set.id'))
    .addColumn('category_number', 'text', (col) => col.notNull())
    .addColumn('category_name', 'text', (col) => col.notNull())
    .addColumn('sorting', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deactivated_at', 'timestamptz')
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('rsc_unique1_idx')
    .on('rate_set_category')
    .columns(['rate_set_id', 'category_number'])
    .unique()
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();

  await db.schema
    .createIndex('rsc_category_id')
    .on('rate_set_category')
    .column('rate_set_id')
    .execute();

  await db.schema
    .createTable('rate_set_support_item')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('rate_set_id', 'integer', (col) => col.notNull().references('rate_set.id'))
    .addColumn('category_id', 'integer', (col) =>
      col.notNull().references('rate_set_category.id'),
    )
    .addColumn('item_number', 'text', (col) => col.notNull())
    .addColumn('item_name', 'text', (col) => col.notNull())
    .addColumn('unit', 'text')
    .addColumn('sorting', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deactivated_at', 'timestamptz')
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('rssi_unique1_idx')
    .on('rate_set_support_item')
    .columns(['rate_set_id', 'category_id', 'item_number'])
    .unique()
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();

  await db.schema
    .createIndex('rssi_rate_set_id')
    .on('rate_set_support_item')
    .column('rate_set_id')
    .execute();

  await db.schema
    .createIndex('rssi_category_id')
    .on('rate_set_support_item')
    .column('category_id')
    .execute();

  await db.schema
    .createTable('rate_set_support_item_attribute_type')
    .addColumn('code', 'text', (col) => col.primaryKey())
    .addColumn('label', 'text', (col) => col.notNull().unique())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deactivated_at', 'timestamptz')
    .execute();

  await db.schema
    .createTable('rate_set_support_item_attribute')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('support_item_id', 'integer', (col) =>
      col.notNull().references('rate_set_support_item.id'),
    )
    .addColumn('attribute_code', 'text', (col) =>
      col.notNull().references('rate_set_support_item_attribute_type.code'),
    )
    .addColumn('value', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('rssia_support_item_attribute_code_uq', [
      'support_item_id',
      'attribute_code',
    ])
    .execute();

  await db.schema
    .createIndex('rssia_category_support_item_id')
    .on('rate_set_support_item_attribute')
    .column('support_item_id')
    .execute();

  await db.schema
    .createIndex('rssia_attribute_code')
    .on('rate_set_support_item_attribute')
    .column('attribute_code')
    .execute();

  await db.schema
    .createTable('rate_set_support_item_type')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('code', 'text', (col) => col.notNull().unique())
    .addColumn('label', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deactivated_at', 'timestamptz')
    .execute();

  await db.schema
    .createTable('rate_set_support_item_pricing_region')
    .addColumn('code', 'text', (col) => col.primaryKey())
    .addColumn('label', 'text', (col) => col.notNull().unique())
    .addColumn('full_label', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deactivated_at', 'timestamptz')
    .execute();

  await db.schema
    .createTable('rate_set_support_item_price')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('rate_set_id', 'integer', (col) => col.notNull().references('rate_set.id'))
    .addColumn('support_item_id', 'integer', (col) =>
      col.notNull().references('rate_set_support_item.id'),
    )
    .addColumn('type_id', 'integer', (col) => col.references('rate_set_support_item_type.id'))
    .addColumn('pricing_region_code', 'text', (col) =>
      col.references('rate_set_support_item_pricing_region.code'),
    )
    .addColumn('unit_price', sql`numeric(24, 4)`)
    .addColumn('start_date', 'timestamptz', (col) => col.notNull())
    .addColumn('end_date', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addUniqueConstraint('rssip_unique_uq', [
      'rate_set_id',
      'support_item_id',
      'type_id',
      'pricing_region_code',
      'start_date',
      'end_date',
    ])
    .execute();

  await db.schema
    .createIndex('rssip_category_support_item_id')
    .on('rate_set_support_item_price')
    .column('support_item_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('rate_set_support_item_price').execute();
  await db.schema.dropTable('rate_set_support_item_pricing_region').execute();
  await db.schema.dropTable('rate_set_support_item_type').execute();
  await db.schema.dropTable('rate_set_support_item_attribute').execute();
  await db.schema.dropTable('rate_set_support_item_attribute_type').execute();
  await db.schema.dropTable('rate_set_support_item').execute();
  await db.schema.dropTable('rate_set_category').execute();
  await db.schema.dropTable('rate_set').execute();
}