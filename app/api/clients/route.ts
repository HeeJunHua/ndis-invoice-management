import { NextRequest } from 'next/server';
import clientService from '@/services/client.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import auditLogService from '@/services/audit-log.service';

export async function GET() {
  try {
    await requirePermission('clients.read');
    const clients = await clientService.list();
    return successResponse(clients);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('clients.write');
    const body = await request.json();
    const client = await clientService.create(body);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'create',
      permissionCode: 'clients.write',
      entity: 'client',
      entityId: String(client.id),
      payload: client,
    });
    return successResponse(client, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}