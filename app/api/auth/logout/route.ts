import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/types";

/**
 * POST /api/auth/logout
 * Logout endpoint (stateless - JWT is invalidated client-side)
 * Returns success confirmation
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // JWT tokens are stateless, so logout is primarily handled client-side
    // by removing the token from storage. This endpoint simply provides
    // confirmation and allows for future server-side token blacklisting.

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: {
        message: "Logged out successfully",
      },
      timestamp: new Date().toISOString(),
    };

    // Clear the auth cookie
    const clearCookie =
      `authToken=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT` +
      (process.env.NODE_ENV === "production" ? "; Secure" : "");

    return NextResponse.json(response, {
      status: 200,
      headers: { "Set-Cookie": clearCookie },
    });
  } catch (error) {
    console.error("Logout error:", error);
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
