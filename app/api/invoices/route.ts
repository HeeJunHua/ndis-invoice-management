import { NextRequest } from 'next/server';
import invoiceService from '@/services/invoice.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import auditLogService from '@/services/audit-log.service';

export async function GET() {
  try {
    await requirePermission('invoices.read');
    const invoices = await invoiceService.listForDisplay();
    return successResponse(invoices);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requirePermission('invoices.write');
    const body = await request.json();
    const invoice = await invoiceService.create(body);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'create',
      permissionCode: 'invoices.write',
      entity: 'invoice',
      entityId: String(invoice.id),
      payload: invoice,
    });
    return successResponse(invoice, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}