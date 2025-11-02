/**
 * Authentication middleware utilities for API routes
 * Provides reusable functions for extracting user context, verifying tokens,
 * and enforcing authentication/authorization on protected routes
 */

import { NextRequest, NextResponse } from "next/server";
import { extractTokenFromHeader, getUserFromToken } from "@/lib/auth";
import type { AuthUser, UserRole } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Result type for auth middleware functions
 * Either returns the authenticated user or an error response
 */
export type AuthResult = { user: AuthUser } | NextResponse;

// ============================================================================
// USER EXTRACTION
// ============================================================================

/**
 * Extract and verify JWT token from request Authorization header
 * Supports "Bearer <token>" format
 *
 * @param request - NextRequest object
 * @returns AuthUser if valid token found, null otherwise
 *
 * @example
 * const user = getUserFromRequest(request);
 * if (!user) {
 *   return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 * }
 */
export async function getUserFromRequest(
  request: NextRequest
): Promise<AuthUser | null> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader) {
      return null;
    }

    const token = extractTokenFromHeader(authHeader);
    if (!token) {
      return null;
    }

    const user = await getUserFromToken(token);
    return user;
  } catch (error) {
    console.error("Error extracting user from request:", error);
    return null;
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

/**
 * Require authentication on a route
 * Extracts and verifies JWT token, returns error if missing or invalid
 *
 * @param request - NextRequest object
 * @returns Object with user if authenticated, or 401 error response
 *
 * @example
 * export async function GET(request: NextRequest) {
 *   const auth = await requireAuth(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const { user } = auth;
 *   // ... rest of handler
 * }
 */
export async function requireAuth(request: NextRequest): Promise<AuthResult> {
  const user = await getUserFromRequest(request);

  if (!user) {
    return NextResponse.json(
      { success: false, error: "Authentication required" },
      { status: 401 }
    );
  }

  return { user };
}

/**
 * Require authentication and verify user account is active
 * Returns 403 if user exists but account is inactive
 *
 * @param request - NextRequest object
 * @returns Object with user if authenticated and active, or error response
 *
 * @example
 * export async function POST(request: NextRequest) {
 *   const auth = await requireActiveUser(request);
 *   if (auth instanceof NextResponse) return auth;
 *   const { user } = auth;
 *   // ... rest of handler
 * }
 */
export async function requireActiveUser(
  request: NextRequest
): Promise<AuthResult> {
  const auth = await requireAuth(request);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { user } = auth;

  if (!user.isActive) {
    return NextResponse.json(
      { success: false, error: "Account is inactive" },
      { status: 403 }
    );
  }

  return { user };
}

// ============================================================================
// AUTHORIZATION MIDDLEWARE
// ============================================================================

/**
 * Require specific user roles/permissions
 * First checks authentication, then validates user has one of the allowed roles
 *
 * @param request - NextRequest object
 * @param allowedRoles - Array of UserRole values that are permitted
 * @returns Object with user if authorized, or error response (401 or 403)
 *
 * @example
 * export async function DELETE(request: NextRequest) {
 *   const auth = await requireRole(request, ["ADMIN"]);
 *   if (auth instanceof NextResponse) return auth;
 *   const { user } = auth;
 *   // ... admin-only operation
 * }
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<AuthResult> {
  const auth = await requireAuth(request);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { user } = auth;

  if (!allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { success: false, error: "Insufficient permissions" },
      { status: 403 }
    );
  }

  return { user };
}

/**
 * Require resource ownership or specific roles
 * Allows access if user is the resource owner OR has one of the allowed roles
 * Useful for routes where users can access their own resources or admins can access anything
 *
 * @param request - NextRequest object
 * @param resourceOwnerId - The ID of the resource owner
 * @param allowedRoles - Array of UserRole values that can bypass ownership check
 * @returns Object with user if authorized, or error response (401 or 403)
 *
 * @example
 * export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
 *   const auth = await requireOwnerOrRole(request, params.id, ["ADMIN", "MANAGER"]);
 *   if (auth instanceof NextResponse) return auth;
 *   const { user } = auth;
 *   // ... update resource (user can update if owner or admin/manager)
 * }
 */
export async function requireOwnerOrRole(
  request: NextRequest,
  resourceOwnerId: string,
  allowedRoles: UserRole[]
): Promise<AuthResult> {
  const auth = await requireAuth(request);

  if (auth instanceof NextResponse) {
    return auth;
  }

  const { user } = auth;

  // Check if user is the owner or has a privileged role
  const isOwner = user.id === resourceOwnerId;
  const hasRole = allowedRoles.includes(user.role);

  if (!isOwner && !hasRole) {
    return NextResponse.json(
      { success: false, error: "Access denied" },
      { status: 403 }
    );
  }

  return { user };
}

// ============================================================================
// ROLE/PERMISSION HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user has any of the given roles
 *
 * @param user - AuthUser to check
 * @param roles - Array of roles to check against
 * @returns true if user.role is in the roles array
 *
 * @example
 * if (hasRole(user, ["ADMIN", "MANAGER"])) {
 *   // User is admin or manager
 * }
 */
export function hasRole(user: AuthUser, roles: UserRole[]): boolean {
  return roles.includes(user.role);
}

/**
 * Check if user is an admin
 *
 * @param user - AuthUser to check
 * @returns true if user role is ADMIN
 *
 * @example
 * if (isAdmin(user)) {
 *   // Perform admin-only operation
 * }
 */
export function isAdmin(user: AuthUser): boolean {
  return user.role === "ADMIN";
}

/**
 * Check if user is admin or manager
 * Useful for operations that need elevated but not full admin privileges
 *
 * @param user - AuthUser to check
 * @returns true if user role is ADMIN or MANAGER
 *
 * @example
 * if (isAdminOrManager(user)) {
 *   // Perform elevated operation
 * }
 */
export function isAdminOrManager(user: AuthUser): boolean {
  return user.role === "ADMIN" || user.role === "MANAGER";
}

/**
 * Check if user is a regular member
 *
 * @param user - AuthUser to check
 * @returns true if user role is MEMBER
 *
 * @example
 * if (isMember(user)) {
 *   // Perform member-only operation
 * }
 */
export function isMember(user: AuthUser): boolean {
  return user.role === "MEMBER";
}

/**
 * Check if user is active and not suspended
 *
 * @param user - AuthUser to check
 * @returns true if user.isActive is true
 *
 * @example
 * if (!isUserActive(user)) {
 *   return NextResponse.json({ error: "Account inactive" }, { status: 403 });
 * }
 */
export function isUserActive(user: AuthUser): boolean {
  return user.isActive;
}

// ============================================================================
// RESPONSE HELPERS
// ============================================================================

/**
 * Create a standard 401 Unauthorized response
 *
 * @param message - Error message to return
 * @returns NextResponse with 401 status
 *
 * @example
 * if (!token) {
 *   return unauthorizedResponse("Invalid token");
 * }
 */
export function unauthorizedResponse(
  message: string = "Authentication required"
): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

/**
 * Create a standard 403 Forbidden response
 *
 * @param message - Error message to return
 * @returns NextResponse with 403 status
 *
 * @example
 * if (!isAdmin(user)) {
 *   return forbiddenResponse("Admin access required");
 * }
 */
export function forbiddenResponse(
  message: string = "Access denied"
): NextResponse {
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}
