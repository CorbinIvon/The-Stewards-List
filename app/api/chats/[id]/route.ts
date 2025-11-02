/**
 * Individual chat message API endpoints
 * Handles GET (retrieve), PATCH (edit), and DELETE (soft delete) operations for chat messages
 * Includes comprehensive authorization, validation, and error handling
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getUserFromAuthHeader,
  getUserFromCookie,
} from "@/lib/auth";
import type {
  Chat,
  ApiResponse,
  AuthUser,
  UserRole,
} from "@/lib/types";

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 1;

/**
 * Chat include fragment for consistent data retrieval
 */
const CHAT_INCLUDE = {
  user: {
    select: {
      id: true,
      username: true,
      displayName: true,
    },
  },
  quotedChat: {
    select: {
      id: true,
      message: true,
      userId: true,
      isDeleted: true,
      user: {
        select: {
          username: true,
          displayName: true,
        },
      },
    },
  },
  task: {
    select: {
      id: true,
      title: true,
    },
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Extract authenticated user from request
 * Checks both Authorization header and cookies
 */
function extractUser(request: NextRequest): AuthUser | null {
  // Try Authorization header first
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const user = getUserFromAuthHeader(authHeader);
    if (user) return user;
  }

  // Fall back to cookies
  const cookieHeader = request.headers.get("Cookie");
  if (cookieHeader) {
    const user = getUserFromCookie(cookieHeader);
    if (user) return user;
  }

  return null;
}

/**
 * Check if user has admin or manager role
 */
function isAdminOrManager(userRole: UserRole): boolean {
  return userRole === "ADMIN" || userRole === "MANAGER";
}

/**
 * Check if user can access a chat message
 * Authorization rules:
 * - Admins can access all messages
 * - For task-attached chats: User must be task owner or assigned
 * - For standalone chats: User must be a participant in the conversation
 */
async function canAccessChat(
  userId: string,
  chat: { queryKey: string; taskId: string | null; userId: string },
  userRole: UserRole
): Promise<boolean> {
  // Admins and managers can access all
  if (isAdminOrManager(userRole)) {
    return true;
  }

  // If attached to task, check task access
  if (chat.taskId) {
    const task = await prisma.task.findFirst({
      where: {
        id: chat.taskId,
        isDeleted: false,
        OR: [
          { ownerId: userId },
          { assignments: { some: { userId } } },
        ],
      },
    });
    return task !== null;
  }

  // For standalone chats, check if user is participant
  const participation = await prisma.chat.findFirst({
    where: {
      queryKey: chat.queryKey,
      userId,
      isDeleted: false,
    },
  });

  return participation !== null;
}

/**
 * Check if user can modify (edit) a chat message
 * Only message author or admins can edit
 */
function canModifyChat(
  userId: string,
  chat: { userId: string },
  userRole: UserRole
): boolean {
  // Admins can modify any message
  if (userRole === "ADMIN") return true;

  // Authors can modify their own messages
  return chat.userId === userId;
}

/**
 * Check if user can delete a chat message
 * Only message author or admins can delete
 */
function canDeleteChat(
  userId: string,
  chat: { userId: string },
  userRole: UserRole
): boolean {
  // Admins can delete any message
  if (userRole === "ADMIN") return true;

  // Authors can delete their own messages
  return chat.userId === userId;
}

/**
 * Validate message parameter
 */
function validateMessage(message: unknown): { valid: boolean; error?: string } {
  if (!message || typeof message !== "string") {
    return { valid: false, error: "message field is required" };
  }

  const trimmed = message.trim();
  if (trimmed.length < MIN_MESSAGE_LENGTH) {
    return { valid: false, error: `Message must be at least ${MIN_MESSAGE_LENGTH} character` };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `Message must not exceed ${MAX_MESSAGE_LENGTH} characters` };
  }

  return { valid: true };
}

// ============================================================================
// GET /api/chats/:id
// ============================================================================

