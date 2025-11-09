"use client";

/**
 * Projects Page Component
 * Displays all projects user created or collaborates on
 * Features:
 * - Grid layout of project cards (responsive 1/2/3 columns)
 * - Filter controls: Show/hide archived toggle
 * - Search bar: Filter by project name
 * - Create New Project button
 * - Empty state with helpful message
 * - Loading and error states
 * - Project sorting by creation date (newest first)
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { ProjectWithRelations } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardBody } from "@/components/ui/Card";
import { Spinner } from "@/components/ui/Spinner";
import Alert from "@/components/ui/Alert";
import { formatDate, truncateAtWord } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

interface ProjectsPageState {
  projects: ProjectWithRelations[];
  isLoading: boolean;
  error: string | null;
  showArchived: boolean;
  searchTerm: string;
}

// ============================================================================
// PROJECT CARD COMPONENT
// ============================================================================

interface ProjectCardProps {
  project: ProjectWithRelations;
  onClick?: () => void;
}

/**
 * Individual project card component
 */
function ProjectCard({ project, onClick }: ProjectCardProps): React.ReactElement {
  return (
    <div
      className="cursor-pointer"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      <Card className="hover:shadow-md transition-shadow h-full">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="truncate">{project.projectName}</CardTitle>
              <p className="text-sm text-gray-500 mt-1">
                by{" "}
                {project.creator.displayName ||
                  project.creator.username ||
                  project.creator.email}
              </p>
            </div>
            {project.archived && (
              <div className="flex-shrink-0">
                <span className="inline-block px-2 py-1 text-xs font-semibold text-gray-600 bg-gray-200 rounded">
                  Archived
                </span>
              </div>
            )}
          </div>
        </CardHeader>

        <CardBody>
          {project.description && (
            <p className="text-sm text-gray-600 mb-4">
              {truncateAtWord(project.description, 100)}
            </p>
          )}

          <div className="flex flex-col gap-2 text-xs text-gray-500">
            <div className="flex items-center justify-between">
              <span>
                {project.tasks?.length || 0}{" "}
                {(project.tasks?.length || 0) === 1 ? "task" : "tasks"}
              </span>
              <span>
                {project.collaborators?.length || 0}{" "}
                {(project.collaborators?.length || 0) === 1
                  ? "collaborator"
                  : "collaborators"}
              </span>
            </div>

            <div className="text-gray-500">
              Created: {formatDate(project.createdAt)}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

// ============================================================================
// FILTER COMPONENT
// ============================================================================

interface ProjectFiltersProps {
  showArchived: boolean;
  searchTerm: string;
  onShowArchivedChange: (show: boolean) => void;
  onSearchChange: (search: string) => void;
  onReset: () => void;
}

/**
 * Project filter controls component
 */
function ProjectFilters({
  showArchived,
  searchTerm,
  onShowArchivedChange,
  onSearchChange,
  onReset,
}: ProjectFiltersProps): React.ReactElement {
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onSearchChange(e.target.value);
    },
    [onSearchChange]
  );

  const handleToggleArchived = useCallback(() => {
    onShowArchivedChange(!showArchived);
  }, [showArchived, onShowArchivedChange]);

  const hasActiveFilters = searchTerm || showArchived;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Filters</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Input
            label="Search"
            placeholder="Search by project name..."
            value={searchTerm}
            onChange={handleSearchChange}
          />

          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={handleToggleArchived}
                className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">
                Show Archived
              </span>
            </label>
          </div>

          {hasActiveFilters && (
            <div className="flex items-end">
              <Button
                variant="secondary"
                size="md"
                onClick={onReset}
                className="w-full"
              >
                Reset Filters
              </Button>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ============================================================================
// MAIN PAGE COMPONENT
// ============================================================================

/**
 * Projects page component
 * Displays all projects user created or collaborates on with filtering capabilities
 */
export default function ProjectsPage(): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();

  const [state, setState] = useState<ProjectsPageState>({
    projects: [],
    isLoading: true,
    error: null,
    showArchived: false,
    searchTerm: "",
  });

  // ========================================================================
  // FETCH PROJECTS
  // ========================================================================

  const fetchProjects = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true, error: null }));

      const response = await apiClient.getProjects(1, 100);

      // Sort projects by creation date (newest first)
      const sortedProjects = response.data.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setState((prev) => ({
        ...prev,
        projects: sortedProjects,
        isLoading: false,
      }));
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to load projects";

      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  // Load projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // ========================================================================
  // FILTER AND SEARCH
  // ========================================================================

  const filteredProjects = useMemo(() => {
    return state.projects.filter((project) => {
      // Archived filter
      if (!state.showArchived && project.archived) {
        return false;
      }

      // Search filter (project name)
      if (state.searchTerm) {
        const searchLower = state.searchTerm.toLowerCase();
        const matchesName = project.projectName
          .toLowerCase()
          .includes(searchLower);
        const matchesDescription = project.description
          ?.toLowerCase()
          .includes(searchLower);

        if (!matchesName && !matchesDescription) {
          return false;
        }
      }

      return true;
    });
  }, [state.projects, state.showArchived, state.searchTerm]);

  // ========================================================================
  // HANDLERS
  // ========================================================================

  const handleShowArchivedChange = useCallback((show: boolean) => {
    setState((prev) => ({ ...prev, showArchived: show }));
  }, []);

  const handleSearchChange = useCallback((search: string) => {
    setState((prev) => ({ ...prev, searchTerm: search }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setState((prev) => ({
      ...prev,
      showArchived: false,
      searchTerm: "",
    }));
  }, []);

  const handleCreateProject = useCallback(() => {
    router.push("/projects/new");
  }, [router]);

  const handleProjectClick = useCallback(
    (projectId: string) => {
      router.push(`/projects/${projectId}`);
    },
    [router]
  );

  const handleRetry = useCallback(() => {
    fetchProjects();
  }, [fetchProjects]);

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Projects</h1>
          <p className="text-gray-600 mt-1">
            Organize and collaborate on household projects
          </p>
        </div>

        <Button variant="primary" size="lg" onClick={handleCreateProject}>
          Create Project
        </Button>
      </div>

      {/* Error Alert */}
      {state.error && (
        <Alert variant="error" className="mb-6" title="Error">
          {state.error}
          <button
            onClick={handleRetry}
            className="mt-2 text-sm underline hover:no-underline"
          >
            Try again
          </button>
        </Alert>
      )}

      {/* Filters */}
      <ProjectFilters
        showArchived={state.showArchived}
        searchTerm={state.searchTerm}
        onShowArchivedChange={handleShowArchivedChange}
        onSearchChange={handleSearchChange}
        onReset={handleResetFilters}
      />

      {/* Loading State */}
      {state.isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-4">
            <Spinner size="lg" color="primary" />
            <p className="text-gray-600 text-sm font-medium">
              Loading projects...
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!state.isLoading && filteredProjects.length === 0 && (
        <Card className="text-center py-12">
          <CardBody>
            <div className="flex flex-col items-center gap-4">
              <div className="text-5xl">📁</div>
              <h3 className="text-lg font-semibold text-white">
                {state.projects.length === 0
                  ? "No projects yet"
                  : "No projects match your filters"}
              </h3>
              <p className="text-gray-600 max-w-md">
                {state.projects.length === 0
                  ? "Get started by creating your first project to organize household tasks and collaborate with others."
                  : "Try adjusting your filters to find the projects you're looking for."}
              </p>

              {state.projects.length === 0 && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleCreateProject}
                  className="mt-2"
                >
                  Create First Project
                </Button>
              )}

              {state.projects.length > 0 && (
                <Button
                  variant="secondary"
                  size="md"
                  onClick={handleResetFilters}
                  className="mt-2"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Projects Grid */}
      {!state.isLoading && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              onClick={() => handleProjectClick(project.id)}
            />
          ))}
        </div>
      )}

      {/* Results Count */}
      {!state.isLoading && filteredProjects.length > 0 && (
        <div className="mt-8 text-center text-sm text-gray-600">
          Showing {filteredProjects.length} of {state.projects.length} projects
        </div>
      )}
    </div>
  );
}
