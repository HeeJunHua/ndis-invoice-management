import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('gender')
    .addColumn('id', 'smallint', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('code', 'text', (col) => col.notNull().unique())
    .addColumn('label', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deactivated_at', 'timestamptz')
    .execute();

  await db.schema
    .createTable('client')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('first_name', 'text', (col) => col.notNull())
    .addColumn('last_name', 'text', (col) => col.notNull())
    .addColumn('name_parts', sql`text[]`, (col) => col.notNull())
    .addColumn('gender_id', 'smallint', (col) => col.notNull().references('gender.id'))
    .addColumn('dob', 'date', (col) => col.notNull())
    .addColumn('ndis_number', 'text', (col) => col.notNull())
    .addColumn('email', 'text', (col) => col.notNull())
    .addColumn('phone_number', 'text')
    .addColumn('address', 'text', (col) => col.notNull())
    .addColumn('unit_building', 'text')
    .addColumn('pricing_region', 'text', (col) =>
      col.notNull().references('rate_set_support_item_pricing_region.code'),
    )
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deactivated_at', 'timestamptz')
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await db.schema
    .createIndex('client_unique_ndis_number')
    .on('client')
    .column('ndis_number')
    .unique()
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();

  await sql`
    CREATE OR REPLACE FUNCTION client_set_name_parts()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      NEW.name_parts :=
        array_remove(
          regexp_split_to_array(
            trim(lower(concat_ws(' ', NEW.first_name, NEW.last_name))),
            '[^[:alnum:]]+'
          ),
          ''
        );
      RETURN NEW;
    END;
    $function$;
  `.execute(db);

  await sql`DROP TRIGGER IF EXISTS client_set_name_parts ON client`.execute(db);

  await sql`
    CREATE TRIGGER client_set_name_parts
    BEFORE INSERT OR UPDATE OF first_name, last_name ON client
    FOR EACH ROW
    EXECUTE FUNCTION client_set_name_parts();
  `.execute(db);

  await db.schema
    .createIndex('client_name_parts')
    .on('client')
    .using('gin')
    .column('name_parts')
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();

  await db.schema
    .createTable('provider')
    .addColumn('id', 'integer', (col) => col.generatedAlwaysAsIdentity().primaryKey())
    .addColumn('abn', 'text', (col) => col.notNull())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('name_parts', sql`text[]`, (col) => col.notNull())
    .addColumn('email', 'text')
    .addColumn('phone_number', 'text')
    .addColumn('address', 'text')
    .addColumn('unit_building', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('deactivated_at', 'timestamptz')
    .addColumn('deleted_at', 'timestamptz')
    .execute();

  await sql`
    CREATE OR REPLACE FUNCTION provider_set_name_parts()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $function$
    BEGIN
      NEW.name_parts :=
        array_remove(
          regexp_split_to_array(
            trim(lower(NEW.name)),
            '[^[:alnum:]]+'
          ),
          ''
        );
      RETURN NEW;
    END;
    $function$;
  `.execute(db);

  await sql`DROP TRIGGER IF EXISTS provider_set_name_parts ON provider`.execute(db);

  await sql`
    CREATE TRIGGER provider_set_name_parts
    BEFORE INSERT OR UPDATE OF name ON provider
    FOR EACH ROW
    EXECUTE FUNCTION provider_set_name_parts();
  `.execute(db);

  await db.schema
    .createIndex('provider_name_parts')
    .on('provider')
    .using('gin')
    .column('name_parts')
    .where(sql.ref('deleted_at'), 'is', null)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TRIGGER IF EXISTS provider_set_name_parts ON provider`.execute(db);
  await sql`DROP FUNCTION IF EXISTS provider_set_name_parts()`.execute(db);
  await db.schema.dropTable('provider').execute();

  await sql`DROP TRIGGER IF EXISTS client_set_name_parts ON client`.execute(db);
  await sql`DROP FUNCTION IF EXISTS client_set_name_parts()`.execute(db);
  await db.schema.dropTable('client').execute();

  await db.schema.dropTable('gender').execute();
}