import { describe, it, expect, beforeEach } from 'vitest';
import { GET as listHandler, POST as createHandler } from '@/app/api/clients/route';
import { GET as getHandler, PATCH as updateHandler, DELETE as deleteHandler } from '@/app/api/clients/[id]/route';
import { clearDatabase, seedTestDatabase } from '@/tests/db-utils';
import { createTestUser, getAuthHeader } from '@/tests/auth-utils';
import { callRoute } from '@/tests/api-test-utils';

describe('Clients API', () => {
  let adminToken: string;
  let providerToken: string;

  beforeEach(async () => {
    await clearDatabase();
    await seedTestDatabase();

    const admin = await createTestUser({ roleCode: 'admin' });
    adminToken = admin.token;

    const provider = await createTestUser({ roleCode: 'provider' });
    providerToken = provider.token;
  });

  it('should list clients as admin', async () => {
    const { status, data } = await callRoute(listHandler, {
      method: 'GET',
      headers: getAuthHeader(adminToken),
    });

    expect(status).toBe(200);
    expect(data.data).toBeInstanceOf(Array);
  });

  it('should fail to list clients without auth', async () => {
    const { status } = await callRoute(listHandler, {
      method: 'GET',
    });

    expect(status).toBe(401);
  });

  it('should create a client as admin', async () => {
    const clientData = {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      ndis_number: 'ndis-123456',
      dob: '1990-01-01',
      gender_id: 1,
      pricing_region: 'NSW',
      address: '123 Test St, Sydney',
    };

    const { status, data } = await callRoute(createHandler, {
      method: 'POST',
      body: clientData,
      headers: getAuthHeader(adminToken),
    });

    expect(status).toBe(201);
    expect(data.data.id).toBeDefined();
    expect(data.data.first_name).toBe('John');
  });

  it('should fail to create client with invalid data', async () => {
    const invalidData = {
      first_name: '', // Should fail validation
    };

    const { status } = await callRoute(createHandler, {
      method: 'POST',
      body: invalidData,
      headers: getAuthHeader(adminToken),
    });

    expect(status).toBe(400);
  });

  it('should get a specific client', async () => {
    // First create a client
    const { data: createData } = await callRoute(createHandler, {
      method: 'POST',
      body: {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane.doe@example.com',
        ndis_number: 'ndis-654321',
        dob: '1992-05-05',
        gender_id: 2,
        pricing_region: 'VIC',
        address: '456 Test Ave, Melbourne',
      },
      headers: getAuthHeader(adminToken),
    });
    const clientId = createData.data.id;

    const { status, data } = await callRoute(getHandler, {
      method: 'GET',
      params: { id: clientId },
      headers: getAuthHeader(adminToken),
    });

    expect(status).toBe(200);
    expect(data.data.id).toBe(clientId);
    expect(data.data.first_name).toBe('Jane');
  });

  it('should update a client', async () => {
    const { data: createData } = await callRoute(createHandler, {
      method: 'POST',
      body: {
        first_name: 'Original',
        last_name: 'Name',
        email: 'orig@example.com',
        ndis_number: 'ndis-000',
        dob: '1980-01-01',
        gender_id: 1,
        pricing_region: 'NSW',
        address: 'Original Address',
      },
      headers: getAuthHeader(adminToken),
    });
    const clientId = createData.data.id;

    const { status, data } = await callRoute(updateHandler, {
      method: 'PATCH',
      params: { id: clientId },
      body: { first_name: 'Updated' },
      headers: getAuthHeader(adminToken),
    });

    expect(status).toBe(200);
    expect(data.data.first_name).toBe('Updated');
  });

  it('should delete a client', async () => {
    const { data: createData } = await callRoute(createHandler, {
      method: 'POST',
      body: {
        first_name: 'Delete',
        last_name: 'Me',
        email: 'delete@example.com',
        ndis_number: 'ndis-999',
        dob: '1980-01-01',
        gender_id: 1,
        pricing_region: 'NSW',
        address: 'Delete Address',
      },
      headers: getAuthHeader(adminToken),
    });
    const clientId = createData.data.id;

    const { status } = await callRoute(deleteHandler, {
      method: 'DELETE',
      params: { id: clientId },
      headers: getAuthHeader(adminToken),
    });

    expect(status).toBe(204);
  });
});
