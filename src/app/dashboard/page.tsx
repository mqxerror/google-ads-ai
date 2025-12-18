import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import DashboardPage from '@/components/Dashboard/DashboardPage';

export default async function Dashboard() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <AppShell>
      <DashboardPage />
    </AppShell>
  );
}
