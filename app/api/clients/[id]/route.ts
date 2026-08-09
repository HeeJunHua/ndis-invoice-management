import { NextRequest } from 'next/server';
import clientService from '@/services/client.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCodes } from '@/lib/errors';
import auditLogService from '@/services/audit-log.service';

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id)) {
    throw new AppError(ErrorCodes.NOT_FOUND, 'Client not found', 404);
  }
  return id;
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('clients.read');
    const { id } = await params;
    const client = await clientService.getById(parseId(id));
    return successResponse(client);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('clients.write');
    const { id } = await params;
    const body = await request.json();
    const client = await clientService.update(parseId(id), body);
    return successResponse(client);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('clients.delete');
    const { id } = await params;
    const client = await clientService.delete(parseId(id));
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'delete',
      permissionCode: 'clients.delete',
      entity: 'client',
      entityId: String(client.id),
    });
    return successResponse({ message: 'Client deleted' });
  } catch (error) {
    return errorResponse(error);
  }
}