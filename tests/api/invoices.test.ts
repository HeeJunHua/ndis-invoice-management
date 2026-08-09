import { describe, it, expect, beforeEach } from 'vitest';
import { GET as listHandler, POST as createHandler } from '@/app/api/invoices/route';
import { GET as getHandler, PATCH as updateHandler, DELETE as deleteHandler } from '@/app/api/invoices/[id]/route';
import { clearDatabase, seedTestDatabase } from '@/tests/db-utils';
import { createTestUser, getAuthHeader } from '@/tests/auth-utils';
import { callRoute } from '@/tests/api-test-utils';

describe('Invoices API', () => {
  let adminToken: string;
  let clientId: number;
  let providerId: number;

  beforeEach(async () => {
    await clearDatabase();
    await seedTestDatabase();
    const admin = await createTestUser({ roleCode: 'admin' });
    adminToken = admin.token;

    // Create a client and provider for invoices
    const client = await callRoute(async (req: any) => {
      // Mimicking the handler logic to create data quickly
      const { db } = await import('@/db');
      const res = await db.insertInto('client').values({
        first_name: 'Invoice',
        last_name: 'Client',
        name_parts: ['Invoice', 'Client'],
        email: 'inv.client@example.com',
        ndis_number: 'ndis-inv-1',
        dob: new Date(),
        gender_id: 1,
        pricing_region: 'NSW',
        address: 'Invoice Address',
        created_at: new Date(),
        updated_at: new Date(),
      }).returningAll().executeTakeFirst();
      return { status: 201, data: { data: res } };
    }, { method: 'POST' });
    clientId = client.data.data.id;

    const provider = await callRoute(async (req: any) => {
      const { db } = await import('@/db');
      const res = await db.insertInto('provider').values({
        name: 'Invoice Provider',
        name_parts: ['Invoice Provider'],
        abn: 'inv-abn-1',
        email: 'inv.prov@example.com',
        phone_number: '0400000001',
        address: 'Provider Address',
        created_at: new Date(),
        updated_at: new Date(),
      }).returningAll().executeTakeFirst();
      return { status: 201, data: { data: res } };
    }, { method: 'POST' });
    providerId = provider.data.data.id;
  });

  it('should list invoices as admin', async () => {
    const { status, data } = await callRoute(listHandler, {
      method: 'GET',
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(200);
    expect(data.data).toBeInstanceOf(Array);
  });

  it('should create an invoice', async () => {
    const invoiceData = {
      client_id: clientId,
      provider_id: providerId,
      invoice_date: '2024-08-01',
      invoice_number: 'INV-001',
      status: 'draft',
      expected_amount: 100.00,
    };
    const { status, data } = await callRoute(createHandler, {
      method: 'POST',
      body: invoiceData,
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(201);
    expect(data.data.id).toBeDefined();
    expect(data.data.invoice_number).toBe('INV-001');
  });

  it('should get a specific invoice', async () => {
    const { data: createData } = await callRoute(createHandler, {
      method: 'POST',
      body: {
        client_id: clientId,
        provider_id: providerId,
        invoice_date: '2024-08-02',
        invoice_number: 'INV-002',
        status: 'draft',
        expected_amount: 200.00,
      },
      headers: getAuthHeader(adminToken),
    });
    const invoiceId = createData.data.id;

    const { status, data } = await callRoute(getHandler, {
      method: 'GET',
      params: { id: invoiceId },
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(200);
    expect(data.data.id).toBe(invoiceId);
  });

  it('should update an invoice', async () => {
    const { data: createData } = await callRoute(createHandler, {
      method: 'POST',
      body: {
        client_id: clientId,
        provider_id: providerId,
        invoice_date: '2024-08-03',
        invoice_number: 'INV-003',
        status: 'draft',
        expected_amount: 300.00,
      },
      headers: getAuthHeader(adminToken),
    });
    const invoiceId = createData.data.id;

    const { status, data } = await callRoute(updateHandler, {
      method: 'PATCH',
      params: { id: invoiceId },
      body: { status: 'published' },
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(200);
    expect(data.data.status).toBe('published');
  });

  it('should delete an invoice', async () => {
    const { data: createData } = await callRoute(createHandler, {
      method: 'POST',
      body: {
        client_id: clientId,
        provider_id: providerId,
        invoice_date: '2024-08-04',
        invoice_number: 'INV-004',
        status: 'draft',
        expected_amount: 400.00,
      },
      headers: getAuthHeader(adminToken),
    });
    const invoiceId = createData.data.id;

    const { status } = await callRoute(deleteHandler, {
      method: 'DELETE',
      params: { id: invoiceId },
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(204);
  });
});
