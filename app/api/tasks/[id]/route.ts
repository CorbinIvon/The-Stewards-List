import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAdminOrManager } from "@/lib/middleware/auth";
import type {
  ApiResponse,
  TaskWithOwner,
  TaskStatus,
  TaskPriority,
  TaskFrequency,
} from "@/lib/types";

/**
 * Task query include pattern for consistent data loading
 */
const taskInclude = {
  owner: {
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
    },
  },
  assignments: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
        },
      },
    },
  },
};

/**
 * Check if user can access (view) a task
 * Admins and managers can access all tasks
 * Regular users can only access tasks they own or are assigned to
 */
async function canAccessTask(
  userId: string,
  taskId: string,
  userRole: string
): Promise<boolean> {
  // Admins and managers can access all tasks
  if (userRole === "ADMIN" || userRole === "MANAGER") {
    return true;
  }

  // Regular users can only access tasks they own or are assigned to
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
 * Check if user can modify (update) a task
 * Admins, managers, and task owners can modify
 * Assignees can also modify the task
 */
async function canModifyTask(
  userId: string,
  taskId: string,
  userRole: string
): Promise<boolean> {
  // Admins and managers can modify all tasks
  if (userRole === "ADMIN" || userRole === "MANAGER") {
    return true;
  }

  // Check if user owns or is assigned to the task
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
 * Check if user can delete a task
 * Only admins and owners can delete tasks
 */
async function canDeleteTask(
  userId: string,
  taskId: string,
  userRole: string
): Promise<boolean> {
  // Admins can delete any task
  if (userRole === "ADMIN") {
    return true;
  }

  // Regular users and managers can only delete tasks they own
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { ownerId: true },
  });

  return task?.ownerId === userId;
}

/**
 * Validate task update data
 */
