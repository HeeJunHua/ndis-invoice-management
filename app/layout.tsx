import type { Metadata } from 'next';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import AppShell from '@/components/AppShell';

export const metadata: Metadata = {
  title: 'NDIS Invoice Management',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AntdRegistry>
          <AppShell>{children}</AppShell>
        </AntdRegistry>
      </body>
    </html>
  );
}