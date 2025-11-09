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
  Spinner,
} from "@/components/ui";
import Textarea from "@/components/ui/Textarea";
import Alert from "@/components/ui/Alert";
import { useAuth, useAuthUser } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { CreateProjectRequest, UserRole } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Form state for creating a new project
 */
interface FormState {
  projectName: string;
  description: string;
}

/**
 * Form validation errors
 */
interface FormErrors {
  projectName?: string;
  description?: string;
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
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate form data and return errors
 */
function validateForm(form: FormState): FormErrors {
  const errors: FormErrors = {};

  // Validate project name
  if (!form.projectName.trim()) {
    errors.projectName = "Project name is required";
  } else if (form.projectName.trim().length < 2) {
    errors.projectName = "Project name must be at least 2 characters";
  } else if (form.projectName.length > 255) {
    errors.projectName = "Project name must not exceed 255 characters";
  }

  // Validate description
  if (form.description.length > 2000) {
    errors.description = "Description must not exceed 2000 characters";
  }

  return errors;
}

/**
 * Check if user has permission to create projects
 */
function hasPermissionToCreateProjects(userRole: UserRole | undefined): boolean {
  return userRole === "ADMIN" || userRole === "MANAGER";
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * New Project Creation Page
 *
 * Allows Admin and Manager users to create new projects with:
 * - Project name (required)
 * - Description (optional)
 *
 * Permission check: Only Admin/Manager can access, Members are redirected to /projects
 */
export default function NewProjectPage(): React.ReactElement {
  const router = useRouter();
  const currentUser = useAuthUser();
  const { isLoading: authLoading } = useAuth();

  // Form state
  const [form, setForm] = useState<FormState>({
    projectName: "",
    description: "",
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
    if (!hasPermissionToCreateProjects(currentUser.role)) {
      router.push("/projects");
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
      const request: CreateProjectRequest = {
        projectName: form.projectName.trim(),
        description: form.description.trim() || undefined,
      };

      // Create project via API
      const newProject = await apiClient.createProject(request);

      // Show success message
      setPageState((prev) => ({
        ...prev,
        isSubmitting: false,
        successMessage: "Project created successfully! Redirecting...",
      }));

      // Redirect to project detail page after brief delay
      setTimeout(() => {
        router.push(`/projects/${newProject.id}`);
      }, 500);
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to create project";

      console.error("Project creation error:", err);

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
    router.push("/projects");
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
  if (!currentUser || !hasPermissionToCreateProjects(currentUser.role)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardBody className="text-center">
            <p className="text-slate-400 mb-4">
              You don&apos;t have permission to create projects.
            </p>
            <Link href="/projects">
              <Button variant="primary">Go back to projects</Button>
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
            <CardTitle>Create New Project</CardTitle>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardBody className="space-y-6">
              {/* Project Name Field */}
              <Input
                label="Project Name"
                name="projectName"
                placeholder="Enter project name"
                value={form.projectName}
                onChange={handleInputChange}
                error={errors.projectName}
                required
                disabled={pageState.isSubmitting}
                maxLength={255}
              />

              {/* Description Field */}
              <Textarea
                label="Description"
                name="description"
                placeholder="Enter project description (optional)"
                value={form.description}
                onChange={handleInputChange}
                error={errors.description}
                disabled={pageState.isSubmitting}
                rows={5}
                maxLength={2000}
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
                {pageState.isSubmitting ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </form>
        </Card>

        {/* ===================================================================
            HELP TEXT
            =================================================================== */}

        <Card className="bg-blue-50 border-slate-200">
          <CardBody className="text-sm text-slate-200">
            <p className="font-medium mb-2">Project Creation Guide</p>
            <ul className="space-y-1 list-disc list-inside text-slate-300">
              <li>Project name is required and must be at least 2 characters</li>
              <li>Description is optional but recommended for clarity</li>
              <li>Projects help organize and group related tasks together</li>
              <li>You can add collaborators and manage permissions after creation</li>
              <li>Projects can be archived when they are complete or no longer needed</li>
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
