'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Popconfirm, message, Switch, Tabs } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';
import dayjs from 'dayjs';

interface Role {
  id: number;
  code: string;
  label: string;
  deactivated_at: string | null;
  created_at?: string;
  is_default?: boolean;
  permissions?: string[]; // e.g. ['audit_logs.read', 'clients.read', 'clients.write']
}

interface RawPermission {
  id: number;
  code: string;
  label?: string;
}

interface PermissionItem {
  key: string;
  label: string;
}

interface ModulePermissions {
  moduleKey: string;
  moduleName: string;
  items: PermissionItem[];
}

/**
 * Helper to dynamically group flat permission records into tab modules based on prefix.
 * e.g., "audit_logs.read" -> Module: "Audit Logs", Item: "Read audit logs"
 */
function groupPermissionsByModule(rawPermissions: RawPermission[]): ModulePermissions[] {
  const map = new Map<string, PermissionItem[]>();

  rawPermissions.forEach((p) => {
    const parts = p.code.split('.');
    const moduleKey = parts.length > 1 ? parts[0] : 'general';
    const items = map.get(moduleKey) || [];

    items.push({
      key: p.code,
      label: p.label || p.code,
    });

    map.set(moduleKey, items);
  });

  return Array.from(map.entries()).map(([moduleKey, items]) => {
    // Format module key (e.g., "audit_logs" -> "Audit Logs")
    const moduleName = moduleKey
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    return {
      moduleKey,
      moduleName,
      items,
    };
  });
}

