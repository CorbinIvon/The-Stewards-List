"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
}

/**
 * Page state
 */
interface PageState {
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
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
  const currentUser = useAuthUser();
  const { isLoading: authLoading } = useAuth();

  // Form state
  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    priority: TaskPriorityEnum.MEDIUM,
    frequency: "",
    dueDate: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [pageState, setPageState] = useState<PageState>({
    isLoading: authLoading,
    isSubmitting: false,
    error: null,
    successMessage: null,
  });

  // =========================================================================
  // PERMISSION CHECK
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
  }, [authLoading, currentUser, router]);

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
      <div className="mx-auto max-w-2xl space-y-6">
        {/* ===================================================================
            BREADCRUMB NAVIGATION
            =================================================================== */}

        {/* Breadcrumb removed above page header */}

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
            <CardTitle>Create New Task</CardTitle>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardBody className="space-y-6">
              {/* Title Field */}
              <Input
                label="Task Title"
                name="title"
                placeholder="Enter task title"
                value={form.title}
                onChange={handleInputChange}
                error={errors.title}
                required
                disabled={pageState.isSubmitting}
                maxLength={255}
              />

              {/* Description Field */}
              <Textarea
                label="Description"
                name="description"
                placeholder="Enter task description (optional)"
                value={form.description}
                onChange={handleInputChange}
                error={errors.description}
                disabled={pageState.isSubmitting}
                rows={5}
                maxLength={2000}
              />

              {/* Priority Field */}
              <Select
                label="Priority"
                name="priority"
                options={PRIORITY_OPTIONS}
                value={form.priority}
                onChange={handleInputChange}
                error={errors.priority}
                disabled={pageState.isSubmitting}
              />

              {/* Due Date Field */}
              <Input
                label="Due Date"
                name="dueDate"
                type="date"
                value={form.dueDate}
                onChange={handleInputChange}
                error={errors.dueDate}
                disabled={pageState.isSubmitting}
                min={getTodayISOString()}
              />

              {/* Recurrence Pattern Field */}
              <Select
                label="Recurrence"
                name="frequency"
                options={FREQUENCY_OPTIONS}
                value={form.frequency}
                onChange={handleInputChange}
                error={errors.frequency}
                disabled={pageState.isSubmitting}
              />
            </CardBody>

            {/* ===============================================================
                FORM FOOTER WITH ACTIONS
                =============================================================== */}

            <div className="border-t border-slate-700 px-6 py-4 flex gap-3 justify-end">
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
          </form>
        </Card>

        {/* ===================================================================
            HELP TEXT
            =================================================================== */}

        <Card className="bg-blue-50 border-slate-200">
          <CardBody className="text-sm text-slate-200">
            <p className="font-medium mb-2">Task Creation Guide</p>
            <ul className="space-y-1 list-disc list-inside text-slate-300">
              <li>Title is required and must be at least 3 characters</li>
              <li>Description is optional but recommended for clarity</li>
              <li>Priority defaults to Medium if not specified</li>
              <li>Due dates must be in the future</li>
              <li>Set recurrence for tasks that repeat on a schedule</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
