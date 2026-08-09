import auditLogRepository from '@/repositories/audit-log.repository';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
  try {
    await requirePermission('audit_logs.read');
    return successResponse(await auditLogRepository.list());
  } catch (error) {
    return errorResponse(error);
  }
}