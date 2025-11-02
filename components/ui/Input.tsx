"use client";

import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Input component props interface
 * Supports text, email, password, number, date types
 */
export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Label text displayed above input */
  label?: string;
  /** Error message displayed below input in red */
  error?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Input component with label and error display
 * Supports accessibility with proper ARIA attributes
 *
 * Features:
 * - Optional label above input
 * - Error message display in red
 * - Required field indicator
 * - Disabled state styling
 * - Focus state styling with blue ring
 * - Proper input types: text, email, password, number, date
 * - Full keyboard navigation
 */
const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      type = "text",
      name,
      id: customId,
      placeholder,
      value,
      onChange,
      error,
      required = false,
      disabled = false,
      className,
      ...props
    },
    ref
  ) => {
    // Generate unique ID if not provided
    const generatedId = useId();
    const id = customId || generatedId;
    const errorId = `${id}-error`;

    // Base input styles
    const inputBaseStyles =
      "w-full px-3 py-2 text-base rounded-lg border transition-colors duration-200";

    // Border and focus styles
    const inputBorderStyles = error
      ? "border-red-500 focus:border-red-600 focus:ring-1 focus:ring-red-500"
      : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

    // Disabled state
    const inputDisabledStyles = disabled
      ? "bg-gray-100 text-gray-500 cursor-not-allowed"
      : "bg-white text-gray-900 placeholder:text-gray-500";

    const inputClassName = cn(
      inputBaseStyles,
      inputBorderStyles,
      inputDisabledStyles,
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
              required ? "text-gray-900" : "text-gray-700",
              disabled ? "text-gray-500" : ""
            )}
          >
            {label}
            {required && <span className="ml-1 text-red-600">*</span>}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          name={name}
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          disabled={disabled}
          required={required}
          className={inputClassName}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
        {error && (
          <p id={errorId} className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
