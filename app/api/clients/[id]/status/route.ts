import { NextRequest } from 'next/server';
import clientService from '@/services/client.service';
import auditLogService from '@/services/audit-log.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCodes } from '@/lib/errors';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('clients.write');
    const { id } = await params;
    const clientId = Number(id);
    if (!Number.isInteger(clientId)) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Client not found', 404);
    }

    const body = await request.json();
    if (typeof body.active !== 'boolean') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'One or more fields are invalid.', 400, {
        active: ['active must be a boolean'],
      });
    }

    const client = await clientService.setActiveStatus(clientId, body.active);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'update',
      permissionCode: 'clients.write',
      entity: 'client',
      entityId: String(clientId),
      changesDiff: { active: body.active },
    });

    return successResponse(client);
  } catch (error) {
    return errorResponse(error);
  }
}