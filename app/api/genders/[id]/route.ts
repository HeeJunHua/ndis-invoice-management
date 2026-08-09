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
    
    // 1. Fetch record BEFORE updating to log original state
    const before = await genderService.getById(parsedId);
    
    // 2. Perform update (using service's .update method)
    const updated = await genderService.update(parsedId, body);

    // 3. Write audit log
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'update',
      permissionCode: 'genders.write',
      entity: 'gender',
      entityId: String(updated.id),
      payload: before,
      changesDiff: body,
    });

    return successResponse(updated);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('genders.write');
    const { id } = await params;
    const parsedId = parseId(id);
    if (!parsedId) return errorResponse(new AppError(ErrorCodes.VALIDATION_ERROR, 'Invalid ID', 400));

    const before = await genderService.getById(parsedId);
    const gender = await genderService.delete(parsedId);

    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'delete',
      permissionCode: 'genders.write',
      entity: 'gender',
      entityId: String(gender.id),
      payload: before,
    });

    return successResponse(gender);
  } catch (error) {
    return errorResponse(error);
  }
}