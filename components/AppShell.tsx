'use client';

import { useState } from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  ShopOutlined,
  FileTextOutlined,
  SettingOutlined,
  UserOutlined,
  KeyOutlined,
  IdcardOutlined,
  SafetyCertificateOutlined,
  FileSearchOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import LogoutButton from './LogoutButton';

const { Sider, Header, Content } = Layout;

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: <Link href="/dashboard">Dashboard</Link> },
  { key: '/clients', icon: <TeamOutlined />, label: <Link href="/clients">Participants</Link> },
  { key: '/providers', icon: <ShopOutlined />, label: <Link href="/providers">Providers</Link> },
  {
    key: '/invoices-group',
    icon: <FileTextOutlined />,
    label: 'Invoices',
    children: [
      { key: '/invoices', label: <Link href="/invoices">Invoice List</Link> },
      { key: '/invoices/upload-history', label: <Link href="/invoices/upload-history">Upload History</Link> },
    ],
  },
  { key: '/rate-sets', icon: <DollarOutlined />, label: <Link href="/rate-sets">Rate Sets</Link> },
  {
    key: '/settings-group',
    icon: <SettingOutlined />,
    label: 'Settings',
    children: [
      { key: '/users', icon: <UserOutlined />, label: <Link href="/users">Users</Link> },
      { key: '/roles', icon: <KeyOutlined />, label: <Link href="/roles">User Roles</Link> },
      { key: '/genders', icon: <IdcardOutlined />, label: <Link href="/genders">Genders</Link> },
      { key: '/sessions', icon: <SafetyCertificateOutlined />, label: <Link href="/sessions">Auth Sessions</Link> },
      { key: '/audit-logs', icon: <FileSearchOutlined />, label: <Link href="/audit-logs">Audit Logs</Link> },
    ],
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [openKeys, setOpenKeys] = useState<string[]>(['/invoices-group', '/settings-group']);

  if (pathname === '/login') {
    return <>{children}</>;
  }

  // Accurately finds the selected key for exact and nested routes
  const getSelectedKey = () => {
    // 1. Exact match for upload history
    if (pathname.startsWith('/invoices/upload-history')) {
      return '/invoices/upload-history';
    }
    
    // 2. Base invoice list routes (e.g., /invoices/123/edit)
    if (pathname.startsWith('/invoices')) {
      return '/invoices';
    }

    // 3. Top-level direct matches
    const matchingItem = menuItems.find((item) => item.key !== '/invoices-group' && item.key !== '/settings-group' && pathname.startsWith(item.key));
    if (matchingItem) return matchingItem.key;

    // 4. Nested sub-items match
    const settingsItems = menuItems.find((item) => item.key === '/settings-group')?.children;
    const matchingSubItem = settingsItems?.find((subItem) => pathname.startsWith(subItem.key));

    return matchingSubItem ? matchingSubItem.key : pathname;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} style={{ background: '#fff', borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ fontWeight: 600, fontSize: 16 }}>My NDIS Portal</div>
          <div style={{ fontSize: 12, color: '#888' }}>Default Super Admin</div>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          openKeys={openKeys}
          onOpenChange={(keys) => setOpenKeys(keys)}
          items={menuItems}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: '#fff',
            borderBottom: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'center',
            padding: '0 24px',
          }}
        >
          <LogoutButton />
        </Header>
        <Content style={{ background: '#fff' }}>{children}</Content>
      </Layout>
    </Layout>
  );
}