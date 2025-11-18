/**
 * Chat helpers and utilities for creating system messages
 */

import { TaskStatus, TaskPriority, TaskFrequency } from "@/lib/types";

// ============================================================================
// SYSTEM MESSAGE FORMATTERS
// ============================================================================

/**
 * Generate a system message for when a task is created
 */
export function formatTaskCreatedMessage(title: string, creatorName: string): string {
  return `@${creatorName} created this task: "${title}"`;
}

/**
 * Generate a system message for task status changes
 */
export function formatStatusChangeMessage(
  oldStatus: TaskStatus,
  newStatus: TaskStatus,
  username: string
): string {
  const statusLabel = (status: TaskStatus): string => {
    switch (status) {
      case "TODO":
        return "To Do";
      case "IN_PROGRESS":
        return "In Progress";
      case "COMPLETED":
        return "Completed";
      case "CANCELLED":
        return "Cancelled";
      default:
        return status;
    }
  };

  return `@${username} changed status from **${statusLabel(oldStatus)}** to **${statusLabel(newStatus)}**`;
}

/**
 * Generate a system message for priority changes
 */
export function formatPriorityChangeMessage(
  oldPriority: TaskPriority,
  newPriority: TaskPriority,
  username: string
): string {
  return `@${username} changed priority from **${oldPriority}** to **${newPriority}**`;
}

/**
 * Generate a system message for title changes
 */
export function formatTitleChangeMessage(
  oldTitle: string,
  newTitle: string,
  username: string
): string {
  return `@${username} changed title from "${oldTitle}" to "${newTitle}"`;
}

/**
 * Generate a system message for description changes
 */
export function formatDescriptionChangeMessage(username: string): string {
  return `@${username} updated the description`;
}

/**
 * Generate a system message for due date changes
 */
export function formatDueDateChangeMessage(
  oldDate: Date | null,
  newDate: Date | null,
  username: string
): string {
  const formatDate = (date: Date | null): string => {
    if (!date) return "no due date";
    return new Date(date).toLocaleDateString();
  };

  return `@${username} changed due date from ${formatDate(oldDate)} to ${formatDate(newDate)}`;
}

/**
 * Generate a system message for frequency changes
 */
export function formatFrequencyChangeMessage(
  oldFrequency: TaskFrequency | null,
  newFrequency: TaskFrequency | null,
  username: string
): string {
  const formatFreq = (freq: TaskFrequency | null): string => {
    if (!freq) return "no recurrence";
    return freq.toLowerCase().replace(/_/g, " ");
  };

  return `@${username} changed recurrence from ${formatFreq(oldFrequency)} to ${formatFreq(newFrequency)}`;
}

/**
 * Generate a system message for user assignments
 */
export function formatAssignedMessage(assignedUserName: string, username: string): string {
  return `@${username} assigned this to @${assignedUserName}`;
}

/**
 * Generate a system message for user unassignments
 */
export function formatUnassignedMessage(
  unassignedUserName: string,
  username: string
): string {
  return `@${username} unassigned @${unassignedUserName}`;
}

/**
 * Generate a system message for project linking
 */
export function formatProjectLinkMessage(
  projectName: string,
  username: string
): string {
  return `@${username} linked this to project **${projectName}**`;
}

/**
 * Generate a system message for project unlinking
 */
export function formatProjectUnlinkMessage(projectName: string, username: string): string {
  return `@${username} unlinked this from project **${projectName}**`;
}
