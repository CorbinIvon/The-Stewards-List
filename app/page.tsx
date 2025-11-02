"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useIsAuthenticated, useAuthLoading } from "@/lib/auth-context";
import { Button, Card, CardBody, CardTitle, Spinner } from "@/components/ui";

export default function Home(): React.ReactElement {
  const router = useRouter();
  const isAuthenticated = useIsAuthenticated();
  const isLoading = useAuthLoading();

  // Redirect to dashboard if authenticated
  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center justify-center gap-4">
          <Spinner size="lg" color="primary" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="z-10 max-w-2xl w-full text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-4">
          The Stewards List
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          A home organization app featuring user management, task management, and task tracking.
        </p>

        <Card className="mt-12 mb-8 bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
          <CardBody className="px-8 py-8">
            <CardTitle className="text-2xl mb-6">Key Features</CardTitle>
            <ul className="space-y-3 text-left max-w-md mx-auto">
              <li className="flex items-start">
                <span className="text-blue-600 mr-3 font-bold">•</span>
                <span className="text-gray-700">
                  <strong>User Management</strong> - Create and manage user accounts
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-3 font-bold">•</span>
                <span className="text-gray-700">
                  <strong>Task Management</strong> - Create, assign, and track tasks
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-3 font-bold">•</span>
                <span className="text-gray-700">
                  <strong>Task Logging</strong> - Track task completion history
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-3 font-bold">•</span>
                <span className="text-gray-700">
                  <strong>Permissions</strong> - Control access to tasks
                </span>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-3 font-bold">•</span>
                <span className="text-gray-700">
                  <strong>Chat</strong> - Communicate with team members
                </span>
              </li>
            </ul>
          </CardBody>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/login">
            <Button variant="primary" size="lg" className="w-full">
              Sign In
            </Button>
          </Link>
          <Link href="/signup">
            <Button variant="secondary" size="lg" className="w-full">
              Get Started
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
