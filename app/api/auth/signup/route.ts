import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  generateToken,
  createAuthUserFromUser,
  TOKEN_EXPIRY,
} from "@/lib/auth";
import type { SignupRequest, SignupResponse, ApiResponse } from "@/lib/types";
import { UserRole } from "@/lib/types";

/**
 * Validation rules
 */
const VALIDATION_RULES = {
  email: {
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    message: "Invalid email format",
  },
  username: {
    minLength: 3,
    maxLength: 20,
    pattern: /^[a-zA-Z0-9_-]+$/,
    message:
      "Username must be 3-20 characters and contain only letters, numbers, underscores, and dashes",
  },
  displayName: {
    minLength: 2,
    maxLength: 50,
    message: "Display name must be 2-50 characters",
  },
  password: {
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    message:
      "Password must be at least 8 characters and contain uppercase, lowercase, and numbers",
  },
};

/**
 * Validate signup request data
 */
function validateSignupRequest(
  data: unknown
): { valid: boolean; errors?: Record<string, string> } {
  const errors: Record<string, string> = {};

  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: { _general: "Invalid request body" } };
  }

  const req = data as Record<string, unknown>;

  // Validate email
  if (!req.email || typeof req.email !== "string") {
    errors.email = "Email is required";
  } else if (!VALIDATION_RULES.email.pattern.test(req.email)) {
    errors.email = VALIDATION_RULES.email.message;
  }

  // Validate username
  if (!req.username || typeof req.username !== "string") {
    errors.username = "Username is required";
  } else if (req.username.length < VALIDATION_RULES.username.minLength) {
    errors.username = `Username must be at least ${VALIDATION_RULES.username.minLength} characters`;
  } else if (req.username.length > VALIDATION_RULES.username.maxLength) {
    errors.username = `Username must be at most ${VALIDATION_RULES.username.maxLength} characters`;
  } else if (!VALIDATION_RULES.username.pattern.test(req.username)) {
    errors.username = VALIDATION_RULES.username.message;
  }

  // Validate displayName
  if (!req.displayName || typeof req.displayName !== "string") {
    errors.displayName = "Display name is required";
  } else if (req.displayName.length < VALIDATION_RULES.displayName.minLength) {
    errors.displayName = `Display name must be at least ${VALIDATION_RULES.displayName.minLength} characters`;
  } else if (
    req.displayName.length > VALIDATION_RULES.displayName.maxLength
  ) {
    errors.displayName = `Display name must be at most ${VALIDATION_RULES.displayName.maxLength} characters`;
  }

  // Validate password
  if (!req.password || typeof req.password !== "string") {
    errors.password = "Password is required";
  } else if (req.password.length < VALIDATION_RULES.password.minLength) {
    errors.password = `Password must be at least ${VALIDATION_RULES.password.minLength} characters`;
  } else if (!VALIDATION_RULES.password.pattern.test(req.password)) {
    errors.password = VALIDATION_RULES.password.message;
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : undefined,
  };
}

/**
 * POST /api/auth/signup
 * Create a new user account
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

    // Validate request data
    const validation = validateSignupRequest(body);
    if (!validation.valid) {
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

    const signupData = body as SignupRequest;
    const { email, username, displayName, password } = signupData;

    // Hash password
    let hashedPassword: string;
    try {
      hashedPassword = await hashPassword(password);
    } catch (error) {
      console.error("Password hashing error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to process signup",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Create user in database
    let user;
    try {
      user = await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          username: username.toLowerCase(),
          displayName,
          passwordHash: hashedPassword,
          role: UserRole.MEMBER,
          isActive: true,
        },
      });
    } catch (error: unknown) {
      // Check for Prisma unique constraint errors
      if (
        error instanceof Error &&
        "code" in error &&
        error.code === "P2002"
      ) {
        const prismaError = error as { meta?: { target?: string[] } };
        const target = prismaError.meta?.target?.[0];

        if (target === "email") {
          return NextResponse.json(
            {
              success: false,
              error: "An account with this email already exists",
              details: { email: "Email already in use" },
              timestamp: new Date().toISOString(),
            },
            { status: 409 }
          );
        } else if (target === "username") {
          return NextResponse.json(
            {
              success: false,
              error: "An account with this username already exists",
              details: { username: "Username already in use" },
              timestamp: new Date().toISOString(),
            },
            { status: 409 }
          );
        }
      }

      console.error("Database error creating user:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to create user account",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // Create JWT token
    let token: string;
    try {
      const authUser = createAuthUserFromUser(user);
      token = generateToken(authUser, TOKEN_EXPIRY);
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
    const response: ApiResponse<SignupResponse> = {
      success: true,
      data: {
        user: authUser,
        token,
        expiresIn: TOKEN_EXPIRY,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error("Signup error:", error);
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
