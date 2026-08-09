/**
 * Client (participant) service — validation and business rules per §9.1.
 * Repositories stay dumb; this is the single source of truth for what makes
 * a valid client record.
 */
import clientRepository, { type NewClient, type ClientUpdate } from '@/repositories/client.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import genderRepository from '@/repositories/gender.repository';

export interface ClientInput {
  first_name?: unknown;
  last_name?: unknown;
  gender_id?: unknown;
  dob?: unknown;
  ndis_number?: unknown;
  email?: unknown;
  phone_number?: unknown;
  address?: unknown;
  unit_building?: unknown;
  pricing_region?: unknown;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates raw input per §9.1's rules. Returns { valid, details } — details
 * is a field->messages map matching the brief's error response shape (§13.4).
 * Used for both create and update (update only checks fields that are present).
 */
function validate(input: ClientInput, { partial = false } = {}) {
  const details: Record<string, string[]> = {};

  const firstName = typeof input.first_name === 'string' ? input.first_name.trim() : '';
  if (!partial || input.first_name !== undefined) {
    if (!firstName) details.first_name = ['First name is required'];
  }

  const lastName = typeof input.last_name === 'string' ? input.last_name.trim() : '';
  if (!partial || input.last_name !== undefined) {
    if (!lastName) details.last_name = ['Last name is required'];
  }

  if (!partial || input.gender_id !== undefined) {
    if (typeof input.gender_id !== 'number') {
      details.gender_id = ['Gender is required'];
    }
  }

  if (!partial || input.dob !== undefined) {
    if (!input.dob || typeof input.dob !== 'string' || Number.isNaN(Date.parse(input.dob))) {
      details.dob = ['Date of birth is required'];
    }
  }

  const ndisNumber = typeof input.ndis_number === 'string' ? input.ndis_number.trim() : '';
  if (!partial || input.ndis_number !== undefined) {
    if (!ndisNumber) {
      details.ndis_number = ['NDIS number is required'];
    } else if (!/^\d{1,16}$/.test(ndisNumber)) {
      details.ndis_number = ['NDIS number must contain digits only, up to 16 digits'];
    }
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

  const pricingRegion = typeof input.pricing_region === 'string' ? input.pricing_region.trim() : '';
  if (!partial || input.pricing_region !== undefined) {
    if (!pricingRegion) details.pricing_region = ['Pricing region is required'];
  }

  return {
    valid: Object.keys(details).length === 0,
    details,
    normalized: {
      first_name: firstName,
      last_name: lastName,
      gender_id: input.gender_id as number,
      dob: input.dob as string,
      ndis_number: ndisNumber,
      email,
      phone_number: phoneNumber || null,
      address,
      unit_building: unitBuilding || null,
      pricing_region: pricingRegion,
    },
  };
}

const clientService = {
  async list() {
    return clientRepository.list();
  },

  async getById(id: number) {
    const client = await clientRepository.findById(id);
    if (!client) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Client not found', 404);
    }
    return client;
  },

  async create(input: ClientInput) {
    const { valid, details, normalized } = validate(input);
    if (!valid) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, details);
    }

    const gender = await genderRepository.findById(normalized.gender_id);
    if (!gender) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'One or more fields are invalid.',
        400,
        { gender_id: ['Gender does not exist'] },
      );
    }

    const existing = await clientRepository.findByNdisNumber(normalized.ndis_number);
    if (existing) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'One or more fields are invalid.',
        400,
        { ndis_number: ['NDIS number is already in use'] },
      );
    }

    return clientRepository.create(normalized as NewClient);
  },

  async update(id: number, input: ClientInput) {
    await this.getById(id); // throws 404 if missing

    const { valid, details, normalized } = validate(input, { partial: true });
    if (!valid) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, details);
    }
    if (input.gender_id !== undefined) {
      const gender = await genderRepository.findById(normalized.gender_id);
      if (!gender) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'One or more fields are invalid.',
          400,
          { gender_id: ['Gender does not exist'] },
        );
      }
    }

    if (input.ndis_number !== undefined) {
      const existing = await clientRepository.findByNdisNumber(normalized.ndis_number);
      if (existing && existing.id !== id) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'One or more fields are invalid.',
          400,
          { ndis_number: ['NDIS number is already in use'] },
        );
      }
    }

    // Only pass through fields that were actually provided, for partial update.
    const update: ClientUpdate = {};
    for (const key of Object.keys(normalized) as (keyof typeof normalized)[]) {
      if (input[key as keyof ClientInput] !== undefined) {
        (update as Record<string, unknown>)[key] = normalized[key];
      }
    }

    const updated = await clientRepository.update(id, update);
    if (!updated) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Client not found', 404);
    }
    return updated;
  },
  async setActiveStatus(id: number, active: boolean) {
    await this.getById(id); // 404s if missing
    const updated = await clientRepository.setActiveStatus(id, active);
    if (!updated) throw new AppError(ErrorCodes.NOT_FOUND, 'Client not found', 404);
    return updated;
  },

  async delete(id: number) {
    const existing = await this.getById(id); // reuses existing 404 check
    await clientRepository.softDelete(id); // swap repo name per file
    return existing;
  },
};
export default clientService;