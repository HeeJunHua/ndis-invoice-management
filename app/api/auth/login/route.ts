import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import authService from '@/services/auth.service';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCodes } from '@/lib/errors';

const SESSION_COOKIE = 'session_token';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body ?? {};

    const details: Record<string, string[]> = {};
    if (!email || typeof email !== 'string') {
      details.email = ['Email is required'];
    }
    if (!password || typeof password !== 'string') {
      details.password = ['Password is required'];
    }
    if (Object.keys(details).length > 0) {
      throw new AppError(
        ErrorCodes.VALIDATION_ERROR,
        'One or more fields are invalid.',
        400,
        details,
      );
    }

    const userAgent = request.headers.get('user-agent') ?? undefined;
    const ip = request.headers.get('x-forwarded-for') ?? undefined;

    let result;
    try {
      result = await authService.login({ email, password, userAgent, ip });
    } catch {
      // Login failures (wrong email/password/no role) are intentionally
      // generic — never reveal which part was wrong.
      throw new AppError(ErrorCodes.UNAUTHORIZED, 'Invalid email or password', 401);
    }

    // Session token lives in an httpOnly cookie (not readable by client JS) for
    // actual request authentication, and is also returned in the body to match
    // the brief's documented response shape (§13.1).
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      expires: result.expiresAt,
    });

    return successResponse({
      user: result.user,
      session_token: result.sessionToken,
      expires_at: result.expiresAt.toISOString(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}