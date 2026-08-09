import { describe, it, expect, beforeEach } from 'vitest';
import { GET as listHandler, POST as createHandler } from '@/app/api/providers/route';
import { GET as getHandler, PATCH as updateHandler, DELETE as deleteHandler } from '@/app/api/providers/[id]/route';
import { clearDatabase, seedTestDatabase } from '@/tests/db-utils';
import { createTestUser, getAuthHeader } from '@/tests/auth-utils';
import { callRoute } from '@/tests/api-test-utils';

describe('Providers API', () => {
  let adminToken: string;

  beforeEach(async () => {
    await clearDatabase();
    await seedTestDatabase();
    const admin = await createTestUser({ roleCode: 'admin' });
    adminToken = admin.token;
  });

  it('should list providers as admin', async () => {
    const { status, data } = await callRoute(listHandler, {
      method: 'GET',
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(200);
    expect(data.data).toBeInstanceOf(Array);
  });

  it('should create a provider', async () => {
    const providerData = {
      name: 'Test Provider',
      abn: '12345678901',
      email: 'provider@example.com',
      phone_number: '0400000000',
      address: 'Provider St, Sydney',
    };
    const { status, data } = await callRoute(createHandler, {
      method: 'POST',
      body: providerData,
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(201);
    expect(data.data.name).toBe('Test Provider');
  });

  it('should get a provider', async () => {
    const { data: createData } = await callRoute(createHandler, {
      method: 'POST',
      body: {
        name: 'Get Provider',
        abn: '11122233344',
        email: 'get@example.com',
        phone_number: '0411111111',
        address: 'Get Ave, Sydney',
      },
      headers: getAuthHeader(adminToken),
    });
    const providerId = createData.data.id;

    const { status, data } = await callRoute(getHandler, {
      method: 'GET',
      params: { id: providerId },
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(200);
    expect(data.data.id).toBe(providerId);
  });

  it('should update a provider', async () => {
    const { data: createData } = await callRoute(createHandler, {
      method: 'POST',
      body: {
        name: 'Original Provider',
        abn: '55566677788',
        email: 'orig@example.com',
        phone_number: '0455555555',
        address: 'Original Address',
      },
      headers: getAuthHeader(adminToken),
    });
    const providerId = createData.data.id;

    const { status, data } = await callRoute(updateHandler, {
      method: 'PATCH',
      params: { id: providerId },
      body: { name: 'Updated Provider' },
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(200);
    expect(data.data.name).toBe('Updated Provider');
  });

  it('should delete a provider', async () => {
    const { data: createData } = await callRoute(createHandler, {
      method: 'POST',
      body: {
        name: 'Delete Provider',
        abn: '99988877766',
        email: 'del@example.com',
        phone_number: '0499999999',
        address: 'Delete Address',
      },
      headers: getAuthHeader(adminToken),
    });
    const providerId = createData.data.id;

    const { status } = await callRoute(deleteHandler, {
      method: 'DELETE',
      params: { id: providerId },
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(204);
  });
});
