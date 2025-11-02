import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * CORS Configuration
 * Defines allowed origins for cross-origin requests
 * Update ALLOWED_ORIGINS based on your deployment environment
 */
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  process.env.NEXT_PUBLIC_APP_URL,
].filter(Boolean) as string[];

/**
 * Security headers that should be applied to all responses
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

/**
 * List of paths that should skip validation
 * Useful for public endpoints or health checks
 */
const VALIDATION_SKIP_PATHS = ["/api/health", "/api/status"];

/**
 * Logging configuration
 * In production, integrate with Sentry, DataDog, or similar
 */
interface LogContext {
  timestamp: string;
  method: string;
  path: string;
  status?: number;
  duration?: number;
  error?: string;
  userId?: string;
}

/**
 * Log request/response information
 * TODO: Integrate with external logging service (Sentry, DataDog, etc.)
 *
 * @param context - Logging context
 */
function logRequest(context: LogContext): void {
  const isDevelopment = process.env.NODE_ENV === "development";

  if (isDevelopment) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(context, null, 2));
  } else {
    // In production, send to external logging service
    // Example: sentry.captureMessage(JSON.stringify(context));
    // For now, just log to stderr for container log capture
    console.error(JSON.stringify(context));
  }
}

/**
 * CORS Middleware
 * Validates request origin and adds appropriate CORS headers
 *
 * @param request - NextRequest object
 * @param response - NextResponse to modify
 * @returns Updated response with CORS headers, or error response if origin not allowed
 */
export function corsMiddleware(
  request: NextRequest,
  response: NextResponse
): NextResponse {
  const origin = request.headers.get("origin");

  // Handle preflight requests
  if (request.method === "OPTIONS") {
    if (!origin || !ALLOWED_ORIGINS.includes(origin)) {
      return new NextResponse(null, { status: 403 });
    }

    return new NextResponse(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }

  // Add CORS headers to actual requests
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, DELETE, OPTIONS"
    );
    response.headers.set(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization"
    );
  }

  return response;
}

/**
 * Security Headers Middleware
 * Adds security headers to all responses
 *
 * @param response - NextResponse to modify
 * @returns Updated response with security headers
 */
export function securityHeadersMiddleware(
  response: NextResponse
): NextResponse {
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

/**
 * Request Logging Middleware
 * Logs request details and measures response time
 *
 * @param request - NextRequest object
 * @returns Function that logs response after handler execution
 */
export function requestLoggingMiddleware(request: NextRequest): () => void {
  const startTime = Date.now();
  const path = request.nextUrl.pathname;
  const method = request.method;

  return (statusCode?: number, error?: string) => {
    const duration = Date.now() - startTime;
    const timestamp = new Date().toISOString();

    logRequest({
      timestamp,
      method,
      path,
      status: statusCode,
      duration,
      error,
    });
  };
}

/**
 * Rate Limiting Middleware (Placeholder)
 * TODO: Implement rate limiting with Redis
 *
 * Current requirements for full implementation:
 * - Install Redis client: npm install redis
 * - Set REDIS_URL environment variable
 * - Track requests per IP address or user ID
 * - Return 429 Too Many Requests when limit exceeded
 * - Store rate limit state in Redis with TTL
 *
 * Example implementation structure:
 * ```
 * import { createClient } from 'redis';
 *
 * const redis = createClient({ url: process.env.REDIS_URL });
 *
 * export async function rateLimitMiddleware(request: NextRequest) {
 *   const identifier = request.ip || 'unknown';
 *   const key = `rate-limit:${identifier}`;
 *
 *   const count = await redis.incr(key);
 *   if (count === 1) {
 *     await redis.expire(key, 60); // 60 second window
 *   }
 *
 *   if (count > 100) { // 100 requests per minute
 *     return new NextResponse('Too Many Requests', { status: 429 });
 *   }
 * }
 * ```
 *
 * @param request - NextRequest object
 * @returns true if request should be allowed, false if rate limited
 */
export async function rateLimitMiddleware(
  request: NextRequest
): Promise<boolean> {
  // TODO: Implement Redis-backed rate limiting
  // For now, this is a placeholder that always allows requests

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    console.warn("REDIS_URL not configured - rate limiting disabled");
    return true;
  }

  // Placeholder for Redis integration
  // This will be implemented when Redis is available
  return true;
}

