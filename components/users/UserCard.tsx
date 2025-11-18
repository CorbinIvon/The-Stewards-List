"use client";

import Link from "next/link";
import { User } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

/**
 * Props for the UserCard component
 */
interface UserCardProps {
  /** User data to display */
  user: User;
  /** Optional click handler */
  onClick?: (user: User) => void;
}

/**
 * Formats a date to a relative time string
 * Examples: "2 days ago", "1 hour ago", "Just now", "Never" (if null)
 *
 * @param date - Date object or null
 * @returns Formatted relative time string
 */
function formatRelativeTime(date: Date | null): string {
  if (!date) {
    return "Never";
  }

  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "Just now";
  } else if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  } else if (diffDays < 30) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  } else {
    const diffMonths = Math.floor(diffDays / 30);
    return `${diffMonths} month${diffMonths > 1 ? "s" : ""} ago`;
  }
}

/**
 * Generates user initials from display name
 * Takes first letter of first and last name
 * Falls back to first letter of display name if only one word
 *
 * @param displayName - User's display name
 * @returns Two character initials
 */
function getUserInitials(displayName: string): string {
  const names = displayName.trim().split(/\s+/);

  if (names.length >= 2) {
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  }

  if (names.length === 1 && names[0].length > 0) {
    return names[0].substring(0, 2).toUpperCase();
  }

  return "U";
}

/**
 * Gets a consistent background color for user avatar based on initials
 * Uses deterministic color selection based on first character code
 *
 * @param initials - User initials
 * @returns Tailwind background color class
 */
function getAvatarBgColor(initials: string): string {
  const colors = [
    "bg-blue-500",
    "bg-indigo-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-rose-500",
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
  ];

  const charCode = initials.charCodeAt(0);
  const colorIndex = charCode % colors.length;
  // eslint-disable-next-line security/detect-object-injection
  return colors[colorIndex];
}

/**
 * UserCard - Reusable component displaying user summary in card format
 *
 * Features:
 * - Avatar with user initials in colored circle
 * - Display name and username
 * - Email address
 * - Role badge (using UserRoleBadge component)
 * - Status badge (Active/Inactive)
 * - Last login time (relative format)
 * - Link to user detail page
 * - Hover effect with cursor pointer
 * - Responsive design (stacks on mobile)
 * - Click handler support
 *
 * @param user - User object to display
 * @param onClick - Optional click handler
 */
export default function UserCard({
  user,
  onClick,
}: UserCardProps): React.ReactElement {
  const initials = getUserInitials(user.displayName);
  const avatarBgColor = getAvatarBgColor(initials);
  const relativeLastLogin = formatRelativeTime(user.lastLoginAt);

  const handleCardClick = (): void => {
    onClick?.(user);
  };

  return (
    <Link href={`/users/${user.id}`}>
      <div
        className={cn(
          "transition-all duration-200 ease-in-out",
          "cursor-pointer",
          onClick && "hover:scale-105"
        )}
        onClick={handleCardClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
      >
        <Card className="hover:shadow-md hover:border-gray-300">
          <CardBody className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div
                  className={cn(
                    avatarBgColor,
                    "w-12 h-12 sm:w-14 sm:h-14 rounded-full",
                    "flex items-center justify-center",
                    "text-white font-bold text-sm sm:text-base",
                    "flex-shrink-0"
                  )}
                  aria-label={`Avatar for ${user.displayName}`}
                >
                  {initials}
                </div>
              </div>

              {/* Main Content */}
              <div className="flex-1 min-w-0">
                {/* Name and Username */}
                <div className="mb-2">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-300 truncate">
                    {user.displayName}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-600 truncate">
                    @{user.username}
                  </p>
                </div>

                {/* Email */}
                <p className="text-xs sm:text-sm text-gray-500 truncate mb-3">
                  {user.email}
                </p>

                {/* Badges Container */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {/* Role Badge - Using UserRoleBadge component when available */}
                  <Badge variant="info" size="sm" className="text-xs">
                    {user.role}
                  </Badge>

                  {/* Status Badge */}
                  <Badge
                    variant={user.isActive ? "success" : "default"}
                    size="sm"
                    className="text-xs"
                  >
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>

                {/* Last Login */}
                <p className="text-xs text-gray-500">
                  Last login:{" "}
                  <span className="font-medium">{relativeLastLogin}</span>
                </p>
              </div>

              {/* Right Arrow Indicator (for desktop) */}
              <div className="hidden sm:flex items-center justify-center text-gray-400 group-hover:text-gray-600 transition-colors">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </div>
          </CardBody>
        </Card>
      </div>
    </Link>
  );
}
