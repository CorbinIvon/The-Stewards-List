import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  generateToken,
  createAuthUserFromUser,
  TOKEN_EXPIRY,
} from "@/lib/auth";
import type { LoginRequest, LoginResponse, ApiResponse } from "@/lib/types";

/**
 * POST /api/auth/login
 * Authenticate a user and return JWT token
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON in request body",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate required fields
    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid request body",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const loginData = body as Record<string, unknown>;
    const { email, username, password } = loginData;

    // Check that we have either email or username, and password
    if (!password || typeof password !== "string") {
      return NextResponse.json(
        {
          success: false,
          error: "Password is required",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    if (
      (!email || typeof email !== "string") &&
      (!username || typeof username !== "string")
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Email or username is required",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Find user by email or username
    let user;
    try {
      if (email) {
        user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
      } else if (username) {
        user = await prisma.user.findUnique({
          where: { username: (username as string).toLowerCase() },
        });
      }
    } catch (error) {
      console.error("Database error finding user:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // User not found - use generic message for security
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        {
          success: false,
          error: "This account has been deactivated",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Verify password
    let passwordValid = false;
    try {
      passwordValid = await verifyPassword(password, user.passwordHash);
    } catch (error) {
      console.error("Password verification error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Password doesn't match
    if (!passwordValid) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid email or password",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Update last login timestamp
    try {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });
    } catch (error) {
      console.error("Error updating last login:", error);
      // Continue - this is not critical
    }

    // Create JWT token
    let token: string;
    try {
      const authUser = createAuthUserFromUser(user);
      token = await generateToken(authUser, TOKEN_EXPIRY);
    } catch (error) {
      console.error("Token generation error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to generate authentication token",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Return success response
    const authUser = createAuthUserFromUser(user);
    const response: ApiResponse<LoginResponse> = {
      success: true,
      data: {
        user: authUser,
        token,
        expiresIn: TOKEN_EXPIRY,
      },
      timestamp: new Date().toISOString(),
    };

    // Set HttpOnly cookie so middleware/server can read token securely
    const cookieVal =
      `authToken=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_EXPIRY}` +
      (process.env.NODE_ENV === "production" ? "; Secure" : "");

    return NextResponse.json(response, {
      status: 200,
      headers: { "Set-Cookie": cookieVal },
    });
  } catch (error) {
    console.error("Login error:", error);
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
