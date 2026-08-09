/**
 * System user management — §10.1. email/full_name/role validation per spec;
 * password is set separately via auth (argon2 hash), not part of this service.
 */
import argon2 from 'argon2';
import userRepository, { type NewAppUser, type AppUserUpdate } from '@/repositories/user.repository';
import userRoleRepository from '@/repositories/user-role.repository';
import authPasswordRepository from '@/repositories/auth-password.repository';
import rbacRepository from '@/repositories/rbac.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import clientRepository from '@/repositories/client.repository';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface UserInput {
  email?: unknown;
  full_name?: unknown;
  role_id?: unknown;
  password?: unknown;
}

function validate(input: UserInput, { partial = false } = {}) {
  const details: Record<string, string[]> = {};
  const email = typeof input.email === 'string' ? input.email.trim() : '';
  if (!partial || input.email !== undefined) {
    if (!email || !EMAIL_REGEX.test(email)) details.email = ['A valid email address is required'];
  }
  const fullName = typeof input.full_name === 'string' ? input.full_name.trim() : '';
  if (!partial || input.full_name !== undefined) {
    if (!fullName) details.full_name = ['Full name is required'];
  }
  if (!partial || input.role_id !== undefined) {
    if (typeof input.role_id !== 'number') details.role_id = ['Role is required'];
  }
  return {
    valid: Object.keys(details).length === 0,
    details,
    normalized: { email, full_name: fullName, role_id: input.role_id as number },
  };
}

const userService = {
  async list() {
    const users = await userRepository.list();
    return Promise.all(users.map(async (u) => ({ ...u, role: await userRoleRepository.getRoleForUser(u.id) })));
  },

  async getById(id: number) {
    const user = await userRepository.findById(id);
    if (!user) throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    const role = await userRoleRepository.getRoleForUser(id);
    return { ...user, role };
  },

  async create(input: UserInput) {
    const { valid, details, normalized } = validate(input);
    if (!valid) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, details);

    const existing = await userRepository.findByEmail(normalized.email);
    if (existing) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, {
        email: ['Email is already in use'],
      });
    }

    const roles = await rbacRepository.listAllRoles();
    if (!roles.some((r) => r.id === normalized.role_id)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, {
        role_id: ['Role does not exist'],
      });
    }

    const password = typeof input.password === 'string' && input.password.length >= 8 ? input.password : null;
    if (!password) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, {
        password: ['Password is required and must be at least 8 characters'],
      });
    }

    const user = await userRepository.create({ email: normalized.email, full_name: normalized.full_name } as NewAppUser);
    const passwordHash = await argon2.hash(password);
    await authPasswordRepository.create({ user_id: user.id, password_hash: passwordHash });
    await userRoleRepository.setRole(user.id, normalized.role_id);

    return this.getById(user.id);
  },

  async update(id: number, input: UserInput) {
    await this.getById(id);
    const { valid, details, normalized } = validate(input, { partial: true });
    if (!valid) throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, details);

    if (input.email !== undefined) {
      const existing = await userRepository.findByEmail(normalized.email);
      if (existing && existing.id !== id) {
        throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, {
          email: ['Email is already in use'],
        });
      }
    }

    const update: AppUserUpdate = {};
    if (input.email !== undefined) update.email = normalized.email;
    if (input.full_name !== undefined) update.full_name = normalized.full_name;
    await userRepository.update(id, update);

    if (input.role_id !== undefined) {
      await userRoleRepository.setRole(id, normalized.role_id);
    }

    return this.getById(id);
  },

  async setStatus(id: number, active: boolean) {
    await this.getById(id);
    await userRepository.update(id, {
      deactivated_at: active ? null : new Date(),
    });
    return this.getById(id);
  },

  async changeOwnPassword(userId: number, newPassword: string) {
    if (newPassword.length < 8) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, {
        password: ['Password must be at least 8 characters'],
      });
    }
    const hash = await argon2.hash(newPassword);
    await authPasswordRepository.updateHash(userId, hash);
  },

  async delete(id: number) {
    const existing = await this.getById(id); 
    await userRepository.softDelete(id); 
    return existing;
  },
};
export default userService;