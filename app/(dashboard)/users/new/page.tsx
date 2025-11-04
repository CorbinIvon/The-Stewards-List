"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Button,
  Input,
  Select,
} from "@/components/ui";
import Alert from "@/components/ui/Alert";
import { useAuth, useAuthUser } from "@/lib/auth-context";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { UserRole } from "@/lib/types";

interface FormState {
  displayName: string;
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export default function NewUserPage(): React.ReactElement {
  const router = useRouter();
  const currentUser = useAuthUser();
  const { isLoading: authLoading } = useAuth();

  const [form, setForm] = useState<FormState>({
    displayName: "",
    username: "",
    email: "",
    password: "",
    role: UserRole.MEMBER,
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (authLoading) {
    return <div className="p-8">Loading...</div>;
  }

  if (!currentUser || currentUser.role !== "ADMIN") {
    return (
      <div className="p-8">
        <Card>
          <CardBody className="text-center">
            <p className="text-slate-400 mb-4">
              You don't have permission to create users.
            </p>
            <Link href="/users">
              <Button variant="primary">Back to users</Button>
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const newUser = await apiClient.createUser({
        displayName: form.displayName.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });

      // Redirect to user detail or users list
      router.push(`/users/${newUser.id}`);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Failed to create user";
      setError(message);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[color:var(--bg)] p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-[color:var(--text)]">
            Create New User
          </h1>
          <p className="text-[color:var(--muted)] mt-1">
            Add a new team member
          </p>
        </div>

        {error && (
          <Alert variant="error" title="Error">
            {error}
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Create User</CardTitle>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardBody className="space-y-4">
              <Input
                label="Display Name"
                name="displayName"
                value={form.displayName}
                onChange={handleChange}
                required
              />

              <Input
                label="Username"
                name="username"
                value={form.username}
                onChange={handleChange}
                required
              />

              <Input
                label="Email"
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                required
              />

              <Input
                label="Password"
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                required
              />

              <Select
                label="Role"
                name="role"
                options={[
                  { value: "MEMBER", label: "Member" },
                  { value: "MANAGER", label: "Manager" },
                  { value: "ADMIN", label: "Admin" },
                ]}
                value={form.role}
                onChange={handleChange as any}
              />

              <div className="flex gap-3 pt-4">
                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating..." : "Create User"}
                </Button>
                <Link href="/users">
                  <Button type="button" variant="secondary">
                    Cancel
                  </Button>
                </Link>
              </div>
            </CardBody>
          </form>
        </Card>
      </div>
    </div>
  );
}
