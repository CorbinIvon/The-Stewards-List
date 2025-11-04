/**
 * Core TypeScript type definitions for The Stewards List application
 * Includes interfaces for all Prisma models, API responses, and authentication
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * User roles for role-based access control
 */
export enum UserRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  MEMBER = "MEMBER",
}

/**
 * Task status lifecycle states
 */
export enum TaskStatus {
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

/**
 * Task recurrence patterns
 */
export enum TaskFrequency {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  BIWEEKLY = "BIWEEKLY",
  MONTHLY = "MONTHLY",
  QUARTERLY = "QUARTERLY",
  YEARLY = "YEARLY",
  ONCE = "ONCE",
}

/**
 * Task priority levels
 */
export enum TaskPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  URGENT = "URGENT",
}

/**
 * Permission levels for task access control
 */
export enum PermissionType {
  READ = "READ",
  WRITE = "WRITE",
  DELETE = "DELETE",
  ADMIN = "ADMIN",
}

/**
 * Task log action types for audit trail
 */
export enum TaskLogAction {
  CREATED = "CREATED",
  UPDATED = "UPDATED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  ASSIGNED = "ASSIGNED",
  UNASSIGNED = "UNASSIGNED",
  COMMENTED = "COMMENTED",
}

// ============================================================================
// MODEL INTERFACES
// ============================================================================

/**
 * User model interface
 */
export interface User {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  requiresPasswordReset?: boolean;
  isActive: boolean;
  lastLoginAt: Date | null;
}

/**
 * User without sensitive data (for API responses)
 */
export interface UserPublic extends Omit<User, "passwordHash"> {}

/**
 * Task model interface
 */
export interface Task {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  frequency: TaskFrequency | null;
  // Original generic due date (kept for backward compatibility)
  dueDate: Date | null;
  // When the task should be started (schedule start)
  assignDate: Date | null;
  // When the scheduled occurrence is due by
  dueBy: Date | null;
  completedAt: Date | null;
  isDeleted: boolean;
  deletedAt: Date | null;
}

/**
 * Task with owner information (for API responses)
 */
export interface TaskWithOwner extends Task {
  owner: UserPublic;
}

/**
 * Task assignment model interface
 */
export interface TaskAssignment {
  id: string;
  createdAt: Date;
  taskId: string;
  userId: string;
  assignedBy: string | null;
}

/**
 * Task assignment with related data
 */
export interface TaskAssignmentWithRelations extends TaskAssignment {
  task: Task;
  user: UserPublic;
}

/**
 * Permission model interface
 */
export interface Permission {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
  taskId: string;
  permission: PermissionType;
}

/**
 * Permission with related data
 */
export interface PermissionWithRelations extends Permission {
  user: UserPublic;
  task: Task;
}

/**
 * Task log model interface
 */
