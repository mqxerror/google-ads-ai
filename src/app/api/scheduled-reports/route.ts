import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';

// Scheduled report configuration stored in database
interface ScheduledReport {
  id: string;
  userId: string;
  accountId: string;
  name: string;
  schedule: 'daily' | 'weekly' | 'monthly';
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  time: string; // HH:MM format
  metrics: string[];
  format: 'csv' | 'pdf' | 'email';
  emailRecipients?: string[];
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  createdAt: string;
  updatedAt: string;
}

// GET /api/scheduled-reports - List all scheduled reports for user
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const accountId = searchParams.get('accountId');

    // For now, store scheduled reports in a JSON field or separate collection
    // In production, you'd create a ScheduledReport model in Prisma
    // This is a mock implementation showing the structure

    const reports: ScheduledReport[] = [
      // Mock data - in production, fetch from database
    ];

    return NextResponse.json({
      success: true,
      reports,
      message: 'Scheduled reports feature ready. Configure your first report below.',
    });
  } catch (error) {
    console.error('Error fetching scheduled reports:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch reports' },
      { status: 500 }
    );
  }
}

// POST /api/scheduled-reports - Create a new scheduled report
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = await request.json();
    const {
      accountId,
      name,
      schedule,
      dayOfWeek,
      dayOfMonth,
      time,
      metrics,
      format,
      emailRecipients,
    } = body as {
      accountId: string;
      name: string;
      schedule: 'daily' | 'weekly' | 'monthly';
      dayOfWeek?: number;
      dayOfMonth?: number;
      time: string;
      metrics: string[];
      format: 'csv' | 'pdf' | 'email';
      emailRecipients?: string[];
    };

    // Validate required fields
    if (!accountId || !name || !schedule || !time || !metrics || !format) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Calculate next run time
    const nextRun = calculateNextRun(schedule, time, dayOfWeek, dayOfMonth);

    const newReport: ScheduledReport = {
      id: uuidv4(),
      userId: user.id,
      accountId,
      name,
      schedule,
      dayOfWeek,
      dayOfMonth,
      time,
      metrics,
      format,
      emailRecipients,
      enabled: true,
      nextRun: nextRun.toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // In production, save to database
    // await prisma.scheduledReport.create({ data: newReport });

    return NextResponse.json({
      success: true,
      report: newReport,
      message: `Report "${name}" scheduled successfully. Next run: ${nextRun.toLocaleString()}`,
    });
  } catch (error) {
    console.error('Error creating scheduled report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create report' },
      { status: 500 }
    );
  }
}

// PATCH /api/scheduled-reports - Update a scheduled report
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, enabled, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
    }

    // In production, update in database
    // await prisma.scheduledReport.update({ where: { id }, data: updates });

    return NextResponse.json({
      success: true,
      message: enabled !== undefined
        ? `Report ${enabled ? 'enabled' : 'disabled'}`
        : 'Report updated successfully',
    });
  } catch (error) {
    console.error('Error updating scheduled report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update report' },
      { status: 500 }
    );
  }
}

// DELETE /api/scheduled-reports - Delete a scheduled report
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
    }

    // In production, delete from database
    // await prisma.scheduledReport.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: 'Scheduled report deleted',
    });
  } catch (error) {
    console.error('Error deleting scheduled report:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete report' },
      { status: 500 }
    );
  }
}

// Helper function to calculate next run time
function calculateNextRun(
  schedule: 'daily' | 'weekly' | 'monthly',
  time: string,
  dayOfWeek?: number,
  dayOfMonth?: number
): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const now = new Date();
  const nextRun = new Date();

  nextRun.setHours(hours, minutes, 0, 0);

  if (schedule === 'daily') {
    if (nextRun <= now) {
      nextRun.setDate(nextRun.getDate() + 1);
    }
  } else if (schedule === 'weekly' && dayOfWeek !== undefined) {
    const currentDay = now.getDay();
    let daysUntil = dayOfWeek - currentDay;
    if (daysUntil < 0 || (daysUntil === 0 && nextRun <= now)) {
      daysUntil += 7;
    }
    nextRun.setDate(nextRun.getDate() + daysUntil);
  } else if (schedule === 'monthly' && dayOfMonth !== undefined) {
    nextRun.setDate(dayOfMonth);
    if (nextRun <= now) {
      nextRun.setMonth(nextRun.getMonth() + 1);
    }
  }

  return nextRun;
}
