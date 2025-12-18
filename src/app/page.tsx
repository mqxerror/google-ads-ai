import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { SmartGrid } from '@/components/SmartGrid';

export default async function Home() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return (
    <AppShell>
      <SmartGrid />
    </AppShell>
  );
}
