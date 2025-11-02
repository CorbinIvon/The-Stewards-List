/**
 * Chats API endpoints
 * Handles GET (list chats) and POST (create chat message) operations
 * Supports pagination, filtering by queryKey and optional taskId
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
  CreateChatRequest,
  ApiResponse,
  PaginatedResponse,
  AuthUser,
  UserRole,
} from "@/lib/types";

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const DEFAULT_PAGE_SIZE = 50;
const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH = 1;
const MAX_QUERY_KEY_LENGTH = 100;
const MIN_QUERY_KEY_LENGTH = 1;

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
 * Check if user can access chat in a given queryKey and optional taskId
 * Authorization rules:
 * - Admins/Managers can access all
 * - If taskId provided: Must have access to the task (owner or assigned)
 * - If no taskId: Can view if user is participant (has sent message)
 */
async function canAccessChat(
  userId: string,
  queryKey: string,
  taskId: string | null,
  userRole: UserRole
): Promise<boolean> {
  // Admins and managers can access everything
  if (isAdminOrManager(userRole)) {
    return true;
  }

  // If attached to task, check task access
  if (taskId) {
    const task = await prisma.task.findFirst({
      where: {
        id: taskId,
        isDeleted: false,
        OR: [
          { ownerId: userId },
          { assignments: { some: { userId } } },
        ],
      },
    });
    return task !== null;
  }

  // For standalone chats, check if user is a participant
  // User is participant if they have sent any message in this queryKey
  const participation = await prisma.chat.findFirst({
    where: {
      queryKey,
      userId,
      isDeleted: false,
    },
  });

  return participation !== null;
}

/**
 * Validate queryKey parameter
 */
function validateQueryKey(queryKey: unknown): { valid: boolean; error?: string } {
  if (!queryKey || typeof queryKey !== "string") {
    return { valid: false, error: "queryKey is required and must be a string" };
  }

  const trimmed = queryKey.trim();
  if (trimmed.length < MIN_QUERY_KEY_LENGTH) {
    return { valid: false, error: `queryKey must be at least ${MIN_QUERY_KEY_LENGTH} character` };
  }

  if (trimmed.length > MAX_QUERY_KEY_LENGTH) {
    return { valid: false, error: `queryKey must not exceed ${MAX_QUERY_KEY_LENGTH} characters` };
  }

  return { valid: true };
}

/**
 * Validate message parameter
 */
function validateMessage(message: unknown): { valid: boolean; error?: string } {
  if (!message || typeof message !== "string") {
    return { valid: false, error: "message is required and must be a string" };
  }

  const trimmed = message.trim();
  if (trimmed.length < MIN_MESSAGE_LENGTH) {
    return { valid: false, error: `message must be at least ${MIN_MESSAGE_LENGTH} character` };
  }

  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    return { valid: false, error: `message must not exceed ${MAX_MESSAGE_LENGTH} characters` };
  }

  return { valid: true };
}

/**
 * Validate taskId if provided
 */
async function validateTaskId(taskId: string | undefined): Promise<{ valid: boolean; error?: string }> {
  if (!taskId) {
    return { valid: true };
  }

  if (typeof taskId !== "string") {
    return { valid: false, error: "taskId must be a string" };
  }

  // Check if task exists and is not deleted
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      isDeleted: false,
    },
  });

  if (!task) {
    return { valid: false, error: "Task not found or has been deleted" };
  }

  return { valid: true };
}

/**
 * Validate quoteChatId if provided
 */
async function validateQuoteChatId(quoteChatId: string | undefined): Promise<{ valid: boolean; error?: string }> {
  if (!quoteChatId) {
    return { valid: true };
  }

  if (typeof quoteChatId !== "string") {
    return { valid: false, error: "quoteChatId must be a string" };
  }

  // Check if quoted chat exists (can be deleted, we still want to reference it)
  const chat = await prisma.chat.findUnique({
    where: { id: quoteChatId },
  });

  if (!chat) {
    return { valid: false, error: "Quoted message not found" };
  }

  return { valid: true };
}

/**
 * Parse and validate pagination parameters
 */
function parsePaginationParams(request: NextRequest): {
  page: number;
  pageSize: number;
  error?: string;
} {
  const searchParams = request.nextUrl.searchParams;
  const pageStr = searchParams.get("page");
  const pageSizeStr = searchParams.get("pageSize");

  let page = 1;
  let pageSize = DEFAULT_PAGE_SIZE;

  if (pageStr) {
    const parsed = parseInt(pageStr, 10);
    if (isNaN(parsed) || parsed < 1) {
      return { page: 1, pageSize: DEFAULT_PAGE_SIZE, error: "page must be a positive integer" };
    }
    page = parsed;
  }

  if (pageSizeStr) {
    const parsed = parseInt(pageSizeStr, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 100) {
      return { page, pageSize: DEFAULT_PAGE_SIZE, error: "pageSize must be between 1 and 100" };
    }
    pageSize = parsed;
  }

  return { page, pageSize };
}

// ============================================================================
// GET /api/chats
// ============================================================================

