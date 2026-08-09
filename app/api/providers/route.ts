import { NextRequest } from 'next/server';
import providerService from '@/services/provider.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import auditLogService from '@/services/audit-log.service';

export async function GET() {
  try {
    await requirePermission('providers.read');
    const providers = await providerService.list();
    return successResponse(providers);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('providers.write');
    const body = await request.json();
    const provider = await providerService.create(body);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'create',
      permissionCode: 'providers.write',
      entity: 'provider',
      entityId: String(provider.id),
      payload: provider,
    });
    return successResponse(provider, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}