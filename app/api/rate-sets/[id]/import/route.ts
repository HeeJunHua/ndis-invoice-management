import { NextRequest } from 'next/server';
import rateSetService from '@/services/rate-set.service';
import ndisExcelImportService from '@/services/ndis-excel-import.service';
import auditLogService from '@/services/audit-log.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCodes } from '@/lib/errors';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('rate_sets.import');
    const { id } = await params;
    const rateSetId = Number(id);
    if (!Number.isInteger(rateSetId)) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'Rate set not found', 404);
    }

    await rateSetService.getById(rateSetId);

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'A file is required.', 400, {
        file: ['An Excel file is required'],
      });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await ndisExcelImportService.importForRateSet(rateSetId, buffer);

    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'update',
      permissionCode: 'rate_sets.import',
      entity: 'rate_set',
      entityId: String(rateSetId),
      payload: result,
    });

    return successResponse(result);
  } catch (error) {
    return errorResponse(error);
  }
}