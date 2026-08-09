/**
 * Invoice service — §9.3, full implementation.
 * rate_set_id and max_rate are ALWAYS derived server-side from date-range
 * matching (never trusted from client input) — category_id and support_item_id
 * remain user-selected but are validated to belong to the matched rate set.
 * This is the "backend is sole source of truth" rule from §12/§9.3 in practice.
 */
import { db } from '@/db';
import BigNumber from 'bignumber.js';
import invoiceRepository, { type NewInvoice, type InvoiceUpdate } from '@/repositories/invoice.repository';
import invoiceItemRepository, { type NewInvoiceItem } from '@/repositories/invoice-item.repository';
import clientRepository from '@/repositories/client.repository';
import providerRepository from '@/repositories/provider.repository';
import rateSetRepository from '@/repositories/rate-set.repository';
import rateSetCategoryRepository from '@/repositories/rate-set-category.repository';
import rateSetSupportItemRepository from '@/repositories/rate-set-support-item.repository';
import rateSetSupportItemPriceRepository from '@/repositories/rate-set-support-item-price.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import invoiceUploadRepository from '@/repositories/invoice-upload.repository';

export interface InvoiceItemInput {
  category_id?: unknown;
  support_item_id?: unknown;
  start_date?: unknown;
  end_date?: unknown;
  unit?: unknown;
  input_rate?: unknown;
}

