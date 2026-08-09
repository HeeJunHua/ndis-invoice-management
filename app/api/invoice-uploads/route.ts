import { NextRequest } from 'next/server';
import invoiceUploadService from '@/services/invoice-upload.service';
import { requireAuth } from '@/lib/auth-guard';
import { successResponse, errorResponse } from '@/lib/api-response';
import { AppError, ErrorCodes } from '@/lib/errors';
import invoiceUploadRepository from '@/repositories/invoice-upload.repository';

export async function GET() {
  try {
    await requireAuth();
    const batches = await invoiceUploadRepository.listBatches();
    return successResponse(batches);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const formData = await request.formData();
    const fileEntries = formData.getAll('files');

    if (fileEntries.length === 0 || fileEntries.length > 20) {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Between 1 and 20 files are required.', 400);
    }

    const files = await Promise.all(
      fileEntries
        .filter((f): f is File => f instanceof File)
        .map(async (f) => ({
          name: f.name,
          buffer: Buffer.from(await f.arrayBuffer()),
          contentType: f.type || 'application/pdf',
        })),
    );

    const batch = await invoiceUploadService.processUpload(auth.userId, files);
    return successResponse(batch, undefined, 201);
  } catch (error) {
    return errorResponse(error);
  }
}