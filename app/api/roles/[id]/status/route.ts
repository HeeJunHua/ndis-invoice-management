import { NextRequest } from 'next/server';
import rbacService from '@/services/rbac.service';
import auditLogService from '@/services/audit-log.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const roleId = Number(id);
    if (isNaN(roleId)) {
      return errorResponse({ code: 'NOT_FOUND', message: 'Invalid role ID', statusCode: 404 });
    }

    const body = await request.json();
    const active = body.active;

    if (typeof active !== 'boolean') {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'Active status must be a boolean', statusCode: 400 });
    }

    const auth = await requirePermission('user_roles.write');

    const role = await rbacService.setStatus(roleId, active);

    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'update',
      permissionCode: 'user_roles.write',
      entity: 'rbac_role',
      entityId: String(role.id),
      changesDiff: { active },
    });

    return successResponse(role);
  } catch (error) {
    return errorResponse(error);
  }
}