export interface InvoiceInput {
  client_id?: unknown;
  provider_id?: unknown;
  invoice_number?: unknown;
  invoice_date?: unknown;
  expected_amount?: unknown;
  status?: unknown;
  items?: InvoiceItemInput[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Structural checks only (types/presence) — DB-dependent matching happens
 * separately in resolveItem(), since that needs async calls. */
function validateItemShape(item: InvoiceItemInput, index: number, strict: boolean) {
  const details: Record<string, string[]> = {};
  const prefix = `items[${index}]`;

  if (strict || item.category_id !== undefined) {
    if (typeof item.category_id !== 'number') details[`${prefix}.category_id`] = ['Category is required'];
  }
  if (strict || item.support_item_id !== undefined) {
    if (typeof item.support_item_id !== 'number')
      details[`${prefix}.support_item_id`] = ['Support item is required'];
  }
  if (strict || item.start_date !== undefined) {
    if (!item.start_date || typeof item.start_date !== 'string' || Number.isNaN(Date.parse(item.start_date))) {
      details[`${prefix}.start_date`] = ['Start date is required'];
    }
  }
  if (strict || item.end_date !== undefined) {
    if (!item.end_date || typeof item.end_date !== 'string' || Number.isNaN(Date.parse(item.end_date))) {
      details[`${prefix}.end_date`] = ['End date is required'];
    }
  }
  const unit = typeof item.unit === 'number' ? item.unit : Number(item.unit);
  if (strict || item.unit !== undefined) {
    if (Number.isNaN(unit)) details[`${prefix}.unit`] = ['Unit is required and must be a decimal'];
  }
  const inputRate = typeof item.input_rate === 'number' ? item.input_rate : Number(item.input_rate);
  if (strict || item.input_rate !== undefined) {
    if (Number.isNaN(inputRate)) details[`${prefix}.input_rate`] = ['Input rate is required and must be a decimal'];
  }

  return { details, unit, inputRate };
}

interface ResolvedItem {
  rate_set_id: number | null;
  category_id: number | null;
  support_item_id: number | null;
  start_date: string | null;
  end_date: string | null;
  max_rate: number | null;
  unit: number | null;
  input_rate: number | null;
  amount: number | null;
}

/**
 * Resolves one item's rate_set_id (by date overlap), validates category/support
 * item belong to that rate set, and looks up max_rate via price ranking.
 * Only runs the DB-dependent matching when start/end dates are actually
 * present and parseable — if the shape check already failed on dates,
 * matching is skipped to avoid confusing secondary errors.
 */
async function resolveItem(
  item: InvoiceItemInput,
  index: number,
  strict: boolean,
  pricingRegion: string | null,
  shapeErrors: Record<string, string[]>,
  unit: number,
  inputRate: number,
): Promise<{ details: Record<string, string[]>; resolved: ResolvedItem }> {
  const details: Record<string, string[]> = {};
  const prefix = `items[${index}]`;

  const hasDates =
    typeof item.start_date === 'string' &&
    typeof item.end_date === 'string' &&
    !Number.isNaN(Date.parse(item.start_date)) &&
    !Number.isNaN(Date.parse(item.end_date));

  let rateSetId: number | null = null;
  let categoryId: number | null = typeof item.category_id === 'number' ? item.category_id : null;
  let supportItemId: number | null = typeof item.support_item_id === 'number' ? item.support_item_id : null;
  let maxRate: number | null = null;

  if (hasDates) {
    const startDate = item.start_date as string;
    const endDate = item.end_date as string;

    const matches = await rateSetRepository.findOverlapping(startDate, endDate);
    if (matches.length === 0) {
      if (strict) details[`${prefix}.rate_set_id`] = ['No active rate set matches this date range'];
    } else if (matches.length > 1) {
      details[`${prefix}.rate_set_id`] = ['Multiple rate sets match this date range — please narrow it'];
    } else {
      rateSetId = matches[0].id;

      if (categoryId !== null) {
        const category = await rateSetCategoryRepository.findById(categoryId);
        if (!category || category.rate_set_id !== rateSetId) {
          details[`${prefix}.category_id`] = ['Category does not belong to the matched rate set'];
          categoryId = null;
        }
      }

      if (supportItemId !== null) {
        const supportItem = await rateSetSupportItemRepository.findById(supportItemId);
        if (
          !supportItem ||
          supportItem.rate_set_id !== rateSetId ||
          (categoryId !== null && supportItem.category_id !== categoryId)
        ) {
          details[`${prefix}.support_item_id`] = ['Support item does not belong to the matched rate set/category'];
          supportItemId = null;
        }
      }

      if (rateSetId !== null && supportItemId !== null && pricingRegion) {
        const price = await rateSetSupportItemPriceRepository.findBestMatch({
          rateSetId,
          supportItemId,
          pricingRegionCode: pricingRegion,
          startDate,
          endDate,
        });
        if (price?.unit_price != null) {
          maxRate = Number(price.unit_price);
        } else if (strict) {
          details[`${prefix}.max_rate`] = ['No matching price found for this item/date range/pricing region'];
        }
      } else if (strict && !pricingRegion) {
        details[`${prefix}.max_rate`] = ['Client must be set with a valid pricing region to determine max rate'];
      }
    }
  }

  const amount =
    !Number.isNaN(unit) && !Number.isNaN(inputRate) ? round2(unit * inputRate) : null;

  return {
    details: { ...shapeErrors, ...details },
    resolved: {
      rate_set_id: rateSetId,
      category_id: categoryId,
      support_item_id: supportItemId,
      start_date: hasDates ? (item.start_date as string) : null,
      end_date: hasDates ? (item.end_date as string) : null,
      max_rate: maxRate,
      unit: Number.isNaN(unit) ? null : unit,
      input_rate: Number.isNaN(inputRate) ? null : inputRate,
      amount,
    },
  };
}

const invoiceService = {
  async list() {
    return invoiceRepository.list();
  },

  async getById(id: number) {
    const invoice = await invoiceRepository.findById(id);
    if (!invoice) throw new AppError(ErrorCodes.NOT_FOUND, 'Invoice not found', 404);
    const items = await invoiceItemRepository.listByInvoiceId(id);
    return { ...invoice, items };
  },

  async create(input: InvoiceInput) {
    return this.save(null, input);
  },

  async update(id: number, input: InvoiceInput) {
    await this.getById(id);
    return this.save(id, input);
  },

  async save(id: number | null, input: InvoiceInput) {
    const status = input.status === 'completed' ? 'completed' : 'drafted';
    const isCompleted = status === 'completed';
    const details: Record<string, string[]> = {};

    const invoiceNumber = typeof input.invoice_number === 'string' ? input.invoice_number.trim() : '';
    if (!invoiceNumber) details.invoice_number = ['Invoice number is required'];

    const invoiceDate = typeof input.invoice_date === 'string' ? input.invoice_date : '';
    if (!invoiceDate || Number.isNaN(Date.parse(invoiceDate))) {
      details.invoice_date = ['Invoice date is required'];
    }

    const expectedAmount =
      typeof input.expected_amount === 'number' ? input.expected_amount : Number(input.expected_amount);
    if (Number.isNaN(expectedAmount)) {
      details.expected_amount = ['Expected amount is required'];
    }

    const clientId = typeof input.client_id === 'number' ? input.client_id : null;
    const providerId = typeof input.provider_id === 'number' ? input.provider_id : null;
    if (isCompleted && clientId === null) details.client_id = ['Client is required'];
    if (isCompleted && providerId === null) details.provider_id = ['Provider is required'];

    let client = null;
    if (clientId !== null) {
      client = await clientRepository.findById(clientId);
      if (!client) {
        details.client_id = ['Client does not exist'];
      }
    }
    if (providerId !== null) {
      const provider = await providerRepository.findById(providerId);
      if (!provider) {
        details.provider_id = ['Provider does not exist'];
      }
    }

    if (invoiceNumber) {
      const existing = await invoiceRepository.findByProviderAndNumber(providerId, invoiceNumber);
      if (existing && existing.id !== id) {
        details.invoice_number = ['Invoice number is already in use for this provider'];
      }
    }

    // Resolve every item (rate_set matching, category/support-item checks, price lookup).
    const items = Array.isArray(input.items) ? input.items : [];
    const resolvedItems: ResolvedItem[] = [];
    for (let i = 0; i < items.length; i++) {
      const shape = validateItemShape(items[i], i, isCompleted);
      const { details: itemDetails, resolved } = await resolveItem(
        items[i],
        i,
        isCompleted,
        client?.pricing_region ?? null,
        shape.details,
        shape.unit,
        shape.inputRate,
      );
      Object.assign(details, itemDetails);
      resolvedItems.push(resolved);
    }

    if (Object.keys(details).length > 0) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, details);
    }

    let computedBN = new BigNumber(0);
    resolvedItems.forEach(r => {
      computedBN = computedBN.plus(r.amount ?? 0);
    });
    const computedAmountStr = computedBN.toFixed(2);
    const expectedAmountStr = new BigNumber(expectedAmount).toFixed(2);

    if (isCompleted && computedAmountStr !== expectedAmountStr) {
      console.log(`[Invoice Validation Failure] Computed: ${computedAmountStr}, Expected: ${expectedAmountStr}`);
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, {
        expected_amount: ['Expected amount must equal the sum of invoice items'],
      });
    }
    const computedAmount = parseFloat(computedAmountStr);

