"use client";

/**
 * TaskAssignmentPicker Component
 * Dropdown selector for assigning tasks to users
 *
 * Features:
 * - Fetches list of active users from API on mount
 * - Displays users as selectable options in dropdown
 * - Includes "Unassigned" option
 * - Shows loading state while fetching users
 * - Displays error message if user fetch fails
 * - Shows user role badges next to names (optional)
 * - Calls onChange callback when selection changes
 */

import React, { useEffect, useState } from "react";
import Select from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import Alert from "@/components/ui/Alert";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { UserPublic } from "@/lib/types";

/**
 * TaskAssignmentPickerProps interface
 */
interface TaskAssignmentPickerProps {
  /** Current selected user ID (undefined if unassigned) */
  value?: string;
  /** Callback when selection changes */
  onChange: (userId: string | undefined) => void;
  /** Optional error message to display */
  error?: string;
  /** Optional label for the select */
  label?: string;
  /** Optional placeholder text */
  placeholder?: string;
  /** Whether to show role badges in options */
  showRoleBadges?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
}

/**
 * TaskAssignmentPicker Component
 *
 * A user picker component for task assignment with:
 * - Automatic user list fetching
 * - Loading and error states
 * - "Unassigned" option for clearing assignment
 * - Optional role badge display
 *
 * @example
 * ```tsx
 * <TaskAssignmentPicker
 *   value={task.assignedUserId}
 *   onChange={(userId) => assignTask(userId)}
 *   showRoleBadges={true}
 * />
 * ```
 */
export default function TaskAssignmentPicker({
  value,
  onChange,
  error,
  label = "Assign to User",
  placeholder = "Select a user...",
  showRoleBadges = false,
  disabled = false,
}: TaskAssignmentPickerProps): React.ReactElement {
  const [users, setUsers] = useState<UserPublic[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  /**
   * Fetch users from API on component mount
   */
  useEffect(() => {
    const fetchUsers = async (): Promise<void> => {
      try {
        setIsLoading(true);
        setFetchError(null);

        // Fetch users with pagination (get all active users)
        const response = await apiClient.getUsers({ page: 1, pageSize: 100 });

        // Filter to only active users and sort by display name
        const activeUsers = response.data
          .filter((user) => user.isActive)
          .sort((a, b) => a.displayName.localeCompare(b.displayName));

        setUsers(activeUsers);
      } catch (err) {
        const errorMessage =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Failed to fetch users";

        setFetchError(errorMessage);
        console.error("Error fetching users:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUsers();
  }, []);

  /**
   * Build select options array
   * Includes "Unassigned" as first option, then sorted user list
   */
  const options = [
    { value: "", label: "Unassigned" },
    ...users.map((user) => ({
      value: user.id,
      label: showRoleBadges ? `${user.displayName} (${user.role})` : user.displayName,
    })),
  ];

  /**
   * Handle select change
   * Converts empty string to undefined for "Unassigned" option
   */
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    const selectedValue = e.target.value;
    onChange(selectedValue === "" ? undefined : selectedValue);
  };

  // Show loading spinner while fetching users
  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <div className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50">
          <Spinner size="sm" />
          <span className="text-sm text-gray-600">Loading users...</span>
        </div>
      </div>
    );
  }

  // Show error alert if fetch failed
  if (fetchError) {
    return (
      <div className="flex flex-col gap-2">
        <Alert variant="error" onDismiss={() => setFetchError(null)}>
          Failed to load users: {fetchError}
        </Alert>
      </div>
    );
  }

  // Render select component with user options
  return (
    <Select
      label={label}
      options={options}
      value={value || ""}
      onChange={handleChange}
      placeholder={placeholder}
      error={error}
      disabled={disabled}
    />
  );
}
