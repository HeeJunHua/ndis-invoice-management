import { db } from '@/db';
import { sql } from 'kysely';

/**
 * Clears all data from all tables in the database using CASCADE
 * to handle foreign key constraints.
 */
export async function clearDatabase() {
  const tables = [
    'audit_log',
    'auth_session',
    'auth_password',
    'rbac_user_role_permission',
    'rbac_user_role',
    'rbac_role',
    'rbac_permission',
    'invoice_item',
    'invoice_upload_file',
    'invoice_upload_batch',
    'invoice',
    'client',
    'provider',
    'rate_set_support_item_price',
    'rate_set_support_item_attribute',
    'rate_set_support_item',
    'rate_set_category',
    'rate_set',
    'gender',
    'app_user',
  ];

  for (const table of tables) {
    await sql`TRUNCATE TABLE ${sql.table(table)} RESTART IDENTITY CASCADE`.execute(db);
  }
}

/**
 * Seeds the test database with essential reference data (genders, roles, permissions).
 */
export async function seedTestDatabase() {
  // 1. Genders
  await db.insertInto('gender').values([
    { label: 'Male', code: 'M' },
    { label: 'Female', code: 'F' },
    { label: 'Other', code: 'O' },
  ]).execute();

  // 2. Permissions
  const permissions = [
    { label: 'Manage Clients', code: 'clients:manage' },
    { label: 'Manage Providers', code: 'providers:manage' },
    { label: 'Manage Invoices', code: 'invoices:manage' },
    { label: 'Manage Rate Sets', code: 'ratesets:manage' },
    { label: 'Manage Users', code: 'users:manage' },
  ];
  await db.insertInto('rbac_permission').values(permissions).execute();

  // 3. Roles
  await db.insertInto('rbac_role').values([
    { label: 'Administrator', code: 'admin', is_default: false },
    { label: 'Provider', code: 'provider', is_default: true },
  ]).execute();

  // 4. Role-Permission Mapping (Admin gets everything)
  const roles = await db.selectFrom('rbac_role').selectAll().execute();
  const perms = await db.selectFrom('rbac_permission').selectAll().execute();

  const adminRole = roles.find(r => r.code === 'admin');
  if (adminRole) {
    const adminPerms = perms.map(p => ({
      role_id: adminRole.id,
      permission_id: p.id,
      created_at: new Date(),
    }));
    await db.insertInto('rbac_user_role_permission').values(adminPerms).execute();
  }
}
