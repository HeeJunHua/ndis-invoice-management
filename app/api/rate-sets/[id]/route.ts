import { NextRequest } from 'next/server';
import rateSetService from '@/services/rate-set.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCodes } from '@/lib/errors';
import auditLogService from '@/services/audit-log.service';

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new AppError(ErrorCodes.NOT_FOUND, 'Rate set not found', 404);
  return id;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('rate_sets.read');
    const { id } = await params;
    const numericId = parseId(id);

    // Run both database queries in parallel for optimal performance
    const [rateSet, priceTable] = await Promise.all([
      rateSetService.getById(numericId),
      rateSetService.getPriceTable(numericId),
    ]);

    // Combine rateSet metadata with the items list
    return successResponse({
      ...rateSet,
      items: priceTable,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('rate_sets.write');
    const { id } = await params;
    const body = await request.json();
    const rateSet = await rateSetService.update(parseId(id), body);
    return successResponse(rateSet);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('rate_sets.delete');
    const { id } = await params;
    const rateSet = await rateSetService.delete(parseId(id));
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'delete',
      permissionCode: 'rate_sets.delete',
      entity: 'rate_set',
      entityId: String(rateSet.id),
    });
    return successResponse({ message: 'Rate set deleted' });
  } catch (error) {
    return errorResponse(error);
  }
}