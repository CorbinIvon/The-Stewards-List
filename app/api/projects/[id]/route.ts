import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware/auth";
import type {
  ApiResponse,
  Project,
  ProjectWithRelations,
  ProjectCollaboratorWithUser,
  ProjectPermissionWithUser,
} from "@/lib/types";

/**
 * Project query include pattern for consistent data loading
 * Includes creator, collaborators with users, and permissions with users
 */
const projectInclude = {
  creator: {
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
      role: true,
    },
  },
  collaborators: {
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          email: true,
        },
      },
    },
  },
  permissions: {
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
 * Check if user can access (view) a project
 * Project creator, collaborators, or users with permissions can access
 */
async function canAccessProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  // Check if user is the creator
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { creatorId: true },
  });

  if (!project) {
    return false;
  }

  if (project.creatorId === userId) {
    return true;
  }

  // Check if user is a collaborator
  const isCollaborator = await prisma.projectCollaborator.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });

  if (isCollaborator) {
    return true;
  }

  // Check if user has explicit permissions
  const hasPermission = await prisma.projectPermission.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });

  return hasPermission !== null;
}

/**
 * Check if user can modify (update) a project
 * Only project creator or users with WRITE/ADMIN permission can modify
 */
async function canModifyProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  // Check if user is the creator
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { creatorId: true },
  });

  if (!project) {
    return false;
  }

  if (project.creatorId === userId) {
    return true;
  }

  // Check if user has WRITE or ADMIN permission
  const permission = await prisma.projectPermission.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId,
      },
    },
  });

  return (
    permission !== null &&
    (permission.permission === "WRITE" || permission.permission === "ADMIN")
  );
}

/**
 * Check if user can delete a project
 * Only project creator can delete
 */
async function canDeleteProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { creatorId: true },
  });

  return project?.creatorId === userId;
}

/**
 * Validate project update data
 */