export interface TaskLog {
  id: string;
  createdAt: Date;
  taskId: string;
  userId: string;
  action: TaskLogAction;
  note: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Task log with related data
 */
export interface TaskLogWithRelations extends TaskLog {
  task: Task;
  user: UserPublic;
}

/**
 * Chat model interface
 */
export interface Chat {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  queryKey: string;
  userId: string;
  taskId: string | null;
  quoteChatId: string | null;
  message: string;
  isEdited: boolean;
  isDeleted: boolean;
  deletedAt: Date | null;
}

/**
 * Chat with related data
 */
export interface ChatWithRelations extends Chat {
  user: UserPublic;
  task: Task | null;
  quotedChat: Chat | null;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

/**
 * Standard API success response wrapper
 */
export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
  timestamp: string;
}

/**
 * Standard API error response
 */
export interface ApiError {
  success: false;
  error: string;
  details?: unknown;
  timestamp: string;
  requestId?: string;
}

/**
 * API response type union
 */
export type ApiResult<T = unknown> = ApiResponse<T> | ApiError;

/**
 * Paginated response wrapper
 */
export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
  timestamp: string;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

// ============================================================================
// AUTHENTICATION TYPES
// ============================================================================

/**
 * JWT payload (AuthUser)
 */
export interface AuthUser {
  id: string;
  email: string;
  username: string;
  role: UserRole;
  isActive: boolean;
  requiresPasswordReset?: boolean;
  iat?: number; // issued at
  exp?: number; // expiration time
}

/**
 * Login request payload
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Login response payload
 */
export interface LoginResponse {
  user: AuthUser;
  token: string;
  expiresIn: number; // seconds
}

/**
 * Signup request payload
 */
export interface SignupRequest {
  email: string;
  username: string;
  displayName: string;
  password: string;
}

/**
 * Signup response payload
 */
export interface SignupResponse {
  user: AuthUser;
  token: string;
  expiresIn: number; // seconds
}

/**
 * Refresh token request payload
 */
export interface RefreshTokenRequest {
  token: string;
}

/**
 * Refresh token response payload
 */
export interface RefreshTokenResponse {
  token: string;
  expiresIn: number; // seconds
}

// ============================================================================
// REQUEST/RESPONSE TYPES FOR SPECIFIC ENDPOINTS
// ============================================================================

/**
 * Create task request payload
 */
export interface CreateTaskRequest {
  title: string;
  description?: string;
  priority?: TaskPriority;
  frequency?: TaskFrequency;
  dueDate?: string; // ISO 8601 date string
}

/**
 * Update task request payload
 */
export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  frequency?: TaskFrequency;
  dueDate?: string | null;
  completedAt?: string | null;
}

/**
 * Create permission request payload
 */
export interface CreatePermissionRequest {
  userId: string;
  taskId: string;
  permission: PermissionType;
}

/**
 * Update permission request payload
 */
export interface UpdatePermissionRequest {
  permission: PermissionType;
}

/**
 * Create task log request payload
 */
export interface CreateTaskLogRequest {
  action: TaskLogAction;
  note?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Create chat message request payload
 */
export interface CreateChatRequest {
  queryKey: string;
  message: string;
  taskId?: string;
  quoteChatId?: string;
}

/**
 * Update chat message request payload
 */
export interface UpdateChatRequest {
  message: string;
}

/**
 * Assign task to user request payload
 */
export interface AssignTaskRequest {
  userId: string;
}

/**
 * Unassign task from user request payload
 */
export interface UnassignTaskRequest {
  userId: string;
}

/**
 * Response for task assignment operations
 */
export interface TaskAssignmentResponse {
  id: string;
  taskId: string;
  userId: string;
  assignedBy: string | null;
  createdAt: Date;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

/**
 * Application-specific error codes
 */
export enum ErrorCode {
  // Authentication
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
  TOKEN_INVALID = "TOKEN_INVALID",
  UNAUTHORIZED = "UNAUTHORIZED",
  FORBIDDEN = "FORBIDDEN",

  // Validation
  VALIDATION_ERROR = "VALIDATION_ERROR",
  INVALID_INPUT = "INVALID_INPUT",

  // Resources
  NOT_FOUND = "NOT_FOUND",
  CONFLICT = "CONFLICT",
  ALREADY_EXISTS = "ALREADY_EXISTS",

  // Server
  INTERNAL_ERROR = "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

  // Database
  DATABASE_ERROR = "DATABASE_ERROR",
  CONSTRAINT_ERROR = "CONSTRAINT_ERROR",
}

/**
 * Application error with code and details
 */
export interface AppError extends Error {
  code: ErrorCode;
  status: number;
  details?: unknown;
}

// ============================================================================
// UTILITY TYPES
// ============================================================================

/**
 * Omit password from User type
 */
export type UserWithoutPassword = Omit<User, "passwordHash">;

/**
 * Optional version of Task fields
 */
export type PartialTask = Partial<Omit<Task, "id" | "createdAt" | "updatedAt">>;

/**
 * Type for extracting enum values
 */
export type EnumValues<T> = T[keyof T];
