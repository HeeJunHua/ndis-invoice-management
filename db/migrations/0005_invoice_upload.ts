import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('invoice_upload_batch')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('uploaded_by', 'integer', (col) => col.notNull().references('app_user.id'))
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('uploading'))
    .addColumn('file_count', 'integer', (col) => col.notNull())
    .addColumn('total_size', 'bigint', (col) => col.notNull())
    .addColumn('error_message', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint(
      'invoice_upload_batch_status_check',
      sql`status IN ('uploading', 'uploaded', 'processing', 'completed', 'completed_with_errors', 'failed')`,
    )
    .addCheckConstraint('invoice_upload_batch_file_count_chk', sql`file_count BETWEEN 1 AND 20`)
    .addCheckConstraint(
      'invoice_upload_batch_total_size_chk',
      sql`total_size BETWEEN 1 AND 20971520`,
    )
    .execute();

  await db.schema
    .createTable('invoice_upload_file')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('batch_id', 'uuid', (col) =>
      col.notNull().references('invoice_upload_batch.id').onDelete('cascade'),
    )
    .addColumn('original_name', 'text', (col) => col.notNull())
    .addColumn('object_key', 'text', (col) => col.notNull().unique())
    .addColumn('content_type', 'text', (col) => col.notNull())
    .addColumn('size', 'bigint', (col) => col.notNull())
    .addColumn('etag', 'text', (col) => col.notNull())
    .addColumn('processing_status', 'text', (col) => col.notNull().defaultTo('queued'))
    .addColumn('attempt_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('error_message', 'text')
    .addColumn('warnings', 'jsonb', (col) => col.notNull().defaultTo(sql`'[]'::jsonb`))
    .addColumn('extraction_result', 'jsonb')
    .addColumn('invoice_id', 'integer', (col) =>
      col.references('invoice.id').onDelete('set null'),
    )
    .addColumn('ai_provider', 'text')
    .addColumn('model', 'text')
    .addColumn('prompt_tokens', 'integer')
    .addColumn('completion_tokens', 'integer')
    .addColumn('total_tokens', 'integer')
    .addColumn('processing_started_at', 'timestamptz')
    .addColumn('processing_completed_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addCheckConstraint('invoice_upload_file_size_chk', sql`size BETWEEN 1 AND 10485760`)
    .addCheckConstraint(
      'invoice_upload_file_processing_status_check',
      sql`processing_status IN ('queued', 'processing', 'draft_created', 'needs_review', 'failed')`,
    )
    .addCheckConstraint(
      'invoice_upload_file_ai_provider_check',
      sql`ai_provider IS NULL OR ai_provider IN ('openai', 'openrouter')`,
    )
    .execute();

  await db.schema
    .createIndex('invoice_upload_batch_uploaded_by')
    .on('invoice_upload_batch')
    .column('uploaded_by')
    .execute();
  await db.schema
    .createIndex('invoice_upload_file_batch_id')
    .on('invoice_upload_file')
    .column('batch_id')
    .execute();
  await db.schema
    .createIndex('invoice_upload_file_processing_status')
    .on('invoice_upload_file')
    .column('processing_status')
    .execute();
  await db.schema
    .createIndex('invoice_upload_file_invoice_id')
    .on('invoice_upload_file')
    .column('invoice_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('invoice_upload_file').execute();
  await db.schema.dropTable('invoice_upload_batch').execute();
}