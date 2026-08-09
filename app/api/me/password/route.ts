import { NextRequest } from 'next/server';
import userService from '@/services/user.service';
import { requireAuth } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const { password } = await request.json();
    await userService.changeOwnPassword(auth.userId, password);
    return successResponse({ message: 'Password updated' });
  } catch (error) {
    return errorResponse(error);
  }
}