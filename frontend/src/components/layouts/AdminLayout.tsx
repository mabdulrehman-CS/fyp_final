import { ReactNode } from 'react';
import { AdminSidebar } from '@/components/admin/AdminSidebar';
import { PageTransition } from '@/components/shared/PageTransition';

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <AdminSidebar />
      <main className="ml-64 min-h-screen p-8">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </div>
  );
}