function validateTaskUpdateData(data: any): {
  valid: boolean;
  errors?: string[];
} {
  const errors: string[] = [];

  if (data.title !== undefined) {
    if (typeof data.title !== "string" || data.title.trim().length === 0) {
      errors.push("title must be a non-empty string");
    } else if (data.title.length > 200) {
      errors.push("title must be 200 characters or less");
    }
  }

  if (data.description !== undefined) {
    if (data.description !== null && data.description.length > 2000) {
      errors.push("description must be 2000 characters or less");
    }
  }

  if (data.priority !== undefined) {
    if (
      data.priority &&
      !["LOW", "MEDIUM", "HIGH", "URGENT"].includes(data.priority)
    ) {
      errors.push("priority must be one of: LOW, MEDIUM, HIGH, URGENT");
    }
  }

  if (data.status !== undefined) {
    if (
      data.status &&
      !["TODO", "IN_PROGRESS", "COMPLETED", "CANCELLED"].includes(data.status)
    ) {
      errors.push(
        "status must be one of: TODO, IN_PROGRESS, COMPLETED, CANCELLED"
      );
    }
  }

  if (data.frequency !== undefined) {
    if (
      data.frequency !== null &&
      ![
        "DAILY",
        "WEEKLY",
        "BIWEEKLY",
        "MONTHLY",
        "QUARTERLY",
        "YEARLY",
        "ONCE",
      ].includes(data.frequency)
    ) {
      errors.push(
        "frequency must be one of: DAILY, WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, YEARLY, ONCE"
      );
    }
  }

  if (data.dueDate !== undefined) {
    if (data.dueDate !== null && isNaN(new Date(data.dueDate).getTime())) {
      errors.push("dueDate must be a valid ISO date string");
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * GET /api/tasks/:id
 * Fetch a single task by ID
 *
 * Path Parameters:
 * - id: string (task ID)
 *
 * Authorization:
 * - Requires authentication
 * - Owner, assignees, admins, and managers can view
 *
 * Response:
 * - Returns task with owner and assignments data
 *
 * Error Responses:
 * - 401: Authentication required
 * - 403: Access denied (cannot access task)
 * - 404: Task not found or deleted
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { user } = auth;

    const { id } = await params;

    // Check if task exists and is not deleted
    const task = await prisma.task.findUnique({
      where: { id },
      include: taskInclude,
    });

    if (!task || (task as any).isDeleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Task not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check authorization
    const canAccess = await canAccessTask(user.id, id, user.role);
    if (!canAccess) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    const response: ApiResponse<TaskWithOwner> = {
      success: true,
      data: task as unknown as TaskWithOwner,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching task:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch task",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/tasks/:id
 * Update a task
 *
 * Path Parameters:
 * - id: string (task ID)
 *
 * Request Body (all optional):
 * - title: string (1-200 chars)
 * - description: string | null (max 2000 chars)
 * - status: TaskStatus (TODO, IN_PROGRESS, COMPLETED, CANCELLED)
 * - priority: TaskPriority (LOW, MEDIUM, HIGH, URGENT)
 * - frequency: TaskFrequency | null
 * - dueDate: string | null (ISO date string)
 * - note: string (optional note for task log)
 *
 * Special Logic:
 * - If status changes to COMPLETED, sets completedAt = now()
 * - If status changes from COMPLETED to something else, clears completedAt
 * - Creates TaskLog entry with action=UPDATED or COMPLETED
 *
 * Authorization:
 * - Requires authentication
 * - Owner, assignees, admins, and managers can update
 *
 * Response:
 * - Returns updated task with owner and assignments data
 *
 * Error Responses:
 * - 400: Validation error
 * - 401: Authentication required
 * - 403: Access denied
 * - 404: Task not found or deleted
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { user } = auth;

    // Parse request body
    const body = await request.json();

    // Validate update data
    const validation = validateTaskUpdateData(body);
    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation error",
          details: validation.errors,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { id } = await params;

    // Helper to compute assignDate and dueBy
    function computeSchedule(
      freq: TaskFrequency | null,
      providedDue?: string | null
    ) {
      const now = new Date();
      if (providedDue) {
        return { assignDate: now, dueBy: new Date(providedDue) };
      }

      if (!freq) {
        return { assignDate: null, dueBy: null };
      }

      const start = now;
      const end = new Date(start.getTime());
      switch (freq) {
        case "DAILY":
          end.setDate(end.getDate() + 1);
          break;
        case "WEEKLY":
          end.setDate(end.getDate() + 7);
          break;
        case "BIWEEKLY":
          end.setDate(end.getDate() + 14);
          break;
        case "MONTHLY":
          end.setMonth(end.getMonth() + 1);
          break;
        case "QUARTERLY":
          end.setMonth(end.getMonth() + 3);
          break;
        case "YEARLY":
          end.setFullYear(end.getFullYear() + 1);
          break;
        case "ONCE":
          return { assignDate: start, dueBy: null };
        default:
          return { assignDate: null, dueBy: null };
      }

      return { assignDate: start, dueBy: end };
    }

    // Get current task
    const currentTask = await prisma.task.findUnique({ where: { id } });

    if (!currentTask || (currentTask as any).isDeleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Task not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check authorization
    const canModify = await canModifyTask(user.id, id, user.role);
    if (!canModify) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: any = {};
    if (body.title !== undefined) {
      updateData.title = body.title.trim();
    }
    if (body.description !== undefined) {
      updateData.description = body.description;
    }
    if (body.priority !== undefined) {
      updateData.priority = body.priority;
    }
    if (body.frequency !== undefined) {
      updateData.frequency = body.frequency;
    }
    if (body.dueDate !== undefined) {
      updateData.dueDate = body.dueDate ? new Date(body.dueDate) : null;
      // If a dueDate is explicitly provided, set assignDate to now and dueBy to provided date
      const schedule = computeSchedule(
        null,
        body.dueDate ? body.dueDate : null
      );
      updateData.assignDate = schedule.assignDate;
      updateData.dueBy = schedule.dueBy;
    }

    // If frequency changed (and no explicit dueDate provided), recompute schedule from now
    if (body.frequency !== undefined && body.dueDate === undefined) {
      const schedule = computeSchedule(body.frequency || null, null);
      updateData.assignDate = schedule.assignDate;
      updateData.dueBy = schedule.dueBy;
    }

    // Handle status changes
    if (body.status !== undefined) {
      updateData.status = body.status;

      // If status changes to COMPLETED, set completedAt
      if (
        body.status === "COMPLETED" &&
        (currentTask as any).status !== "COMPLETED"
      ) {
        updateData.completedAt = new Date();
      }
      // If status changes from COMPLETED to something else, clear completedAt
      else if (
        body.status !== "COMPLETED" &&
        (currentTask as any).status === "COMPLETED"
      ) {
        updateData.completedAt = null;
      }
    }

    // Determine log action
    const logAction =
      body.status === "COMPLETED" && (currentTask as any).status !== "COMPLETED"
        ? "COMPLETED"
        : "UPDATED";

    // Update task and create log in transaction
    const [updatedTask] = await prisma.$transaction([
      prisma.task.update({
        where: { id },
        data: updateData,
        include: taskInclude,
      }),
      prisma.taskLog.create({
        data: {
          taskId: id,
          userId: user.id,
          action: logAction,
          note: body.note || undefined,
        } as any,
      }),
    ]);

    const response: ApiResponse<TaskWithOwner> = {
      success: true,
      data: updatedTask as unknown as TaskWithOwner,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating task:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update task",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/tasks/:id
 * Soft delete a task
 *
 * Path Parameters:
 * - id: string (task ID)
 *
 * Behavior:
 * - Sets isDeleted = true, deletedAt = now(), status = CANCELLED
 * - Creates TaskLog entry with action=CANCELLED
 * - Does not permanently delete task data
 *
 * Authorization:
 * - Requires authentication
 * - Only owner and admins can delete
 *
 * Response:
 * - Returns success message
 *
 * Error Responses:
 * - 401: Authentication required
 * - 403: Access denied (not owner or admin)
 * - 404: Task not found or already deleted
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { user } = auth;

    const { id } = await params;

    // Get current task
    const currentTask = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        isDeleted: true,
      },
    });

    if (!currentTask || (currentTask as any).isDeleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Task not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check authorization
    const canDelete = await canDeleteTask(user.id, id, user.role);
    if (!canDelete) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Soft delete task and create log in transaction
    await prisma.$transaction([
      prisma.task.update({
        where: { id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          status: "CANCELLED",
        },
      }),
      prisma.taskLog.create({
        data: {
          taskId: id,
          userId: user.id,
          action: "CANCELLED",
          note: "Task deleted",
        } as any,
      }),
    ]);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: "Task deleted successfully" },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error deleting task:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete task",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