function validateProjectUpdateData(data: any): {
  valid: boolean;
  errors?: string[];
} {
  const errors: string[] = [];

  if (data.projectName !== undefined) {
    if (
      typeof data.projectName !== "string" ||
      data.projectName.trim().length === 0
    ) {
      errors.push("projectName must be a non-empty string");
    } else if (data.projectName.length > 200) {
      errors.push("projectName must be 200 characters or less");
    }
  }

  if (data.description !== undefined) {
    if (
      data.description !== null &&
      typeof data.description !== "string"
    ) {
      errors.push("description must be a string or null");
    } else if (data.description && data.description.length > 2000) {
      errors.push("description must be 2000 characters or less");
    }
  }

  if (data.archived !== undefined) {
    if (typeof data.archived !== "boolean") {
      errors.push("archived must be a boolean");
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * GET /api/projects/:id
 * Fetch a single project by ID with collaborators and permissions
 *
 * Path Parameters:
 * - id: string (project ID)
 *
 * Query Parameters:
 * - includeTasks: boolean (optional, include recent tasks)
 *
 * Authorization:
 * - Requires authentication
 * - Project creator, collaborators, or users with permissions can view
 *
 * Response:
 * - Returns project with creator, collaborators, permissions, and task count
 * - If includeTasks=true, includes up to 5 recent tasks
 *
 * Error Responses:
 * - 401: Authentication required
 * - 403: Access denied (cannot access project)
 * - 404: Project not found
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { user } = auth;

    const includeTasks = request.nextUrl.searchParams.get("includeTasks") === "true";

    // Check if project exists
    const project = await prisma.project.findUnique({
      where: { id },
      include: projectInclude,
    });

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check authorization
    const canAccess = await canAccessProject(user.id, id);
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

    // Get task count
    const taskCount = await prisma.task.count({
      where: {
        projectId: id,
        isDeleted: false,
      },
    });

    // Get recent tasks if requested
    let recentTasks = null;
    if (includeTasks) {
      recentTasks = await prisma.task.findMany({
        where: {
          projectId: id,
          isDeleted: false,
        },
        select: {
          id: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      });
    }

    // Build response with additional metadata
    const responseData = {
      ...project,
      taskCount,
      recentTasks: includeTasks ? recentTasks : undefined,
    };

    const response: ApiResponse = {
      success: true,
      data: responseData,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch project",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/:id
 * Update a project
 *
 * Path Parameters:
 * - id: string (project ID)
 *
 * Request Body (all optional):
 * - projectName: string (1-200 chars)
 * - description: string | null (max 2000 chars)
 * - archived: boolean
 *
 * Authorization:
 * - Requires authentication
 * - Project creator OR users with WRITE/ADMIN permission can update
 *
 * Response:
 * - Returns updated project with creator, collaborators, and permissions
 *
 * Error Responses:
 * - 400: Validation error
 * - 401: Authentication required
 * - 403: Access denied (not creator or insufficient permission)
 * - 404: Project not found
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
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
    const validation = validateProjectUpdateData(body);
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

    // Check if project exists
    const currentProject = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        creatorId: true,
      },
    });

    if (!currentProject) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check authorization
    const canModify = await canModifyProject(user.id, id);
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

    if (body.projectName !== undefined) {
      updateData.projectName = body.projectName.trim();
    }

    if (body.description !== undefined) {
      updateData.description = body.description;
    }

    if (body.archived !== undefined) {
      updateData.archived = body.archived;
    }

    // Update project in transaction with audit log creation
    const updatedProject = await prisma.$transaction(async (tx) => {
      const updated = await tx.project.update({
        where: { id },
        data: updateData,
        include: projectInclude,
      });

      // Create audit log entry if we have TaskLog model extended for projects
      // For now, we'll skip this as it might be task-specific
      // In future, create a ProjectLog model following TaskLog pattern

      return updated;
    });

    const response: ApiResponse = {
      success: true,
      data: updatedProject,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update project",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/:id
 * Delete a project
 *
 * Path Parameters:
 * - id: string (project ID)
 *
 * Behavior:
 * - Only project creator can delete
 * - Deletes all ProjectCollaborator records (cascaded by Prisma)
 * - Deletes all ProjectPermission records (cascaded by Prisma)
 * - Sets projectId to null for all tasks in project (soft reference)
 * - Permanently deletes project record
 *
 * Authorization:
 * - Requires authentication
 * - Only project creator can delete
 *
 * Response:
 * - Returns success message (204 or 200)
 *
 * Error Responses:
 * - 401: Authentication required
 * - 403: Access denied (not project creator)
 * - 404: Project not found
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }
    const { user } = auth;

    // Get current project
    const currentProject = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        creatorId: true,
        projectName: true,
      },
    });

    if (!currentProject) {
      return NextResponse.json(
        {
          success: false,
          error: "Project not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check authorization - only creator can delete
    const canDelete = await canDeleteProject(user.id, id);
    if (!canDelete) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied - only project creator can delete",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Delete project and handle cascades in transaction
    await prisma.$transaction(async (tx) => {
      // Set projectId to null for all tasks in this project
      // This ensures tasks aren't orphaned and remain accessible
      await tx.task.updateMany({
        where: {
          projectId: id,
        },
        data: {
          projectId: null,
        },
      });

      // Delete the project
      // ProjectCollaborator and ProjectPermission records will be
      // automatically deleted due to onDelete: Cascade in schema
      await tx.project.delete({
        where: { id },
      });

      // TODO: Create audit trail record when ProjectLog model is implemented
      // For now, deletion is immediate with no audit trail
    });

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: "Project deleted successfully" },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error deleting project:", error);

    // Handle specific Prisma errors
    if (error instanceof Error) {
      if (error.message.includes("Record to delete does not exist")) {
        return NextResponse.json(
          {
            success: false,
            error: "Project not found",
            timestamp: new Date().toISOString(),
          },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete project",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
