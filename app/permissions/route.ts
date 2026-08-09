import rbacRepository from '@/repositories/rbac.repository';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
  try {
    // Require permission to view roles/permissions
    await requirePermission('user_roles.read.read');
    
    // Fetch all available permissions from rbac_permission table
    const permissions = await rbacRepository.listAllPermissions();
    
    return successResponse(permissions);
  } catch (error) {
    return errorResponse(error);
  }
}