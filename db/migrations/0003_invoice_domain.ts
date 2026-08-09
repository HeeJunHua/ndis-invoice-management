import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('invoice')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('client_id', 'integer', (col) => col.references('client.id'))
    .addColumn('provider_id', 'integer', (col) => col.references('provider.id'))
    .addColumn('invoice_number', 'text')
    .addColumn('invoice_date', 'date')
    .addColumn('amount', sql`numeric(24, 4)`)
    .addColumn('expected_amount', sql`numeric(24, 4)`)
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('drafted'))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .addCheckConstraint(
      'invoice_number_trimmed',
      sql`invoice_number IS NULL OR invoice_number = btrim(invoice_number)`,
    )
    .addCheckConstraint('invoice_status_chk', sql`status IN ('drafted', 'completed')`)
    .execute();

  // Functional/partial-unique indexes need raw SQL — Kysely's index builder
  // doesn't support lower()/composite WHERE clauses like these directly.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS invoice_unique_provider_invoice_number
    ON invoice (provider_id, lower(invoice_number))
    WHERE deleted_at IS NULL
      AND provider_id IS NOT NULL
      AND invoice_number IS NOT NULL
  `.execute(db);

  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS invoice_unique_unmapped_invoice_number
    ON invoice (lower(invoice_number))
    WHERE deleted_at IS NULL
      AND provider_id IS NULL
      AND invoice_number IS NOT NULL
  `.execute(db);

  await db.schema.createIndex('invoice_client_id').on('invoice').column('client_id').execute();
  await db.schema.createIndex('invoice_provider_id').on('invoice').column('provider_id').execute();

  await db.schema
    .createTable('invoice_item')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('invoice_id', 'integer', (col) => col.notNull().references('invoice.id'))
    .addColumn('rate_set_id', 'integer', (col) => col.references('rate_set.id'))
    .addColumn('category_id', 'integer', (col) => col.references('rate_set_category.id'))
    .addColumn('support_item_id', 'integer', (col) =>
      col.references('rate_set_support_item.id'),
    )
    .addColumn('start_date', 'timestamptz')
    .addColumn('end_date', 'timestamptz')
    .addColumn('max_rate', sql`numeric(24, 4)`)
    .addColumn('unit', sql`numeric(24, 4)`)
    .addColumn('input_rate', sql`numeric(24, 4)`)
    .addColumn('amount', sql`numeric(24, 4)`)
    .addColumn('sort_order', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await db.schema.createIndex('invoice_item_invoice_id').on('invoice_item').column('invoice_id').execute();
  await db.schema
    .createIndex('invoice_item_invoice_sort_order')
    .on('invoice_item')
    .columns(['invoice_id', 'sort_order', 'id'])
    .execute();
  await db.schema.createIndex('invoice_item_rate_set_id').on('invoice_item').column('rate_set_id').execute();
  await db.schema.createIndex('invoice_item_category_id').on('invoice_item').column('category_id').execute();
  await db.schema
    .createIndex('invoice_item_support_item_id')
    .on('invoice_item')
    .column('support_item_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('invoice_item').execute();
  await db.schema.dropTable('invoice').execute();
}