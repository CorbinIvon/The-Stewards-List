"use client";

import React, { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth, useAuthUser } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardBody,
  CardFooter,
} from "@/components/ui/Card";
import Alert from "@/components/ui/Alert";
import Modal from "@/components/ui/Modal";
import { UserRole } from "@/lib/types";

// ============================================================================
// COMPONENT TYPES
// ============================================================================

interface AlertState {
  type: "success" | "error" | null;
  message: string;
}

// ============================================================================
// SETTINGS PAGE COMPONENT
// ============================================================================

/**
 * Settings page for user account management
 * Displays sections for:
 * - Security: password change
 * - Preferences: notifications, theme settings
 * - Account: account deletion (admin only)
 *
 * Features:
 * - Real-time feedback with success/error messages
 * - Confirmation dialogs for destructive actions
 * - Breadcrumb navigation
 * - Responsive layout with multiple Card sections
 * - Role-based access control
 */
export default function SettingsPage(): React.ReactElement {
  const router = useRouter();
  const { logout } = useAuth();
  const user = useAuthUser();

  // State management
  const [alert, setAlert] = useState<AlertState>({ type: null, message: "" });
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // ========================================================================
  // ALERT MANAGEMENT
  // ========================================================================

  /**
   * Display success alert message
   */
  const showSuccessAlert = useCallback((message: string): void => {
    setAlert({ type: "success", message });
  }, []);

  /**
   * Display error alert message
   */
  const showErrorAlert = useCallback((message: string): void => {
    setAlert({ type: "error", message });
  }, []);

  /**
   * Clear current alert
   */
  const clearAlert = useCallback((): void => {
    setAlert({ type: null, message: "" });
  }, []);

  // ========================================================================
  // ACCOUNT MANAGEMENT
  // ========================================================================

  /**
   * Handle account deletion
   * Only accessible to the current user for their own account
   * Shows confirmation dialog before proceeding
   */
  const handleDeleteAccount = useCallback(async (): Promise<void> => {
    if (!user) {
      showErrorAlert("User information not available");
      return;
    }

    try {
      setIsDeleting(true);
      clearAlert();

      // Call API to delete account
      await apiClient.deleteUser(user.id);

      // Show success message
      showSuccessAlert(
        "Your account has been successfully deleted. Redirecting..."
      );

      // Wait a moment for user to see message, then logout and redirect
      setTimeout(async () => {
        await logout();
        router.push("/");
      }, 2000);
    } catch (err) {
      const errorMessage =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to delete account";

      showErrorAlert(errorMessage);
      setIsDeleteModalOpen(false);
    } finally {
      setIsDeleting(false);
    }
  }, [user, logout, router, showErrorAlert, showSuccessAlert, clearAlert]);

  /**
   * Open delete account confirmation modal
   */
  const openDeleteModal = useCallback((): void => {
    clearAlert();
    setIsDeleteModalOpen(true);
  }, [clearAlert]);

  /**
   * Close delete account confirmation modal
   */
  const closeDeleteModal = useCallback((): void => {
    setIsDeleteModalOpen(false);
  }, []);

  // ========================================================================
  // PREFERENCES MANAGEMENT
  // ========================================================================

  /**
   * Handle notifications preference toggle
   */
  const handleNotificationsToggle = useCallback((): void => {
    setNotificationsEnabled((prev) => !prev);
    showSuccessAlert(
      `Notifications ${!notificationsEnabled ? "enabled" : "disabled"}`
    );
  }, [notificationsEnabled, showSuccessAlert]);

  /**
   * Handle theme preference change
   */
  const handleThemeChange = useCallback(
    (newTheme: "light" | "dark"): void => {
      setTheme(newTheme);
      showSuccessAlert(`Theme changed to ${newTheme} mode`);
    },
    [showSuccessAlert]
  );

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Header and Breadcrumb */}
      <div className="border-b border-slate-700 bg-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
          {/* Breadcrumb removed - page header only */}

          <h1 className="text-3xl font-bold text-slate-100">Settings</h1>
          <p className="mt-1 text-slate-400">
            Manage your account settings, preferences, and security options
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Alert Messages */}
        {alert.type && (
          <div className="mb-6">
            <Alert
              variant={alert.type === "success" ? "success" : "error"}
              title={alert.type === "success" ? "Success" : "Error"}
              onDismiss={clearAlert}
            >
              {alert.message}
            </Alert>
          </div>
        )}

        <div className="space-y-8">
          {/* SECURITY SECTION */}
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-300">Password</h4>
                <p className="mt-1 text-sm text-gray-600">
                  Change your password to keep your account secure
                </p>
              </div>

              {/* Password Change Form Placeholder */}
              <div className="rounded-lg bg-slate-800 p-4">
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="current-password"
                      className="block text-sm font-medium text-gray-500"
                    >
                      Current Password
                    </label>
                    <input
                      id="current-password"
                      type="password"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-300 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Enter your current password"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="new-password"
                      className="block text-sm font-medium text-gray-500"
                    >
                      New Password
                    </label>
                    <input
                      id="new-password"
                      type="password"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-300 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Enter a new password"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="confirm-password"
                      className="block text-sm font-medium text-gray-500"
                    >
                      Confirm New Password
                    </label>
                    <input
                      id="confirm-password"
                      type="password"
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-300 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Confirm your new password"
                    />
                  </div>
                </div>
              </div>
            </CardBody>
            <CardFooter className="bg-slate-800">
              <Button variant="primary" size="md">
                Update Password
              </Button>
            </CardFooter>
          </Card>

          {/* PREFERENCES SECTION */}
          <Card>
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardBody className="space-y-6">
              {/* Notifications Preference */}
              <div className="flex items-center justify-between border-b border-slate-700 pb-4">
                <div>
                  <h4 className="font-semibold text-slate-100">
                    Notifications
                  </h4>
                  <p className="mt-1 text-sm text-slate-400">
                    Receive email notifications about task updates and reminders
                  </p>
                </div>
                <Button
                  variant={notificationsEnabled ? "primary" : "secondary"}
                  size="sm"
                  onClick={handleNotificationsToggle}
                >
                  {notificationsEnabled ? "Enabled" : "Disabled"}
                </Button>
              </div>

              {/* Theme Preference */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-gray-300">Theme</h4>
                  <p className="mt-1 text-sm text-gray-600">
                    Choose your preferred application theme
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant={theme === "light" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => handleThemeChange("light")}
                  >
                    Light
                  </Button>
                  <Button
                    variant={theme === "dark" ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => handleThemeChange("dark")}
                  >
                    Dark
                  </Button>
                </div>
              </div>
            </CardBody>
          </Card>

          {/* ACCOUNT SECTION - ADMIN ONLY */}
          {user && user.role === UserRole.ADMIN && (
            <Card className="border-red-200 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-900">Danger Zone</CardTitle>
              </CardHeader>
              <CardBody className="space-y-4">
                <div>
                  <h4 className="font-semibold text-red-900">Delete Account</h4>
                  <p className="mt-1 text-sm text-red-800">
                    Permanently delete your account and all associated data.
                    This action cannot be undone.
                  </p>
                </div>
              </CardBody>
              <CardFooter className="bg-red-100">
                <Button
                  variant="danger"
                  size="md"
                  onClick={openDeleteModal}
                  disabled={isDeleting}
                >
                  Delete Account
                </Button>
              </CardFooter>
            </Card>
          )}

          {/* ACCOUNT INFO SECTION */}
          <Card>
            <CardHeader>
              <CardTitle>Account Information</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Email
                  </label>
                  <p className="mt-1 text-gray-300">{user?.email}</p>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Username
                  </label>
                  <p className="mt-1 text-gray-300">{user?.username}</p>
                </div>

                {/* Role */}
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Role
                  </label>
                  <p className="mt-1 text-gray-300 capitalize">
                    {user?.role.toLowerCase()}
                  </p>
                </div>

                {/* Account Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Account Status
                  </label>
                  <p className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        user?.isActive
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {user?.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        title="Delete Account"
        size="md"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={closeDeleteModal}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              size="md"
              onClick={handleDeleteAccount}
              loading={isDeleting}
              disabled={isDeleting}
            >
              Delete Account
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="rounded-lg bg-red-50 p-4">
            <p className="text-sm font-semibold text-red-900">Warning</p>
            <p className="mt-2 text-sm text-red-800">
              This action is permanent and cannot be undone. Your account and
              all associated data will be permanently deleted.
            </p>
          </div>

          <p className="text-sm text-gray-600">
            Are you sure you want to delete your account? Please confirm this
            action by clicking the &quot;Delete Account&quot; button below.
          </p>
        </div>
      </Modal>
    </div>
  );
}
