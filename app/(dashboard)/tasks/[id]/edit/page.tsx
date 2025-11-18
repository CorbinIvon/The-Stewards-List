"use client";

/**
 * Edit Task Page
 * Allows users to edit an existing task
 * Located at: /dashboard/tasks/[id]/edit
 *
 * Features:
 * - Fetch and display existing task data
 * - Permission checks (owner, assignee, Admin, Manager can edit)
 * - Form validation and error handling
 * - Success toast notification after update
 * - Redirect to task detail page after successful edit
 * - Loading states for initial fetch and submission
 * - Breadcrumb navigation
 * - 404 handling for invalid task IDs
 * - 403 handling for permission denied
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Button,
  Spinner,
} from "@/components/ui";
import Alert from "@/components/ui/Alert";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { TaskStatus, TaskPriority, TaskFrequency } from "@/lib/types";
import type {
  Task,
  TaskWithOwner,
  UserRole,
  UpdateTaskRequest,
  ProjectWithRelations,
} from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Form state interface
 */
interface FormState {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  frequency: TaskFrequency;
  dueDate: string;
  projectId: string | "";
}

/**
 * Form errors interface
 */
interface FormErrors {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  frequency?: string;
  dueDate?: string;
  projectId?: string;
}

/**
 * Page state interface
 */
