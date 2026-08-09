import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import authService from '@/services/auth.service';
import appUserRepository from '@/repositories/app-user.repository';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCodes } from '@/lib/errors';

const SESSION_COOKIE = 'session_token';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token =
      cookieStore.get(SESSION_COOKIE)?.value ||
      request.headers.get('x-session-token');

    if (!token) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Not authenticated', 401);
    }

    // Validate the current session token in DB
    const session = await authService.validateSession(token);
    if (!session) {
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid or expired session', 401);
    }

    // Fetch details for the logged-in user
    const user = await appUserRepository.findById(session.user_id);
    if (!user) {
      throw new AppError(ErrorCodes.NOT_FOUND, 'User not found', 404);
    }

    return successResponse({
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      sessionId: session.id, // 👈 Used by SessionsPage to identify current session
    });
  } catch (error) {
    return errorResponse(error);
  }
}