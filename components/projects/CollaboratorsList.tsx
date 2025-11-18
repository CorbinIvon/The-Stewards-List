"use client";

import React, { useState, useCallback, useMemo } from "react";
import {
  ProjectCollaboratorWithUser,
  ProjectPermissionWithUser,
  PermissionType,
} from "@/lib/types";
import { apiClient, ApiClientError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import Badge from "@/components/ui/Badge";
import Alert from "@/components/ui/Alert";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

/**
 * Props interface for CollaboratorsList component
 */
export interface CollaboratorsListProps {
  projectId: string;
  collaborators: ProjectCollaboratorWithUser[];
  permissions: ProjectPermissionWithUser[];
  canManage: boolean;
  onCollaboratorAdded?: () => void;
  onCollaboratorRemoved?: () => void;
  onPermissionChanged?: () => void;
}

/**
 * Permission type configuration with colors and labels
 */
const PERMISSION_CONFIG: Record<
  PermissionType,
  { label: string; variant: "default" | "success" | "warning" | "danger" | "info"; description: string }
> = {
  READ: {
    label: "Read",
    variant: "info",
    description: "Can view project and tasks",
  },
  WRITE: {
    label: "Write",
    variant: "warning",
    description: "Can create and edit tasks",
  },
  DELETE: {
    label: "Delete",
    variant: "danger",
    description: "Can delete tasks",
  },
  ADMIN: {
    label: "Admin",
    variant: "danger",
    description: "Full project access",
  },
};

/**
 * Generate initials from a name
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

/**
 * CollaboratorsList component for managing project members and their permissions
 *
 * Features:
 * - Display collaborators in a responsive table/card format
 * - Show permission levels with color-coded badges
 * - Add new collaborators with permission assignment
 * - Change existing collaborator permissions
 * - Remove collaborators with confirmation
 * - Empty state when no collaborators
 * - Loading states for all operations
 * - Error handling and recovery
 * - Accessibility features
 */
export default function CollaboratorsList({
  projectId,
  collaborators,
  permissions,
  canManage,
  onCollaboratorAdded,
  onCollaboratorRemoved,
  onPermissionChanged,
}: CollaboratorsListProps): React.ReactElement {
  // State management
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isChangePermissionModalOpen, setIsChangePermissionModalOpen] =
    useState(false);
  const [isRemoveConfirmOpen, setIsRemoveConfirmOpen] = useState(false);

  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<
    string | null
  >(null);
  const [selectedPermission, setSelectedPermission] = useState<PermissionType>(
    PermissionType.READ
  );
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  const [loadingStates, setLoadingStates] = useState<Record<string, boolean>>(
    {}
  );
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Get all users for the add collaborator dropdown (excluding existing collaborators)
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ id: string; displayName: string; email: string }>
  >([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

  // Load available users when add modal opens
  const handleAddModalOpen = useCallback(async () => {
    setIsAddModalOpen(true);
    setIsLoadingUsers(true);
    try {
      const response = await apiClient.getUsers({ pageSize: 100 });
      const existingCollaboratorIds = collaborators.map((c) => c.userId);
      const filtered = response.data.filter(
        (user) => !existingCollaboratorIds.includes(user.id)
      );
      setAvailableUsers(
        filtered.map((u) => ({
          id: u.id,
          displayName: u.displayName,
          email: u.email,
        }))
      );
    } catch {
      setError("Failed to load available users");
    } finally {
      setIsLoadingUsers(false);
    }
  }, [collaborators]);

  // Build permission map for quick lookup
  const permissionMap = useMemo(
    () =>
      permissions.reduce(
        (acc, perm) => {
          acc[perm.userId] = perm.permission;
          return acc;
        },
        {} as Record<string, PermissionType>
      ),
    [permissions]
  );

  /**
   * Handle adding a new collaborator
   */
  const handleAddCollaborator = useCallback(async () => {
    if (!selectedUserId) {
      setError("Please select a user");
      return;
    }

    setLoadingStates({ add: true });
    setError(null);

    try {
      await apiClient.addProjectCollaborator(projectId, selectedUserId);

      // Set initial permission for the new collaborator
      if (selectedPermission) {
        await apiClient.setProjectPermission(
          projectId,
          selectedUserId,
          selectedPermission
        );
      }

      setSuccessMessage("Collaborator added successfully");
      setIsAddModalOpen(false);
      setSelectedUserId(null);
      setSelectedPermission(PermissionType.READ);

      if (onCollaboratorAdded) {
        onCollaboratorAdded();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Failed to add collaborator";
      setError(message);
    } finally {
      setLoadingStates({ add: false });
    }
  }, [projectId, selectedUserId, selectedPermission, onCollaboratorAdded]);

  /**
   * Open permission change modal
   */
  const openChangePermissionModal = useCallback(
    (collaboratorId: string, currentPermission: PermissionType) => {
      setSelectedCollaboratorId(collaboratorId);
      setSelectedPermission(currentPermission);
      setIsChangePermissionModalOpen(true);
      setError(null);
    },
    []
  );

  /**
   * Handle permission change
   */
  const handleChangePermission = useCallback(async () => {
    if (!selectedCollaboratorId) return;

    setLoadingStates({ changePermission: true });
    setError(null);

    try {
      await apiClient.setProjectPermission(
        projectId,
        selectedCollaboratorId,
        selectedPermission
      );

      setSuccessMessage("Permission updated successfully");
      setIsChangePermissionModalOpen(false);

      if (onPermissionChanged) {
        onPermissionChanged();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Failed to update permission";
      setError(message);
    } finally {
      setLoadingStates({ changePermission: false });
    }
  }, [projectId, selectedCollaboratorId, selectedPermission, onPermissionChanged]);

  /**
   * Open remove confirmation dialog
   */
  const openRemoveConfirm = useCallback((collaboratorId: string) => {
    setSelectedCollaboratorId(collaboratorId);
    setIsRemoveConfirmOpen(true);
    setError(null);
  }, []);

  /**
   * Handle removing a collaborator
   */
  const handleRemoveCollaborator = useCallback(async () => {
    if (!selectedCollaboratorId) return;

    setLoadingStates({ remove: true });
    setError(null);

    try {
      await apiClient.removeProjectCollaborator(
        projectId,
        selectedCollaboratorId
      );

      setSuccessMessage("Collaborator removed successfully");
      setIsRemoveConfirmOpen(false);
      setSelectedCollaboratorId(null);

      if (onCollaboratorRemoved) {
        onCollaboratorRemoved();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : "Failed to remove collaborator";
      setError(message);
    } finally {
      setLoadingStates({ remove: false });
    }
  }, [projectId, selectedCollaboratorId, onCollaboratorRemoved]);

  // Empty state
  if (collaborators.length === 0) {
    return (
      <Card>
        <CardBody className="py-8">
          <div className="text-center">
            <p className="text-slate-400 mb-4">No collaborators yet</p>
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                onClick={handleAddModalOpen}
              >
                Add Collaborator
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with add button */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-100">Collaborators</h3>
        {canManage && (
          <Button
            variant="primary"
            size="sm"
            onClick={handleAddModalOpen}
          >
            Add Collaborator
          </Button>
        )}
      </div>

      {/* Success message */}
      {successMessage && (
        <Alert variant="success" onDismiss={() => setSuccessMessage(null)}>
          {successMessage}
        </Alert>
      )}

      {/* Error message */}
      {error && (
        <Alert variant="error" onDismiss={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Collaborators table - responsive design */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="px-4 py-3 text-left text-slate-300 font-semibold">
                Name
              </th>
              <th className="px-4 py-3 text-left text-slate-300 font-semibold">
                Email
              </th>
              <th className="px-4 py-3 text-left text-slate-300 font-semibold">
                Permission
              </th>
              {canManage && (
                <th className="px-4 py-3 text-left text-slate-300 font-semibold">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {collaborators.map((collaborator) => {
              const permission = permissionMap[collaborator.userId];
              const config = permission ? PERMISSION_CONFIG[permission] : null;

              return (
                <tr
                  key={collaborator.id}
                  className="border-b border-slate-700 hover:bg-slate-750/50 transition-colors"
                >
                  {/* Name with avatar/initials */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-600/30 text-xs font-semibold text-blue-300"
                        title={collaborator.user.displayName}
                      >
                        {getInitials(collaborator.user.displayName)}
                      </div>
                      <div className="font-medium text-slate-100">
                        {collaborator.user.displayName}
                      </div>
                    </div>
                  </td>

                  {/* Email */}
                  <td className="px-4 py-3 text-slate-400">
                    {collaborator.user.email}
                  </td>

                  {/* Permission badge */}
                  <td className="px-4 py-3">
                    {config ? (
                      <Badge variant={config.variant} size="sm">
                        {config.label}
                      </Badge>
                    ) : (
                      <span className="text-slate-500">Not set</span>
                    )}
                  </td>

                  {/* Actions */}
                  {canManage && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() =>
                            openChangePermissionModal(
                              collaborator.userId,
                              permission || PermissionType.READ
                            )
                          }
                          disabled={
                            loadingStates.changePermission ||
                            loadingStates.remove
                          }
                        >
                          Change
                        </Button>
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => openRemoveConfirm(collaborator.userId)}
                          disabled={
                            loadingStates.remove || loadingStates.changePermission
                          }
                        >
                          Remove
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Add Collaborator Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setSelectedUserId(null);
          setSelectedPermission(PermissionType.READ);
          setError(null);
        }}
        title="Add Collaborator"
        size="md"
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsAddModalOpen(false);
                setSelectedUserId(null);
                setSelectedPermission(PermissionType.READ);
                setError(null);
              }}
              disabled={loadingStates.add}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleAddCollaborator}
              loading={loadingStates.add}
              disabled={!selectedUserId || loadingStates.add}
            >
              Add Collaborator
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* User selection */}
          <Select
            label="Select User"
            placeholder="Choose a user to add..."
            options={availableUsers.map((user) => ({
              value: user.id,
              label: `${user.displayName} (${user.email})`,
            }))}
            value={selectedUserId || ""}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
            disabled={isLoadingUsers || loadingStates.add}
            required
            error={error && selectedUserId === null ? error : undefined}
          />

          {/* Permission selection */}
          <Select
            label="Permission Level"
            options={Object.entries(PERMISSION_CONFIG).map(([key, config]) => ({
              value: key,
              label: `${config.label} - ${config.description}`,
            }))}
            value={selectedPermission}
            onChange={(e) => setSelectedPermission(e.target.value as PermissionType)}
            disabled={loadingStates.add}
          />

          {/* Empty state for users */}
          {availableUsers.length === 0 && !isLoadingUsers && (
            <p className="text-sm text-slate-400 text-center py-4">
              No available users to add. All active users are already collaborators.
            </p>
          )}
        </div>
      </Modal>

      {/* Change Permission Modal */}
      <Modal
        isOpen={isChangePermissionModalOpen}
        onClose={() => {
          setIsChangePermissionModalOpen(false);
          setSelectedCollaboratorId(null);
        }}
        title="Change Permission"
        size="md"
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsChangePermissionModalOpen(false);
                setSelectedCollaboratorId(null);
              }}
              disabled={loadingStates.changePermission}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleChangePermission}
              loading={loadingStates.changePermission}
              disabled={loadingStates.changePermission}
            >
              Update Permission
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <Select
            label="Permission Level"
            options={Object.entries(PERMISSION_CONFIG).map(([key, config]) => ({
              value: key,
              label: `${config.label} - ${config.description}`,
            }))}
            value={selectedPermission}
            onChange={(e) => setSelectedPermission(e.target.value as PermissionType)}
            disabled={loadingStates.changePermission}
          />
        </div>
      </Modal>

      {/* Remove Confirmation Modal */}
      <Modal
        isOpen={isRemoveConfirmOpen}
        onClose={() => {
          setIsRemoveConfirmOpen(false);
          setSelectedCollaboratorId(null);
        }}
        title="Remove Collaborator"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setIsRemoveConfirmOpen(false);
                setSelectedCollaboratorId(null);
              }}
              disabled={loadingStates.remove}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRemoveCollaborator}
              loading={loadingStates.remove}
              disabled={loadingStates.remove}
            >
              Remove
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-slate-300">
            Are you sure you want to remove this collaborator from the project?
          </p>
          <p className="text-sm text-slate-400">
            They will lose access to all project tasks and materials.
          </p>
        </div>
      </Modal>
    </div>
  );
}
