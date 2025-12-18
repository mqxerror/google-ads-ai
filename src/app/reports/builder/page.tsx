import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import ReportBuilder from '@/components/ReportBuilder/ReportBuilder';
import { mockCampaigns } from '@/lib/mock-data';

export default async function ReportBuilderPage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  return <ReportBuilder campaigns={mockCampaigns} />;
}
