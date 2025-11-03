"use client";

/**
 * User Profile Page
 * Displays and allows editing of the current authenticated user's profile
 * Located at: /profile
 *
 * Features:
 * - Display current user profile information
 * - Edit user profile (display name, email)
 * - View account information (member since, last login)
 * - Role and status badges
 * - Success/error messages after save
 * - Breadcrumb navigation
 * - Responsive Card-based layout
 * - Loading states
 * - Full authentication check with redirect
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
  Input,
  Badge,
} from "@/components/ui";
import Alert from "@/components/ui/Alert";
import UserRoleBadge from "@/components/users/UserRoleBadge";
import { useAuth } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { formatDate, formatDateTime, toTitleCase } from "@/lib/utils";
import type { UserPublic } from "@/lib/types";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Form state interface
 */
interface FormState {
  displayName: string;
  email: string;
}

/**
 * Form errors interface
 */
interface FormErrors {
  displayName?: string;
  email?: string;
}

/**
 * Page state interface
 */
interface PageState {
  user: UserPublic | null;
  isLoading: boolean;
  isSubmitting: boolean;
  error: string | null;
  successMessage: string | null;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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
 * Get status badge variant
 */
function getStatusBadgeVariant(
  isActive: boolean
): "default" | "success" | "warning" | "danger" | "info" {
  return isActive ? "success" : "warning";
}

/**
 * Generate user initials from display name
 */
function getInitials(displayName: string): string {
  return displayName
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * Profile Page Component
 */
export default function ProfilePage(): React.ReactElement {
  const router = useRouter();
  const { user: authUser, isLoading: isAuthLoading } = useAuth();

  // State management
  const [pageState, setPageState] = useState<PageState>({
    user: null,
    isLoading: true,
    isSubmitting: false,
    error: null,
    successMessage: null,
  });

  const [formData, setFormData] = useState<FormState>({
    displayName: "",
    email: "",
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});

  // =========================================================================
  // DATA FETCHING
  // =========================================================================

  /**
   * Fetch current user profile on component mount
   */
  useEffect(() => {
    const fetchUserProfile = async (): Promise<void> => {
      try {
        setPageState((prev) => ({
          ...prev,
          isLoading: true,
          error: null,
        }));

        const user = await apiClient.getCurrentUser();

        // Set initial form data
        setFormData({
          displayName: user.displayName,
          email: user.email,
        });

        setPageState((prev) => ({
          ...prev,
          user,
          isLoading: false,
        }));
      } catch (err) {
        const errorMessage =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Failed to load profile";

        setPageState((prev) => ({
          ...prev,
          isLoading: false,
          error: errorMessage,
        }));

        console.error("Error fetching user profile:", err);
      }
    };

    if (!isAuthLoading && authUser) {
      fetchUserProfile();
    }
  }, [authUser, isAuthLoading]);

  // =========================================================================
  // FORM HANDLERS
  // =========================================================================

  /**
   * Handle form input changes
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
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
      const updatePayload = {
        displayName: formData.displayName,
        email: formData.email,
      };

      // Submit update - using the authenticated user's ID
      if (!authUser?.id) {
        throw new Error("User ID not found");
      }

      await apiClient.updateUser(authUser.id, updatePayload);

      // Show success message
      setPageState((prev) => ({
        ...prev,
        isSubmitting: false,
        successMessage: "Profile updated successfully!",
      }));

      // Refresh user data after a short delay
      setTimeout(async () => {
        try {
          const updatedUser = await apiClient.getCurrentUser();
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
          : "Failed to update profile";

      setPageState((prev) => ({
        ...prev,
        isSubmitting: false,
        error: errorMessage,
      }));

      console.error("Error updating profile:", err);
    }
  };

  // =========================================================================
  // RENDERING
  // =========================================================================

  // Check authentication - redirect if not authenticated
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!authUser) {
    router.push("/login");
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-400">Redirecting to login...</p>
      </div>
    );
  }

  // Loading state
  if (pageState.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" />
          <p className="text-slate-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  // Main profile render
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-8">
      {/* ===================================================================
          BREADCRUMB NAVIGATION
          =================================================================== */}

      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Link href="/dashboard" className="hover:text-blue-600">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-slate-100 font-medium">Profile</span>
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
          PROFILE HEADER CARD
          =================================================================== */}

      {pageState.user && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {/* Avatar/Initials Circle */}
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg">
                  {getInitials(pageState.user.displayName)}
                </div>

                {/* User Info */}
                <div>
                  <CardTitle>{pageState.user.displayName}</CardTitle>
                  <p className="text-sm text-slate-400 mt-1">
                    {pageState.user.email}
                  </p>
                </div>
              </div>

              {/* Role and Status Badges */}
              <div className="flex gap-2">
                <UserRoleBadge role={pageState.user.role} />
                <Badge variant={getStatusBadgeVariant(pageState.user.isActive)}>
                  {pageState.user.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </div>
          </CardHeader>
        </Card>
      )}

      {/* ===================================================================
          EDIT PROFILE FORM CARD
          =================================================================== */}

      <Card>
        <CardHeader>
          <CardTitle>Edit Profile</CardTitle>
        </CardHeader>

        <CardBody>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Display Name Field */}
            <Input
              label="Display Name"
              name="displayName"
              type="text"
              placeholder="Enter your display name"
              value={formData.displayName}
              onChange={handleInputChange}
              error={formErrors.displayName}
              required
              disabled={pageState.isSubmitting}
              maxLength={255}
            />

            {/* Email Field */}
            <Input
              label="Email Address"
              name="email"
              type="email"
              placeholder="Enter your email address"
              value={formData.email}
              onChange={handleInputChange}
              error={formErrors.email}
              required
              disabled={pageState.isSubmitting}
              maxLength={255}
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

              <Link href="/dashboard">
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
          ACCOUNT INFORMATION CARD
          =================================================================== */}

      {pageState.user && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account Information</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-slate-400 font-medium">Username</p>
                <p className="text-slate-100">{pageState.user.username}</p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Role</p>
                <p className="text-slate-100">
                  {toTitleCase(pageState.user.role.toLowerCase())}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Member Since</p>
                <p className="text-slate-100">
                  {formatDate(pageState.user.createdAt)}
                </p>
              </div>
              <div>
                <p className="text-slate-400 font-medium">Last Login</p>
                <p className="text-slate-100">
                  {pageState.user.lastLoginAt
                    ? formatDateTime(pageState.user.lastLoginAt)
                    : "Never"}
                </p>
              </div>
              <div className="col-span-2">
                <p className="text-slate-400 font-medium">User ID</p>
                <p className="text-slate-100 font-mono text-xs break-all">
                  {pageState.user.id}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
