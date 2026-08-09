import { cookies } from 'next/headers';
import authService from '@/services/auth.service';
import { successResponse, errorResponse } from '@/lib/api-response';

const SESSION_COOKIE = 'session_token';

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;

    if (token) {
      await authService.logout(token);
    }

    cookieStore.delete(SESSION_COOKIE);

    return successResponse({ message: 'Logged out successfully' });
  } catch (error) {
    return errorResponse(error);
  }
}