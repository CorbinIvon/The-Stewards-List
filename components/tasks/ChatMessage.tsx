"use client";

import { ChatWithRelations } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Props for ChatMessage component
 */
export interface ChatMessageProps {
  /** The chat message object to display */
  message: ChatWithRelations;
  /** Whether this message is from the current user */
  isCurrentUser: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Generates user initials from display name or username
 *
 * @param displayName - The user's display name
 * @param username - The user's username (fallback)
 * @returns Two-letter initials string
 */
function getInitials(displayName: string | null, username: string): string {
  const name = displayName || username;
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

/**
 * Formats a date to relative time string
 * Returns strings like "2 minutes ago", "1 hour ago", "yesterday", etc.
 *
 * @param date - The date to format
 * @returns Relative time string
 */
function formatRelativeTime(date: Date | string): string {
  const messageDate = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diffMs = now.getTime() - messageDate.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "just now";
  }

  if (diffMins < 60) {
    return diffMins === 1 ? "1 minute ago" : `${diffMins} minutes ago`;
  }

  if (diffHours < 24) {
    return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
  }

  if (diffDays === 1) {
    return "yesterday";
  }

  if (diffDays < 7) {
    return `${diffDays} days ago`;
  }

  // For dates older than a week, show the date
  return messageDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: messageDate.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
}

/**
 * Gets a stable background color based on a string (user ID)
 * Provides consistent colors for the same user across the chat
 *
 * @param userId - The user ID to generate color for
 * @returns Tailwind CSS class for background color
 */
function getUserAvatarColor(userId: string): string {
  const colors = [
    "bg-blue-100",
    "bg-purple-100",
    "bg-pink-100",
    "bg-green-100",
    "bg-yellow-100",
    "bg-indigo-100",
    "bg-red-100",
    "bg-cyan-100",
  ];

  // Generate a consistent index based on userId
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * Gets text color to pair with avatar background color
 *
 * @param userId - The user ID to generate color for
 * @returns Tailwind CSS class for text color
 */
function getUserAvatarTextColor(userId: string): string {
  const colors = [
    "text-blue-700",
    "text-purple-700",
    "text-pink-700",
    "text-green-700",
    "text-yellow-700",
    "text-indigo-700",
    "text-red-700",
    "text-cyan-700",
  ];

  // Generate a consistent index based on userId (same as background)
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
}

/**
 * ChatMessage - Displays an individual chat message with styling based on sender
 *
 * Features:
 * - Message bubble styled with left/right alignment based on sender
 * - Current user: blue background, aligned right
 * - Other users: gray background, aligned left
 * - User avatar with initials in colored circle
 * - User name display (hidden for current user, shown as "You")
 * - Relative time display (e.g., "2 minutes ago")
 * - Word wrap for long messages
 * - Responsive design
 * - Support for deleted/edited indicators (future)
 *
 * @param props - ChatMessageProps
 * @returns JSX element
 */
export default function ChatMessage({
  message,
  isCurrentUser,
  className,
}: ChatMessageProps): React.ReactElement {
  const user = message.user;
  const displayName = user.displayName || user.username;
  const avatarColor = getUserAvatarColor(user.id);
  const avatarTextColor = getUserAvatarTextColor(user.id);
  const relativeTime = formatRelativeTime(message.createdAt);

  return (
    <div
      className={cn(
        "flex gap-3 py-2 px-1",
        isCurrentUser && "justify-end",
        className
      )}
    >
      {/* Avatar (only for other users) */}
      {!isCurrentUser && (
        <div
          className={cn(
            "flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold",
            avatarColor,
            avatarTextColor
          )}
          title={displayName}
        >
          {getInitials(user.displayName, user.username)}
        </div>
      )}

      {/* Message content wrapper */}
      <div
        className={cn(
          "flex flex-col gap-1 max-w-xs",
          isCurrentUser && "items-end"
        )}
      >
        {/* User name (only for other users) */}
        {!isCurrentUser && (
          <span className="px-3 pt-1 text-xs font-medium text-gray-600">
            {displayName}
          </span>
        )}

        {/* Message bubble */}
        <div
          className={cn(
            "rounded-lg px-4 py-2 word-wrap break-words",
            isCurrentUser
              ? "bg-blue-500 text-white rounded-br-none"
              : "bg-gray-100 text-gray-300 rounded-bl-none"
          )}
        >
          <p className="text-sm leading-relaxed">
            {message.message}
          </p>
        </div>

        {/* Timestamp */}
        <span className="px-3 text-xs text-gray-500">
          {relativeTime}
        </span>

        {/* Edited indicator (optional) */}
        {message.isEdited && (
          <span className="px-3 text-xs text-gray-400 italic">
            edited
          </span>
        )}
      </div>

      {/* Avatar placeholder for current user (maintains alignment) */}
      {isCurrentUser && (
        <div className="h-8 w-8 flex-shrink-0" />
      )}
    </div>
  );
}
