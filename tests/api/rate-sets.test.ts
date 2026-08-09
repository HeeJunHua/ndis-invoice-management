import { describe, it, expect, beforeEach } from 'vitest';
import { GET as listHandler, POST as createHandler } from '@/app/api/rate-sets/route';
import { GET as getHandler, PATCH as updateHandler, DELETE as deleteHandler } from '@/app/api/rate-sets/[id]/route';
import { clearDatabase, seedTestDatabase } from '@/tests/db-utils';
import { createTestUser, getAuthHeader } from '@/tests/auth-utils';
import { callRoute } from '@/tests/api-test-utils';

describe('Rate Sets API', () => {
  let adminToken: string;

  beforeEach(async () => {
    await clearDatabase();
    await seedTestDatabase();
    const admin = await createTestUser({ roleCode: 'admin' });
    adminToken = admin.token;
  });

  it('should list rate sets as admin', async () => {
    const { status, data } = await callRoute(listHandler, {
      method: 'GET',
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(200);
    expect(data.data).toBeInstanceOf(Array);
  });

  it('should create a rate set', async () => {
    const rateSetData = {
      name: '2024-25 Support Catalogue',
      start_date: '2024-07-01',
      description: 'Test Rate Set',
    };
    const { status, data } = await callRoute(createHandler, {
      method: 'POST',
      body: rateSetData,
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(201);
    expect(data.data.name).toBe('2024-25 Support Catalogue');
  });

  it('should get a rate set', async () => {
    const { data: createData } = await callRoute(createHandler, {
      method: 'POST',
      body: {
        name: 'Get Rate Set',
        start_date: '2024-07-01',
        description: 'Get Rate Set Desc',
      },
      headers: getAuthHeader(adminToken),
    });
    const rateSetId = createData.data.id;

    const { status, data } = await callRoute(getHandler, {
      method: 'GET',
      params: { id: rateSetId },
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(200);
    expect(data.data.id).toBe(rateSetId);
  });

  it('should update a rate set', async () => {
    const { data: createData } = await callRoute(createHandler, {
      method: 'POST',
      body: {
        name: 'Original Rate Set',
        start_date: '2024-07-01',
        description: 'Original Desc',
      },
      headers: getAuthHeader(adminToken),
    });
    const rateSetId = createData.data.id;

    const { status, data } = await callRoute(updateHandler, {
      method: 'PATCH',
      params: { id: rateSetId },
      body: { name: 'Updated Rate Set' },
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(200);
    expect(data.data.name).toBe('Updated Rate Set');
  });

  it('should delete a rate set', async () => {
    const { data: createData } = await callRoute(createHandler, {
      method: 'POST',
      body: {
        name: 'Delete Rate Set',
        start_date: '2024-07-01',
        description: 'Delete Rate Set Desc',
      },
      headers: getAuthHeader(adminToken),
    });
    const rateSetId = createData.data.id;

    const { status } = await callRoute(deleteHandler, {
      method: 'DELETE',
      params: { id: rateSetId },
      headers: getAuthHeader(adminToken),
    });
    expect(status).toBe(204);
  });
});
