/**
 * Individual permission API endpoints for The Stewards List
 * Handles operations on specific permissions: GET, PATCH, DELETE by ID
 *
 * GET /api/permissions/[id] - Retrieve a specific permission
 * PATCH /api/permissions/[id] - Update a permission's type
 * DELETE /api/permissions/[id] - Delete a permission
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type {
  ApiResponse,
  Permission,
  PermissionType,
  PermissionWithRelations,
} from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

interface PermissionInclude {
  user: {
    select: {
      id: true;
      username: true;
      displayName: true;
      email: true;
    };
  };
  task: {
    select: {
      id: true;
      title: true;
      ownerId: true;
    };
  };
}

interface AuthUserData {
  id: string;
  role: "ADMIN" | "MANAGER" | "MEMBER";
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract authenticated user from request headers
 * Checks both Authorization header and cookies
 */
function extractAuthUser(request: NextRequest): AuthUserData | null {
  try {
    // Check Authorization header first
    const authHeader = request.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);
      // Parse token to extract user data
      // This assumes token parsing is available from auth lib
      const userStr = Buffer.from(token.split(".")[1], "base64").toString();
      const user = JSON.parse(userStr);
      return {
        id: user.id,
        role: user.role,
      };
    }

    // Fallback to cookie-based auth if needed
    const cookieHeader = request.headers.get("Cookie");
    if (cookieHeader) {
      // Parse auth cookie to get user data
      const cookies = Object.fromEntries(
        cookieHeader.split("; ").map((c) => {
          const [key, ...val] = c.split("=");
          return [key, val.join("=")];
        })
      );

      if (cookies.auth) {
        const user = JSON.parse(cookies.auth);
        return {
          id: user.id,
          role: user.role,
        };
      }
    }

    return null;
  } catch (error) {
    console.error("Error extracting auth user:", error);
    return null;
  }
}

/**
 * Include configuration for permission queries
 */
const permissionInclude: PermissionInclude = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
    },
  },
  task: {
    select: {
      id: true,
      title: true,
      ownerId: true,
    },
  },
};

/**
 * Validate permission type enum value
 */
function isValidPermissionType(value: any): value is PermissionType {
  return ["READ", "WRITE", "DELETE", "ADMIN"].includes(value);
}

/**
 * Check if user can view a specific permission
 * Allowed for:
 *   - Admins and managers (full access)
 *   - Task owner
 *   - The user the permission is for
 */
function canViewPermission(
  userId: string,
  permission: {
    userId: string;
    task: { ownerId: string };
  },
  userRole: string
): boolean {
  // Admins and managers can view all permissions
  if (userRole === "ADMIN" || userRole === "MANAGER") {
    return true;
  }

  // Can view if you're the task owner
  if (permission.task.ownerId === userId) {
    return true;
  }

  // Can view if it's your own permission
  if (permission.userId === userId) {
    return true;
  }

  return false;
}

/**
 * Check if user can modify (update) a specific permission
 * Allowed for:
 *   - Admins and managers (full access)
 *   - Task owner
 */
function canModifyPermission(
  userId: string,
  permission: {
    task: { ownerId: string };
  },
  userRole: string
): boolean {
  // Admins and managers can modify all permissions
  if (userRole === "ADMIN" || userRole === "MANAGER") {
    return true;
  }

  // Task owners can modify permissions for their tasks
  return permission.task.ownerId === userId;
}

/**
 * Check if user can delete a specific permission
 * Allowed for:
 *   - Admins and managers (full access)
 *   - Task owner
 *   - The user themselves (can remove their own permission)
 */
function canDeletePermission(
  userId: string,
  permission: {
    userId: string;
    task: { ownerId: string };
  },
  userRole: string
): boolean {
  // Admins and managers can delete all permissions
  if (userRole === "ADMIN" || userRole === "MANAGER") {
    return true;
  }

  // Task owners can delete permissions for their tasks
  if (permission.task.ownerId === userId) {
    return true;
  }

  // Users can delete their own permissions
  if (permission.userId === userId) {
    return true;
  }

  return false;
}

// ============================================================================
// GET /api/permissions/[id]
// ============================================================================

/**
 * Retrieve a specific permission by ID
 *
 * Authorization:
 *   - Task owner can view
 *   - User the permission is for can view
 *   - Admin/Manager can view
 *
 * Response: ApiResponse<Permission> with user and task data
 * Errors: 401 (unauthorized), 403 (forbidden), 404 (not found)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // Extract and verify authentication
    const authUser = extractAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const { id } = params;

    // Fetch permission with includes
    const permission = await prisma.permission.findUnique({
      where: { id },
      include: permissionInclude,
    });

    if (!permission) {
      return NextResponse.json(
        {
          success: false,
          error: "Permission not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check authorization
    const canView = canViewPermission(authUser.id, permission, authUser.role);
    if (!canView) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Return permission
    const response: ApiResponse<any> = {
      success: true,
      data: permission,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("GET /api/permissions/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH /api/permissions/[id]
// ============================================================================

/**
 * Update a permission's type
 *
 * Request body: { permission: PermissionType }
 * PermissionType values: READ, WRITE, DELETE, ADMIN
 *
 * Authorization:
 *   - Task owner can update
 *   - Admin/Manager can update
 *
 * Validation:
 *   - permission field required
 *   - permission must be valid enum value
 *
 * Response: ApiResponse<Permission> with updated data
 * Errors: 400 (invalid input), 401 (unauthorized), 403 (forbidden), 404 (not found)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // Extract and verify authentication
    const authUser = extractAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate body structure
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        {
          success: false,
          error: "Request body must be an object",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const bodyData = body as Record<string, unknown>;
    const { permission } = bodyData;

    // Validate permission field
    if (!permission) {
      return NextResponse.json(
        {
          success: false,
          error: "permission field is required",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate permission type
    if (!isValidPermissionType(permission)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Invalid permission type. Must be READ, WRITE, DELETE, or ADMIN",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { id } = params;

    // Fetch existing permission
    const existingPermission = await prisma.permission.findUnique({
      where: { id },
      include: permissionInclude,
    });

    if (!existingPermission) {
      return NextResponse.json(
        {
          success: false,
          error: "Permission not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check authorization
    const canModify = canModifyPermission(
      authUser.id,
      existingPermission,
      authUser.role
    );
    if (!canModify) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Update permission
    const updated = await prisma.permission.update({
      where: { id },
      data: { permission },
      include: permissionInclude,
    });

    // Return updated permission
    const response: ApiResponse<any> = {
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("PATCH /api/permissions/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE /api/permissions/[id]
// ============================================================================

/**
 * Delete a specific permission
 *
 * Authorization:
 *   - Task owner can delete
 *   - Admin/Manager can delete
 *   - User can delete their own permission
 *
 * Behavior: Hard delete the permission record
 *
 * Response: ApiResponse<{ message: string }>
 * Errors: 401 (unauthorized), 403 (forbidden), 404 (not found)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // Extract and verify authentication
    const authUser = extractAuthUser(request);
    if (!authUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    const { id } = params;

    // Fetch permission
    const permission = await prisma.permission.findUnique({
      where: { id },
      include: permissionInclude,
    });

    if (!permission) {
      return NextResponse.json(
        {
          success: false,
          error: "Permission not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check authorization
    const canDelete = canDeletePermission(
      authUser.id,
      permission,
      authUser.role
    );
    if (!canDelete) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Delete permission (hard delete)
    await prisma.permission.delete({
      where: { id },
    });

    // Return success response
    const response: ApiResponse<any> = {
      success: true,
      data: { message: "Permission deleted successfully" },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("DELETE /api/permissions/[id] error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
