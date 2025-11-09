import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware/auth";
import type { ApiResponse } from "@/lib/types";

/**
 * Related task information returned in relation response
 */
interface RelatedTaskInfo {
  id: string;
  title: string;
  status: string;
  priority: string;
  completedAt: Date | null;
}

/**
 * Task relation with related task details
 */
interface TaskRelationWithDetails {
  relationId: string;
  isBlock: boolean;
  task: RelatedTaskInfo;
}

/**
 * Task relations response data structure
 */
interface TaskRelationsData {
  taskId: string;
  parentTasks: TaskRelationWithDetails[];
  childTasks: TaskRelationWithDetails[];
  blockedBy: TaskRelationWithDetails[];
}

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
 * Validate query parameters
 */
function validateQueryParams(params: {
  includeDetails?: string;
  filterByBlock?: string;
  direction?: string;
}): { valid: boolean; errors?: string[] } {
  const errors: string[] = [];

  if (params.includeDetails !== undefined) {
    if (!["true", "false"].includes(params.includeDetails)) {
      errors.push('includeDetails must be "true" or "false"');
    }
  }

  if (params.filterByBlock !== undefined) {
    if (!["true", "false"].includes(params.filterByBlock)) {
      errors.push('filterByBlock must be "true" or "false"');
    }
  }

  if (params.direction !== undefined) {
    if (!["parent", "child", "both"].includes(params.direction)) {
      errors.push('direction must be one of: parent, child, both');
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * GET /api/tasks/[id]/relations
 * Fetch all relations (parent-child dependencies) for a task
 *
 * Query Parameters (all optional):
 * - includeDetails=true - Include full task details for related tasks (default: true)
 * - filterByBlock=true - Only return blocking relations (default: false, return all)
 * - direction=parent|child|both - Filter by relation direction (default: both)
 *
 * Authorization:
 * - Requires authentication
 * - Same authorization as GET /api/tasks/[id]
 * - Owner, assignees, admins, and managers can view
 *
 * Response:
 * - Returns task relations with parent tasks, child tasks, and blocking relations
 *
 * Error Responses:
 * - 400: Invalid query parameters
 * - 401: Authentication required
 * - 403: Access denied (cannot access task)
 * - 404: Task not found or deleted
 * - 500: Database error
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

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const includeDetailsParam = searchParams.get("includeDetails") ?? "true";
    const filterByBlockParam = searchParams.get("filterByBlock") ?? "false";
    const directionParam = searchParams.get("direction") ?? "both";

    // Validate query parameters
    const validation = validateQueryParams({
      includeDetails: includeDetailsParam,
      filterByBlock: filterByBlockParam,
      direction: directionParam,
    });

    if (!validation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid query parameters",
          details: validation.errors,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const includeDetails = includeDetailsParam === "true";
    const filterByBlock = filterByBlockParam === "true";
    const direction = directionParam as "parent" | "child" | "both";

    // Check if task exists and is not deleted
    const task = await prisma.task.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        isDeleted: true,
      },
    });

    if (!task || task.isDeleted) {
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
          error: "You don't have access to this task",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Build the response data structure
    const responseData: TaskRelationsData = {
      taskId: id,
      parentTasks: [],
      childTasks: [],
      blockedBy: [],
    };

    // Query relations where this task is the child (fetch parent tasks)
    if (direction === "parent" || direction === "both") {
      if (includeDetails) {
        const parentRelations = await prisma.taskRelation.findMany({
          where: {
            childTaskId: id,
            ...(filterByBlock && { isBlock: true }),
          },
          include: {
            parentTask: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                completedAt: true,
              },
            },
          },
        });

        responseData.parentTasks = parentRelations.map((rel) => ({
          relationId: rel.id,
          isBlock: rel.isBlock,
          task: rel.parentTask as RelatedTaskInfo,
        }));

        // Separately track blocking relations for the blockedBy array
        if (filterByBlock) {
          responseData.blockedBy = responseData.parentTasks;
        }
      } else {
        const parentRelations = await prisma.taskRelation.findMany({
          where: {
            childTaskId: id,
            ...(filterByBlock && { isBlock: true }),
          },
          select: {
            id: true,
            isBlock: true,
            parentTaskId: true,
          },
        });

        responseData.parentTasks = parentRelations.map((rel) => ({
          relationId: rel.id,
          isBlock: rel.isBlock,
          task: { id: rel.parentTaskId } as unknown as RelatedTaskInfo,
        }));

        if (filterByBlock) {
          responseData.blockedBy = responseData.parentTasks;
        }
      }
    }

    // Query relations where this task is the parent (fetch child tasks)
    if (direction === "child" || direction === "both") {
      if (includeDetails) {
        const childRelations = await prisma.taskRelation.findMany({
          where: {
            parentTaskId: id,
            ...(filterByBlock && { isBlock: true }),
          },
          include: {
            childTask: {
              select: {
                id: true,
                title: true,
                status: true,
                priority: true,
                completedAt: true,
              },
            },
          },
        });

        responseData.childTasks = childRelations.map((rel) => ({
          relationId: rel.id,
          isBlock: rel.isBlock,
          task: rel.childTask as RelatedTaskInfo,
        }));

        // For blocking relations in child direction
        if (filterByBlock && direction === "both") {
          const childBlockingRelations = childRelations.filter(
            (rel) => rel.isBlock
          );
          responseData.blockedBy.push(
            ...childBlockingRelations.map((rel) => ({
              relationId: rel.id,
              isBlock: rel.isBlock,
              task: rel.childTask as RelatedTaskInfo,
            }))
          );
        }
      } else {
        const childRelations = await prisma.taskRelation.findMany({
          where: {
            parentTaskId: id,
            ...(filterByBlock && { isBlock: true }),
          },
          select: {
            id: true,
            isBlock: true,
            childTaskId: true,
          },
        });

        responseData.childTasks = childRelations.map((rel) => ({
          relationId: rel.id,
          isBlock: rel.isBlock,
          task: { id: rel.childTaskId } as unknown as RelatedTaskInfo,
        }));

        if (filterByBlock && direction === "both") {
          const childBlockingRelations = childRelations.filter(
            (rel) => rel.isBlock
          );
          responseData.blockedBy.push(
            ...childBlockingRelations.map((rel) => ({
              relationId: rel.id,
              isBlock: rel.isBlock,
              task: { id: rel.childTaskId } as unknown as RelatedTaskInfo,
            }))
          );
        }
      }
    }

    // When filterByBlock is true and no direction specified, populate blockedBy with all blocking relations
    if (filterByBlock && direction === "both" && !includeDetails) {
      // Already handled above, but ensure blockedBy contains all blocking relations
      responseData.blockedBy = [
        ...responseData.parentTasks.filter((r) => r.isBlock),
        ...responseData.childTasks.filter((r) => r.isBlock),
      ];
    } else if (
      filterByBlock &&
      direction === "both" &&
      includeDetails &&
      responseData.blockedBy.length === 0
    ) {
      // Ensure blockedBy is populated from parent and child tasks
      responseData.blockedBy = [
        ...responseData.parentTasks.filter((r) => r.isBlock),
        ...responseData.childTasks.filter((r) => r.isBlock),
      ];
    }

    const response: ApiResponse<TaskRelationsData> = {
      success: true,
      data: responseData,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching task relations:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch relations",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
