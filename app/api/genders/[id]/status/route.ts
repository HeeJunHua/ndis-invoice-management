import { NextRequest } from 'next/server';
import genderService from '@/services/gender.service';
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
    const auth = await requirePermission('genders.write');
    const { id } = await params;
    const parsedId = parseId(id);
    if (!parsedId) return errorResponse(new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid ID', 400));

    const body = await request.json();
    if (typeof body.active !== 'boolean') {
      return errorResponse(new AppError(ErrorCodes.VALIDATION_ERROR, 'Field "active" must be a boolean', 400));
    }

    const gender = await genderService.setGenderStatus(parsedId, body.active);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'update',
      permissionCode: 'genders.write',
      entity: 'gender',
      entityId: String(parsedId),
      payload: { active: body.active },
    });
    
    return successResponse(gender);
  } catch (error) {
    return errorResponse(error);
  }
}