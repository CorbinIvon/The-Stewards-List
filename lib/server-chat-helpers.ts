/**
 * Server-side chat helpers
 * Functions to create system messages in the database
 * Only called from server-side code (API routes, etc.)
 */

import { prisma } from "@/lib/prisma";

// ============================================================================
// SYSTEM MESSAGE CREATION
// ============================================================================

/**
 * Create a system message in the database
 * This function should only be called from server-side code
 * The posterId should be the ID of a system user or admin user
 */
export async function createSystemMessage(
  posterId: string,
  associativeKey: string,
  message: string
): Promise<void> {
  try {
    await prisma.universalChat.create({
      data: {
        posterId,
        associativeKey,
        message,
        isSystem: true,
        isEdited: false,
        isDeleted: false,
      },
    });
  } catch (error) {
    console.error("Error creating system message:", error);
    // Don't throw - system messages are nice-to-have but shouldn't break the operation
  }
}

/**
 * Create a system message for a task update
 */
export async function createTaskUpdateMessage(
  posterId: string,
  taskId: string,
  message: string
): Promise<void> {
  return createSystemMessage(posterId, `tasks/${taskId}`, message);
}

/**
 * Create a system message for a project update
 */
export async function createProjectUpdateMessage(
  posterId: string,
  projectId: string,
  message: string
): Promise<void> {
  return createSystemMessage(posterId, `projects/${projectId}`, message);
}
