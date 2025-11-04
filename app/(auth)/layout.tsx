"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  useIsAuthenticated,
  useAuthLoading,
  useAuth,
} from "@/lib/auth-context";
import { Card } from "@/components/ui";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();
  const { user } = useAuth();
  const isAuthenticated = useIsAuthenticated();
  const isLoading = useAuthLoading();

  // Redirect to dashboard if user is already authenticated
  useEffect(() => {
    // If the user is authenticated and not required to reset password,
    // send them to the dashboard. If they are required to reset password
    // we must not redirect so they can complete the reset flow.
    if (isAuthenticated && !isLoading && !user?.requiresPasswordReset) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, user?.requiresPasswordReset, router]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[color:var(--bg)]">
        <div className="flex flex-col items-center justify-center">
          <svg
            className="animate-spin h-12 w-12 text-blue-400"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-4 text-[color:var(--text)]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[color:var(--bg)] px-4 py-12">
      <div className="w-full max-w-[400px]">
        {/* App Logo/Branding */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-[color:var(--text)]">
            The Stewards List
          </h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            Home organization made simple
          </p>
        </div>

        {/* Auth Card */}
        <Card className="px-8 py-6">{children}</Card>
      </div>
    </div>
  );
}
