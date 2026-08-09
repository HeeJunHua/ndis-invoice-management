/**
 * Gender service — management of gender lookup codes.
 */
import genderRepository from '@/repositories/gender.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { DB } from '@/db/schema';
import type { Insertable, Updateable } from 'kysely';

export interface GenderInput {
  code?: unknown;
  label?: unknown;
  deactivated_at?: unknown;
}

function validate(input: GenderInput, { partial = false } = {}) {
  const details: Record<string, string[]> = {};

  const code = typeof input.code === 'string' ? input.code.trim().toUpperCase() : '';
  if (!partial || input.code !== undefined) {
    if (!code) details.code = ['Code is required'];
    if (code && code.length > 20) details.code = ['Code must be 20 characters or fewer'];
  }

  const label = typeof input.label === 'string' ? input.label.trim() : '';
  if (!partial || input.label !== undefined) {
    if (!label) details.label = ['Label is required'];
  }

  let deactivated_at: Date | null | undefined = undefined;
  if (input.deactivated_at !== undefined) {
    if (input.deactivated_at === null || input.deactivated_at === '') {
      deactivated_at = null;
    } else if (typeof input.deactivated_at === 'string') {
      deactivated_at = new Date(input.deactivated_at);
    } else if (input.deactivated_at instanceof Date) {
      deactivated_at = input.deactivated_at;
    }
  }

  return {
    valid: Object.keys(details).length === 0,
    details,
    normalized: { code, label, deactivated_at },
  };
}

const genderService = {
  async list() {
    return genderRepository.list();
  },

  async getById(id: number) {
    const gender = await genderRepository.findById(id);
    if (!gender) throw new AppError(ErrorCodes.NOT_FOUND, 'Gender not found', 404);
    return gender;
  },

  async create(input: GenderInput) {
    const { valid, details, normalized } = validate(input);
    if (!valid) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, details);
    }

    const insertData: Insertable<DB['gender']> = {
      code: normalized.code,
      label: normalized.label,
      deactivated_at: normalized.deactivated_at ?? null,
    };

    return genderRepository.create(insertData);
  },

  async update(id: number, input: GenderInput) {
    await this.getById(id);
    const { valid, details, normalized } = validate(input, { partial: true });
    if (!valid) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, details);
    }

    const update: Updateable<DB['gender']> = {};

    if (input.code !== undefined) update.code = normalized.code;
    if (input.label !== undefined) update.label = normalized.label;
    if (input.deactivated_at !== undefined) update.deactivated_at = normalized.deactivated_at;

    const updated = await genderRepository.update(id, update);
    if (!updated) throw new AppError(ErrorCodes.NOT_FOUND, 'Gender not found', 404);
    return updated;
  },

  async delete(id: number) {
    await this.getById(id);
    const deleted = await genderRepository.softDelete(id);
    if (!deleted) throw new AppError(ErrorCodes.NOT_FOUND, 'Gender not found', 404);
    return deleted;
  },

  async setGenderStatus(id: number, active: boolean) {
    await this.getById(id);
    const update: Updateable<DB['gender']> = {
      deactivated_at: active ? null : new Date(),
    };
    const updated = await genderRepository.update(id, update);
    if (!updated) throw new AppError(ErrorCodes.NOT_FOUND, 'Gender not found', 404);
    return updated;
  },
};

export default genderService;