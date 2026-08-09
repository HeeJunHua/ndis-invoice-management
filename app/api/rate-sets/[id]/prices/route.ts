import { NextRequest } from 'next/server';
import rateSetService from '@/services/rate-set.service';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('rate_sets.read');
    const { id } = await params;
    const rows = await rateSetService.getPriceTable(Number(id));
    return successResponse(rows);
  } catch (error) {
    return errorResponse(error);
  }
}