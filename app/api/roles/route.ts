import { NextRequest } from 'next/server';
import rbacRepository from '@/repositories/rbac.repository';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import auditLogService from '@/services/audit-log.service';
import rbacService from '@/services/rbac.service';

export async function GET() {
  try {
    await requirePermission('user_roles.read');
    return successResponse(await rbacRepository.listAllRoles());
  } catch (error) {
    return errorResponse(error);
  }
}


export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('user_roles.write');
    const body = await request.json();

    const newRole = await rbacService.createRole(body);

    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'create',
      permissionCode: 'user_roles.write',
      entity: 'rbac_role',
      entityId: String(newRole.id),
      payload: body,
    });

    return successResponse(newRole, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}