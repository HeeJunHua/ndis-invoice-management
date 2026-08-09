import { NextRequest } from 'next/server';
import rateSetService from '@/services/rate-set.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import auditLogService from '@/services/audit-log.service';

export async function GET() {
  try {
    await requirePermission('rate_sets.read');
    const rateSets = await rateSetService.list();
    return successResponse(rateSets);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('rate_sets.write');
    const body = await request.json();
    const rateSet = await rateSetService.create(body);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'create',
      permissionCode: 'rate_sets.write',
      entity: 'rate_set',
      entityId: String(rateSet.id),
      payload: rateSet,
    });
    return successResponse(rateSet, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}