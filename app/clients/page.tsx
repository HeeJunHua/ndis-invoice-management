'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  Switch,
  Popconfirm,
  message,
  Descriptions,
  Tag,
} from 'antd';
import { ReloadOutlined, CheckCircleTwoTone, CloseCircleTwoTone } from '@ant-design/icons';
import { apiFetch } from '@/lib/api-client';
import dayjs from 'dayjs';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface Client {
  id: number;
  first_name: string;
  last_name: string;
  ndis_number: string;
  email: string;
  pricing_region: string;
  dob: string;
  gender_id: number;
  address: string;
  phone_number: string | null;
  unit_building: string | null;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Gender {
  id: number;
  code: string;
  label: string;
}

interface PricingRegion {
  code: string;
  label: string;
  full_label: string;
}

export default function ClientsPage() {
  return (
    <Suspense fallback={null}>
      <ClientsPageInner />
    </Suspense>
  );
}

function ClientsPageInner() {
  const [clients, setClients] = useState<Client[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [pricingRegions, setPricingRegions] = useState<PricingRegion[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Client | null>(null);
  const [viewing, setViewing] = useState<Client | null>(null);
  const [form] = Form.useForm();

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [genderFilter, setGenderFilter] = useState<number | undefined>(undefined);
  const [regionFilter, setRegionFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | undefined>(undefined);

  async function load() {
    setLoading(true);
    try {
      const [clientsData, gendersData, regionsData] = await Promise.all([
        apiFetch<Client[]>('/api/clients'),
        apiFetch<Gender[]>('/api/genders'),
        apiFetch<PricingRegion[]>('/api/pricing-regions'),
      ]);
      setClients(clientsData);
      setGenders(gendersData);
      setPricingRegions(regionsData);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const searchParams = useSearchParams();
  useEffect(() => {
    load();
  }, []);
  
  const editId = searchParams.get('editId');

  useEffect(() => {
    if (editId && clients.length > 0) {
      const match = clients.find((c) => c.id === Number(editId));
      if (match) openEdit(match);
    }
  }, [editId, clients]);
  
  const genderLabelById = useMemo(() => {
    const map = new Map<number, string>();
    genders.forEach((g) => map.set(g.id, g.label));
    return map;
  }, [genders]);

  const filteredClients = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return clients.filter((c) => {
      if (search) {
        const haystack = `${c.first_name} ${c.last_name} ${c.ndis_number} ${c.email}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (genderFilter !== undefined && c.gender_id !== genderFilter) return false;
      if (regionFilter !== undefined && c.pricing_region !== regionFilter) return false;
      if (statusFilter === 'active' && c.deactivated_at !== null) return false;
      if (statusFilter === 'inactive' && c.deactivated_at === null) return false;
      return true;
    });
  }, [clients, searchText, genderFilter, regionFilter, statusFilter]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(client: Client) {
    setEditing(client);
    form.setFieldsValue({ ...client, dob: dayjs(client.dob), active: client.deactivated_at === null });
    setModalOpen(true);
  }

  function openView(client: Client) {
    setViewing(client);
  }

  async function handleDelete(id: number) {
    try {
      await apiFetch(`/api/clients/${id}`, { method: 'DELETE' });
      message.success('Deleted');
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  }

  async function onFinish(values: Record<string, unknown>) {
    const { active, ...rest } = values;
    const payload = { ...rest, dob: (values.dob as dayjs.Dayjs).format('YYYY-MM-DD') };
    try {
      if (editing) {
        await apiFetch(`/api/clients/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });

        // Only call the status endpoint if the active state actually changed,
        // to keep audit log entries clean and avoid an unnecessary write.
        const wasActive = editing.deactivated_at === null;
        if (typeof active === 'boolean' && active !== wasActive) {
          await apiFetch(`/api/clients/${editing.id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ active }),
          });
        }
        message.success('Client updated');
      } else {
        await apiFetch('/api/clients', { method: 'POST', body: JSON.stringify(payload) });
        message.success('Client created');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 4 }}>Participants</h1>
        <p style={{ color: '#888', margin: 0 }}>Manage participant records.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={load}>
          Refresh
        </Button>
        <Button type="primary" onClick={openCreate}>
          Add Participant
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
            First Name, Last Name, NDIS number, Email
          </div>
          <Input
            placeholder="Search first name, last name, NDIS number or email"
            style={{ width: 320 }}
            allowClear
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Gender</div>
          <Select
            style={{ width: 180 }}
            placeholder="All genders"
            allowClear
            value={genderFilter}
            onChange={setGenderFilter}
            options={genders.map((g) => ({ value: g.id, label: g.label }))}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Pricing Region</div>
          <Select
            style={{ width: 200 }}
            placeholder="All pricing regions"
            allowClear
            value={regionFilter}
            onChange={setRegionFilter}
            options={pricingRegions.map((r) => ({ value: r.code, label: r.full_label }))}
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

      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredClients}
        scroll={{ x: 'max-content' }}
        onRow={(record) => ({
          onDoubleClick: () => openView(record),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          defaultPageSize: 20,
          showTotal: (total) => `Total: ${total}`,
        }}
        columns={[
          { title: 'First Name', dataIndex: 'first_name' },
          { title: 'Last Name', dataIndex: 'last_name' },
          {
            title: 'Gender',
            dataIndex: 'gender_id',
            render: (id: number) => genderLabelById.get(id) ?? '—',
          },
          {
            title: 'Date of Birth',
            dataIndex: 'dob',
            render: (v: string) => dayjs(v).format('DD/MM/YYYY'),
          },
          { title: 'NDIS Number', dataIndex: 'ndis_number' },
          { title: 'Email', dataIndex: 'email' },
          {
            title: 'Phone Number',
            dataIndex: 'phone_number',
            render: (v: string | null) => v || '—',
          },
          { title: 'Address', dataIndex: 'address' },
          {
            title: 'Unit/Building',
            dataIndex: 'unit_building',
            render: (v: string | null) => v || '—',
          },
          { title: 'Pricing Region', dataIndex: 'pricing_region' },
          {
            title: 'Active',
            dataIndex: 'deactivated_at',
            align: 'center',
            // Display-only status indicator — editing is done via the Edit modal's Active switch.
            render: (v: string | null) =>
              v === null ? (
                <CheckCircleTwoTone twoToneColor="#1677ff" />
              ) : (
                <CloseCircleTwoTone twoToneColor="#1677ff" />
              ),
          },
          {
            title: 'Actions',
            fixed: 'right',
            render: (_, record) => (
              <>
                <Button onClick={() => openEdit(record)}>Edit</Button>
                <Popconfirm title="Delete this participant?" onConfirm={() => handleDelete(record.id)}>
                  <Button danger style={{ marginLeft: 8 }}>
                    Delete
                  </Button>
                </Popconfirm>
              </>
            ),
          },
        ]}
      />

      {/* Add / Edit Modal */}
      <Modal
        title={editing ? 'Edit Participant' : 'Add Participant'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="first_name"
            label="First Name"
            rules={[
              { required: true, message: 'First name is required' },
              { whitespace: true, message: 'First name cannot be blank' },
            ]}
          >
            <Input placeholder="e.g. Jane" />
          </Form.Item>

          <Form.Item
            name="last_name"
            label="Last Name"
            rules={[
              { required: true, message: 'Last name is required' },
              { whitespace: true, message: 'Last name cannot be blank' },
            ]}
          >
            <Input placeholder="e.g. Doe" />
          </Form.Item>

          <Form.Item name="gender_id" label="Gender" rules={[{ required: true, message: 'Please select a gender' }]}>
            <Select
              placeholder="Please select a gender"
              options={genders.map((g) => ({ value: g.id, label: g.label }))}
            />
          </Form.Item>

          <Form.Item name="dob" label="Date of Birth" rules={[{ required: true, message: 'Date of birth is required' }]}>
            <DatePicker
              style={{ width: '100%' }}
              placeholder="Select date of birth"
              format="DD/MM/YYYY"
              disabledDate={(d) => d.isAfter(dayjs())}
            />
          </Form.Item>

          <Form.Item
            name="ndis_number"
            label="NDIS Number"
            extra="Digits only, up to 16 digits"
            rules={[
              { required: true, message: 'NDIS number is required' },
              { pattern: /^\d{1,16}$/, message: 'NDIS number must be digits only, up to 16 digits' },
            ]}
          >
            <Input placeholder="e.g. 4300123456" maxLength={16} />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Please enter a valid email address' },
            ]}
          >
            <Input placeholder="e.g. jane.doe@example.com" />
          </Form.Item>

          <Form.Item
            name="phone_number"
            label="Phone Number"
            extra="Optional — digits only, 3 to 16 digits"
            rules={[{ pattern: /^\d{3,16}$/, message: 'Phone number must be digits only, 3 to 16 digits' }]}
          >
            <Input placeholder="e.g. 0412345678" />
          </Form.Item>

          <Form.Item
            name="address"
            label="Address"
            rules={[
              { required: true, message: 'Address is required' },
              { whitespace: true, message: 'Address cannot be blank' },
            ]}
          >
            <Input placeholder="e.g. 123 Main Street, Melbourne" />
          </Form.Item>

          <Form.Item
            name="unit_building"
            label="Unit/Building"
            extra="Optional"
            rules={[{ whitespace: true, message: 'Unit/Building cannot be blank if provided' }]}
          >
            <Input placeholder="e.g. Unit 4B" />
          </Form.Item>

          <Form.Item name="pricing_region" label="Pricing Region" rules={[{ required: true, message: 'Please select a pricing region' }]}>
            <Select
              placeholder="Please select a pricing region"
              options={pricingRegions.map((r) => ({ value: r.code, label: r.full_label }))}
              notFoundContent="No pricing regions available — import a rate set first"
            />
          </Form.Item>
          
          {editing && (
            <Form.Item name="active" label="Active" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          )}

        </Form>
      </Modal>

      {/* View Details Modal (double-click a row) */}
      <Modal
        title="Participant Details"
        open={viewing !== null}
        onCancel={() => setViewing(null)}
        footer={<Button onClick={() => setViewing(null)}>Close</Button>}
      >
        {viewing && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Full Name">
              {viewing.first_name} {viewing.last_name}
            </Descriptions.Item>
            <Descriptions.Item label="Gender">{genderLabelById.get(viewing.gender_id) ?? '—'}</Descriptions.Item>
            <Descriptions.Item label="Date of Birth">{dayjs(viewing.dob).format('DD/MM/YYYY')}</Descriptions.Item>
            <Descriptions.Item label="NDIS Number">{viewing.ndis_number}</Descriptions.Item>
            <Descriptions.Item label="Email">{viewing.email}</Descriptions.Item>
            <Descriptions.Item label="Phone Number">{viewing.phone_number || '—'}</Descriptions.Item>
            <Descriptions.Item label="Address">{viewing.address}</Descriptions.Item>
            <Descriptions.Item label="Unit/Building">{viewing.unit_building || '—'}</Descriptions.Item>
            <Descriptions.Item label="Pricing Region">{viewing.pricing_region}</Descriptions.Item>
            <Descriptions.Item label="Status">
              {viewing.deactivated_at === null ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="Created">{dayjs(viewing.created_at).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
            <Descriptions.Item label="Last Updated">{dayjs(viewing.updated_at).format('DD/MM/YYYY HH:mm')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}