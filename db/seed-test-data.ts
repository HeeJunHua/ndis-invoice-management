import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { DB, Client, Provider, RateSetCategory, RateSetSupportItem } from './schema';

async function seedTestData() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const db = new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: process.env.DATABASE_URL }),
    }),
  });

  try {
    console.log('Seeding test data...');

    // 1. Client
    let client = await db.selectFrom('client').where('ndis_number', '=', '123456789012').executeTakeFirst();
    if (!client) {
      client = await db.insertInto('client')
        .values({
          first_name: 'Test',
          last_name: 'Client',
          gender_id: 1,
          dob: new Date('1990-01-01'),
          ndis_number: '123456789012',
          email: 'testclient@example.com',
          address: '123 Test St',
          pricing_region: 'VIC',
          name_parts: ['test', 'client'],
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    const clientFinal = client as Client;

    // 2. Provider
    let provider = await db.selectFrom('provider').where('abn', '=', '12345678901').executeTakeFirst();
    if (!provider) {
      provider = await db.insertInto('provider')
        .values({
          abn: '12345678901',
          name: 'Test Provider',
          email: 'testprovider@example.com',
          address: '456 Provider Rd',
          name_parts: ['test', 'provider'],
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    const providerFinal = provider as Provider;

    // Use existing Rate Set 1
    const rateSetId = 1;

    // 3. Category
    let category = await db.selectFrom('rate_set_category')
      .where('rate_set_id', '=', rateSetId)
      .where('category_number', '=', 'TEST-CAT')
      .executeTakeFirst();
    if (!category) {
      category = await db.insertInto('rate_set_category')
        .values({
          rate_set_id: rateSetId,
          category_number: 'TEST-CAT',
          category_name: 'Test Category',
          sorting: 1,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    const categoryFinal = category as RateSetCategory;

    // 4. Support Item
    let supportItem = await db.selectFrom('rate_set_support_item')
      .where('rate_set_id', '=', rateSetId)
      .where('item_number', '=', 'TEST-ITEM')
      .executeTakeFirst();
    if (!supportItem) {
      supportItem = await db.insertInto('rate_set_support_item')
        .values({
          rate_set_id: rateSetId,
          category_id: categoryFinal.id as unknown as number,
          item_number: 'TEST-ITEM',
          item_name: 'Test Support Item',
          unit: 'Hour',
          sorting: 1,
          created_at: new Date(),
          updated_at: new Date(),
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    }
    const supportItemFinal = supportItem as RateSetSupportItem;

    // 5. Price
    await db.insertInto('rate_set_support_item_price')
      .values({
        rate_set_id: rateSetId,
        support_item_id: supportItemFinal.id as unknown as number,
        pricing_region_code: 'VIC',
        start_date: new Date('2026-01-01'),
        unit_price: '100.00',
        created_at: new Date(),
        updated_at: new Date(),
      })
      .onConflict((oc) => oc
        .columns(['rate_set_id', 'support_item_id', 'type_id', 'pricing_region_code', 'start_date', 'end_date'])
        .doNothing()
      )
      .execute();

    console.log('Test data seeded successfully:');
    console.log(`Client ID: ${clientFinal.id}`);
    console.log(`Provider ID: ${providerFinal.id}`);
    console.log(`Rate Set ID: ${rateSetId}`);
    console.log(`Support Item ID: ${supportItemFinal.id}`);

  } catch (error) {
    console.error('Test data seeding failed:', error);
  } finally {
    await db.destroy();
  }
}

seedTestData();