/**
 * Request Validation Middleware
 * Validates request method and content type
 *
 * @param request - NextRequest object
 * @returns NextResponse if validation fails, undefined if validation passes
 */
export function requestValidationMiddleware(
  request: NextRequest
): NextResponse | undefined {
  const method = request.method;
  const path = request.nextUrl.pathname;

  // Skip validation for certain paths
  if (VALIDATION_SKIP_PATHS.some((skipPath) => path.startsWith(skipPath))) {
    return undefined;
  }

  // Validate methods that require body
  if (["POST", "PUT", "PATCH"].includes(method)) {
    const contentType = request.headers.get("content-type");

    if (!contentType?.includes("application/json")) {
      return NextResponse.json(
        {
          error: "Invalid Content-Type",
          message:
            "Content-Type must be application/json for POST, PUT, and PATCH requests",
        },
        { status: 400 }
      );
    }
  }

  return undefined;
}

/**
 * Error Handling Middleware
 * Wraps API handlers with comprehensive error handling and logging
 *
 * @param handler - The API route handler function
 * @returns Wrapped handler with error handling
 */
export function withErrorHandling<
  T extends (...args: any[]) => Promise<NextResponse>
>(handler: T): T {
  return (async (...args: any[]) => {
    const request = args[0] as NextRequest;
    const timestamp = new Date().toISOString();
    const method = request.method;
    const path = request.nextUrl.pathname;

    try {
      // Run request validation
      const validationError = requestValidationMiddleware(request);
      if (validationError) {
        logRequest({
          timestamp,
          method,
          path,
          status: 400,
          error: "Request validation failed",
        });
        return validationError;
      }

      // Check rate limit
      const rateLimited = await rateLimitMiddleware(request);
      if (!rateLimited) {
        logRequest({
          timestamp,
          method,
          path,
          status: 429,
          error: "Rate limit exceeded",
        });
        return NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Rate limit exceeded. Please try again later.",
          },
          { status: 429 }
        );
      }

      // Execute the main handler
      const startTime = Date.now();
      let response = await handler(...args);
      const duration = Date.now() - startTime;

      // Add security headers
      response = securityHeadersMiddleware(response);

      // Add CORS headers
      response = corsMiddleware(request, response);

      // Log successful request
      logRequest({
        timestamp,
        method,
        path,
        status: response.status,
        duration,
      });

      return response;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      const isDevelopment = process.env.NODE_ENV === "development";

      // Log error
      logRequest({
        timestamp,
        method,
        path,
        error: errorMessage,
        status: 500,
      });

      // Return error response
      return NextResponse.json(
        {
          error: "Internal Server Error",
          message: isDevelopment
            ? errorMessage
            : "An unexpected error occurred",
          ...(isDevelopment && {
            stack: error instanceof Error ? error.stack : undefined,
          }),
        },
        { status: 500 }
      );
    }
  }) as T;
}

/**
 * Composable middleware wrapper
 * Combines multiple middleware functions
 *
 * @param middlewares - Array of middleware functions
 * @param handler - The API route handler
 * @returns Wrapped handler with all middleware applied
 */
export function withMiddleware<
  T extends (...args: any[]) => Promise<NextResponse>
>(
  middlewares: Array<
    (request: NextRequest) => NextResponse | undefined | Promise<boolean>
  >,
  handler: T
): T {
  return (async (...args: any[]) => {
    const request = args[0] as NextRequest;

    // Run all middleware
    for (const middleware of middlewares) {
      const result = await middleware(request);

      // If middleware returns a NextResponse, use it as the final response
      if (result instanceof NextResponse) {
        return result;
      }

      // If middleware returns false (like rate limiting), reject
      if (result === false) {
        return NextResponse.json(
          {
            error: "Request denied",
            message: "Your request was denied by middleware",
          },
          { status: 403 }
        );
      }
    }

    // Execute the main handler
    return handler(...args);
  }) as T;
}

/**
 * Quick helper to wrap handlers with full middleware stack
 * This is the recommended way to wrap API route handlers
 *
 * @param handler - The API route handler
 * @returns Handler wrapped with error handling and security
 */
export function withApiProtection<
  T extends (...args: any[]) => Promise<NextResponse>
>(handler: T): T {
  return withErrorHandling(handler);
}
