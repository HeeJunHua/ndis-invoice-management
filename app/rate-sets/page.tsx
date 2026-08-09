'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  DatePicker,
  Upload,
  Popconfirm,
  message,
  Tag,
  Slider,
  InputNumber,
  Row,
  Col,
} from 'antd';
import {
  UploadOutlined,
  PlusOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';
import dayjs from 'dayjs';

interface RateSet {
  id: number;
  name: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface NdisItemRate {
  id: number;
  support_item_number: string;
  support_item_name: string;
  support_category_number: string;
  support_category_name: string;
  unit: string;
  quote: boolean;
  start_date: string;
  end_date: string;
  act?: number | string;
  nsw?: number | string;
  nt?: number | string;
  qld?: number | string;
  sa?: number | string;
  tas?: number | string;
  vic?: number | string;
  wa?: number | string;
  remote?: number | string;
  very_remote?: number | string;
  non_face_to_face?: boolean;
  provider_travel?: boolean;
  short_notice_cancellations?: boolean;
  ndia_requested_reports?: boolean;
  irregular_sil_supports?: boolean;
  type?: string;
}

interface RateSetDetail extends RateSet {
  items?: NdisItemRate[];
}

export default function RateSetsPage() {
  const [rateSets, setRateSets] = useState<RateSet[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<RateSet | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [form] = Form.useForm();

  // Associated Item Rates State
  const [rates, setRates] = useState<NdisItemRate[]>([]);
  const [ratesLoading, setRatesLoading] = useState(false);

  // Dynamic Slider Ceiling & Current Price Range
  const [sliderMax, setSliderMax] = useState<number>(10000);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);

  // Edit Modal Filters
  const [filterCategory, setFilterCategory] = useState<string | undefined>(undefined);
  const [filterItem, setFilterItem] = useState<string | undefined>(undefined);
  const [filterStartDate, setFilterStartDate] = useState<dayjs.Dayjs | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<dayjs.Dayjs | null>(null);
  const [filterType, setFilterType] = useState<string | undefined>(undefined);

  // Main Table Filters
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | undefined>(undefined);

  // Validation Banner States
  const [overlapError, setOverlapError] = useState<string | null>(null);
  const [gapWarning, setGapWarning] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await apiClient.get<RateSet[]>('/api/rate-sets');
      setRateSets(res);
    } catch (e) {
      message.error((e as Error).message || 'Failed to fetch rate sets');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function fetchRateSetDetails(rateSetId: number) {
    setRatesLoading(true);
    try {
      const res = await apiClient.get<RateSetDetail>(`/api/rate-sets/${rateSetId}`);
      const list = res?.items || [];
      setRates(list);

      // Find ceiling rate across ALL 10 pricing regions
      let absoluteMax = 0;
      list.forEach((r) => {
        const prices = [
          Number(r.act), Number(r.nsw), Number(r.nt), Number(r.qld),
          Number(r.sa), Number(r.tas), Number(r.vic), Number(r.wa),
          Number(r.remote), Number(r.very_remote)
        ].filter((p) => !isNaN(p) && p > 0);

        if (prices.length > 0) {
          const itemMax = Math.max(...prices);
          if (itemMax > absoluteMax) absoluteMax = itemMax;
        }
      });
      const calculatedMax = absoluteMax > 0 ? absoluteMax : 1000;
      setSliderMax(calculatedMax);
      setPriceRange([0, calculatedMax]);
    } catch (e) {
      console.warn('Could not fetch rate set details', e);
      setRates([]);
    } finally {
      setRatesLoading(false);
    }
  }

  // Dynamic Options derived from fetched rates
  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    rates.forEach((r) => {
      if (r.support_category_name) set.add(r.support_category_name);
    });
    return Array.from(set).sort().map((c) => ({ label: c, value: c }));
  }, [rates]);

  const itemOptions = useMemo(() => {
    const itemsMap = new Map<string, string>();
    rates.forEach((r) => {
      if (r.support_item_name) {
        itemsMap.set(r.support_item_name, `${r.support_item_number} - ${r.support_item_name}`);
      }
    });
    return Array.from(itemsMap.entries()).map(([itemName, label]) => ({
      label,
      value: itemName,
    }));
  }, [rates]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    rates.forEach((r) => {
      if (r.type) set.add(r.type);
    });
    return Array.from(set).sort().map((t) => ({ label: t, value: t }));
  }, [rates]);

  function handleCloseModal() {
    setModalOpen(false);
    setEditing(null);
    setSelectedFile(null);
    setOverlapError(null);
    setGapWarning(null);
    setFilterCategory(undefined);
    setFilterItem(undefined);
    setFilterStartDate(null);
    setFilterEndDate(null);
    setFilterType(undefined);
    form.resetFields();
  }

  function openCreate() {
    setEditing(null);
    setRates([]);
    setSelectedFile(null);
    setOverlapError(null);
    setGapWarning(null);
    form.resetFields();
    form.setFieldsValue({ active: true });
    setModalOpen(true);
  }

  function openEdit(rateSet: RateSet) {
    setEditing(rateSet);
    setSelectedFile(null);
    setOverlapError(null);
    setGapWarning(null);
    form.setFieldsValue({
      ...rateSet,
      start_date: dayjs(rateSet.start_date),
      end_date: rateSet.end_date ? dayjs(rateSet.end_date) : null,
      active: rateSet.deactivated_at === null,
    });
    setModalOpen(true);
    fetchRateSetDetails(rateSet.id);
  }

  function evaluateDateRange(start?: dayjs.Dayjs | null, end?: dayjs.Dayjs | null) {
    setOverlapError(null);
    setGapWarning(null);

    if (!start) return;

    const curStart = start.startOf('day');
    const curEnd = end ? end.endOf('day') : dayjs('2099-12-31');

    const otherSets = rateSets.filter((r) => !editing || r.id !== editing.id);

    // 1. Overlap Check
    for (const rs of otherSets) {
      const rsStart = dayjs(rs.start_date).startOf('day');
      const rsEnd = rs.end_date ? dayjs(rs.end_date).endOf('day') : dayjs('2099-12-31');

      const overlaps =
        (curStart.isBefore(rsEnd) || curStart.isSame(rsEnd, 'day')) &&
        (curEnd.isAfter(rsStart) || curEnd.isSame(rsStart, 'day'));

      if (overlaps) {
        const msg = `Date range overlaps with an existing Rate Set: ${rs.name} (${dayjs(rs.start_date).format('DD/MM/YYYY')} - ${rs.end_date ? dayjs(rs.end_date).format('DD/MM/YYYY') : 'Open'})`;
        setOverlapError(msg);
        return msg;
      }
    }

    // 2. Gap Check
    if (otherSets.length > 0) {
      const adjacent = otherSets.map(
        (s) => `${s.name} (${dayjs(s.start_date).format('DD/MM/YYYY')} - ${s.end_date ? dayjs(s.end_date).format('DD/MM/YYYY') : 'Open'})`
      );
      setGapWarning(`Warning: this date range leaves a gap with adjacent Rate Sets: ${adjacent.join(', ')}`);
    }

    return null;
  }

  async function onFinish(values: Record<string, unknown>) {
    const start = values.start_date as dayjs.Dayjs;
    const end = values.end_date as dayjs.Dayjs | null;

    const overlapMsg = evaluateDateRange(start, end);
    if (overlapMsg) {
      message.error('Please resolve date range overlap before saving.');
      return;
    }

    setSaving(true);
    const { active, ...rest } = values;
    const payload = {
      ...rest,
      start_date: start.format('YYYY-MM-DD'),
      end_date: end ? end.format('YYYY-MM-DD') : null,
    };

    try {
      let rateSetId: number;
      if (editing) {
        await apiClient.patch(`/api/rate-sets/${editing.id}`, payload);
        rateSetId = editing.id;
        const wasActive = editing.deactivated_at === null;
        if (typeof active === 'boolean' && active !== wasActive) {
          await apiClient.patch(`/api/rate-sets/${editing.id}/status`, { active });
        }
      } else {
        const created = await apiClient.post<RateSet>('/api/rate-sets', payload);
        rateSetId = created.id;
      }

      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        const res = await fetch(`/api/rate-sets/${rateSetId}/import`, { method: 'POST', body: formData });
        if (!res.ok) throw new Error('File import failed');
      }

      message.success(editing ? 'Rate set updated' : 'Rate set created');
      handleCloseModal();
      load();
    } catch (e: any) {
      message.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiClient.delete(`/api/rate-sets/${id}`);
      message.success('Rate set deleted');
      load();
    } catch (e) {
      message.error((e as Error).message || 'Delete failed');
    }
  }

  const filteredRateSets = useMemo(() => {
    return rateSets.filter((rs) => {
      if (searchText && !rs.name.toLowerCase().includes(searchText.toLowerCase())) return false;
      if (statusFilter === 'active' && rs.deactivated_at !== null) return false;
      if (statusFilter === 'inactive' && rs.deactivated_at === null) return false;
      return true;
    });
  }, [rateSets, searchText, statusFilter]);

  const filteredRates = useMemo(() => {
    return rates.filter((r) => {
      if (filterCategory && r.support_category_name !== filterCategory) return false;
      if (filterItem && r.support_item_name !== filterItem && !r.support_item_name.toLowerCase().includes(filterItem.toLowerCase())) {
        return false;
      }
      if (filterType && r.type !== filterType) return false;

      if (filterStartDate && dayjs(r.start_date).isBefore(filterStartDate, 'day')) return false;
      if (filterEndDate && r.end_date && dayjs(r.end_date).isAfter(filterEndDate, 'day')) return false;

      const prices = [
        Number(r.act), Number(r.nsw), Number(r.nt), Number(r.qld),
        Number(r.sa), Number(r.tas), Number(r.vic), Number(r.wa),
        Number(r.remote), Number(r.very_remote)
      ].filter((p) => !isNaN(p));

      if (prices.length > 0) {
        const maxItemPrice = Math.max(...prices);
        if (maxItemPrice < priceRange[0] || maxItemPrice > priceRange[1]) return false;
      }
      return true;
    });
  }, [rates, filterCategory, filterItem, filterType, filterStartDate, filterEndDate, priceRange]);

  return (
    <div style={{ padding: 24 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 4 }}>Rate Set Management</h1>
        <p style={{ color: '#888', margin: 0 }}>Manage NDIS pricing rate sets.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={load}>
          Refresh
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          Add Rate Set
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Name</div>
          <Input
            placeholder="Search rate set name"
            style={{ width: 280 }}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Active</div>
          <Select
            style={{ width: 160 }}
            placeholder="All statuses"
            allowClear
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>
      </div>

      {/* Main Table */}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredRateSets}
        pagination={{ defaultPageSize: 20 }}
        columns={[
          { title: 'Name', dataIndex: 'name' },
          { title: 'Description', dataIndex: 'description', render: (v) => v || '—' },
          { title: 'Start Date', dataIndex: 'start_date', render: (v) => dayjs(v).format('DD/MM/YYYY') },
          { title: 'End Date', dataIndex: 'end_date', render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—') },
          {
            title: 'Active',
            dataIndex: 'deactivated_at',
            align: 'center',
            render: (v) => (v === null ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>),
          },
          {
            title: 'Actions',
            render: (_, record) => (
              <>
                <Button onClick={() => openEdit(record)}>Edit</Button>
                <Popconfirm title="Delete rate set?" onConfirm={() => handleDelete(record.id)}>
                  <Button danger style={{ marginLeft: 8 }}>
                    Delete
                  </Button>
                </Popconfirm>
              </>
            ),
          },
        ]}
      />

      {/* ADD RATE SET POPUP MODAL */}
      {!editing && (
        <Modal
          title="Add Rate Set"
          open={modalOpen}
          onCancel={handleCloseModal}
          footer={[
            <Button key="cancel" onClick={handleCloseModal}>
              Cancel
            </Button>,
            <Button key="save" type="primary" onClick={() => form.submit()} loading={saving}>
              Save
            </Button>,
          ]}
          width={480}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            style={{ marginTop: 16 }}
            onValuesChange={() => {
              const start = form.getFieldValue('start_date');
              const end = form.getFieldValue('end_date');
              evaluateDateRange(start, end);
            }}
          >
            <Form.Item
              name="name"
              label="Name"
              required
              rules={[
                { required: true, message: 'Name is required' },
                { whitespace: true, message: 'Name cannot be blank' },
              ]}
            >
              <Input placeholder="e.g., November 2025" />
            </Form.Item>

            <Form.Item name="description" label="Description">
              <Input.TextArea
                placeholder="e.g., NDIS Pricing Arrangements and Price Limits effective from 24 November 2025"
                rows={2}
              />
            </Form.Item>

            <Form.Item
              name="start_date"
              label="Start Date"
              required
              rules={[{ required: true, message: 'Start Date is required' }]}
            >
              <DatePicker placeholder="Select date" style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>

            {overlapError && (
              <div style={{ color: '#ff4d4f', fontSize: 12, marginTop: -8, marginBottom: 12 }}>
                {overlapError}
              </div>
            )}

            {gapWarning && (
              <div style={{ color: '#faad14', fontSize: 12, marginTop: -8, marginBottom: 12 }}>
                {gapWarning}
              </div>
            )}

            <Form.Item
              name="end_date"
              label="End Date"
              dependencies={['start_date']}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value) return Promise.resolve();
                    const startDate = getFieldValue('start_date');
                    if (startDate && value.isBefore(startDate, 'day')) {
                      return Promise.reject(new Error('End date cannot be before Start date'));
                    }
                    return Promise.resolve();
                  },
                }),
              ]}
            >
              <DatePicker
                placeholder="Select date"
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                disabledDate={(current) => {
                  const startDate = form.getFieldValue('start_date');
                  return startDate ? current.isBefore(startDate, 'day') : false;
                }}
              />
            </Form.Item>

            <Form.Item name="active" label="Active" valuePropName="checked" initialValue={true}>
              <Switch />
            </Form.Item>

            <Form.Item label="Upload NDIS Pricing Arrangements and Price Limits Excel">
              <Upload
                accept=".xlsx"
                maxCount={1}
                beforeUpload={(file) => {
                  setSelectedFile(file);
                  return false;
                }}
                onRemove={() => setSelectedFile(null)}
              >
                <Button icon={<UploadOutlined />}>Select File</Button>
              </Upload>
            </Form.Item>
          </Form>
        </Modal>
      )}

      {/* EDIT RATE SET FULL-SCREEN MODAL */}
      {editing && (
        <Modal
          open={modalOpen}
          onCancel={handleCloseModal}
          footer={null}
          width="100vw"
          style={{ top: 0, padding: 0, maxWidth: '100vw' }}
          styles={{ body: { padding: '16px 24px', minHeight: '100vh' } }}
          closeIcon={null}
        >
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
                paddingBottom: 12,
                borderBottom: '1px solid #f0f0f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18, fontWeight: 600 }}>
                <CloseOutlined style={{ cursor: 'pointer', fontSize: 16 }} onClick={handleCloseModal} />
                Edit Rate Set
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={handleCloseModal}>Cancel</Button>
                <Button type="primary" onClick={() => form.submit()} loading={saving}>
                  Save
                </Button>
              </div>
            </div>

            <Row gutter={16} align="bottom" style={{ marginBottom: 16 }}>
              <Col span={6}>
                <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
                  <Input placeholder="T1" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="description" label="Description">
                  <Input placeholder="e.g., NDIS Pricing Arrangements and Price Limits effective from 24 November 2025" />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="start_date" label="Start Date" rules={[{ required: true, message: 'Start Date is required' }]}>
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={4}>
                <Form.Item name="end_date" label="End Date">
                  <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={2}>
                <Form.Item name="active" label="Active" valuePropName="checked" initialValue={true}>
                  <Switch />
                </Form.Item>
              </Col>
            </Row>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>
                Upload NDIS Pricing Arrangements and Price Limits Excel
              </div>
              <Upload
                accept=".xlsx"
                maxCount={1}
                beforeUpload={(file) => {
                  setSelectedFile(file);
                  return false;
                }}
                onRemove={() => setSelectedFile(null)}
              >
                <Button icon={<UploadOutlined />}>Select File</Button>
              </Upload>
            </div>

            {/* Filter Toolbar */}
            <Row gutter={16} style={{ marginBottom: 16 }}>
              <Col span={4}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Support Category</div>
                <Select
                  placeholder="All Support Categories"
                  style={{ width: '100%' }}
                  allowClear
                  showSearch
                  options={categoryOptions}
                  value={filterCategory}
                  onChange={setFilterCategory}
                />
              </Col>
              <Col span={5}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Support Item</div>
                <Select
                  placeholder="All Support Items"
                  style={{ width: '100%' }}
                  allowClear
                  showSearch
                  options={itemOptions}
                  value={filterItem}
                  onChange={setFilterItem}
                />
              </Col>
              <Col span={4}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Start Date</div>
                <DatePicker
                  placeholder="Select date"
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  value={filterStartDate}
                  onChange={setFilterStartDate}
                />
              </Col>
              <Col span={4}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>End Date</div>
                <DatePicker
                  placeholder="Select date"
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  value={filterEndDate}
                  onChange={setFilterEndDate}
                />
              </Col>
              <Col span={4}>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Type</div>
                <Select
                  placeholder="All Types"
                  style={{ width: '100%' }}
                  allowClear
                  showSearch
                  options={typeOptions}
                  value={filterType}
                  onChange={setFilterType}
                />
              </Col>
            </Row>

            {/* Unit Price Slider */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 4 }}>Unit Price</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <InputNumber
                  min={0}
                  max={priceRange[1]}
                  value={priceRange[0]}
                  precision={2}
                  onChange={(val) => setPriceRange([val || 0, priceRange[1]])}
                  style={{ width: 120 }}
                />
                <Slider
                  range
                  min={0}
                  max={sliderMax}
                  step={0.01}
                  value={priceRange}
                  onChange={(val) => setPriceRange(val as [number, number])}
                  style={{ flex: 1 }}
                />
                <InputNumber
                  min={priceRange[0]}
                  max={sliderMax}
                  value={priceRange[1]}
                  precision={2}
                  onChange={(val) => setPriceRange([priceRange[0], val || sliderMax])}
                  style={{ width: 120 }}
                />
              </div>
            </div>

            <Table
              rowKey={(record) => String(record.id ?? record.support_item_number)}
              loading={ratesLoading}
              dataSource={filteredRates}
              size="small"
              scroll={{ x: 3200, y: 450 }}
              pagination={{
                defaultPageSize: 50,
                showSizeChanger: true,
                pageSizeOptions: ['20', '50', '100', '200'],
              }}
              columns={[
                {
                  title: 'Support Item Number',
                  dataIndex: 'support_item_number',
                  width: 180,
                  fixed: 'left',
                },
                {
                  title: 'Support Item Name',
                  dataIndex: 'support_item_name',
                  width: 300,
                  ellipsis: true,
                },
                {
                  title: 'Support Category Number',
                  dataIndex: 'support_category_number',
                  width: 180,
                  align: 'center',
                },
                {
                  title: 'Support Category Name',
                  dataIndex: 'support_category_name',
                  width: 220,
                  ellipsis: true,
                },
                {
                  title: 'Unit',
                  dataIndex: 'unit',
                  width: 80,
                  align: 'center',
                },
                {
                  title: 'Quote',
                  dataIndex: 'quote',
                  width: 80,
                  align: 'center',
                  render: (v) =>
                    v ? <CheckCircleOutlined style={{ color: '#1890ff' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                },
                {
                  title: 'Start Date',
                  dataIndex: 'start_date',
                  width: 120,
                  render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
                },
                {
                  title: 'End Date',
                  dataIndex: 'end_date',
                  width: 120,
                  render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—'),
                },
                { title: 'ACT', dataIndex: 'act', width: 90, render: (v) => (v ? Number(v).toFixed(2) : '-') },
                { title: 'NSW', dataIndex: 'nsw', width: 90, render: (v) => (v ? Number(v).toFixed(2) : '-') },
                { title: 'NT', dataIndex: 'nt', width: 90, render: (v) => (v ? Number(v).toFixed(2) : '-') },
                { title: 'QLD', dataIndex: 'qld', width: 90, render: (v) => (v ? Number(v).toFixed(2) : '-') },
                { title: 'SA', dataIndex: 'sa', width: 90, render: (v) => (v ? Number(v).toFixed(2) : '-') },
                { title: 'TAS', dataIndex: 'tas', width: 90, render: (v) => (v ? Number(v).toFixed(2) : '-') },
                { title: 'VIC', dataIndex: 'vic', width: 90, render: (v) => (v ? Number(v).toFixed(2) : '-') },
                { title: 'WA', dataIndex: 'wa', width: 90, render: (v) => (v ? Number(v).toFixed(2) : '-') },
                { title: 'Remote', dataIndex: 'remote', width: 90, render: (v) => (v ? Number(v).toFixed(2) : '-') },
                { title: 'Very Remote', dataIndex: 'very_remote', width: 100, render: (v) => (v ? Number(v).toFixed(2) : '-') },
                {
                  title: 'Non-Face-to-Face Support Provision',
                  dataIndex: 'non_face_to_face',
                  width: 220,
                  align: 'center',
                  render: (v) =>
                    v ? <CheckCircleOutlined style={{ color: '#1890ff' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                },
                {
                  title: 'Provider Travel',
                  dataIndex: 'provider_travel',
                  width: 140,
                  align: 'center',
                  render: (v) =>
                    v ? <CheckCircleOutlined style={{ color: '#1890ff' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                },
                {
                  title: 'Short Notice Cancellations',
                  dataIndex: 'short_notice_cancellations',
                  width: 200,
                  align: 'center',
                  render: (v) =>
                    v ? <CheckCircleOutlined style={{ color: '#1890ff' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                },
                {
                  title: 'NDIA Requested Reports',
                  dataIndex: 'ndia_requested_reports',
                  width: 180,
                  align: 'center',
                  render: (v) =>
                    v ? <CheckCircleOutlined style={{ color: '#1890ff' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                },
                {
                  title: 'Irregular SIL Supports',
                  dataIndex: 'irregular_sil_supports',
                  width: 180,
                  align: 'center',
                  render: (v) =>
                    v ? <CheckCircleOutlined style={{ color: '#1890ff' }} /> : <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
                },
                {
                  title: 'Type',
                  dataIndex: 'type',
                  width: 120,
                  render: (v) => v || '—',
                },
              ]}
            />
          </Form>
        </Modal>
      )}
    </div>
  );
}