import { db } from '@/db';
import { requireAuth } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET() {
  try {
    await requireAuth();
    const regions = await db
      .selectFrom('rate_set_support_item_pricing_region')
      .selectAll()
      .where('deactivated_at', 'is', null)
      .orderBy('label')
      .execute();
    return successResponse(regions);
  } catch (error) {
    return errorResponse(error);
  }
}