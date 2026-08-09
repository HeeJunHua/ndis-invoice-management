/**
 * Repository for the invoice table. Raw data access only.
 */
import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable, Kysely, Transaction, Updateable } from 'kysely';

export type InvoiceRow = DB['invoice'];
export type NewInvoice = Insertable<InvoiceRow>;
export type InvoiceUpdate = Updateable<InvoiceRow>;

const invoiceRepository = {
  async findById(id: number) {
    return db
      .selectFrom('invoice')
      .selectAll()
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .executeTakeFirst();
  },

  async findByProviderAndNumber(providerId: number | null, invoiceNumber: string) {
    let query = db
      .selectFrom('invoice')
      .selectAll()
      .where('deleted_at', 'is', null)
      .where((eb) => eb.fn('lower', ['invoice_number']), '=', invoiceNumber.toLowerCase());

    query = providerId === null
      ? query.where('provider_id', 'is', null)
      : query.where('provider_id', '=', providerId);

    return query.executeTakeFirst();
  },

  async list() {
    return db
      .selectFrom('invoice')
      .selectAll()
      .where('deleted_at', 'is', null)
      .orderBy('created_at', 'desc')
      .execute();
  },

  /**
   * Accepts an optional transaction executor `trx` for atomic multi-table inserts.
   */
  async create(input: NewInvoice, trx?: Transaction<DB> | Kysely<DB>) {
    const client = trx || db;
    return client.insertInto('invoice').values(input).returningAll().executeTakeFirstOrThrow();
  },

  async update(id: number, input: InvoiceUpdate) {
    return db
      .updateTable('invoice')
      .set({ ...input, updated_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },

  async softDelete(id: number) {
    return db
      .updateTable('invoice')
      .set({ deleted_at: new Date() })
      .where('id', '=', id)
      .where('deleted_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },

  /**
   * Denormalized list for the Invoices table: joins client/provider names
   * so the UI doesn't need N+1 lookups. Source (uploaded vs manual) is
   * computed separately in the service layer to avoid a JOIN + GROUP BY
   * that could risk duplicate rows if a batch ever double-references an invoice.
   */
  async listForDisplay() {
    return db
      .selectFrom('invoice')
      .leftJoin('client', 'client.id', 'invoice.client_id')
      .leftJoin('provider', 'provider.id', 'invoice.provider_id')
      .select([
        'invoice.id',
        'invoice.invoice_number',
        'invoice.invoice_date',
        'invoice.amount',
        'invoice.expected_amount',
        'invoice.status',
        'invoice.client_id',
        'invoice.provider_id',
        'invoice.created_at',
        'client.first_name as client_first_name',
        'client.last_name as client_last_name',
        'client.ndis_number as client_ndis_number',
        'provider.name as provider_name',
        'provider.abn as provider_abn',
      ])
      .where('invoice.deleted_at', 'is', null)
      .orderBy('invoice.created_at', 'desc')
      .execute();
  },
};

export default invoiceRepository;