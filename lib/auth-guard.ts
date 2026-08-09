/**
 * Backend-enforced auth + permission guard, used by every protected API route.
 * This is the single place that decides "is this request authenticated, and
 * does its role have the required permission" — per §10.3, this must be
 * enforced here, not just hidden/shown in the UI.
 */
import { cookies } from 'next/headers';
import authService from '@/services/auth.service';
import appUserRepository from '@/repositories/app-user.repository';
import rbacRepository from '@/repositories/rbac.repository';
import { AppError, ErrorCodes } from './errors';

const SESSION_COOKIE = 'session_token';

export interface AuthContext {
  userId: number;
  roleId: number;
  email: string;
  fullName: string;
}

/**
 * Reads the session cookie, validates it, and resolves the acting user.
 * Throws AppError(UNAUTHORIZED, 401) if there's no valid session.
 * Every protected route should call this first.
 */
export async function requireAuth(): Promise<AuthContext> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, 'Authentication required', 401);
  }

  const session = await authService.validateSession(token);
  if (!session) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, 'Session is invalid or expired', 401);
  }

  const user = await appUserRepository.findById(session.user_id);
  if (!user) {
    throw new AppError(ErrorCodes.UNAUTHORIZED, 'Session is invalid or expired', 401);
  }

  return {
    userId: user.id,
    roleId: session.role_id,
    email: user.email,
    fullName: user.full_name,
  };
}

/**
 * Combines requireAuth() with a permission check. Use this in routes that
 * need a specific permission (e.g. 'clients.write').
 * Throws AppError(FORBIDDEN, 403) if the session's role lacks the permission.
 */
export async function requirePermission(permissionCode: string): Promise<AuthContext> {
  const auth = await requireAuth();

  const allowed = await rbacRepository.roleHasPermission(auth.roleId, permissionCode);
  if (!allowed) {
    throw new AppError(
      ErrorCodes.FORBIDDEN,
      `Missing required permission: ${permissionCode}`,
      403,
    );
  }

  return auth;
}