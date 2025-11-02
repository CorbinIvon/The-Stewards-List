import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth, isAdminOrManager } from "@/lib/middleware/auth";
import type { ApiResponse, TaskAssignmentWithRelations, AssignTaskRequest } from "@/lib/types";

/**
 * Assignment include pattern for consistent data loading
 */
const ASSIGNMENT_INCLUDE = {
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
 * Check if user can assign tasks to a specific task
 * Admins and managers can assign anyone to any task
 * Regular users can only assign to their own tasks
 */
async function canAssignTask(
  userId: string,
  taskId: string,
  userRole: string
): Promise<boolean> {
  // Admins and managers can assign to any task
  if (userRole === "ADMIN" || userRole === "MANAGER") {
    return true;
  }

  // Check if user is the task owner
  const task = await prisma.task.findUnique({
    where: { id: taskId, isDeleted: false },
    select: { ownerId: true },
  });

  return task?.ownerId === userId;
}

/**
 * POST /api/tasks/:id/assign
 * Assign a user to a task
 *
 * Authentication: Required
 * Authorization: Task owner, manager, or admin can assign
 *
 * Request Body:
 * - userId: string (required) - User to assign
 *
 * Response:
 * - Returns TaskAssignment with user and task data
 * - Creates TaskLog entry with action=ASSIGNED
 * - Uses transaction for consistency
 *
 * Errors:
 * - 400: Validation error, missing userId, or user is inactive
 * - 401: Not authenticated
 * - 403: Insufficient permissions
 * - 404: Task or user not found
 * - 409: User already assigned to this task
 */
export async function POST(
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
    const body: AssignTaskRequest = await request.json();
    const { userId } = body;

    // Validate required fields
    if (!userId || typeof userId !== "string" || userId.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "userId is required and must be a non-empty string",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate task exists and is not soft-deleted
    const task = await prisma.task.findUnique({
      where: { id: id, isDeleted: false },
      select: { id: true, title: true, ownerId: true },
    });

    if (!task) {
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
    const canAssign = await canAssignTask(user.id, id, user.role);
    if (!canAssign) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions to assign this task",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Validate target user exists and is active
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, isActive: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    if (!targetUser.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot assign inactive user",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if assignment already exists
    const existing = await prisma.taskAssignment.findUnique({
      where: {
        taskId_userId: {
          taskId: id,
          userId: userId,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: "User is already assigned to this task",
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    // Create assignment and log in transaction
    const [assignment] = await prisma.$transaction([
      prisma.taskAssignment.create({
        data: {
          taskId: id,
          userId: userId,
          assignedBy: user.id,
        },
        include: ASSIGNMENT_INCLUDE,
      }),
      prisma.taskLog.create({
        data: {
          taskId: id,
          userId: user.id,
          action: "ASSIGNED",
          note: `Assigned to ${targetUser.username}`,
        },
      }),
    ]);

    const response: ApiResponse<TaskAssignmentWithRelations> = {
      success: true,
      data: assignment as TaskAssignmentWithRelations,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error("Error assigning user to task:", error);

    // Handle database constraint errors
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          error: "User is already assigned to this task",
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    if (error.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid task or user reference",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to assign user to task",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
