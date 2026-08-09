/**
 * Rate set CRUD service. Validation kept minimal since §9.4 doesn't specify
 * detailed field rules like §9.1/9.2 do — just name/dates being sane.
 */
import rateSetRepository, { type NewRateSet, type RateSetUpdate } from '@/repositories/rate-set.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import rateSetSupportItemPriceRepository from '@/repositories/rate-set-support-item-price.repository';
import rateSetSupportItemAttributeRepository from '@/repositories/rate-set-support-item-attribute.repository';

export interface RateSetInput {
  name?: unknown;
  description?: unknown;
  start_date?: unknown;
  end_date?: unknown;
}

function validate(input: RateSetInput, { partial = false } = {}) {
  const details: Record<string, string[]> = {};

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!partial || input.name !== undefined) {
    if (!name) details.name = ['Name is required'];
  }

  if (!partial || input.start_date !== undefined) {
    if (!input.start_date || typeof input.start_date !== 'string' || Number.isNaN(Date.parse(input.start_date))) {
      details.start_date = ['Start date is required'];
    }
  }

  if (input.end_date !== undefined && input.end_date !== null) {
    if (typeof input.end_date !== 'string' || Number.isNaN(Date.parse(input.end_date))) {
      details.end_date = ['End date must be a valid date'];
    } else if (
      typeof input.start_date === 'string' &&
      new Date(input.end_date) < new Date(input.start_date)
    ) {
      details.end_date = ['End date must not be before start date'];
    }
  }

  return {
    valid: Object.keys(details).length === 0,
    details,
    normalized: {
      name,
      description: typeof input.description === 'string' ? input.description.trim() || null : null,
      start_date: input.start_date as string,
      end_date: (input.end_date as string) ?? null,
    },
  };
}

const rateSetService = {
  async list() {
    return rateSetRepository.list();
  },

  async getById(id: number) {
    const rateSet = await rateSetRepository.findById(id);
    if (!rateSet) throw new AppError(ErrorCodes.NOT_FOUND, 'Rate set not found', 404);
    return rateSet;
  },

  async create(input: RateSetInput) {
    const { valid, details, normalized } = validate(input);
    if (!valid) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, details);
    }
    try {
      return await rateSetRepository.create(normalized as NewRateSet);
    } catch (error) {
      // Catches the rate_set_no_overlap_excl exclusion constraint (overlapping date ranges).
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'One or more fields are invalid.',
        400,
        { start_date: ['This date range overlaps with an existing active rate set'] },
      );
    }
  },

  async update(id: number, input: RateSetInput) {
    await this.getById(id);
    const { valid, details, normalized } = validate(input, { partial: true });
    if (!valid) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, details);
    }

    const update: RateSetUpdate = {};
    for (const key of Object.keys(normalized) as (keyof typeof normalized)[]) {
      if (input[key as keyof RateSetInput] !== undefined) {
        (update as Record<string, unknown>)[key] = normalized[key];
      }
    }

    const updated = await rateSetRepository.update(id, update);
    if (!updated) throw new AppError(ErrorCodes.NOT_FOUND, 'Rate set not found', 404);
    return updated;
  },

  async delete(id: number) {
    await this.getById(id);
    const deleted = await rateSetRepository.softDelete(id);
    if (!deleted) throw new AppError(ErrorCodes.NOT_FOUND, 'Rate set not found', 404);
    return deleted;
  },

  async setActiveStatus(id: number, active: boolean) {
    await this.getById(id);
    const updated = await rateSetRepository.setActiveStatus(id, active);
    if (!updated) throw new AppError(ErrorCodes.NOT_FOUND, 'Rate set not found', 404);
    return updated;
  },

  /**
   * Builds the price table view for a rate set's detail page: one row per
   * (support_item, start_date, end_date, type), with a pricing_region_code
   * -> unit_price map so the frontend can render one column per region.
   */
  async getPriceTable(rateSetId: number) {
    return rateSetRepository.getPriceTable(rateSetId);
  },
};

export default rateSetService;