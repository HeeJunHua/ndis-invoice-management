import { NextRequest } from 'next/server';
import rbacService from '@/services/rbac.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import auditLogService from '@/services/audit-log.service';
import { AppError, ErrorCodes } from '@/lib/errors';

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id)) return null;
  return id;
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('user_roles.write');
    const { id } = await params;
    const parsedId = parseId(id);
    if (!parsedId) return errorResponse(new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid ID', 400));

    const body = await request.json();
    const before = await rbacService.getRoleById(parsedId);
    const role = await rbacService.updateRole(parsedId, body);

    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'update',
      permissionCode: 'user_roles.write',
      entity: 'rbac_role',
      entityId: String(role.id),
      payload: before,
      changesDiff: body,
    });
    return successResponse(role);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('user_roles.write');
    const { id } = await params;
    const parsedId = parseId(id);
    if (!parsedId) return errorResponse(new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid ID', 400));

    const before = await rbacService.getRoleById(parsedId);
    const role = await rbacService.deleteRole(parsedId);

    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'delete',
      permissionCode: 'user_roles.write',
      entity: 'rbac_role',
      entityId: String(role.id),
      payload: before,
    });
    return successResponse(role);
  } catch (error) {
    return errorResponse(error);
  }
}
