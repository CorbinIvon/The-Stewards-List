"use client";

import Link from "next/link";
import { ProjectWithCreator } from "@/lib/types";
import { Card, CardBody } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { cn, truncateAtWord, formatDate } from "@/lib/utils";

/**
 * Props for ProjectCard component
 */
export interface ProjectCardProps {
  /** The project object to display */
  project: ProjectWithCreator;
  /** Optional click handler for the card */
  onClick?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Calculates relative time since project creation
 * Returns strings like "Created 2 days ago", "Created today", etc.
 *
 * @param createdAt - The creation date to calculate relative time for
 * @returns Formatted relative time string
 */
function calculateRelativeCreationTime(createdAt: Date | string): string {
  const created =
    typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  const now = new Date();

  // Normalize to midnight for date comparison
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const createdDay = new Date(
    created.getFullYear(),
    created.getMonth(),
    created.getDate()
  );

  const diffTime = today.getTime() - createdDay.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return "Created today";
  } else if (diffDays === 1) {
    return "Created yesterday";
  } else if (diffDays < 7) {
    return `Created ${diffDays} days ago`;
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return `Created ${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    return `Created ${months} ${months === 1 ? "month" : "months"} ago`;
  } else {
    const years = Math.floor(diffDays / 365);
    return `Created ${years} ${years === 1 ? "year" : "years"} ago`;
  }
}

/**
 * Generates initials from a name
 */
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join("");
}

/**
 * ProjectCard - Reusable component for displaying project summary in card format
 *
 * Features:
 * - Displays project name (max 2 lines with line-clamp)
 * - Shows description preview (truncated to 100 characters with ellipsis)
 * - Shows creator name and avatar with initials
 * - Displays member count badge
 * - Shows archived status indicator (grayed out if archived)
 * - Shows relative creation date ("Created 2 days ago")
 * - Hover effects with subtle shadow/lift animation
 * - Clickable link to project detail page
 * - Badge colors: green=active, gray=archived
 *
 * @param props - ProjectCardProps
 * @returns JSX element
 */
export default function ProjectCard({
  project,
  onClick,
  className,
}: ProjectCardProps): JSX.Element {
  const isArchived = project.archived;
  const relativeCreationTime = calculateRelativeCreationTime(project.createdAt);
  const creatorInitials = getInitials(
    project.creator.displayName || project.creator.username
  );

  const cardContent = (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-lg hover:scale-105",
        isArchived && "opacity-60",
        className
      )}
    >
      <CardBody className="p-4">
        {/* Header with status badge */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <Badge
            variant={isArchived ? "default" : "success"}
            size="sm"
          >
            {isArchived ? "Archived" : "Active"}
          </Badge>
        </div>

        {/* Project Name */}
        <h3 className="mb-2 text-base font-semibold text-slate-100 line-clamp-2">
          {project.projectName}
        </h3>

        {/* Description Preview */}
        {project.description && (
          <p className="mb-3 text-sm text-slate-400 line-clamp-2">
            {truncateAtWord(project.description, 100)}
          </p>
        )}

        {/* Footer with creator info and creation date */}
        <div className="flex items-center justify-between border-t border-slate-700 pt-3">
          {/* Creator info with avatar */}
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-blue-100"
              title={
                project.creator.displayName || project.creator.username
              }
            >
              {creatorInitials}
            </div>
            <span className="truncate text-xs font-medium text-slate-400">
              {project.creator.displayName || project.creator.username}
            </span>
          </div>

          {/* Creation date */}
          <span className="text-xs font-medium text-slate-500">
            {relativeCreationTime}
          </span>
        </div>
      </CardBody>
    </Card>
  );

  // Wrap in Link for navigation
  return (
    <Link
      href={`/projects/${project.id}`}
      className="block"
      onClick={(e) => {
        if (onClick) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {cardContent}
    </Link>
  );
}
