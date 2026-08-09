import { NextRequest } from 'next/server';
import rateSetService from '@/services/rate-set.service';
import auditLogService from '@/services/audit-log.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCodes } from '@/lib/errors';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('rate_sets.write');
    const { id } = await params;
    const rateSetId = Number(id);
    if (!Number.isInteger(rateSetId)) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Rate set not found', 404);
    }

    const body = await request.json();
    if (typeof body.active !== 'boolean') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, {
        active: ['active must be a boolean'],
      });
    }

    const rateSet = await rateSetService.setActiveStatus(rateSetId, body.active);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'update',
      permissionCode: 'rate_sets.write',
      entity: 'rate_set',
      entityId: String(rateSetId),
      changesDiff: { active: body.active },
    });

    return successResponse(rateSet);
  } catch (error) {
    return errorResponse(error);
  }
}