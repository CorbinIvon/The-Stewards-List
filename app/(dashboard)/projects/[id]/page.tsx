"use client";

/**
 * Project Detail View Page
 * Displays comprehensive project information with collaborators, tasks, and management options
 * Includes permission checks, loading states, error handling, and 404 handling
 * Features tabs for Overview, Tasks, and Collaborators
 */

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import { Spinner } from "@/components/ui/Spinner";
import { useAuthUser } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import {
  formatDate,
  formatDateTime,
  toTitleCase,
  truncateAtWord,
} from "@/lib/utils";
import type {
  ProjectWithRelations,
  TaskWithOwner,
  UserRole,
} from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

type TabType = "overview" | "tasks" | "collaborators";

interface ProjectDetailState {
  project: ProjectWithRelations | null;
  tasks: TaskWithOwner[];
  isLoading: boolean;
  isLoadingTasks: boolean;
  error: string | null;
  isDeleting: boolean;
  isArchiving: boolean;
  showDeleteConfirm: boolean;
  activeTab: TabType;
}

interface PermissionState {
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canArchive: boolean;
  canManageCollaborators: boolean;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Determine if user has permission to perform actions on project
 */
function checkPermissions(
  project: ProjectWithRelations | null,
  currentUser: ReturnType<typeof useAuthUser>
): PermissionState {
  if (!project || !currentUser) {
    return {
      canView: false,
      canEdit: false,
      canDelete: false,
      canArchive: false,
      canManageCollaborators: false,
    };
  }

  // Admins have full permissions on all projects
  const isAdmin = currentUser.role === "ADMIN";

  // Project creator can manage their own projects
  const isCreator = project.creatorId === currentUser.id;

  // User can view if they are creator, collaborator, or admin
  const isCollaborator = project.collaborators.some(
    (c) => c.userId === currentUser.id
  );
  const canView = isCreator || isCollaborator || isAdmin;

  return {
    canView,
    canEdit: isCreator || isAdmin,
    canDelete: isAdmin,
    canArchive: isCreator || isAdmin,
    canManageCollaborators: isCreator || isAdmin,
  };
}

/**
 * Get appropriate badge variant for archived status
 */
function getStatusBadgeVariant(
  archived: boolean
): "success" | "warning" | "danger" | "info" | "default" {
  return archived ? "warning" : "success";
}

/**
 * Get human-readable archived status label
 */
function getStatusLabel(archived: boolean): string {
  return archived ? "Archived" : "Active";
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ProjectDetailPage(): React.ReactElement {
  const params = useParams();
  const router = useRouter();
  const currentUser = useAuthUser();
  const projectId = params?.id as string;

  const [state, setState] = useState<ProjectDetailState>({
    project: null,
    tasks: [],
    isLoading: true,
    isLoadingTasks: false,
    error: null,
    isDeleting: false,
    isArchiving: false,
    showDeleteConfirm: false,
    activeTab: "overview",
  });

  const permissions = checkPermissions(state.project, currentUser);

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  /**
   * Fetch project details from API
   */
  useEffect(() => {
    const fetchProject = async (): Promise<void> => {
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

        const project = await apiClient.getProject(projectId, true);
        setState((prev) => ({
          ...prev,
          project,
          isLoading: false,
        }));
      } catch (err) {
        const errorMessage =
          err instanceof ApiClientError
            ? err.status === 404
              ? "Project not found"
              : err.status === 403
                ? "You do not have permission to view this project"
                : err.message
            : err instanceof Error
              ? err.message
              : "Failed to load project";

        console.error("Project fetch error:", err);

        setState((prev) => ({
          ...prev,
          error: errorMessage,
          isLoading: false,
          project: null,
        }));
      }
    };

    fetchProject();
  }, [projectId]);

  /**
   * Fetch tasks for the project
   */
  useEffect(() => {
    const fetchTasks = async (): Promise<void> => {
      if (!state.project?.id) return;

      try {
        setState((prev) => ({
          ...prev,
          isLoadingTasks: true,
        }));

        const response = await apiClient.getTasks({
          projectId: state.project.id,
          pageSize: 100, // Load up to 100 tasks for the project
        });

        setState((prev) => ({
          ...prev,
          tasks: response.data,
          isLoadingTasks: false,
        }));
      } catch (err) {
        console.error("Failed to fetch project tasks:", err);
        setState((prev) => ({
          ...prev,
          isLoadingTasks: false,
          tasks: [],
        }));
      }
    };

    if (state.activeTab === "tasks") {
      fetchTasks();
    }
  }, [state.activeTab, state.project?.id]);

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  /**
   * Handle project deletion
   */
  const handleDelete = async (): Promise<void> => {
    if (!state.project) return;

    try {
      setState((prev) => ({
        ...prev,
        isDeleting: true,
      }));

      await apiClient.deleteProject(state.project.id);

      // Redirect to projects list after deletion
      router.push("/projects");
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to delete project";

      console.error("Delete error:", err);

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isDeleting: false,
        showDeleteConfirm: false,
      }));
    }
  };

  /**
   * Handle archive/unarchive toggle
   */
  const handleArchiveToggle = async (): Promise<void> => {
    if (!state.project) return;

    try {
      setState((prev) => ({
        ...prev,
        isArchiving: true,
        error: null,
      }));

      const updatedProject = await apiClient.updateProject(state.project.id, {
        archived: !state.project.archived,
      });

      setState((prev) => ({
        ...prev,
        project: updatedProject,
        isArchiving: false,
      }));
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Failed to update project status";

      console.error("Archive toggle error:", err);

      setState((prev) => ({
        ...prev,
        error: errorMessage,
        isArchiving: false,
      }));
    }
  };

  /**
   * Handle tab switching
   */
  const handleTabChange = (tab: TabType): void => {
    setState((prev) => ({
      ...prev,
      activeTab: tab,
    }));
  };

  /**
   * Handle collaborators list refresh
   */
  const handleCollaboratorsRefresh = async (): Promise<void> => {
    if (!state.project?.id) return;

    try {
      const updatedProject = await apiClient.getProject(state.project.id, true);
      setState((prev) => ({
        ...prev,
        project: updatedProject,
      }));
    } catch (err) {
      console.error("Failed to refresh collaborators:", err);
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
          <span>/</span>
          <span className="text-gray-900 font-medium">Not Found</span>
        </div>

        {/* Error Alert */}
        <Alert variant="error" title="Error">
          {state.error ||
            "Project not found. The project you are looking for does not exist or you do not have permission to view it."}
        </Alert>

        {/* Back Button */}
        <Link href="/projects">
          <Button variant="secondary">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  // =========================================================================
  // RENDER: PERMISSION DENIED STATE
  // =========================================================================

  if (!permissions.canView) {
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
          <span>/</span>
          <span className="text-gray-900 font-medium">Access Denied</span>
        </div>

        {/* Permission Denied Alert */}
        <Alert variant="error" title="Access Denied">
          You do not have permission to view this project. Only project
          collaborators and administrators can view this project.
        </Alert>

        {/* Back Button */}
        <Link href="/projects">
          <Button variant="secondary">Back to Projects</Button>
        </Link>
      </div>
    );
  }

  // =========================================================================
  // RENDER: SUCCESS STATE
  // =========================================================================

  return (
    <div className="max-w-6xl mx-auto space-y-6">
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
        <span className="text-gray-900 font-medium">
          {truncateAtWord(state.project.projectName, 50)}
        </span>
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
          DELETE CONFIRMATION DIALOG
          =================================================================== */}

      {state.showDeleteConfirm && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Delete Project</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            <p className="text-gray-700">
              Are you sure you want to delete this project? This action cannot
              be undone. All associated tasks will remain but will no longer be
              linked to this project.
            </p>
            <div className="flex gap-3">
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={state.isDeleting}
                loading={state.isDeleting}
              >
                Delete Project
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  setState((prev) => ({
                    ...prev,
                    showDeleteConfirm: false,
                  }))
                }
                disabled={state.isDeleting}
              >
                Cancel
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ===================================================================
          PROJECT HEADER WITH TITLE AND STATUS
          =================================================================== */}

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CardTitle className="text-2xl mb-3">
                {state.project.projectName}
              </CardTitle>
              <div className="flex flex-wrap gap-2">
                <Badge variant={getStatusBadgeVariant(state.project.archived)}>
                  {getStatusLabel(state.project.archived)}
                </Badge>
              </div>
            </div>
            <div className="flex-shrink-0 flex gap-2 flex-wrap justify-end">
              {permissions.canEdit && (
                <Link href={`/projects/${state.project.id}/edit`}>
                  <Button variant="secondary" size="md">
                    Edit
                  </Button>
                </Link>
              )}
              {permissions.canArchive && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleArchiveToggle}
                  disabled={state.isArchiving || state.isDeleting}
                  loading={state.isArchiving}
                >
                  {state.project.archived ? "Unarchive" : "Archive"}
                </Button>
              )}
              {permissions.canDelete && (
                <Button
                  variant="danger"
                  size="md"
                  onClick={() =>
                    setState((prev) => ({
                      ...prev,
                      showDeleteConfirm: true,
                    }))
                  }
                  disabled={state.isDeleting || state.isArchiving}
                >
                  Delete
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* ===================================================================
          TAB NAVIGATION
          =================================================================== */}

      <div className="flex gap-2 border-b border-slate-700">
        <button
          onClick={() => handleTabChange("overview")}
          className={`px-4 py-2 font-medium transition-colors ${
            state.activeTab === "overview"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-400"
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => handleTabChange("tasks")}
          className={`px-4 py-2 font-medium transition-colors ${
            state.activeTab === "tasks"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-400"
          }`}
        >
          Tasks ({state.project.tasks?.length || 0})
        </button>
        <button
          onClick={() => handleTabChange("collaborators")}
          className={`px-4 py-2 font-medium transition-colors ${
            state.activeTab === "collaborators"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-400"
          }`}
        >
          Collaborators ({state.project.collaborators?.length || 0})
        </button>
      </div>

      {/* ===================================================================
          OVERVIEW TAB
          =================================================================== */}

      {state.activeTab === "overview" && (
        <>
          {/* Description Section */}
          {state.project.description && (
            <Card>
              <CardHeader>
                <CardTitle>Description</CardTitle>
              </CardHeader>
              <CardBody>
                <p className="text-gray-700 whitespace-pre-wrap">
                  {state.project.description}
                </p>
              </CardBody>
            </Card>
          )}

          {/* Project Info Section */}
          <Card>
            <CardHeader>
              <CardTitle>Project Information</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Creator */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Creator</h4>
                  <p className="text-gray-700">
                    {state.project.creator?.username || "Unknown"}
                  </p>
                  {state.project.creator?.email && (
                    <p className="text-sm text-gray-500">
                      {state.project.creator.email}
                    </p>
                  )}
                </div>

                {/* Created Date */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Created</h4>
                  <p className="text-gray-700">
                    {formatDateTime(state.project.createdAt)}
                  </p>
                </div>

                {/* Last Updated */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">
                    Last Updated
                  </h4>
                  <p className="text-gray-700">
                    {formatDateTime(state.project.updatedAt)}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Status</h4>
                  <Badge
                    variant={getStatusBadgeVariant(state.project.archived)}
                  >
                    {getStatusLabel(state.project.archived)}
                  </Badge>
                </div>

                {/* Member Count */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Members</h4>
                  <p className="text-gray-700">
                    {(state.project.collaborators?.length || 0) + 1}
                  </p>
                </div>

                {/* Task Count */}
                <div>
                  <h4 className="font-medium text-gray-900 mb-2">Tasks</h4>
                  <p className="text-gray-700">
                    {state.project.tasks?.length || 0}
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </>
      )}

      {/* ===================================================================
          TASKS TAB
          =================================================================== */}

      {state.activeTab === "tasks" && (
        <Card>
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Project Tasks</CardTitle>
            <Link href={`/tasks/new?projectId=${state.project.id}`}>
              <Button variant="primary" size="sm">
                Add Task
              </Button>
            </Link>
          </CardHeader>
          <CardBody>
            {state.isLoadingTasks ? (
              <div className="flex items-center justify-center py-8">
                <Spinner size="md" />
              </div>
            ) : state.tasks.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  No tasks linked to this project yet.
                </p>
                <Link href={`/tasks/new?projectId=${state.project.id}`}>
                  <Button variant="primary">Create First Task</Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {state.tasks.map((task) => (
                  <Link
                    key={task.id}
                    href={`/tasks/${task.id}`}
                    className="block"
                  >
                    <div className="p-4 border border-slate-700 rounded-lg hover:bg-slate-700 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h5 className="font-medium text-slate-100 mb-1">
                            {truncateAtWord(task.title, 60)}
                          </h5>
                          {task.description && (
                            <p className="text-sm text-slate-400 line-clamp-2">
                              {truncateAtWord(task.description, 100)}
                            </p>
                          )}
                        </div>
                        <div className="flex-shrink-0 flex gap-2">
                          <Badge variant="info" size="sm">
                            {toTitleCase(task.status.replace(/_/g, " "))}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* ===================================================================
          COLLABORATORS TAB
          =================================================================== */}

      {state.activeTab === "collaborators" && (
        <Card>
          <CardHeader className="flex justify-between items-center">
            <CardTitle>Project Collaborators</CardTitle>
            {permissions.canManageCollaborators && (
              <Link href={`/projects/${state.project.id}/collaborators/add`}>
                <Button variant="primary" size="sm">
                  Add Collaborator
                </Button>
              </Link>
            )}
          </CardHeader>
          <CardBody>
            {state.project.collaborators && state.project.collaborators.length > 0 ? (
              <div className="space-y-3">
                {/* Project Creator */}
                <div className="p-4 border border-slate-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium text-slate-100">
                        {state.project.creator?.displayName ||
                          state.project.creator?.username ||
                          "Unknown"}
                      </h5>
                      <p className="text-sm text-slate-400">
                        {state.project.creator?.email}
                      </p>
                    </div>
                    <Badge variant="success" size="sm">
                      Creator
                    </Badge>
                  </div>
                </div>

                {/* Collaborators */}
                {state.project.collaborators.map((collaborator) => (
                  <div
                    key={collaborator.id}
                    className="p-4 border border-slate-700 rounded-lg"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-slate-100">
                          User ID: {collaborator.userId}
                        </p>
                        <p className="text-sm text-slate-400">
                          Added {formatDate(collaborator.addedAt)}
                        </p>
                      </div>
                      {permissions.canManageCollaborators && (
                        <Button variant="danger" size="sm">
                          Remove
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  No collaborators added yet.
                </p>
                {permissions.canManageCollaborators && (
                  <Link href={`/projects/${state.project.id}/collaborators/add`}>
                    <Button variant="primary">Add First Collaborator</Button>
                  </Link>
                )}
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
