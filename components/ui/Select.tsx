"use client";

import React, { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

/**
 * Select component props interface
 */
export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> {
  /** Label text displayed above select */
  label?: string;
  /** Array of options with value and label */
  options: Array<{ value: string; label: string }>;
  /** Error message displayed below select in red */
  error?: string;
  /** Placeholder text (only works when value is empty) */
  placeholder?: string;
  /** Whether the field is required */
  required?: boolean;
  /** Whether the field is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Change handler */
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
}

/**
 * Select component with label and error display
 * Uses native select element for best accessibility
 *
 * Features:
 * - Optional label above select
 * - Error message display in red
 * - Optional placeholder
 * - Required field indicator
 * - Disabled state styling
 * - Focus state styling with blue ring
 * - Full keyboard navigation
 * - Native browser select behavior
 */
const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      label,
      name,
      id: customId,
      options = [],
      value,
      onChange,
      error,
      placeholder,
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

    // Base select styles
    const selectBaseStyles =
      "w-full px-3 py-2 text-base rounded-lg border transition-colors duration-200 appearance-none bg-white cursor-pointer pr-10";

    // Background image for dropdown arrow
    const selectBackground =
      'url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 fill=%22none%22 viewBox=%220 0 20 20%22%3E%3Cpath stroke=%22%236b7280%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22 stroke-width=%221.5%22 d=%226 8l4 4 4-4%22/%3E%3C/svg%3E") no-repeat right 0.5rem center/1.5em 1.5em';

    // Border and focus styles
    const selectBorderStyles = error
      ? "border-red-500 focus:border-red-600 focus:ring-1 focus:ring-red-500"
      : "border-gray-300 focus:border-blue-500 focus:ring-1 focus:ring-blue-500";

    // Disabled state
    const selectDisabledStyles = disabled
      ? "bg-gray-100 text-gray-500 cursor-not-allowed"
      : "text-gray-900";

    const selectClassName = cn(
      selectBaseStyles,
      selectBorderStyles,
      selectDisabledStyles,
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
        <div className="relative">
          <select
            ref={ref}
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            disabled={disabled}
            required={required}
            className={selectClassName}
            style={{
              backgroundImage: selectBackground,
            }}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : undefined}
            {...props}
          >
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        {error && (
          <p id={errorId} className="text-sm text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
