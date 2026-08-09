/**
 * Fire-and-forget audit logging — per §10.4, logging failures must never
 * block the main operation, so write() swallows its own errors after
 * logging them to the console rather than throwing.
 */
import auditLogRepository from '@/repositories/audit-log.repository';

export interface AuditEntry {
  actorUserId: number | null;
  actorRoleId: number | null;
  action: 'create' | 'update' | 'delete';
  permissionCode: string;
  entity: string;
  entityId: string;
  payload?: unknown; // never pass passwords/tokens here
  changesDiff?: unknown;
}

const auditLogService = {
  async write(entry: AuditEntry) {
    try {
      await auditLogRepository.create({
        actor_user_id: entry.actorUserId,
        actor_role_id: entry.actorRoleId,
        action: entry.action,
        permission_code: entry.permissionCode,
        entity: entry.entity,
        entity_id: entry.entityId,
        payload: entry.payload ? JSON.stringify(entry.payload) : null,
        changes_diff: entry.changesDiff ? JSON.stringify(entry.changesDiff) : null,
      });
    } catch (error) {
      console.error('Audit log write failed (non-blocking):', error);
    }
  },
};
export default auditLogService;