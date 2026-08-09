import { NextRequest } from 'next/server';
import providerService from '@/services/provider.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCodes } from '@/lib/errors';
import auditLogService from '@/services/audit-log.service';

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id)) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Provider not found', 404);
  }
  return id;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('providers.read');
    const { id } = await params;
    const provider = await providerService.getById(parseId(id));
    return successResponse(provider);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('providers.write');
    const { id } = await params;
    const body = await request.json();
    const before = await providerService.getById(parseId(id));
    const provider = await providerService.update(parseId(id), body);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'update',
      permissionCode: 'providers.write',
      entity: 'provider',
      entityId: String(provider.id),
      payload: before,
      changesDiff: body,
    });
    return successResponse(provider);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('providers.write');
    const { id } = await params;
    const parsedId = parseId(id);
    const before = await providerService.getById(parsedId);
    const provider = await providerService.delete(parsedId);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'delete',
      permissionCode: 'providers.write',
      entity: 'provider',
      entityId: String(provider.id),
      payload: before,
    });
    return successResponse(provider);
  } catch (error) {
    return errorResponse(error);
  }
}