import { NextRequest } from 'next/server';
import genderService from '@/services/gender.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import auditLogService from '@/services/audit-log.service';

export async function GET(_request: NextRequest) {
  try {
    await requirePermission('genders.read');
    const genders = await genderService.list();
    return successResponse(genders);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('genders.write');
    const body = await request.json();
    const gender = await genderService.create(body);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'create',
      permissionCode: 'genders.write',
      entity: 'gender',
      entityId: String(gender.id),
      payload: gender,
    });
    return successResponse(gender);
  } catch (error) {
    return errorResponse(error);
  }
}
