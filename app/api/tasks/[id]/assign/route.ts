import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware/auth";
import type {
  ApiResponse,
  TaskAssignmentWithRelations,
  AssignTaskRequest,
} from "@/lib/types";

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

async function canAssignTask(
  userId: string,
  taskId: string,
  userRole: string
): Promise<boolean> {
  if (userRole === "ADMIN" || userRole === "MANAGER") return true;
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task || (task as any).isDeleted) return false;
  return (task as any).ownerId === userId;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    const body: AssignTaskRequest = await request.json();
    const { userId } = body;
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
    const task = await prisma.task.findUnique({ where: { id } });
    if (!task || (task as any).isDeleted)
      return NextResponse.json(
        {
          success: false,
          error: "Task not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );

    const canAssign = await canAssignTask(user.id, id, user.role);
    if (!canAssign)
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions to assign this task",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser)
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    if (!(targetUser as any).isActive)
      return NextResponse.json(
        {
          success: false,
          error: "Cannot assign inactive user",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );

    const existing = await prisma.taskAssignment.findUnique({
      where: { taskId_userId: { taskId: id, userId } },
    });
    if (existing)
      return NextResponse.json(
        {
          success: false,
          error: "User is already assigned to this task",
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );

    const [assignment] = await prisma.$transaction([
      prisma.taskAssignment.create({
        data: { taskId: id, userId, assignedBy: user.id },
        include: ASSIGNMENT_INCLUDE,
      }),
      prisma.taskLog.create({
        data: {
          taskId: id,
          userId: user.id,
          action: "ASSIGNED",
          note: `Assigned to ${(targetUser as any).username}`,
        } as any,
      }),
    ]);

    const response: ApiResponse<TaskAssignmentWithRelations> = {
      success: true,
      data: assignment as unknown as TaskAssignmentWithRelations,
      timestamp: new Date().toISOString(),
    };
    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error("Error assigning user to task:", error);
    if (error.code === "P2002")
      return NextResponse.json(
        {
          success: false,
          error: "User is already assigned to this task",
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    if (error.code === "P2003")
      return NextResponse.json(
        {
          success: false,
          error: "Invalid task or user reference",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
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
