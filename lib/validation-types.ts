/**
 * Re-export all validation types for cleaner imports
 * Usage: import type { CreateUserInput, CreateTaskInput } from '@/lib/validation-types'
 */

export type {
  CreateUserInput,
  CreateTaskInput,
  TaskQuery,
  CreatePermissionInput,
  PermissionQuery,
  CreateTaskLogInput,
  TaskLogQuery,
  CreateChatInput,
  ChatQuery,
  ValidationError,
  ValidationSuccess,
  ValidationResult,
} from './validation';
