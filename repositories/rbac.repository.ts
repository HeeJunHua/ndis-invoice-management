/**
 * Repository for RBAC lookups: roles, permissions, and the join tables linking
 * users -> roles -> permissions.
 */
import { db } from '@/db';

const rbacRepository = {
  /**
   * Finds a role by its code (e.g. 'SUPER_ADMIN').
   */
  async findRoleByCode(code: string) {
    return db
      .selectFrom('rbac_role')
      .selectAll()
      .where('code', '=', code)
      .where('deactivated_at', 'is', null)
      .executeTakeFirst();
  },

  /**
   * Lists all roles assigned to a user.
   */
  async listRolesForUser(userId: number) {
    return db
      .selectFrom('rbac_user_role')
      .innerJoin('rbac_role', 'rbac_role.id', 'rbac_user_role.role_id')
      .selectAll('rbac_role')
      .where('rbac_user_role.user_id', '=', userId)
      .where('rbac_role.deactivated_at', 'is', null)
      .execute();
  },

  /**
   * Lists every permission code granted to a given role.
   */
  async listPermissionCodesForRole(roleId: number, executor = db) {
    const rows = await executor
      .selectFrom('rbac_user_role_permission')
      .innerJoin('rbac_permission', 'rbac_permission.id', 'rbac_user_role_permission.permission_id')
      .select('rbac_permission.code')
      .where('rbac_user_role_permission.role_id', '=', roleId)
      .execute();

    return rows.map((r) => r.code);
  },

  /**
   * Checks whether a specific role has a specific permission.
   */
  async roleHasPermission(roleId: number, permissionCode: string) {
    const row = await db
      .selectFrom('rbac_user_role_permission')
      .innerJoin('rbac_permission', 'rbac_permission.id', 'rbac_user_role_permission.permission_id')
      .select('rbac_permission.code')
      .where('rbac_user_role_permission.role_id', '=', roleId)
      .where('rbac_permission.code', '=', permissionCode)
      .executeTakeFirst();

    return row !== undefined;
  },

  /**
   * Lists all permissions in system.
   */
  async listAllPermissions() {
    return db.selectFrom('rbac_permission').selectAll().orderBy('code').execute();
  },

  /**
   * Lists all roles alongside their assigned permission codes array.
   */
  async listAllRoles() {
    const roles = await db.selectFrom('rbac_role').selectAll().orderBy('code').execute();

    return Promise.all(
      roles.map(async (role) => {
        const permissions = await this.listPermissionCodesForRole(role.id);
        return { ...role, permissions };
      })
    );
  },

  /**
   * Syncs permissions for a role in rbac_user_role_permission.
   * Accepts an optional Kysely transaction/executor to participate in caller transactions.
   */
  async syncPermissionsForRole(roleId: number, permissionCodes: string[], executor = db) {
    const runSync = async (trx: typeof db) => {
      // 1. Delete existing assignments
      await trx
        .deleteFrom('rbac_user_role_permission')
        .where('role_id', '=', roleId)
        .execute();

      if (!permissionCodes || permissionCodes.length === 0) return;

      // 2. Resolve permission codes to IDs
      const permissions = await trx
        .selectFrom('rbac_permission')
        .select(['id', 'code'])
        .where('code', 'in', permissionCodes)
        .execute();

      if (permissions.length === 0) return;

      // 3. Batch insert new role-permission links
      const rowsToInsert = permissions.map((p) => ({
        role_id: roleId,
        permission_id: p.id,
      }));

      await trx.insertInto('rbac_user_role_permission').values(rowsToInsert).execute();
    };

    // If already inside a transaction (executor passed), reuse it directly
    if (executor !== db) {
      await runSync(executor);
    } else {
      await db.transaction().execute(async (trx) => {
        await runSync(trx as any);
      });
    }
  },

  async softDeleteRole(id: number) {
    return db
      .updateTable('rbac_role')
      .set({ deactivated_at: new Date() })
      .where('id', '=', id)
      .where('deactivated_at', 'is', null)
      .returningAll()
      .executeTakeFirst();
  },
};

export default rbacRepository;