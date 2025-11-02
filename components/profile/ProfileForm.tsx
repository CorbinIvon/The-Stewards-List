"use client";

/**
 * ProfileForm component for editing user profile information
 * Provides form fields for display name, username, email, and bio
 * Includes client-side validation and error handling
 */

import React, { useState, useCallback } from "react";
import type { User } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import { cn } from "@/lib/utils";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Profile form data submitted to the server
 */
export interface ProfileFormData {
  displayName: string;
  username: string;
  email: string;
  bio?: string;
}

/**
 * Profile form validation errors
 */
interface ProfileFormErrors {
  displayName?: string;
  username?: string;
  email?: string;
  bio?: string;
  submit?: string;
}

/**
 * Profile form component props
 */
interface ProfileFormProps {
  /** User data to populate form fields */
  user: User;
  /** Callback function when form is submitted */
  onSave: (data: ProfileFormData) => Promise<void>;
  /** Whether the form is currently submitting */
  isSubmitting: boolean;
  /** Optional callback when form is cancelled */
  onCancel?: () => void;
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Email validation regex pattern
 * Supports most common email formats
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Username validation regex pattern
 * Allows lowercase letters, numbers, hyphens, and underscores
 * Must start with a letter or number
 * 3-30 characters long
 */
const USERNAME_REGEX = /^[a-z0-9][a-z0-9_-]{2,29}$/;

/**
 * Validate email format
 */
function validateEmail(email: string): string | undefined {
  if (!email.trim()) {
    return "Email is required";
  }

  if (!EMAIL_REGEX.test(email)) {
    return "Please enter a valid email address";
  }

  return undefined;
}

/**
 * Validate username format and requirements
 */
function validateUsername(username: string): string | undefined {
  if (!username.trim()) {
    return "Username is required";
  }

  const trimmed = username.trim();

  if (trimmed.length < 3) {
    return "Username must be at least 3 characters";
  }

  if (trimmed.length > 30) {
    return "Username must not exceed 30 characters";
  }

  if (!USERNAME_REGEX.test(trimmed.toLowerCase())) {
    return "Username can only contain lowercase letters, numbers, hyphens, and underscores";
  }

  if (/\s/.test(trimmed)) {
    return "Username cannot contain spaces";
  }

  return undefined;
}

/**
 * Validate display name
 */
function validateDisplayName(displayName: string): string | undefined {
  if (!displayName.trim()) {
    return "Display name is required";
  }

  const trimmed = displayName.trim();

  if (trimmed.length < 2) {
    return "Display name must be at least 2 characters";
  }

  if (trimmed.length > 100) {
    return "Display name must not exceed 100 characters";
  }

  return undefined;
}

/**
 * Validate bio (optional field)
 */
function validateBio(bio: string | undefined): string | undefined {
  if (!bio) {
    return undefined;
  }

  if (bio.length > 500) {
    return "Bio must not exceed 500 characters";
  }

  return undefined;
}

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * ProfileForm component
 * Reusable form for editing user profile information
 * Features:
 * - Controlled form inputs with React state
 * - Client-side validation with error messages
 * - Submit and cancel buttons
 * - Loading state during submission
 * - Proper accessibility with labels and error descriptions
 * - Responsive design with Tailwind CSS
 *
 * @example
 * ```tsx
 * const handleSave = async (data: ProfileFormData) => {
 *   await apiClient.updateUser(user.id, data);
 * };
 *
 * <ProfileForm
 *   user={currentUser}
 *   onSave={handleSave}
 *   isSubmitting={isSubmitting}
 *   onCancel={() => navigate('/profile')}
 * />
 * ```
 */
export const ProfileForm = React.forwardRef<HTMLFormElement, ProfileFormProps>(
  ({ user, onSave, isSubmitting, onCancel }, ref) => {
    // ========================================================================
    // STATE
    // ========================================================================

    const [formData, setFormData] = useState<ProfileFormData>({
      displayName: user.displayName,
      username: user.username,
      email: user.email,
      bio: "",
    });

    const [errors, setErrors] = useState<ProfileFormErrors>({});
    const [isDirty, setIsDirty] = useState(false);

    // ========================================================================
    // HANDLERS
    // ========================================================================

    /**
     * Handle input field changes
     */
    const handleFieldChange = useCallback(
      (field: keyof ProfileFormData, value: string) => {
        setFormData((prev) => ({
          ...prev,
          [field]: value,
        }));
        setIsDirty(true);

        // Clear error for this field when user starts typing
        // eslint-disable-next-line security/detect-object-injection
        if (errors[field]) {
          setErrors((prev) => ({
            ...prev,
            [field]: undefined,
          }));
        }
      },
      [errors]
    );

    /**
     * Validate form data
     */
    const validateForm = useCallback((): boolean => {
      const newErrors: ProfileFormErrors = {};

      // Validate required fields
      const displayNameError = validateDisplayName(formData.displayName);
      if (displayNameError) {
        newErrors.displayName = displayNameError;
      }

      const usernameError = validateUsername(formData.username);
      if (usernameError) {
        newErrors.username = usernameError;
      }

      const emailError = validateEmail(formData.email);
      if (emailError) {
        newErrors.email = emailError;
      }

      const bioError = validateBio(formData.bio);
      if (bioError) {
        newErrors.bio = bioError;
      }

      setErrors(newErrors);
      return Object.keys(newErrors).length === 0;
    }, [formData]);

    /**
     * Handle form submission
     */
    const handleSubmit = useCallback(
      async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        // Validate form
        if (!validateForm()) {
          return;
        }

        try {
          // Clear submit error if validation passed
          setErrors((prev) => ({
            ...prev,
            submit: undefined,
          }));

          // Call parent callback with form data
          await onSave(formData);

          // Reset dirty state on successful save
          setIsDirty(false);
        } catch (error) {
          // Handle submission error
          const errorMessage =
            error instanceof Error ? error.message : "Failed to save profile";

          setErrors((prev) => ({
            ...prev,
            submit: errorMessage,
          }));
        }
      },
      [formData, validateForm, onSave]
    );

    /**
     * Handle cancel action
     */
    const handleCancel = useCallback(() => {
      // Reset form to initial state
      setFormData({
        displayName: user.displayName,
        username: user.username,
        email: user.email,
        bio: "",
      });
      setErrors({});
      setIsDirty(false);

      // Call parent cancel callback if provided
      if (onCancel) {
        onCancel();
      }
    }, [user, onCancel]);

    // ========================================================================
    // RENDER
    // ========================================================================

    return (
      <form
        ref={ref}
        onSubmit={handleSubmit}
        className="w-full max-w-2xl mx-auto"
      >
        {/* Error Alert */}
        {errors.submit && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{errors.submit}</p>
          </div>
        )}

        {/* Form Fields Container */}
        <div className="space-y-6">
          {/* Display Name Field */}
          <div>
            <Input
              label="Display Name"
              type="text"
              placeholder="Your full name or display name"
              value={formData.displayName}
              onChange={(e) => handleFieldChange("displayName", e.target.value)}
              error={errors.displayName}
              required
              disabled={isSubmitting}
              maxLength={100}
            />
          </div>

          {/* Username Field */}
          <div>
            <Input
              label="Username"
              type="text"
              placeholder="lowercase, numbers, hyphens, underscores"
              value={formData.username}
              onChange={(e) =>
                handleFieldChange("username", e.target.value.toLowerCase())
              }
              error={errors.username}
              required
              disabled={isSubmitting}
              maxLength={30}
            />
            <p className="text-xs text-gray-600 mt-1">
              3-30 characters, lowercase only. Used as your unique identifier.
            </p>
          </div>

          {/* Email Field */}
          <div>
            <Input
              label="Email"
              type="email"
              placeholder="your.email@example.com"
              value={formData.email}
              onChange={(e) => handleFieldChange("email", e.target.value)}
              error={errors.email}
              required
              disabled={isSubmitting}
            />
          </div>

          {/* Bio Field */}
          <div>
            <Textarea
              label="Bio"
              placeholder="Tell us a bit about yourself (optional)"
              value={formData.bio || ""}
              onChange={(e) => handleFieldChange("bio", e.target.value)}
              error={errors.bio}
              disabled={isSubmitting}
              rows={4}
              maxLength={500}
            />
          </div>
        </div>

        {/* Form Actions */}
        <div
          className={cn(
            "flex gap-3 justify-end mt-8",
            "pt-6 border-t border-gray-200"
          )}
        >
          <Button
            type="button"
            variant="secondary"
            size="md"
            onClick={handleCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="md"
            loading={isSubmitting}
            disabled={isSubmitting || !isDirty}
          >
            {isSubmitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    );
  }
);

ProfileForm.displayName = "ProfileForm";

export default ProfileForm;