/**
 * GET /api/chats
 * Fetch paginated chat messages with filtering by queryKey and optional taskId
 *
 * Query parameters:
 * - queryKey (required): Conversation/channel identifier (1-100 chars)
 * - taskId (optional): Filter to task-specific chats
 * - page (optional): Page number for pagination (default: 1)
 * - pageSize (optional): Messages per page (default: 50, max: 100)
 *
 * Returns: PaginatedResponse<Chat>
 * Status codes:
 * - 200: Success
 * - 400: Invalid parameters
 * - 401: Not authenticated
 * - 403: Access denied
 * - 500: Server error
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract and verify authentication
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          details: "Valid authentication token required",
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const queryKey = searchParams.get("queryKey");
    const taskId = searchParams.get("taskId");

    // Validate queryKey (required)
    const queryKeyValidation = validateQueryKey(queryKey);
    if (!queryKeyValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: queryKeyValidation.error,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Parse pagination parameters
    const paginationResult = parsePaginationParams(request);
    if (paginationResult.error) {
      return NextResponse.json(
        {
          success: false,
          error: paginationResult.error,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const { page, pageSize } = paginationResult;

    // Check authorization to access this chat conversation
    const hasAccess = await canAccessChat(
      user.id,
      queryKey!,
      taskId,
      user.role as UserRole
    );

    if (!hasAccess) {
      return NextResponse.json(
        {
          success: false,
          error: "Access denied",
          details: "You do not have permission to view this conversation",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Build query filter
    const where: any = {
      queryKey: queryKey!,
      isDeleted: false,
    };

    if (taskId) {
      where.taskId = taskId;
    }

    // Fetch total count for pagination
    const total = await prisma.chat.count({ where });
    const totalPages = Math.ceil(total / pageSize);

    // Fetch paginated messages
    const skip = (page - 1) * pageSize;
    const chats = await prisma.chat.findMany({
      where,
      include: CHAT_INCLUDE,
      orderBy: {
        createdAt: "asc",
      },
      skip,
      take: pageSize,
    });

    // Format response with pagination metadata
    const response: PaginatedResponse<Chat> = {
      success: true,
      data: chats as any,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1,
      },
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error fetching chats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: "Failed to fetch chat messages",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST /api/chats
// ============================================================================

/**
 * POST /api/chats
 * Create a new chat message
 *
 * Request body:
 * {
 *   queryKey: string (1-100 chars, required)
 *   message: string (1-2000 chars, required)
 *   taskId?: string (optional, must be valid task if provided)
 *   quoteChatId?: string (optional, must be valid chat if provided)
 * }
 *
 * Authorization:
 * - If taskId provided: User must have access to the task
 * - If no taskId: Any authenticated user can create (standalone conversation)
 *
 * Returns: ApiResponse<Chat>
 * Status codes:
 * - 201: Message created
 * - 400: Validation error
 * - 401: Not authenticated
 * - 403: Access denied
 * - 500: Server error
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Extract and verify authentication
    const user = extractUser(request);
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
          details: "Valid authentication token required",
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
    const { queryKey, message, taskId, quoteChatId } = data;

    // Validate queryKey
    const queryKeyValidation = validateQueryKey(queryKey);
    if (!queryKeyValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: queryKeyValidation.error,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

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

    // Validate taskId if provided
    const taskIdValidation = await validateTaskId(taskId as string | undefined);
    if (!taskIdValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: taskIdValidation.error,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Validate quoteChatId if provided
    const quoteChatIdValidation = await validateQuoteChatId(quoteChatId as string | undefined);
    if (!quoteChatIdValidation.valid) {
      return NextResponse.json(
        {
          success: false,
          error: quoteChatIdValidation.error,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Authorization: If taskId provided, check user has access to task
    if (taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId as string,
          isDeleted: false,
          OR: [
            { ownerId: user.id },
            { assignments: { some: { userId: user.id } } },
          ],
        },
      });

      if (!task) {
        return NextResponse.json(
          {
            success: false,
            error: "Access denied",
            details: "You do not have permission to chat on this task",
            timestamp: new Date().toISOString(),
          },
          { status: 403 }
        );
      }
    }

    // Create the chat message
    try {
      const chat = await prisma.chat.create({
        data: {
          queryKey: queryKey as string,
          message: (message as string).trim(),
          userId: user.id,
          taskId: (taskId as string) || null,
          quoteChatId: (quoteChatId as string) || null,
        },
        include: CHAT_INCLUDE,
      });

      const response: ApiResponse<Chat> = {
        success: true,
        data: chat as any,
        timestamp: new Date().toISOString(),
      };

      return NextResponse.json(response, { status: 201 });
    } catch (error: any) {
      console.error("Error creating chat:", error);

      // Handle foreign key constraint errors
      if (error.code === "P2003") {
        return NextResponse.json(
          {
            success: false,
            error: "Invalid reference",
            details: "Referenced task or quoted message not found",
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        {
          success: false,
          error: "Failed to create chat message",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error in POST /api/chats:", error);
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
