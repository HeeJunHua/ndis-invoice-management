import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS citext`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);

  await db.schema
    .createTable('app_user')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('email', sql`citext`, (col) => col.notNull())
    .addColumn('full_name', 'text', (col) => col.notNull())
    .addColumn('is_default', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deactivated_at', 'timestamptz')
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('app_user_unique_email_idx')
    .on('app_user')
    .column('email')
    .unique()
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();

  await db.schema
    .createTable('auth_password')
    .addColumn('user_id', 'integer', (col) =>
      col.primaryKey().references('app_user.id').onDelete('cascade'),
    )
    .addColumn('password_hash', 'text', (col) => col.notNull())
    .addColumn('password_updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('rbac_role')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('code', 'text', (col) => col.notNull().unique())
    .addColumn('label', 'text', (col) => col.notNull().unique())
    .addColumn('is_default', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deactivated_at', 'timestamptz')
    .execute();

  await db.schema
    .createTable('rbac_permission')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('code', 'text', (col) => col.notNull().unique())
    .addColumn('label', 'text', (col) => col.notNull().unique())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable('rbac_user_role')
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('app_user.id').onDelete('cascade'),
    )
    .addColumn('role_id', 'integer', (col) =>
      col.notNull().references('rbac_role.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('rbac_user_role_pk', ['user_id', 'role_id'])
    .execute();

  await db.schema
    .createTable('rbac_user_role_permission')
    .addColumn('role_id', 'integer', (col) =>
      col.notNull().references('rbac_role.id').onDelete('cascade'),
    )
    .addColumn('permission_id', 'integer', (col) =>
      col.notNull().references('rbac_permission.id').onDelete('cascade'),
    )
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint('rbac_user_role_permission_pk', ['role_id', 'permission_id'])
    .execute();

  await db.schema.createIndex('rbac_user_role_role_idx').on('rbac_user_role').column('role_id').execute();
  await db.schema
    .createIndex('rbac_user_role_permission_permission_idx')
    .on('rbac_user_role_permission')
    .column('permission_id')
    .execute();

  await db.schema
    .createTable('auth_session')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'integer', (col) =>
      col.notNull().references('app_user.id').onDelete('cascade'),
    )
    .addColumn('role_id', 'integer', (col) =>
      col.notNull().references('rbac_role.id').onDelete('cascade'),
    )
    .addColumn('token_hash', 'text', (col) => col.notNull().unique())
    .addColumn('user_agent', 'text')
    .addColumn('ip', sql`inet`)
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('revoked_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('auth_session_user_id_idx').on('auth_session').column('user_id').execute();
  await db.schema.createIndex('auth_session_role_id_idx').on('auth_session').column('role_id').execute();
  await db.schema
    .createIndex('auth_session_expires_at_idx')
    .on('auth_session')
    .column('expires_at')
    .execute();
  await db.schema
    .createIndex('auth_session_active_idx')
    .on('auth_session')
    .columns(['user_id', 'expires_at'])
    .where(sql.ref('revoked_at'), 'is', null)
    .execute();

  await db.schema
    .createTable('audit_log')
    .addColumn('id', 'bigserial', (col) => col.primaryKey())
    .addColumn('actor_user_id', 'integer', (col) => col.references('app_user.id'))
    .addColumn('actor_role_id', 'integer', (col) => col.references('rbac_role.id'))
    .addColumn('action', 'text', (col) => col.notNull())
    .addColumn('permission_code', 'text', (col) => col.references('rbac_permission.code'))
    .addColumn('entity', 'text', (col) => col.notNull())
    .addColumn('entity_id', 'text')
    .addColumn('payload', 'jsonb')
    .addColumn('changes_diff', 'jsonb')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('audit_log_actor_user_id_idx').on('audit_log').column('actor_user_id').execute();
  await db.schema.createIndex('audit_log_actor_role_id_idx').on('audit_log').column('actor_role_id').execute();
  await db.schema.createIndex('audit_log_action_idx').on('audit_log').column('action').execute();
  await db.schema
    .createIndex('audit_log_permission_code_idx')
    .on('audit_log')
    .column('permission_code')
    .execute();
  await db.schema.createIndex('audit_log_created_at_idx').on('audit_log').column('created_at').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('audit_log').execute();
  await db.schema.dropTable('auth_session').execute();
  await db.schema.dropTable('rbac_user_role_permission').execute();
  await db.schema.dropTable('rbac_user_role').execute();
  await db.schema.dropTable('rbac_permission').execute();
  await db.schema.dropTable('rbac_role').execute();
  await db.schema.dropTable('auth_password').execute();
  await db.schema.dropTable('app_user').execute();
}