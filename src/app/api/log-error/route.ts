import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMIT_PRESETS } from '@/lib/rate-limiter';

interface ErrorLogEntry {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: string;
  url?: string;
  userAgent?: string;
  userId?: string;
  accountId?: string;
  additionalInfo?: Record<string, unknown>;
}

// In-memory error log (in production, use a database or external service)
const errorLogs: ErrorLogEntry[] = [];
const MAX_LOGS = 1000;

// POST /api/log-error - Log a client-side error
export async function POST(request: NextRequest) {
  // Simple rate limiting
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ||
             request.headers.get('x-real-ip') || 'unknown';
  const rateCheck = checkRateLimit(`${ip}:/api/log-error`, RATE_LIMIT_PRESETS.default);

  if (!rateCheck.allowed) {
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 });
  }

  try {
    const body = await request.json() as ErrorLogEntry;

    const logEntry: ErrorLogEntry = {
      message: body.message || 'Unknown error',
      stack: body.stack,
      componentStack: body.componentStack,
      timestamp: body.timestamp || new Date().toISOString(),
      url: body.url,
      userAgent: body.userAgent,
      userId: body.userId,
      accountId: body.accountId,
      additionalInfo: body.additionalInfo,
    };

    // Add to logs (circular buffer)
    errorLogs.unshift(logEntry);
    if (errorLogs.length > MAX_LOGS) {
      errorLogs.pop();
    }

    // In production, you would:
    // 1. Send to Sentry, LogRocket, or similar service
    // 2. Store in database for analysis
    // 3. Send alerts for critical errors

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[Client Error]', logEntry.message, '\n', logEntry.stack?.slice(0, 500));
    }

    return NextResponse.json({
      success: true,
      message: 'Error logged successfully',
    });
  } catch (error) {
    console.error('Error logging client error:', error);
    return NextResponse.json(
      { error: 'Failed to log error' },
      { status: 500 }
    );
  }
}

// GET /api/log-error - Get recent errors (admin only, for debugging)
export async function GET(request: NextRequest) {
  // In production, add authentication check for admin users
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get('limit') || '50', 10);

  // Only allow in development or for authenticated admins
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  return NextResponse.json({
    success: true,
    count: errorLogs.length,
    errors: errorLogs.slice(0, Math.min(limit, 100)),
  });
}
