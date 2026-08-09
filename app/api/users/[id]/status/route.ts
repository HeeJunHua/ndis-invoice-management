import { NextRequest } from 'next/server';
import userService from '@/services/user.service';
import auditLogService from '@/services/audit-log.service';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const userId = Number(id);
    if (isNaN(userId)) {
      return errorResponse({ code: 'NOT_FOUND', message: 'Invalid user ID', statusCode: 404 });
    }

    const body = await request.json();
    const active = body.active;

    if (typeof active !== 'boolean') {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'Active status must be a boolean', statusCode: 400 });
    }

    const auth = await requirePermission('users.write');

    const user = await userService.setStatus(userId, active);

    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'update',
      permissionCode: 'users.write',
      entity: 'app_user',
      entityId: String(user.id),
      changesDiff: { active },
    });

    return successResponse(user);
  } catch (error) {
    return errorResponse(error);
  }
}
