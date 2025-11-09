"use client";

/**
 * Edit Project Page
 * Allows users to edit an existing project
 * Located at: /dashboard/projects/[id]/edit
 *
 * Features:
 * - Fetch and display existing project data
 * - Permission checks (only creator can edit)
 * - Form validation and error handling
 * - Success message after update
 * - Redirect to project detail page after successful edit
 * - Loading states for initial fetch and submission
 * - 404 handling for invalid project IDs
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
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type {
  ProjectWithRelations,
  UserRole,
  UpdateProjectRequest,
} from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Form state interface
 */
interface FormState {
  projectName: string;
  description: string;
}

/**
 * Form errors interface
 */
interface FormErrors {
  projectName?: string;
  description?: string;
}

/**
 * Page state interface
 */
interface PageState {
  project: ProjectWithRelations | null;
  isLoadingProject: boolean;
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
  notFound: boolean;
  permissionDenied: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const MAX_PROJECT_NAME_LENGTH = 255;
const MAX_DESCRIPTION_LENGTH = 2000;

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if user has permission to edit the project
 * Only the creator can edit a project
 */
function canEditProject(
  project: ProjectWithRelations | null,
  userId: string | undefined
): boolean {
  if (!project || !userId) {
    return false;
  }

  // Only creator can edit
  return project.creatorId === userId;
}

/**
 * Validate form data
 */
function validateForm(formData: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!formData.projectName.trim()) {
    errors.projectName = "Project name is required";
  } else if (formData.projectName.length > MAX_PROJECT_NAME_LENGTH) {
    errors.projectName = `Project name must be less than ${MAX_PROJECT_NAME_LENGTH} characters`;
  }

  if (formData.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.description = `Description must be less than ${MAX_DESCRIPTION_LENGTH} characters`;
  }

  return errors;
}

// ============================================================================
// COMPONENT
// ============================================================================

interface EditProjectPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * Edit Project Page Component
 */
export default function EditProjectPage({
  params,
}: EditProjectPageProps): React.ReactElement {
  const router = useRouter();
  const [projectId, setProjectId] = useState<string>("");

  // Unwrap params promise
  useEffect(() => {
    params.then((p) => setProjectId(p.id));
  }, [params]);

  const { user } = useAuth();

  // State management
  const [pageState, setPageState] = useState<PageState>({
    project: null,
    isLoadingProject: true,
    isSubmitting: false,
    error: null,
    successMessage: null,
    notFound: false,
    permissionDenied: false,
  });

  const [formData, setFormData] = useState<FormState>({
    projectName: "",
    description: "",
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  /**
   * Fetch project data on component mount
   */
  useEffect(() => {
    const fetchProject = async (): Promise<void> => {
      try {
        setPageState((prev) => ({
          ...prev,
          isLoadingProject: true,
          error: null,
          notFound: false,
          permissionDenied: false,
        }));

        const project = await apiClient.getProject(projectId);

        // Check permissions - only creator can edit
        if (!canEditProject(project, user?.id)) {
          setPageState((prev) => ({
            ...prev,
            isLoadingProject: false,
            permissionDenied: true,
          }));
          return;
        }

        // Set initial form data
        setFormData({
          projectName: project.projectName,
          description: project.description || "",
        });

        setPageState((prev) => ({
          ...prev,
          project,
          isLoadingProject: false,
        }));
      } catch (err) {
        const statusCode = err instanceof ApiClientError ? err.status : 500;
        const errorMessage =
          statusCode === 404
            ? "Project not found"
            : err instanceof ApiClientError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Failed to load project";

        if (statusCode === 404) {
          setPageState((prev) => ({
            ...prev,
            isLoadingProject: false,
            notFound: true,
          }));
        } else {
          setPageState((prev) => ({
            ...prev,
            isLoadingProject: false,
            error: errorMessage,
          }));
        }

        console.error("Error fetching project:", err);
      }
    };

    if (projectId) {
      fetchProject();
    }
  }, [projectId, user?.id]);

  // =========================================================================
  // FORM HANDLERS
  // =========================================================================

  /**
   * Handle form input changes
   */
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
      const updatePayload: UpdateProjectRequest = {
        projectName: formData.projectName,
        description: formData.description || null,
      };

      // Submit update
      await apiClient.updateProject(projectId, updatePayload);

      // Show success message
      setPageState((prev) => ({
        ...prev,
        isSubmitting: false,
        successMessage: "Project updated successfully!",
      }));

      // Redirect to project detail page after short delay
      setTimeout(() => {
        router.push(`/projects/${projectId}`);
      }, 1500);
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update project";

      setPageState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: errorMessage,
      }));

      console.error("Error updating project:", err);
    }
  };

  // =========================================================================
  // RENDERING
  // =========================================================================

  // Loading state
  if (pageState.isLoadingProject) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-gray-600">Loading project...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (pageState.notFound) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/projects" className="hover:text-blue-600">
            Projects
          </Link>
          <span>/</span>
          <span className="text-gray-600">Not Found</span>
        </div>

        <Card>
          <CardBody className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Project Not Found
            </h2>
            <p className="text-gray-600 mb-6">
              The project you are looking for does not exist or has been deleted.
            </p>
            <Link href="/projects">
              <Button>Back to Projects</Button>
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
          <Link href="/projects" className="hover:text-blue-600">
            Projects
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
              You do not have permission to edit this project. Only the project
              creator can edit project details.
            </p>
            <Link href="/projects">
              <Button>Back to Projects</Button>
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
        <Link href="/projects" className="hover:text-blue-600">
          Projects
        </Link>
        <span>/</span>
        {pageState.project && (
          <>
            <Link
              href={`/projects/${pageState.project.id}`}
              className="hover:text-blue-600"
            >
              {pageState.project.projectName}
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
          <CardTitle>Edit Project</CardTitle>
        </CardHeader>

        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Project Name Field */}
            <Input
              label="Project Name"
              name="projectName"
              type="text"
              placeholder="Enter project name"
              value={formData.projectName}
              onChange={handleInputChange}
              error={formErrors.projectName}
              required
              disabled={pageState.isSubmitting}
              maxLength={MAX_PROJECT_NAME_LENGTH}
            />

            {/* Description Field */}
            <Textarea
              label="Description"
              name="description"
              placeholder="Enter project description (optional)"
              value={formData.description}
              onChange={handleInputChange}
              error={formErrors.description}
              disabled={pageState.isSubmitting}
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={5}
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

              <Link href={`/projects/${projectId}`}>
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
          PROJECT INFO SECTION
          =================================================================== */}

      {pageState.project && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Project Information</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 font-medium">Creator</p>
                <p className="text-gray-900">
                  {pageState.project.creator?.displayName ||
                    pageState.project.creator?.username ||
                    "Unknown"}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Created</p>
                <p className="text-gray-900">
                  {new Date(pageState.project.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Last Updated</p>
                <p className="text-gray-900">
                  {new Date(pageState.project.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Project ID</p>
                <p className="text-gray-900 font-mono text-xs">
                  {pageState.project.id}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Collaborators</p>
                <p className="text-gray-900">
                  {pageState.project.collaborators?.length || 0}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Tasks</p>
                <p className="text-gray-900">
                  {pageState.project.tasks?.length || 0}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
