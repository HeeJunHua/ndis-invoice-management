import { db } from '@/db';

const userRoleRepository = {
  async setRole(userId: number, roleId: number) {
    // A user has one role in this simplified model — remove existing, insert new.
    await db.deleteFrom('rbac_user_role').where('user_id', '=', userId).execute();
    return db.insertInto('rbac_user_role').values({ user_id: userId, role_id: roleId }).execute();
  },
  async getRoleForUser(userId: number) {
    return db
      .selectFrom('rbac_user_role')
      .innerJoin('rbac_role', 'rbac_role.id', 'rbac_user_role.role_id')
      .select(['rbac_role.id', 'rbac_role.code', 'rbac_role.label'])
      .where('rbac_user_role.user_id', '=', userId)
      .executeTakeFirst();
  },
};
export default userRoleRepository;