/**
 * Repository for the invoice_item table. Items are always managed as a
 * whole set per invoice (replace-all-on-save), matching how the brief
 * describes invoice.amount being recalculated from items on every save.
 */
import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable, Transaction, Kysely } from 'kysely';

export type NewInvoiceItem = Insertable<DB['invoice_item']>;
export type InvoiceItemRow = DB['invoice_item'];
export type NewInvoiceItems= Insertable<InvoiceItemRow>;
const invoiceItemRepository = {
  async createMany(items: NewInvoiceItem[], trx?: Transaction<DB> | Kysely<DB>) {
    if (items.length === 0) return [];
    const client = trx || db;
    return client.insertInto('invoice_item').values(items).returningAll().execute();
  },

  async listByInvoiceId(invoiceId: number) {
    return db
      .selectFrom('invoice_item')
      .selectAll()
      .where('invoice_id', '=', invoiceId)
      .where('deleted_at', 'is', null)
      .orderBy('sort_order')
      .execute();
  },

  /**
   * Soft-deletes every existing item for an invoice, then inserts the new
   * set. Called within a transaction by the service so it's atomic with
   * the parent invoice update. Historical invoice_item rows are preserved
   * (soft delete), never hard-deleted, per the project's deletion strategy.
   */
  async replaceAll(trx: Transaction<DB>, invoiceId: number, items: NewInvoiceItem[]) {
    await trx
      .updateTable('invoice_item')
      .set({ deleted_at: new Date() })
      .where('invoice_id', '=', invoiceId)
      .where('deleted_at', 'is', null)
      .execute();

    if (items.length === 0) return [];

    return trx.insertInto('invoice_item').values(items).returningAll().execute();
  },
};

export default invoiceItemRepository;