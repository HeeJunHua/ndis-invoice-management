'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Table, Button, Modal, Form, Input, Select, Switch, Popconfirm, message } from 'antd';
import { ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { apiClient } from '@/lib/api-client';
import dayjs from 'dayjs';

interface Gender {
  id: number;
  code: string;
  label: string;
  deactivated_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export default function GendersPage() {
  const [data, setData] = useState<Gender[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGender, setEditingGender] = useState<Gender | null>(null);
  const [form] = Form.useForm();

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);

  const fetchGenders = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get<Gender[]>('/api/genders');
      setData(res);
    } catch (e: any) {
      message.error(e.message || 'Failed to fetch genders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGenders();
  }, []);

  const filteredGenders = useMemo(() => {
    return data.filter((gender) => {
      // Search Label or Code
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchesLabel = gender.label.toLowerCase().includes(q);
        const matchesCode = gender.code.toLowerCase().includes(q);
        if (!matchesLabel && !matchesCode) return false;
      }

      // Active status filter (Active if deactivated_at is null)
      if (activeFilter !== undefined) {
        const isActive = gender.deactivated_at === null;
        if (isActive !== activeFilter) return false;
      }

      return true;
    });
  }, [data, searchQuery, activeFilter]);

  const handleOpenModal = (gender: Gender | null = null) => {
    setEditingGender(gender);
    if (gender) {
      form.setFieldsValue({
        code: gender.code,
        label: gender.label,
        isActive: gender.deactivated_at === null,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        isActive: true, // Default to Active when adding new
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      const { isActive, ...rest } = values;
      const payload = {
        code: rest.code,
        label: rest.label,
      };

      if (editingGender) {
        await apiClient.patch(`/api/genders/${editingGender.id}`, payload);

        const wasActive = editingGender.deactivated_at === null;
        if (typeof isActive === 'boolean' && isActive !== wasActive) {
          await apiClient.patch(`/api/genders/${editingGender.id}/status`, { active: isActive });
        }
        message.success('Gender updated successfully');
      } else {
        const createPayload = {
          ...payload,
          deactivated_at: isActive ? null : new Date().toISOString(),
        };
        await apiClient.post('/api/genders', createPayload);
        message.success('Gender created successfully');
      }
      setIsModalOpen(false);
      fetchGenders();
    } catch (e: any) {
      message.error(e.message || 'Save failed');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/api/genders/${id}`);
      message.success('Gender deactivated successfully');
      fetchGenders();
    } catch (e: any) {
      message.error(e.message || 'Delete failed');
    }
  };

  return (
    <div style={{ padding: 24 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 4 }}>Genders</h1>
        <p style={{ color: '#888', margin: 0 }}>Manage gender dropdown values.</p>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Button icon={<ReloadOutlined />} onClick={fetchGenders}>
          Refresh
        </Button>
        <Button type="primary" onClick={() => handleOpenModal()}>
          Add Gender
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

      {/* Table */}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredGenders}
        pagination={{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50', '100'],
          defaultPageSize: 20,
          showTotal: (total) => `Total: ${total}`,
        }}
        columns={[
          {
            title: 'Label',
            dataIndex: 'label',
            key: 'label',
          },
          {
            title: 'Code',
            dataIndex: 'code',
            key: 'code',
          },
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
            title: 'Updated At',
            dataIndex: 'updated_at',
            key: 'updated_at',
            render: (v) => (v ? dayjs(v).format('DD/MM/YYYY HH:mm:ss') : '—'),
          },
          {
            title: 'Actions',
            key: 'actions',
            align: 'right',
            render: (_, record) => (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button onClick={() => handleOpenModal(record)}>Edit</Button>
                <Popconfirm
                  title="Deactivate Gender"
                  description="Are you sure you want to deactivate this gender lookup?"
                  onConfirm={() => handleDelete(record.id)}
                  okText="Yes"
                  cancelText="No"
                >
                  <Button danger>Delete</Button>
                </Popconfirm>
              </div>
            ),
          },
        ]}
      />

      {/* Modal */}
      <Modal
        title={editingGender ? 'Edit Gender' : 'Add Gender'}
        open={isModalOpen}
        onOk={handleSave}
        onCancel={() => setIsModalOpen(false)}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="label"
            label="Label"
            rules={[{ required: true, message: 'Please input the label' }]}
          >
            <Input placeholder="e.g. Female" />
          </Form.Item>
          <Form.Item
            name="code"
            label="Code"
            rules={[{ required: true, message: 'Please input the code' }]}
          >
            <Input placeholder="e.g. FEMALE" />
          </Form.Item>
          <Form.Item
            name="isActive"
            label="Active Status"
            valuePropName="checked"
          >
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}