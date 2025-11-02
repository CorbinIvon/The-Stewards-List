"use client";

/**
 * Dashboard layout component
 * Main layout for authenticated dashboard section
 * Manages authentication checks, loading states, and layout structure with sidebar and header
 */

import React, { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useIsAuthenticated, useAuthLoading } from "@/lib/auth-context";
import { Spinner } from "@/components/ui";
import Sidebar from "@/components/navigation/Sidebar";
import Header from "@/components/navigation/Header";

/**
 * Dashboard layout props
 */
interface DashboardLayoutProps {
  children: ReactNode;
}

/**
 * Dashboard layout component
 *
 * Features:
 * - Authentication guard with redirect to /login if not authenticated
 * - Loading state during authentication check with full-screen spinner
 * - Responsive layout: sidebar hidden on mobile (hamburger menu), visible on desktop
 * - Two-column layout: sidebar on left, main content area on right
 * - Header component at top of main content area
 * - Children rendered below header
 * - Flex-based layout for proper responsiveness
 * - Tailwind CSS styling
 *
 * @param props - Component props with children
 * @returns React component element
 */
export default function DashboardLayout({
  children,
}: DashboardLayoutProps): React.ReactElement {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const isAuthLoading = useAuthLoading();

  // Show full-screen loading state while checking authentication
  if (isAuthLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <Spinner size="lg" color="primary" />
          <p className="text-gray-600 text-sm font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    router.push("/login");
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <p className="text-gray-600">Redirecting to login...</p>
      </div>
    );
  }

  // Render authenticated dashboard layout
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - responsive positioning */}
      <div className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 lg:left-0 lg:z-50">
        <Sidebar />
      </div>

      {/* Sidebar overlay and mobile menu handled by Sidebar component */}

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:ml-64 w-full">
        {/* Header */}
        <Header showMobileMenu={true} />

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
