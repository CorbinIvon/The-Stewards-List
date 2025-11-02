"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Button,
  Spinner,
  Badge,
} from "@/components/ui";
import Alert from "@/components/ui/Alert";
import { useAuthUser } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { TaskWithOwner, TaskStatus } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

interface DashboardStats {
  totalTasks: number;
  tasksAssignedToMe: number;
  completedTasks: number;
  overdueTasks: number;
}

interface DashboardState {
  stats: DashboardStats;
  recentTasks: TaskWithOwner[];
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate dashboard statistics from tasks
 */
function calculateStats(
  tasks: TaskWithOwner[],
  currentUserId: string | undefined
): DashboardStats {
  const now = new Date();

  const stats: DashboardStats = {
    totalTasks: tasks.length,
    tasksAssignedToMe: 0,
    completedTasks: 0,
    overdueTasks: 0,
  };

  tasks.forEach((task) => {
    // Check if task is assigned to current user
    // Note: This assumes task assignments are tracked elsewhere
    // For now, we count tasks owned by the user
    if (task.ownerId === currentUserId) {
      stats.tasksAssignedToMe++;
    }

    // Count completed tasks
    if (task.status === "COMPLETED") {
      stats.completedTasks++;
    }

    // Count overdue tasks (not completed and due date passed)
    if (
      task.status !== "COMPLETED" &&
      task.dueDate &&
      new Date(task.dueDate) < now
    ) {
      stats.overdueTasks++;
    }
  });

  return stats;
}

/**
 * Get badge variant based on task status
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
      return "warning";
  }
}

/**
 * Format date for display
 */
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function DashboardPage(): React.ReactElement {
  const currentUser = useAuthUser();
  const [state, setState] = useState<DashboardState>({
    stats: {
      totalTasks: 0,
      tasksAssignedToMe: 0,
      completedTasks: 0,
      overdueTasks: 0,
    },
    recentTasks: [],
    isLoading: true,
    error: null,
  });

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  useEffect(() => {
    const fetchDashboardData = async (): Promise<void> => {
      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        // Fetch tasks from API
        const tasksResponse = await apiClient.getTasks({ pageSize: 100 });
        const allTasks = tasksResponse.data;

        // Calculate stats
        const stats = calculateStats(allTasks, currentUser?.id);

        // Get most recent tasks (5-10 most recent)
        const recentTasks = allTasks
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
          )
          .slice(0, 8);

        setState((prev) => ({
          ...prev,
          stats,
          recentTasks,
          isLoading: false,
        }));
      } catch (err) {
        const errorMessage =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to load dashboard data";

        console.error("Dashboard error:", err);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
      }
    };

    if (currentUser?.id) {
      fetchDashboardData();
    }
  }, [currentUser?.id]);

  // =========================================================================
  // RENDERING
  // =========================================================================

  if (state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-8">
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
            WELCOME SECTION
            =================================================================== */}

        <Card>
          <CardHeader>
            <CardTitle>
              Welcome back, {currentUser?.username || "User"}!
            </CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-gray-600">
              {currentUser?.email && (
                <>
                  Logged in as <span className="font-medium">{currentUser.email}</span>
                </>
              )}
            </p>
          </CardBody>
        </Card>

        {/* ===================================================================
            STATISTICS SECTION
            =================================================================== */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Tasks */}
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-600">
                  Total Tasks
                </h4>
                <span className="text-2xl font-bold text-blue-600">
                  {state.stats.totalTasks}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                All tasks in the system
              </p>
            </CardBody>
          </Card>

          {/* Tasks Assigned to Me */}
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-600">
                  Assigned to Me
                </h4>
                <span className="text-2xl font-bold text-purple-600">
                  {state.stats.tasksAssignedToMe}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Tasks owned by you
              </p>
            </CardBody>
          </Card>

          {/* Completed Tasks */}
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-600">
                  Completed
                </h4>
                <span className="text-2xl font-bold text-green-600">
                  {state.stats.completedTasks}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Finished tasks
              </p>
            </CardBody>
          </Card>

          {/* Overdue Tasks */}
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-600">
                  Overdue
                </h4>
                <span className="text-2xl font-bold text-red-600">
                  {state.stats.overdueTasks}
                </span>
              </div>
              <p className="text-xs text-gray-500">
                Tasks past due date
              </p>
            </CardBody>
          </Card>
        </div>

        {/* ===================================================================
            QUICK ACTIONS SECTION
            =================================================================== */}

        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardBody>
            <Link href="/tasks/new">
              <Button>Create New Task</Button>
            </Link>
          </CardBody>
        </Card>

        {/* ===================================================================
            RECENT TASKS SECTION
            =================================================================== */}

        <Card>
          <CardHeader>
            <CardTitle>Recent Tasks</CardTitle>
          </CardHeader>
          <CardBody>
            {state.recentTasks.length === 0 ? (
              <p className="text-center text-gray-500 py-8">
                No tasks yet. Create your first task to get started!
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Task Title
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Status
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Priority
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Due Date
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-700">
                        Owner
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.recentTasks.map((task) => (
                      <tr
                        key={task.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <Link
                            href={`/tasks/${task.id}`}
                            className="hover:text-blue-600 hover:underline"
                          >
                            {task.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={getStatusBadgeVariant(task.status)}
                            size="sm"
                          >
                            {task.status}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge
                            variant={
                              task.priority === "URGENT"
                                ? "danger"
                                : task.priority === "HIGH"
                                  ? "warning"
                                  : "info"
                            }
                            size="sm"
                          >
                            {task.priority}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {task.dueDate
                            ? formatDate(task.dueDate)
                            : "No due date"}
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {task.owner?.username || "Unknown"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
