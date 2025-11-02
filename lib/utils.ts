/**
 * Utility functions for The Stewards List UI components
 * Includes className merging, date formatting, and text manipulation
 */

/**
 * Merges multiple class names and removes duplicates
 * Handles conditional classes and falsy values
 *
 * @param classes - Variable number of class name strings, arrays, or objects
 * @returns Merged class name string
 */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes
    .flat()
    .filter((cls) => typeof cls === "string" && cls.length > 0)
    .join(" ");
}

/**
 * Formats a date to a human-readable string
 * Default format: "Nov 02, 2025"
 *
 * @param date - Date object or ISO string
 * @param format - Format style: "short" | "long" | "full" (default: "short")
 * @returns Formatted date string
 */
export function formatDate(
  date: Date | string,
  format: "short" | "long" | "full" = "short"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return "Invalid date";
  }

  const options: Intl.DateTimeFormatOptions =
    format === "short"
      ? { month: "short", day: "2-digit", year: "numeric" }
      : format === "long"
        ? { month: "long", day: "numeric", year: "numeric" }
        : {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          };

  return dateObj.toLocaleDateString("en-US", options);
}

/**
 * Formats a date and time to a human-readable string
 * Format: "Nov 02, 2025 at 3:30 PM"
 *
 * @param date - Date object or ISO string
 * @returns Formatted date and time string
 */
export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  if (isNaN(dateObj.getTime())) {
    return "Invalid date";
  }

  const dateStr = formatDate(dateObj, "short");
  const timeStr = dateObj.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return `${dateStr} at ${timeStr}`;
}

/**
 * Truncates a string to a maximum length and adds ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 50)
 * @param suffix - Suffix to add when truncated (default: "...")
 * @returns Truncated string
 */
export function truncate(
  text: string,
  maxLength: number = 50,
  suffix: string = "..."
): string {
  if (text.length <= maxLength) {
    return text;
  }

  return text.substring(0, maxLength - suffix.length) + suffix;
}

/**
 * Truncates text at word boundaries to avoid breaking words
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 50)
 * @param suffix - Suffix to add when truncated (default: "...")
 * @returns Truncated string at word boundary
 */
export function truncateAtWord(
  text: string,
  maxLength: number = 50,
  suffix: string = "..."
): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text.substring(0, maxLength - suffix.length);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > 0) {
    return truncated.substring(0, lastSpace) + suffix;
  }

  return truncated + suffix;
}

/**
 * Capitalizes the first letter of a string
 *
 * @param text - Text to capitalize
 * @returns Capitalized string
 */
export function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Converts a string to title case
 * Example: "hello world" becomes "Hello World"
 *
 * @param text - Text to convert
 * @returns Title cased string
 */
export function toTitleCase(text: string): string {
  return text
    .split(" ")
    .map((word) => capitalize(word.toLowerCase()))
    .join(" ");
}

/**
 * Generates a unique ID for use in form elements
 * Format: "id-" + random string
 *
 * @param prefix - Optional prefix for the ID (default: "id")
 * @returns Generated unique ID
 */
export function generateId(prefix: string = "id"): string {
  return `${prefix}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Checks if a value is null or undefined
 *
 * @param value - Value to check
 * @returns True if value is null or undefined
 */
export function isNil(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

/**
 * Deep clones an object (limited to JSON-serializable objects)
 *
 * @param obj - Object to clone
 * @returns Cloned object
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Delays execution for a specified number of milliseconds
 * Useful for throttling, debouncing, or adding pauses between operations
 *
 * @param ms - Number of milliseconds to sleep
 * @returns Promise that resolves after the specified delay
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
