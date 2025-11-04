"use client";

import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea component props interface
 * Extends HTMLTextAreaElement attributes
 */
export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Label text displayed above textarea */
  label?: string;
  /** Error message displayed below textarea in red */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Number of rows for the textarea (default: 4) */
  rows?: number;
  /** Maximum character length */
  maxLength?: number;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Textarea component with label and error display
 * Supports accessibility with proper ARIA attributes
 *
 * Features:
 * - Optional label above textarea
 * - Error message display in red
 * - Required field indicator
 * - Disabled state styling
 * - Focus state styling with blue ring
 * - Character count display when maxLength is provided
 * - Configurable row height (default: 4 rows)
 * - Full keyboard navigation
 * - Accessibility features with ARIA attributes
 */
const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      label,
      name,
      id: customId,
      placeholder,
      value,
      onChange,
      error,
      required = false,
      disabled = false,
      rows = 4,
      maxLength,
      className,
      ...props
    },
    ref
  ) => {
    // Generate unique ID if not provided
    const generatedId = useId();
    const id = customId || generatedId;
    const errorId = `${id}-error`;
    const countId = `${id}-count`;

    // Calculate character count
    const currentLength = typeof value === "string" ? value.length : 0;
    const showCharCount = maxLength !== undefined;

    // Base textarea styles
    const textareaBaseStyles =
      "w-full px-3 py-2 text-base rounded-lg border transition-colors duration-200 resize-none";

    // Border and focus styles
    const textareaBorderStyles = error
      ? "border-red-500 focus:border-red-400 focus:ring-1 focus:ring-red-400"
      : "border-[color:var(--border)] focus:border-blue-400 focus:ring-1 focus:ring-blue-400";

    // Disabled state
    const textareaDisabledStyles = disabled
      ? "bg-[color:var(--panel)] text-[color:var(--muted)] cursor-not-allowed"
      : "bg-[color:var(--panel)] text-[color:var(--text)] placeholder:text-[color:var(--muted)]";

    const textareaClassName = cn(
      textareaBaseStyles,
      textareaBorderStyles,
      textareaDisabledStyles,
      "focus:outline-none",
      className
    );

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={id}
            className={cn(
              "text-sm font-medium",
              required
                ? "text-[color:var(--text)]"
                : "text-[color:var(--text)]",
              disabled ? "text-[color:var(--muted)]" : ""
            )}
          >
            {label}
            {required && <span className="ml-1 text-red-400">*</span>}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          name={name}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          rows={rows}
          maxLength={maxLength}
          className={textareaClassName}
          aria-invalid={!!error}
          aria-describedby={
            error ? errorId : showCharCount ? countId : undefined
          }
          {...props}
        />
        <div className="flex flex-col gap-1">
          {error && (
            <p id={errorId} className="text-sm text-red-400">
              {error}
            </p>
          )}
          {showCharCount && (
            <p
              id={countId}
              className={cn(
                "text-xs text-right",
                currentLength > maxLength * 0.9
                  ? "text-orange-400 font-medium"
                  : "text-[color:var(--muted)]"
              )}
            >
              {currentLength}/{maxLength}
            </p>
          )}
        </div>
      </div>
    );
  }
);

Textarea.displayName = "Textarea";

export default Textarea;
