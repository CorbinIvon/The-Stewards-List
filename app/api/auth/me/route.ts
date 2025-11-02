import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractTokenFromHeader,
  verifyToken,
} from "@/lib/auth";
import type { UserPublic, ApiResponse } from "@/lib/types";

/**
 * GET /api/auth/me
 * Get current authenticated user information
 * Requires Authorization header with Bearer token
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract token from Authorization header
    const authHeader = request.headers.get("authorization");
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing or invalid authorization header",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Verify and decode token
    let authUser;
    try {
      authUser = verifyToken(token);
    } catch (error) {
      console.error("Token verification error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid or expired token",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Fetch fresh user data from database
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          email: true,
          username: true,
          displayName: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
        },
      });
    } catch (error) {
      console.error("Database error fetching user:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to fetch user information",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // User no longer exists
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "User not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check if user is inactive
    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "User account is inactive",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Return user data (without passwordHash)
    const response: ApiResponse<UserPublic> = {
      success: true,
      data: user as UserPublic,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Get current user error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
