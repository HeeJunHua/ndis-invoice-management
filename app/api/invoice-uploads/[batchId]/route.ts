import { NextRequest } from 'next/server';
import invoiceUploadRepository from '@/repositories/invoice-upload.repository';
import { requireAuth } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    await requireAuth();
    const { batchId } = await params;

    if (!batchId) {
      return errorResponse({ code: 'VALIDATION_ERROR', message: 'Batch ID is required', statusCode: 400 });
    }

    const files = await invoiceUploadRepository.listFilesByBatch(batchId);
    console.log(`DEBUG: Fetching files for batch ${batchId}, found ${files.length} files`);
    return successResponse(files);
  } catch (error) {
    return errorResponse(error);
  }
}
