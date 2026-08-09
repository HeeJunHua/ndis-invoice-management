import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import sessionService from '@/services/session.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import auditLogService from '@/services/audit-log.service';

const SESSION_COOKIE = 'session_token';

/**
 * GET /api/sessions
 * Returns all authentication sessions for management.
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission('auth_sessions.read');
    
    // Fetch all sessions across all users for admin management
    const sessions = await sessionService.listAllSessions();
    
    return successResponse(sessions);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/sessions
 * Revokes all other active sessions for the authenticated user except the current active session.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requirePermission('auth_sessions.delete');

    // Extract current token from cookie or header to prevent self-lockout
    const cookieStore = await cookies();
    const currentToken =
      cookieStore.get(SESSION_COOKIE)?.value ||
      request.headers.get('x-session-token') ||
      '';

    // Revoke all other sessions belonging to this user
    await sessionService.revokeOthers(auth.userId, currentToken);

    // Audit log entry for batch revocation
    await auditLogService.write({
      actorUserId: auth.userId,
      actorRoleId: auth.roleId,
      action: 'delete',
      permissionCode: 'auth_sessions.revoke',
      entity: 'auth_session',
      entityId: String(auth.userId),
      payload: {
        description: 'Revoked all other active user sessions',
      },
    });

    return successResponse({ message: 'All other sessions have been revoked successfully.' });
  } catch (error) {
    return errorResponse(error);
  }
}