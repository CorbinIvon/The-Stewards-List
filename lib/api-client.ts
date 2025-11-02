/**
 * Typed API client for communicating with backend API routes
 * Handles requests, responses, error handling, and JWT token management
 */

import type {
  ApiResponse,
  ApiResult,
  ApiError,
  PaginatedResponse,
  PaginationParams,
  User,
  UserPublic,
  Task,
  TaskWithOwner,
  TaskAssignment,
  Permission,
  TaskLog,
  Chat,
  LoginRequest,
  LoginResponse,
  SignupRequest,
  SignupResponse,
  CreateTaskRequest,
  UpdateTaskRequest,
  CreatePermissionRequest,
  UpdatePermissionRequest,
  CreateTaskLogRequest,
  CreateChatRequest,
  UpdateChatRequest,
  AssignTaskRequest,
  UnassignTaskRequest,
} from "./types";

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const TOKEN_STORAGE_KEY = "auth_token";

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Custom error class for API errors
 */
export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

// ============================================================================
// API CLIENT CLASS
// ============================================================================

/**
 * Typed API client for making requests to the backend
 * Handles authentication, error handling, and response types
 */
class ApiClient {
  private token: string | null = null;
  private tokenExpiryTime: number | null = null;

  constructor() {
    this.loadToken();
  }

  // ========================================================================
  // TOKEN MANAGEMENT
  // ========================================================================

