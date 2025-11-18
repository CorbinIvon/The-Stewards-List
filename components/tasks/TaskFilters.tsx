"use client";

import React, { useCallback } from "react";
import { TaskStatus, TaskPriority, User } from "@/lib/types";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

/**
 * Task filters interface for filtering tasks by search, status, priority, and assignee
 * undefined/null values represent "All" (no filter applied)
 */
export interface TaskFilters {
  /** Search query for title and description */
  search?: string;
  /** Filter by task status - undefined means show all statuses */
  status?: TaskStatus;
  /** Filter by task priority - undefined means show all priorities */
  priority?: TaskPriority;
  /** Filter by assignee user ID - undefined means show all assignees */
  assigneeId?: string;
}

/**
 * Props for TaskFilters component
 */
export interface TaskFiltersProps {
  /** Current filter values */
  filters: TaskFilters;
  /** Callback when filters change */
  onFiltersChange: (filters: TaskFilters) => void;
  /** Available users for assignee filter */
  users: User[];
  /** Additional CSS classes */
  className?: string;
}

/**
 * TaskFilters - Component for filtering tasks
 *
 * Features:
 * - Search input for title/description (text search)
 * - Status dropdown filter (All, TODO, IN_PROGRESS, COMPLETED, CANCELLED)
 * - Priority dropdown filter (All, LOW, MEDIUM, HIGH, URGENT)
 * - Assignee dropdown filter (All, specific users)
 * - Clear Filters button to reset all filters
 * - Responsive layout (horizontal on desktop, stacked on mobile)
 * - Controlled inputs with callbacks to parent
 *
 * @param props - TaskFiltersProps
 * @returns JSX element
 */
export default function TaskFilters({
  filters,
  onFiltersChange,
  users,
  className,
}: TaskFiltersProps): React.ReactElement {
  /**
   * Handles search input change
   */
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const searchValue = e.target.value;
      onFiltersChange({
        ...filters,
        search: searchValue || undefined,
      });
    },
    [filters, onFiltersChange]
  );

  /**
   * Handles status dropdown change
   */
  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const statusValue = e.target.value;
      onFiltersChange({
        ...filters,
        status: (statusValue as TaskStatus) || undefined,
      });
    },
    [filters, onFiltersChange]
  );

  /**
   * Handles priority dropdown change
   */
  const handlePriorityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const priorityValue = e.target.value;
      onFiltersChange({
        ...filters,
        priority: (priorityValue as TaskPriority) || undefined,
      });
    },
    [filters, onFiltersChange]
  );

  /**
   * Handles assignee dropdown change
   */
  const handleAssigneeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const assigneeValue = e.target.value;
      onFiltersChange({
        ...filters,
        assigneeId: assigneeValue || undefined,
      });
    },
    [filters, onFiltersChange]
  );

  /**
   * Clears all filters
   */
  const handleClearFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  /**
   * Checks if any filters are active
   */
  const hasActiveFilters =
    filters.search || filters.status || filters.priority || filters.assigneeId;

  /**
   * Status options for the dropdown
   */
  const statusOptions = [
    { value: "", label: "All Statuses" },
    { value: TaskStatus.TODO, label: "To Do" },
    { value: TaskStatus.IN_PROGRESS, label: "In Progress" },
    { value: TaskStatus.COMPLETED, label: "Completed" },
    { value: TaskStatus.CANCELLED, label: "Cancelled" },
  ];

  /**
   * Priority options for the dropdown
   */
  const priorityOptions = [
    { value: "", label: "All Priorities" },
    { value: TaskPriority.LOW, label: "Low" },
    { value: TaskPriority.MEDIUM, label: "Medium" },
    { value: TaskPriority.HIGH, label: "High" },
    { value: TaskPriority.URGENT, label: "Urgent" },
  ];

  /**
   * Assignee options for the dropdown
   */
  const assigneeOptions = [
    { value: "", label: "All Assignees" },
    ...users.map((user) => ({
      value: user.id,
      label: user.displayName || user.username,
    })),
  ];

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-4",
        className
      )}
    >
      {/* Title/Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-300">Filters</h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-gray-600 hover:text-gray-300"
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Filters Grid - Responsive layout */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {/* Search Input */}
        <Input
          label="Search"
          type="text"
          placeholder="Search by title or description..."
          value={filters.search || ""}
          onChange={handleSearchChange}
          className="w-full"
        />

        {/* Status Filter */}
        <Select
          label="Status"
          name="status"
          value={filters.status || ""}
          onChange={handleStatusChange}
          options={statusOptions}
          className="w-full"
        />

        {/* Priority Filter */}
        <Select
          label="Priority"
          name="priority"
          value={filters.priority || ""}
          onChange={handlePriorityChange}
          options={priorityOptions}
          className="w-full"
        />

        {/* Assignee Filter */}
        <Select
          label="Assignee"
          name="assignee"
          value={filters.assigneeId || ""}
          onChange={handleAssigneeChange}
          options={assigneeOptions}
          className="w-full"
        />
      </div>

      {/* Active Filters Display */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 border-t border-gray-200 pt-3">
          {filters.search && (
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              <span>Search: {filters.search}</span>
              <button
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    search: undefined,
                  })
                }
                className="ml-1 font-semibold hover:text-blue-900"
                aria-label="Clear search filter"
              >
                ×
              </button>
            </div>
          )}
          {filters.status && (
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              <span>Status: {filters.status.replace(/_/g, " ")}</span>
              <button
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    status: undefined,
                  })
                }
                className="ml-1 font-semibold hover:text-blue-900"
                aria-label="Clear status filter"
              >
                ×
              </button>
            </div>
          )}
          {filters.priority && (
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              <span>Priority: {filters.priority}</span>
              <button
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    priority: undefined,
                  })
                }
                className="ml-1 font-semibold hover:text-blue-900"
                aria-label="Clear priority filter"
              >
                ×
              </button>
            </div>
          )}
          {filters.assigneeId && (
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700">
              <span>
                Assignee:{" "}
                {
                  users.find((u) => u.id === filters.assigneeId)
                    ?.displayName ||
                    users.find((u) => u.id === filters.assigneeId)?.username ||
                    "Unknown"
                }
              </span>
              <button
                onClick={() =>
                  onFiltersChange({
                    ...filters,
                    assigneeId: undefined,
                  })
                }
                className="ml-1 font-semibold hover:text-blue-900"
                aria-label="Clear assignee filter"
              >
                ×
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
