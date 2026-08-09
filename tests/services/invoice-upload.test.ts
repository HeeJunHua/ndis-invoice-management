import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/db';
import invoiceUploadService from '@/services/invoice-upload.service';
import aiExtractionService from '@/services/ai-extraction.service';
import { minioClient } from '@/lib/minio';
import { clearDatabase, seedTestDatabase } from '@/tests/db-utils';

vi.mock('@/services/ai-extraction.service');
vi.mock('@/lib/minio', async () => {
  const actual = await vi.importActual('@/lib/minio');
  return {
    ...actual,
    minioClient: {
      putObject: vi.fn().mockResolvedValue({ etag: 'mock-etag' }),
    },
    ensureBucket: vi.fn().mockResolvedValue(undefined),
    BUCKET_NAME: 'test-bucket',
  };
});

describe('Invoice Upload Service', () => {
  beforeEach(async () => {
    await clearDatabase();
    await seedTestDatabase();
    vi.clearAllMocks();

    // Ensure basic lookups exist
    await db.insertInto('rate_set_support_item_pricing_region').values({
      code: 'NSW',
      label: 'NSW',
      full_label: 'New South Wales',
      created_at: new Date(),
    }).onConflict((oc) => oc.doNothing()).execute();

    let currentUserId: number;
    const existingUser = await db.selectFrom('app_user')
      .where('email', '=', 'test@example.com')
      .executeTakeFirst();

    if (!existingUser) {
      const createdUser = await db.insertInto('app_user').values({
        email: 'test@example.com',
        full_name: 'Test User',
        created_at: new Date(),
        updated_at: new Date(),
      }).returningAll().executeTakeFirst();
      currentUserId = (createdUser as any)!.id;
    } else {
      currentUserId = (existingUser as any)!.id;
    }

    console.log('DEBUG: currentUserId =', currentUserId);

    await db.insertInto('rbac_user_role').values({
      user_id: currentUserId,
      role_id: 1, // Assuming role 1 is admin/super-admin
      created_at: new Date(),
    }).onConflict((oc) => oc.doNothing()).execute();
  });

  it('should successfully process a PDF upload and create a draft invoice', async () => {
    // Mock AI extraction result
    const mockExtracted = {
      participant_name: 'Jane Doe',
      participant_ndis_number: '432143215',
      provider_name: 'Serenity Life Balance',
      provider_abn: '73628557755',
      invoice_number: 'INV-AI-001',
      invoice_date: '2026-03-03',
      stated_invoice_total: '100.00',
      line_items: [
        {
          unit: '1',
          invoiced_rate: '100.00',
          stated_amount: '100.00',
          service_start_date: '2026-03-01',
          service_end_date: '2026-03-01',
          support_item_number: '04_105_0125_6_1',
        },
      ],
    };

    (aiExtractionService.extractFromPdf as any).mockResolvedValue({
      result: mockExtracted,
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      model: 'gpt-4o-mini',
    });

    // We need a real client and provider in the DB for mapping to work
    await db.insertInto('client').values({
      first_name: 'Jane',
      last_name: 'Doe',
      name_parts: ['jane', 'doe'],
      ndis_number: '432143215',
      email: 'jane@example.com',
      dob: new Date(),
      gender_id: 1,
      pricing_region: 'NSW',
      address: '123 Jane St',
      created_at: new Date(),
      updated_at: new Date(),
    }).execute();

    await db.insertInto('provider').values({
      name: 'Serenity Life Balance',
      name_parts: ['serenity', 'life', 'balance'],
      abn: '73628557755',
      email: 'info@serenity.com',
      address: '456 Serenity Ave',
      created_at: new Date(),
      updated_at: new Date(),
    }).execute();

    // Seed a rate set for the item
    const rateSet = await db.insertInto('rate_set').values({
      name: 'Test Rate Set',
      start_date: '2026-01-01',
      end_date: null,
      created_at: new Date(),
      updated_at: new Date(),
    }).returningAll().executeTakeFirst();

    const category = await db.insertInto('rate_set_category').values({
      rate_set_id: rateSet!.id,
      category_number: '04',
      category_name: 'Test Category',
      created_at: new Date(),
      updated_at: new Date(),
    }).returningAll().executeTakeFirst();


    const supportItem = await db.insertInto('rate_set_support_item').values({
      rate_set_id: rateSet!.id,
      category_id: category!.id,
      item_number: '04_105_0125_6_1',
      item_name: 'Test Item',
      unit: 'Hour',
      created_at: new Date(),
      updated_at: new Date(),
    }).returningAll().executeTakeFirst();


    await db.insertInto('rate_set_support_item_price').values({
      rate_set_id: rateSet!.id,
      support_item_id: supportItem!.id,
      pricing_region_code: 'NSW',
      unit_price: '150.00',
      start_date: '2026-01-01',
      end_date: null,
      created_at: new Date(),
      updated_at: new Date(),
    }).execute();


    const files = [{
      name: 'invoice.pdf',
      buffer: Buffer.from('fake-pdf-content'),
      contentType: 'application/pdf',
    }];

    const batch = await invoiceUploadService.processUpload(1, files);

    expect(batch!.status).toBe('completed');


    const uploadFiles = await db.selectFrom('invoice_upload_file')
      .selectAll()
      .where('batch_id', '=', batch!.id)
      .execute();
    console.log('DEBUG: uploadFiles[0]:', JSON.stringify(uploadFiles[0]));
    expect(uploadFiles[0].processing_status).toBe('draft_created');
    expect(uploadFiles[0].invoice_id).toBeDefined();

    const invoice = await db.selectFrom('invoice')
      .selectAll()
      .where('id', '=', uploadFiles[0].invoice_id)
      .executeTakeFirst();
    console.log('DEBUG: fetched invoice:', JSON.stringify(invoice));
    expect(invoice?.invoice_number).toBe('INV-AI-001');
    expect(invoice?.status).toBe('drafted');
  });

  it('should mark as needs_review when client or provider cannot be matched', async () => {
    const mockExtracted = {
      participant_name: 'Unknown Client',
      participant_ndis_number: 'unknown-ndis',
      provider_name: 'Unknown Provider',
      provider_abn: 'unknown-abn',
      invoice_number: 'INV-REVIEW-001',
      invoice_date: '2026-03-03',
      stated_invoice_total: '100.00',
      line_items: [],
    };

    (aiExtractionService.extractFromPdf as any).mockResolvedValue({
      result: mockExtracted,
      usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 },
      model: 'gpt-4o-mini',
    });

    const files = [{
      name: 'invoice.pdf',
      buffer: Buffer.from('fake-pdf-content'),
      contentType: 'application/pdf',
    }];

    const batch = await invoiceUploadService.processUpload(1, files);

    const uploadFiles = await db.selectFrom('invoice_upload_file')
      .selectAll()
      .where('batch_id', '=', batch!.id)
      .execute();
    expect(uploadFiles[0].processing_status).toBe('needs_review');
  });
});
