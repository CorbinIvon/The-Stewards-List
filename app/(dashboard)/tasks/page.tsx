"use client";

/**
 * Tasks Page Component
 * Displays all tasks with filtering, searching, and creation capabilities
 * Features:
 * - Fetches tasks from API with pagination
 * - Filters by status, priority, and assignee
 * - Search functionality for title/description
 * - Create task button (Admin/Manager only)
 * - Responsive grid/list layout
 * - Loading and error states
 * - Empty state handling
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type {
  TaskWithOwner,
  TaskStatus,
  TaskPriority,
  UserRole,
} from "@/lib/types";
import {
  TaskStatus as TaskStatusEnum,
  TaskPriority as TaskPriorityEnum,
  UserRole as UserRoleEnum,
} from "@/lib/types";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import Alert from "@/components/ui/Alert";
import { formatDate, truncateAtWord, toTitleCase } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface TaskFilters {
  status: TaskStatus | "";
  priority: TaskPriority | "";
  search: string;
}

interface TasksPageState {
  tasks: TaskWithOwner[];
  isLoading: boolean;
  error: string | null;
  filters: TaskFilters;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get badge variant for task status
 */
function getStatusBadgeVariant(
  status: TaskStatus
): "default" | "success" | "warning" | "danger" | "info" {
  switch (status) {
    case TaskStatusEnum.COMPLETED:
      return "success";
    case TaskStatusEnum.IN_PROGRESS:
      return "info";
    case TaskStatusEnum.CANCELLED:
      return "danger";
    case TaskStatusEnum.TODO:
    default:
      return "warning";
  }
}

/**
 * Get badge variant for task priority
 */
function getPriorityBadgeVariant(
  priority: TaskPriority
): "default" | "success" | "warning" | "danger" | "info" {
  switch (priority) {
    case TaskPriorityEnum.URGENT:
      return "danger";
    case TaskPriorityEnum.HIGH:
      return "warning";
    case TaskPriorityEnum.MEDIUM:
      return "info";
    case TaskPriorityEnum.LOW:
    default:
      return "default";
  }
}

/**
 * Check if user has permission to create tasks
 */
function canCreateTask(userRole: UserRole | undefined): boolean {
  return userRole === UserRoleEnum.ADMIN || userRole === UserRoleEnum.MANAGER;
}

// ============================================================================
// TASK CARD COMPONENT
// ============================================================================

interface TaskCardProps {
  task: TaskWithOwner;
  onClick?: () => void;
}

/**
 * Individual task card component
 */
function TaskCard({ task, onClick }: TaskCardProps): React.ReactElement {
  return (
    <div
      className="cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <Card className="hover:shadow-md transition-shadow">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate">{task.title}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                by{" "}
                {task.owner.displayName ||
                  task.owner.username ||
                  task.owner.email}
              </p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <Badge variant={getStatusBadgeVariant(task.status)} size="sm">
                {toTitleCase(task.status.toLowerCase())}
              </Badge>
              <Badge variant={getPriorityBadgeVariant(task.priority)} size="sm">
                {toTitleCase(task.priority.toLowerCase())}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardBody>
          {task.description && (
            <p className="text-sm text-gray-600 mb-3">
              {truncateAtWord(task.description, 100)}
            </p>
          )}

          <div className="flex items-center justify-between text-xs text-gray-500">
            {task.dueDate ? (
              <span>Due: {formatDate(task.dueDate)}</span>
            ) : (
              <span>No due date</span>
            )}

            {task.completedAt && (
              <span>Completed: {formatDate(task.completedAt)}</span>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ============================================================================
// FILTER COMPONENT
// ============================================================================

interface TaskFiltersProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
}

/**
 * Task filter controls component
 */
function TaskFilters({
  filters,
  onFiltersChange,
}: TaskFiltersProps): React.ReactElement {
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFiltersChange({
        ...filters,
        search: e.target.value,
      });
    },
    [filters, onFiltersChange]
  );

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({
        ...filters,
        status: e.target.value as TaskStatus | "",
      });
    },
    [filters, onFiltersChange]
  );

  const handlePriorityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFiltersChange({
        ...filters,
        priority: e.target.value as TaskPriority | "",
      });
    },
    [filters, onFiltersChange]
  );

  const handleResetFilters = useCallback(() => {
    onFiltersChange({
      status: "",
      priority: "",
      search: "",
    });
  }, [onFiltersChange]);

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Input
            label="Search"
            placeholder="Search by title or description..."
            value={filters.search}
            onChange={handleSearchChange}
          />

          <Select
            label="Status"
            placeholder="All statuses"
            value={filters.status}
            onChange={handleStatusChange}
            options={[
              { value: TaskStatusEnum.TODO, label: "To Do" },
              { value: TaskStatusEnum.IN_PROGRESS, label: "In Progress" },
              { value: TaskStatusEnum.COMPLETED, label: "Completed" },
              { value: TaskStatusEnum.CANCELLED, label: "Cancelled" },
            ]}
          />

          <Select
            label="Priority"
            placeholder="All priorities"
            value={filters.priority}
            onChange={handlePriorityChange}
            options={[
              { value: TaskPriorityEnum.LOW, label: "Low" },
              { value: TaskPriorityEnum.MEDIUM, label: "Medium" },
              { value: TaskPriorityEnum.HIGH, label: "High" },
              { value: TaskPriorityEnum.URGENT, label: "Urgent" },
            ]}
          />

          <div className="flex items-end">
            <Button
              variant="secondary"
              size="md"
              onClick={handleResetFilters}
              className="w-full"
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

