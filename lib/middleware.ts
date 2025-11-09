import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ============================================================================
// RATE LIMITING CONFIGURATION
// ============================================================================

/**
 * Rate limiting configuration constants
 */
const RATE_LIMIT_REQUESTS = 100; // requests per window
const RATE_LIMIT_WINDOW = 15 * 60; // 15 minutes in seconds
const RATE_LIMIT_BYPASS_PATHS = ["/api/health", "/api/status"];

/**
 * Redis client type definition
 * Supports both 'redis' and 'ioredis' packages
 */
interface RedisClient {
  get(key: string): Promise<string | null>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  del(key: string): Promise<number>;
  disconnect(): Promise<void>;
}

/**
 * Global Redis client instance (lazy-loaded)
 */
let redisClient: RedisClient | null = null;
let redisError: Error | null = null;
let redisInitialized = false;

/**
 * Initialize Redis client
 * Handles both 'redis' and 'ioredis' packages
 * Returns null if Redis is unavailable (fails open)
 */
async function initializeRedis(): Promise<RedisClient | null> {
  if (redisInitialized) {
    if (redisError) {
      throw redisError;
    }
    return redisClient;
  }

  redisInitialized = true;

  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    // eslint-disable-next-line no-console
    console.info("REDIS_URL not configured - rate limiting disabled");
    return null;
  }

  try {
    // Try importing 'redis' package first (official Node.js Redis client)
    try {
      // eslint-disable-next-line no-console
      const redisModule: any = await import("redis");
      const { createClient } = redisModule;
      const client = createClient({ url: redisUrl });

      // Set up error handler
      client.on("error", (err: Error) => {
        // eslint-disable-next-line no-console
        console.error("Redis client error:", err);
      });

      // Connect to Redis
      await client.connect();
      redisClient = client as unknown as RedisClient;
      // eslint-disable-next-line no-console
      console.info("Redis client connected successfully");
      return redisClient;
    } catch (redisErr) {
      // Fallback to ioredis package
      // eslint-disable-next-line no-console
      const ioredisModule: any = await import("ioredis");
      const Redis = ioredisModule.default || ioredisModule;
      const client = new Redis(redisUrl);

      // Set up error handler
      client.on("error", (err: Error) => {
        // eslint-disable-next-line no-console
        console.error("Redis client error:", err);
      });

      redisClient = client as unknown as RedisClient;
      // eslint-disable-next-line no-console
      console.info("Redis client (ioredis) connected successfully");
      return redisClient;
    }
  } catch (error) {
    const err =
      error instanceof Error
        ? error
        : new Error("Unknown error initializing Redis");
    redisError = err;
    // eslint-disable-next-line no-console
    console.warn("Failed to initialize Redis client:", err.message);
    // eslint-disable-next-line no-console
    console.warn("Rate limiting will be disabled - requests will not be limited");
    return null;
  }
}

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

// ============================================================================
// RATE LIMITING HELPERS
// ============================================================================

/**
 * Extract client IP from request headers
 * Checks X-Forwarded-For first (for proxied requests), falls back to socket address
 *
 * @param request - NextRequest object
 * @returns Client IP address or 'unknown' if not available
 */
function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  // Try to get IP from socket (available in some environments)
  try {
    const socket = (request as any).socket;
    if (socket && socket.remoteAddress) {
      return socket.remoteAddress;
    }
  } catch (e) {
    // Silently ignore errors
  }

  // Fallback to custom header or unknown
  return request.headers.get("x-client-ip") || "unknown";
}

/**
 * Create a consistent Redis key for rate limiting
 *
 * @param endpoint - API endpoint path
 * @param clientIp - Client IP address
 * @returns Redis key string
 */
function getRateLimitKey(endpoint: string, clientIp: string): string {
  return `rate-limit:${endpoint}:${clientIp}`;
}

/**
 * Check if a path should bypass rate limiting
 *
 * @param path - Request path
 * @returns true if path should bypass rate limiting
 */
function shouldBypassRateLimit(path: string): boolean {
  return RATE_LIMIT_BYPASS_PATHS.some((bypassPath) => path.startsWith(bypassPath));
}

/**
 * Check and increment rate limit counter in Redis
 * Returns the current count and whether the request is rate limited
 *
 * @param key - Redis key for this rate limit bucket
 * @returns Object with count and isRateLimited flag
 */
async function checkRateLimit(
  key: string
): Promise<{ count: number; isRateLimited: boolean }> {
  try {
    const redis = await initializeRedis();

    // If Redis is unavailable, allow the request (fail open)
    if (!redis) {
      return { count: 0, isRateLimited: false };
    }

    const count = await redis.incr(key);

    // Set TTL on first request (count === 1)
    if (count === 1) {
      await redis.expire(key, RATE_LIMIT_WINDOW);
    }

    const isRateLimited = count > RATE_LIMIT_REQUESTS;

    return { count, isRateLimited };
  } catch (error) {
    console.error("Error checking rate limit:", error);
    // On error, allow the request (fail open)
    return { count: 0, isRateLimited: false };
  }
}

