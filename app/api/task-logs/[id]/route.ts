/**
 * Individual Task Log Retrieval Endpoint
 * GET /api/task-logs/:id
 *
 * Retrieves a specific task log entry by ID with full audit context
 * Task logs are immutable - no updates or deletes allowed for audit compliance
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAdminOrManager } from "@/lib/middleware/auth";
import type { ApiResponse, TaskLogWithRelations } from "@/lib/types";

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Common Prisma include for task log queries
 * Selects essential user and task details for audit trail context
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
      ownerId: true,
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if user can access a specific task log
 *
 * Authorization Rules:
 * - Admins/Managers: Can view all logs
 * - Task Owners: Can view logs for their tasks
 * - Task Assignees: Can view logs for tasks they're assigned to
 * - Other users: Denied (403)
 *
 * @param userId - ID of the user requesting access
 * @param taskLog - Task log with task relation data
 * @param userRole - Role of the requesting user
 * @returns true if user has access, false otherwise
 */
async function canAccessTaskLog(
  userId: string,
  taskLog: { task: { id: string; ownerId: string } },
  userRole: string
): Promise<boolean> {
  // Admins and managers can view all logs
  if (userRole === "ADMIN" || userRole === "MANAGER") {
    return true;
  }

  // Check if user has access to the associated task
  // Access granted if user is task owner or assigned to task
  const task = await prisma.task.findFirst({
    where: {
      id: taskLog.task.id,
      isDeleted: false,
      OR: [{ ownerId: userId }, { assignments: { some: { userId } } }],
    },
  });

  return task !== null;
}

// ============================================================================
// GET /api/task-logs/:id
// ============================================================================

/**
 * Retrieve a specific task log entry by ID
 *
 * @param request - NextRequest object
 * @param params - Route parameters containing log ID
 * @returns JSON response with task log data or error
 *
 * Response Status Codes:
 * - 200: Success - task log retrieved
 * - 401: Not authenticated
 * - 403: Authenticated but not authorized to view this log
 * - 404: Task log not found
 * - 500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    // Authenticate user
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { user } = auth;

    const { id } = params;

    // Validate ID parameter
    if (!id || !id.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Task log ID is required",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Fetch task log with related user and task data
    const taskLog = await prisma.taskLog.findUnique({
      where: { id: id },
      include: TASK_LOG_INCLUDE,
    });

    // Handle task log not found
    if (!taskLog) {
      return NextResponse.json(
        {
          success: false,
          error: "Task log not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check authorization - user must have access to the associated task
    const canAccess = await canAccessTaskLog(user.id, taskLog, user.role);
    if (!canAccess) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Access denied. You do not have permission to view this task log.",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Return task log with audit context
    const response: ApiResponse<TaskLogWithRelations> = {
      success: true,
      data: taskLog,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("[GET_TASK_LOG_ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to retrieve task log",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * Task logs are immutable for audit compliance
 * DELETE method is intentionally not implemented
 */
export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      error: "Task logs are immutable for audit compliance",
      timestamp: new Date().toISOString(),
    },
    { status: 405 }
  );
}

/**
 * Task logs are immutable for audit compliance
 * PATCH method is intentionally not implemented
 */
export async function PATCH(): Promise<NextResponse> {
  return NextResponse.json(
    {
      success: false,
      error: "Task logs are immutable for audit compliance",
      timestamp: new Date().toISOString(),
    },
    { status: 405 }
  );
}