    return db.transaction().execute(async (trx) => {
      const invoiceValues: NewInvoice | InvoiceUpdate = {
        client_id: clientId,
        provider_id: providerId,
        invoice_number: invoiceNumber,
        invoice_date: invoiceDate,
        expected_amount: String(expectedAmount),
        amount: String(computedAmount),
        status,
      };

      const invoice =
        id === null
          ? await trx.insertInto('invoice').values(invoiceValues as NewInvoice).returningAll().executeTakeFirstOrThrow()
          : await trx
              .updateTable('invoice')
              .set({ ...invoiceValues, updated_at: new Date() })
              .where('id', '=', id)
              .returningAll()
              .executeTakeFirstOrThrow();

      const newItems: NewInvoiceItem[] = resolvedItems.map((r, i) => ({
        invoice_id: invoice.id,
        rate_set_id: r.rate_set_id,
        category_id: r.category_id,
        support_item_id: r.support_item_id,
        start_date: r.start_date,
        end_date: r.end_date,
        max_rate: r.max_rate != null ? String(r.max_rate) : null,
        unit: r.unit != null ? String(r.unit) : null,
        input_rate: r.input_rate != null ? String(r.input_rate) : null,
        amount: r.amount != null ? String(r.amount) : null,
        sort_order: i,
      }));

      const savedItems = await invoiceItemRepository.replaceAll(trx, invoice.id, newItems);
      return { ...invoice, items: savedItems };
    });
  },

  async delete(id: number) {
    await this.getById(id);
    const deleted = await invoiceRepository.softDelete(id);
    if (!deleted) throw new AppError(ErrorCodes.NOT_FOUND, 'Invoice not found', 404);
    return deleted;
  },

  async listForDisplay() {
    const [invoices, uploadedIds] = await Promise.all([
      invoiceRepository.listForDisplay(),
      invoiceUploadRepository.listInvoiceIdsWithUploads(),
    ]);
    const uploadedSet = new Set(uploadedIds);
    return invoices.map((inv) => ({
      ...inv,
      source: uploadedSet.has(inv.id) ? 'uploaded' : 'manual',
    }));
  },
};

export default invoiceService;