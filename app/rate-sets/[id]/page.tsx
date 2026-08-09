'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Table, Select, DatePicker, Slider, Input, Button, Tag, Descriptions, message } from 'antd';
import { CheckCircleTwoTone, CloseCircleTwoTone, ArrowLeftOutlined } from '@ant-design/icons';
import { apiFetch } from '@/lib/api-client';
import dayjs from 'dayjs';

interface RateSet {
  id: number;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  deactivated_at: string | null;
}

interface Category {
  id: number;
  category_number: string;
  category_name: string;
}

interface SupportItem {
  id: number;
  category_id: number;
  item_number: string;
  item_name: string;
}

interface PricingRegion {
  code: string;
  label: string;
  full_label: string;
}

interface PriceRow {
  support_item_id: number;
  item_number: string;
  item_name: string;
  unit: string | null;
  category_number: string;
  category_name: string;
  start_date: string;
  end_date: string | null;
  type_label: string | null;
  is_quote_required: boolean;
  prices: Record<string, number>;
}

export default function RateSetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [rateSet, setRateSet] = useState<RateSet | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [supportItems, setSupportItems] = useState<SupportItem[]>([]);
  const [regions, setRegions] = useState<PricingRegion[]>([]);
  const [priceRows, setPriceRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [categoryFilter, setCategoryFilter] = useState<number | undefined>(undefined);
  const [supportItemFilter, setSupportItemFilter] = useState<number | undefined>(undefined);
  const [startDateFilter, setStartDateFilter] = useState<dayjs.Dayjs | null>(null);
  const [endDateFilter, setEndDateFilter] = useState<dayjs.Dayjs | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | undefined>(undefined);
  const [priceRange, setPriceRange] = useState<[number, number] | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [rs, cats, items, regionsData, prices] = await Promise.all([
        apiFetch<RateSet>(`/api/rate-sets/${id}`),
        apiFetch<Category[]>(`/api/rate-sets/${id}/categories`),
        apiFetch<SupportItem[]>(`/api/rate-sets/${id}/support-items`),
        apiFetch<PricingRegion[]>('/api/pricing-regions'),
        apiFetch<PriceRow[]>(`/api/rate-sets/${id}/prices`),
      ]);
      setRateSet(rs);
      setCategories(cats);
      setSupportItems(items);
      setRegions(regionsData);
      setPriceRows(prices);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    priceRows.forEach((r) => r.type_label && set.add(r.type_label));
    return Array.from(set);
  }, [priceRows]);

  const priceBounds = useMemo(() => {
    let min = Infinity;
    let max = 0;
    priceRows.forEach((r) => {
      Object.values(r.prices).forEach((p) => {
        if (p < min) min = p;
        if (p > max) max = p;
      });
    });
    if (!Number.isFinite(min)) min = 0;
    return [Math.floor(min), Math.ceil(max)] as [number, number];
  }, [priceRows]);

  const categoryNumberById = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((c) => map.set(c.id, c.category_number));
    return map;
  }, [categories]);

  const filteredRows = useMemo(() => {
    const [lo, hi] = priceRange ?? priceBounds;
    return priceRows.filter((row) => {
      if (categoryFilter !== undefined) {
        const catNumber = categoryNumberById.get(categoryFilter);
        if (row.category_number !== catNumber) return false;
      }
      if (supportItemFilter !== undefined && row.support_item_id !== supportItemFilter) return false;
      if (startDateFilter && dayjs(row.start_date).isBefore(startDateFilter, 'day')) return false;
      if (endDateFilter && row.end_date && dayjs(row.end_date).isAfter(endDateFilter, 'day')) return false;
      if (typeFilter !== undefined && row.type_label !== typeFilter) return false;
      const values = Object.values(row.prices);
      if (values.length > 0) {
        const anyInRange = values.some((v) => v >= lo && v <= hi);
        if (!anyInRange) return false;
      }
      return true;
    });
  }, [priceRows, categoryFilter, supportItemFilter, startDateFilter, endDateFilter, typeFilter, priceRange, priceBounds, categoryNumberById]);

  const regionColumns = regions.map((r) => ({
    title: r.label,
    key: r.code,
    render: (_: unknown, row: PriceRow) =>
      row.prices[r.code] != null ? row.prices[r.code].toFixed(2) : '—',
  }));

  return (
    <div style={{ padding: 24 }}>
      <Button icon={<ArrowLeftOutlined />} onClick={() => router.push('/rate-sets')} style={{ marginBottom: 16 }}>
        Back to Rate Sets
      </Button>

      {rateSet && (
        <Descriptions bordered column={4} size="small" style={{ marginBottom: 24 }}>
          <Descriptions.Item label="Name">{rateSet.name}</Descriptions.Item>
          <Descriptions.Item label="Start Date">{dayjs(rateSet.start_date).format('DD/MM/YYYY')}</Descriptions.Item>
          <Descriptions.Item label="End Date">
            {rateSet.end_date ? dayjs(rateSet.end_date).format('DD/MM/YYYY') : 'Open-ended'}
          </Descriptions.Item>
          <Descriptions.Item label="Status">
            {rateSet.deactivated_at === null ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>}
          </Descriptions.Item>
        </Descriptions>
      )}

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Support Category</div>
          <Select
            style={{ width: 220 }}
            placeholder="All Support Categories"
            allowClear
            value={categoryFilter}
            onChange={setCategoryFilter}
            options={categories.map((c) => ({ value: c.id, label: `${c.category_number} — ${c.category_name}` }))}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Support Item</div>
          <Select
            style={{ width: 240 }}
            placeholder="All Support Items"
            allowClear
            showSearch
            optionFilterProp="label"
            value={supportItemFilter}
            onChange={setSupportItemFilter}
            options={supportItems.map((i) => ({ value: i.id, label: `${i.item_number} — ${i.item_name}` }))}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Start Date</div>
          <DatePicker
            style={{ width: 160 }}
            placeholder="Select date"
            format="DD/MM/YYYY"
            value={startDateFilter}
            onChange={setStartDateFilter}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>End Date</div>
          <DatePicker
            style={{ width: 160 }}
            placeholder="Select date"
            format="DD/MM/YYYY"
            value={endDateFilter}
            onChange={setEndDateFilter}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Type</div>
          <Select
            style={{ width: 200 }}
            placeholder="All Types"
            allowClear
            value={typeFilter}
            onChange={setTypeFilter}
            options={typeOptions.map((t) => ({ value: t, label: t }))}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: '#888' }}>Unit Price</div>
        <Input
          style={{ width: 100 }}
          value={(priceRange ?? priceBounds)[0].toFixed(2)}
          readOnly
        />
        <Slider
          range
          style={{ width: 400 }}
          min={priceBounds[0]}
          max={priceBounds[1]}
          value={priceRange ?? priceBounds}
          onChange={(v) => setPriceRange(v as [number, number])}
        />
        <Input
          style={{ width: 100 }}
          value={(priceRange ?? priceBounds)[1].toFixed(2)}
          readOnly
        />
      </div>

      <Table
        rowKey={(row) => `${row.support_item_id}-${row.start_date}-${row.end_date}-${row.type_label}`}
        loading={loading}
        dataSource={filteredRows}
        scroll={{ x: 'max-content' }}
        pagination={{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50', '100'], defaultPageSize: 20 }}
        columns={[
          { title: 'Support Item Number', dataIndex: 'item_number' },
          { title: 'Support Item Name', dataIndex: 'item_name' },
          { title: 'Support Category Number', dataIndex: 'category_number' },
          { title: 'Support Category Name', dataIndex: 'category_name' },
          { title: 'Unit', dataIndex: 'unit', render: (v) => v || '—' },
          {
            title: 'Quote',
            dataIndex: 'is_quote_required',
            align: 'center',
            render: (v: boolean) =>
              v ? <CheckCircleTwoTone twoToneColor="#1677ff" /> : <CloseCircleTwoTone twoToneColor="#1677ff" />,
          },
          {
            title: 'Start Date',
            dataIndex: 'start_date',
            render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
          },
          {
            title: 'End Date',
            dataIndex: 'end_date',
            render: (v: string | null) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
          },
          ...regionColumns,
        ]}
      />
    </div>
  );
}