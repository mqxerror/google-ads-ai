import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMIT_PRESETS } from './rate-limiter';

export type ApiHandler = (
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) => Promise<NextResponse>;

interface MiddlewareOptions {
  rateLimit?: keyof typeof RATE_LIMIT_PRESETS | false;
  requireAuth?: boolean;
  validateBody?: boolean;
  allowedMethods?: string[];
}

/**
 * Create a wrapped API handler with common middleware
 */
export function withMiddleware(
  handler: ApiHandler,
  options: MiddlewareOptions = {}
): ApiHandler {
  return async (request: NextRequest, context) => {
    const {
      rateLimit = 'default',
      allowedMethods,
    } = options;

    // Method validation
    if (allowedMethods && !allowedMethods.includes(request.method)) {
      return NextResponse.json(
        { error: `Method ${request.method} not allowed` },
        { status: 405 }
      );
    }

    // Rate limiting
    if (rateLimit !== false) {
      const ip = getClientIp(request);
      const key = `${ip}:${request.nextUrl.pathname}`;
      const config = RATE_LIMIT_PRESETS[rateLimit];
      const result = checkRateLimit(key, config);

      if (!result.allowed) {
        return NextResponse.json(
          {
            error: result.blocked
              ? 'Too many requests. You have been temporarily blocked.'
              : 'Rate limit exceeded. Please try again later.',
            retryAfter: Math.ceil(result.resetIn / 1000),
          },
          {
            status: 429,
            headers: {
              'Retry-After': String(Math.ceil(result.resetIn / 1000)),
              'X-RateLimit-Limit': String(config.maxRequests),
              'X-RateLimit-Remaining': String(result.remaining),
              'X-RateLimit-Reset': String(Date.now() + result.resetIn),
            },
          }
        );
      }
    }

    // Call the actual handler
    try {
      return await handler(request, context);
    } catch (error) {
      console.error('API Error:', error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'Internal server error',
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Get client IP from request headers
 */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwardedFor?.split(',')[0] || realIp || 'unknown';
}

/**
 * Validate request body against a schema
 */
export async function validateRequestBody<T>(
  request: NextRequest,
  validator: (body: unknown) => body is T
): Promise<{ valid: true; body: T } | { valid: false; error: string }> {
  try {
    const body = await request.json();
    if (validator(body)) {
      return { valid: true, body };
    }
    return { valid: false, error: 'Invalid request body' };
  } catch {
    return { valid: false, error: 'Invalid JSON body' };
  }
}

/**
 * Success response helper
 */
export function successResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

/**
 * Error response helper
 */
export function errorResponse(
  message: string,
  status = 400,
  details?: Record<string, unknown>
): NextResponse {
  return NextResponse.json(
    {
      error: message,
      ...details,
    },
    { status }
  );
}

/**
 * CORS headers helper
 */
export function withCors(response: NextResponse, origin = '*'): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', origin);
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return response;
}

/**
 * Cache control helper
 */
export function withCache(
  response: NextResponse,
  maxAge: number,
  staleWhileRevalidate?: number
): NextResponse {
  let cacheControl = `public, max-age=${maxAge}`;
  if (staleWhileRevalidate) {
    cacheControl += `, stale-while-revalidate=${staleWhileRevalidate}`;
  }
  response.headers.set('Cache-Control', cacheControl);
  return response;
}

/**
 * No cache helper
 */
export function withNoCache(response: NextResponse): NextResponse {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  return response;
}
