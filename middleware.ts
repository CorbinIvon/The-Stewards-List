/**
 * Next.js middleware for route protection and authentication
 * Handles route guards, token verification, and redirects
 *
 * This middleware runs on every request and:
 * - Protects private routes by requiring valid JWT token
 * - Redirects unauthenticated users to login
 * - Allows public routes without authentication
 * - Applies security headers
 */

import { NextRequest, NextResponse } from "next/server";
import { getUserFromAuthHeader, getUserFromCookie } from "./lib/auth";

// ============================================================================
// ROUTE CONFIGURATION
// ============================================================================

/**
 * Public routes that don't require authentication
 */
const PUBLIC_ROUTES = ["/", "/login", "/signup"];

/**
 * API routes that are public (don't require auth)
 */
const PUBLIC_API_ROUTES = [
  "/api/auth/login",
  "/api/auth/signup",
  "/api/health",
];

/**
 * Protected routes that require authentication
 * Patterns use simple string matching - can be enhanced with regex if needed
 */
const PROTECTED_ROUTE_PATTERNS = [
  "/dashboard",
  "/tasks",
  "/users",
  "/profile",
  "/settings",
];

/**
 * Protected API route patterns
 */
const PROTECTED_API_PATTERNS = [
  "/api/tasks",
  "/api/users",
  "/api/permissions",
  "/api/task-logs",
  "/api/chats",
];

// ============================================================================
// SECURITY HEADERS
// ============================================================================

/**
 * Security headers to apply to all responses
 * Helps prevent common web vulnerabilities
 */
const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if a route is public (doesn't require authentication)
 */
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.includes(pathname);
}

/**
 * Check if a route is a public API route
 */
function isPublicApiRoute(pathname: string): boolean {
  return PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route));
}

/**
 * Check if a route is protected
 */
function isProtectedRoute(pathname: string): boolean {
  return PROTECTED_ROUTE_PATTERNS.some((pattern) =>
    pathname.startsWith(pattern)
  );
}

/**
 * Check if a route is a protected API route
 */
function isProtectedApiRoute(pathname: string): boolean {
  return PROTECTED_API_PATTERNS.some((pattern) =>
    pathname.startsWith(pattern)
  );
}

/**
 * Extract JWT token from request
 * Checks both Authorization header and cookies
 */
function extractToken(request: NextRequest): string | null {
  // Try to get token from Authorization header
  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Try to get token from cookies
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    for (const cookie of cookies) {
      if (cookie.startsWith("authToken=")) {
        return cookie.substring(10);
      }
    }
  }

  return null;
}

/**
 * Check if request has valid authentication
 */
function hasValidAuth(request: NextRequest): boolean {
  // Try to extract token from Authorization header
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const user = getUserFromAuthHeader(authHeader);
    if (user) return true;
  }

  // Try to extract token from cookies
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const user = getUserFromCookie(cookieHeader);
    if (user) return true;
  }

  return false;
}

// ============================================================================
// MIDDLEWARE FUNCTION
// ============================================================================

/**
 * Middleware function that runs on every request
 * Handles route protection, authentication verification, and security headers
 */
export async function middleware(request: NextRequest): Promise<NextResponse> {
  const pathname = request.nextUrl.pathname;
  const response = NextResponse.next();

  // Apply security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  // Allow public routes and pages
  if (isPublicRoute(pathname)) {
    return response;
  }

  // Allow public API routes
  if (isPublicApiRoute(pathname)) {
    return response;
  }

  // Check if route requires authentication
  if (isProtectedRoute(pathname) || isProtectedApiRoute(pathname)) {
    // Verify authentication
    if (!hasValidAuth(request)) {
      // Redirect to login for protected routes
      if (isProtectedRoute(pathname)) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Return 401 for protected API routes
      if (isProtectedApiRoute(pathname)) {
        return NextResponse.json(
          {
            success: false,
            error: "Unauthorized",
            details: "Valid authentication token required",
            timestamp: new Date().toISOString(),
          },
          { status: 401 }
        );
      }
    }
  }

  return response;
}

// ============================================================================
// MIDDLEWARE CONFIGURATION
// ============================================================================

/**
 * Configuration for which routes the middleware applies to
 * Includes all routes except static files and assets
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg).*)",
  ],
};
