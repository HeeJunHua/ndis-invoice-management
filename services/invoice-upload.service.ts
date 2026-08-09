/**
 * Orchestrates: store PDF in MinIO -> extract via AI -> map -> create draft invoice.
 */
import { db } from '@/db';
import { minioClient, ensureBucket, BUCKET_NAME } from '@/lib/minio';
import invoiceUploadRepository from '@/repositories/invoice-upload.repository';
import aiExtractionService from './ai-extraction.service';
import invoiceDraftMappingService from './invoice-draft-mapping.service';
import invoiceItemRepository, { type NewInvoiceItem } from '@/repositories/invoice-item.repository';
import { randomUUID } from 'crypto';

const invoiceUploadService = {
  async processUpload(uploadedByUserId: number, files: { name: string; buffer: Buffer; contentType: string }[]) {
    await ensureBucket();

    const batch = await invoiceUploadRepository.createBatch({
      uploaded_by: uploadedByUserId,
      status: 'processing',
      file_count: files.length,
      total_size: files.reduce((s, f) => s + f.buffer.length, 0),
    });

    try {
      await Promise.allSettled(files.map(async (file) => {
        let uploadFileId: string | null = null;
        try {
          const objectKey = `${batch.id}/${randomUUID()}-${file.name}`;
          const putResult = await minioClient.putObject(BUCKET_NAME, objectKey, file.buffer, file.buffer.length, {
            'Content-Type': file.contentType,
          });

          const uploadFile = await invoiceUploadRepository.createFile({
            batch_id: batch.id,
            original_name: file.name,
            object_key: objectKey,
            content_type: file.contentType,
            size: file.buffer.length,
            etag: putResult.etag,
            processing_status: 'processing',
            processing_started_at: new Date(),
          });
          uploadFileId = uploadFile.id;

          const { result, usage, model } = await aiExtractionService.extractFromPdf(file.buffer);
          const draft = await invoiceDraftMappingService.mapToDraft(result);

          if (!draft) {
            await invoiceUploadRepository.updateFile(uploadFileId, {
              processing_status: 'failed',
              error_message: 'No invoice_number could be extracted — cannot create draft',
              extraction_result: JSON.stringify(result),
              processing_completed_at: new Date(),
            });
            return;
          }

          const invoice = await db.transaction().execute(async (trx) => {
            const inv = await trx
              .insertInto('invoice')
              .values({
                client_id: draft.client_id,
                provider_id: draft.provider_id,
                invoice_number: draft.invoice_number,
                invoice_date: draft.invoice_date,
                expected_amount: draft.expected_amount != null ? String(draft.expected_amount) : null,
                amount: draft.amount != null ? String(draft.amount) : null,
                status: 'drafted',
              })
              .returningAll()
              .executeTakeFirstOrThrow();

            const items: NewInvoiceItem[] = draft.items.map((it, i) => ({
              invoice_id: inv.id,
              rate_set_id: it.rate_set_id,
              category_id: it.category_id,
              support_item_id: it.support_item_id,
              start_date: it.start_date,
              end_date: it.end_date,
              max_rate: it.max_rate != null ? String(it.max_rate) : null,
              unit: it.unit != null ? String(it.unit) : null,
              input_rate: it.input_rate != null ? String(it.input_rate) : null,
              amount: it.amount != null ? String(it.amount) : null,
              sort_order: i,
            }));
            await invoiceItemRepository.replaceAll(trx, inv.id, items);
            return inv;
          });

          const needsReview = !draft.client_id || !draft.provider_id || draft.items.some((i) => !i.support_item_id);

          await invoiceUploadRepository.updateFile(uploadFileId, {
            processing_status: needsReview ? 'needs_review' : 'draft_created',
            invoice_id: invoice.id,
            extraction_result: JSON.stringify(result),
            ai_provider: process.env.OPENROUTER_API_KEY ? 'openrouter' : 'openai',
            model,
            prompt_tokens: usage?.prompt_tokens ?? null,
            completion_tokens: usage?.completion_tokens ?? null,
            total_tokens: usage?.total_tokens ?? null,
            processing_completed_at: new Date(),
          });
        } catch (error) {
          if (uploadFileId) {
            await invoiceUploadRepository.updateFile(uploadFileId, {
              processing_status: 'failed',
              error_message: error instanceof Error ? error.message : 'Unknown error',
              processing_completed_at: new Date(),
            });
          }
          throw error;
        }
      }));

      await invoiceUploadRepository.updateBatch(batch.id, { status: 'completed' });
    } catch (error) {
      await invoiceUploadRepository.updateBatch(batch.id, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown batch error'
      });
      throw error;
    }

    return batch;
  },
};
export default invoiceUploadService;