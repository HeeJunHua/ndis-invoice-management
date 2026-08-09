'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Form, Input, Button, Card, Typography, Alert } from 'antd';
import { apiFetch } from '@/lib/api-client';

const { Title } = Typography;

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const targetUrl = searchParams.get('callbackUrl') || searchParams.get('from') || '/dashboard';

  async function onFinish(values: { email: string; password: string }) {
    setError(null);
    setLoading(true);
    try {
      await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      router.push(targetUrl);
    } catch (e) {
      setError((e as Error).message || 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card style={{ width: 360 }}>
      <Title level={3} style={{ textAlign: 'center' }}>
        NDIS Invoice Management
      </Title>
      {error && <Alert type="error" title={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email' }]}>
          <Input autoFocus />
        </Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Log In
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f5f5f5',
      }}
    >
      <Suspense fallback={<div>Loading...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}