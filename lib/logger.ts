import { config } from "./config";

/**
 * Log levels in order of severity
 */
export enum LogLevel {
  DEBUG = "DEBUG",
  INFO = "INFO",
  WARN = "WARN",
  ERROR = "ERROR",
}

/**
 * Structured log entry
 */
interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  service: string;
  requestId?: string;
  userId?: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context?: Record<string, unknown>;
}

/**
 * Context storage for correlation IDs and user info
 * In production, this would use AsyncLocalStorage or a Request object
 */
const contextStorage: {
  requestId?: string;
  userId?: string;
} = {};

/**
 * Serialize error with stack trace
 */
function serializeError(error: unknown): LogEntry["error"] {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

/**
 * Format log entry based on environment
 * Development: human-readable format
 * Production: JSON format for log aggregation services
 */
function formatLogEntry(entry: LogEntry): string {
  if (config.isDevelopment) {
    // Human-readable format for development
    const parts: string[] = [];

    // Timestamp and level with color coding
    const timestamp = entry.timestamp;
    const levelColor = {
      [LogLevel.DEBUG]: "\x1b[36m", // Cyan
      [LogLevel.INFO]: "\x1b[32m", // Green
      [LogLevel.WARN]: "\x1b[33m", // Yellow
      [LogLevel.ERROR]: "\x1b[31m", // Red
    };
    const resetColor = "\x1b[0m";

    parts.push(`${levelColor[entry.level]}[${entry.level}]${resetColor}`);
    parts.push(timestamp);

    // Message
    parts.push(entry.message);

    // Request ID if present
    if (entry.requestId) {
      parts.push(`(req: ${entry.requestId})`);
    }

    // User ID if present
    if (entry.userId) {
      parts.push(`[user: ${entry.userId}]`);
    }

    // Error details
    if (entry.error) {
      parts.push(`\n  ${entry.error.name}: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(`\n  ${entry.error.stack}`);
      }
    }

    // Additional context
    if (entry.context && Object.keys(entry.context).length > 0) {
      parts.push(`\n  Context: ${JSON.stringify(entry.context, null, 2)}`);
    }

    return parts.join(" ");
  }

  // JSON format for production (compatible with CloudWatch, Sentry, etc.)
  return JSON.stringify(entry);
}

/**
 * Write log to appropriate output
 * In production, integrate with CloudWatch or other services
 */
function writeLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry);

  // Route to appropriate output based on log level
  if (entry.level === LogLevel.ERROR) {
    console.error(formatted);
  } else if (entry.level === LogLevel.WARN) {
    console.warn(formatted);
  } else {
    // eslint-disable-next-line no-console
    console.log(formatted);
  }

  // Future integration points:
  // - Sentry: Sentry.captureMessage() for ERROR/WARN
  // - CloudWatch: Send to AWS CloudWatch Logs
  // - DataDog: Use DataDog API
  // - ELK Stack: Send to Elasticsearch
}

/**
 * Create a log entry with common fields
 */
function createLogEntry(
  level: LogLevel,
  message: string,
  options?: {
    error?: unknown;
    context?: Record<string, unknown>;
    requestId?: string;
    userId?: string;
  }
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: "the-stewards-list",
    requestId: options?.requestId || contextStorage.requestId,
    userId: options?.userId || contextStorage.userId,
    ...(options?.error ? { error: serializeError(options.error) } : {}),
    ...(options?.context ? { context: options.context } : {}),
  };
}

/**
 * Logger instance with methods for each log level
 */
export const logger = {
  /**
   * Debug level logging (lowest priority)
   */
  debug(message: string, context?: Record<string, unknown>): void {
    if (config.isDevelopment) {
      const entry = createLogEntry(LogLevel.DEBUG, message, { context });
      writeLog(entry);
    }
  },

  /**
   * Info level logging (general information)
   */
  info(message: string, context?: Record<string, unknown>): void {
    const entry = createLogEntry(LogLevel.INFO, message, { context });
    writeLog(entry);
  },

  /**
   * Warning level logging (potential issues)
   */
  warn(message: string, context?: Record<string, unknown>): void {
    const entry = createLogEntry(LogLevel.WARN, message, { context });
    writeLog(entry);
  },

  /**
   * Error level logging (errors and exceptions)
   */
  error(
    message: string,
    error?: unknown,
    context?: Record<string, unknown>
  ): void {
    const entry = createLogEntry(LogLevel.ERROR, message, {
      error,
      context,
    });
    writeLog(entry);
  },

  /**
   * Set correlation ID for request tracing
   * Call this at the start of each request
   */
  setRequestId(requestId: string): void {
    contextStorage.requestId = requestId;
  },

  /**
   * Set user ID for tracking user actions
   */
  setUserId(userId: string): void {
    contextStorage.userId = userId;
  },

  /**
   * Clear context (call at end of request)
   */
  clearContext(): void {
    contextStorage.requestId = undefined;
    contextStorage.userId = undefined;
  },

  /**
   * Get current request ID
   */
  getRequestId(): string | undefined {
    return contextStorage.requestId;
  },

  /**
   * Get current user ID
   */
  getUserId(): string | undefined {
    return contextStorage.userId;
  },

  /**
   * Log an HTTP request
   * Use this for incoming requests
   */
  logRequest(
    method: string,
    path: string,
    options?: {
      queryParams?: Record<string, unknown>;
      headers?: Record<string, unknown>;
    }
  ): void {
    this.info("Incoming request", {
      method,
      path,
      queryParams: options?.queryParams,
      headers: options?.headers,
    });
  },

  /**
   * Log an HTTP response
   * Use this for outgoing responses
   */
  logResponse(
    method: string,
    path: string,
    statusCode: number,
    duration: number
  ): void {
    const level = statusCode >= 500 ? LogLevel.ERROR : LogLevel.INFO;
    const levelMethod = level === LogLevel.ERROR ? "error" : "info";

    this[levelMethod as "error" | "info"](`${method} ${path} - ${statusCode}`, {
      method,
      path,
      statusCode,
      durationMs: duration,
    });
  },

  /**
   * Generate a unique request ID for correlation
   * Use this format: timestamp-random-uuid
   */
  generateRequestId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${timestamp}-${random}`;
  },
};

/**
 * Middleware for Next.js to automatically set request ID
 * Usage in middleware.ts:
 *
 * import { logger } from '@/lib/logger';
 *
 * export function middleware(request: NextRequest) {
 *   const requestId = logger.generateRequestId();
 *   logger.setRequestId(requestId);
 *   logger.logRequest(request.method, request.nextUrl.pathname);
 *
 *   const response = NextResponse.next();
 *   response.headers.set('x-request-id', requestId);
 *
 *   return response;
 * }
 *
 * export const config = {
 *   matcher: ['/((?!_next/static|favicon.ico).*)'],
 * };
 */

/**
 * Middleware for API routes to track performance
 * Usage in API routes:
 *
 * import { logger } from '@/lib/logger';
 * import type { NextApiRequest, NextApiResponse } from 'next';
 *
 * export default async function handler(
 *   req: NextApiRequest,
 *   res: NextApiResponse
 * ) {
 *   const startTime = Date.now();
 *   const requestId = logger.generateRequestId();
 *   logger.setRequestId(requestId);
 *
 *   try {
 *     // Handle request
 *     res.status(200).json({ success: true });
 *   } catch (error) {
 *     logger.error('API error', error);
 *     res.status(500).json({ error: 'Internal server error' });
 *   } finally {
 *     const duration = Date.now() - startTime;
 *     logger.logResponse(req.method!, req.url!, res.statusCode, duration);
 *     logger.clearContext();
 *   }
 * }
 */

/**
 * Integration points for future monitoring services:
 *
 * SENTRY:
 * - Import { captureException, captureMessage } from '@sentry/nextjs'
 * - Call in error handler: Sentry.captureException(error)
 * - Use logger.error() to send to Sentry
 *
 * CLOUDWATCH:
 * - Import { CloudWatchClient, PutLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs'
 * - Create client instance and send logs
 * - Configure in environment: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
 *
 * DATADOG:
 * - Import DD from 'dd-trace'
 * - Initialize with: DD.init()
 * - Logger will automatically send traces
 *
 * ELK STACK:
 * - Import winston and @winstonjs/elasticsearch
 * - Configure with Elasticsearch connection
 * - Set transport to send JSON logs to Elasticsearch
 */

/**
 * Export log level enum for type safety across codebase
 */
export type { LogEntry };
