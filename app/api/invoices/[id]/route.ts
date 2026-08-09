import { NextRequest } from 'next/server';
import invoiceService from '@/services/invoice.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCodes } from '@/lib/errors';
import auditLogService from '@/services/audit-log.service';

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new AppError(ErrorCodes.NOT_FOUND, 'Invoice not found', 404);
  return id;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('invoices.read');
    const { id } = await params;
    const invoice = await invoiceService.getById(parseId(id));
    return successResponse(invoice);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('invoices.write');
    const { id } = await params;
    const body = await request.json();
    const invoice = await invoiceService.update(parseId(id), body);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'update',
      permissionCode: 'invoices.write',
      entity: 'invoice',
      entityId: String(invoice.id),
      changesDiff: body,
    });
    return successResponse(invoice);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('invoices.write');
    const { id } = await params;
    const parsedId = parseId(id);
    const before = await invoiceService.getById(parsedId);
    const invoice = await invoiceService.delete(parsedId);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'delete',
      permissionCode: 'invoices.write',
      entity: 'invoice',
      entityId: String(invoice.id),
      payload: before,
    });
    return successResponse(invoice);
  } catch (error) {
    return errorResponse(error);
  }
}