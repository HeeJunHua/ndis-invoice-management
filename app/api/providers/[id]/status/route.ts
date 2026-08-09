import { NextRequest } from 'next/server';
import providerService from '@/services/provider.service';
import auditLogService from '@/services/audit-log.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCodes } from '@/lib/errors';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('providers.write');
    const { id } = await params;
    const providerId = Number(id);
    if (!Number.isInteger(providerId)) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Provider not found', 404);
    }

    const body = await request.json();
    if (typeof body.active !== 'boolean') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, {
        active: ['active must be a boolean'],
      });
    }

    const provider = await providerService.setActiveStatus(providerId, body.active);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'update',
      permissionCode: 'providers.write',
      entity: 'provider',
      entityId: String(providerId),
      changesDiff: { active: body.active },
    });

    return successResponse(provider);
  } catch (error) {
    return errorResponse(error);
  }
}