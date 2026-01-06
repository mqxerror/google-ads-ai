import { NextRequest, NextResponse } from 'next/server';
import { getLogs, clearLogs, LogEntry } from '@/lib/log-store';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '100');
  const category = searchParams.get('category') as LogEntry['category'] | undefined;
  const level = searchParams.get('level') as LogEntry['level'] | undefined;
  const sinceStr = searchParams.get('since');
  const since = sinceStr ? new Date(sinceStr) : undefined;

  const logs = getLogs({
    limit,
    category: category || undefined,
    level: level || undefined,
    since,
  });

  return NextResponse.json({
    logs,
    count: logs.length,
    timestamp: new Date().toISOString(),
  });
}

export async function DELETE() {
  clearLogs();
  return NextResponse.json({ success: true, message: 'Logs cleared' });
}
