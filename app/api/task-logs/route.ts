/**
 * Task Logs API Endpoints
 * Provides audit trail functionality for all task-related activities
 * Logs are immutable - no updates or deletes allowed
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAdminOrManager } from "@/lib/middleware/auth";
import type {
  ApiResponse,
  PaginatedResponse,
  TaskLogWithRelations,
} from "@/lib/types";
import { TaskLogAction, UserRole } from "@/lib/types";

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_ACTIONS: TaskLogAction[] = [
  TaskLogAction.CREATED,
  TaskLogAction.UPDATED,
  TaskLogAction.COMPLETED,
  TaskLogAction.CANCELLED,
  TaskLogAction.ASSIGNED,
  TaskLogAction.UNASSIGNED,
  TaskLogAction.COMMENTED,
];

const MAX_NOTE_LENGTH = 1000;
const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user has access to view task logs for a specific task
 * Admins/managers have full visibility
 * Regular users can only access if they are task owner or assignee
 */
async function canAccessTaskLogs(
  userId: string,
  taskId: string,
  userRole: string
): Promise<boolean> {
  if (userRole === UserRole.ADMIN || userRole === UserRole.MANAGER) {
    return true;
  }

  // Regular users: check if they are task owner or assignee
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      isDeleted: false,
      OR: [{ ownerId: userId }, { assignments: { some: { userId } } }],
    },
  });

  return task !== null;
}

/**
 * Validate TaskLogAction enum value
 */
function isValidAction(action: unknown): action is TaskLogAction {
  return (
    typeof action === "string" &&
    VALID_ACTIONS.includes(action as TaskLogAction)
  );
}

/**
 * Build Prisma where clause based on query filters
 */
function buildWhereClause(
  taskId: string | null,
  userId: string | null,
  action: string | null
): any {
  const where: any = {};

  if (taskId) {
    where.taskId = taskId;
  }

  if (userId) {
    where.userId = userId;
  }

  if (action) {
    if (!isValidAction(action)) {
      throw new Error("Invalid action");
    }
    where.action = action;
  }

  return where;
}

/**
 * Common Prisma include for task log queries
 */
const TASK_LOG_INCLUDE = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  task: {
    select: {
      id: true,
      title: true,
      status: true,
    },
  },
};

// ============================================================================
// GET /api/task-logs
// ============================================================================

/**
 * Retrieve task logs with filtering and pagination
 *
 * Query Parameters:
 * - taskId: Filter by specific task (required for non-admins)
 * - userId: Filter by user who created the log (optional)
 * - action: Filter by action type (optional)
 * - page: Pagination page (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 *
 * Authorization:
 * - Admins/Managers: Can view all logs, taskId is optional
 * - Members: Must provide taskId and must have access to that task
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { user } = auth;

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get("taskId");
    const userId = searchParams.get("userId");
    const action = searchParams.get("action");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(
        1,
        parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE), 10)
      )
    );

    // Authorization: Non-admins must provide taskId
    if (!isAdminOrManager(user)) {
      if (!taskId) {
        return NextResponse.json(
          {
            success: false,
            error: "taskId parameter is required for non-admin users",
          },
          { status: 400 }
        );
      }

      // Verify user has access to this task
      const hasAccess = await canAccessTaskLogs(user.id, taskId, user.role);
      if (!hasAccess) {
        return NextResponse.json(
          { success: false, error: "Access denied to this task logs" },
          { status: 403 }
        );
      }
    }

    // Build where clause with filters
    let where: any = {};
    try {
      where = buildWhereClause(taskId, userId, action);
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid filter value",
        },
        { status: 400 }
      );
    }

    // Fetch total count for pagination
    const total = await prisma.taskLog.count({ where });

    // Fetch paginated results
    const data = await prisma.taskLog.findMany({
      where,
      include: TASK_LOG_INCLUDE,
      orderBy: {
        createdAt: "desc",
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const totalPages = Math.ceil(total / pageSize);

    const response: PaginatedResponse<TaskLogWithRelations> = {
      success: true,
      data: data as any,
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

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching task logs:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch task logs",
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/task-logs
// ============================================================================

/**
 * Create a new task log entry
 *
 * Request Body:
 * {
 *   taskId: string (required)
 *   action: TaskLogAction (required)
 *   note?: string (max 1000 chars)
 *   metadata?: Record<string, unknown>
 * }
 *
 * Authorization:
 * - User must have access to the task (owner, assignee, or admin/manager)
 *
 * Common Use Cases:
 * - Adding comments: action=COMMENTED
 * - Recording custom events: use metadata field
 * - Auto-created by task operations (handled by task service)
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { user } = auth;

    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
        },
        { status: 400 }
      );
    }

    const { taskId, action, note, metadata } = body;

    // Validate required fields
    if (!taskId || typeof taskId !== "string" || !taskId.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "taskId is required and must be a non-empty string",
        },
        { status: 400 }
      );
    }

    if (!action || typeof action !== "string" || !action.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "action is required and must be a non-empty string",
        },
        { status: 400 }
      );
    }

    // Validate action enum
    if (!isValidAction(action)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate note length if provided
    if (note !== undefined && note !== null) {
      if (typeof note !== "string") {
        return NextResponse.json(
          {
            success: false,
            error: "note must be a string",
          },
          { status: 400 }
        );
      }

      if (note.length > MAX_NOTE_LENGTH) {
        return NextResponse.json(
          {
            success: false,
            error: `note cannot exceed ${MAX_NOTE_LENGTH} characters`,
          },
          { status: 400 }
        );
      }
    }

    // Validate metadata if provided
    if (metadata !== undefined && metadata !== null) {
      if (typeof metadata !== "object" || Array.isArray(metadata)) {
        return NextResponse.json(
          {
            success: false,
            error: "metadata must be an object",
          },
          { status: 400 }
        );
      }
    }

    // Verify task exists and is not deleted
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, isDeleted: true, ownerId: true },
    });

    if (!task || task.isDeleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Task not found or has been deleted",
        },
        { status: 404 }
      );
    }

    // Authorization: User must have access to the task
    const hasAccess = await canAccessTaskLogs(user.id, taskId, user.role);
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: "Access denied to this task" },
        { status: 403 }
      );
    }

    // Create the task log
    const taskLog = await prisma.taskLog.create({
      data: {
        taskId,
        userId: user.id,
        action: action as TaskLogAction,
        note: note || null,
        metadata: metadata || null,
      },
      include: TASK_LOG_INCLUDE,
    });

    const response: ApiResponse<TaskLogWithRelations> = {
      success: true,
      data: taskLog as any,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error("Error creating task log:", error);

    // Handle Prisma constraint errors
    if (error.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid task ID reference",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create task log",
      },
      { status: 500 }
    );
  }
}
