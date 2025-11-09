import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware/auth";
import type { ApiResponse } from "@/lib/types";

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
 * Check if a user is the last admin on a project
 * Used to prevent removing the last admin collaborator
 */
async function isLastAdmin(
  userId: string,
  projectId: string
): Promise<boolean> {
  // Get project creator
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { creatorId: true },
  });

  if (!project) return false;

  // Project creator is always an implicit admin
  // If removing a collaborator who is not the creator, they can have ADMIN permission revoked
  // But we need to check if there are other admins
  if (userId === project.creatorId) {
    // Cannot remove the project creator
    return true;
  }

  // Check if this user has ADMIN permission
  const userAdminPermission = await prisma.projectPermission.findFirst({
    where: {
      projectId,
      userId,
      permission: "ADMIN",
    },
    select: { id: true },
  });

  if (!userAdminPermission) {
    // User is not an admin, so can be removed
    return false;
  }

  // Count other admins (including project creator implicitly)
  const otherAdminPermissions = await prisma.projectPermission.count({
    where: {
      projectId,
      permission: "ADMIN",
      userId: {
        not: userId,
      },
    },
  });

  // If there are other admins or the creator (who has implicit admin), this is not the last admin
  // Since project creator is always implicit admin, they count as one
  const totalAdmins = otherAdminPermissions + 1; // +1 for project creator
  return totalAdmins === 1; // Only this user is admin
}

/**
 * DELETE /api/projects/[id]/collaborators/[userId]
 * Remove a collaborator from a project
 *
 * URL Parameters:
 * - id: project ID
 * - userId: user ID of collaborator to remove
 *
 * Authorization:
 * - Requires authentication
 * - User must be project creator OR have ADMIN permission on project
 *
 * Validation:
 * - Collaborator must exist on the project
 * - Cannot remove the project creator
 * - Cannot remove self if they would be the last admin
 *
 * Response:
 * - Returns success message with removed collaborator info
 * - Status 200 OK
 *
 * Error Responses:
 * - 400: Invalid operation (e.g., removing project creator)
 * - 401: Not authenticated
 * - 403: Insufficient permissions to manage collaborators
 * - 404: Project not found, Collaborator not found
 * - 500: Server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; userId: string }> }
): Promise<NextResponse> {
  try {
    const { id: projectId, userId: collaboratorUserId } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    // Validate userId parameter
    if (!collaboratorUserId || typeof collaboratorUserId !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid userId parameter",
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

    // Verify collaborator exists
    const collaborator = await prisma.projectCollaborator.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: collaboratorUserId,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    if (!collaborator) {
      return NextResponse.json(
        {
          success: false,
          error: "Collaborator not found on this project",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Prevent removing the project creator
    if (collaboratorUserId === project.creatorId) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot remove project creator from collaborators",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check if removing self and would be last admin
    if (user.id === collaboratorUserId) {
      const isLast = await isLastAdmin(collaboratorUserId, projectId);
      if (isLast) {
        return NextResponse.json(
          {
            success: false,
            error: "Cannot remove yourself if you are the last admin on this project",
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
    }

    // Delete collaborator and associated permissions in a transaction
    await prisma.$transaction([
      // Delete collaborator record
      prisma.projectCollaborator.delete({
        where: {
          projectId_userId: {
            projectId,
            userId: collaboratorUserId,
          },
        },
      }),
      // Delete all permissions for this user on this project
      prisma.projectPermission.deleteMany({
        where: {
          projectId,
          userId: collaboratorUserId,
        },
      }),
    ]);

    const response: ApiResponse<any> = {
      success: true,
      data: {
        message: `Collaborator ${collaborator.user.displayName} (${collaborator.user.email}) has been removed from the project`,
        removedUser: {
          id: collaborator.userId,
          displayName: collaborator.user.displayName,
          email: collaborator.user.email,
        },
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error: any) {
    console.error("Error removing collaborator from project:", error);

    // Handle foreign key constraint errors
    if (error.code === "P2003") {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid project or user reference",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Handle record not found (shouldn't happen given our check, but catch it anyway)
    if (error.code === "P2025") {
      return NextResponse.json(
        {
          success: false,
          error: "Collaborator record not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to remove collaborator from project",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
