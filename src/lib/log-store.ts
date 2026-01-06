/**
 * Simple in-memory log store for debugging API calls
 * Logs are stored in memory and cleared on server restart
 */

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  category: 'google_ads' | 'mcp' | 'ai' | 'api' | 'sync';
  message: string;
  data?: Record<string, unknown>;
  duration?: number; // ms
}

// In-memory store (will reset on server restart)
const logs: LogEntry[] = [];
const MAX_LOGS = 500;

export function addLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): LogEntry {
  const log: LogEntry = {
    ...entry,
    id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    timestamp: new Date(),
  };

  logs.unshift(log); // Add to front (newest first)

  // Trim old logs
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS;
  }

  return log;
}

export function getLogs(options?: {
  limit?: number;
  category?: LogEntry['category'];
  level?: LogEntry['level'];
  since?: Date;
}): LogEntry[] {
  let result = [...logs];

  if (options?.category) {
    result = result.filter(l => l.category === options.category);
  }

  if (options?.level) {
    result = result.filter(l => l.level === options.level);
  }

  if (options?.since) {
    const since = options.since;
    result = result.filter(l => l.timestamp >= since);
  }

  if (options?.limit) {
    result = result.slice(0, options.limit);
  }

  return result;
}

export function clearLogs(): void {
  logs.length = 0;
}

// Helper to log Google Ads API calls
export function logGoogleAdsCall(
  operation: string,
  details: Record<string, unknown>,
  startTime?: number
): LogEntry {
  return addLog({
    level: 'info',
    category: 'google_ads',
    message: `[Google Ads] ${operation}`,
    data: details,
    duration: startTime ? Date.now() - startTime : undefined,
  });
}

// Helper to log MCP operations
export function logMCPOperation(
  operation: string,
  details: Record<string, unknown>,
  startTime?: number
): LogEntry {
  return addLog({
    level: 'info',
    category: 'mcp',
    message: `[MCP] ${operation}`,
    data: details,
    duration: startTime ? Date.now() - startTime : undefined,
  });
}

// Helper to log AI/chat calls
export function logAICall(
  operation: string,
  details: Record<string, unknown>,
  startTime?: number
): LogEntry {
  return addLog({
    level: 'info',
    category: 'ai',
    message: `[AI] ${operation}`,
    data: details,
    duration: startTime ? Date.now() - startTime : undefined,
  });
}

// Helper to log errors
export function logError(
  category: LogEntry['category'],
  message: string,
  error: unknown
): LogEntry {
  return addLog({
    level: 'error',
    category,
    message,
    data: {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    },
  });
}
