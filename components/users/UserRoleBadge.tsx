"use client";

import React from "react";
import { UserRole } from "@/lib/types";
import Badge from "@/components/ui/Badge";

/**
 * Props for UserRoleBadge component
 */
export interface UserRoleBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  /** The user role to display */
  role: UserRole;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Maps UserRole enum to Badge variant
 * - ADMIN: danger (red) - highest privilege
 * - MANAGER: warning (yellow/orange) - moderate privilege
 * - MEMBER: info (blue) - standard user
 *
 * @param role - UserRole enum value
 * @returns Badge variant string
 */
function getRoleBadgeVariant(
  role: UserRole
): "default" | "success" | "warning" | "danger" | "info" {
  switch (role) {
    case UserRole.ADMIN:
      return "danger";
    case UserRole.MANAGER:
      return "warning";
    case UserRole.MEMBER:
      return "info";
    default:
      return "default";
  }
}

/**
 * Converts UserRole enum value to human-readable label
 * - ADMIN -> "Admin"
 * - MANAGER -> "Manager"
 * - MEMBER -> "Member"
 *
 * @param role - UserRole enum value
 * @returns Human-readable role label
 */
function formatRoleLabel(role: UserRole): string {
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

/**
 * UserRoleBadge - Component for displaying user role as a colored badge
 *
 * Features:
 * - Color-coded role levels (red for admin, yellow for manager, blue for member)
 * - Human-readable labels
 * - Customizable styling via className prop
 * - Semantic HTML with proper accessibility
 * - Reusable across user lists, cards, and profile views
 *
 * @param props - UserRoleBadgeProps
 * @returns JSX element rendering a Badge component
 *
 * @example
 * ```tsx
 * import UserRoleBadge from "@/components/users/UserRoleBadge";
 * import { UserRole } from "@/lib/types";
 *
 * export function MyComponent() {
 *   return (
 *     <UserRoleBadge
 *       role={UserRole.ADMIN}
 *       className="ml-2"
 *     />
 *   );
 * }
 * ```
 */
const UserRoleBadge = React.forwardRef<HTMLSpanElement, UserRoleBadgeProps>(
  ({ role, className, ...props }, ref) => {
    const variant = getRoleBadgeVariant(role);
    const label = formatRoleLabel(role);

    return (
      <Badge
        ref={ref}
        variant={variant}
        size="sm"
        className={className}
        {...props}
      >
        {label}
      </Badge>
    );
  }
);

UserRoleBadge.displayName = "UserRoleBadge";

export default UserRoleBadge;
