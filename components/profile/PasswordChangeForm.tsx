"use client";

/**
 * PasswordChangeForm Component
 * Secure password change form with validation and strength indicator
 * Features: password strength indicator, show/hide toggles, comprehensive validation
 */

import React, { useState, useCallback } from "react";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { Card, CardBody, CardHeader, CardTitle, CardFooter } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Alert from "@/components/ui/Alert";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Password change request payload
 */
interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

/**
 * Form state for password change
 */
interface FormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  showCurrentPassword: boolean;
  showNewPassword: boolean;
  showConfirmPassword: boolean;
}

/**
 * Validation errors for each field
 */
interface ValidationErrors {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
}

/**
 * Alert state
 */
interface AlertState {
  type: "success" | "error" | null;
  message: string;
}

// ============================================================================
// PASSWORD STRENGTH INDICATOR
// ============================================================================

/**
 * Calculates password strength score (0-4)
 * Factors: length, uppercase, lowercase, numbers, special characters
 */
function calculatePasswordStrength(password: string): number {
  let strength = 0;

  if (password.length >= 8) strength++;
  if (password.length >= 12) strength++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
  if (/\d/.test(password)) strength++;
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strength++;

  return Math.min(strength, 4);
}

/**
 * Gets color for password strength indicator
 */
function getStrengthColor(strength: number): string {
  switch (strength) {
    case 0:
      return "bg-gray-300";
    case 1:
      return "bg-red-500";
    case 2:
      return "bg-yellow-500";
    case 3:
      return "bg-blue-500";
    case 4:
      return "bg-green-500";
    default:
      return "bg-gray-300";
  }
}

/**
 * Gets label for password strength
 */
function getStrengthLabel(strength: number): string {
  switch (strength) {
    case 0:
      return "Very Weak";
    case 1:
      return "Weak";
    case 2:
      return "Fair";
    case 3:
      return "Good";
    case 4:
      return "Strong";
    default:
      return "Unknown";
  }
}

// ============================================================================
// PASSWORD STRENGTH INDICATOR COMPONENT
// ============================================================================

interface PasswordStrengthIndicatorProps {
  password: string;
}

function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps): React.ReactElement {
  const strength = calculatePasswordStrength(password);
  const color = getStrengthColor(strength);
  const label = getStrengthLabel(strength);

  if (!password) {
    return <div className="mt-2" />;
  }

  return (
    <div className="mt-2 space-y-1">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((index) => (
          <div
            key={index}
            className={cn(
              "h-1 flex-1 rounded-full transition-all",
              index < strength ? color : "bg-gray-200"
            )}
          />
        ))}
      </div>
      <p className="text-xs text-gray-600">
        Password strength: <span className="font-medium">{label}</span>
      </p>
    </div>
  );
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validates password change form
 */