interface PageState {
  task: TaskWithOwner | null;
  isLoadingTask: boolean;
  isSubmitting: boolean;
  isLoadingProjects: boolean;
  error: string | null;
  successMessage: string | null;
  notFound: boolean;
  permissionDenied: boolean;
  projects: ProjectWithRelations[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TASK_STATUS_OPTIONS: Array<{ value: TaskStatus; label: string }> = [
  { value: TaskStatus.TODO, label: "To Do" },
  { value: TaskStatus.IN_PROGRESS, label: "In Progress" },
  { value: TaskStatus.COMPLETED, label: "Completed" },
  { value: TaskStatus.CANCELLED, label: "Cancelled" },
];

const TASK_PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string }> = [
  { value: TaskPriority.LOW, label: "Low" },
  { value: TaskPriority.MEDIUM, label: "Medium" },
  { value: TaskPriority.HIGH, label: "High" },
  { value: TaskPriority.URGENT, label: "Urgent" },
];

const RECURRENCE_OPTIONS: Array<{ value: TaskFrequency; label: string }> = [
  { value: TaskFrequency.ONCE, label: "Once (No recurrence)" },
  { value: TaskFrequency.DAILY, label: "Daily" },
  { value: TaskFrequency.WEEKLY, label: "Weekly" },
  { value: TaskFrequency.BIWEEKLY, label: "Bi-weekly" },
  { value: TaskFrequency.MONTHLY, label: "Monthly" },
  { value: TaskFrequency.QUARTERLY, label: "Quarterly" },
  { value: TaskFrequency.YEARLY, label: "Yearly" },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if user has permission to edit the task
 */
function canEditTask(
  task: TaskWithOwner | null,
  userId: string | undefined,
  userRole: UserRole | undefined
): boolean {
  if (!task || !userId || !userRole) {
    return false;
  }

  // Admin and Manager can always edit
  if (userRole === "ADMIN" || userRole === "MANAGER") {
    return true;
  }

  // Owner can edit their own tasks
  if (task.ownerId === userId) {
    return true;
  }

  return false;
}

/**
 * Format date to ISO string for input[type="date"]
 */
function formatDateForInput(date: Date | string | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  return d.toISOString().split("T")[0];
}

/**
 * Validate form data
 */
function validateForm(formData: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!formData.title.trim()) {
    errors.title = "Title is required";
  } else if (formData.title.length > 255) {
    errors.title = "Title must be less than 255 characters";
  }

  if (formData.description.length > 2000) {
    errors.description = "Description must be less than 2000 characters";
  }

  // Status validation
  const validStatuses: TaskStatus[] = [
    TaskStatus.TODO,
    TaskStatus.IN_PROGRESS,
    TaskStatus.COMPLETED,
    TaskStatus.CANCELLED,
  ];
  if (!validStatuses.includes(formData.status)) {
    errors.status = "Invalid status selected";
  }

  // Priority validation
  const validPriorities: string[] = ["LOW", "MEDIUM", "HIGH", "URGENT"];
  if (!validPriorities.includes(formData.priority)) {
    errors.priority = "Invalid priority selected";
  }

  // Frequency validation
  const validFrequencies: string[] = [
    "ONCE",
    "DAILY",
    "WEEKLY",
    "BIWEEKLY",
    "MONTHLY",
    "QUARTERLY",
    "YEARLY",
  ];
  if (!validFrequencies.includes(formData.frequency)) {
    errors.frequency = "Invalid recurrence pattern selected";
  }

  // Due date validation
  if (formData.dueDate) {
    const dueDate = new Date(formData.dueDate);
    if (isNaN(dueDate.getTime())) {
      errors.dueDate = "Invalid date format";
    }
  }

  return errors;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface EditTaskPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Edit Task Page Component
 */
export default function EditTaskPage({
  params,
}: EditTaskPageProps): React.ReactElement {
  const router = useRouter();
  const [taskId, setTaskId] = useState<string>("");

  // Unwrap params promise
  useEffect(() => {
    params.then(p => setTaskId(p.id));
  }, [params]);
  const { user } = useAuth();

  // State management
  const [pageState, setPageState] = useState<PageState>({
    task: null,
    isLoadingTask: true,
    isSubmitting: false,
    isLoadingProjects: false,
    error: null,
    successMessage: null,
    notFound: false,
    permissionDenied: false,
    projects: [],
  });

  const [formData, setFormData] = useState<FormState>({
    title: "",
    description: "",
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    frequency: TaskFrequency.ONCE,
    dueDate: "",
    projectId: "",
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  /**
   * Load projects from API for the project selector
   */
  const loadProjects = async (): Promise<void> => {
    try {
      setPageState((prev) => ({ ...prev, isLoadingProjects: true }));

      const response = await apiClient.getProjects(1, 100, false);
      setPageState((prev) => ({
        ...prev,
        projects: response.data,
        isLoadingProjects: false,
      }));
    } catch (err) {
      console.error("Failed to load projects:", err);
      setPageState((prev) => ({
        ...prev,
        isLoadingProjects: false,
      }));
    }
  };

  /**
   * Fetch task data on component mount
   */
  useEffect(() => {
    const fetchTask = async (): Promise<void> => {
      try {
        setPageState((prev) => ({
          ...prev,
          isLoadingTask: true,
          error: null,
          notFound: false,
          permissionDenied: false,
        }));

        const task = await apiClient.getTask(taskId);

        // Check permissions
        if (!canEditTask(task, user?.id, user?.role)) {
          setPageState((prev) => ({
            ...prev,
            isLoadingTask: false,
            permissionDenied: true,
          }));
          return;
        }

        // Set initial form data
        setFormData({
          title: task.title,
          description: task.description || "",
          status: task.status,
          priority: task.priority,
          frequency: task.frequency || TaskFrequency.ONCE,
          dueDate: formatDateForInput(task.dueDate),
          projectId: task.projectId || "",
        });

        setPageState((prev) => ({
          ...prev,
          task,
          isLoadingTask: false,
        }));
      } catch (err) {
        const statusCode = err instanceof ApiClientError ? err.status : 500;
        const errorMessage =
          statusCode === 404
            ? "Task not found"
            : err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Failed to load task";

        if (statusCode === 404) {
          setPageState((prev) => ({
            ...prev,
            isLoadingTask: false,
            notFound: true,
          }));
        } else {
          setPageState((prev) => ({
            ...prev,
            isLoadingTask: false,
            error: errorMessage,
          }));
        }

        console.error("Error fetching task:", err);
      }
    };

    if (taskId) {
      fetchTask();
      loadProjects();
    }
  }, [taskId, user?.id, user?.role]);

  // =========================================================================
  // FORM HANDLERS
  // =========================================================================

  /**
   * Handle form input changes
   */
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field when user starts editing
    if (formErrors[name as keyof FormErrors]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    // Validate form
    const errors = validateForm(formData);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setPageState((prev) => ({
        ...prev,
        isSubmitting: true,
        error: null,
        successMessage: null,
      }));

      // Prepare update payload
      const updatePayload: UpdateTaskRequest = {
        title: formData.title,
        description: formData.description || undefined,
        status: formData.status,
        priority: formData.priority,
        frequency:
          formData.frequency !== TaskFrequency.ONCE ? formData.frequency : undefined,
        dueDate: formData.dueDate || null,
        projectId: formData.projectId || null,
      };

      // Submit update
      await apiClient.updateTask(taskId, updatePayload);

      // Show success message
      setPageState((prev) => ({
        ...prev,
        isSubmitting: false,
        successMessage: "Task updated successfully!",
      }));

      // Redirect to task detail page after short delay
      setTimeout(() => {
        router.push(`/tasks/${taskId}`);
      }, 1500);
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update task";

      setPageState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: errorMessage,
      }));

      console.error("Error updating task:", err);
    }
  };

  // =========================================================================
  // RENDERING
  // =========================================================================

  // Loading state
  if (pageState.isLoadingTask) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-gray-600">Loading task...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (pageState.notFound) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/tasks" className="hover:text-blue-600">
            Tasks
          </Link>
          <span>/</span>
          <span className="text-gray-600">Not Found</span>
        </div>

        <Card>
          <CardBody className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Task Not Found
            </h2>
            <p className="text-gray-600 mb-6">
              The task you are looking for does not exist or has been deleted.
            </p>
            <Link href="/tasks">
              <Button>Back to Tasks</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Permission denied state
  if (pageState.permissionDenied) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/tasks" className="hover:text-blue-600">
            Tasks
          </Link>
          <span>/</span>
          <span className="text-gray-600">Access Denied</span>
        </div>

