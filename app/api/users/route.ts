import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requireAuth, requireRole, isAdmin } from "@/lib/middleware/auth";
import { validateRequest } from "@/lib/validation";
import { createUserSchema } from "@/lib/validation";
import type { UserPublic, PaginatedResponse, ApiResponse } from "@/lib/types";
import { UserRole } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

interface PaginationParams {
  page: number;
  pageSize: number;
  skip: number;
  take: number;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract and validate pagination parameters from request URL
 */
function getPaginationParams(searchParams: URLSearchParams): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20")));
  return {
    page,
    pageSize,
    skip: (page - 1) * pageSize,
    take: pageSize,
  };
}

/**
 * Select clause for user queries (excludes passwordHash)
 */
const userSelect = {
  id: true,
  createdAt: true,
  updatedAt: true,
  email: true,
  username: true,
  displayName: true,
  role: true,
  isActive: true,
  lastLoginAt: true,
};

// ============================================================================
// GET /api/users - List all users with pagination and role-based filtering
// ============================================================================

/**
 * GET /api/users
 *
 * List users with pagination support and role-based filtering
 * - Any authenticated user can list
 * - Admins see all users
 * - Regular users see only active users
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - pageSize: Items per page (default: 20, max: 100)
 *
 * Response: PaginatedResponse<UserPublic>
 */
export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user: requestingUser } = auth;

    // Get and validate pagination params
    const searchParams = request.nextUrl.searchParams;
    const { page, pageSize, skip, take } = getPaginationParams(searchParams);

    // Build where clause based on user role
    // Admins see all users, regular users see only active users
    const where = isAdmin(requestingUser) ? {} : { isActive: true };

    // Execute queries in parallel
    const [users, totalItems] = await Promise.all([
      prisma.user.findMany({
        where,
        select: userSelect,
        skip,
        take,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return NextResponse.json(
      {
        success: true,
        data: users as UserPublic[],
        pagination: {
          page,
          pageSize,
          total: totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        timestamp: new Date().toISOString(),
      } as PaginatedResponse<UserPublic>,
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch users",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/users - Create user (admin-only for user management)
// ============================================================================

/**
 * POST /api/users
 *
 * Create a new user with specified role (admin-only operation)
 * Use /api/auth/signup for user self-registration
 *
 * Request body:
 * {
 *   email: string (valid email)
 *   username: string (3-32 chars, alphanumeric + _-)
 *   displayName: string (1-128 chars)
 *   password: string (12+ chars, complex requirements)
 *   role?: UserRole (ADMIN, MANAGER, MEMBER - default: MEMBER)
 * }
 *
 * Response: ApiResponse<UserPublic>
 * Status: 201 Created
 */
export async function POST(request: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireRole(request, [UserRole.ADMIN]);
    if (auth instanceof NextResponse) return auth;

    const body = await request.json();
    const { email, username, displayName, password, role = UserRole.MEMBER } = body;

    // Validate request data
    const validation = validateRequest(
      { email, username, displayName, password },
      createUserSchema
    );

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: validation.errors,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate role
    const validRoles = [UserRole.ADMIN, UserRole.MANAGER, UserRole.MEMBER];
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        {
          success: false,
          error: "Validation failed",
          details: [{ field: "role", message: "Invalid role specified" }],
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Hash password
    const passwordHash = await hashPassword(validation.data.password);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: validation.data.email,
        username: validation.data.username,
        displayName: validation.data.displayName,
        passwordHash,
        role,
        isActive: true,
      },
      select: userSelect,
    });

    return NextResponse.json(
      {
        success: true,
        data: user as UserPublic,
        timestamp: new Date().toISOString(),
      } as ApiResponse<UserPublic>,
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Error creating user:", error);

    // Handle unique constraint violations
    if (error.code === "P2002") {
      const field = error.meta?.target?.[0] || "unknown";
      const fieldMessage =
        field === "email" ? "Email already exists" : field === "username" ? "Username already exists" : "Unique constraint violated";

      return NextResponse.json(
        {
          success: false,
          error: "Conflict",
          details: [{ field, message: fieldMessage }],
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "Failed to create user",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
