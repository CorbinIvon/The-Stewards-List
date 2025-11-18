"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Spinner,
} from "@/components/ui";
import Textarea from "@/components/ui/Textarea";
import Alert from "@/components/ui/Alert";
import { useAuth, useAuthUser } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type {
  CreateTaskRequest,
  TaskPriority,
  TaskFrequency,
  UserRole,
  Project,
  ProjectWithRelations,
  PaginatedResponse,
} from "@/lib/types";
import {
  TaskPriority as TaskPriorityEnum,
  TaskFrequency as TaskFrequencyEnum,
} from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Form state for creating a new task
 */
interface FormState {
  title: string;
  description: string;
  priority: TaskPriority;
  frequency: TaskFrequency | "";
  dueDate: string;
  projectId: string | "";
}

/**
 * Form validation errors
 */
interface FormErrors {
  title?: string;
  description?: string;
  priority?: string;
  frequency?: string;
  dueDate?: string;
  projectId?: string;
}

/**
 * Page state
 */
interface PageState {
  isLoading: boolean;
  isSubmitting: boolean;
  isLoadingProjects: boolean;
  error: string | null;
  successMessage: string | null;
  projects: ProjectWithRelations[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const PRIORITY_OPTIONS = [
  { value: TaskPriorityEnum.LOW, label: "Low" },
  { value: TaskPriorityEnum.MEDIUM, label: "Medium" },
  { value: TaskPriorityEnum.HIGH, label: "High" },
  { value: TaskPriorityEnum.URGENT, label: "Urgent" },
];

const FREQUENCY_OPTIONS = [
  { value: "", label: "No Recurrence" },
  { value: TaskFrequencyEnum.DAILY, label: "Daily" },
  { value: TaskFrequencyEnum.WEEKLY, label: "Weekly" },
  { value: TaskFrequencyEnum.BIWEEKLY, label: "Bi-weekly" },
  { value: TaskFrequencyEnum.MONTHLY, label: "Monthly" },
  { value: TaskFrequencyEnum.QUARTERLY, label: "Quarterly" },
  { value: TaskFrequencyEnum.YEARLY, label: "Yearly" },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate form data and return errors
 */
function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};

  // Validate title
  if (!form.title.trim()) {
    errors.title = "Task title is required";
  } else if (form.title.trim().length < 3) {
    errors.title = "Title must be at least 3 characters";
  } else if (form.title.length > 255) {
    errors.title = "Title must not exceed 255 characters";
  }

  // Validate description
  if (form.description.length > 2000) {
    errors.description = "Description must not exceed 2000 characters";
  }

  // Validate due date format if provided
  if (form.dueDate) {
    const dueDate = new Date(form.dueDate);
    if (isNaN(dueDate.getTime())) {
      errors.dueDate = "Invalid date format";
    } else if (dueDate < new Date()) {
      errors.dueDate = "Due date must be in the future";
    }
  }

  return errors;
}

/**
 * Get display label for a project
 */
function getProjectLabel(project: ProjectWithRelations): string {
  const taskCount = project.tasks?.length || 0;
  return `${project.projectName} (${taskCount} tasks)`;
}

/**
 * Get today's date as an ISO string for minimum date validation
 */
function getTodayISOString(): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.toISOString().split("T")[0];
}

/**
 * Check if user has permission to create tasks
 */