        <Card>
          <CardBody className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 mb-6">
              You do not have permission to edit this task. Only the task owner,
              assigned users, managers, and admins can edit tasks.
            </p>
            <Link href="/tasks">
              <Button>Back to Tasks</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Main form render
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      {/* ===================================================================
          BREADCRUMB NAVIGATION
          =================================================================== */}

      <div className="flex items-center gap-2 text-sm text-gray-600">
        <Link href="/dashboard" className="hover:text-blue-600">
          Dashboard
        </Link>
        <span>/</span>
        <Link href="/tasks" className="hover:text-blue-600">
          Tasks
        </Link>
        <span>/</span>
        {pageState.task && (
          <>
            <Link
              href={`/tasks/${pageState.task.id}`}
              className="hover:text-blue-600"
            >
              {pageState.task.title}
            </Link>
            <span>/</span>
          </>
        )}
        <span className="text-gray-900 font-medium">Edit</span>
      </div>

      {/* ===================================================================
          ERROR ALERT
          =================================================================== */}

      {pageState.error && (
        <Alert
          variant="error"
          title="Error"
          onDismiss={() =>
            setPageState((prev) => ({
              ...prev,
              error: null,
            }))
          }
        >
          {pageState.error}
        </Alert>
      )}

      {/* ===================================================================
          SUCCESS ALERT
          =================================================================== */}

      {pageState.successMessage && (
        <Alert variant="success" title="Success">
          {pageState.successMessage}
        </Alert>
      )}

      {/* ===================================================================
          FORM CARD
          =================================================================== */}

      <Card>
        <CardHeader>
          <CardTitle>Edit Task</CardTitle>
        </CardHeader>

        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title Field */}
            <Input
              label="Task Title"
              name="title"
              type="text"
              placeholder="Enter task title"
              value={formData.title}
              onChange={handleInputChange}
              error={formErrors.title}
              required
              disabled={pageState.isSubmitting}
              maxLength={255}
            />

            {/* Description Field */}
            <Textarea
              label="Description"
              name="description"
              placeholder="Enter task description (optional)"
              value={formData.description}
              onChange={handleInputChange}
              error={formErrors.description}
              disabled={pageState.isSubmitting}
              maxLength={2000}
              rows={5}
            />

            {/* Status Field */}
            <Select
              label="Status"
              name="status"
              options={TASK_STATUS_OPTIONS}
              value={formData.status}
              onChange={handleInputChange}
              error={formErrors.status}
              required
              disabled={pageState.isSubmitting}
            />

            {/* Priority Field */}
            <Select
              label="Priority"
              name="priority"
              options={TASK_PRIORITY_OPTIONS}
              value={formData.priority}
              onChange={handleInputChange}
              error={formErrors.priority}
              required
              disabled={pageState.isSubmitting}
            />

            {/* Recurrence Field */}
            <Select
              label="Recurrence Pattern"
              name="frequency"
              options={RECURRENCE_OPTIONS}
              value={formData.frequency}
              onChange={handleInputChange}
              error={formErrors.frequency}
              required
              disabled={pageState.isSubmitting}
            />

            {/* Due Date Field */}
            <Input
              label="Due Date"
              name="dueDate"
              type="date"
              value={formData.dueDate}
              onChange={handleInputChange}
              error={formErrors.dueDate}
              disabled={pageState.isSubmitting}
            />

            {/* Project Field */}
            <Select
              label="Project"
              name="projectId"
              options={[
                { value: "", label: "No Project" },
                ...pageState.projects.map((project) => ({
                  value: project.id,
                  label: `${project.projectName} (${project.tasks?.length || 0} tasks)`,
                })),
              ]}
              value={formData.projectId}
              onChange={handleInputChange}
              error={formErrors.projectId}
              disabled={pageState.isSubmitting || pageState.isLoadingProjects}
            />

            {/* Form Actions */}
            <div className="flex gap-3 pt-6">
              <Button
                type="submit"
                variant="primary"
                disabled={pageState.isSubmitting}
                loading={pageState.isSubmitting}
              >
                {pageState.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>

              <Link href={`/tasks/${taskId}`}>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pageState.isSubmitting}
                >
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardBody>
      </Card>

      {/* ===================================================================
          TASK INFO SECTION
          =================================================================== */}

      {pageState.task && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Task Information</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 font-medium">Owner</p>
                <p className="text-gray-900">
                  {pageState.task.owner?.displayName ||
                    pageState.task.owner?.username ||
                    "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Created</p>
                <p className="text-gray-900">
                  {new Date(pageState.task.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Last Updated</p>
                <p className="text-gray-900">
                  {new Date(pageState.task.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Task ID</p>
                <p className="text-gray-900 font-mono text-xs">
                  {pageState.task.id}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
