import { NextRequest } from 'next/server';
import rateSetSupportItemRepository from '@/repositories/rate-set-support-item.repository';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('rate_sets.read');
    const { id } = await params;
    const items = await rateSetSupportItemRepository.listActiveByRateSet(Number(id));
    return successResponse(items);
  } catch (error) {
    return errorResponse(error);
  }
}