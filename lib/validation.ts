import { z } from "zod";
import { NextResponse } from "next/server";

/**
 * Password validation schema with strict requirements
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 */
const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters long")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/\d/, "Password must contain at least one number")
  .regex(
    /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/,
    "Password must contain at least one special character"
  );

/**
 * Email validation schema with proper email format
 */
const emailSchema = z
  .string()
  .email("Must be a valid email address")
  .toLowerCase()
  .trim();

/**
 * String sanitization to prevent XSS attacks
 * Removes potentially dangerous characters and trims whitespace
 */
function sanitizeString(input: string): string {
  return input.trim().replace(/[<>\"']/g, (match) => {
    // Avoid dynamic object property access to satisfy security lint rule
    switch (match) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#x27;";
      default:
        return match;
    }
  });
}

/**
 * Custom zod transform for sanitizing strings
 */
const sanitizedString = z.string().transform(sanitizeString);

/**
 * User creation schema
 * Validates: email, username, displayName, password
 */
export const createUserSchema = z.object({
  email: emailSchema,
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(32, "Username must be at most 32 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "Username can only contain letters, numbers, underscores, and hyphens"
    )
    .transform(sanitizeString),
  displayName: z
    .string()
    .min(1, "Display name is required")
    .max(128, "Display name must be at most 128 characters")
    .transform(sanitizeString),
  password: passwordSchema,
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Task creation schema
 * Validates: ownerId, title, description (optional), frequency (optional)
 */
export const createTaskSchema = z.object({
  ownerId: z.string().uuid("Invalid user ID format"),
  title: z
    .string()
    .min(1, "Task title is required")
    .max(256, "Task title must be at most 256 characters")
    .transform(sanitizeString),
  description: z
    .string()
    .max(2000, "Task description must be at most 2000 characters")
    .transform(sanitizeString)
    .optional(),
  frequency: z
    .enum(["DAILY", "WEEKLY", "MONTHLY", "YEARLY", "ONE_TIME"])
    .optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

/**
 * Task query parameters schema
 * Validates: ownerId (optional)
 */
export const taskQuerySchema = z.object({
  ownerId: z.string().uuid().optional(),
});

export type TaskQuery = z.infer<typeof taskQuerySchema>;

/**
 * Permission creation schema
 * Validates: userId, taskId, permission
 */
export const createPermissionSchema = z.object({
  userId: z.string().uuid("Invalid user ID format"),
  taskId: z.string().uuid("Invalid task ID format"),
  permission: z
    .enum(["READ", "WRITE", "DELETE", "ADMIN"])
    .describe("Permission level for the user on this task"),
});

export type CreatePermissionInput = z.infer<typeof createPermissionSchema>;

/**
 * Permission query parameters schema
 * Validates: userId (optional), taskId (optional)
 */
export const permissionQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
});

export type PermissionQuery = z.infer<typeof permissionQuerySchema>;

/**
 * Task log creation schema
 * Validates: taskId, userId
 */
export const createTaskLogSchema = z.object({
  taskId: z.string().uuid("Invalid task ID format"),
  userId: z.string().uuid("Invalid user ID format"),
});

export type CreateTaskLogInput = z.infer<typeof createTaskLogSchema>;

/**
 * Task log query parameters schema
 * Validates: taskId (optional), userId (optional)
 */
export const taskLogQuerySchema = z.object({
  taskId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

export type TaskLogQuery = z.infer<typeof taskLogQuerySchema>;

/**
 * Chat creation schema
 * Validates: queryKey, userId, message, quoteChatId (optional)
 */
export const createChatSchema = z.object({
  queryKey: z
    .string()
    .min(1, "Query key is required")
    .max(256, "Query key must be at most 256 characters")
    .transform(sanitizeString),
  userId: z.string().uuid("Invalid user ID format"),
  message: z
    .string()
    .min(1, "Message cannot be empty")
    .max(4000, "Message must be at most 4000 characters")
    .transform(sanitizeString),
  quoteChatId: z.string().uuid().optional(),
});

export type CreateChatInput = z.infer<typeof createChatSchema>;

/**
 * Chat query parameters schema
 * Validates: queryKey (optional), userId (optional)
 */
export const chatQuerySchema = z.object({
  queryKey: z.string().optional(),
  userId: z.string().uuid().optional(),
});

export type ChatQuery = z.infer<typeof chatQuerySchema>;

/**
 * Error response interface
 */
export interface ValidationError {
  success: false;
  errors: Array<{
    field: string;
    message: string;
  }>;
}

/**
 * Success response interface
 */
export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

/**
 * Validation result type
 */
export type ValidationResult<T> = ValidationSuccess<T> | ValidationError;

/**
 * Validates request body against a zod schema
 * Returns formatted error response if validation fails
 *
 * @param data - The data to validate
 * @param schema - The zod schema to validate against
 * @returns ValidationResult with either parsed data or errors
 */
export function validateRequest<T>(
  data: unknown,
  schema: z.ZodSchema<T>
): ValidationResult<T> {
  try {
    const validatedData = schema.parse(data);
    return {
      success: true,
      data: validatedData,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        // Use `issues` (Zod's current property) which contains path/message
        errors: error.issues.map((err) => ({
          field: err.path.join(".") || "unknown",
          message: err.message,
        })),
      };
    }

    return {
      success: false,
      errors: [
        {
          field: "unknown",
          message: "An unexpected validation error occurred",
        },
      ],
    };
  }
}

/**
 * Helper function to create a NextResponse for validation errors
 * Useful for API route handlers
 *
 * @param error - ValidationError object
 * @param statusCode - HTTP status code (default: 400)
 * @returns NextResponse with formatted error
 */
export function validationErrorResponse(
  error: ValidationError,
  statusCode: number = 400
) {
  return NextResponse.json(
    {
      error: "Validation failed",
      details: error.errors,
    },
    { status: statusCode }
  );
}

/**
 * Type guard to check if validation result is an error
 *
 * @param result - ValidationResult to check
 * @returns true if result is an error
 */
export function isValidationError<T>(
  result: ValidationResult<T>
): result is ValidationError {
  return !result.success;
}
