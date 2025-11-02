"use client";

import React from "react";
import { TaskPriority } from "@/lib/types";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

/**
 * Props for TaskPriorityBadge component
 */
export interface TaskPriorityBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** The priority level to display */
  priority: TaskPriority;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Maps TaskPriority enum to Badge variant
 * - LOW: success (green)
 * - MEDIUM: default (gray)
 * - HIGH: warning (yellow/orange)
 * - URGENT: danger (red)
 *
 * @param priority - TaskPriority enum value
 * @returns Badge variant string
 */
function getPriorityBadgeVariant(
  priority: TaskPriority
): "default" | "success" | "warning" | "danger" | "info" {
  switch (priority) {
    case TaskPriority.LOW:
      return "success";
    case TaskPriority.MEDIUM:
      return "default";
    case TaskPriority.HIGH:
      return "warning";
    case TaskPriority.URGENT:
      return "danger";
    default:
      return "default";
  }
}

/**
 * Converts TaskPriority enum value to human-readable label
 * - LOW -> "Low"
 * - MEDIUM -> "Medium"
 * - HIGH -> "High"
 * - URGENT -> "Urgent"
 *
 * @param priority - TaskPriority enum value
 * @returns Human-readable priority label
 */
function formatPriorityLabel(priority: TaskPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
}

/**
 * TaskPriorityBadge - Component for displaying task priority as a colored badge
 *
 * Features:
 * - Color-coded priority levels (green for low, gray for medium, yellow for high, red for urgent)
 * - Human-readable labels
 * - Customizable styling via className prop
 * - Semantic HTML with proper accessibility
 * - Reusable across task lists, cards, and detail views
 *
 * @param props - TaskPriorityBadgeProps
 * @returns JSX element rendering a Badge component
 *
 * @example
 * ```tsx
 * import { TaskPriorityBadge } from "@/components/tasks/TaskPriorityBadge";
 * import { TaskPriority } from "@/lib/types";
 *
 * export function MyComponent() {
 *   return (
 *     <TaskPriorityBadge
 *       priority={TaskPriority.HIGH}
 *       className="ml-2"
 *     />
 *   );
 * }
 * ```
 */
const TaskPriorityBadge = React.forwardRef<
  HTMLSpanElement,
  TaskPriorityBadgeProps
>(({ priority, className, ...props }, ref) => {
  const variant = getPriorityBadgeVariant(priority);
  const label = formatPriorityLabel(priority);

  return (
    <Badge
      ref={ref}
      variant={variant}
      size="sm"
      className={className}
      {...props}
    >
      {label}
    </Badge>
  );
});

TaskPriorityBadge.displayName = "TaskPriorityBadge";

export default TaskPriorityBadge;
