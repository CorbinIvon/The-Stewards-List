import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/middleware/auth";
import { hashPassword } from "@/lib/auth";
import type { ApiResponse, UserRole } from "@/lib/types";
import { UserRole as UserRoleEnum } from "@/lib/types";

// Helper to generate a random temporary password
function generateTempPassword(length = 12): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()-_=+";
  let result = "";
  const bytes = require("crypto").randomBytes(length);
  for (let i = 0; i < length; i++) {
    // eslint-disable-next-line security/detect-object-injection
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * POST /api/users/:id/reset-password
 * Admin-only: generate a temporary password, update user's password hash,
 * and mark account as requiring a password reset on next login.
 */
export async function POST(request: NextRequest, { params }: { params: any }) {
  try {
    // Require admin
    const auth = await requireRole(request, [UserRoleEnum.ADMIN as UserRole]);
    if (auth instanceof NextResponse) return auth;

    // `params` may be a Promise in some Next.js runtimes — await it before use
    const resolvedParams = await params;
    const id = resolvedParams?.id;
    if (!id) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing user id",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { id } });
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

    const tempPassword = generateTempPassword(12);
    const tempHash = await hashPassword(tempPassword);

    // Try to update both password and requiresPasswordReset flag.
    // If the Prisma client / DB schema isn't updated yet, fallback to updating only the passwordHash.
    try {
      await prisma.user.update({
        where: { id },
        data: { passwordHash: tempHash, requiresPasswordReset: true } as any,
      });
    } catch (prismaErr) {
      // PrismaClientValidationError typically means the generated client
      // doesn't know about the `requiresPasswordReset` field yet. Log a
      // concise warning instead of printing the full error stack to reduce noise.
      const name = (prismaErr as any)?.name;
      const message = (prismaErr as any)?.message || String(prismaErr);
      if (name === "PrismaClientValidationError") {
        console.warn(
          "Prisma client validation error while setting requiresPasswordReset:",
          message
        );
      } else {
        console.error(
          "Prisma update error when setting requiresPasswordReset:",
          message
        );
      }
      try {
        await prisma.user.update({
          where: { id },
          data: { passwordHash: tempHash } as any,
        });
        const response: ApiResponse<{
          tempPassword: string;
          warning?: string;
        }> = {
          success: true,
          data: {
            tempPassword,
            warning:
              "Temporary password set, but could not set requiresPasswordReset flag. Please run the Prisma migration and regenerate the client to enable forced-password-reset behavior.",
          },
          timestamp: new Date().toISOString(),
        };
        return NextResponse.json(response, { status: 200 });
      } catch (innerErr) {
        console.error(
          "Fallback password update failed:",
          (innerErr as any)?.message || String(innerErr)
        );
        return NextResponse.json(
          {
            success: false,
            error: "Failed to update user password",
            timestamp: new Date().toISOString(),
          },
          { status: 500 }
        );
      }
    }

    // Return the temporary password to the admin caller
    const response: ApiResponse<{ tempPassword: string }> = {
      success: true,
      data: { tempPassword },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to reset password",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
