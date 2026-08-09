'use client';

import { useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, message, Popconfirm, Switch } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { apiFetch } from '@/lib/api-client';
import dayjs from 'dayjs';

interface Role {
  id: number;
  code: string;
  label: string;
}

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  is_default: boolean;
  deactivated_at: string | null;
  deleted_at: string | null;
  created_at?: string;
  updated_at?: string;
  role: Role | null;
}

export default function UsersPage() {
  const [isMounted, setIsMounted] = useState(false);

  const [users, setUsers] = useState<UserRow[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [form] = Form.useForm();

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<number | undefined>(undefined);
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);

  const isSelfEditing = editing?.id === currentUserId;

  async function load() {
    setLoading(true);
    try {
      const [u, r] = await Promise.all([
        apiFetch<UserRow[]>('/api/users'),
        apiFetch<Role[]>('/api/roles'),
      ]);
      setUsers(u);
      setRoles(r);
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchCurrentUser() {
    try {
      const response = await apiFetch<{ id: number }>('/api/users/me');
      setCurrentUserId(response.id);
    } catch {
      message.error('Failed to load session context');
    }
  }

  async function handleDelete(id: number) {
    try {
      await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
      message.success('User deleted');
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  }

  useEffect(() => {
    load();
    fetchCurrentUser();
    setIsMounted(true);
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      // Email / Full Name search
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesEmail = u.email.toLowerCase().includes(q);
        const matchesName = u.full_name.toLowerCase().includes(q);
        if (!matchesEmail && !matchesName) return false;
      }

      // Role filter
      if (roleFilter !== undefined && u.role?.id !== roleFilter) {
        return false;
      }

      // Active status filter using deleted_at
      if (activeFilter !== undefined) {
        const isActive = u.deleted_at === null;
        if (isActive !== activeFilter) return false;
      }

      return true;
    });
  }, [users, searchQuery, roleFilter, activeFilter]);

  function openCreate() {
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  }

  function openEdit(user: UserRow) {
    setEditing(user);
    form.setFieldsValue({
      email: user.email,
      full_name: user.full_name,
      role_id: user.role?.id,
      password: '',
      active: user.deleted_at === null && user.deactivated_at === null,
    });
    setModalOpen(true);
  }

  async function onFinish(values: Record<string, unknown>) {
    try {
      if (editing) {
        const { password, active, ...rest } = values as { password?: string, active?: boolean };
        const bodyPayload = isSelfEditing && password ? { ...rest, password } : rest;

        await apiFetch(`/api/users/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify(bodyPayload),
        });

        const wasActive = editing.deleted_at === null && editing.deactivated_at === null;
        if (typeof active === 'boolean' && active !== wasActive) {
          await apiFetch(`/api/users/${editing.id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ active }),
          });
        }
        message.success('User updated');
      } else {
        await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(values) });
        message.success('User created');
      }
      setModalOpen(false);
      load();
    } catch (e) {
      message.error((e as Error).message);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 4 }}>Users</h1>
        <p style={{ color: '#888', margin: 0 }}>Manage application users.</p>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={load}>
          Refresh
        </Button>
        <Button type="primary" onClick={openCreate}>
          Add User
        </Button>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Email, Full Name</div>
          <Input
            placeholder="Search email or full name"
            style={{ width: 280 }}
            allowClear
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Role</div>
          <Select
            style={{ width: 200 }}
            placeholder="All roles"
            allowClear
            value={roleFilter}
            onChange={setRoleFilter}
            options={roles.map((r) => ({ value: r.id, label: r.label }))}
          />
        </div>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Active</div>
          <Select
            style={{ width: 180 }}
            placeholder="All statuses"
            allowClear
            value={activeFilter}
            onChange={setActiveFilter}
            options={[
              { value: true, label: 'Active' },
              { value: false, label: 'Inactive' },
            ]}
          />
        </div>
      </div>

      {/* Users Table */}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredUsers}
        pagination={{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          defaultPageSize: 20,
          showTotal: (total) => `Total: ${total}`,
        }}
        columns={[
          {
            title: 'Email',
            dataIndex: 'email',
          },
          {
            title: 'Full Name',
            dataIndex: 'full_name',
          },
          {
            title: 'Role',
            render: (_, r) => r.role?.label || '—',
          },
          {
            title: 'Active',
            align: 'center',
            render: (_, r) =>
              r.deleted_at === null && r.deactivated_at === null ? (
                <CheckCircleOutlined style={{ color: '#1677ff', fontSize: 16 }} />
              ) : (
                <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
              ),
          },
          {
            title: 'Created At',
            dataIndex: 'created_at',
            render: (v) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : '—'),
          },
          {
            title: 'Updated At',
            dataIndex: 'updated_at',
            render: (v) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : '—'),
          },
          {
            title: 'Actions',
            align: 'right',
            render: (_, record) => (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button onClick={() => openEdit(record)}>Edit</Button>
                {!record.is_default && record.id !== currentUserId && (
                  <Popconfirm title="Delete this user?" onConfirm={() => handleDelete(record.id)}>
                    <Button danger>Delete</Button>
                  </Popconfirm>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Create / Edit Modal */}
      <Modal
        title={editing ? (isSelfEditing ? 'Edit Your Profile' : 'Edit User') : 'Add User'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={() => form.submit()}
      >
        {isMounted && (
          <Form form={form} layout="vertical" onFinish={onFinish} style={{ marginTop: 16 }}>
            <Form.Item
              name="full_name"
              label="Full Name"
              rules={[{ required: true, message: 'Full name is required' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="email"
              label="Email"
              rules={[{ required: true, type: 'email', message: 'Valid email is required' }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              name="role_id"
              label="Role"
              rules={[{ required: true, message: 'Role is required' }]}
            >
              <Select
                placeholder="Please select"
                allowClear
                options={roles.map((r) => ({ value: r.id, label: r.label }))}
              />
            </Form.Item>

            {!editing && (
              <Form.Item
                name="password"
                label="Initial Password"
                rules={[
                  { required: true, min: 8, message: 'Password must be at least 8 characters' },
                ]}
              >
                <Input.Password />
              </Form.Item>
            )}

            {editing && (
              <Form.Item name="active" label="Active" valuePropName="checked">
                <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
              </Form.Item>
            )}

            {editing && isSelfEditing && (
              <Form.Item
                name="password"
                label="Change Password"
                tooltip="Leave blank if you do not want to modify your password"
                rules={[{ min: 8, message: 'Password must be at least 8 characters' }]}
              >
                <Input.Password placeholder="Enter new password to change" />
              </Form.Item>
            )}
          </Form>
        )}
      </Modal>
    </div>
  );
}