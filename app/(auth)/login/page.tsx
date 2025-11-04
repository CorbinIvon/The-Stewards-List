"use client";

import { useState, FormEvent, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input, Alert } from "@/components/ui";
import { useAuth } from "@/lib/auth-context";
import type { LoginRequest } from "@/lib/types";

/**
 * Form data interface for login
 */
interface LoginFormData {
  email: string;
  password: string;
}

/**
 * Form errors interface
 */
interface FormErrors {
  email?: string;
  password?: string;
  submit?: string;
}

/**
 * Email validation regex pattern
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Login Page Component
 *
 * Provides user authentication form with:
 * - Email and password input fields
 * - Form validation (email format, required fields)
 * - Error display via Alert component
 * - Submit button with loading state
 * - Link to signup page
 * - Automatic redirect to dashboard on successful login
 * - Full accessibility support
 */
export default function LoginPage(): React.ReactElement {
  const router = useRouter();
  const { login, isLoading, error, clearError, isAuthenticated, user } =
    useAuth();

  const [formData, setFormData] = useState<LoginFormData>({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alertDismissed, setAlertDismissed] = useState(false);

  // Redirect if user becomes authenticated
  useEffect(() => {
    if (isAuthenticated) {
      // If user must reset password, redirect to the forced reset flow
      if ((user as any)?.requiresPasswordReset) {
        router.push("/auth/complete-reset");
        return;
      }
      router.push("/dashboard");
    }
  }, [isAuthenticated, router, user]);

  /**
   * Validate form fields
   * Checks for required fields and valid email format
   */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!EMAIL_REGEX.test(formData.email)) {
      newErrors.email = "Please enter a valid email address";
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "Password is required";
    } else if (formData.password.length < 1) {
      newErrors.password = "Password cannot be empty";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   * Validates form and attempts login via auth context
   */
  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    clearError();
    setAlertDismissed(false);

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);

      const loginRequest: LoginRequest = {
        email: formData.email,
        password: formData.password,
      };

      await login(loginRequest);
      // Redirect is handled by useEffect hook
    } catch (err) {
      // Error is handled by auth context and displayed via error state
      console.error("Login error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle input field changes
   * Updates form data and clears associated field errors as user types
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
        <h1 className="text-2xl font-bold text-[color:var(--text)]">Sign in</h1>
        <p className="mt-1 text-sm text-[color:var(--muted)]">
          Welcome back to The Stewards List
        </p>
      </div>

      {/* Error Alert */}
      {error && !alertDismissed && (
        <Alert
          variant="error"
          title="Login failed"
          onDismiss={() => setAlertDismissed(true)}
        >
          {error}
        </Alert>
      )}

      {/* Login Form */}
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
          label="Password"
          name="password"
          type="password"
          value={formData.password}
          onChange={handleChange}
          error={errors.password}
          placeholder="Enter your password"
          disabled={isSubmitting || isLoading}
          autoComplete="current-password"
          required
        />

        <Button
          type="submit"
          className="w-full"
          loading={isSubmitting || isLoading}
          disabled={isSubmitting || isLoading}
        >
          Sign in
        </Button>
      </form>

      {/* Signup Link */}
      <div className="text-center">
        <p className="text-sm text-[color:var(--muted)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-medium text-blue-400 hover:text-blue-300 transition-colors"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
