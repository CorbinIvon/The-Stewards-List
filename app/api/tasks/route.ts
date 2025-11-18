import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAdminOrManager } from "@/lib/middleware/auth";
import type {
  ApiResponse,
  PaginatedResponse,
  TaskWithOwner,
  CreateTaskRequest,
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
  projectLink: {
    select: {
      id: true,
      projectName: true,
      archived: true,
    },
  },
};

/**
 * Check if user can access a task based on ownership or assignment
 * Admins and managers can access all tasks
 */
async function canAccessTask(
  userId: string,
  userRole: string
): Promise<boolean> {
  // Admins and managers can access all tasks
  return userRole === "ADMIN" || userRole === "MANAGER";
}

/**
 * Parse and validate pagination parameters
 */
function getPaginationParams(searchParams: URLSearchParams) {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("pageSize") || "20"))
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

/**
 * Validate task data
 */
function validateTaskData(data: any): {
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
    if (!["LOW", "MEDIUM", "HIGH", "URGENT"].includes(data.priority)) {
      errors.push("priority must be one of: LOW, MEDIUM, HIGH, URGENT");
    }
  }

  if (data.status !== undefined) {
    if (
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
 * GET /api/tasks
 * Fetch tasks with authorization, pagination, and filtering
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - pageSize: number (default: 20, max: 100)
 * - status: TaskStatus (TODO, IN_PROGRESS, COMPLETED, CANCELLED)
 * - priority: TaskPriority (LOW, MEDIUM, HIGH, URGENT)
 * - ownerId: string (filter by owner)
 *
 * Authorization:
 * - Requires authentication
 * - Regular users: See tasks they own or are assigned to
 * - Admins/Managers: See all tasks
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { user } = auth;

    // Parse pagination and filter parameters
    const searchParams = request.nextUrl.searchParams;
    const { page, pageSize, skip, take } = getPaginationParams(searchParams);
    const status = searchParams.get("status");
    const priority = searchParams.get("priority");
    const ownerId = searchParams.get("ownerId");

    // Build where clause
    const where: any = {
      isDeleted: false,
    };

    // Authorization: admins/managers see all tasks, others see their own/assigned
    if (!isAdminOrManager(user)) {
      where.OR = [
        { ownerId: user.id },
        { assignments: { some: { userId: user.id } } },
      ];
    }

    // Apply optional filters
    if (status) {
      where.status = status;
    }
    if (priority) {
      where.priority = priority;
    }
    if (ownerId) {
      where.ownerId = ownerId;
    }

    // Fetch total count for pagination
    const total = await prisma.task.count({ where });
    const totalPages = Math.ceil(total / pageSize);

    // Fetch tasks
    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });

    const response: PaginatedResponse<TaskWithOwner> = {
      success: true,
      data: tasks as unknown as TaskWithOwner[],
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
    console.error("Error fetching tasks:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch tasks",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tasks
 * Create a new task
 *
 * Request Body:
 * - title: string (required, 1-200 chars)
 * - description: string (optional, max 2000 chars)
 * - priority: TaskPriority (optional, default: MEDIUM)
 * - frequency: TaskFrequency (optional)
 * - dueDate: string (optional, ISO date string)
 *
 * Authorization:
 * - Requires authentication
 * - ownerId is auto-set to authenticated user (cannot be overridden)
 *
 * Response:
 * - Returns created task with owner and assignments data
 * - Also creates initial TaskLog entry with action=CREATED
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { user } = auth;

    // Parse request body
    const body = await request.json();
    const { title, description, priority, frequency, dueDate } = body;

    // Validate required fields
    if (!title || typeof title !== "string" || title.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "title is required and must be a non-empty string",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate all provided fields
    const validation = validateTaskData({
      title,
      description,
      priority,
      frequency,
      dueDate,
    });

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

    // Prepare task data
    // Compute schedule: assignDate and dueBy
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

    const schedule = computeSchedule(frequency || null, dueDate || null);

    const taskData: any = {
      ownerId: user.id,
      title: title.trim(),
      description: description || null,
      priority: priority || "MEDIUM",
      frequency: frequency || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      assignDate: schedule.assignDate,
      dueBy: schedule.dueBy,
      status: "TODO",
    };

    // Create task and initial log in transaction
    const task = await prisma.$transaction(async (tx) => {
      // Create the task
      const newTask = await tx.task.create({
        data: taskData,
        include: taskInclude,
      });

      // Create initial TaskLog entry (cast data as any to match runtime shape)
      await tx.taskLog.create({
        data: { taskId: newTask.id, userId: user.id, action: "CREATED" } as any,
      });

      return newTask;
    });

    const response: ApiResponse<TaskWithOwner> = {
      success: true,
      data: task as unknown as TaskWithOwner,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error("Error creating task:", error);

    if (error.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid user reference",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create task",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
