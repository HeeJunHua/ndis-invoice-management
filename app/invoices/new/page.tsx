'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Select, Input, InputNumber, DatePicker, Button, message, Divider, Radio, Spin } from 'antd';
import { apiClient } from '@/lib/api-client';
import dayjs from 'dayjs';

interface Option { id: number; label: string; }
interface RateSet { id: number; name: string; }
interface Category { id: number; category_number: string; category_name: string; }
interface SupportItem { id: number; category_id: number; item_number: string; item_name: string; }

export default function NewInvoicePage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const [clients, setClients] = useState<Option[]>([]);
  const [providers, setProviders] = useState<Option[]>([]);
  const [rateSets, setRateSets] = useState<RateSet[]>([]);
  const [selectedRateSetId, setSelectedRateSetId] = useState<number | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [supportItems, setSupportItems] = useState<SupportItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const items = Form.useWatch('items', form);

  useEffect(() => {
    if (items && Array.isArray(items)) {
      const total = items.reduce((sum: number, item: any) => {
        const unit = Number(item?.unit) || 0;
        const rate = Number(item?.input_rate) || 0;
        const itemAmount = Math.round((unit * rate) * 100) / 100;
        return sum + itemAmount;
      }, 0);
      form.setFieldsValue({ expected_amount: Math.round(total * 100) / 100 });
    }
  }, [items, form]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [c, p, r] = await Promise.all([
          apiClient.get<{ id: number; first_name: string; last_name: string }[]>('/api/clients'),
          apiClient.get<{ id: number; name: string }[]>('/api/providers'),
          apiClient.get<RateSet[]>('/api/rate-sets'),
        ]);
        setClients(c.map((x) => ({ id: x.id, label: `${x.first_name} ${x.last_name}` })));
        setProviders(p.map((x) => ({ id: x.id, label: x.name })));
        setRateSets(r);
      } catch (e) {
        message.error((e as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function onRateSetChange(rateSetId: number | undefined) {
    setSelectedRateSetId(rateSetId ?? null);
    if (!rateSetId) {
      setCategories([]);
      setSupportItems([]);
      return;
    }
    try {
      const [cats, items] = await Promise.all([
        apiClient.get<Category[]>(`/api/rate-sets/${rateSetId}/categories`),
        apiClient.get<SupportItem[]>(`/api/rate-sets/${rateSetId}/support-items`),
      ]);
      setCategories(cats);
      setSupportItems(items);

      // Clear current items' categories and support items if they don't belong to the new rate set
      form.setFieldsValue({
        items: items.map(item => ({
          ...item,
          category_id: undefined,
          support_item_id: undefined
        }))
      });
    } catch (e) {
      message.error((e as Error).message);
    }
  }

  async function onFinish(values: any) {
    setSubmitting(true);
    try {
      const payload = {
        client_id: values.client_id,
        provider_id: values.provider_id,
        invoice_number: values.invoice_number,
        invoice_date: values.invoice_date?.format('YYYY-MM-DD'),
        expected_amount: values.expected_amount,
        status: values.status ?? 'drafted',
        items: (values.items ?? []).map((item: any) => ({
          category_id: item.category_id,
          support_item_id: item.support_item_id,
          start_date: item.date_range?.[0]?.format('YYYY-MM-DD'),
          end_date: item.date_range?.[1]?.format('YYYY-MM-DD'),
          unit: item.unit,
          input_rate: item.input_rate,
        })),
      };
      await apiClient.post('/api/invoices', payload);
      message.success('Invoice saved');
      router.push('/invoices');
    } catch (e: any) {
      const error = e as any;
      if (error.details) {
        const fieldErrors = Object.entries(error.details).map(([field, messages]) => {
          if (field.startsWith('items[')) {
            const match = field.match(/items\[(\d+)\]\.(.+)/);
            if (match) {
              return {
                name: ['items', parseInt(match[1], 10), match[2]],
                errors: messages as string[],
              };
            }
          }
          return {
            name: field,
            errors: messages as string[],
          };
        });
        form.setFields(fieldErrors);
      }
      message.error(error.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Spin spinning={loading}>
      <div style={{ padding: 24, maxWidth: 800 }}>
        <h1>New Invoice</h1>
        <Form form={form} layout="vertical" onFinish={onFinish} initialValues={{ status: 'drafted', items: [{}] }}>
          <Form.Item name="status" label="Status">
            <Radio.Group>
              <Radio value="drafted">Save as Draft</Radio>
              <Radio value="completed">Save (Complete)</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="client_id" label="Participant">
            <Select
              showSearch
              optionFilterProp="label"
              options={clients.map((c) => ({ value: c.id, label: c.label }))}
            />
          </Form.Item>
          <Form.Item name="provider_id" label="Provider">
            <Select
              showSearch
              optionFilterProp="label"
              options={providers.map((p) => ({ value: p.id, label: p.label }))}
            />
          </Form.Item>
          <Form.Item name="invoice_number" label="Invoice Number" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="invoice_date" label="Invoice Date" rules={[{ required: true }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="expected_amount" label="Expected Amount" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
          </Form.Item>
          <Divider>Rate Set (for line items)</Divider>
          <Form.Item label="Rate Set">
            <Select
              options={rateSets.map((r) => ({ value: r.id, label: r.name }))}
              onChange={onRateSetChange}
              placeholder="Select a rate set to populate categories/items below"
            />
          </Form.Item>
          <Divider>Invoice Items</Divider>
          <Form.List name="items">
            {(fields, { add, remove }) => (
              <>
                {fields.map((field) => (
                  <div key={field.key} style={{ border: '1px solid #eee', padding: 16, marginBottom: 12, borderRadius: 4 }}>
                    <Form.Item {...field} name={[field.name, 'category_id']} label="Category">
                      <Select
                        disabled={!selectedRateSetId}
                        options={categories.map((c) => ({ value: c.id, label: `${c.category_number} — ${c.category_name}` }))}
                      />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'support_item_id']} label="Support Item">
                      <Select
                        disabled={!selectedRateSetId}
                        showSearch
                        optionFilterProp="label"
                        options={supportItems.map((i) => ({ value: i.id, label: `${i.item_number} — ${i.item_name}` }))}
                      />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'date_range']} label="Service Dates">
                      <DatePicker.RangePicker style={{ width: '100%' }} />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'unit']} label="Units">
                      <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
                    </Form.Item>
                    <Form.Item {...field} name={[field.name, 'input_rate']} label="Rate per Unit">
                      <InputNumber style={{ width: '100%' }} min={0} step={0.01} />
                    </Form.Item>
                    <Button danger onClick={() => remove(field.name)}>Remove Item</Button>
                  </div>
                ))}
                <Button onClick={() => add()} block style={{ marginBottom: 16 }}>
                  + Add Item
                </Button>
              </>
            )}
          </Form.List>
          <Button type="primary" htmlType="submit" loading={submitting} block>
            Save Invoice
          </Button>
        </Form>
      </div>
    </Spin>
  );
}
