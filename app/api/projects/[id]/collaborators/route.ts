import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware/auth";
import type { ApiResponse } from "@/lib/types";

/**
 * Include pattern for collaborator responses with related user and permissions
 */
const COLLABORATOR_INCLUDE = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
    },
  },
};

/**
 * Permission include pattern for returning collaborator permissions
 */
const PERMISSION_INCLUDE = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
      email: true,
    },
  },
};

/**
 * Check if user can manage collaborators on a project
 * Authorization: Project creator OR users with ADMIN permission on the project
 */
async function canManageCollaborators(
  userId: string,
  projectId: string
): Promise<boolean> {
  // Check if user is project creator
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { creatorId: true },
  });

  if (!project) return false;

  if (project.creatorId === userId) return true;

  // Check if user has ADMIN permission on the project
  const adminPermission = await prisma.projectPermission.findFirst({
    where: {
      projectId,
      userId,
      permission: "ADMIN",
    },
    select: { id: true },
  });

  return adminPermission !== null;
}

/**
 * POST /api/projects/[id]/collaborators
 * Add a collaborator to a project
 *
 * Request Body:
 * - userId: string (required, must be valid and active user)
 *
 * Authorization:
 * - Requires authentication
 * - User must be project creator OR have ADMIN permission on project
 *
 * Validation:
 * - Target user must exist and be active
 * - Target user cannot already be a collaborator
 * - Target user cannot be the project creator (already collaborator)
 *
 * Response:
 * - Returns created collaborator with user info and default READ permission
 * - Status 201 Created
 *
 * Error Responses:
 * - 400: Invalid userId format
 * - 401: Not authenticated
 * - 403: Insufficient permissions to manage collaborators
 * - 404: Project not found, User not found
 * - 409: User is already a collaborator or is project creator
 * - 500: Server error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id: projectId } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    // Parse request body
    const body = await request.json();
    const { userId } = body;

    // Validate userId input
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

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        creatorId: true,
      },
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

    // Check authorization: user must be creator or have ADMIN permission
    const canManage = await canManageCollaborators(user.id, projectId);
    if (!canManage) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions to manage collaborators on this project",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Verify target user exists and is active
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        displayName: true,
        email: true,
        isActive: true,
      },
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
          error: "Cannot add inactive user as collaborator",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if target user is the project creator (already implicit collaborator)
    if (targetUser.id === project.creatorId) {
      return NextResponse.json(
        {
          success: false,
          error: "Project creator is already a collaborator",
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    // Check if user is already a collaborator
    const existingCollaborator = await prisma.projectCollaborator.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId,
        },
      },
    });

    if (existingCollaborator) {
      return NextResponse.json(
        {
          success: false,
          error: "User is already a collaborator on this project",
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    // Create collaborator and permission records in a transaction
    const [collaborator, permission] = await prisma.$transaction([
      // Create the collaborator record
      prisma.projectCollaborator.create({
        data: {
          projectId,
          userId,
        },
        include: COLLABORATOR_INCLUDE,
      }),
      // Create default READ permission for the collaborator
      prisma.projectPermission.create({
        data: {
          projectId,
          userId,
          permission: "READ",
        },
        include: PERMISSION_INCLUDE,
      }),
    ]);

    const response: ApiResponse<any> = {
      success: true,
      data: {
        id: collaborator.id,
        userId: collaborator.userId,
        projectId: collaborator.projectId,
        addedAt: collaborator.addedAt,
        user: collaborator.user,
        permissions: [
          {
            id: permission.id,
            permission: permission.permission,
          },
        ],
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error("Error adding collaborator to project:", error);

    // Handle unique constraint violation (race condition)
    if (error.code === "P2002") {
      return NextResponse.json(
        {
          success: false,
          error: "User is already a collaborator on this project",
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    // Handle foreign key constraint (invalid user or project)
    if (error.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid user or project reference",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to add collaborator to project",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
