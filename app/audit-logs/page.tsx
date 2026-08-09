'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  message,
  Modal,
  Descriptions,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface AuditLogRow {
  id: string;
  actor_user_id: number | null;
  actor_name?: string;
  actor_role_name?: string;
  action: string;
  permission_code: string | null;
  entity: string;
  entity_id: string | null;
  payload?: any;
  before_state?: any;
  after_state?: any;
  created_at: string;
}

interface SelectOption {
  label: string;
  value: string;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Filter Dropdown Options
  const [roleOptions, setRoleOptions] = useState<SelectOption[]>([]);
  const [actionOptions, setActionOptions] = useState<SelectOption[]>([]);
  const [permissionOptions, setPermissionOptions] = useState<SelectOption[]>([]);
  const [entityOptions, setEntityOptions] = useState<SelectOption[]>([]);

  // Filter Values
  const [searchUser, setSearchUser] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | undefined>(undefined);
  const [selectedAction, setSelectedAction] = useState<string | undefined>(undefined);
  const [selectedPermission, setSelectedPermission] = useState<string | undefined>(undefined);
  const [selectedEntity, setSelectedEntity] = useState<string | undefined>(undefined);
  const [createdRange, setCreatedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  // View Details Modal
  const [viewLog, setViewLog] = useState<AuditLogRow | null>(null);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>('/api/audit-logs');
      const list: AuditLogRow[] = Array.isArray(res) ? res : res?.data || [];
      setLogs(list);

      // Dynamically build filter dropdown options from data set
      const actions = Array.from(new Set(list.map((item) => item.action).filter(Boolean)));
      const permissions = Array.from(
        new Set(list.map((item) => item.permission_code).filter(Boolean) as string[])
      );
      const entities = Array.from(new Set(list.map((item) => item.entity).filter(Boolean)));

      setActionOptions(actions.map((a) => ({ label: a, value: a })));
      setPermissionOptions(permissions.map((p) => ({ label: p, value: p })));
      setEntityOptions(entities.map((e) => ({ label: e, value: e })));
    } catch (e: any) {
      message.error(e.message || 'Failed to fetch audit logs');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await apiClient.get<any>('/api/roles');
      const list = Array.isArray(res) ? res : res?.data || [];
      setRoleOptions(
        list.map((r: any) => ({
          label: r.label || r.code,
          value: r.label || r.code,
        }))
      );
    } catch (e) {
      console.warn('Could not fetch roles for filter', e);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    fetchRoles();
  }, []);

  // Filter Logic
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // User filter
      if (searchUser.trim()) {
        const q = searchUser.trim().toLowerCase();
        const userName = (log.actor_name || '').toLowerCase();
        const userId = String(log.actor_user_id || '');
        if (!userName.includes(q) && !userId.includes(q)) return false;
      }

      // Role filter
      if (selectedRole && log.actor_role_name !== selectedRole) {
        return false;
      }

      // Action filter
      if (selectedAction && log.action !== selectedAction) {
        return false;
      }

      // Permission filter
      if (selectedPermission && log.permission_code !== selectedPermission) {
        return false;
      }

      // Entity filter
      if (selectedEntity && log.entity !== selectedEntity) {
        return false;
      }

      // Created At Range filter
      if (createdRange && createdRange[0] && createdRange[1] && log.created_at) {
        const date = dayjs(log.created_at);
        if (date.isBefore(createdRange[0], 'day') || date.isAfter(createdRange[1], 'day')) {
          return false;
        }
      }

      return true;
    });
  }, [
    logs,
    searchUser,
    selectedRole,
    selectedAction,
    selectedPermission,
    selectedEntity,
    createdRange,
  ]);

  return (
    <div style={{ padding: 24 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 4 }}>Audit Logs</h1>
        <p style={{ color: '#888', margin: 0 }}>Maintain and inspect audit logs.</p>
      </div>

      {/* Refresh Action */}
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchAuditLogs}>
          Refresh
        </Button>
      </div>

      {/* Filters Bar */}
      <div
        style={{
          display: 'flex',
          gap: 16,
          marginBottom: 16,
          flexWrap: 'wrap',
          alignItems: 'flex-end',
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>User</div>
          <Input
            placeholder="Search user"
            style={{ width: 180 }}
            allowClear
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Role</div>
          <Select
            placeholder="All roles"
            style={{ width: 180 }}
            allowClear
            value={selectedRole}
            onChange={setSelectedRole}
            options={roleOptions}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Action</div>
          <Select
            placeholder="All actions"
            style={{ width: 180 }}
            allowClear
            value={selectedAction}
            onChange={setSelectedAction}
            options={actionOptions}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Permission</div>
          <Select
            placeholder="All permissions"
            style={{ width: 180 }}
            allowClear
            value={selectedPermission}
            onChange={setSelectedPermission}
            options={permissionOptions}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Entity</div>
          <Select
            placeholder="All entities"
            style={{ width: 180 }}
            allowClear
            value={selectedEntity}
            onChange={setSelectedEntity}
            options={entityOptions}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Created At</div>
          <RangePicker
            style={{ width: 220 }}
            value={createdRange}
            onChange={(val) => setCreatedRange(val as any)}
          />
        </div>
      </div>

      {/* Audit Logs Table */}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredLogs}
        pagination={{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          defaultPageSize: 20,
          showTotal: (total) => `Total: ${total}`,
        }}
        columns={[
          {
            title: 'User',
            dataIndex: 'actor_name',
            key: 'actor_name',
            render: (text, record) =>
              text || (record.actor_user_id ? `User #${record.actor_user_id}` : 'System'),
          },
          {
            title: 'Role',
            dataIndex: 'actor_role_name',
            key: 'actor_role_name',
            render: (text) => text || '—',
          },
          {
            title: 'Action',
            dataIndex: 'action',
            key: 'action',
            render: (text) => text || '—',
          },
          {
            title: 'Permission',
            dataIndex: 'permission_code',
            key: 'permission_code',
            render: (text) => text || '—',
          },
          {
            title: 'Entity',
            dataIndex: 'entity',
            key: 'entity',
            render: (text) => text || '—',
          },
          {
            title: 'Entity ID',
            dataIndex: 'entity_id',
            key: 'entity_id',
            render: (text) => text || '—',
          },
          {
            title: 'Before',
            dataIndex: 'before_state',
            key: 'before_state',
            render: (val) => {
              if (!val) return '—';
              return typeof val === 'object' ? JSON.stringify(val) : String(val);
            },
            ellipsis: true,
          },
          {
            title: 'After',
            dataIndex: 'after_state',
            key: 'after_state',
            render: (val) => {
              if (!val) return '—';
              return typeof val === 'object' ? JSON.stringify(val) : String(val);
            },
            ellipsis: true,
          },
          {
            title: 'Created At',
            dataIndex: 'created_at',
            key: 'created_at',
            render: (val) => (val ? dayjs(val).format('DD/MM/YYYY HH:mm:ss') : '—'),
          },
          {
            title: 'Actions',
            key: 'actions',
            align: 'right',
            render: (_, record) => (
              <Button onClick={() => setViewLog(record)}>View</Button>
            ),
          },
        ]}
      />

      {/* Modal for Details */}
      <Modal
        title="Audit Log Details"
        open={!!viewLog}
        onCancel={() => setViewLog(null)}
        footer={[
          <Button key="close" onClick={() => setViewLog(null)}>
            Close
          </Button>,
        ]}
        width={750}
      >
        {viewLog && (
          <Descriptions column={1} bordered style={{ marginTop: 16 }}>
            <Descriptions.Item label="Log ID">{viewLog.id}</Descriptions.Item>
            <Descriptions.Item label="User">
              {viewLog.actor_name || (viewLog.actor_user_id ? `User #${viewLog.actor_user_id}` : 'System')}
            </Descriptions.Item>
            <Descriptions.Item label="Role">{viewLog.actor_role_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Action">{viewLog.action}</Descriptions.Item>
            <Descriptions.Item label="Permission Code">
              {viewLog.permission_code || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Entity">{viewLog.entity}</Descriptions.Item>
            <Descriptions.Item label="Entity ID">{viewLog.entity_id || '—'}</Descriptions.Item>
            <Descriptions.Item label="Created At">
              {viewLog.created_at ? dayjs(viewLog.created_at).format('DD/MM/YYYY HH:mm:ss') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Payload / State">
              <pre style={{ margin: 0, maxHeight: 200, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(
                  {
                    before: viewLog.before_state,
                    after: viewLog.after_state,
                    rawPayload: viewLog.payload,
                  },
                  null,
                  2
                )}
              </pre>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}