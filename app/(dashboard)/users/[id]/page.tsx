"use client";

/**
 * User Detail/Edit Page
 * Allows Admin/Manager users to view and edit user information
 * Located at: /users/[id]
 *
 * Features:
 * - Display user information (name, email, role, status, created date, last login)
 * - Edit form for updating user data
 * - Role-based access control (Admin/Manager only)
 * - Manager restrictions (cannot edit Admin users or change to/from Admin)
 * - Admin-only delete functionality with confirmation
 * - User activity information display
 * - Loading, error, and 404 handling
 * - Breadcrumb navigation
 * - Form validation and error handling
 */

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CardFooter,
  Button,
  Spinner,
  Input,
  Select,
  Badge,
  Modal,
} from "@/components/ui";
import Alert from "@/components/ui/Alert";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { formatDate, formatDateTime, toTitleCase } from "@/lib/utils";
import type { UserPublic } from "@/lib/types";
import { UserRole } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Form state interface
 */
interface FormState {
  displayName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
}

/**
 * Form errors interface
 */
interface FormErrors {
  displayName?: string;
  email?: string;
  role?: string;
}

/**
 * Page state interface
 */
interface PageState {
  user: UserPublic | null;
  isLoadingUser: boolean;
  isSubmitting: boolean;
  isDeleting: boolean;
  error: string | null;
  successMessage: string | null;
  notFound: boolean;
  permissionDenied: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: UserRole.ADMIN, label: "Admin" },
  { value: UserRole.MANAGER, label: "Manager" },
  { value: UserRole.MEMBER, label: "Member" },
];

const STATUS_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if current user can edit the target user
 */
function canEditUser(
  targetUser: UserPublic | null,
  currentUser: { id: string; role: UserRole } | null
): boolean {
  if (!targetUser || !currentUser) {
    return false;
  }

  // Admin can edit anyone
  if (currentUser.role === "ADMIN") {
    return true;
  }

  // Manager can edit non-admin users
  if (currentUser.role === "MANAGER" && targetUser.role !== "ADMIN") {
    return true;
  }

  // Member cannot edit anyone
  return false;
}

/**
 * Check if current user can delete the target user
 */
function canDeleteUser(
  targetUser: UserPublic | null,
  currentUser: { id: string; role: UserRole } | null
): boolean {
  if (!targetUser || !currentUser) {
    return false;
  }

  // Only Admin can delete users
  if (currentUser.role !== "ADMIN") {
    return false;
  }

  // Cannot delete self
  if (targetUser.id === currentUser.id) {
    return false;
  }

  return true;
}

/**
 * Check if role change is allowed
 */
function canChangeRole(
  currentUserRole: UserRole,
  newRole: UserRole,
  targetUserRole: UserRole
): boolean {
  // Admin can change to any role
  if (currentUserRole === "ADMIN") {
    return true;
  }

  // Manager cannot change to or from Admin
  if (currentUserRole === "MANAGER") {
    if (newRole === "ADMIN" || targetUserRole === "ADMIN") {
      return false;
    }
    return true;
  }

  // Member cannot change roles
  return false;
}

/**
 * Validate form data
 */
function validateForm(formData: FormState): FormErrors {
  const errors: FormErrors = {};

  if (!formData.displayName.trim()) {
    errors.displayName = "Display name is required";
  } else if (formData.displayName.length > 255) {
    errors.displayName = "Display name must be less than 255 characters";
  }

  if (!formData.email.trim()) {
    errors.email = "Email is required";
  } else if (!formData.email.includes("@")) {
    errors.email = "Please enter a valid email address";
  } else if (formData.email.length > 255) {
    errors.email = "Email must be less than 255 characters";
  }

  return errors;
}

/**
 * Format role badge variant
 */
function getRoleBadgeVariant(
  role: UserRole
): "default" | "success" | "warning" | "danger" | "info" {
  switch (role) {
    case "ADMIN":
      return "danger";
    case "MANAGER":
      return "warning";
    case "MEMBER":
      return "success";
    default:
      return "default";
  }
}

/**
 * Format status badge variant
 */
function getStatusBadgeVariant(
  isActive: boolean
): "default" | "success" | "warning" | "danger" | "info" {
  return isActive ? "success" : "warning";
}

