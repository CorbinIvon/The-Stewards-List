import React from "react";
import { cn } from "@/lib/utils";

/**
 * Badge component props interface
 */
export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Badge content */
  children: React.ReactNode;
  /** Badge variant/color */
  variant?: "default" | "success" | "warning" | "danger" | "info";
  /** Badge size */
  size?: "sm" | "md";
  /** Additional CSS classes */
  className?: string;
}

/**
 * Badge component for status and category tags
 * Small pill-shaped elements with colored backgrounds
 *
 * Features:
 * - Multiple variants: default (gray), success (green), warning (yellow), danger (red), info (blue)
 * - Two sizes: sm, md
 * - Proper text contrast with backgrounds
 * - Rounded pill shape
 */
const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    { children, variant = "default", size = "md", className, ...props },
    ref
  ) => {
    // Size styles
    const sizeMap: Record<typeof size, string> = {
      sm: "text-xs px-2 py-0.5 rounded-full",
      md: "text-sm px-2.5 py-1 rounded-full",
    };

    // Variant styles with proper contrast
    const variantMap: Record<typeof variant, string> = {
      default: "bg-gray-100 text-gray-800",
      success: "bg-green-100 text-green-800",
      warning: "bg-yellow-100 text-yellow-800",
      danger: "bg-red-100 text-red-800",
      info: "bg-blue-100 text-blue-800",
    };

    // eslint-disable-next-line security/detect-object-injection
    const sizeClassName = sizeMap[size] || sizeMap.md;
    // eslint-disable-next-line security/detect-object-injection
    const variantClassName = variantMap[variant] || variantMap.default;

    return (
      <span
        ref={ref}
        className={cn(sizeClassName, variantClassName, className)}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = "Badge";

export default Badge;
