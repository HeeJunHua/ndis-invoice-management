'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { Table, Tag, Button, Modal, message } from 'antd';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { useSearchParams } from 'next/navigation';

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

export default function UploadHistoryPage() {
  return (
    <Suspense fallback={null}>
      <UploadHistoryPageInner />
    </Suspense>
  );
}

function UploadHistoryPageInner() {
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);

  const searchParams = useSearchParams();

  // 1. Fetch all batches from the backend API
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

  // 2. Fetch specific files when clicking "View Files" or passing editId
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

  // 3. Runs ON MOUNT: Always loads the full list, and opens the popup ONLY if editId exists
  useEffect(() => {
    async function init() {
      const fetchedBatches = await load();
      
      const editId = searchParams.get('editId');
      if (editId) {
        const match = fetchedBatches.find((b) => b.id === editId);
        if (match) {
          openBatch(match.id);
        }
      }
    }

    init();
  }, [load, openBatch, searchParams]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ marginBottom: 4 }}>Upload History</h1>
        <p style={{ color: '#888', margin: 0 }}>
          Monitor uploaded invoice batches and their source files.
        </p>
      </div>

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

      {/* Modal Popup: displays files for selected batch */}
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
    </div>
  );
}