export default function RolesPage() {
  const [data, setData] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();

  // Dynamic Permissions state
  const [rawPermissions, setRawPermissions] = useState<RawPermission[]>([]);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [isActiveRole, setIsActiveRole] = useState<boolean>(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Role[]>('/api/roles');
      setData(res);
    } catch (e: any) {
      message.error(e.message || 'Failed to fetch roles');
    } finally {
      setLoading(false);
    }
  };

  const fetchPermissions = async () => {
    try {
      // Adjust path if your endpoint is GET /api/permissions or GET /api/rbac/permissions
      const res = await apiClient.get<RawPermission[]>('/api/permissions');
      setRawPermissions(res);
    } catch (e: any) {
      console.warn('Could not fetch permissions dynamically, falling back.', e);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchPermissions();
  }, []);

  // Dynamically constructed modules based on fetched permissions
  const dynamicPermissionModules = useMemo(() => {
    return groupPermissionsByModule(rawPermissions);
  }, [rawPermissions]);

  const filteredRoles = useMemo(() => {
    return data.filter((role) => {
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesLabel = role.label.toLowerCase().includes(q);
        const matchesCode = role.code.toLowerCase().includes(q);
        if (!matchesLabel && !matchesCode) return false;
      }

      if (activeFilter !== undefined) {
        const isActive = role.deactivated_at === null;
        if (isActive !== activeFilter) return false;
      }

      return true;
    });
  }, [data, searchQuery, activeFilter]);

  const handleOpenModal = (role: Role | null = null) => {
    setEditingRole(role);
    if (role) {
      form.setFieldsValue({
        code: role.code,
        label: role.label,
      });
      setIsActiveRole(role.deactivated_at === null);
      setSelectedPermissions(role.permissions || []);
    } else {
      form.resetFields();
      setIsActiveRole(true);
      setSelectedPermissions([]);
    }
    setIsModalOpen(true);
  };

  const handlePermissionToggle = (permKey: string, checked: boolean) => {
    setSelectedPermissions((prev) =>
      checked ? [...prev, permKey] : prev.filter((k) => k !== permKey)
    );
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const { active, ...rest } = { ...values, active: isActiveRole };
      const payload = {
        code: rest.code,
        label: rest.label,
        permissions: selectedPermissions,
      };

      if (editingRole) {
        await apiClient.patch(`/api/roles/${editingRole.id}`, payload);

        const wasActive = editingRole.deactivated_at === null;
        if (active !== wasActive) {
          await apiClient.patch(`/api/roles/${editingRole.id}/status`, { active });
        }
        message.success('Role updated successfully');
      } else {
        const createPayload = {
          ...payload,
          deactivated_at: active ? null : new Date().toISOString(),
        };
        await apiClient.post('/api/roles', createPayload);
        message.success('Role created successfully');
      }
      setIsModalOpen(false);
      fetchRoles();
    } catch (e: any) {
      message.error(e.message || 'Save failed');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/api/roles/${id}`);
      message.success('Role deactivated successfully');
      fetchRoles();
    } catch (e: any) {
      message.error(e.message || 'Delete failed');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 4 }}>User Roles</h1>
        <p style={{ color: '#888', margin: 0 }}>Manage application user roles.</p>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchRoles}>
          Refresh
        </Button>
        <Button type="primary" onClick={() => handleOpenModal()}>
          Add User Role
        </Button>
      </div>

      {/* Filters Bar */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Label, Code</div>
          <Input
            placeholder="Search label or code"
            style={{ width: 280 }}
            allowClear
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
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

      {/* Roles Table */}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredRoles}
        pagination={{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          defaultPageSize: 20,
          showTotal: (total) => `Total: ${total}`,
        }}
        columns={[
          { title: 'Label', dataIndex: 'label', key: 'label' },
          { title: 'Code', dataIndex: 'code', key: 'code' },
          {
            title: 'Active',
            key: 'active',
            align: 'center',
            render: (_, record) =>
              record.deactivated_at === null ? (
                <CheckCircleOutlined style={{ color: '#1677ff', fontSize: 16 }} />
              ) : (
                <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
              ),
          },
          {
            title: 'Created At',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (v) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : '—'),
          },
          {
            title: 'Actions',
            key: 'actions',
            align: 'right',
            render: (_, record) => (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button onClick={() => handleOpenModal(record)}>Edit</Button>
                {!record.is_default && record.code !== 'SUPER_ADMIN' && (
                  <Popconfirm
                    title="Deactivate Role"
                    description="Are you sure you want to deactivate this role?"
                    onConfirm={() => handleDelete(record.id)}
                  >
                    <Button danger>Delete</Button>
                  </Popconfirm>
                )}
              </div>
            ),
          },
        ]}
      />

      {/* Add / Edit Role Modal */}
      <Modal
        title={editingRole ? 'Edit User Role' : 'Add User Role'}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
        width={900}
        okText="Save"
        cancelText="Cancel"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
            <Form.Item
              name="label"
              label="Label"
              required
              rules={[{ required: true, message: 'Please input the label' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="e.g., Admin" />
            </Form.Item>

            <Form.Item
              name="code"
              label="Code"
              required
              rules={[{ required: true, message: 'Please input the code' }]}
              style={{ flex: 1 }}
            >
              <Input placeholder="e.g., ADMIN" disabled={!!editingRole?.is_default} />
            </Form.Item>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: 14, marginBottom: 8, color: 'rgba(0, 0, 0, 0.88)' }}>
                Active
              </span>
              <Switch checked={isActiveRole} onChange={setIsActiveRole} />
            </div>
          </div>

          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 14, color: '#888', marginBottom: 12 }}>Permissions</div>

            <Tabs
              tabPlacement={"left" as any}
              items={dynamicPermissionModules.map((mod) => ({
                key: mod.moduleKey,
                label: mod.moduleName,
                children: (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {mod.items.map((item) => {
                      const isChecked = selectedPermissions.includes(item.key);
                      return (
                        <div
                          key={item.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '12px 16px',
                            border: '1px solid #f0f0f0',
                            borderRadius: 6,
                            backgroundColor: '#fff',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>{item.label}</div>
                            <div
                              style={{
                                fontFamily: 'monospace',
                                color: '#888',
                                fontSize: 12,
                              }}
                            >
                              {item.key}
                            </div>
                          </div>
                          <Switch
                            checked={isChecked}
                            onChange={(checked) => handlePermissionToggle(item.key, checked)}
                          />
                        </div>
                      );
                    })}
                  </div>
                ),
              }))}
            />
          </div>
        </Form>
      </Modal>
    </div>
  );
}