  /**
   * Load token from localStorage
   */
  private loadToken(): void {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem(TOKEN_STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        this.token = parsed.token;
        this.tokenExpiryTime = parsed.expiresAt;
      } catch {
        this.clearToken();
      }
    }
  }

  /**
   * Store token in localStorage
   */
  private saveToken(token: string, expiresIn: number): void {
    if (typeof window === "undefined") return;

    const expiresAt = Date.now() + expiresIn * 1000;
    this.token = token;
    this.tokenExpiryTime = expiresAt;

    localStorage.setItem(
      TOKEN_STORAGE_KEY,
      JSON.stringify({ token, expiresAt })
    );
  }

  /**
   * Clear stored token
   */
  private clearToken(): void {
    if (typeof window === "undefined") return;

    this.token = null;
    this.tokenExpiryTime = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }

  /**
   * Check if token is expired or about to expire
   */
  private isTokenExpired(): boolean {
    if (!this.tokenExpiryTime) return true;
    // Refresh if less than 5 minutes remaining
    return Date.now() > this.tokenExpiryTime - 5 * 60 * 1000;
  }

  /**
   * Get current token
   */
  private getToken(): string | null {
    return this.token;
  }

  // ========================================================================
  // HTTP REQUEST HANDLING
  // ========================================================================

  /**
   * Make a typed fetch request with error handling
   */
  private async fetchApi<T>(
    endpoint: string,
    options: RequestInit & { headers?: Record<string, string> } = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };

    // Add authorization header if token exists
    const token = this.getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle response
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 401) {
          this.clearToken();
          if (typeof window !== "undefined") {
            window.location.href = "/login";
          }
        }

        throw new ApiClientError(
          data?.error || `HTTP ${response.status}`,
          response.status,
          data?.details
        );
      }

      return data;
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }

      throw new ApiClientError(
        error instanceof Error ? error.message : "Unknown error",
        500
      );
    }
  }

  /**
   * Make a GET request
   */
  private get<T>(endpoint: string): Promise<T> {
    return this.fetchApi<T>(endpoint, { method: "GET" });
  }

  /**
   * Make a POST request
   */
  private post<T>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.fetchApi<T>(endpoint, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  /**
   * Make a PUT request
   */
  private put<T>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.fetchApi<T>(endpoint, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  /**
   * Make a PATCH request
   */
  private patch<T>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<T> {
    return this.fetchApi<T>(endpoint, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  /**
   * Make a DELETE request
   */
  private delete<T>(endpoint: string): Promise<T> {
    return this.fetchApi<T>(endpoint, { method: "DELETE" });
  }

  // ========================================================================
  // AUTHENTICATION ENDPOINTS
  // ========================================================================

  /**
   * Login with email and password
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    const response = await this.post<ApiResponse<LoginResponse>>(
      "/api/auth/login",
      request
    );

    if (response.success && response.data) {
      this.saveToken(response.data.token, response.data.expiresIn);
    }

    return response.data;
  }

  /**
   * Sign up a new user
   */
  async signup(request: SignupRequest): Promise<SignupResponse> {
    const response = await this.post<ApiResponse<SignupResponse>>(
      "/api/auth/signup",
      request
    );

    if (response.success && response.data) {
      this.saveToken(response.data.token, response.data.expiresIn);
    }

    return response.data;
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await this.post("/api/auth/logout", {});
    } finally {
      this.clearToken();
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<UserPublic> {
    const response = await this.get<ApiResponse<UserPublic>>(
      "/api/auth/me"
    );
    return response.data;
  }

  // ========================================================================
  // USER ENDPOINTS
  // ========================================================================

  /**
   * Get all users (admin only)
   */
  async getUsers(
    params?: PaginationParams
  ): Promise<PaginatedResponse<UserPublic>> {
    const query = new URLSearchParams();
    if (params?.page) query.append("page", String(params.page));
    if (params?.pageSize) query.append("pageSize", String(params.pageSize));

    const queryString = query.toString();
    const endpoint = `/api/users${queryString ? `?${queryString}` : ""}`;

    return this.get<PaginatedResponse<UserPublic>>(endpoint);
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<UserPublic> {
    const response = await this.get<ApiResponse<UserPublic>>(
      `/api/users/${userId}`
    );
    return response.data;
  }

  /**
   * Update user
   */
  async updateUser(
    userId: string,
    updates: Partial<User>
  ): Promise<UserPublic> {
    const response = await this.patch<ApiResponse<UserPublic>>(
      `/api/users/${userId}`,
      updates
    );
    return response.data;
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    await this.delete(`/api/users/${userId}`);
  }

  // ========================================================================
  // TASK ENDPOINTS
  // ========================================================================

  /**
   * Get all tasks
   */
  async getTasks(
    params?: PaginationParams & { ownerId?: string }
  ): Promise<PaginatedResponse<TaskWithOwner>> {
    const query = new URLSearchParams();
    if (params?.page) query.append("page", String(params.page));
    if (params?.pageSize) query.append("pageSize", String(params.pageSize));
    if (params?.ownerId) query.append("ownerId", params.ownerId);

    const queryString = query.toString();
    const endpoint = `/api/tasks${queryString ? `?${queryString}` : ""}`;

    return this.get<PaginatedResponse<TaskWithOwner>>(endpoint);
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<TaskWithOwner> {
    const response = await this.get<ApiResponse<TaskWithOwner>>(
      `/api/tasks/${taskId}`
    );
    return response.data;
  }

  /**
   * Create a new task
   */
  async createTask(request: CreateTaskRequest): Promise<Task> {
    const response = await this.post<ApiResponse<Task>>(
      "/api/tasks",
      request
    );
    return response.data;
  }

  /**
   * Update task
   */
  async updateTask(taskId: string, request: UpdateTaskRequest): Promise<Task> {
    const response = await this.patch<ApiResponse<Task>>(
      `/api/tasks/${taskId}`,
      request
    );
    return response.data;
  }

  /**
   * Delete task
   */
  async deleteTask(taskId: string): Promise<void> {
    await this.delete(`/api/tasks/${taskId}`);
  }

  /**
   * Assign task to user
   */
  async assignTask(taskId: string, request: AssignTaskRequest): Promise<TaskAssignment> {
    const response = await this.post<ApiResponse<TaskAssignment>>(
      `/api/tasks/${taskId}/assign`,
      request
    );
    return response.data;
  }

  /**
   * Unassign task from user
   */
  async unassignTask(taskId: string, request: UnassignTaskRequest): Promise<void> {
    await this.post(`/api/tasks/${taskId}/unassign`, request);
  }

  // ========================================================================
  // PERMISSION ENDPOINTS
  // ========================================================================

  /**
   * Get permissions for a task
   */
  async getPermissions(
    taskId?: string,
    params?: PaginationParams
  ): Promise<PaginatedResponse<Permission>> {
    const query = new URLSearchParams();
    if (taskId) query.append("taskId", taskId);
    if (params?.page) query.append("page", String(params.page));
    if (params?.pageSize) query.append("pageSize", String(params.pageSize));

    const queryString = query.toString();
    const endpoint = `/api/permissions${queryString ? `?${queryString}` : ""}`;

    return this.get<PaginatedResponse<Permission>>(endpoint);
  }

  /**
   * Create permission
   */
  async createPermission(
    request: CreatePermissionRequest
  ): Promise<Permission> {
    const response = await this.post<ApiResponse<Permission>>(
      "/api/permissions",
      request
    );
    return response.data;
  }

  /**
   * Update permission
   */
  async updatePermission(
    permissionId: string,
    request: UpdatePermissionRequest
  ): Promise<Permission> {
    const response = await this.patch<ApiResponse<Permission>>(
      `/api/permissions/${permissionId}`,
      request
    );
    return response.data;
  }

  /**
   * Delete permission
   */
  async deletePermission(permissionId: string): Promise<void> {
    await this.delete(`/api/permissions/${permissionId}`);
  }

  // ========================================================================
  // TASK LOG ENDPOINTS
  // ========================================================================

  /**
   * Get task logs
   */
  async getTaskLogs(
    taskId?: string,
    params?: PaginationParams
  ): Promise<PaginatedResponse<TaskLog>> {
    const query = new URLSearchParams();
    if (taskId) query.append("taskId", taskId);
    if (params?.page) query.append("page", String(params.page));
    if (params?.pageSize) query.append("pageSize", String(params.pageSize));

    const queryString = query.toString();
    const endpoint = `/api/task-logs${queryString ? `?${queryString}` : ""}`;

    return this.get<PaginatedResponse<TaskLog>>(endpoint);
  }

  /**
   * Create task log
   */
  async createTaskLog(
    taskId: string,
    request: CreateTaskLogRequest
  ): Promise<TaskLog> {
    const response = await this.post<ApiResponse<TaskLog>>(
      `/api/tasks/${taskId}/logs`,
      request
    );
    return response.data;
  }

  // ========================================================================
  // CHAT ENDPOINTS
  // ========================================================================

  /**
   * Get chat messages
   */
  async getChats(
    queryKey: string,
    params?: PaginationParams
  ): Promise<PaginatedResponse<Chat>> {
    const query = new URLSearchParams();
    query.append("queryKey", queryKey);
    if (params?.page) query.append("page", String(params.page));
    if (params?.pageSize) query.append("pageSize", String(params.pageSize));

    const endpoint = `/api/chats?${query.toString()}`;
    return this.get<PaginatedResponse<Chat>>(endpoint);
  }

  /**
   * Create chat message
   */
  async createChat(request: CreateChatRequest): Promise<Chat> {
    const response = await this.post<ApiResponse<Chat>>(
      "/api/chats",
      request
    );
    return response.data;
  }

  /**
   * Update chat message
   */
  async updateChat(chatId: string, request: UpdateChatRequest): Promise<Chat> {
    const response = await this.patch<ApiResponse<Chat>>(
      `/api/chats/${chatId}`,
      request
    );
    return response.data;
  }

  /**
   * Delete chat message
   */
  async deleteChat(chatId: string): Promise<void> {
    await this.delete(`/api/chats/${chatId}`);
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

/**
 * Singleton instance of the API client
 * Use this throughout the application for consistent API communication
 */
export const apiClient = new ApiClient();

// ============================================================================
// EXPORT FOR USE IN TESTS
// ============================================================================

export { ApiClient };
