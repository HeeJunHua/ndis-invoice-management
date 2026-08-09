import { NextRequest } from 'next/server';
import userService from '@/services/user.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import auditLogService from '@/services/audit-log.service';

export async function GET() {
  try {
    await requirePermission('users.read');
    return successResponse(await userService.list());
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('users.write');
    const body = await request.json();
    const user = await userService.create(body);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'create',
      permissionCode: 'users.write',
      entity: 'app_user',
      entityId: String(user.id),
      payload: { id: user.id, email: user.email, full_name: user.full_name }, // never log password
    });
    return successResponse(user, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}