/**
 * Reset rate limit counter for a specific key (admin utility)
 * Useful for clearing rate limits for specific IPs or users
 *
 * @param key - Redis key to reset
 * @returns true if key was deleted, false otherwise
 */
async function resetRateLimit(key: string): Promise<boolean> {
  try {
    const redis = await initializeRedis();

    if (!redis) {
      return false;
    }

    const deleted = await redis.del(key);
    return deleted > 0;
  } catch (error) {
    console.error("Error resetting rate limit:", error);
    return false;
  }
}

/**
 * Rate Limiting Middleware
 * Checks and enforces rate limits using Redis
 * Gracefully degrades to no limiting if Redis is unavailable
 *
 * @param request - NextRequest object
 * @returns true if request should be allowed, false if rate limited
 */
export async function rateLimitMiddleware(
  request: NextRequest
): Promise<boolean> {
  const path = request.nextUrl.pathname;

  // Bypass rate limiting for specific paths
  if (shouldBypassRateLimit(path)) {
    return true;
  }

  const clientIp = getClientIp(request);
  const key = getRateLimitKey(path, clientIp);

  const { count, isRateLimited } = await checkRateLimit(key);

  if (isRateLimited) {
    console.warn(
      `Rate limit exceeded for ${clientIp} on ${path} (${count} requests)`
    );
    return false;
  }

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
        const response = NextResponse.json(
          {
            error: "Too Many Requests",
            message: "Rate limit exceeded. Please try again later.",
          },
          { status: 429 }
        );
        // Add rate limit headers
        response.headers.set("Retry-After", String(RATE_LIMIT_WINDOW));
        response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_REQUESTS));
        response.headers.set("X-RateLimit-Window", String(RATE_LIMIT_WINDOW));
        return response;
      }

      // Execute the main handler
      const startTime = Date.now();
      let response = await handler(...args);
      const duration = Date.now() - startTime;

      // Add security headers
      response = securityHeadersMiddleware(response);

      // Add CORS headers
      response = corsMiddleware(request, response);

      // Add rate limit headers to successful response (for client-side tracking)
      response.headers.set("X-RateLimit-Limit", String(RATE_LIMIT_REQUESTS));
      response.headers.set("X-RateLimit-Window", String(RATE_LIMIT_WINDOW));

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

// ============================================================================
// ADMIN RATE LIMIT MANAGEMENT
// ============================================================================

/**
 * Admin utility to reset rate limit for an IP address
 * Useful for clearing rate limits for legitimate users who hit the limit
 *
 * @param ipAddress - IP address to reset rate limit for
 * @param endpoint - Optional specific endpoint path (resets all if not provided)
 * @returns true if reset was successful, false otherwise
 *
 * @example
 * // Reset all endpoints for an IP
 * await resetRateLimitForIp("192.168.1.1");
 *
 * // Reset specific endpoint for an IP
 * await resetRateLimitForIp("192.168.1.1", "/api/users");
 */
export async function resetRateLimitForIp(
  ipAddress: string,
  endpoint?: string
): Promise<boolean> {
  if (endpoint) {
    const key = getRateLimitKey(endpoint, ipAddress);
    return await resetRateLimit(key);
  }

  // If no specific endpoint, try to reset multiple common endpoints
  // This is a best-effort approach - Redis keys are stored per endpoint
  const commonEndpoints = [
    "/api/auth/login",
    "/api/auth/register",
    "/api/auth/forgot-password",
    "/api/users",
    "/api/tasks",
  ];

  let resetCount = 0;
  for (const ep of commonEndpoints) {
    const key = getRateLimitKey(ep, ipAddress);
    const success = await resetRateLimit(key);
    if (success) resetCount++;
  }

  return resetCount > 0;
}

/**
 * Get current rate limit status for an IP address
 * Useful for monitoring and debugging rate limit issues
 *
 * @param ipAddress - IP address to check
 * @param endpoint - API endpoint path
 * @returns Current request count and whether IP is rate limited
 */
export async function getRateLimitStatus(
  ipAddress: string,
  endpoint: string
): Promise<{ count: number; isRateLimited: boolean; limit: number; window: number }> {
  try {
    const redis = await initializeRedis();

    if (!redis) {
      return {
        count: 0,
        isRateLimited: false,
        limit: RATE_LIMIT_REQUESTS,
        window: RATE_LIMIT_WINDOW,
      };
    }

    const key = getRateLimitKey(endpoint, ipAddress);
    const countStr = await redis.get(key);
    const count = countStr ? parseInt(countStr, 10) : 0;

    return {
      count,
      isRateLimited: count > RATE_LIMIT_REQUESTS,
      limit: RATE_LIMIT_REQUESTS,
      window: RATE_LIMIT_WINDOW,
    };
  } catch (error) {
    console.error("Error getting rate limit status:", error);
    return {
      count: 0,
      isRateLimited: false,
      limit: RATE_LIMIT_REQUESTS,
      window: RATE_LIMIT_WINDOW,
    };
  }
}
