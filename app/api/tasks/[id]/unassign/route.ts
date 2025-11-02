import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware/auth";
import type { ApiResponse } from "@/lib/types";

/**
 * Check if user can unassign a user from a task
 * - Admins and managers can unassign anyone from any task
 * - Task owners can unassign anyone from their own tasks
 * - Users can unassign themselves from tasks
 */
async function canUnassignTask(
  userId: string,
  taskId: string,
  targetUserId: string,
  userRole: string
): Promise<boolean> {
  // Admins and managers can unassign anyone
  if (userRole === "ADMIN" || userRole === "MANAGER") {
    return true;
  }

  // Users can unassign themselves
  if (userId === targetUserId) {
    return true;
  }

  // Task owners can unassign anyone from their task
  const task = await prisma.task.findUnique({
    where: { id: taskId, isDeleted: false },
    select: { ownerId: true },
  });

  return task?.ownerId === userId;
}

/**
 * POST /api/tasks/:id/unassign
 * Unassign a user from a task
 *
 * Authentication: Required
 * Authorization: Task owner, assignee, manager, or admin can unassign
 *
 * Request Body:
 * - userId: string (required) - User to unassign
 *
 * Response:
 * - Returns success message with timestamp
 * - Deletes TaskAssignment record (hard delete)
 * - Creates TaskLog entry with action=UNASSIGNED
 * - Uses transaction for consistency
 *
 * Errors:
 * - 400: Validation error or missing userId
 * - 401: Not authenticated
 * - 403: Insufficient permissions
 * - 404: Task or assignment not found
 * - 500: Server error
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
    const body = await request.json();
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

    const { id } = await params;
    const targetUserId = userId.trim();

    // Validate task exists and is not soft-deleted
    const task = await prisma.task.findUnique({
      where: { id: taskId, isDeleted: false },
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
    const canUnassign = await canUnassignTask(
      user.id,
      taskId,
      targetUserId,
      user.role
    );

    if (!canUnassign) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions to unassign from this task",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Check if assignment exists
    const assignment = await prisma.taskAssignment.findUnique({
      where: {
        taskId_userId: {
          taskId,
          userId: targetUserId,
        },
      },
      include: {
        user: {
          select: { username: true, displayName: true },
        },
      },
    });

    if (!assignment) {
      return NextResponse.json(
        {
          success: false,
          error: "Assignment not found. User is not assigned to this task.",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Delete assignment and create log in transaction
    await prisma.$transaction([
      prisma.taskAssignment.delete({
        where: {
          taskId_userId: {
            taskId,
            userId: targetUserId,
          },
        },
      }),
      prisma.taskLog.create({
        data: {
          taskId,
          userId: user.id,
          action: "UNASSIGNED",
          note: `Unassigned ${assignment.user.displayName || assignment.user.username}`,
        },
      }),
    ]);

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: {
        message: "User successfully unassigned from task",
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Error unassigning user from task:", error);

    // Handle database constraint errors
    if (error.code === "P2025") {
      return NextResponse.json(
        {
          success: false,
          error: "Assignment not found. User is not assigned to this task.",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
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
        error: "Failed to unassign user from task",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