/**
 * GET /api/chats/:id
 * Retrieve a single chat message by ID
 *
 * Authorization:
 * - Admins/Managers can access all messages
 * - For task-attached chats: User must be task owner or assigned
 * - For standalone chats: User must be a participant
 *
 * Response behavior:
 * - Deleted messages show "[deleted]" as message text
 * - Includes user data and quoted message data
 *
 * Returns: ApiResponse<Chat>
 * Status codes:
 * - 200: Success
 * - 401: Not authenticated
 * - 403: Access denied
 * - 404: Chat message not found
 * - 500: Server error
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Extract and verify authentication
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Fetch chat message with related data
    const chat = await prisma.chat.findUnique({
      where: { id: id },
      include: CHAT_INCLUDE,
    });

    if (!chat) {
      return NextResponse.json(
        {
          success: false,
          error: "Chat message not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check authorization
    const canAccess = await canAccessChat(
      user.id,
      {
        queryKey: chat.queryKey,
        taskId: chat.taskId,
        userId: chat.userId,
      },
      user.role as UserRole
    );

    if (!canAccess) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Handle deleted messages - show indicator
    const responseData = chat.isDeleted
      ? { ...chat, message: "[deleted]" }
      : chat;

    const response: ApiResponse<Chat> = {
      success: true,
      data: responseData as any,
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error fetching chat message:", error);
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

// ============================================================================
// PATCH /api/chats/:id
// ============================================================================

/**
 * PATCH /api/chats/:id
 * Edit a chat message
 *
 * Request body:
 * {
 *   message: string (1-2000 chars, required)
 * }
 *
 * Authorization:
 * - Message author can edit their own messages
 * - Admins can edit any message
 *
 * Behavior:
 * - Updates message text
 * - Sets isEdited flag to true
 * - Updates updatedAt timestamp
 * - Cannot edit already deleted messages
 *
 * Returns: ApiResponse<Chat>
 * Status codes:
 * - 200: Success
 * - 400: Validation error or attempting to edit deleted message
 * - 401: Not authenticated
 * - 403: Insufficient permissions
 * - 404: Chat message not found
 * - 500: Server error
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Extract and verify authentication
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

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

    // Validate body is an object
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

    const data = body as Record<string, unknown>;
    const { message } = data;

    // Validate message
    const messageValidation = validateMessage(message);
    if (!messageValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: messageValidation.error,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const trimmedMessage = (message as string).trim();

    // Fetch chat to check if it exists and is not deleted
    const chat = await prisma.chat.findUnique({
      where: { id: id },
      select: { id: true, userId: true, isDeleted: true },
    });

    if (!chat) {
      return NextResponse.json(
        {
          success: false,
          error: "Chat message not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check if message is already deleted
    if (chat.isDeleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Cannot edit deleted message",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check authorization
    if (!canModifyChat(user.id, chat, user.role as UserRole)) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Update message
    try {
      const updated = await prisma.chat.update({
        where: { id: id },
        data: {
          message: trimmedMessage,
          isEdited: true,
          updatedAt: new Date(),
        },
        include: CHAT_INCLUDE,
      });

      const response: ApiResponse<Chat> = {
        success: true,
        data: updated as any,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 200 });
    } catch (error: any) {
      console.error("Error updating chat message:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to update chat message",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in PATCH /api/chats/:id:", error);
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

// ============================================================================
// DELETE /api/chats/:id
// ============================================================================

/**
 * DELETE /api/chats/:id
 * Soft delete a chat message
 *
 * Authorization:
 * - Message author can delete their own messages
 * - Admins can delete any message
 *
 * Behavior:
 * - Sets isDeleted flag to true
 * - Sets deletedAt timestamp to current time
 * - Does not remove message from database (soft delete)
 *
 * Returns: ApiResponse<{ message: string }>
 * Status codes:
 * - 200: Success
 * - 401: Not authenticated
 * - 403: Insufficient permissions
 * - 404: Chat message not found
 * - 500: Server error
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    // Extract and verify authentication
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Authentication required",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Fetch chat to check if it exists
    const chat = await prisma.chat.findUnique({
      where: { id: id },
      select: { id: true, userId: true, isDeleted: true },
    });

    if (!chat) {
      return NextResponse.json(
        {
          success: false,
          error: "Chat message not found",
          timestamp: new Date().toISOString(),
        },
        { status: 404 }
      );
    }

    // Check if already deleted
    if (chat.isDeleted) {
      return NextResponse.json(
        {
          success: false,
          error: "Message already deleted",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Check authorization
    if (!canDeleteChat(user.id, chat, user.role as UserRole)) {
      return NextResponse.json(
        {
          success: false,
          error: "Insufficient permissions",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Soft delete message
    try {
      await prisma.chat.update({
        where: { id: id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });

      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: "Chat message deleted successfully" },
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 200 });
    } catch (error: any) {
      console.error("Error deleting chat message:", error);
      return NextResponse.json(
        {
          success: false,
          error: "Failed to delete chat message",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in DELETE /api/chats/:id:", error);
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
