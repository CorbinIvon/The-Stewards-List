import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";
import {
  hashRefreshToken,
  revokeRefreshToken,
  getTokenFromRequest,
} from "@/lib/auth";

/**
 * POST /api/auth/logout
 * Logout endpoint with server-side token revocation
 * Revokes refresh token and clears authentication cookies
 * Idempotent - always succeeds, even if already logged out
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  let dbError: Error | null = null;

  try {
    // Extract refresh token from request (cookies, body, or header)
    const { refreshToken } = await getTokenFromRequest(request);

    // Attempt to revoke the refresh token if provided
    if (refreshToken) {
      try {
        const tokenHash = await hashRefreshToken(refreshToken);
        const revoked = await revokeRefreshToken(tokenHash);

        if (revoked) {
          console.error("Refresh token revoked successfully");
        } else {
          console.error("Refresh token not found in database (already revoked or never stored)");
        }
      } catch (error) {
        // Log the error but continue with logout
        // This ensures graceful degradation if the database is temporarily unavailable
        dbError = error instanceof Error ? error : new Error(String(error));
        console.error("Failed to revoke refresh token:", dbError);
      }
    }

    // Build response
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: {
        message: "Logged out successfully",
      },
      timestamp: new Date().toISOString(),
    };

    // Create Set-Cookie headers to clear both auth cookies
    const baseCookieAttrs = "; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
    const secureAttr = process.env.NODE_ENV === "production" ? "; Secure" : "";

    const clearAccessTokenCookie = `authToken=${baseCookieAttrs}${secureAttr}`;
    const clearRefreshTokenCookie = `authRefreshToken=${baseCookieAttrs}${secureAttr}`;

    // Use array for multiple Set-Cookie headers
    const responseInit: ResponseInit = {
      status: 200,
      headers: {
        "Set-Cookie": [clearAccessTokenCookie, clearRefreshTokenCookie],
      } as unknown as HeadersInit,
    };

    return NextResponse.json(response, responseInit);
  } catch (error) {
    console.error("Logout error:", error);

    // Still clear cookies even if there's an error
    const baseCookieAttrs = "; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
    const secureAttr = process.env.NODE_ENV === "production" ? "; Secure" : "";

    const clearAccessTokenCookie = `authToken=${baseCookieAttrs}${secureAttr}`;
    const clearRefreshTokenCookie = `authRefreshToken=${baseCookieAttrs}${secureAttr}`;

    const responseInit: ResponseInit = {
      status: 200,
      headers: {
        "Set-Cookie": [clearAccessTokenCookie, clearRefreshTokenCookie],
      } as unknown as HeadersInit,
    };

    return NextResponse.json(
      {
        success: true,
        data: {
          message: "Logged out successfully",
        },
        timestamp: new Date().toISOString(),
      },
      responseInit
    );
  }
}
