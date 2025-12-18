/**
 * Error handling utilities for API calls and rate limiting
 */

export interface ApiError {
  message: string;
  code: string;
  statusCode?: number;
  retryAfter?: number;
  details?: unknown;
}

export class RateLimitError extends Error {
  retryAfter: number;

  constructor(message: string, retryAfter: number = 60) {
    super(message);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication required. Please sign in again.') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ApiKeyError extends Error {
  provider: string;

  constructor(provider: string, message?: string) {
    super(message || `Invalid ${provider} API key. Please check your API key in Settings.`);
    this.name = 'ApiKeyError';
    this.provider = provider;
  }
}

export class GoogleAdsError extends Error {
  errorCode?: string;

  constructor(message: string, errorCode?: string) {
    super(message);
    this.name = 'GoogleAdsError';
    this.errorCode = errorCode;
  }
}

/**
 * Parse error from API response
 */
export function parseApiError(response: Response, body?: { error?: string; message?: string; details?: unknown }): ApiError {
  const message = body?.error || body?.message || getDefaultErrorMessage(response.status);
  const code = getErrorCode(response.status);

  const error: ApiError = {
    message,
    code,
    statusCode: response.status,
    details: body?.details,
  };

  // Check for rate limit headers
  const retryAfter = response.headers.get('Retry-After');
  if (retryAfter) {
    error.retryAfter = parseInt(retryAfter, 10);
  }

  return error;
}

function getDefaultErrorMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Authentication required. Please sign in again.';
    case 403:
      return 'Access denied. You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 429:
      return 'Too many requests. Please wait a moment before trying again.';
    case 500:
      return 'An internal server error occurred. Please try again later.';
    case 502:
      return 'Service temporarily unavailable. Please try again later.';
    case 503:
      return 'Service unavailable. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

function getErrorCode(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 429: return 'RATE_LIMIT';
    case 500: return 'INTERNAL_ERROR';
    case 502: return 'BAD_GATEWAY';
    case 503: return 'SERVICE_UNAVAILABLE';
    default: return 'UNKNOWN_ERROR';
  }
}

/**
 * Retry configuration for API calls
 */
export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  retryOn: number[];
}

const defaultRetryConfig: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  retryOn: [429, 500, 502, 503],
};

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(attempt: number, config: RetryConfig = defaultRetryConfig): number {
  const delay = Math.min(config.baseDelay * Math.pow(2, attempt), config.maxDelay);
  // Add jitter to prevent thundering herd
  const jitter = delay * 0.1 * Math.random();
  return delay + jitter;
}

/**
 * Fetch with retry logic
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  config: Partial<RetryConfig> = {}
): Promise<Response> {
  const retryConfig = { ...defaultRetryConfig, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);

      // If successful or non-retryable error, return immediately
      if (response.ok || !retryConfig.retryOn.includes(response.status)) {
        return response;
      }

      // If rate limited with Retry-After header, use that timing
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          const waitTime = parseInt(retryAfter, 10) * 1000;
          if (waitTime <= retryConfig.maxDelay) {
            await sleep(waitTime);
            continue;
          }
        }
      }

      // If last attempt, return the response
      if (attempt === retryConfig.maxRetries) {
        return response;
      }

      // Wait before retrying
      const delay = calculateBackoff(attempt, retryConfig);
      await sleep(delay);

    } catch (error) {
      lastError = error as Error;

      // If last attempt, throw the error
      if (attempt === retryConfig.maxRetries) {
        throw lastError;
      }

      // Wait before retrying
      const delay = calculateBackoff(attempt, retryConfig);
      await sleep(delay);
    }
  }

  throw lastError || new Error('Fetch failed after retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * User-friendly error messages for display
 */
export function getUserFriendlyMessage(error: unknown): string {
  if (error instanceof RateLimitError) {
    return `Rate limit reached. Please try again in ${error.retryAfter} seconds.`;
  }

  if (error instanceof AuthenticationError) {
    return error.message;
  }

  if (error instanceof ApiKeyError) {
    return error.message;
  }

  if (error instanceof GoogleAdsError) {
    return `Google Ads Error: ${error.message}`;
  }

  if (error instanceof Error) {
    // Don't expose internal error details to users
    if (error.message.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    return error.message;
  }

  return 'An unexpected error occurred. Please try again.';
}

/**
 * Log error for debugging while returning user-friendly message
 */
export function handleError(error: unknown, context?: string): string {
  const prefix = context ? `[${context}] ` : '';
  console.error(`${prefix}Error:`, error);

  return getUserFriendlyMessage(error);
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof RateLimitError) {
    return true;
  }

  if (error instanceof Error) {
    // Network errors are usually retryable
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return true;
    }
  }

  return false;
}

/**
 * Format retry-after time for display
 */
export function formatRetryTime(seconds: number): string {
  if (seconds < 60) {
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  }

  const minutes = Math.ceil(seconds / 60);
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}
