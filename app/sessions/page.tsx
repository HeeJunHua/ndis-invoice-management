'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Table,
  Button,
  Input,
  Select,
  DatePicker,
  Popconfirm,
  message,
  Modal,
  Descriptions,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';
import dayjs, { Dayjs } from 'dayjs';

const { RangePicker } = DatePicker;

interface Session {
  id: number | string;
  user_id: number;
  user_name?: string;
  role_name?: string;
  user_agent?: string;
  ip_address?: string;
  token_hash?: string;
  created_at: string;
  last_active_at?: string;
  expires_at?: string;
  revoked_at: string | null;
}

interface RoleOption {
  label: string;
  value: string;
}

export default function SessionsPage() {
  const [data, setData] = useState<Session[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentSessionId, setCurrentSessionId] = useState<number | string | null>(null);

  // Filters state
  const [searchUser, setSearchUser] = useState('');
  const [selectedRole, setSelectedRole] = useState<string | undefined>(undefined);
  const [expiresRange, setExpiresRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [revokedRange, setRevokedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [createdRange, setCreatedRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);

  // Modal View state
  const [viewSession, setViewSession] = useState<Session | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<any>('/api/sessions');
      const list = Array.isArray(res) ? res : res?.data || [];
      setData(list);
    } catch (e: any) {
      message.error(e.message || 'Failed to fetch sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await apiClient.get<any>('/api/roles');
      const list = Array.isArray(res) ? res : res?.data || [];
      setRoles(
        list.map((r: any) => ({
          label: r.label || r.code,
          value: r.code,
        }))
      );
    } catch (e) {
      console.warn('Could not fetch roles for dropdown filter', e);
    }
  };

  const fetchCurrentSession = async () => {
    try {
      // Adjust endpoint to match your auth me / current session route
      const me = await apiClient.get<any>('/api/auth/me'); 
      if (me?.sessionId || me?.session_id) {
        setCurrentSessionId(me.sessionId || me.session_id);
      }
    } catch (e) {
      console.warn('Could not fetch current session info', e);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchRoles();
    fetchCurrentSession();
  }, []);

  const handleRevoke = async (id: number | string) => {
    try {
      await apiClient.delete(`/api/sessions/${id}`);
      message.success('Session revoked successfully');
      fetchSessions();
    } catch (e: any) {
      message.error(e.message || 'Revoke failed');
    }
  };

  // Filter logic
  const filteredSessions = useMemo(() => {
    return data.filter((session) => {
      // User search filter
      if (searchUser.trim()) {
        const q = searchUser.trim().toLowerCase();
        const userName = (session.user_name || '').toLowerCase();
        const userId = String(session.user_id);
        if (!userName.includes(q) && !userId.includes(q)) return false;
      }

      // Role filter
      if (selectedRole && session.role_name !== selectedRole) {
        return false;
      }

      // Expires At Date Range
      if (expiresRange && expiresRange[0] && expiresRange[1] && session.expires_at) {
        const date = dayjs(session.expires_at);
        if (date.isBefore(expiresRange[0], 'day') || date.isAfter(expiresRange[1], 'day')) {
          return false;
        }
      }

      // Revoked At Date Range
      if (revokedRange && revokedRange[0] && revokedRange[1]) {
        if (!session.revoked_at) return false;
        const date = dayjs(session.revoked_at);
        if (date.isBefore(revokedRange[0], 'day') || date.isAfter(revokedRange[1], 'day')) {
          return false;
        }
      }

      // Created At Date Range
      if (createdRange && createdRange[0] && createdRange[1] && session.created_at) {
        const date = dayjs(session.created_at);
        if (date.isBefore(createdRange[0], 'day') || date.isAfter(createdRange[1], 'day')) {
          return false;
        }
      }

      return true;
    });
  }, [data, searchUser, selectedRole, expiresRange, revokedRange, createdRange]);

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 4 }}>Auth Sessions</h1>
        <p style={{ color: '#888', margin: 0 }}>Maintain login sessions.</p>
      </div>

      {/* Refresh Button */}
      <div style={{ marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchSessions}>
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
            style={{ width: 200 }}
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
            options={roles}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Expires At</div>
          <RangePicker
            style={{ width: 220 }}
            value={expiresRange}
            onChange={(val) => setExpiresRange(val as any)}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>Revoked At</div>
          <RangePicker
            style={{ width: 220 }}
            value={revokedRange}
            onChange={(val) => setRevokedRange(val as any)}
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

      {/* Sessions Table */}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredSessions}
        pagination={{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          defaultPageSize: 20,
          showTotal: (total) => `Total: ${total}`,
        }}
        columns={[
          {
            title: 'User',
            dataIndex: 'user_name',
            key: 'user_name',
            render: (text, record) => text || `User #${record.user_id}`,
          },
          {
            title: 'Role',
            dataIndex: 'role_name',
            key: 'role_name',
            render: (text) => text || '—',
          },
          {
            title: 'User Agent',
            dataIndex: 'user_agent',
            key: 'user_agent',
            ellipsis: true,
            render: (text) => text || '—',
          },
          {
            title: 'IP',
            dataIndex: 'ip_address',
            key: 'ip_address',
            render: (text) => text || '—',
          },
          {
            title: 'Actions',
            key: 'actions',
            align: 'right',
            render: (_, record: Session) => {
              const isRevoked = record.revoked_at !== null;
              const isCurrentSession = currentSessionId !== null && record.id === currentSessionId;

              return (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, alignItems: 'center' }}>
                  <Button onClick={() => setViewSession(record)}>View</Button>

                  {/* Show Revoke button ONLY if session is active AND not the current session */}
                  {!isRevoked && !isCurrentSession && (
                    <Popconfirm
                      title="Revoke Session"
                      description="Are you sure you want to terminate this session?"
                      onConfirm={() => handleRevoke(record.id)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button danger>Revoke</Button>
                    </Popconfirm>
                  )}

                  {/* Indicator badge for current session */}
                  {isCurrentSession && (
                    <span style={{ color: '#52c41a', fontSize: 12, fontWeight: 600 }}>
                      Current Session
                    </span>
                  )}
                </div>
              );
            },
          }
        ]}
      />

      {/* View Details Modal */}
      <Modal
        title="Session Details"
        open={!!viewSession}
        onCancel={() => setViewSession(null)}
        footer={[
          <Button key="close" onClick={() => setViewSession(null)}>
            Close
          </Button>,
        ]}
        width={700}
      >
        {viewSession && (
          <Descriptions column={1} bordered style={{ marginTop: 16 }}>
            <Descriptions.Item label="Session ID">{viewSession.id}</Descriptions.Item>
            <Descriptions.Item label="User ID">{viewSession.user_id}</Descriptions.Item>
            <Descriptions.Item label="User Name">
              {viewSession.user_name || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Role">{viewSession.role_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="IP Address">
              {viewSession.ip_address || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="User Agent">
              {viewSession.user_agent || '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Created At">
              {viewSession.created_at
                ? dayjs(viewSession.created_at).format('DD/MM/YYYY HH:mm:ss')
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Expires At">
              {viewSession.expires_at
                ? dayjs(viewSession.expires_at).format('DD/MM/YYYY HH:mm:ss')
                : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Revoked At">
              {viewSession.revoked_at
                ? dayjs(viewSession.revoked_at).format('DD/MM/YYYY HH:mm:ss')
                : 'Active'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}