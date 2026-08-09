'use client';

import { Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.push('/login');
    }
  }

  return (
    <Button icon={<LogoutOutlined />} onClick={handleLogout}>
      Log Out
    </Button>
  );
}