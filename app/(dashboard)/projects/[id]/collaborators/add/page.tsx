"use client";

/**
 * Add Project Collaborator Page
 * Allows project creators to add users as collaborators to their projects
 * Includes user selection, duplicate prevention, and error handling
 */

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { useAuthUser } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { UserPublic, ProjectWithRelations } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

interface PageState {
  project: ProjectWithRelations | null;
  availableUsers: UserPublic[];
  selectedUserId: string;
  isLoading: boolean;
  isLoadingUsers: boolean;
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AddCollaboratorPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const currentUser = useAuthUser();
  const projectId = params?.id as string;

  const [state, setState] = useState<PageState>({
    project: null,
    availableUsers: [],
    selectedUserId: "",
    isLoading: true,
    isLoadingUsers: false,
    isSubmitting: false,
    error: null,
    successMessage: null,
  });

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  /**
   * Fetch project details and list of available users
   */
  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      if (!projectId) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: "Invalid project ID",
        }));
        return;
      }

      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        // Fetch project details
        const project = await apiClient.getProject(projectId, true);

        // Verify user has permission to manage collaborators
        const isCreator = project.creatorId === currentUser?.id;
        const isAdmin = currentUser?.role === "ADMIN";

        if (!isCreator && !isAdmin) {
          setState((prev) => ({
            ...prev,
            error:
              "You do not have permission to manage collaborators for this project",
            isLoading: false,
            project: null,
          }));
          return;
        }

        // Fetch all available users
        setState((prev) => ({
          ...prev,
          isLoadingUsers: true,
        }));

        const response = await apiClient.getUsers({ pageSize: 100 });

        // Filter out:
        // 1. Current user
        // 2. Project creator
        // 3. Existing collaborators
        const existingUserIds = new Set(
          project.collaborators.map((c) => c.userId)
        );
        existingUserIds.add(project.creatorId);
        existingUserIds.add(currentUser?.id || "");

        const filteredUsers = response.data.filter(
          (user) => !existingUserIds.has(user.id)
        );

        setState((prev) => ({
          ...prev,
          project,
          availableUsers: filteredUsers,
          isLoading: false,
          isLoadingUsers: false,
          selectedUserId: filteredUsers.length > 0 ? filteredUsers[0].id : "",
        }));
      } catch (err) {
        const errorMessage =
          err instanceof ApiClientError
            ? err.status === 404
              ? "Project not found"
              : err.status === 403
                ? "You do not have permission to manage collaborators"
                : err.message
            : err instanceof Error
              ? err.message
              : "Failed to load data";

        console.error("Data fetch error:", err);

        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          isLoadingUsers: false,
          project: null,
        }));
      }
    };

    fetchData();
  }, [projectId, currentUser?.id, currentUser?.role]);

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  /**
   * Handle adding collaborator
   */
  const handleAddCollaborator = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    if (!state.project || !state.selectedUserId) {
      setState((prev) => ({
        ...prev,
        error: "Please select a user",
      }));
      return;
    }

    try {
      setState((prev) => ({
        ...prev,
        isSubmitting: true,
        error: null,
      }));

      // Add collaborator via API
      await apiClient.addProjectCollaborator(state.project.id, state.selectedUserId);

      // Show success message
      setState((prev) => ({
        ...prev,
        isSubmitting: false,
        successMessage: "Collaborator added successfully! Redirecting...",
      }));

      // Redirect back to project detail page after brief delay
      setTimeout(() => {
        router.push(`/projects/${state.project!.id}`);
      }, 500);
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.status === 409
            ? "This user is already a collaborator on this project"
            : err.message
          : err instanceof Error
            ? err.message
            : "Failed to add collaborator";

      console.error("Add collaborator error:", err);

      setState((prev) => ({
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
    if (state.project) {
      router.push(`/projects/${state.project.id}`);
    } else {
      router.push("/projects");
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
          <p className="text-gray-600">Loading project details...</p>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER: ERROR / NOT FOUND STATE
  // =========================================================================

  if (!state.project || state.error) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-600 flex gap-2">
          <Link href="/dashboard" className="hover:text-blue-600">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/projects" className="hover:text-blue-600">
            Projects
          </Link>
          {state.project && (
            <>
              <span>/</span>
              <Link
                href={`/projects/${state.project.id}`}
                className="hover:text-blue-600"
              >
                {state.project.projectName}
              </Link>
              <span>/</span>
              <span className="text-gray-300 font-medium">Add Collaborator</span>
            </>
          )}
        </div>

        {/* Error Alert */}
        <Alert variant="error" title="Error">
          {state.error ||
            "Project not found or you do not have permission to access this project."}
        </Alert>

        {/* Back Button */}
        <Link href={state.project ? `/projects/${state.project.id}` : "/projects"}>
          <Button variant="secondary">Back</Button>
        </Link>
      </div>
    );
  }

  // =========================================================================
  // RENDER: NO AVAILABLE USERS STATE
  // =========================================================================

  if (state.availableUsers.length === 0) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Breadcrumb */}
        <div className="text-sm text-gray-600 flex gap-2">
          <Link href="/dashboard" className="hover:text-blue-600">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/projects" className="hover:text-blue-600">
            Projects
          </Link>
          <span>/</span>
          <Link
            href={`/projects/${state.project.id}`}
            className="hover:text-blue-600"
          >
            {state.project.projectName}
          </Link>
          <span>/</span>
          <span className="text-gray-300 font-medium">Add Collaborator</span>
        </div>

        {/* No Users Alert */}
        <Alert variant="info" title="No Available Users">
          All users in the system are already collaborators on this project or
          cannot be added. You may need to create more users first.
        </Alert>

        {/* Back Button */}
        <Link href={`/projects/${state.project.id}`}>
          <Button variant="secondary">Back to Project</Button>
        </Link>
      </div>
    );
  }

  // =========================================================================
  // RENDER: SUCCESS STATE
  // =========================================================================

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* ===================================================================
          BREADCRUMB NAVIGATION
          =================================================================== */}

      <nav className="text-sm text-gray-600 flex gap-2">
        <Link href="/dashboard" className="hover:text-blue-600 transition">
          Dashboard
        </Link>
        <span>/</span>
        <Link href="/projects" className="hover:text-blue-600 transition">
          Projects
        </Link>
        <span>/</span>
        <Link
          href={`/projects/${state.project.id}`}
          className="hover:text-blue-600 transition"
        >
          {state.project.projectName}
        </Link>
        <span>/</span>
        <span className="text-gray-300 font-medium">Add Collaborator</span>
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
          SUCCESS ALERT
          =================================================================== */}

      {state.successMessage && (
        <Alert variant="success" title="Success">
          {state.successMessage}
        </Alert>
      )}

      {/* ===================================================================
          FORM CARD
          =================================================================== */}

      <Card>
        <CardHeader>
          <CardTitle>Add Collaborator to {state.project.projectName}</CardTitle>
        </CardHeader>

        <form onSubmit={handleAddCollaborator}>
          <CardBody className="space-y-6">
            {/* User Selection */}
            <div>
              <label htmlFor="userId" className="block text-sm font-medium text-gray-300 mb-2">
                Select User
              </label>
              <select
                id="userId"
                value={state.selectedUserId}
                onChange={(e) =>
                  setState((prev) => ({
                    ...prev,
                    selectedUserId: e.target.value,
                  }))
                }
                disabled={state.isSubmitting || state.isLoadingUsers}
                className="w-full px-4 py-2 rounded-lg border border-slate-600 bg-slate-800 text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">-- Select a user --</option>
                {state.availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.displayName || user.username} ({user.email})
                  </option>
                ))}
              </select>
              <p className="text-sm text-gray-400 mt-2">
                {state.availableUsers.length} available user
                {state.availableUsers.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Info Section */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-slate-700">
                <strong>Note:</strong> Once added, this user will be able to view
                and interact with all tasks in this project. You can manage their
                permissions after they are added as a collaborator.
              </p>
            </div>
          </CardBody>

          {/* ===============================================================
              FORM FOOTER WITH ACTIONS
              =============================================================== */}

          <div className="border-t border-slate-700 px-6 py-4 flex gap-3 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={state.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              loading={state.isSubmitting}
              disabled={state.isSubmitting || !state.selectedUserId}
            >
              {state.isSubmitting ? "Adding..." : "Add Collaborator"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
