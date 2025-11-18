"use client";

/**
 * Task Detail View Page
 * Displays comprehensive task information with edit, delete, and status action buttons
 * Includes permission checks, loading states, error handling, and 404 handling
 * Features breadcrumb navigation, task history, and chat comments
 */

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardFooter,
  Button,
  Badge,
  Spinner,
} from "@/components/ui";
import Alert from "@/components/ui/Alert";
import { UniversalChat } from "@/components/universal";
import { useAuthUser } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import {
  formatDate,
  formatDateTime,
  toTitleCase,
  truncateAtWord,
} from "@/lib/utils";
import { TaskStatus as TaskStatusEnum, TaskLogAction as TaskLogActionEnum } from "@/lib/types";
import type {
  Task,
  TaskWithOwner,
  TaskStatus,
  UserRole,
  TaskLogAction,
  CreateTaskLogRequest,
} from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

interface TaskDetailState {
  task: TaskWithOwner | null;
  isLoading: boolean;
  error: string | null;
  isDeleting: boolean;
  isUpdatingStatus: boolean;
  showDeleteConfirm: boolean;
}

interface PermissionState {
  canEdit: boolean;
  canDelete: boolean;
  canUpdateStatus: boolean;
  canView: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determine if user has permission to perform actions on task
 */
function checkPermissions(
  task: TaskWithOwner | null,
  currentUser: ReturnType<typeof useAuthUser>
): PermissionState {
  if (!task || !currentUser) {
    return {
      canEdit: false,
      canDelete: false,
      canUpdateStatus: false,
      canView: false,
    };
  }

  // Admins and Managers have full permissions
  const isAdminOrManager =
    currentUser.role === "ADMIN" || currentUser.role === "MANAGER";

  // Owners and assignees can edit
  const isOwner = task.ownerId === currentUser.id;

  return {
    canView: isOwner || isAdminOrManager,
    canEdit: isOwner || isAdminOrManager,
    canDelete: isAdminOrManager,
    canUpdateStatus: isOwner || isAdminOrManager,
  };
}

/**
 * Get appropriate badge variant for task status
 */
function getStatusBadgeVariant(
  status: TaskStatus
): "success" | "warning" | "danger" | "info" | "default" {
  switch (status) {
    case "COMPLETED":
      return "success";
    case "IN_PROGRESS":
      return "info";
    case "CANCELLED":
      return "danger";
    case "TODO":
    default:
      return "default";
  }
}

/**
 * Get appropriate badge variant for task priority
 */
function getPriorityBadgeVariant(
  priority: string
): "success" | "warning" | "danger" | "info" | "default" {
  switch (priority.toUpperCase()) {
    case "URGENT":
      return "danger";
    case "HIGH":
      return "warning";
    case "MEDIUM":
      return "info";
    case "LOW":
    default:
      return "default";
  }
}

/**
 * Get next status transition based on current status
 */
function getNextStatus(currentStatus: TaskStatus): TaskStatus | null {
  switch (currentStatus) {
    case TaskStatusEnum.TODO:
      return TaskStatusEnum.IN_PROGRESS;
    case TaskStatusEnum.IN_PROGRESS:
      return TaskStatusEnum.COMPLETED;
    case TaskStatusEnum.COMPLETED:
      return TaskStatusEnum.TODO;
    case TaskStatusEnum.CANCELLED:
      return TaskStatusEnum.TODO;
    default:
      return null;
  }
}

/**
 * Get human-readable status label
 */
function getStatusLabel(status: TaskStatus): string {
  return toTitleCase(status.replace(/_/g, " "));
}

/**
 * Get human-readable priority label
 */
function getPriorityLabel(priority: string): string {
  return toTitleCase(priority.replace(/_/g, " "));
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TaskDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const currentUser = useAuthUser();
  const taskId = params?.id as string;

  const [state, setState] = useState<TaskDetailState>({
    task: null,
    isLoading: true,
    error: null,
    isDeleting: false,
    isUpdatingStatus: false,
    showDeleteConfirm: false,
  });

  const permissions = checkPermissions(state.task, currentUser);

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  /**
   * Fetch task details from API
   */
  useEffect(() => {
    const fetchTask = async (): Promise<void> => {
      if (!taskId) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Invalid task ID",
        }));
        return;
      }

      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        const task = await apiClient.getTask(taskId);
        setState((prev) => ({
          ...prev,
          task,
          isLoading: false,
        }));
      } catch (err) {
        const errorMessage =
          err instanceof ApiClientError
            ? err.status === 404
              ? "Task not found"
              : err.message
            : err instanceof Error
              ? err.message
              : "Failed to load task";

        console.error("Task fetch error:", err);

        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          task: null,
        }));
      }
    };

    fetchTask();
  }, [taskId]);

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  /**
   * Handle task deletion
   */
  const handleDelete = async (): Promise<void> => {
    if (!state.task) return;

    try {
      setState((prev) => ({
        ...prev,
        isDeleting: true,
      }));

      await apiClient.deleteTask(state.task.id);

      // Redirect to tasks list after deletion
      router.push("/tasks");
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete task";

      console.error("Delete error:", err);

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isDeleting: false,
        showDeleteConfirm: false,
      }));
    }
  };

  /**
   * Handle status transition
   */
  const handleStatusChange = async (): Promise<void> => {
    if (!state.task) return;

    const nextStatus = getNextStatus(state.task.status);
    if (!nextStatus) return;

    try {
      setState((prev) => ({
        ...prev,
        isUpdatingStatus: true,
        error: null,
      }));

      const updatedTask = await apiClient.updateTask(state.task.id, {
        status: nextStatus,
      });

      // Create task log entry
      const action: TaskLogAction =
        nextStatus === TaskStatusEnum.COMPLETED ? TaskLogActionEnum.COMPLETED : TaskLogActionEnum.UPDATED;
      await apiClient.createTaskLog(state.task.id, {
        action,
        note:
          nextStatus === TaskStatusEnum.COMPLETED
            ? "Task completed"
            : `Status changed to ${nextStatus}`,
      });

      setState((prev) => ({
        ...prev,
        task: { ...prev.task, ...updatedTask } as TaskWithOwner,
        isUpdatingStatus: false,
      }));
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update task status";

      console.error("Status update error:", err);

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isUpdatingStatus: false,
      }));
    }
  };

  // =========================================================================
  // RENDER: LOADING STATE
  // =========================================================================

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-gray-600">Loading task details...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: ERROR / NOT FOUND STATE
  // =========================================================================

  if (!state.task || state.error) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-600 flex gap-2">
          <Link href="/dashboard" className="hover:text-blue-600">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/tasks" className="hover:text-blue-600">
            Tasks
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Not Found</span>
        </div>

        {/* Error Alert */}
        <Alert variant="error" title="Error">
          {state.error || "Task not found. The task you are looking for does not exist or you do not have permission to view it."}
        </Alert>

        {/* Back Button */}
        <Link href="/tasks">
          <Button variant="secondary">Back to Tasks</Button>
        </Link>
      </div>
    );
  }

  // =========================================================================
  // RENDER: PERMISSION DENIED STATE
  // =========================================================================

  if (!permissions.canView) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-600 flex gap-2">
          <Link href="/dashboard" className="hover:text-blue-600">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/tasks" className="hover:text-blue-600">
            Tasks
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">Access Denied</span>
        </div>

        {/* Permission Denied Alert */}
        <Alert variant="error" title="Access Denied">
          You do not have permission to view this task. Only the task owner, assigned users, or administrators can view this task.
        </Alert>

        {/* Back Button */}
        <Link href="/tasks">
          <Button variant="secondary">Back to Tasks</Button>
        </Link>
      </div>
    );
  }

  // =========================================================================
  // RENDER: SUCCESS STATE
  // =========================================================================

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ===================================================================
          BREADCRUMB NAVIGATION
          =================================================================== */}

      <nav className="text-sm text-gray-600 flex gap-2">
        <Link href="/dashboard" className="hover:text-blue-600 transition">
          Dashboard
        </Link>
        <span>/</span>
        <Link href="/tasks" className="hover:text-blue-600 transition">
          Tasks
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">
          {truncateAtWord(state.task.title, 50)}
        </span>
      </nav>

      {/* ===================================================================
          ERROR ALERT
          =================================================================== */}

      {state.error && (
        <Alert
          variant="error"
          title="Error"
          onDismiss={() =>
            setState((prev) => ({
              ...prev,
              error: null,
            }))
          }
        >
          {state.error}
        </Alert>
      )}

      {/* ===================================================================
          DELETE CONFIRMATION DIALOG
          =================================================================== */}

      {state.showDeleteConfirm && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Delete Task</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to delete this task? This action cannot be
              undone.
            </p>
            <div className="flex gap-3">
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={state.isDeleting}
                loading={state.isDeleting}
              >
                Delete Task
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    showDeleteConfirm: false,
                  }))
                }
                disabled={state.isDeleting}
              >
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ===================================================================
          TASK HEADER - GITHUB ISSUE STYLE
          =================================================================== */}

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Title and ID */}
          <div className="mb-4">
            <h1 className="text-4xl font-bold text-white mb-2 break-words">{state.task.title}</h1>
            <p className="text-slate-400">#{state.task.id.slice(0, 8)}</p>
          </div>

          {/* Status and Priority Badges */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Badge variant={getStatusBadgeVariant(state.task.status)}>
              {getStatusLabel(state.task.status)}
            </Badge>
            <Badge variant={getPriorityBadgeVariant(state.task.priority)}>
              {getPriorityLabel(state.task.priority)}
            </Badge>
            {state.task.frequency && state.task.frequency !== "ONCE" && (
              <Badge variant="info">
                {toTitleCase(state.task.frequency.replace(/_/g, " "))}
              </Badge>
            )}
          </div>

          {/* Description */}
          {state.task.description && (
            <Card className="mb-6">
              <CardBody className="prose prose-sm max-w-none">
                <p className="text-slate-100 whitespace-pre-wrap leading-relaxed">
                  {state.task.description}
                </p>
              </CardBody>
            </Card>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 mb-6">
            {permissions.canUpdateStatus && (
              <Button
                variant="primary"
                onClick={handleStatusChange}
                disabled={state.isUpdatingStatus || !getNextStatus(state.task.status)}
                loading={state.isUpdatingStatus}
              >
                {state.task.status === "COMPLETED"
                  ? "Reopen"
                  : state.task.status === "TODO"
                    ? "Start Progress"
                    : "Mark Complete"}
              </Button>
            )}
            {permissions.canEdit && (
              <Link href={`/tasks/${state.task.id}/edit`}>
                <Button variant="secondary">Edit</Button>
              </Link>
            )}
            {permissions.canDelete && (
              <Button
                variant="danger"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    showDeleteConfirm: true,
                  }))
                }
                disabled={state.isDeleting || state.isUpdatingStatus}
              >
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Sidebar - Metadata */}
        <div className="w-full lg:w-72 flex-shrink-0">
          {/* Details Panel */}
          <Card className="sticky top-6">
            <CardBody className="space-y-4 text-sm">
              {/* Owner */}
              <div className="pb-4 border-b border-slate-700">
                <p className="text-slate-400 font-medium mb-2">Owner</p>
                <p className="text-slate-100 font-medium">
                  {state.task.owner?.username || "Unknown"}
                </p>
                {state.task.owner?.email && (
                  <p className="text-slate-400 text-xs">{state.task.owner.email}</p>
                )}
              </div>

              {/* Project */}
              <div className="pb-4 border-b border-slate-700">
                <p className="text-slate-400 font-medium mb-2">Project</p>
                {state.task.projectId ? (
                  <Link
                    href={`/projects/${state.task.projectId}`}
                    className="text-blue-400 hover:text-blue-300 transition font-medium"
                  >
                    {state.task.project?.projectName || "Unknown Project"}
                  </Link>
                ) : (
                  <p className="text-slate-400">No project assigned</p>
                )}
              </div>

              {/* Due Date */}
              <div className="pb-4 border-b border-slate-700">
                <p className="text-slate-400 font-medium mb-2">Due Date</p>
                {state.task.dueDate ? (
                  <p className="text-slate-100">{formatDate(state.task.dueDate)}</p>
                ) : (
                  <p className="text-slate-400">No due date</p>
                )}
              </div>

              {/* Created */}
              <div className="pb-4 border-b border-slate-700">
                <p className="text-slate-400 font-medium mb-2">Created</p>
                <p className="text-slate-100">{formatDateTime(state.task.createdAt)}</p>
              </div>

              {/* Updated */}
              <div className="pb-4 border-b border-slate-700">
                <p className="text-slate-400 font-medium mb-2">Updated</p>
                <p className="text-slate-100">{formatDateTime(state.task.updatedAt)}</p>
              </div>

              {/* Completed */}
              {state.task.completedAt && (
                <div className="pb-4 border-b border-slate-700">
                  <p className="text-slate-400 font-medium mb-2">Completed</p>
                  <p className="text-slate-100">{formatDateTime(state.task.completedAt)}</p>
                </div>
              )}

              {/* Task ID */}
              <div>
                <p className="text-slate-400 font-medium mb-2">ID</p>
                <code className="bg-slate-800 px-2 py-1 rounded text-xs text-slate-300 break-all">
                  {state.task.id}
                </code>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* ===================================================================
          ACTIVITY & CHAT SECTION
          =================================================================== */}

      {/* Chat/Comments */}
      <UniversalChat
        associativeKey={`tasks/${state.task.id}`}
        className="lg:col-span-2"
      />
    </div>
  );
}
