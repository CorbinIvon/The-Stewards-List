"use client";

/**
 * ProjectForm component - Reusable form for creating and editing projects
 * Supports both create and edit modes with full validation
 * Integrates with CreateProjectRequest type from @/lib/types
 */

import React, { useState, useEffect } from "react";
import { CreateProjectRequest } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardFooter } from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Props for ProjectForm component
 */
export interface ProjectFormProps {
  /** Initial values for edit mode (optional) */
  initialValues?: Partial<CreateProjectRequest>;
  /** Callback when form is submitted with validated data */
  onSubmit: (data: CreateProjectRequest) => Promise<void>;
  /** Callback when cancel button is clicked */
  onCancel: () => void;
  /** Whether form submission is in progress */
  isLoading?: boolean;
  /** Whether in edit mode (affects button text and behavior) */
  isEditing?: boolean;
  /** Custom container class name */
  className?: string;
}

// ============================================================================
// VALIDATION CONSTANTS
// ============================================================================

const MIN_PROJECT_NAME_LENGTH = 3;
const MAX_PROJECT_NAME_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 2000;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

const VALIDATION_ERRORS = {
  PROJECT_NAME_REQUIRED: "Project name is required",
  PROJECT_NAME_TOO_SHORT: `Project name must be at least ${MIN_PROJECT_NAME_LENGTH} characters`,
  PROJECT_NAME_TOO_LONG: `Project name must be ${MAX_PROJECT_NAME_LENGTH} characters or less`,
  DESCRIPTION_TOO_LONG: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Trim whitespace from input string
 */
function trimString(str: string | undefined | null): string {
  if (!str) return "";
  return str.trim();
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ProjectForm component - Reusable form for creating and editing projects
 *
 * Features:
 * - Create and edit modes
 * - Full validation with error messages
 * - Controlled form inputs
 * - Project name and description fields
 * - Character counter for description
 * - Loading state on submit button
 * - Cancel button to exit form
 * - Error alert display
 * - Success message handling
 * - Comprehensive accessibility support
 *
 * Validation Rules:
 * - projectName: 3-100 characters, required, trims whitespace
 * - description: 0-2000 characters, optional, trims whitespace
 *
 * Usage:
 * ```tsx
 * <ProjectForm
 *   initialValues={{ projectName: "My Project", description: "..." }}
 *   onSubmit={async (data) => { await api.createProject(data); }}
 *   onCancel={() => navigate('/projects')}
 *   isLoading={false}
 *   isEditing={true}
 * />
 * ```
 */
export function ProjectForm({
  initialValues,
  onSubmit,
  onCancel,
  isLoading = false,
  isEditing = false,
  className,
}: ProjectFormProps): React.ReactElement {
  // ========================================================================
  // STATE
  // ========================================================================

  const [formData, setFormData] = useState<CreateProjectRequest>({
    projectName: trimString(initialValues?.projectName),
    description: trimString(initialValues?.description),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // ========================================================================
  // VALIDATION
  // ========================================================================

  /**
   * Validate project name field
   */
  const validateProjectName = (value: string): string | undefined => {
    const trimmed = value.trim();

    if (!trimmed) {
      return VALIDATION_ERRORS.PROJECT_NAME_REQUIRED;
    }

    if (trimmed.length < MIN_PROJECT_NAME_LENGTH) {
      return VALIDATION_ERRORS.PROJECT_NAME_TOO_SHORT;
    }

    if (trimmed.length > MAX_PROJECT_NAME_LENGTH) {
      return VALIDATION_ERRORS.PROJECT_NAME_TOO_LONG;
    }

    return undefined;
  };

  /**
   * Validate description field
   */
  const validateDescription = (value: string | undefined): string | undefined => {
    if (!value) return undefined;

    const trimmed = value.trim();

    if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
      return VALIDATION_ERRORS.DESCRIPTION_TOO_LONG;
    }

    return undefined;
  };

  /**
   * Validate a single field
   */
  const validateField = (
    fieldName: keyof CreateProjectRequest,
    value: unknown
  ): string | undefined => {
    switch (fieldName) {
      case "projectName":
        return validateProjectName(value as string);

      case "description":
        return validateDescription(value as string | undefined);

      default:
        return undefined;
    }
  };

  /**
   * Validate entire form
   */
  const validateForm = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    const nameError = validateField("projectName", formData.projectName);
    if (nameError) newErrors.projectName = nameError;

    const descError = validateField("description", formData.description);
    if (descError) newErrors.description = descError;

    return newErrors;
  };

  // ========================================================================
  // HANDLERS
  // ========================================================================

  /**
   * Handle field change
   */
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target;
    const fieldName = name as keyof CreateProjectRequest;

    setFormData((prev) => ({
      ...prev,
      [fieldName]: value,
    }));

    // Clear submit error when user starts editing
    if (submitError) {
      setSubmitError(null);
    }

    // Clear field error when user starts typing
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
    e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>
  ): void => {
    const { name, value } = e.target;
    const fieldName = name as keyof CreateProjectRequest;

    setTouched((prev) => ({
      ...prev,
      [fieldName]: true,
    }));

    const error = validateField(fieldName, value);
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

    // Clear previous messages
    setSubmitError(null);
    setSuccessMessage(null);

    // Validate form
    const formErrors = validateForm();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    // Prepare submission data with trimmed values
    const submissionData: CreateProjectRequest = {
      projectName: formData.projectName.trim(),
      description: formData.description?.trim() || undefined,
    };

    // Call onSubmit callback
    try {
      await onSubmit(submissionData);
      setSuccessMessage(
        isEditing ? "Project updated successfully" : "Project created successfully"
      );
      // Clear form data after successful submission
      setFormData({
        projectName: "",
        description: undefined,
      });
      setTouched({});
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred while saving the project";
      setSubmitError(errorMessage);
      console.error("Form submission error:", error);
    }
  };

  /**
   * Handle dismiss error alert
   */
  const handleDismissError = (): void => {
    setSubmitError(null);
  };

  /**
   * Handle dismiss success alert
   */
  const handleDismissSuccess = (): void => {
    setSuccessMessage(null);
  };

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <Card className={className}>
      <form onSubmit={handleSubmit}>
        <CardBody className="space-y-6">
          {/* Error Alert */}
          {submitError && (
            <Alert variant="error" onDismiss={handleDismissError} title="Error">
              {submitError}
            </Alert>
          )}

          {/* Success Alert */}
          {successMessage && (
            <Alert variant="success" onDismiss={handleDismissSuccess} title="Success">
              {successMessage}
            </Alert>
          )}

          {/* Project Name Field */}
          <div>
            <Input
              label="Project Name"
              name="projectName"
              type="text"
              placeholder="Enter project name"
              value={formData.projectName}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.projectName ? errors.projectName : undefined}
              required
              disabled={isLoading}
              maxLength={MAX_PROJECT_NAME_LENGTH}
              aria-describedby={
                touched.projectName && errors.projectName
                  ? "projectName-error"
                  : "projectName-count"
              }
            />
            <p
              id="projectName-count"
              className="mt-1 text-xs text-slate-400"
              aria-live="polite"
              aria-atomic="true"
            >
              {formData.projectName.length}/{MAX_PROJECT_NAME_LENGTH} characters
            </p>
          </div>

          {/* Description Field */}
          <div>
            <Textarea
              label="Description"
              name="description"
              placeholder="Enter project description (optional)"
              value={formData.description ?? ""}
              onChange={handleChange}
              onBlur={handleBlur}
              error={touched.description ? errors.description : undefined}
              disabled={isLoading}
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={5}
              aria-describedby={
                touched.description && errors.description
                  ? "description-error"
                  : "description-count"
              }
            />
            <p
              id="description-count"
              className="mt-1 text-xs text-slate-400"
              aria-live="polite"
              aria-atomic="true"
            >
              {(formData.description ?? "").length}/{MAX_DESCRIPTION_LENGTH} characters
            </p>
          </div>
        </CardBody>

        {/* Footer with Buttons */}
        <CardFooter className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
            aria-label="Cancel and go back"
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            loading={isLoading}
            disabled={isLoading}
            aria-label={isEditing ? "Update project" : "Create project"}
          >
            {isEditing ? "Update Project" : "Create Project"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export default ProjectForm;
