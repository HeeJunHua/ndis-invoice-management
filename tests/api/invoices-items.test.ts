import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import invoiceService from '@/services/invoice.service';
import { clearDatabase, seedTestDatabase } from '@/tests/db-utils';

describe('Invoice Items Logic', () => {
  let clientId: number;
  let providerId: number;
  let rateSetId: number;
  let categoryId: number;
  let supportItemId: number;

  beforeEach(async () => {
    await clearDatabase();
    await seedTestDatabase();

    // 1. Create Client with pricing region
    const client = await db.insertInto('client').values({
      first_name: 'Test',
      last_name: 'Client',
      name_parts: ['Test', 'Client'],
      email: 'test.client@example.com',
      ndis_number: 'ndis-test-1',
      dob: new Date('1990-01-01'),
      gender_id: 1,
      pricing_region: 'NSW',
      address: 'NSW Address',
      created_at: new Date(),
      updated_at: new Date(),
    }).returningAll().executeTakeFirst();
    clientId = client!.id;

    // 2. Create Provider
    const provider = await db.insertInto('provider').values({
      name: 'Test Provider',
      name_parts: ['Test Provider'],
      abn: 'abn-test-1',
      email: 'test.prov@example.com',
      phone_number: '0400000000',
      address: 'Provider Address',
      created_at: new Date(),
      updated_at: new Date(),
    }).returningAll().executeTakeFirst();
    providerId = provider!.id;

    // 3. Create Rate Set
    const rateSet = await db.insertInto('rate_set').values({
      name: '2024-25 Rate Set',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2025-12-31'),
      created_at: new Date(),
    }).returningAll().executeTakeFirst();
    rateSetId = rateSet!.id;

    // 4. Create Category in Rate Set
    const category = await db.insertInto('rate_set_category').values({
      rate_set_id: rateSetId,
      category_name: 'Support Category',
      category_number: 'CAT-1',
      sorting: 1,
      created_at: new Date(),
      updated_at: new Date(),
    }).returningAll().executeTakeFirst();
    categoryId = category!.id;

    // 5. Create Support Item in Rate Set/Category
    const supportItem = await db.insertInto('rate_set_support_item').values({
      rate_set_id: rateSetId,
      category_id: categoryId,
      item_name: 'Test Support Item',
      item_number: 'ITEM-1',
      sorting: 1,
      unit: 'hour',
      created_at: new Date(),
      updated_at: new Date(),
    }).returningAll().executeTakeFirst();
    supportItemId = supportItem!.id;

    // 6. Create Price for the item in NSW region
    await db.insertInto('rate_set_support_item_price').values({
      rate_set_id: rateSetId,
      support_item_id: supportItemId,
      pricing_region_code: 'NSW',
      start_date: new Date('2024-01-01'),
      end_date: new Date('2025-12-31'),
      unit_price: 100.00,
      created_at: new Date(),
      updated_at: new Date(),
    }).execute();
  });

  it('should create an invoice with items and calculate amount', async () => {
    const input = {
      client_id: clientId,
      provider_id: providerId,
      invoice_number: 'INV-ITEMS-1',
      invoice_date: '2024-06-01',
      expected_amount: 200.00,
      status: 'completed',
      items: [
        {
          category_id: categoryId,
          support_item_id: supportItemId,
          start_date: '2024-06-01',
          end_date: '2024-06-01',
          unit: 1,
          input_rate: 100.00,
        },
        {
          category_id: categoryId,
          support_item_id: supportItemId,
          start_date: '2024-06-02',
          end_date: '2024-06-02',
          unit: 1,
          input_rate: 100.00,
        },
      ],
    };

    const invoice = await invoiceService.create(input);
    expect(invoice.id).toBeDefined();
    expect(invoice.amount).toBe('200');
    expect(invoice.items).toHaveLength(2);
  });

  it('should update an invoice and replace items', async () => {
    const input = {
      client_id: clientId,
      provider_id: providerId,
      invoice_number: 'INV-ITEMS-2',
      invoice_date: '2024-06-01',
      expected_amount: 100.00,
      status: 'completed',
      items: [
        {
          category_id: categoryId,
          support_item_id: supportItemId,
          start_date: '2024-06-01',
          end_date: '2024-06-01',
          unit: 1,
          input_rate: 100.00,
        },
      ],
    };

    const invoice = await invoiceService.create(input);
    const invoiceId = invoice.id;

    const updateInput = {
      ...input,
      expected_amount: 300.00,
      items: [
        {
          category_id: categoryId,
          support_item_id: supportItemId,
          start_date: '2024-06-01',
          end_date: '2024-06-01',
          unit: 3,
          input_rate: 100.00,
        },
      ],
    };

    const updatedInvoice = await invoiceService.update(invoiceId, updateInput);
    expect(updatedInvoice.amount).toBe('300');
    expect(updatedInvoice.items).toHaveLength(1);
    expect(updatedInvoice.items[0].unit).toBe('3');
  });

  it('should fail when expected_amount does not match computed sum', async () => {
    const input = {
      client_id: clientId,
      provider_id: providerId,
      invoice_number: 'INV-ERR-1',
      invoice_date: '2024-06-01',
      expected_amount: 500.00,
      status: 'completed',
      items: [
        {
          category_id: categoryId,
          support_item_id: supportItemId,
          start_date: '2024-06-01',
          end_date: '2024-06-01',
          unit: 1,
          input_rate: 100.00,
        },
      ],
    };

    await expect(invoiceService.create(input)).rejects.toThrow('One or more fields are invalid.');
  });
});
