"use client";

import React from "react";
import { cn } from "@/lib/utils";

/**
 * Alert component props interface
 */
export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Alert content */
  children: React.ReactNode;
  /** Alert variant/color */
  variant?: "success" | "error" | "warning" | "info";
  /** Optional alert title shown in bold */
  title?: string;
  /** Optional callback when dismiss button is clicked */
  onDismiss?: () => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Icon map for different alert variants
 * Uses Unicode symbols for simplicity and accessibility
 */
const iconMap: Record<string, string> = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

/**
 * Alert component for displaying notifications and messages
 * Provides user feedback with different severity levels
 *
 * Features:
 * - Multiple variants: success (green), error (red), warning (yellow), info (blue)
 * - Optional title in bold
 * - Optional dismiss button when onDismiss callback provided
 * - Accessible with role="alert" and aria-live for dynamic content
 * - Icons based on variant
 */
const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  (
    {
      children,
      variant = "info",
      title,
      onDismiss,
      className,
      ...props
    },
    ref
  ) => {
    // Variant styles with background and text colors
    const variantMap: Record<string, string> = {
      success: "bg-green-50 border-l-4 border-green-500 text-green-800",
      error: "bg-red-50 border-l-4 border-red-500 text-red-800",
      warning: "bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800",
      info: "bg-blue-50 border-l-4 border-blue-500 text-blue-800",
    };

    // Icon background colors
    const iconBgMap: Record<string, string> = {
      success: "bg-green-200 text-green-800",
      error: "bg-red-200 text-red-800",
      warning: "bg-yellow-200 text-yellow-800",
      info: "bg-blue-200 text-blue-800",
    };

    // Dismiss button colors
    const dismissBgMap: Record<string, string> = {
      success: "hover:bg-green-100 text-green-600",
      error: "hover:bg-red-100 text-red-600",
      warning: "hover:bg-yellow-100 text-yellow-600",
      info: "hover:bg-blue-100 text-blue-600",
    };

    const variantClassName = variantMap[variant] || variantMap.info;
    const iconBgClassName = iconBgMap[variant] || iconBgMap.info;
    const dismissClassName = dismissBgMap[variant] || dismissBgMap.info;
    const icon = iconMap[variant] || iconMap.info;

    return (
      <div
        ref={ref}
        role="alert"
        aria-live={variant === "error" ? "assertive" : "polite"}
        className={cn(
          "flex gap-3 rounded-md p-4",
          variantClassName,
          className
        )}
        {...props}
      >
        {/* Icon */}
        <div
          className={cn(
            "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-lg font-bold",
            iconBgClassName
          )}
          aria-hidden="true"
        >
          {icon}
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-1">
          {title && (
            <h3 className="font-semibold">
              {title}
            </h3>
          )}
          <div className="text-sm">
            {children}
          </div>
        </div>

        {/* Dismiss button */}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className={cn(
              "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded transition-colors",
              dismissClassName
            )}
            aria-label="Dismiss alert"
            type="button"
          >
            <span className="text-lg leading-none">×</span>
          </button>
        )}
      </div>
    );
  }
);

Alert.displayName = "Alert";

export default Alert;
