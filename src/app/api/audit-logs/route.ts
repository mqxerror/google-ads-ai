import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getAuditLogs, getRecentActivitySummary } from '@/lib/audit-log';

export async function GET(request: NextRequest) {
  try {
    // Get authenticated user session
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const actionType = searchParams.get('actionType') || undefined;
    const status = searchParams.get('status') || undefined;
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const summary = searchParams.get('summary') === 'true';

    // If summary is requested, return summary data
    if (summary) {
      const summaryData = await getRecentActivitySummary(user.id, accountId);
      return NextResponse.json(summaryData);
    }

    // Otherwise return paginated logs
    const result = await getAuditLogs({
      userId: user.id,
      accountId,
      entityType,
      actionType,
      status,
      startDate,
      endDate,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch audit logs' },
      { status: 500 }
    );
  }
}
