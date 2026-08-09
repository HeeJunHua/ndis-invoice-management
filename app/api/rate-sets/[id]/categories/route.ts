import { NextRequest } from 'next/server';
import rateSetCategoryRepository from '@/repositories/rate-set-category.repository';
import { requirePermission } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission('rate_sets.read');
    const { id } = await params;
    const categories = await rateSetCategoryRepository.listActiveByRateSet(Number(id));
    return successResponse(categories);
  } catch (error) {
    return errorResponse(error);
  }
}