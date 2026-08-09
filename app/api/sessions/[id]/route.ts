import { NextRequest } from 'next/server';
import sessionService from '@/services/session.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import auditLogService from '@/services/audit-log.service';

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id)) return null;
  return id;
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('auth_sessions.revoke');
    const { id } = await params;
    const sessionId = id; // Session ID is a string in the DB
    const session = await sessionService.revoke(sessionId);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'delete',
      permissionCode: 'auth_sessions.revoke',
      entity: 'auth_session',
      entityId: String(session.id),
    });
    return successResponse(session);
  } catch (error) {
    return errorResponse(error);
  }
}
