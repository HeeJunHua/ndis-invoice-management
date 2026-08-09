import { db } from '@/db';
import argon2 from 'argon2';

/**
 * Creates a test user and a corresponding session token.
 */
export async function createTestUser({
  email = 'test@example.com',
  roleCode = 'admin',
  fullName = 'Test User'
}: {
  email?: string,
  roleCode?: string,
  fullName?: string
} = {}) {
  // 1. Create User
  const user = await db.insertInto('app_user')
    .values({
      email,
      full_name: fullName,
      created_at: new Date(),
      updated_at: new Date(),
    })
    .returningAll()
    .executeTakeFirst();

  if (!user) throw new Error('Failed to create test user');

  // 2. Create Password
  const hash = await argon2.hash('password123');
  await db.insertInto('auth_password')
    .values({
      user_id: user.id,
      password_hash: hash,
      password_updated_at: new Date(),
    })
    .execute();

  // 3. Assign Role
  const role = await db.selectFrom('rbac_role')
    .where('code', '=', roleCode)
    .selectAll()
    .executeTakeFirst();

  if (!role) throw new Error(`Role ${roleCode} not found`);

  await db.insertInto('rbac_user_role')
    .values({
      user_id: user.id,
      role_id: role.id,
      created_at: new Date(),
    })
    .execute();

  // 4. Create Session
  const token = Math.random().toString(36).substring(2) + Date.now().toString(36);
  const tokenHash = await argon2.hash(token);

  await db.insertInto('auth_session')
    .values({
      user_id: user.id,
      role_id: role.id,
      token_hash: tokenHash,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
      created_at: new Date(),
      ip: '127.0.0.1',
      user_agent: 'test-agent',
    })
    .execute();

  return {
    user,
    token,
    roleCode,
  };
}

/**
 * Helper to generate the cookie header for authenticated requests.
 */
export function getAuthHeader(token: string) {
  return {
    'Cookie': `session_token=${token}`,
  };
}
