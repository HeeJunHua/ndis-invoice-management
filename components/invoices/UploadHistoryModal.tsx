'use client';

import { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Button, Modal, message } from 'antd';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';

interface UploadBatch {
  id: string;
  status: string;
  file_count: number;
  total_size: number;
  error_message: string | null;
  created_at: string;
}

interface UploadFile {
  id: string;
  original_name: string;
  processing_status: string;
  invoice_id: number | null;
  error_message: string | null;
}

interface UploadHistoryModalProps {
  open: boolean;
  onCancel: () => void;
}

export default function UploadHistoryModal({ open, onCancel }: UploadHistoryModalProps) {
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<UploadBatch[]>('/api/invoice-uploads');
      setBatches(data);
      return data;
    } catch (e) {
      message.error((e as Error).message);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const openBatch = useCallback(async (batchId: string) => {
    setViewingBatchId(batchId);
    setFilesLoading(true);
    try {
      setFiles(await apiFetch<UploadFile[]>(`/api/invoice-uploads/${batchId}`));
    } catch (e) {
      message.error((e as Error).message);
    } finally {
      setFilesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      load();
    }
  }, [open, load]);

  return (
    <Modal
      title="Upload History"
      open={open}
      onCancel={onCancel}
      footer={<Button onClick={onCancel}>Close</Button>}
      width={800}
    >
      <div style={{ padding: '0 0 16px 0' }}>
        <p style={{ color: '#888', marginBottom: 16 }}>
          Monitor uploaded invoice batches and their source files.
        </p>
        <Button onClick={load} style={{ marginBottom: 16 }}>
          Refresh
        </Button>

        <Table
          rowKey="id"
          loading={loading}
          dataSource={batches}
          columns={[
            { title: 'Uploaded', dataIndex: 'created_at', render: (v) => new Date(v).toLocaleString() },
            { title: 'Status', dataIndex: 'status', render: (v) => <Tag>{v}</Tag> },
            { title: 'Files', dataIndex: 'file_count' },
            {
              title: 'Size',
              dataIndex: 'total_size',
              render: (v: number) => `${(v / (1024 * 1024)).toFixed(2)} MB`,
            },
            { title: 'Error', dataIndex: 'error_message', render: (v) => v || '—' },
            {
              title: 'Actions',
              render: (_, record) => (
                <Button type="primary" ghost onClick={() => openBatch(record.id)}>
                  View Files
                </Button>
              ),
            },
          ]}
        />
      </div>

      <Modal
        title="Batch Files"
        open={viewingBatchId !== null}
        onCancel={() => setViewingBatchId(null)}
        footer={<Button onClick={() => setViewingBatchId(null)}>Close</Button>}
        width={700}
      >
        <Table
          rowKey="id"
          loading={filesLoading}
          dataSource={files}
          pagination={false}
          columns={[
            { title: 'File', dataIndex: 'original_name' },
            { title: 'Status', dataIndex: 'processing_status', render: (v) => <Tag>{v}</Tag> },
            {
              title: 'Invoice',
              dataIndex: 'invoice_id',
              render: (v: number | null) =>
                v ? <Link href={`/invoices/${v}/edit`}>#{v}</Link> : '—',
            },
            { title: 'Error', dataIndex: 'error_message', render: (v) => v || '—' },
          ]}
        />
      </Modal>
    </Modal>
  );
}
