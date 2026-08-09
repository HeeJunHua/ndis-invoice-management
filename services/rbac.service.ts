/**
 * RBAC service — management of roles and permissions.
 */
import { db } from '@/db';
import rbacRepository from '@/repositories/rbac.repository';
import { AppError, ErrorCodes } from '@/lib/errors';
import type { DB } from '@/db/schema';
import type { Insertable, Updateable } from 'kysely';

export interface RoleInput {
  code?: unknown;
  label?: unknown;
  deactivated_at?: unknown;
  permissions?: unknown; // Array of permission codes, e.g. ['audit_logs.read']
}

function validate(input: RoleInput, { partial = false } = {}) {
  const details: Record<string, string[]> = {};

  const code = typeof input.code === 'string' ? input.code.trim().toUpperCase() : '';
  if (!partial || input.code !== undefined) {
    if (!code) details.code = ['Code is required'];
  }

  const label = typeof input.label === 'string' ? input.label.trim() : '';
  if (!partial || input.label !== undefined) {
    if (!label) details.label = ['Label is required'];
  }

  const permissions = Array.isArray(input.permissions)
    ? (input.permissions.filter((p) => typeof p === 'string') as string[])
    : undefined;

  let deactivated_at: Date | null | undefined = undefined;
  if (input.deactivated_at !== undefined) {
    if (input.deactivated_at === null || input.deactivated_at === '') {
      deactivated_at = null;
    } else if (typeof input.deactivated_at === 'string') {
      deactivated_at = new Date(input.deactivated_at);
    }
  }

  return {
    valid: Object.keys(details).length === 0,
    details,
    normalized: {
      code,
      label,
      deactivated_at,
      permissions,
    },
  };
}

const rbacService = {
  async listRoles() {
    return rbacRepository.listAllRoles();
  },

  async getRoleById(id: number) {
    const role = await db
      .selectFrom('rbac_role')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!role) throw new AppError(ErrorCodes.NOT_FOUND, 'Role not found', 404);

    const permissions = await rbacRepository.listPermissionCodesForRole(id);
    return { ...role, permissions };
  },

  async createRole(input: RoleInput) {
    const { valid, details, normalized } = validate(input);
    if (!valid) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'One or more fields are invalid.',
        400,
        details
      );
    }

    // Explicitly construct valid database columns only
    const insertPayload: Insertable<DB['rbac_role']> = {
      code: normalized.code,
      label: normalized.label,
    };

    if (normalized.deactivated_at !== undefined) {
      insertPayload.deactivated_at = normalized.deactivated_at;
    }

    // Execute role insertion and permission syncing in a single transaction
    const newRoleId = await db.transaction().execute(async (trx) => {
      const newRole = await trx
        .insertInto('rbac_role')
        .values(insertPayload)
        .returningAll()
        .executeTakeFirstOrThrow();

      if (normalized.permissions && normalized.permissions.length > 0) {
        // Pass `trx` here so it reuses the SAME active database transaction
        await rbacRepository.syncPermissionsForRole(newRole.id, normalized.permissions, trx as any);
      }

      return newRole.id;
    });

    return this.getRoleById(newRoleId);
  },

  async updateRole(id: number, input: RoleInput) {
    await this.getRoleById(id);
    const { valid, details, normalized } = validate(input, { partial: true });
    if (!valid) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, details);
    }

    // Explicitly construct update fields
    const updatePayload: Updateable<DB['rbac_role']> = {};
    if (input.code !== undefined) updatePayload.code = normalized.code;
    if (input.label !== undefined) updatePayload.label = normalized.label;
    if (input.deactivated_at !== undefined) updatePayload.deactivated_at = normalized.deactivated_at;

    await db.transaction().execute(async (trx) => {
      if (Object.keys(updatePayload).length > 0) {
        await trx
          .updateTable('rbac_role')
          .set(updatePayload)
          .where('id', '=', id)
          .execute();
      }

      // Sync permissions if provided in payload
      if (normalized.permissions !== undefined) {
        await rbacRepository.syncPermissionsForRole(id, normalized.permissions, trx as any);
      }
    });

    return this.getRoleById(id);
  },

  async setStatus(id: number, active: boolean) {
    await this.getRoleById(id);
    await db
      .updateTable('rbac_role')
      .set({ deactivated_at: active ? null : new Date() })
      .where('id', '=', id)
      .execute();
    return this.getRoleById(id);
  },

  async deleteRole(id: number) {
    await this.getRoleById(id);
    const deleted = await rbacRepository.softDeleteRole(id);
    if (!deleted) throw new AppError(ErrorCodes.NOT_FOUND, 'Role not found', 404);
    return deleted;
  },
};

export default rbacService;