/**
 * Tasks page component
 * Displays all tasks with filtering and management capabilities
 */
export default function TasksPage(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();

  const [state, setState] = useState<TasksPageState>({
    tasks: [],
    isLoading: true,
    error: null,
    filters: {
      status: "",
      priority: "",
      search: "",
    },
  });

  // ========================================================================
  // FETCH TASKS
  // ========================================================================

  const fetchTasks = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await apiClient.getTasks({
        page: 1,
        pageSize: 100,
      });

      setState((prev) => ({
        ...prev,
        tasks: response.data,
        isLoading: false,
      }));
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to load tasks";

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  // Load tasks on mount
  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ========================================================================
  // FILTER AND SEARCH
  // ========================================================================

  const filteredTasks = useMemo(() => {
    return state.tasks.filter((task) => {
      // Status filter
      if (state.filters.status && task.status !== state.filters.status) {
        return false;
      }

      // Priority filter
      if (state.filters.priority && task.priority !== state.filters.priority) {
        return false;
      }

      // Search filter (title + description)
      if (state.filters.search) {
        const searchLower = state.filters.search.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(searchLower);
        const matchesDescription = task.description
          ?.toLowerCase()
          .includes(searchLower);

        if (!matchesTitle && !matchesDescription) {
          return false;
        }
      }

      return true;
    });
  }, [state.tasks, state.filters]);

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleFiltersChange = useCallback((filters: TaskFilters) => {
    setState((prev) => ({ ...prev, filters }));
  }, []);

  const handleCreateTask = useCallback(() => {
    router.push("/tasks/new");
  }, [router]);

  const handleTaskClick = useCallback(
    (taskId: string) => {
      router.push(`/tasks/${taskId}`);
    },
    [router]
  );

  const handleRetry = useCallback(() => {
    fetchTasks();
  }, [fetchTasks]);

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-600 mt-1">
            Manage and organize your household tasks
          </p>
        </div>

        {canCreateTask(user?.role) && (
          <Button variant="primary" size="lg" onClick={handleCreateTask}>
            Create Task
          </Button>
        )}
      </div>

      {/* Error Alert */}
      {state.error && (
        <Alert variant="error" className="mb-6" title="Error">
          {state.error}
          <button
            onClick={handleRetry}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </Alert>
      )}

      {/* Filters */}
      <TaskFilters
        filters={state.filters}
        onFiltersChange={handleFiltersChange}
      />

      {/* Loading State */}
      {state.isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" color="primary" />
            <p className="text-gray-600 text-sm font-medium">
              Loading tasks...
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!state.isLoading && filteredTasks.length === 0 && (
        <Card className="text-center py-12">
          <CardBody>
            <div className="flex flex-col items-center gap-4">
              <div className="text-5xl">📋</div>
              <h3 className="text-lg font-semibold text-white">
                {state.tasks.length === 0
                  ? "No tasks yet"
                  : "No tasks match your filters"}
              </h3>
              <p className="text-gray-600 max-w-md">
                {state.tasks.length === 0
                  ? "Get started by creating your first task to organize your household."
                  : "Try adjusting your filters to find the tasks you're looking for."}
              </p>

              {state.tasks.length === 0 && canCreateTask(user?.role) && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCreateTask}
                  className="mt-2"
                >
                  Create First Task
                </Button>
              )}

              {state.tasks.length > 0 && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() =>
                    handleFiltersChange({
                      status: "",
                      priority: "",
                      search: "",
                    })
                  }
                  className="mt-2"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Tasks Grid */}
      {!state.isLoading && filteredTasks.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => handleTaskClick(task.id)}
            />
          ))}
        </div>
      )}

      {/* Results Count */}
      {!state.isLoading && filteredTasks.length > 0 && (
        <div className="mt-8 text-center text-sm text-gray-600">
          Showing {filteredTasks.length} of {state.tasks.length} tasks
        </div>
      )}
    </div>
  );
}
