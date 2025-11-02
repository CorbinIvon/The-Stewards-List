/**
 * Permissions API endpoints for The Stewards List
 * Handles fine-grained access control to tasks beyond the owner/assignee model
 *
 * GET /api/permissions - List permissions (with filters and pagination)
 * POST /api/permissions - Create or update a permission
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserFromAuthHeader, getUserFromCookie } from "@/lib/auth";
import type {
  ApiResponse,
  PaginatedResponse,
  CreatePermissionRequest,
  PermissionType,
  PermissionWithRelations,
  UserRole,
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract authenticated user from request headers
 * Checks both Authorization header and cookies
 */
async function extractAuthUser(request: NextRequest) {
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    return await getUserFromAuthHeader(authHeader);
  }

  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    return await getUserFromCookie(cookieHeader);
  }

  return null;
}

/**
 * Check if user can manage permissions for a task
 * Returns true if user is admin, manager, or task owner
 */
async function canManagePermission(
  userId: string,
  taskId: string,
  userRole: UserRole
): Promise<boolean> {
  // Admins and managers can always manage permissions
  if (userRole === "ADMIN" || userRole === "MANAGER") {
    return true;
  }

  // Regular users can only manage permissions for their own tasks
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { ownerId: true },
  });

  return task?.ownerId === userId;
}

/**
 * Validate permission type enum value
 */
function isValidPermissionType(value: string): value is PermissionType {
  return ["READ", "WRITE", "DELETE", "ADMIN"].includes(value);
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

// ============================================================================
// GET /api/permissions
// ============================================================================

/**
 * List permissions with filtering and pagination
 * Query params:
 *   - taskId: Filter by task (required for non-admins)
 *   - userId: Filter by user (admin only)
 *   - page: Page number (default: 1)
 *   - pageSize: Results per page (default: 20, max: 100)
 */
export async function GET(
  request: NextRequest
): Promise<NextResponse<PaginatedResponse<any> | ApiResponse<any>>> {
  try {
    // Extract and verify authentication
    const authUser = await extractAuthUser(request);
    if (!authUser) {
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get("taskId");
    const userId = searchParams.get("userId");
    const pageParam = searchParams.get("page");
    const pageSizeParam = searchParams.get("pageSize");

    // Parse pagination
    let page = 1;
    let pageSize = 20;

    if (pageParam) {
      const parsedPage = parseInt(pageParam, 10);
      if (!isNaN(parsedPage) && parsedPage > 0) {
        page = parsedPage;
      }
    }

    if (pageSizeParam) {
      const parsedPageSize = parseInt(pageSizeParam, 10);
      if (
        !isNaN(parsedPageSize) &&
        parsedPageSize > 0 &&
        parsedPageSize <= 100
      ) {
        pageSize = parsedPageSize;
      }
    }

    // Build where clause based on user role and filters
    const where: any = {};

    // If filtering by userId, only admins can do this
    if (userId) {
      if (authUser.role !== "ADMIN") {
        return NextResponse.json(
          {
            success: false,
            error: "Forbidden",
            details: "Only admins can filter permissions by userId",
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }
      where.userId = userId;
    }

    // If filtering by taskId, verify user has access to that task
    if (taskId) {
      where.taskId = taskId;

      // For non-admins/managers, verify they own the task
      if (authUser.role !== "ADMIN" && authUser.role !== "MANAGER") {
        const task = await prisma.task.findUnique({
          where: { id: taskId },
          select: { ownerId: true, isDeleted: true },
        });

        if (!task || task.isDeleted) {
          return NextResponse.json(
            {
              success: false,
              error: "Not found",
              details: "Task not found",
              timestamp: new Date().toISOString(),
            },
            { status: 404 }
          );
        }

        if (task.ownerId !== authUser.id) {
          return NextResponse.json(
            {
              success: false,
              error: "Forbidden",
              details: "You can only view permissions for tasks you own",
              timestamp: new Date().toISOString(),
            },
            { status: 403 }
          );
        }
      }
    } else if (authUser.role !== "ADMIN" && authUser.role !== "MANAGER") {
      // Non-admins must filter by taskId
      return NextResponse.json(
        {
          success: false,
          error: "Bad request",
          details: "taskId parameter is required for non-admin users",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Fetch total count
    const total = await prisma.permission.count({ where });

    // Calculate pagination
    const totalPages = Math.ceil(total / pageSize);
    const skip = (page - 1) * pageSize;

    // Fetch permissions
    const permissions = await prisma.permission.findMany({
      where,
      include: permissionInclude,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
    });

    // Build response
    const response: PaginatedResponse<any> = {
      success: true,
      data: permissions,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("GET /api/permissions error:", error);
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
// POST /api/permissions
// ============================================================================

/**
 * Create or update a permission
 * Request body: { userId: string, taskId: string, permission: PermissionType }
 *
 * Authorization:
 *   - Task owner, manager, or admin can create permissions
 *
 * Behavior:
 *   - If permission exists: updates it
 *   - If permission doesn't exist: creates it
 */
export async function POST(
  request: NextRequest
): Promise<NextResponse<ApiResponse<any>>> {
  try {
    // Extract and verify authentication
    const authUser = await extractAuthUser(request);
    if (!authUser) {
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

    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON",
          details: "Request body must be valid JSON",
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
          error: "Invalid request body",
          details: "Request body must be an object",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const bodyData = body as Record<string, unknown>;
    const { userId, taskId, permission } = bodyData;

    // Validate required fields
    if (!userId || typeof userId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Bad request",
          details: "userId is required and must be a string",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!taskId || typeof taskId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Bad request",
          details: "taskId is required and must be a string",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (!permission || typeof permission !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Bad request",
          details: "permission is required and must be a string",
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
          error: "Bad request",
          details: "permission must be one of: READ, WRITE, DELETE, ADMIN",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check authorization - user must be able to manage permissions for this task
    const canManage = await canManagePermission(
      authUser.id,
      taskId,
      authUser.role
    );

    if (!canManage) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
          details:
            "You do not have permission to manage permissions for this task",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Verify user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          error: "Not found",
          details: "User not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Verify task exists and is not deleted
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, isDeleted: true },
    });

    if (!task || task.isDeleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Not found",
          details: "Task not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Upsert permission (create if not exists, update if exists)
    const result = await prisma.permission.upsert({
      where: {
        userId_taskId: {
          userId,
          taskId,
        },
      },
      update: {
        permission,
      },
      create: {
        userId,
        taskId,
        permission,
      },
      include: permissionInclude,
    });

    // Determine if this was a create or update
    const isCreated = result.createdAt === result.updatedAt;

    const response: ApiResponse<any> = {
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: isCreated ? 201 : 200 });
  } catch (error) {
    console.error("POST /api/permissions error:", error);
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
