"use client";

import { TaskStatus } from "@/lib/types";
import Badge from "@/components/ui/Badge";

/**
 * Props for TaskStatusBadge component
 */
export interface TaskStatusBadgeProps {
  /** The task status to display */
  status: TaskStatus;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Maps TaskStatus enum value to Badge variant for consistent styling
 *
 * @param status - The task status to map
 * @returns Badge variant appropriate for the status
 */
function getStatusVariant(
  status: TaskStatus
): "default" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case TaskStatus.COMPLETED:
      return "success";
    case TaskStatus.IN_PROGRESS:
      return "info";
    case TaskStatus.CANCELLED:
      return "default";
    case TaskStatus.TODO:
    default:
      return "warning";
  }
}

/**
 * Maps TaskStatus enum value to human-readable label
 *
 * @param status - The task status to format
 * @returns Human-readable status label
 */
function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case TaskStatus.TODO:
      return "To Do";
    case TaskStatus.IN_PROGRESS:
      return "In Progress";
    case TaskStatus.COMPLETED:
      return "Completed";
    case TaskStatus.CANCELLED:
      return "Cancelled";
    default:
      return status;
  }
}

/**
 * TaskStatusBadge - Displays task status as a colored badge
 *
 * Features:
 * - Colored badges for different task statuses
 * - Human-readable status labels
 * - Consistent styling with the Badge component
 * - Support for additional custom styles via className prop
 * - Color mapping:
 *   - TODO: warning (yellow)
 *   - IN_PROGRESS: info (blue)
 *   - COMPLETED: success (green)
 *   - CANCELLED: default (gray)
 *
 * @param props - TaskStatusBadgeProps
 * @returns JSX element
 */
export default function TaskStatusBadge({
  status,
  className,
}: TaskStatusBadgeProps): React.ReactElement {
  const variant = getStatusVariant(status);
  const label = getStatusLabel(status);

  return (
    <Badge variant={variant} size="sm" className={className}>
      {label}
    </Badge>
  );
}
