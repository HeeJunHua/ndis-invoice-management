'use client';

import { useEffect, useState } from 'react';
import { Card, Col, Row, Typography, Statistic, Spin, Tag, Table } from 'antd';
import {
  TeamOutlined,
  ShopOutlined,
  FileTextOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';

const { Title, Paragraph } = Typography;

interface Invoice {
  id: number;
  invoice_number: string | null;
  invoice_date: string | null;
  amount: string | null;
  status: string;
}

interface Stats {
  clients: number;
  providers: number;
  rateSets: number;
  invoicesDraft: number;
  invoicesCompleted: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [clients, providers, rateSets, invoices] = await Promise.all([
          apiFetch<unknown[]>('/api/clients'),
          apiFetch<unknown[]>('/api/providers'),
          apiFetch<unknown[]>('/api/rate-sets'),
          apiFetch<Invoice[]>('/api/invoices'),
        ]);

        setStats({
          clients: clients.length,
          providers: providers.length,
          rateSets: rateSets.length,
          invoicesDraft: invoices.filter((i) => i.status === 'drafted').length,
          invoicesCompleted: invoices.filter((i) => i.status === 'completed').length,
        });

        setRecentInvoices(
          [...invoices]
            .sort((a, b) => (a.id > b.id ? -1 : 1))
            .slice(0, 5),
        );
      } catch {
        // Dashboard is a summary view — if a module's API isn't reachable
        // yet, fail quietly rather than blocking the whole page.
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards = [
    {
      href: '/clients',
      title: 'Participants',
      value: stats?.clients,
      icon: <TeamOutlined style={{ fontSize: 24, color: '#1677ff' }} />,
    },
    {
      href: '/providers',
      title: 'Providers',
      value: stats?.providers,
      icon: <ShopOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
    },
    {
      href: '/rate-sets',
      title: 'Rate Sets',
      value: stats?.rateSets,
      icon: <DollarOutlined style={{ fontSize: 24, color: '#faad14' }} />,
    },
    {
      href: '/invoices',
      title: 'Draft Invoices',
      value: stats?.invoicesDraft,
      icon: <ClockCircleOutlined style={{ fontSize: 24, color: '#fa8c16' }} />,
    },
    {
      href: '/invoices',
      title: 'Completed Invoices',
      value: stats?.invoicesCompleted,
      icon: <CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Dashboard</Title>
      <Paragraph type="secondary">Overview of participants, providers, rate sets, and invoices.</Paragraph>

      <Spin spinning={loading}>
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          {cards.map((c) => (
            <Col xs={24} sm={12} md={8} lg={4} key={c.title}>
              <Link href={c.href}>
                <Card hoverable>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Statistic title={c.title} value={c.value ?? 0} />
                    {c.icon}
                  </div>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>

        <Card title="Recent Invoices" extra={<Link href="/invoices">View all</Link>}>
          <Table
            rowKey="id"
            dataSource={recentInvoices}
            pagination={false}
            columns={[
              { title: 'Invoice #', dataIndex: 'invoice_number' },
              { title: 'Date', dataIndex: 'invoice_date' },
              { title: 'Amount', dataIndex: 'amount' },
              {
                title: 'Status',
                dataIndex: 'status',
                render: (v: string) => (
                  <Tag color={v === 'completed' ? 'green' : 'orange'}>{v.toUpperCase()}</Tag>
                ),
              },
            ]}
          />
        </Card>
      </Spin>
    </div>
  );
}