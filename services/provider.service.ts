/**
 * Provider service — validation and business rules per §9.2.
 */
import providerRepository, {
  type NewProvider,
  type ProviderUpdate,
} from '@/repositories/provider.repository';
import { AppError, ErrorCodes } from '@/lib/errors';

export interface ProviderInput {
  abn?: unknown;
  name?: unknown;
  email?: unknown;
  phone_number?: unknown;
  address?: unknown;
  unit_building?: unknown;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(input: ProviderInput, { partial = false } = {}) {
  const details: Record<string, string[]> = {};

  const abn = typeof input.abn === 'string' ? input.abn.trim() : '';
  if (!partial || input.abn !== undefined) {
    if (!abn) {
      details.abn = ['ABN is required'];
    } else if (!/^\d{1,11}$/.test(abn)) {
      details.abn = ['ABN must contain digits only, up to 11 digits'];
    }
  }

  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (!partial || input.name !== undefined) {
    if (!name) details.name = ['Name is required'];
  }

  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (!partial || input.email !== undefined) {
    if (!email || !EMAIL_REGEX.test(email)) {
      details.email = ['A valid email address is required'];
    }
  }

  const phoneNumber = typeof input.phone_number === 'string' ? input.phone_number.trim() : '';
  if (input.phone_number !== undefined && input.phone_number !== null && phoneNumber !== '') {
    if (!/^\d{3,16}$/.test(phoneNumber)) {
      details.phone_number = ['Phone number must contain 3–16 digits only'];
    }
  }

  const address = typeof input.address === 'string' ? input.address.trim() : '';
  if (!partial || input.address !== undefined) {
    if (!address) details.address = ['Address is required'];
  }

  const unitBuilding = typeof input.unit_building === 'string' ? input.unit_building.trim() : '';
  if (input.unit_building !== undefined && input.unit_building !== null && input.unit_building !== '') {
    if (!unitBuilding) details.unit_building = ['Unit/building must not be empty if provided'];
  }

  return {
    valid: Object.keys(details).length === 0,
    details,
    normalized: {
      abn,
      name,
      email,
      phone_number: phoneNumber || null,
      address,
      unit_building: unitBuilding || null,
    },
  };
}

const providerService = {
  async list() {
    return providerRepository.list();
  },

  async getById(id: number) {
    const provider = await providerRepository.findById(id);
    if (!provider) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Provider not found', 404);
    }
    return provider;
  },

  async create(input: ProviderInput) {
    const { valid, details, normalized } = validate(input);
    if (!valid) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, details);
    }

    return providerRepository.create(normalized as NewProvider);
  },

  async update(id: number, input: ProviderInput) {
    await this.getById(id);

    const { valid, details, normalized } = validate(input, { partial: true });
    if (!valid) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, details);
    }

    const update: ProviderUpdate = {};
    for (const key of Object.keys(normalized) as (keyof typeof normalized)[]) {
      if (input[key as keyof ProviderInput] !== undefined) {
        (update as Record<string, unknown>)[key] = normalized[key];
      }
    }

    const updated = await providerRepository.update(id, update);
    if (!updated) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Provider not found', 404);
    }
    return updated;
  },

  async setActiveStatus(id: number, active: boolean) {
    await this.getById(id);
    const updated = await providerRepository.setActiveStatus(id, active);
    if (!updated) throw new AppError(ErrorCodes.NOT_FOUND, 'Provider not found', 404);
    return updated;
  },

  async delete(id: number) {
    await this.getById(id);
    const deleted = await providerRepository.softDelete(id);
    if (!deleted) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Provider not found', 404);
    }
    return deleted;
  },
};

export default providerService;