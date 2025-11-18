/**
 * Universal Chat API Endpoints
 * Handles chat messages across any resource (tasks, projects, etc.)
 * Uses associativeKey to organize messages by context
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/middleware/auth";
import { validateRequest } from "@/lib/validation";
import { z } from "zod";
import type {
  ApiResponse,
  PaginatedResponse,
  UniversalChatWithRelations,
  CreateUniversalChatRequest,
} from "@/lib/types";

// ============================================================================
// VALIDATION
// ============================================================================

const associativeKeySchema = z
  .string()
  .min(3, "Associative key must be at least 3 characters")
  .max(500, "Associative key must be no more than 500 characters")
  .regex(/^[a-zA-Z0-9/_-]+$/, "Associative key can only contain alphanumeric characters, slashes, hyphens, and underscores");

const createChatSchema = z.object({
  associativeKey: associativeKeySchema,
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(5000, "Message must be no more than 5000 characters"),
  isSystem: z.boolean().optional().default(false),
});

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

// ============================================================================
// GET - Fetch messages by associative key with pagination
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    // Extract query parameters
    const searchParams = request.nextUrl.searchParams;
    const associativeKey = searchParams.get("associativeKey");
    const page = Math.max(1, parseInt(searchParams.get("page") || String(DEFAULT_PAGE)));
    const pageSize = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, parseInt(searchParams.get("pageSize") || String(DEFAULT_PAGE_SIZE)))
    );

    // Validate associative key
    if (!associativeKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter",
          details: "associativeKey query parameter is required",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    const keyValidation = associativeKeySchema.safeParse(associativeKey);
    if (!keyValidation.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid associative key",
          details: keyValidation.error.issues[0]?.message || "Invalid format",
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }

    // Calculate pagination
    const skip = (page - 1) * pageSize;

    // Fetch messages and total count
    const [messages, totalItems] = await Promise.all([
      prisma.universalChat.findMany({
        where: {
          associativeKey: keyValidation.data,
          isDeleted: false,
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
        orderBy: { createdAt: "asc" },
        skip,
        take: pageSize,
      }),
      prisma.universalChat.count({
        where: {
          associativeKey: keyValidation.data,
          isDeleted: false,
        },
      }),
    ]);

    const totalPages = Math.ceil(totalItems / pageSize);

    return NextResponse.json(
      {
        success: true,
        data: messages as UniversalChatWithRelations[],
        pagination: {
          page,
          pageSize,
          total: totalItems,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
        timestamp: new Date().toISOString(),
      } as PaginatedResponse<UniversalChatWithRelations>,
      { status: 200 }
    );
  } catch (error) {
    console.error("Error fetching universal chats:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch messages",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST - Create new message
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { user } = auth;

    // Parse and validate request body
    let body: CreateUniversalChatRequest;
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
    const validation = validateRequest(body, createChatSchema);
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

    // System messages can only be created internally
    if (validation.data.isSystem) {
      return NextResponse.json(
        {
          success: false,
          error: "Forbidden",
          details: "System messages can only be created by the server",
          timestamp: new Date().toISOString(),
        },
        { status: 403 }
      );
    }

    // Create message with authenticated user's ID (not from client)
    const newMessage = await prisma.universalChat.create({
      data: {
        posterId: user.id,
        associativeKey: validation.data.associativeKey,
        message: validation.data.message.trim(),
        isSystem: false,
        isEdited: false,
        isDeleted: false,
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
        data: newMessage as UniversalChatWithRelations,
        timestamp: new Date().toISOString(),
      } as ApiResponse<UniversalChatWithRelations>,
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating universal chat:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create message",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
