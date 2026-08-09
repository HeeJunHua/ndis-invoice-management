'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  Select,
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

interface Provider {
  id: number;
  abn: string;
  name: string;
  email: string | null;
  phone_number: string | null;
  address: string | null;
  unit_building: string | null;
  deactivated_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProvidersPage() {
  return (
    <Suspense fallback={null}>
      <ProvidersPageInner />
    </Suspense>
  );
}
function ProvidersPageInner() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [viewing, setViewing] = useState<Provider | null>(null);
  const [form] = Form.useForm();

  // Filter state
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | undefined>(undefined);

  async function load() {
    setLoading(true);
    try {
      setProviders(await apiFetch<Provider[]>('/api/providers'));
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
    if (editId && providers.length > 0) {
      const match = providers.find((p) => p.id === Number(editId));
      if (match) openEdit(match);
    }
  }, [editId, providers]);
  

  const filteredProviders = useMemo(() => {
    const search = searchText.trim().toLowerCase();
    return providers.filter((p) => {
      if (search) {
        const haystack = `${p.name} ${p.abn} ${p.email ?? ''}`.toLowerCase();
        if (!haystack.includes(search)) return false;
      }
      if (statusFilter === 'active' && p.deactivated_at !== null) return false;
      if (statusFilter === 'inactive' && p.deactivated_at === null) return false;
      return true;
    });
  }, [providers, searchText, statusFilter]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(provider: Provider) {
    setEditing(provider);
    form.setFieldsValue({ ...provider, active: provider.deactivated_at === null });
    setModalOpen(true);
  }

  function openView(provider: Provider) {
    setViewing(provider);
  }

  async function handleDelete(id: number) {
    try {
      await apiFetch(`/api/providers/${id}`, { method: 'DELETE' });
      message.success('Deleted');
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  }

  async function onFinish(values: Record<string, unknown>) {
    const { active, ...payload } = values;
    try {
      if (editing) {
        await apiFetch(`/api/providers/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });

        const wasActive = editing.deactivated_at === null;
        if (typeof active === 'boolean' && active !== wasActive) {
          await apiFetch(`/api/providers/${editing.id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ active }),
          });
        }
        message.success('Provider updated');
      } else {
        await apiFetch('/api/providers', { method: 'POST', body: JSON.stringify(payload) });
        message.success('Provider created');
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
        <h1 style={{ marginBottom: 4 }}>Providers</h1>
        <p style={{ color: '#888', margin: 0 }}>Manage provider records.</p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={load}>
          Refresh
        </Button>
        <Button type="primary" onClick={openCreate}>
          Add Provider
        </Button>
      </div>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Name, ABN, Email</div>
          <Input
            placeholder="Search name, ABN or email"
            style={{ width: 320 }}
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

      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredProviders}
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
          { title: 'ABN', dataIndex: 'abn' },
          { title: 'Name', dataIndex: 'name' },
          { title: 'Email', dataIndex: 'email', render: (v: string | null) => v || '—' },
          { title: 'Phone', dataIndex: 'phone_number', render: (v: string | null) => v || '—' },
          { title: 'Address', dataIndex: 'address', render: (v: string | null) => v || '—' },
          {
            title: 'Unit/Building',
            dataIndex: 'unit_building',
            render: (v: string | null) => v || '—',
          },
          {
            title: 'Active',
            dataIndex: 'deactivated_at',
            align: 'center',
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
                <Popconfirm title="Delete this provider?" onConfirm={() => handleDelete(record.id)}>
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
        title={editing ? 'Edit Provider' : 'Add Provider'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={onFinish}>
          <Form.Item
            name="abn"
            label="ABN"
            extra="Digits only, up to 11 digits"
            rules={[
              { required: true, message: 'ABN is required' },
              { pattern: /^\d{1,11}$/, message: 'ABN must be digits only, up to 11 digits' },
            ]}
          >
            <Input placeholder="e.g. 12345678901" maxLength={11} />
          </Form.Item>

          <Form.Item
            name="name"
            label="Name"
            rules={[
              { required: true, message: 'Name is required' },
              { whitespace: true, message: 'Name cannot be blank' },
            ]}
          >
            <Input placeholder="e.g. Serenity Life Balance Advisory Pty Ltd" />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email', message: 'Please enter a valid email address' },
            ]}
          >
            <Input placeholder="e.g. contact@provider.com" />
          </Form.Item>

          <Form.Item
            name="phone_number"
            label="Phone Number"
            extra="Optional — digits only, 3 to 16 digits"
            rules={[{ pattern: /^\d{3,16}$/, message: 'Phone number must be digits only, 3 to 16 digits' }]}
          >
            <Input placeholder="e.g. 0398901365" />
          </Form.Item>

          <Form.Item
            name="address"
            label="Address"
            rules={[
              { required: true, message: 'Address is required' },
              { whitespace: true, message: 'Address cannot be blank' },
            ]}
          >
            <Input placeholder="e.g. 456 Business St, Melbourne" />
          </Form.Item>

          <Form.Item
            name="unit_building"
            label="Unit/Building"
            extra="Optional"
            rules={[{ whitespace: true, message: 'Unit/Building cannot be blank if provided' }]}
          >
            <Input placeholder="e.g. Suite 6, Level 2" />
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
        title="Provider Details"
        open={viewing !== null}
        onCancel={() => setViewing(null)}
        footer={<Button onClick={() => setViewing(null)}>Close</Button>}
      >
        {viewing && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Name">{viewing.name}</Descriptions.Item>
            <Descriptions.Item label="ABN">{viewing.abn}</Descriptions.Item>
            <Descriptions.Item label="Email">{viewing.email || '—'}</Descriptions.Item>
            <Descriptions.Item label="Phone Number">{viewing.phone_number || '—'}</Descriptions.Item>
            <Descriptions.Item label="Address">{viewing.address || '—'}</Descriptions.Item>
            <Descriptions.Item label="Unit/Building">{viewing.unit_building || '—'}</Descriptions.Item>
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