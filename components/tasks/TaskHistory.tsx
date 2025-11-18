"use client";

/**
 * TaskHistory Component
 * Displays an audit trail/history of task logs showing all actions performed on a task
 * Fetches task logs from the API and displays them in reverse chronological order
 */

import React, { useEffect, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { Spinner } from "@/components/ui/Spinner";
import Alert from "@/components/ui/Alert";
import { apiClient } from "@/lib/api-client";
import { formatDateTime, toTitleCase } from "@/lib/utils";
import type { TaskLogWithRelations } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

interface TaskHistoryProps {
  taskId: string;
}

interface TaskHistoryState {
  logs: TaskLogWithRelations[];
  isLoading: boolean;
  error: string | null;
}

// ============================================================================
// ACTION TYPE TO BADGE VARIANT MAPPING
// ============================================================================

/**
 * Maps task log action types to badge variants for visual consistency
 */
const getActionBadgeVariant = (
  action: string
): "default" | "success" | "warning" | "danger" | "info" => {
  switch (action) {
    case "CREATED":
      return "success";
    case "UPDATED":
      return "info";
    case "COMPLETED":
      return "success";
    case "CANCELLED":
      return "danger";
    case "ASSIGNED":
      return "info";
    case "UNASSIGNED":
      return "warning";
    case "COMMENTED":
      return "default";
    default:
      return "default";
  }
};

/**
 * Gets a readable action label from the action enum value
 */
const getActionLabel = (action: string): string => {
  return toTitleCase(action.replace(/_/g, " "));
};

// ============================================================================
// RELATIVE TIME FORMATTING
// ============================================================================

/**
 * Formats a date as relative time (e.g., "2 hours ago", "yesterday")
 * @param date - The date to format
 * @returns Relative time string
 */
const formatRelativeTime = (date: Date | string): string => {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return "Invalid date";
  }

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffSecs < 60) {
    return "just now";
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins !== 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
  } else if (diffDays === 1) {
    return "yesterday";
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (diffWeeks < 4) {
    return `${diffWeeks} week${diffWeeks !== 1 ? "s" : ""} ago`;
  } else if (diffMonths < 12) {
    return `${diffMonths} month${diffMonths !== 1 ? "s" : ""} ago`;
  } else {
    return `${diffYears} year${diffYears !== 1 ? "s" : ""} ago`;
  }
};

// ============================================================================
// TASK HISTORY COMPONENT
// ============================================================================

/**
 * TaskHistory Component
 * Displays a timeline of all actions performed on a task
 *
 * Features:
 * - Fetches task logs from API endpoint
 * - Displays logs in reverse chronological order (newest first)
 * - Shows action type with color-coded badges
 * - Displays actor (user who performed the action)
 * - Shows relative timestamps (e.g., "2 hours ago")
 * - Displays notes/descriptions of changes
 * - Visual timeline with vertical line and bullets
 * - Loading state with spinner
 * - Empty state message
 * - Error handling with alert
 *
 * @param taskId - ID of the task to fetch logs for
 */
export default function TaskHistory({
  taskId,
}: TaskHistoryProps): React.ReactElement {
  const [state, setState] = useState<TaskHistoryState>({
    logs: [],
    isLoading: true,
    error: null,
  });

  /**
   * Fetch task logs on component mount and when taskId changes
   */
  useEffect(() => {
    const fetchLogs = async (): Promise<void> => {
      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        // Fetch all task logs for this task (no pagination limit for history view)
        const response = await apiClient.getTaskLogs(taskId, {
          page: 1,
          pageSize: 100,
        });

        // Sort logs in reverse chronological order (newest first)
        const sortedLogs = response.data.sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setState({
          logs: sortedLogs as TaskLogWithRelations[],
          isLoading: false,
          error: null,
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : "Failed to load task history";

        setState({
          logs: [],
          isLoading: false,
          error: errorMessage,
        });
      }
    };

    if (taskId) {
      fetchLogs();
    }
  }, [taskId]);

  // ========================================================================
  // RENDER STATES
  // ========================================================================

  // Loading state
  if (state.isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Task History</CardTitle>
        </CardHeader>
        <CardBody className="flex items-center justify-center py-12">
          <div className="flex flex-col items-center gap-3">
            <Spinner size="md" />
            <p className="text-sm text-slate-400">Loading task history...</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  // Error state
  if (state.error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Task History</CardTitle>
        </CardHeader>
        <CardBody>
          <Alert variant="error" title="Error">
            {state.error}
          </Alert>
        </CardBody>
      </Card>
    );
  }

  // Empty state
  if (state.logs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Task History</CardTitle>
        </CardHeader>
        <CardBody className="flex flex-col items-center justify-center py-12">
          <p className="text-sm text-slate-400">
            No history available for this task yet.
          </p>
        </CardBody>
      </Card>
    );
  }

  // ========================================================================
  // RENDER SUCCESS STATE
  // ========================================================================

  return (
    <Card>
      <CardHeader>
        <CardTitle>Task History</CardTitle>
      </CardHeader>
      <CardBody className="p-0">
        {/* Timeline container */}
        <div className="relative">
          {/* Vertical line through timeline */}
          <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-slate-700" />

          {/* Timeline entries */}
          <div className="space-y-0">
            {state.logs.map((log, index) => (
              <div
                key={log.id}
                className={`relative pl-20 py-4 px-6 ${
                  index !== state.logs.length - 1
                    ? "border-b border-slate-700"
                    : ""
                }`}
              >
                {/* Timeline bullet point */}
                <div
                  className="absolute left-2 top-6 w-3 h-3 rounded-full bg-blue-500 border-2 border-slate-800"
                  aria-hidden="true"
                />

                {/* Log entry content */}
                <div className="space-y-2">
                  {/* Header with action, actor, and timestamp */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Action badge */}
                    <Badge
                      variant={getActionBadgeVariant(log.action)}
                      size="sm"
                    >
                      {getActionLabel(log.action)}
                    </Badge>

                    {/* Actor name */}
                    <span className="text-sm font-medium text-slate-100">
                      {log.user?.displayName ||
                        log.user?.username ||
                        "Unknown User"}
                    </span>

                    {/* Relative timestamp */}
                    <span className="text-sm text-slate-400">
                      {formatRelativeTime(log.createdAt)}
                    </span>
                  </div>

                  {/* Full timestamp as secondary info */}
                  <div className="text-xs text-slate-500">
                    {formatDateTime(log.createdAt)}
                  </div>

                  {/* Notes/description if available */}
                  {log.note && (
                    <div className="mt-2 p-3 bg-slate-800 rounded text-sm text-slate-300 border border-slate-700">
                      {log.note}
                    </div>
                  )}

                  {/* Metadata if available */}
                  {log.metadata && Object.keys(log.metadata).length > 0 && (
                    <div className="mt-2 text-xs text-slate-400 font-mono bg-slate-800 p-2 rounded border border-slate-700 overflow-x-auto">
                      <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
