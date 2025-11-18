/**
 * Individual Universal Chat Message Endpoint
 * PUT - Edit message (owner only)
 * DELETE - Delete message (owner only)
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware/auth";
import { validateRequest } from "@/lib/validation";
import { z } from "zod";
import type {
  ApiResponse,
  UniversalChatWithRelations,
  UpdateUniversalChatRequest,
} from "@/lib/types";

// ============================================================================
// VALIDATION
// ============================================================================

const updateChatSchema = z.object({
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(5000, "Message must be no more than 5000 characters"),
});

// ============================================================================
// PUT - Update message (owner only)
// ============================================================================

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    // Get message ID from params
    const { id } = await params;

    // Fetch the message
    const message = await prisma.universalChat.findUnique({
      where: { id },
      include: {
        poster: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    // Check if message exists
    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "Not found",
          details: "Message not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check ownership (only poster can edit)
    if (message.posterId !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
          details: "You can only edit your own messages",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Check if message is deleted
    if (message.isDeleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Not found",
          details: "Message has been deleted",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Parse and validate request body
    let body: UpdateUniversalChatRequest;
    try {
      body = await request.json();
    } catch (error) {
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
    const validation = validateRequest(body, updateChatSchema);
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

    // Update message
    const updatedMessage = await prisma.universalChat.update({
      where: { id },
      data: {
        message: validation.data.message.trim(),
        isEdited: true,
        updatedAt: new Date(),
      },
      include: {
        poster: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: updatedMessage as UniversalChatWithRelations,
        timestamp: new Date().toISOString(),
      } as ApiResponse<UniversalChatWithRelations>,
      { status: 200 }
    );
  } catch (error) {
    console.error("Error updating universal chat:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to update message",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE - Soft delete message (owner only)
// ============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    // Get message ID from params
    const { id } = await params;

    // Fetch the message
    const message = await prisma.universalChat.findUnique({
      where: { id },
    });

    // Check if message exists
    if (!message) {
      return NextResponse.json(
        {
          success: false,
          error: "Not found",
          details: "Message not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check ownership (only poster can delete)
    if (message.posterId !== user.id) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
          details: "You can only delete your own messages",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Check if already deleted
    if (message.isDeleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Not found",
          details: "Message has already been deleted",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Soft delete message
    const deletedMessage = await prisma.universalChat.update({
      where: { id },
      data: {
        isDeleted: true,
        deletedAt: new Date(),
      },
      include: {
        poster: {
          select: {
            id: true,
            username: true,
            displayName: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: deletedMessage as UniversalChatWithRelations,
        timestamp: new Date().toISOString(),
      } as ApiResponse<UniversalChatWithRelations>,
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting universal chat:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to delete message",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
