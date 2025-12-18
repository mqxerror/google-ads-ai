import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import ReportsPageContent from './ReportsPageContent';

export default async function ReportsPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <AppShell>
      <ReportsPageContent />
    </AppShell>
  );
}
