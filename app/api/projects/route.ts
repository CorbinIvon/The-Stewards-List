import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware/auth";
import type { ApiResponse, PaginatedResponse } from "@/lib/types";

/**
 * Project query include pattern for consistent data loading
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
  tasks: {
    select: {
      id: true,
      title: true,
      status: true,
    },
    take: 5, // Limit to 5 tasks in list view
  },
};

/**
 * Check if user can access a project
 * Users can access projects they created, are collaborators on, or have permissions for
 */
async function canAccessProject(
  userId: string,
  projectId: string
): Promise<boolean> {
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { creatorId: userId },
        { collaborators: { some: { userId } } },
        { permissions: { some: { userId } } },
      ],
    },
    select: { id: true },
  });

  return project !== null;
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
 * Validate project data
 */
function validateProjectData(data: any): {
  valid: boolean;
  errors?: string[];
} {
  const errors: string[] = [];

  if (data.projectName !== undefined) {
    if (typeof data.projectName !== "string" || data.projectName.trim().length === 0) {
      errors.push("projectName must be a non-empty string");
    } else if (data.projectName.length > 200) {
      errors.push("projectName must be 200 characters or less");
    }
  }

  if (data.description !== undefined) {
    if (data.description !== null && data.description.length > 2000) {
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
 * GET /api/projects
 * Fetch projects with pagination and filtering
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - pageSize: number (default: 20, max: 100)
 * - archived: "true" | "false" (filter by archived status)
 *
 * Authorization:
 * - Requires authentication
 * - Returns projects created by user OR where user is collaborator/has permissions
 *
 * Response:
 * - Returns paginated list of projects with creator, collaborators, and permissions
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
    const archivedParam = searchParams.get("archived");

    // Build where clause
    const where: any = {
      OR: [
        { creatorId: user.id },
        { collaborators: { some: { userId: user.id } } },
        { permissions: { some: { userId: user.id } } },
      ],
    };

    // Apply archived filter if provided
    if (archivedParam !== null) {
      where.archived = archivedParam === "true";
    }

    // Fetch total count for pagination
    const total = await prisma.project.count({ where });
    const totalPages = Math.ceil(total / pageSize);

    // Fetch projects
    const projects = await prisma.project.findMany({
      where,
      include: projectInclude,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });

    const response: PaginatedResponse<any> = {
      success: true,
      data: projects,
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
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch projects",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects
 * Create a new project
 *
 * Request Body:
 * - projectName: string (required, 1-200 chars)
 * - description: string (optional, max 2000 chars)
 *
 * Authorization:
 * - Requires authentication
 * - creatorId is auto-set to authenticated user (cannot be overridden)
 * - archived defaults to false
 *
 * Response:
 * - Returns created project with creator, collaborators, and permissions
 * - Status 201 Created
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
    const { projectName, description } = body;

    // Validate required fields
    if (!projectName || typeof projectName !== "string" || projectName.trim().length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "projectName is required and must be a non-empty string",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate all provided fields
    const validation = validateProjectData({
      projectName,
      description,
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

    // Create project
    const project = await prisma.project.create({
      data: {
        creatorId: user.id,
        projectName: projectName.trim(),
        description: description || null,
        archived: false,
      },
      include: projectInclude,
    });

    const response: ApiResponse<any> = {
      success: true,
      data: project,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error: any) {
    console.error("Error creating project:", error);

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
        error: "Failed to create project",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
