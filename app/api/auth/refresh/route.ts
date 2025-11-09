/* eslint-disable no-console */
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyRefreshToken,
  generateToken,
  generateRefreshToken,
  hashRefreshToken,
  revokeRefreshToken,
  storeRefreshToken,
  TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from "@/lib/auth";
import type { ApiResponse } from "@/lib/types";

/**
 * Response type for token refresh endpoint
 */
interface RefreshTokenResponseData {
  user: {
    id: string;
    email: string;
    username: string;
    role: string;
    isActive: boolean;
    requiresPasswordReset?: boolean;
  };
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

/**
 * POST /api/auth/refresh
 * Refresh access and refresh tokens using a valid refresh token
 * Accepts refresh token from request body or authRefreshToken cookie
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse request body to extract refresh token or handle missing body
    let body: Record<string, unknown> = {};
    try {
      const rawBody = await request.text();
      if (rawBody) {
        body = JSON.parse(rawBody);
      }
    } catch (error) {
      // Body might be empty or invalid JSON - we'll check cookies instead
      console.debug("No valid JSON body for refresh request");
    }

    // ========================================================================
    // Step 1: Extract refresh token from body or cookie
    // ========================================================================
    let refreshToken: string | undefined;

    // Priority 1: From request body
    if (body.refreshToken && typeof body.refreshToken === "string") {
      refreshToken = body.refreshToken;
      console.debug("Refresh token extracted from request body");
    }

    // Priority 2: From cookie
    if (!refreshToken) {
      const cookieHeader = request.headers.get("cookie");
      if (cookieHeader) {
        const cookies = cookieHeader.split(";").map((c) => c.trim());
        for (const cookie of cookies) {
          if (cookie.startsWith("authRefreshToken=")) {
            refreshToken = cookie.substring(17);
            console.debug("Refresh token extracted from cookie");
            break;
          }
        }
      }
    }

    // Check if we have a refresh token
    if (!refreshToken) {
      console.warn("Refresh attempt failed: no refresh token provided");
      return NextResponse.json(
        {
          success: false,
          error: "Refresh token required",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // ========================================================================
    // Step 2: Verify refresh token
    // ========================================================================
    let authUser;
    try {
      authUser = await verifyRefreshToken(refreshToken);
      console.debug(`Refresh token verified for user: ${authUser.id}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.warn(`Refresh token verification failed: ${errorMessage}`);

      // Determine specific error response based on error message
      if (errorMessage.includes("revoked")) {
        return NextResponse.json(
          {
            success: false,
            error: "Refresh token has been revoked",
            timestamp: new Date().toISOString(),
          },
          { status: 401 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Refresh token invalid or expired",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // ========================================================================
    // Step 3: Verify user is still active
    // ========================================================================
    let user;
    try {
      user = await prisma.user.findUnique({
        where: { id: authUser.id },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          isActive: true,
          requiresPasswordReset: true,
          refreshTokens: {
            select: { token: true },
            where: { revokedAt: null },
          },
        },
      });
    } catch (error) {
      console.error("Database error fetching user:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to refresh token",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // User not found
    if (!user) {
      console.warn(`Refresh attempt for non-existent user: ${authUser.id}`);
      return NextResponse.json(
        {
          success: false,
          error: "Refresh token not found",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // User is inactive
    if (!user.isActive) {
      console.warn(`Refresh attempt for inactive user: ${user.id}`);
      return NextResponse.json(
        {
          success: false,
          error: "User account is not active",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // ========================================================================
    // Step 4: Generate new tokens
    // ========================================================================
    let newAccessToken: string;
    let newRefreshToken: string;
    let refreshTokenExpiresIn: number;

    try {
      newAccessToken = await generateToken(authUser, TOKEN_EXPIRY);
      const refreshTokenResult = await generateRefreshToken(authUser);
      newRefreshToken = refreshTokenResult.token;
      refreshTokenExpiresIn = refreshTokenResult.expiresIn;
      console.debug(`New tokens generated for user: ${user.id}`);
    } catch (error) {
      console.error("Token generation error:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to refresh token",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // ========================================================================
    // Step 5: Hash and store new refresh token in database
    // ========================================================================
    try {
      const newTokenHash = await hashRefreshToken(newRefreshToken);

      // Calculate expiration date (7 days from now)
      const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000);

      // Store new refresh token in database
      const stored = await storeRefreshToken(user.id, newTokenHash, expiresAt);

      if (!stored) {
        console.error("Failed to store refresh token in database");
        return NextResponse.json(
          {
            success: false,
            error: "Failed to refresh token",
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }

      console.debug(`New refresh token stored for user: ${user.id}`);
    } catch (error) {
      console.error("Database error storing refresh token:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to refresh token",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    // ========================================================================
    // Step 6: Revoke old refresh token (token rotation for security)
    // ========================================================================
    try {
      const oldTokenHash = await hashRefreshToken(refreshToken);
      const revoked = await revokeRefreshToken(oldTokenHash);
      if (revoked) {
        console.debug(`Old refresh token revoked for user: ${user.id}`);
      } else {
        console.debug(
          `Old refresh token not found for revocation (already revoked or expired)`
        );
      }
    } catch (error) {
      // Log warning but don't fail the refresh - token rotation is a security
      // enhancement but shouldn't block legitimate refreshes
      console.warn(`Failed to revoke old refresh token: ${error}`);
    }

    // ========================================================================
    // Step 7: Build response
    // ========================================================================
    const responseData: RefreshTokenResponseData = {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        role: user.role,
        isActive: user.isActive,
        requiresPasswordReset: user.requiresPasswordReset || false,
      },
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: TOKEN_EXPIRY,
      refreshExpiresIn: refreshTokenExpiresIn,
    };

    const response: ApiResponse<RefreshTokenResponseData> = {
      success: true,
      data: responseData,
      timestamp: new Date().toISOString(),
    };

    // ========================================================================
    // Step 8: Set response cookies
    // ========================================================================
    const isProduction = process.env.NODE_ENV === "production";
    const secureSuffix = isProduction ? "; Secure" : "";

    const accessTokenCookie = `authToken=${newAccessToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${TOKEN_EXPIRY}${secureSuffix}`;
    const refreshTokenCookie = `authRefreshToken=${newRefreshToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${REFRESH_TOKEN_EXPIRY}${secureSuffix}`;

    // Use array for multiple Set-Cookie headers
    const responseInit: ResponseInit = {
      status: 200,
      headers: {
        "Set-Cookie": [accessTokenCookie, refreshTokenCookie],
      } as unknown as HeadersInit,
    };

    console.error(`Token refresh successful for user: ${user.id}`);
    return NextResponse.json(response, responseInit);
  } catch (error) {
    console.error("Refresh token endpoint error:", error);
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
