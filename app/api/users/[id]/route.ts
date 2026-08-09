import { NextRequest } from 'next/server';
import userService from '@/services/user.service';
import auditLogService from '@/services/audit-log.service';
import { requireAuth, requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCodes } from '@/lib/errors';

function parseId(raw: string) {
  const id = Number(raw);
  if (!Number.isInteger(id)) throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404);
  return id;
}

export async function GET(_request: NextRequest) {
  try {
    const auth = await requireAuth();
    const currentUser = await userService.getById(auth.userId);
    return successResponse(currentUser);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const targetId = parseId(id);
    const body = await request.json();
    const { password, ...otherFields } = body ?? {};

    const auth = await requireAuth();
    const isSelfEditing = auth.userId === targetId;

    if (!isSelfEditing) {
      // If updating someone else, require global write permissions
      await requirePermission('users.write');
    }

    // 1. Separate Password Handling Flow
    if (password !== undefined) {
      if (!isSelfEditing) {
        throw new AppError(
          ErrorCodes.FORBIDDEN,
          'You can only change your own password.',
          403
        );
      }

      if (typeof password !== 'string' || password.length < 8) {
        throw new AppError(
          ErrorCodes.VALIDATION_ERROR,
          'Password must be at least 8 characters long.',
          400,
          { password: ['Password must be at least 8 characters'] }
        );
      }

      await userService.changeOwnPassword(targetId, password);
    }

    const user = await userService.update(targetId, otherFields);

    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'update',
      permissionCode: 'users.write',
      entity: 'app_user',
      entityId: String(user.id),
      changesDiff: { 
        email: otherFields.email, 
        full_name: otherFields.full_name, 
        role_id: otherFields.role_id,
        password_changed: password !== undefined ? true : undefined 
      },
    });

    return successResponse(user);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePermission('users.delete');
    const { id } = await params;
    const targetId = parseId(id);

    if (auth.userId === targetId) {
      throw new AppError(
        ErrorCodes.FORBIDDEN,
        'You cannot delete your own account.',
        403
      );
    }

    const client = await userService.delete(targetId);
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'delete',
      permissionCode: 'users.delete', // Fixed code to match users domain
      entity: 'app_user',
      entityId: String(client.id),
    });
    return successResponse({ message: 'Users deleted' });
  } catch (error) {
    return errorResponse(error);
  }
}