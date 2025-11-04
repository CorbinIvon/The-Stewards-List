import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/middleware/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid JSON",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { newPassword } = body || {};
    if (
      !newPassword ||
      typeof newPassword !== "string" ||
      newPassword.length < 8
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid new password (minimum 8 characters)",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const hashed = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashed, requiresPasswordReset: false } as any,
    });

    return NextResponse.json(
      {
        success: true,
        data: { message: "Password updated" },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error completing password reset:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update password",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