function hasPermissionToCreateTasks(userRole: UserRole | undefined): boolean {
  return userRole === "ADMIN" || userRole === "MANAGER";
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * New Task Creation Page
 *
 * Allows Admin and Manager users to create new tasks with:
 * - Title (required)
 * - Description (optional)
 * - Priority (default: MEDIUM)
 * - Due date (optional)
 * - Recurrence pattern (optional)
 *
 * Permission check: Only Admin/Manager can access, Members are redirected to /tasks
 */
export default function NewTaskPage(): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentUser = useAuthUser();
  const { isLoading: authLoading } = useAuth();

  // Get projectId from query parameter if provided
  const projectIdParam = searchParams?.get("projectId") || "";

  // Form state
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    priority: TaskPriorityEnum.MEDIUM,
    frequency: "",
    dueDate: "",
    projectId: projectIdParam,
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [pageState, setPageState] = useState<PageState>({
    isLoading: authLoading,
    isSubmitting: false,
    isLoadingProjects: false,
    error: null,
    successMessage: null,
    projects: [],
  });

  // =========================================================================
  // PERMISSION CHECK & LOAD PROJECTS
  // =========================================================================

  useEffect(() => {
    if (authLoading) {
      return;
    }

    // Not authenticated
    if (!currentUser) {
      router.push("/login");
      return;
    }

    // Not authorized (Member role)
    if (!hasPermissionToCreateTasks(currentUser.role)) {
      router.push("/tasks");
      return;
    }

    setPageState((prev) => ({ ...prev, isLoading: false }));

    // Load projects for the dropdown
    loadProjects();
  }, [authLoading, currentUser, router]);

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

  // =========================================================================
  // FORM HANDLERS
  // =========================================================================

  /**
   * Handle form field changes
   */
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ): void => {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
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
    const formErrors = validateForm(form);
    if (Object.keys(formErrors).length > 0) {
      setErrors(formErrors);
      return;
    }

    setPageState((prev) => ({ ...prev, isSubmitting: true, error: null }));

    try {
      // Build request payload
      const request: CreateTaskRequest = {
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        priority: form.priority,
        frequency: (form.frequency as TaskFrequency | undefined) || undefined,
        dueDate: form.dueDate || undefined,
        projectId: form.projectId || undefined,
      };

      // Create task via API
      const newTask = await apiClient.createTask(request);

      // Show success message
      setPageState((prev) => ({
        ...prev,
        isSubmitting: false,
        successMessage: "Task created successfully! Redirecting...",
      }));

      // Redirect to task detail page after brief delay
      setTimeout(() => {
        router.push(`/tasks/${newTask.id}`);
      }, 500);
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to create task";

      console.error("Task creation error:", err);

      setPageState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: errorMessage,
      }));
    }
  };

  /**
   * Handle cancel button
   */
  const handleCancel = (): void => {
    router.push("/tasks");
  };

  // =========================================================================
  // RENDERING
  // =========================================================================

  // Show loading state while checking authentication
  if (pageState.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // User not authenticated or authorized - shouldn't reach here due to useEffect redirect
  if (!currentUser || !hasPermissionToCreateTasks(currentUser.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardBody className="text-center">
            <p className="text-slate-400 mb-4">
              You don&apos;t have permission to create tasks.
            </p>
            <Link href="/tasks">
              <Button variant="primary">Go back to tasks</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
      {/* =====================================================================
          ERROR ALERT
          ===================================================================== */}

      {pageState.error && (
        <div className="mb-6 max-w-6xl mx-auto">
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
        </div>
      )}

      {/* =====================================================================
          SUCCESS ALERT
          ===================================================================== */}

      {pageState.successMessage && (
        <div className="mb-6 max-w-6xl mx-auto">
          <Alert variant="success" title="Success">
            {pageState.successMessage}
          </Alert>
        </div>
      )}

      {/* =====================================================================
          MAIN FORM - 2 COLUMN LAYOUT (GitHub Issue Style)
          ===================================================================== */}

      <form onSubmit={handleSubmit} className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ================================================================
              LEFT COLUMN - MAIN CONTENT (70%)
              ================================================================ */}

          <div className="lg:col-span-2 space-y-6">
            {/* Title Input - Large with Border Bottom */}
            <div>
              <input
                type="text"
                name="title"
                placeholder="What needs to get done?"
                value={form.title}
                onChange={handleInputChange}
                disabled={pageState.isSubmitting}
                maxLength={255}
                className={`w-full text-3xl font-bold bg-transparent border-b-2 pb-3 focus:outline-none transition-colors ${
                  errors.title
                    ? "border-red-500 text-red-400"
                    : "border-slate-600 text-slate-100 focus:border-blue-500"
                } placeholder-slate-500 disabled:opacity-50 disabled:cursor-not-allowed`}
              />
              {errors.title && (
                <p className="text-red-400 text-sm mt-2">{errors.title}</p>
              )}
              <p className="text-slate-400 text-xs mt-2">
                {form.title.length}/255 characters
              </p>
            </div>

            {/* Description Textarea - Markdown Style */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-300">
                Description
              </label>
              <Textarea
                name="description"
                placeholder="Add a description... (Markdown supported: bold, italic, code blocks, lists)"
                value={form.description}
                onChange={handleInputChange}
                error={errors.description}
                disabled={pageState.isSubmitting}
                rows={10}
                maxLength={2000}
                className="bg-slate-800 border border-slate-600 rounded-lg"
              />
              <div className="flex justify-between items-center">
                <p className="text-slate-400 text-xs">
                  Supports Markdown formatting
                </p>
                <p className="text-slate-400 text-xs">
                  {form.description.length}/2000 characters
                </p>
              </div>
            </div>
          </div>

          {/* ================================================================
              RIGHT COLUMN - SIDEBAR (30%)
              ================================================================ */}

          <div className="lg:col-span-1 space-y-1">
            {/* Project Selector */}
            <div className="border-b border-slate-700 pb-4 mb-4">
              <label className="flex items-center text-sm font-medium text-slate-300 mb-3">
                <span className="text-lg mr-2">📁</span>
                Project
              </label>
              {pageState.isLoadingProjects ? (
                <div className="flex items-center gap-2 py-2">
                  <Spinner size="sm" />
                  <span className="text-slate-400 text-sm">Loading projects...</span>
                </div>
              ) : (
                <select
                  name="projectId"
                  value={form.projectId}
                  onChange={handleInputChange}
                  disabled={pageState.isSubmitting || pageState.isLoadingProjects}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">No Project</option>
                  {pageState.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {getProjectLabel(project)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Priority Selector */}
            <div className="border-b border-slate-700 pb-4 mb-4">
              <label className="flex items-center text-sm font-medium text-slate-300 mb-3">
                <span className="text-lg mr-2">⚡</span>
                Priority
              </label>
              <select
                name="priority"
                value={form.priority}
                onChange={handleInputChange}
                disabled={pageState.isSubmitting}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.priority && (
                <p className="text-red-400 text-xs mt-2">{errors.priority}</p>
              )}
            </div>

            {/* Due Date Picker */}
            <div className="border-b border-slate-700 pb-4 mb-4">
              <label className="flex items-center text-sm font-medium text-slate-300 mb-3">
                <span className="text-lg mr-2">📅</span>
                Due Date
              </label>
              <input
                type="date"
                name="dueDate"
                value={form.dueDate}
                onChange={handleInputChange}
                disabled={pageState.isSubmitting}
                min={getTodayISOString()}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              {errors.dueDate && (
                <p className="text-red-400 text-xs mt-2">{errors.dueDate}</p>
              )}
            </div>

            {/* Recurrence Selector */}
            <div className="border-b border-slate-700 pb-4 mb-4">
              <label className="flex items-center text-sm font-medium text-slate-300 mb-3">
                <span className="text-lg mr-2">🔄</span>
                Recurrence
              </label>
              <select
                name="frequency"
                value={form.frequency}
                onChange={handleInputChange}
                disabled={pageState.isSubmitting}
                className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded text-slate-100 text-sm focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {FREQUENCY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {errors.frequency && (
                <p className="text-red-400 text-xs mt-2">{errors.frequency}</p>
              )}
            </div>

            {/* Assignee Info */}
            <div className="bg-slate-800 rounded-lg p-4 text-center border border-slate-700">
              <p className="flex items-center justify-center text-sm font-medium text-slate-300 mb-2">
                <span className="text-lg mr-2">👤</span>
                Assignee
              </p>
              <p className="text-xs text-slate-400">
                Will be assigned after creation
              </p>
            </div>
          </div>
        </div>

        {/* ===================================================================
            ACTION BAR - STICKY BOTTOM
            =================================================================== */}

        <div className="mt-8 border-t border-slate-700 pt-6 flex gap-3 justify-between items-center">
          <p className="text-xs text-slate-400">
            Tip: Use Markdown in the description for better formatting
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={pageState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={pageState.isSubmitting}
              disabled={pageState.isSubmitting}
            >
              {pageState.isSubmitting ? "Creating..." : "Create Task"}
            </Button>
          </div>
        </div>
      </form>

      {/* =====================================================================
          HELP TEXT SECTION
          ===================================================================== */}

      <div className="max-w-6xl mx-auto mt-12">
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <h3 className="text-sm font-semibold text-slate-200 mb-4">
            Task Creation Guide
          </h3>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <li className="flex gap-3">
              <span className="text-blue-400 font-semibold">•</span>
              <span className="text-sm text-slate-400">
                Title is required and must be at least 3 characters
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-400 font-semibold">•</span>
              <span className="text-sm text-slate-400">
                Description is optional but recommended for clarity
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-400 font-semibold">•</span>
              <span className="text-sm text-slate-400">
                Priority defaults to Medium if not specified
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-400 font-semibold">•</span>
              <span className="text-sm text-slate-400">
                Due dates must be in the future
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-400 font-semibold">•</span>
              <span className="text-sm text-slate-400">
                Set recurrence for tasks that repeat on a schedule
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-blue-400 font-semibold">•</span>
              <span className="text-sm text-slate-400">
                Link tasks to projects for better organization
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