// ============================================================================
// COMPONENT
// ============================================================================

interface UserDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

/**
 * User Detail/Edit Page Component
 */
export default function UserDetailPage({
  params,
}: UserDetailPageProps): React.ReactElement {
  const router = useRouter();
  const [userId, setUserId] = useState<string>("");

  // Unwrap params promise
  useEffect(() => {
    params.then((p) => setUserId(p.id));
  }, [params]);
  const { user: currentUser } = useAuth();

  // State management
  const [pageState, setPageState] = useState<PageState>({
    user: null,
    isLoadingUser: true,
    isSubmitting: false,
    isDeleting: false,
    error: null,
    successMessage: null,
    notFound: false,
    permissionDenied: false,
  });

  const [formData, setFormData] = useState<FormState>({
    displayName: "",
    email: "",
    role: UserRole.MEMBER,
    isActive: true,
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showTempPasswordModal, setShowTempPasswordModal] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const canEdit =
    currentUser && canEditUser(pageState.user, currentUser) ? true : false;
  const canDelete =
    currentUser && canDeleteUser(pageState.user, currentUser) ? true : false;

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  /**
   * Fetch user data on component mount
   */
  useEffect(() => {
    const fetchUser = async (): Promise<void> => {
      try {
        setPageState((prev) => ({
          ...prev,
          isLoadingUser: true,
          error: null,
          notFound: false,
          permissionDenied: false,
        }));

        const user = await apiClient.getUser(userId);

        // Check permissions
        if (!currentUser || !canEditUser(user, currentUser)) {
          setPageState((prev) => ({
            ...prev,
            isLoadingUser: false,
            permissionDenied: true,
            user,
          }));
          return;
        }

        // Set initial form data
        setFormData({
          displayName: user.displayName,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
        });

        setPageState((prev) => ({
          ...prev,
          user,
          isLoadingUser: false,
        }));
      } catch (err) {
        const statusCode = err instanceof ApiClientError ? err.status : 500;
        const errorMessage =
          statusCode === 404
            ? "User not found"
            : err instanceof ApiClientError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to load user";

        if (statusCode === 404) {
          setPageState((prev) => ({
            ...prev,
            isLoadingUser: false,
            notFound: true,
          }));
        } else {
          setPageState((prev) => ({
            ...prev,
            isLoadingUser: false,
            error: errorMessage,
          }));
        }

        console.error("Error fetching user:", err);
      }
    };

    if (userId && currentUser) {
      fetchUser();
    }
  }, [userId, currentUser]);

  // =========================================================================
  // FORM HANDLERS
  // =========================================================================

  /**
   * Handle form input changes
   */
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ): void => {
    const { name, type, value } = e.target;

    if (type === "checkbox" && name === "isActive") {
      setFormData((prev) => ({
        ...prev,
        isActive: (e.target as HTMLInputElement).checked,
      }));
    } else if (name === "isActive") {
      setFormData((prev) => ({
        ...prev,
        isActive: value === "true",
      }));
    }
    if (name === "role") {
      // Validate role change
      if (
        currentUser &&
        !canChangeRole(
          currentUser.role,
          value as UserRole,
          (pageState.user?.role as UserRole) || UserRole.MEMBER
        )
      ) {
        setPageState((prev) => ({
          ...prev,
          error: "You do not have permission to change this role",
        }));
        return;
      }
      setFormData((prev) => ({
        ...prev,
        role: value as UserRole,
      }));
    } else {
      // Generic assignment for other fields; cast to FormState for TS
      setFormData((prev) => ({ ...(prev as any), [name]: value } as FormState));
    }

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
      const updatePayload = {
        displayName: formData.displayName,
        email: formData.email,
        role: formData.role,
        isActive: formData.isActive,
      };

      // Submit update
      await apiClient.updateUser(userId, updatePayload);

      // Show success message
      setPageState((prev) => ({
        ...prev,
        isSubmitting: false,
        successMessage: "User updated successfully!",
      }));

      // Refresh user data
      setTimeout(async () => {
        try {
          const updatedUser = await apiClient.getUser(userId);
          setPageState((prev) => ({
            ...prev,
            user: updatedUser,
          }));
        } catch (err) {
          console.error("Error refreshing user data:", err);
        }
      }, 1000);
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to update user";

      setPageState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: errorMessage,
      }));

      console.error("Error updating user:", err);
    }
  };

  /**
   * Handle user deletion
   */
  const handleDeleteUser = async (): Promise<void> => {
    try {
      setPageState((prev) => ({
        ...prev,
        isDeleting: true,
        error: null,
      }));

      await apiClient.deleteUser(userId);

      setPageState((prev) => ({
        ...prev,
        isDeleting: false,
        successMessage: "User deleted successfully!",
      }));

      // Redirect to users list after short delay
      setTimeout(() => {
        router.push("/users");
      }, 1500);
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to delete user";

      setPageState((prev) => ({
        ...prev,
        isDeleting: false,
        error: errorMessage,
      }));

      console.error("Error deleting user:", err);
    }
  };

  // =========================================================================
  // RENDERING
  // =========================================================================

  // Loading state
  if (pageState.isLoadingUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-gray-600">Loading user...</p>
        </div>
      </div>
    );
  }

  // Not found state
  if (pageState.notFound) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 py-8">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Link href="/dashboard" className="hover:text-blue-600">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/users" className="hover:text-blue-600">
            Users
          </Link>
          <span>/</span>
          <span className="text-gray-600">Not Found</span>
        </div>

        <Card>
          <CardBody className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-300 mb-2">
              User Not Found
            </h2>
            <p className="text-gray-600 mb-6">
              The user you are looking for does not exist or has been deleted.
            </p>
            <Link href="/users">
              <Button>Back to Users</Button>
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
          <Link href="/dashboard" className="hover:text-blue-600">
            Dashboard
          </Link>
          <span>/</span>
          <Link href="/users" className="hover:text-blue-600">
            Users
          </Link>
          <span>/</span>
          <span className="text-gray-600">Access Denied</span>
        </div>

        <Card>
          <CardBody className="text-center py-12">
            <h2 className="text-2xl font-bold text-gray-300 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 mb-6">
              You do not have permission to edit this user. Only Admin users and
              Managers (for non-admin users) can edit user information.
            </p>
            <Link href="/users">
              <Button>Back to Users</Button>
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
        <Link href="/users" className="hover:text-blue-600">
          Users
        </Link>
        <span>/</span>
        {pageState.user && (
          <span className="text-gray-300 font-medium">
            {pageState.user.displayName}
          </span>
        )}
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
          USER HEADER CARD
          =================================================================== */}

      {pageState.user && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{pageState.user.displayName}</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  {pageState.user.email}
                </p>
              </div>
              <div className="flex gap-2">
                <Badge variant={getRoleBadgeVariant(pageState.user.role)}>
                  {toTitleCase(pageState.user.role.toLowerCase())}
                </Badge>
                <Badge variant={getStatusBadgeVariant(pageState.user.isActive)}>
                  {pageState.user.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* ===================================================================
          EDIT FORM CARD
          =================================================================== */}

      <Card>
        <CardHeader>
          <CardTitle>Edit User Information</CardTitle>
        </CardHeader>

        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Display Name Field */}
            <Input
              label="Display Name"
              name="displayName"
              type="text"
              placeholder="Enter display name"
              value={formData.displayName}
              onChange={handleInputChange}
              error={formErrors.displayName}
              required
              disabled={pageState.isSubmitting || !canEdit}
              maxLength={255}
            />

            {/* Email Field */}
            <Input
              label="Email"
              name="email"
              type="email"
              placeholder="Enter email address"
              value={formData.email}
              onChange={handleInputChange}
              error={formErrors.email}
              required
              disabled={pageState.isSubmitting || !canEdit}
              maxLength={255}
            />

            {/* Role Field */}
            <Select
              label="Role"
              name="role"
              options={ROLE_OPTIONS}
              value={formData.role}
              onChange={handleInputChange}
              error={formErrors.role}
              required
              disabled={
                pageState.isSubmitting ||
                !canEdit ||
                (currentUser?.role === "MANAGER" &&
                  pageState.user?.role === "ADMIN")
              }
            />

            {/* Status Field */}
            <Select
              label="Status"
              name="isActive"
              options={STATUS_OPTIONS}
              value={formData.isActive ? "true" : "false"}
              onChange={handleInputChange}
              required
              disabled={pageState.isSubmitting || !canEdit}
            />

            {/* Form Actions */}
            <div className="flex gap-3 pt-6">
              <Button
                type="submit"
                variant="primary"
                disabled={pageState.isSubmitting || !canEdit}
                loading={pageState.isSubmitting}
              >
                {pageState.isSubmitting ? "Saving..." : "Save Changes"}
              </Button>

              <Link href="/users">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={pageState.isSubmitting}
                >
                  Cancel
                </Button>
              </Link>

              {canDelete && (
                <Button
                  type="button"
                  variant="danger"
                  disabled={pageState.isDeleting || pageState.isSubmitting}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Delete User
                </Button>
              )}
              {currentUser?.role === "ADMIN" && userId !== currentUser?.id && (
                <Button
                  type="button"
                  variant="danger"
                  disabled={pageState.isSubmitting}
                  onClick={() => setShowResetConfirm(true)}
                >
                  Reset Password
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>

      {/* ===================================================================
          USER INFO SECTION
          =================================================================== */}

      {pageState.user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Information</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 font-medium">Username</p>
                <p className="text-gray-300">{pageState.user.username}</p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Created</p>
                <p className="text-gray-300">
                  {formatDate(pageState.user.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Last Login</p>
                <p className="text-gray-300">
                  {pageState.user.lastLoginAt
                    ? formatDateTime(pageState.user.lastLoginAt)
                    : "Never"}
                </p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">User ID</p>
                <p className="text-gray-300 font-mono text-xs">
                  {pageState.user.id}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ===================================================================
          DELETE CONFIRMATION MODAL
          =================================================================== */}

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete User"
        size="md"
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={pageState.isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleDeleteUser}
              disabled={pageState.isDeleting}
              loading={pageState.isDeleting}
            >
              {pageState.isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-gray-700">
            Are you sure you want to delete this user? This action cannot be
            undone.
          </p>
          <div className="bg-red-50 border border-red-200 rounded p-3">
            <p className="text-sm text-red-800">
              <strong>User:</strong> {pageState.user?.displayName}
            </p>
            <p className="text-sm text-red-800">
              <strong>Email:</strong> {pageState.user?.email}
            </p>
          </div>
        </div>
      </Modal>

      {/* Reset Password Confirmation Modal */}
      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Reset Password"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowResetConfirm(false)}
              disabled={pageState.isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                try {
                  setPageState((prev) => ({
                    ...prev,
                    isSubmitting: true,
                    error: null,
                  }));
                  const result = await apiClient.resetUserPassword(userId);
                  setTempPassword(result.tempPassword);
                  setShowResetConfirm(false);
                  setShowTempPasswordModal(true);
                } catch (err) {
                  const errorMessage =
                    err instanceof ApiClientError
                      ? err.message
                      : err instanceof Error
                      ? err.message
                      : "Failed to reset password";
                  setPageState((prev) => ({ ...prev, error: errorMessage }));
                } finally {
                  setPageState((prev) => ({ ...prev, isSubmitting: false }));
                }
              }}
              disabled={pageState.isSubmitting}
            >
              Reset Password
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="font-semibold">
            You are about to reset this user&rsquo;s password.
          </p>
          <p className="text-sm text-gray-600">
            A temporary password will be generated and the user will be required
            to set a new password at next login. Continue?
          </p>
        </div>
      </Modal>

      {/* Temporary Password Modal (shown after reset) */}
      <Modal
        isOpen={showTempPasswordModal}
        onClose={() => {
          setShowTempPasswordModal(false);
          setTempPassword(null);
        }}
        title="Temporary Password"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setShowTempPasswordModal(false);
                setTempPassword(null);
              }}
            >
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                // Copy to clipboard
                if (tempPassword) navigator.clipboard.writeText(tempPassword);
              }}
            >
              Copy Password
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm">
            Provide the temporary password below to the user. They will be
            prompted to change it on next login.
          </p>
          <div className="rounded bg-slate-800 p-3 font-mono text-sm">
            {tempPassword}
          </div>
        </div>
      </Modal>
    </div>
  );
}