function validateForm(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
): ValidationErrors {
  const errors: ValidationErrors = {};

  // Current password validation
  if (!currentPassword.trim()) {
    errors.currentPassword = "Current password is required";
  }

  // New password validation
  if (!newPassword.trim()) {
    errors.newPassword = "New password is required";
  } else if (newPassword.length < 8) {
    errors.newPassword = "New password must be at least 8 characters";
  }

  // Confirm password validation
  if (!confirmPassword.trim()) {
    errors.confirmPassword = "Please confirm your new password";
  } else if (newPassword !== confirmPassword) {
    errors.confirmPassword = "Passwords do not match";
  }

  // Check if new password is different from current
  if (newPassword && currentPassword && newPassword === currentPassword) {
    errors.newPassword = "New password must be different from current password";
  }

  return errors;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * PasswordChangeForm Component
 * Provides a secure form for users to change their password
 *
 * Features:
 * - Current password verification
 * - New password with minimum 8 character requirement
 * - Password confirmation matching
 * - Password strength indicator
 * - Show/hide password toggles
 * - Comprehensive client-side validation
 * - Error handling with user-friendly messages
 * - Loading state during submission
 * - Success confirmation with form reset
 */
export default function PasswordChangeForm(): React.ReactElement {
  const [formState, setFormState] = useState<FormState>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    showCurrentPassword: false,
    showNewPassword: false,
    showConfirmPassword: false,
  });

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [alert, setAlert] = useState<AlertState>({ type: null, message: "" });
  const [isLoading, setIsLoading] = useState(false);

  // ========================================================================
  // EVENT HANDLERS
  // ========================================================================

  /**
   * Handle input field changes
   */
  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const { name, value } = e.target;
      setFormState((prev) => ({
        ...prev,
        [name]: value,
      }));

      // Clear validation error for this field when user starts typing
      if (validationErrors[name as keyof ValidationErrors]) {
        setValidationErrors((prev) => ({
          ...prev,
          [name]: undefined,
        }));
      }
    },
    [validationErrors]
  );

  /**
   * Toggle password visibility
   */
  const togglePasswordVisibility = useCallback((field: "current" | "new" | "confirm") => {
    setFormState((prev) => {
      if (field === "current") {
        return { ...prev, showCurrentPassword: !prev.showCurrentPassword };
      } else if (field === "new") {
        return { ...prev, showNewPassword: !prev.showNewPassword };
      } else {
        return { ...prev, showConfirmPassword: !prev.showConfirmPassword };
      }
    });
  }, []);

  /**
   * Handle form submission
   */
  const handleSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();

      // Validate form
      const errors = validateForm(
        formState.currentPassword,
        formState.newPassword,
        formState.confirmPassword
      );

      if (Object.keys(errors).length > 0) {
        setValidationErrors(errors);
        return;
      }

      // Clear previous alerts
      setAlert({ type: null, message: "" });
      setIsLoading(true);

      try {
        // Prepare request
        const request: PasswordChangeRequest = {
          currentPassword: formState.currentPassword,
          newPassword: formState.newPassword,
        };

        // Call API
        // Note: This method will be added to apiClient
        // For now, we'll use a direct fetch or add it to the api-client
        // The endpoint should be /api/users/me/password or /api/auth/change-password
        const response = await fetch("/api/auth/change-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${localStorage.getItem("auth_token") ? JSON.parse(localStorage.getItem("auth_token") as string).token : ""}`,
          },
          body: JSON.stringify(request),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new ApiClientError(
            errorData.error || "Failed to change password",
            response.status,
            errorData.details
          );
        }

        // Success
        setAlert({
          type: "success",
          message: "Password changed successfully!",
        });

        // Reset form
        setFormState({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
          showCurrentPassword: false,
          showNewPassword: false,
          showConfirmPassword: false,
        });
        setValidationErrors({});
      } catch (error) {
        const message =
          error instanceof ApiClientError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to change password";

        setAlert({
          type: "error",
          message,
        });
      } finally {
        setIsLoading(false);
      }
    },
    [formState]
  );

  /**
   * Handle alert dismissal
   */
  const dismissAlert = useCallback(() => {
    setAlert({ type: null, message: "" });
  }, []);

  // ========================================================================
  // RENDER
  // ========================================================================

  return (
    <div className="w-full max-w-md">
      <Card className="bg-white">
        <CardHeader>
          <CardTitle>Change Password</CardTitle>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardBody className="space-y-4">
            {/* Alert Messages */}
            {alert.type && (
              <Alert
                variant={alert.type}
                title={alert.type === "success" ? "Success" : "Error"}
                onDismiss={dismissAlert}
              >
                {alert.message}
              </Alert>
            )}

            {/* Current Password Field */}
            <div className="relative">
              <Input
                label="Current Password"
                type={formState.showCurrentPassword ? "text" : "password"}
                name="currentPassword"
                value={formState.currentPassword}
                onChange={handleInputChange}
                error={validationErrors.currentPassword}
                placeholder="Enter your current password"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("current")}
                className="absolute bottom-2 right-3 text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
                aria-label={formState.showCurrentPassword ? "Hide password" : "Show password"}
                disabled={isLoading}
              >
                {formState.showCurrentPassword ? (
                  <span className="text-lg">👁️</span>
                ) : (
                  <span className="text-lg">👁️‍🗨️</span>
                )}
              </button>
            </div>

            {/* New Password Field */}
            <div className="relative">
              <Input
                label="New Password"
                type={formState.showNewPassword ? "text" : "password"}
                name="newPassword"
                value={formState.newPassword}
                onChange={handleInputChange}
                error={validationErrors.newPassword}
                placeholder="Enter your new password (min. 8 characters)"
                required
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("new")}
                className="absolute bottom-2 right-3 text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
                aria-label={formState.showNewPassword ? "Hide password" : "Show password"}
                disabled={isLoading}
              >
                {formState.showNewPassword ? (
                  <span className="text-lg">👁️</span>
                ) : (
                  <span className="text-lg">👁️‍🗨️</span>
                )}
              </button>
              {/* Password Strength Indicator */}
              <PasswordStrengthIndicator password={formState.newPassword} />
            </div>

            {/* Confirm Password Field */}
            <div className="relative">
              <Input
                label="Confirm New Password"
                type={formState.showConfirmPassword ? "text" : "password"}
                name="confirmPassword"
                value={formState.confirmPassword}
                onChange={handleInputChange}
                error={validationErrors.confirmPassword}
                placeholder="Confirm your new password"
                required
                disabled={isLoading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility("confirm")}
                className="absolute bottom-2 right-3 text-gray-500 hover:text-gray-700 focus:outline-none transition-colors"
                aria-label={formState.showConfirmPassword ? "Hide password" : "Show password"}
                disabled={isLoading}
              >
                {formState.showConfirmPassword ? (
                  <span className="text-lg">👁️</span>
                ) : (
                  <span className="text-lg">👁️‍🗨️</span>
                )}
              </button>
            </div>
          </CardBody>

          {/* Footer with Submit Button */}
          <CardFooter className="flex gap-3 justify-end">
            <Button
              type="submit"
              variant="primary"
              disabled={isLoading}
              loading={isLoading}
              size="md"
            >
              {isLoading ? "Changing Password..." : "Change Password"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* Password Requirements Info */}
      <div className="mt-4 text-sm text-gray-600 space-y-1">
        <p className="font-medium text-gray-700">Password Requirements:</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>At least 8 characters</li>
          <li>Must be different from current password</li>
          <li>Include uppercase and lowercase letters</li>
          <li>Include numbers and special characters (recommended)</li>
        </ul>
      </div>
    </div>
  );
}
