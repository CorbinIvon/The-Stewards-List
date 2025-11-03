"use client";

/**
 * Users list page
 * Displays a paginated, filterable list of users
 * Admin/Manager only - Members are redirected to dashboard
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
  Badge,
} from "@/components/ui";
import Alert from "@/components/ui/Alert";
import { useAuth, useAuthUser } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import type { UserPublic, UserRole } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

interface UsersPageState {
  users: UserPublic[];
  isLoading: boolean;
  error: string | null;
  searchQuery: string;
  selectedRole: UserRole | "ALL";
  selectedStatus: "ALL" | "ACTIVE" | "INACTIVE";
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function UsersPage(): React.ReactElement {
  const router = useRouter();
  const currentUser = useAuthUser();
  const { isLoading: authLoading } = useAuth();

  const [state, setState] = useState<UsersPageState>({
    users: [],
    isLoading: true,
    error: null,
    searchQuery: "",
    selectedRole: "ALL",
    selectedStatus: "ALL",
  });

  // =========================================================================
  // AUTHORIZATION CHECK
  // =========================================================================

  useEffect(() => {
    // Wait for auth to load
    if (authLoading) return;

    // Check authorization - redirect Members to dashboard
    if (currentUser && currentUser.role === "MEMBER") {
      router.push("/dashboard");
      return;
    }

    // Redirect unauthenticated users to login
    if (!currentUser) {
      router.push("/login");
      return;
    }
  }, [currentUser, authLoading, router]);

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  useEffect(() => {
    const fetchUsers = async (): Promise<void> => {
      if (!currentUser || currentUser.role === "MEMBER") return;

      try {
        setState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        // Fetch users from API
        const response = await apiClient.getUsers({ pageSize: 100 });
        setState((prev) => ({
          ...prev,
          users: response.data,
          isLoading: false,
        }));
      } catch (err) {
        const errorMessage =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to load users";

        console.error("Users page error:", err);

        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));
      }
    };

    fetchUsers();
  }, [currentUser]);

  // =========================================================================
  // FILTERING & SEARCHING
  // =========================================================================

  /**
   * Filter users based on search query, role, and status
   */
  const filteredUsers = useMemo(() => {
    return state.users.filter((user) => {
      // Search filter (name or email)
      const query = state.searchQuery.toLowerCase();
      const matchesSearch =
        query === "" ||
        user.displayName.toLowerCase().includes(query) ||
        user.username.toLowerCase().includes(query) ||
        user.email.toLowerCase().includes(query);

      // Role filter
      const matchesRole =
        state.selectedRole === "ALL" || user.role === state.selectedRole;

      // Status filter
      const matchesStatus =
        state.selectedStatus === "ALL" ||
        (state.selectedStatus === "ACTIVE" && user.isActive) ||
        (state.selectedStatus === "INACTIVE" && !user.isActive);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [
    state.users,
    state.searchQuery,
    state.selectedRole,
    state.selectedStatus,
  ]);

  // =========================================================================
  // EVENT HANDLERS
  // =========================================================================

  /**
   * Handle search query change
   */
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setState((prev) => ({
        ...prev,
        searchQuery: e.target.value,
      }));
    },
    []
  );

  /**
   * Handle role filter change
   */
  const handleRoleChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setState((prev) => ({
        ...prev,
        selectedRole: e.target.value as UserRole | "ALL",
      }));
    },
    []
  );

  /**
   * Handle status filter change
   */
  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setState((prev) => ({
        ...prev,
        selectedStatus: e.target.value as "ALL" | "ACTIVE" | "INACTIVE",
      }));
    },
    []
  );

  /**
   * Dismiss error alert
   */
  const handleDismissError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================

  /**
   * Get badge variant for user role
   */
  function getRoleBadgeVariant(
    role: UserRole
  ): "info" | "warning" | "success" | "danger" | "default" {
    switch (role) {
      case "ADMIN":
        return "danger";
      case "MANAGER":
        return "warning";
      case "MEMBER":
      default:
        return "info";
    }
  }

  /**
   * Get badge variant for user status
   */
  function getStatusBadgeVariant(isActive: boolean): "success" | "default" {
    return isActive ? "success" : "default";
  }

  /**
   * Format role for display
   */
  function formatRole(role: UserRole): string {
    return role.charAt(0) + role.slice(1).toLowerCase();
  }

  // =========================================================================
  // RENDERING
  // =========================================================================

  if (authLoading || state.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-[color:var(--muted)]">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[color:var(--bg)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* ===================================================================
            BREADCRUMB & HEADER
            =================================================================== */}

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm text-[color:var(--muted)] mb-2">
              Dashboard <span className="mx-1">/</span> Users
            </div>
            <h1 className="text-3xl font-bold text-[color:var(--text)]">
              Users
            </h1>
            <p className="text-[color:var(--muted)] mt-1">
              Manage team members and their roles
            </p>
          </div>

          {/* Add User Button (Admin only) */}
          {currentUser?.role === "ADMIN" && (
            <Link href="/users/new">
              <Button variant="primary" size="md">
                Add User
              </Button>
            </Link>
          )}
        </div>

        {/* ===================================================================
            ERROR ALERT
            =================================================================== */}

        {state.error && (
          <Alert variant="error" title="Error" onDismiss={handleDismissError}>
            {state.error}
          </Alert>
        )}

        {/* ===================================================================
            FILTERS SECTION
            =================================================================== */}

        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Search Input */}
              <Input
                placeholder="Search by name, username, or email..."
                value={state.searchQuery}
                onChange={handleSearchChange}
                className="lg:col-span-1 sm:col-span-2"
              />

              {/* Role Filter */}
              <Select
                label="Filter by Role"
                options={[
                  { value: "ALL", label: "All Roles" },
                  { value: "ADMIN", label: "Admin" },
                  { value: "MANAGER", label: "Manager" },
                  { value: "MEMBER", label: "Member" },
                ]}
                value={state.selectedRole}
                onChange={handleRoleChange}
              />

              {/* Status Filter */}
              <Select
                label="Filter by Status"
                options={[
                  { value: "ALL", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
                value={state.selectedStatus}
                onChange={handleStatusChange}
              />
            </div>
          </CardBody>
        </Card>

        {/* ===================================================================
            USERS GRID
            =================================================================== */}

        {filteredUsers.length === 0 ? (
          <Card>
            <CardBody className="py-16">
              <div className="text-center">
                <p className="text-lg font-medium text-[color:var(--text)] mb-2">
                  {state.users.length === 0
                    ? "No users found"
                    : "No users match your filters"}
                </p>
                <p className="text-[color:var(--muted)]">
                  {state.users.length === 0
                    ? "Get started by creating your first user."
                    : "Try adjusting your filters to find what you are looking for."}
                </p>
              </div>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUsers.map((user) => (
              <Link key={user.id} href={`/users/${user.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardBody className="space-y-4">
                    {/* User Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-[color:var(--text)] truncate">
                          {user.displayName}
                        </h3>
                        <p className="text-sm text-[color:var(--muted)] truncate">
                          @{user.username}
                        </p>
                      </div>
                      <Badge variant={getRoleBadgeVariant(user.role)} size="sm">
                        {formatRole(user.role)}
                      </Badge>
                    </div>

                    {/* Email */}
                    <div className="pt-2 border-t border-[color:var(--border)]">
                      <p className="text-xs text-[color:var(--muted)] mb-1">
                        Email
                      </p>
                      <p className="text-sm text-[color:var(--text)] truncate">
                        {user.email}
                      </p>
                    </div>

                    {/* Status and Last Login */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Status</p>
                        <Badge
                          variant={getStatusBadgeVariant(user.isActive)}
                          size="sm"
                        >
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                      <div>
                        <p className="text-xs text-[color:var(--muted)] mb-1">
                          Last Login
                        </p>
                        <p className="text-sm text-[color:var(--text)]">
                          {user.lastLoginAt
                            ? new Date(user.lastLoginAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "short",
                                  day: "numeric",
                                }
                              )
                            : "Never"}
                        </p>
                      </div>
                    </div>

                    {/* Joined Date */}
                    <div className="pt-2 border-t border-gray-200">
                      <p className="text-xs text-[color:var(--muted)] mb-1">
                        Joined
                      </p>
                      <p className="text-sm text-[color:var(--text)]">
                        {new Date(user.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            ))}
          </div>
        )}

        {/* ===================================================================
            RESULTS COUNT
            =================================================================== */}

        {filteredUsers.length > 0 && (
          <div className="text-sm text-gray-600 text-center">
            Showing {filteredUsers.length} of {state.users.length} users
          </div>
        )}
      </div>
    </div>
  );
}
