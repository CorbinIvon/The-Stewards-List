"use client";

/**
 * TaskForm component - Reusable form for creating and editing tasks
 * Supports both create and edit modes with full validation
 * Integrates with Task type from @/lib/types
 */

import React, { useState, useEffect } from "react";
import { Task, TaskStatus, TaskPriority, TaskFrequency } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardFooter } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Select from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Form data submitted to onSubmit callback
 * Includes all editable task fields
 */
export interface TaskFormData {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  dueDate: string | null;
  frequency: TaskFrequency;
}

/**
 * Props for TaskForm component
 */
export interface TaskFormProps {
  /** Initial values for edit mode (optional) */
  initialValues?: Partial<Task>;
  /** Callback when form is submitted */
  onSubmit: (data: TaskFormData) => Promise<void>;
  /** Callback when cancel button is clicked */
  onCancel: () => void;
  /** Whether form submission is in progress */
  isSubmitting: boolean;
  /** Custom container class name */
  className?: string;
}

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

const MAX_TITLE_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

const VALIDATION_ERRORS = {
  TITLE_REQUIRED: "Title is required",
  TITLE_TOO_LONG: `Title must be ${MAX_TITLE_LENGTH} characters or less`,
  DESCRIPTION_TOO_LONG: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
  INVALID_DUE_DATE: "Invalid due date",
  PAST_DUE_DATE: "Due date cannot be in the past",
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format date to YYYY-MM-DD format for date input
 */
function formatDateForInput(date: Date | string | null | undefined): string {
  if (!date) return "";
  const dateObj = typeof date === "string" ? new Date(date) : date;
  if (isNaN(dateObj.getTime())) return "";

  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, "0");
  const day = String(dateObj.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

/**
 * Check if date is in the past (compared to today)
 */
function isPastDate(dateString: string): boolean {
  const selectedDate = new Date(dateString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return selectedDate < today;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * TaskForm component - Reusable form for creating and editing tasks
 *
 * Features:
 * - Create and edit modes
 * - Full validation with error messages
 * - Controlled form inputs
 * - Title, description, status, priority, assignee, due date, and recurrence fields
 * - Loading state on submit button
 * - Cancel button to exit form
 *
 * Usage:
 * ```tsx
 * <TaskForm
 *   initialValues={task}
 *   onSubmit={async (data) => { await api.updateTask(taskId, data); }}
 *   onCancel={() => navigate('/tasks')}
 *   isSubmitting={isSubmitting}
 * />
 * ```
 */
export function TaskForm({
  initialValues,
  onSubmit,
  onCancel,
  isSubmitting,
  className,
}: TaskFormProps): React.ReactElement {
  // ========================================================================
  // STATE
  // ========================================================================

  const [formData, setFormData] = useState<TaskFormData>({
    title: initialValues?.title ?? "",
    description: initialValues?.description ?? null,
    status: initialValues?.status ?? TaskStatus.TODO,
    priority: initialValues?.priority ?? TaskPriority.MEDIUM,
    assigneeId: null,
    dueDate: formatDateForInput(initialValues?.dueDate),
    frequency: initialValues?.frequency ?? TaskFrequency.ONCE,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // ========================================================================
  // VALIDATION
  // ========================================================================

  /**
   * Validate a single field
   */
  const validateField = (
    fieldName: keyof TaskFormData,
    value: unknown
  ): string | undefined => {
    switch (fieldName) {
      case "title": {
        const title = value as string;
        if (!title || title.trim().length === 0) {
          return VALIDATION_ERRORS.TITLE_REQUIRED;
        }
        if (title.length > MAX_TITLE_LENGTH) {
          return VALIDATION_ERRORS.TITLE_TOO_LONG;
        }
        return undefined;
      }

      case "description": {
        const description = value as string | null;
        if (description && description.length > MAX_DESCRIPTION_LENGTH) {
          return VALIDATION_ERRORS.DESCRIPTION_TOO_LONG;
        }
        return undefined;
      }

      case "dueDate": {
        const dueDate = value as string | null;
        if (dueDate && dueDate.trim()) {
          try {
            if (isPastDate(dueDate)) {
              return VALIDATION_ERRORS.PAST_DUE_DATE;
            }
          } catch {
            return VALIDATION_ERRORS.INVALID_DUE_DATE;
          }
        }
        return undefined;
      }

      default:
        return undefined;
    }
  };

  /**
   * Validate entire form
   */
  const validateForm = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    const titleError = validateField("title", formData.title);
    if (titleError) newErrors.title = titleError;

    const descriptionError = validateField("description", formData.description);
    if (descriptionError) newErrors.description = descriptionError;

    const dueDateError = validateField("dueDate", formData.dueDate);
    if (dueDateError) newErrors.dueDate = dueDateError;

    return newErrors;
  };

  // ========================================================================
  // HANDLERS
  // ========================================================================

  /**
   * Handle field change
   */
  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ): void => {
    const { name, value } = e.target;
    const fieldName = name as keyof TaskFormData;

    setFormData((prev) => ({
      ...prev,
      [fieldName]: value || null,
    }));

    // Clear error when user starts typing
    // eslint-disable-next-line security/detect-object-injection
    if (errors[fieldName]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        // eslint-disable-next-line security/detect-object-injection
        delete newErrors[fieldName];
        return newErrors;
      });
    }
  };

  /**
   * Handle field blur for validation
   */
  const handleBlur = (
    e: React.FocusEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ): void => {
    const { name, value } = e.target;
    const fieldName = name as keyof TaskFormData;

    setTouched((prev) => ({
      ...prev,
      [fieldName]: true,
    }));

    const error = validateField(fieldName, value || null);
    if (error) {
      setErrors((prev) => ({
        ...prev,
        [fieldName]: error,
      }));
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    // Validate form
    const formErrors = validateForm();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    // Call onSubmit callback
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error("Form submission error:", error);
    }
  };

  /**
   * Handle assignee selection (placeholder for TaskAssignmentPicker)
   */
  const handleAssigneeChange = (userId: string | null): void => {
    setFormData((prev) => ({
      ...prev,
      assigneeId: userId,
    }));
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  const isEdit = !!initialValues?.id;

  return (
    <Card className={className}>
      <form onSubmit={handleSubmit}>
        <CardBody className="space-y-6">
          {/* Title Field */}
          <div>
            <Input
              label="Task Title"
              name="title"
              type="text"
              placeholder="Enter task title"
              value={formData.title}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.title ? errors.title : undefined}
              required
              disabled={isSubmitting}
              maxLength={MAX_TITLE_LENGTH}
            />
            <p className="mt-1 text-xs text-slate-400">
              {formData.title.length}/{MAX_TITLE_LENGTH}
            </p>
          </div>

          {/* Description Field */}
          <div>
            <Textarea
              label="Description"
              name="description"
              placeholder="Enter task description (optional)"
              value={formData.description ?? ""}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.description ? errors.description : undefined}
              disabled={isSubmitting}
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={5}
            />
          </div>

          {/* Status Field */}
          <div>
            <Select
              label="Status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              options={Object.entries(TaskStatus).map(([key, value]) => ({
                value,
                label: key.replace(/_/g, " "),
              }))}
              disabled={isSubmitting}
            />
          </div>

          {/* Priority Field */}
          <div>
            <Select
              label="Priority"
              name="priority"
              value={formData.priority}
              onChange={handleChange}
              options={Object.entries(TaskPriority).map(([key, value]) => ({
                value,
                label: key.replace(/_/g, " "),
              }))}
              disabled={isSubmitting}
            />
          </div>

          {/* Assignee Field - Placeholder for TaskAssignmentPicker */}
          <div>
            <div className="text-sm font-medium text-slate-300 mb-1">
              Assignee
            </div>
            <div className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-400 text-sm">
              Coming soon: Task Assignment Picker
            </div>
            <p className="mt-1 text-xs text-slate-400">
              TaskAssignmentPicker component will be integrated here
            </p>
          </div>

          {/* Due Date Field */}
          <div>
            <Input
              label="Due Date"
              name="dueDate"
              type="date"
              value={formData.dueDate || ""}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.dueDate ? errors.dueDate : undefined}
              disabled={isSubmitting}
            />
          </div>

          {/* Recurrence Field */}
          <div>
            <Select
              label="Recurrence"
              name="frequency"
              value={formData.frequency}
              onChange={handleChange}
              options={Object.entries(TaskFrequency).map(([key, value]) => ({
                value,
                label: key.replace(/_/g, " "),
              }))}
              disabled={isSubmitting}
            />
          </div>
        </CardBody>

        {/* Footer with Buttons */}
        <CardFooter className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isEdit ? "Update Task" : "Create Task"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default TaskForm;
