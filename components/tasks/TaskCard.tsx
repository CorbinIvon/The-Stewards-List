"use client";

import Link from "next/link";
import { Task, TaskStatus, TaskPriority, TaskAssignmentWithRelations } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { cn, truncateAtWord } from "@/lib/utils";

/**
 * Props for TaskCard component
 */
export interface TaskCardProps {
  /** The task object to display */
  task: Task;
  /** Optional task assignment with user information */
  assignment?: TaskAssignmentWithRelations;
  /** Optional click handler for the card */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Calculates relative time until or since a due date
 * Returns strings like "Due in 2 days", "Overdue by 1 day", "Due today", etc.
 *
 * @param dueDate - The due date to calculate relative time for
 * @returns Object with status ("due", "overdue", "today") and formatted string
 */
function calculateRelativeTime(
  dueDate: Date | string | null
): { status: "due" | "overdue" | "today"; text: string } {
  if (!dueDate) {
    return { status: "due", text: "No due date" };
  }

  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const now = new Date();

  // Normalize to midnight for date comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());

  const diffTime = dueDay.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return { status: "today", text: "Due today" };
  } else if (diffDays === 1) {
    return { status: "due", text: "Due tomorrow" };
  } else if (diffDays > 1) {
    return { status: "due", text: `Due in ${diffDays} days` };
  } else if (diffDays === -1) {
    return { status: "overdue", text: "Overdue by 1 day" };
  } else {
    return { status: "overdue", text: `Overdue by ${Math.abs(diffDays)} days` };
  }
}

/**
 * Maps TaskStatus to Badge variant
 */
function getStatusBadgeVariant(
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
 * Maps TaskPriority to Badge variant
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
 * Formats status text for display
 */
function formatStatusText(status: TaskStatus): string {
  return status
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Formats priority text for display
 */
function formatPriorityText(priority: TaskPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase();
}

/**
 * Generates initials from a name
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

/**
 * TaskCard - Reusable component for displaying task summary in card format
 *
 * Features:
 * - Displays task title, description (truncated), status, and priority
 * - Shows assignee avatar/initials if available
 * - Displays relative due date with overdue indicator
 * - Red border for overdue tasks
 * - Hover effects and responsive design
 * - Clickable link to task detail page
 *
 * @param props - TaskCardProps
 * @returns JSX element
 */
export default function TaskCard({
  task,
  assignment,
  onClick,
  className,
}: TaskCardProps): React.ReactElement {
  const isOverdue =
    task.status !== TaskStatus.COMPLETED &&
    task.dueDate &&
    new Date(task.dueDate) < new Date();

  const relativeTime = calculateRelativeTime(task.dueDate);
  const statusVariant = getStatusBadgeVariant(task.status);
  const priorityVariant = getPriorityBadgeVariant(task.priority);

  const cardContent = (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        isOverdue && "border-red-300 border-2",
        className
      )}
    >
      <CardBody className="p-4">
        {/* Header with badges */}
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <Badge variant={statusVariant} size="sm">
              {formatStatusText(task.status)}
            </Badge>
            <Badge variant={priorityVariant} size="sm">
              {formatPriorityText(task.priority)}
            </Badge>
            {isOverdue && (
              <Badge variant="danger" size="sm">
                Overdue
              </Badge>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-base font-semibold text-gray-300 line-clamp-2">
          {task.title}
        </h3>

        {/* Description */}
        {task.description && (
          <p className="mb-3 text-sm text-gray-600 line-clamp-2">
            {truncateAtWord(task.description, 100)}
          </p>
        )}

        {/* Footer with due date and assignee */}
        <div className="flex items-center justify-between border-t border-gray-200 pt-3">
          {/* Due date */}
          <div className="flex items-center">
            <span
              className={cn(
                "text-xs font-medium",
                relativeTime.status === "overdue"
                  ? "text-red-600"
                  : relativeTime.status === "today"
                    ? "text-orange-600"
                    : "text-gray-600"
              )}
            >
              {relativeTime.text}
            </span>
          </div>

          {/* Assignee avatar/initials */}
          {assignment?.user && (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700"
              title={assignment.user.displayName || assignment.user.username}
            >
              {getInitials(
                assignment.user.displayName || assignment.user.username
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );

  // Wrap in Link if we want to navigate
  return (
    <Link
      href={`/tasks/${task.id}`}
      className="block"
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {cardContent}
    </Link>
  );
}
