"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import type { SignupRequest } from "@/lib/types";

interface SignupFormData extends SignupRequest {
  confirmPassword: string;
}

interface FormErrors {
  email?: string;
  username?: string;
  displayName?: string;
  password?: string;
  confirmPassword?: string;
  submit?: string;
}

/**
 * Password strength validation
 */
function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) {
    return "Password must be at least 8 characters";
  }
  if (!/[A-Z]/.test(password)) {
    return "Password must contain at least one uppercase letter";
  }
  if (!/[a-z]/.test(password)) {
    return "Password must contain at least one lowercase letter";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must contain at least one number";
  }
  return null;
}

export default function SignupPage(): React.ReactElement {
  const router = useRouter();
  const { signup, isLoading, error, clearError, isAuthenticated } = useAuth();

  const [formData, setFormData] = useState<SignupFormData>({
    email: "",
    username: "",
    displayName: "",
    password: "",
    confirmPassword: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Redirect if user becomes authenticated
  useEffect(() => {
    if (isAuthenticated) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, router]);

  /**
   * Validate form fields
   */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Username validation
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (formData.username.length > 20) {
      newErrors.username = "Username must be at most 20 characters";
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      newErrors.username =
        "Username can only contain letters, numbers, underscores, and dashes";
    }

    // Display name validation
    if (!formData.displayName.trim()) {
      newErrors.displayName = "Display name is required";
    } else if (formData.displayName.length < 2) {
      newErrors.displayName = "Display name must be at least 2 characters";
    } else if (formData.displayName.length > 50) {
      newErrors.displayName = "Display name must be at most 50 characters";
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else {
      const strengthError = validatePasswordStrength(formData.password);
      if (strengthError) {
        newErrors.password = strengthError;
      }
    }

    // Password confirmation validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "Please confirm your password";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    clearError();

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      // Create signup request (without confirmPassword)
      const signupRequest: SignupRequest = {
        email: formData.email,
        username: formData.username,
        displayName: formData.displayName,
        password: formData.password,
      };

      await signup(signupRequest);
      // Redirect is handled by useEffect hook
    } catch (err) {
      // Error is handled by auth context and displayed
      console.error("Signup error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle input change
   */
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear error for this field when user starts typing
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({
        ...prev,
        [name]: undefined,
      }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-[color:var(--text)]">
          Create account
        </h2>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Join The Stewards List to get started
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div
          role="alert"
          className="rounded-lg bg-red-900/20 p-4 text-sm text-red-400 border border-red-800/30"
        >
          <p className="font-medium">Signup failed</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Signup Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email address"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          error={errors.email}
          placeholder="you@example.com"
          disabled={isSubmitting || isLoading}
          autoComplete="email"
          required
        />

        <Input
          label="Username"
          name="username"
          type="text"
          value={formData.username}
          onChange={handleChange}
          error={errors.username}
          placeholder="johndoe"
          disabled={isSubmitting || isLoading}
          autoComplete="username"
          required
        />

        <Input
          label="Display name"
          name="displayName"
          type="text"
          value={formData.displayName}
          onChange={handleChange}
          error={errors.displayName}
          placeholder="John Doe"
          disabled={isSubmitting || isLoading}
          required
        />

        <div>
          <Input
            label="Password"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            error={errors.password}
            placeholder="Create a strong password"
            disabled={isSubmitting || isLoading}
            autoComplete="new-password"
            required
          />
          {!errors.password && (
            <p className="mt-1 text-sm text-[color:var(--muted)]">
              At least 8 characters with uppercase, lowercase, and numbers
            </p>
          )}
        </div>

        <Input
          label="Confirm password"
          name="confirmPassword"
          type="password"
          value={formData.confirmPassword}
          onChange={handleChange}
          error={errors.confirmPassword}
          placeholder="Confirm your password"
          disabled={isSubmitting || isLoading}
          autoComplete="new-password"
          required
        />

        <Button
          type="submit"
          className="w-full"
          loading={isSubmitting || isLoading}
          disabled={isSubmitting || isLoading}
        >
          Create account
        </Button>
      </form>

      {/* Login Link */}
      <div className="text-center">
        <p className="text-sm text-[color:var(--muted)]">
          Already have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
