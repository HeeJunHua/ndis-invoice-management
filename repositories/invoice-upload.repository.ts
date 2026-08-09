import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable, Updateable } from 'kysely';

export type NewUploadBatch = Insertable<DB['invoice_upload_batch']>;
export type NewUploadFile = Insertable<DB['invoice_upload_file']>;
export type UploadFileUpdate = Updateable<DB['invoice_upload_file']>;

const invoiceUploadRepository = {
  async createBatch(input: NewUploadBatch) {
    return db.insertInto('invoice_upload_batch').values(input).returningAll().executeTakeFirstOrThrow();
  },
  async createFile(input: NewUploadFile) {
    return db.insertInto('invoice_upload_file').values(input).returningAll().executeTakeFirstOrThrow();
  },
  async updateFile(id: string, input: UploadFileUpdate) {
    return db
      .updateTable('invoice_upload_file')
      .set({ ...input, updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  },
  async updateBatch(id: string, input: Updateable<DB['invoice_upload_batch']>) {
    return db
      .updateTable('invoice_upload_batch')
      .set({ ...input, updated_at: new Date() })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();
  },
  async listBatches() {
    return db.selectFrom('invoice_upload_batch').selectAll().orderBy('created_at', 'desc').execute();
  },
  async listFilesByBatch(batchId: string) {
    return db.selectFrom('invoice_upload_file').selectAll().where('batch_id', '=', batchId).execute();
  },
  async listInvoiceIdsWithUploads() {
    const rows = await db
      .selectFrom('invoice_upload_file')
      .select('invoice_id')
      .where('invoice_id', 'is not', null)
      .execute();
    return rows.map((r) => r.invoice_id as number);
  },
};
export default invoiceUploadRepository;