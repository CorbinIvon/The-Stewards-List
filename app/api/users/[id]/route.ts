import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  requireAuth,
  requireOwnerOrRole,
  requireRole,
  isAdmin,
} from "@/lib/middleware/auth";
import type { UserPublic, UserRole, ApiResponse, AuthUser } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Validation result for user updates
 */
interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * User update request body (all fields optional)
 */
interface UpdateUserRequest {
  email?: string;
  username?: string;
  displayName?: string;
  role?: UserRole;
  isActive?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Select clause for user queries (excludes passwordHash)
 */
const userSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
};

/**
 * Valid user roles
 */
const VALID_ROLES: UserRole[] = ["ADMIN", "MANAGER", "MEMBER"];

/**
 * Resolve an id from params which may be a plain object or a Promise
 */
async function resolveId(params: any): Promise<string | undefined> {
  if (!params) return undefined;
  // If params is a Promise (some caller might pass a Promise), await it
  if (typeof params.then === "function") {
    const resolved = await params;
    return resolved?.id;
  }
  return params.id;
}

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate email format using regex
 * Matches: something@domain.extension pattern
 */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate username format and length
 * Requirements: 3-32 chars, alphanumeric + underscore and hyphen
 */
function isValidUsername(username: string): boolean {
  if (username.length < 3 || username.length > 32) {
    return false;
  }
  return /^[a-zA-Z0-9_-]+$/.test(username);
}

/**
 * Validate display name format and length
 * Requirements: 1-128 chars
 */
function isValidDisplayName(displayName: string): boolean {
  return displayName.length >= 1 && displayName.length <= 128;
}

/**
 * Validate user update request data
 * Returns validation errors if any field is invalid
 * Enforces role-based restrictions (only admins can update role/isActive)
 */
function validateUserUpdate(
  body: any,
  requestingUser: AuthUser
): ValidationResult {
  const errors: string[] = [];
  const userIsAdmin = isAdmin(requestingUser);

  // Validate email if provided
  if (body.email !== undefined) {
    if (typeof body.email !== "string") {
      errors.push("Email must be a string");
    } else if (!isValidEmail(body.email)) {
      errors.push("Invalid email format");
    }
  }

  // Validate username if provided
  if (body.username !== undefined) {
    if (typeof body.username !== "string") {
      errors.push("Username must be a string");
    } else if (!isValidUsername(body.username)) {
      errors.push(
        "Username must be 3-32 characters and contain only letters, numbers, underscores, and hyphens"
      );
    }
  }

  // Validate displayName if provided
  if (body.displayName !== undefined) {
    if (typeof body.displayName !== "string") {
      errors.push("Display name must be a string");
    } else if (!isValidDisplayName(body.displayName)) {
      errors.push("Display name must be 1-128 characters");
    }
  }

  // Validate role if provided - only admins can update
  if (body.role !== undefined) {
    if (!userIsAdmin) {
      errors.push("Only admins can update user role");
    } else if (!VALID_ROLES.includes(body.role)) {
      errors.push("Invalid role. Must be one of: ADMIN, MANAGER, MEMBER");
    }
  }

  // Validate isActive if provided - only admins can update
  if (body.isActive !== undefined) {
    if (!userIsAdmin) {
      errors.push("Only admins can update user active status");
    } else if (typeof body.isActive !== "boolean") {
      errors.push("isActive must be a boolean");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// ============================================================================
// GET /api/users/:id - Get user profile
// ============================================================================

/**
 * GET /api/users/:id
 *
 * Retrieve a user's public profile information
 * - Any authenticated user can view user profiles
 * - Response excludes passwordHash
 *
 * Response: ApiResponse<UserPublic>
 * Errors: 401 (not authenticated), 404 (user not found)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Resolve id from params
    const id = await resolveId(params);
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing user id",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Fetch user by ID
    const user = await prisma.user.findUnique({
      where: { id },
      select: userSelect,
    });

    // User not found
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: user as UserPublic,
        timestamp: new Date().toISOString(),
      } as ApiResponse<UserPublic>,
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching user:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch user",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/users/:id - Update user profile
// ============================================================================

/**
 * PATCH /api/users/:id
 *
 * Update user profile information
 * - Users can update their own profile (email, username, displayName)
 * - Admins can update any user and can also change role/isActive
 * - All fields in request body are optional
 *
 * Request body:
 * {
 *   email?: string (valid email, must be unique)
 *   username?: string (3-32 chars, alphanumeric + _-, must be unique)
 *   displayName?: string (1-128 chars)
 *   role?: UserRole (ADMIN only)
 *   isActive?: boolean (ADMIN only)
 * }
 *
 * Response: ApiResponse<UserPublic>
 * Errors: 400 (validation), 401 (not authenticated), 403 (insufficient permissions),
 *         404 (user not found), 409 (email/username exists)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Resolve id from params
    const id = await resolveId(params);
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing user id",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Require ownership or admin role
    const auth = await requireOwnerOrRole(request, id, ["ADMIN"]);
    if (auth instanceof NextResponse) return auth;
    const { user: requestingUser } = auth;

    // Parse request body
    let body: UpdateUserRequest;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate update data
    const validation = validateUserUpdate(body, requestingUser);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validation.errors,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Build update data - only include fields that are provided
    const updateData: any = {};

    if (body.email !== undefined) {
      updateData.email = body.email.toLowerCase().trim();
    }
    if (body.username !== undefined) {
      updateData.username = body.username.trim();
    }
    if (body.displayName !== undefined) {
      updateData.displayName = body.displayName.trim();
    }

    // Only admins can update these fields
    if (isAdmin(requestingUser)) {
      if (body.role !== undefined) {
        updateData.role = body.role;
      }
      if (body.isActive !== undefined) {
        updateData.isActive = body.isActive;
      }
    }

    // Ensure at least one field to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "No valid fields to update",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: userSelect,
    });

    return NextResponse.json(
      {
        success: true,
        data: updatedUser as UserPublic,
        timestamp: new Date().toISOString(),
      } as ApiResponse<UserPublic>,
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error updating user:", error);

    // Handle unique constraint violations (email/username already exists)
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0] || "unknown";
      const fieldMessage =
        field === "email"
          ? "Email already exists"
          : field === "username"
          ? "Username already exists"
          : "Unique constraint violated";

      return NextResponse.json(
        {
          success: false,
          error: "Conflict",
          details: [{ field, message: fieldMessage }],
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    // Handle record not found (user was deleted between authorization and update)
    if (error.code === "P2025") {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to update user",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/users/:id - Soft delete user
// ============================================================================

/**
 * DELETE /api/users/:id
 *
 * Soft delete a user account (sets isActive = false)
 * - Admin only operation
 * - Prevents admins from deleting their own account
 * - Does not permanently delete user data from database
 *
 * Response: ApiResponse<{ message: string }>
 * Errors: 400 (cannot delete self), 401 (not authenticated),
 *         403 (not admin), 404 (user not found)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require admin role
    const auth = await requireRole(request, ["ADMIN"]);
    if (auth instanceof NextResponse) return auth;
    const { user: requestingUser } = auth;

    // Resolve id from params
    const id = await resolveId(params);
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing user id",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Prevent admin from deleting themselves
    if (requestingUser.id === id) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot delete your own account",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Verify user exists before attempting soft delete
    const userExists = await prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!userExists) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Soft delete - set isActive to false
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json(
      {
        success: true,
        data: { message: "User account has been deactivated" },
        timestamp: new Date().toISOString(),
      } as ApiResponse<{ message: string }>,
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting user:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete user",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
