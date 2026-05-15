import { ReactNode } from 'react';
import { CandidateSidebar } from '@/components/candidate/CandidateSidebar';
import { PageTransition } from '@/components/shared/PageTransition';

interface CandidateLayoutProps {
  children: ReactNode;
}

export function CandidateLayout({ children }: CandidateLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <CandidateSidebar />
      <main className="ml-64 min-h-screen p-8">
        <PageTransition>
          {children}
        </PageTransition>
      </main>
    </div>
  );
}
