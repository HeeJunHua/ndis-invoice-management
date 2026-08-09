import { db } from '@/db';
import type { DB } from '@/db/schema';
import type { Insertable } from 'kysely';

export type NewAuditLog = Insertable<DB['audit_log']>;

const auditLogRepository = {
  async create(input: NewAuditLog) {
    return db.insertInto('audit_log').values(input).execute();
  },

  async list() {
    const records = await db
      .selectFrom('audit_log')
      .leftJoin('app_user', 'app_user.id', 'audit_log.actor_user_id')
      .leftJoin('rbac_role', 'rbac_role.id', 'audit_log.actor_role_id')
      .select([
        'audit_log.id',
        'audit_log.actor_user_id',
        'audit_log.actor_role_id',
        'audit_log.action',
        'audit_log.permission_code',
        'audit_log.entity',
        'audit_log.entity_id',
        'audit_log.payload',
        'audit_log.created_at',
        'app_user.full_name as actor_name',
        'rbac_role.label as actor_role_name',
      ])
      .orderBy('audit_log.created_at', 'desc')
      .limit(200)
      .execute();

    // Safely extract before_state and after_state from payload if available
    return records.map((log) => {
      const payloadObj =
        typeof log.payload === 'string'
          ? JSON.parse(log.payload)
          : log.payload || {};

      return {
        ...log,
        before_state: payloadObj?.before ?? payloadObj?.before_state ?? null,
        after_state: payloadObj?.after ?? payloadObj?.after_state ?? null,
      };
    });
  },
};

export default auditLogRepository;