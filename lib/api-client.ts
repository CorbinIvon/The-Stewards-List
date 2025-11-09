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
  Project,
  ProjectWithRelations,
  ProjectCollaboratorWithUser,
  ProjectPermissionWithUser,
  CreateProjectRequest,
  UpdateProjectRequest,
  PermissionType,
  RefreshTokenRequest,
} from "./types";

// ============================================================================
// JWT DECODING UTILITY
// ============================================================================

/**
 * Lightweight JWT decoder (does not verify signature, only decodes)
 * Used to extract expiration time from access token
 */
function decodeJwt(token: string): { exp?: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    // Decode the payload (second part)
    const payload = parts[1];
    // Add padding if needed
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch (e) {
    return null;
  }
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_BASE_URL =
  typeof window !== "undefined"
    ? window.location.origin
    : process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const TOKEN_STORAGE_KEY = "auth_token";
const REFRESH_TOKEN_STORAGE_KEY = "authRefreshToken";

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

/**
 * Specific error thrown when the server requires the user to complete a
 * password reset flow (admin forced reset). UI can catch this and redirect
 * or show a dedicated flow.
 */
export class PasswordResetRequiredError extends ApiClientError {
  constructor(
    message = "Password reset required",
    status = 403,
    details?: unknown
  ) {
    super(message, status, details);
    this.name = "PasswordResetRequiredError";
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
  private refreshToken: string | null = null;
  private refreshInProgress: boolean = false;
  private failedRefreshAttempts: number = 0;
  private maxRefreshAttempts: number = 3;

  constructor() {
    this.loadToken();
    this.loadRefreshToken();
  }

  // ========================================================================
  // TOKEN MANAGEMENT
  // ========================================================================

  /**
   * Get token expiration information
   * @returns Object with expiresAt timestamp and secondsRemaining, or null if no token
   */
  getTokenExpiration(): {
    expiresAt: number;
    secondsRemaining: number;
  } | null {
    if (!this.token) return null;

    const decoded = decodeJwt(this.token);
    if (!decoded?.exp) return null;

    const expiresAt = decoded.exp * 1000; // Convert seconds to milliseconds
    const secondsRemaining = Math.floor((expiresAt - Date.now()) / 1000);

    return {
      expiresAt,
      secondsRemaining,
    };
  }

  /**
   * Check if token should be refreshed
   * @returns true if token exists and expires within next 5 minutes
   */
  shouldRefreshToken(): boolean {
    const expiration = this.getTokenExpiration();
    if (!expiration) return false;

    // Refresh if less than 5 minutes remaining
    const REFRESH_THRESHOLD_SECONDS = 5 * 60;
    return expiration.secondsRemaining < REFRESH_THRESHOLD_SECONDS;
  }

  /**
   * Get current access token
   * @returns The access token or null if not available
   */
  getAccessToken(): string | null {
    return this.token;
  }

  /**
   * Set access token directly (for testing or manual management)
   * @param token - The access token to store
   */
  setAccessToken(token: string): void {
    this.token = token;
    const decoded = decodeJwt(token);
    if (decoded?.exp) {
      this.tokenExpiryTime = decoded.exp * 1000;
      // Save to localStorage
      if (typeof window !== "undefined") {
        const expiresAt = decoded.exp * 1000;
        localStorage.setItem(
          TOKEN_STORAGE_KEY,
          JSON.stringify({ token, expiresAt })
        );
      }
    }
  }

  /**
   * Clear access token
   */
  clearAccessToken(): void {
    this.clearToken();
  }

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
    // Also set a cookie so server-side middleware can read authentication
    // information on first request (middleware can't access localStorage).
    try {
      const expires = new Date(Date.now() + expiresIn * 1000).toUTCString();
      // Use a reasonably safe cookie policy; adjust SameSite/Secure as needed
      document.cookie = `authToken=${token}; Expires=${expires}; Path=/; SameSite=Lax`;
    } catch (e) {
      // Ignore cookie set errors in environments that restrict document.cookie
      // (e.g. some test harnesses)
    }
  }

  /**
   * Clear stored token
   */
  private clearToken(): void {
    if (typeof window === "undefined") return;

    this.token = null;
    this.tokenExpiryTime = null;
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    try {
      // Clear the auth cookie so server-side middleware won't see stale tokens
      document.cookie = `authToken=; Max-Age=0; Path=/; SameSite=Lax`;
    } catch (e) {
      // Ignore
    }
  }

  /**
   * Load refresh token from localStorage
   */
  private loadRefreshToken(): void {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY);
    if (stored) {
      this.refreshToken = stored;
    }
  }

  /**
   * Store refresh token in localStorage
   */
  private saveRefreshToken(token: string): void {
    if (typeof window === "undefined") return;

    this.refreshToken = token;
    localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, token);
  }

  /**
   * Clear stored refresh token
   */
  private clearRefreshTokenInternal(): void {
    if (typeof window === "undefined") return;

    this.refreshToken = null;
    localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
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
   * Attempt to refresh the access token silently
   * @returns true if refresh was successful, false otherwise
   */
  private async attemptTokenRefresh(): Promise<boolean> {
    // Prevent multiple concurrent refresh attempts
    if (this.refreshInProgress) {
      return false;
    }

    // Prevent infinite retry loops
    if (this.failedRefreshAttempts >= this.maxRefreshAttempts) {
      return false;
    }

    const currentRefreshToken = this.refreshToken;
    if (!currentRefreshToken) {
      return false;
    }

    this.refreshInProgress = true;

    try {
      const url = `${API_BASE_URL}/api/auth/refresh`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: currentRefreshToken }),
      });

      if (!response.ok) {
        this.failedRefreshAttempts++;
        return false;
      }

      const data = await response.json().catch(() => null);

      if (data?.success && data?.data) {
        // Successfully refreshed tokens
        this.saveToken(data.data.token, data.data.expiresIn);
        this.saveRefreshToken(data.data.refreshToken);
        this.failedRefreshAttempts = 0; // Reset on success
        return true;
      }

      this.failedRefreshAttempts++;
      return false;
    } catch (error) {
      this.failedRefreshAttempts++;
      return false;
    } finally {
      this.refreshInProgress = false;
    }
  }

  /**
   * Make a typed fetch request with error handling and auto-refresh interceptor
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

    // Pre-emptive refresh: Check if token should be refreshed before making request
    // Skip refresh for auth endpoints to avoid circular dependencies
    const isAuthEndpoint =
      endpoint.includes("/api/auth/") &&
      !endpoint.includes("/api/auth/logout");
    if (!isAuthEndpoint && this.shouldRefreshToken()) {
      await this.attemptTokenRefresh();
    }

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
        // If the server indicates the user must complete a password reset,
        // surface a specific error so UI can react (redirect to complete-reset page).
        const serverMessage = data?.error || null;
        if (
          response.status === 403 &&
          serverMessage === "Password reset required"
        ) {
          if (typeof window !== "undefined") {
            // Avoid redirecting if we're already on the complete-reset UI to
            // prevent redirect loops. The actual UI lives at `/complete-reset`
            // (app group `(auth)`), and we also support `/auth/complete-reset`
            // as a compatibility redirect path.
            try {
              const currentPath = window.location.pathname;
              const resetPaths = ["/complete-reset", "/auth/complete-reset"];
              if (!resetPaths.includes(currentPath)) {
                window.location.href = "/auth/complete-reset";
              }
            } catch (e) {
              // ignore
            }
          }
          throw new PasswordResetRequiredError(
            serverMessage,
            response.status,
            data?.details
          );
        }

        // Handle 401 Unauthorized - attempt token refresh
        if (response.status === 401) {
          // Only attempt refresh once per request
          const refreshToken = this.refreshToken;
          if (refreshToken && !isAuthEndpoint) {
            // Try to refresh the token
            const refreshSucceeded = await this.attemptTokenRefresh();

            if (refreshSucceeded) {
              // Retry original request with new token
              return this.fetchApi<T>(endpoint, options);
            }
          }

          // Refresh failed or no refresh token available - clear tokens and redirect
          this.clearToken();
          this.clearRefreshTokenInternal();

          if (typeof window !== "undefined") {
            // Avoid redirecting to /login when already on a public/auth page
            const PUBLIC_CLIENT_PATHS = ["/", "/login", "/signup"];
            try {
              const currentPath = window.location.pathname;
              if (!PUBLIC_CLIENT_PATHS.includes(currentPath)) {
                window.location.href = "/login";
              }
            } catch (e) {
              // If access to window.location fails for any reason, do a safe redirect
              window.location.href = "/login";
            }
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
   * Logout user - clears all tokens and notifies backend
   */
  async logout(): Promise<void> {
    try {
      // Attempt to notify backend of logout
      await this.post("/api/auth/logout", {});
    } catch (error) {
      // Even if logout API call fails, still clear local tokens
      // This ensures user is logged out locally regardless of backend state
    } finally {
      // Clear all stored authentication data
      this.clearToken();
      this.clearRefreshTokenInternal();
      this.failedRefreshAttempts = 0;
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<UserPublic> {
    const response = await this.get<ApiResponse<UserPublic>>("/api/auth/me");
    return response.data;
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - The refresh token to use
   * @returns New access token, refresh token, user, and expiration time
   */
  async refreshAccessToken(
    refreshToken: string
  ): Promise<{ accessToken: string; refreshToken: string; user: UserPublic; expiresIn: number }> {
    const response = await this.post<
      ApiResponse<{
        token: string;
        refreshToken: string;
        user: UserPublic;
        expiresIn: number;
      }>
    >("/api/auth/refresh", { token: refreshToken });

    if (response.success && response.data) {
      this.saveToken(response.data.token, response.data.expiresIn);
      this.saveRefreshToken(response.data.refreshToken);
      return {
        accessToken: response.data.token,
        refreshToken: response.data.refreshToken,
        user: response.data.user,
        expiresIn: response.data.expiresIn,
      };
    }

    throw new ApiClientError("Failed to refresh token", 401);
  }

  /**
   * Set refresh token in secure storage
   * @param token - The refresh token to store
   */
  setRefreshToken(token: string): void {
    this.saveRefreshToken(token);
  }

  /**
   * Get refresh token from storage
   * @returns The refresh token, or null if not found
   */
  getRefreshToken(): string | null {
    return this.refreshToken;
  }

  /**
   * Clear refresh token from storage
   */
  clearRefreshToken(): void {
    this.clearRefreshTokenInternal();
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

  /**
   * Create a new user (admin only)
   */
  async createUser(request: {
    email: string;
    username: string;
    displayName: string;
    password: string;
    role?: string;
  }): Promise<UserPublic> {
    const response = await this.post<ApiResponse<UserPublic>>(
      "/api/users",
      request
    );
    return response.data;
  }

  /**
   * Reset a user's password (admin only). Returns the temporary password.
   */
  async resetUserPassword(userId: string): Promise<{ tempPassword: string }> {
    const response = await this.post<ApiResponse<{ tempPassword: string }>>(
      `/api/users/${userId}/reset-password`
    );
    return response.data;
  }

  // ========================================================================
  // TASK ENDPOINTS
  // ========================================================================

  /**
   * Get all tasks with optional filters
   */
  async getTasks(
    params?: PaginationParams & {
      ownerId?: string;
      projectId?: string;
      status?: string;
      priority?: string;
    }
  ): Promise<PaginatedResponse<TaskWithOwner>> {
    const query = new URLSearchParams();
    if (params?.page) query.append("page", String(params.page));
    if (params?.pageSize) query.append("pageSize", String(params.pageSize));
    if (params?.ownerId) query.append("ownerId", params.ownerId);
    if (params?.projectId) query.append("projectId", params.projectId);
    if (params?.status) query.append("status", params.status);
    if (params?.priority) query.append("priority", params.priority);

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
    const response = await this.post<ApiResponse<Task>>("/api/tasks", request);
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
  async assignTask(
    taskId: string,
    request: AssignTaskRequest
  ): Promise<TaskAssignment> {
    const response = await this.post<ApiResponse<TaskAssignment>>(
      `/api/tasks/${taskId}/assign`,
      request
    );
    return response.data;
  }

  /**
   * Unassign task from user
   */
  async unassignTask(
    taskId: string,
    request: UnassignTaskRequest
  ): Promise<void> {
    await this.post(`/api/tasks/${taskId}/unassign`, request);
  }

  /**
   * Move task to a project
   * @param taskId - The task ID
   * @param projectId - The project ID to move the task to
   * @returns Updated task with owner
   */
  async moveTaskToProject(
    taskId: string,
    projectId: string
  ): Promise<TaskWithOwner> {
    const response = await this.post<ApiResponse<TaskWithOwner>>(
      `/api/tasks/${taskId}/move-to-project`,
      { projectId }
    );
    return response.data;
  }

  /**
   * Unlink task from its project
   * @param taskId - The task ID
   * @returns Task without project association
   */
  async unlinkTaskFromProject(taskId: string): Promise<TaskWithOwner> {
    const response = await this.post<ApiResponse<TaskWithOwner>>(
      `/api/tasks/${taskId}/unlink-project`
    );
    return response.data;
  }

  // ========================================================================
  // PROJECT ENDPOINTS
  // ========================================================================

  /**
   * Get all projects with optional filters
   * @param page - Page number for pagination
   * @param pageSize - Number of items per page
   * @param archived - Filter by archived status
   * @returns Paginated list of projects with relations
   */
  async getProjects(
    page?: number,
    pageSize?: number,
    archived?: boolean
  ): Promise<PaginatedResponse<ProjectWithRelations>> {
    const query = new URLSearchParams();
    if (page !== undefined) query.append("page", String(page));
    if (pageSize !== undefined) query.append("pageSize", String(pageSize));
    if (archived !== undefined) query.append("archived", String(archived));

    const queryString = query.toString();
    const endpoint = `/api/projects${queryString ? `?${queryString}` : ""}`;

    return this.get<PaginatedResponse<ProjectWithRelations>>(endpoint);
  }

  /**
   * Get single project by ID
   * @param projectId - The project ID
   * @param includeTasks - Whether to include tasks in the response
   * @returns Project with relations (collaborators, permissions, tasks)
   */
  async getProject(
    projectId: string,
    includeTasks?: boolean
  ): Promise<ProjectWithRelations> {
    const query = new URLSearchParams();
    if (includeTasks) query.append("includeTasks", "true");

    const queryString = query.toString();
    const endpoint = `/api/projects/${projectId}${queryString ? `?${queryString}` : ""}`;

    const response = await this.get<ApiResponse<ProjectWithRelations>>(endpoint);
    return response.data;
  }

  /**
   * Create a new project
   * @param data - Project creation data
   * @returns Created project with relations
   */
  async createProject(data: CreateProjectRequest): Promise<ProjectWithRelations> {
    const response = await this.post<ApiResponse<ProjectWithRelations>>(
      "/api/projects",
      data
    );
    return response.data;
  }

  /**
   * Update an existing project
   * @param projectId - The project ID
   * @param data - Project update data
   * @returns Updated project with relations
   */
  async updateProject(
    projectId: string,
    data: UpdateProjectRequest
  ): Promise<ProjectWithRelations> {
    const response = await this.patch<ApiResponse<ProjectWithRelations>>(
      `/api/projects/${projectId}`,
      data
    );
    return response.data;
  }

  /**
   * Delete a project
   * @param projectId - The project ID
   * @returns Success message
   */
  async deleteProject(projectId: string): Promise<{ message: string }> {
    const response = await this.delete<ApiResponse<{ message: string }>>(
      `/api/projects/${projectId}`
    );
    return response.data;
  }

  /**
   * Add a collaborator to a project
   * @param projectId - The project ID
   * @param userId - The user ID to add as collaborator
   * @returns Collaborator info with user details
   */
  async addProjectCollaborator(
    projectId: string,
    userId: string
  ): Promise<ProjectCollaboratorWithUser> {
    const response = await this.post<
      ApiResponse<ProjectCollaboratorWithUser>
    >(`/api/projects/${projectId}/collaborators`, { userId });
    return response.data;
  }

  /**
   * Remove a collaborator from a project
   * @param projectId - The project ID
   * @param userId - The user ID to remove
   * @returns Success message
   */
  async removeProjectCollaborator(
    projectId: string,
    userId: string
  ): Promise<{ message: string }> {
    const response = await this.delete<ApiResponse<{ message: string }>>(
      `/api/projects/${projectId}/collaborators/${userId}`
    );
    return response.data;
  }

  /**
   * Get project permissions
   * @param projectId - The project ID
   * @param userId - Optional user ID to filter permissions
   * @returns List of project permissions with user details
   */
  async getProjectPermissions(
    projectId: string,
    userId?: string
  ): Promise<ProjectPermissionWithUser[]> {
    const query = new URLSearchParams();
    if (userId) query.append("userId", userId);

    const queryString = query.toString();
    const endpoint = `/api/projects/${projectId}/permissions${
      queryString ? `?${queryString}` : ""
    }`;

    const response = await this.get<
      ApiResponse<ProjectPermissionWithUser[]>
    >(endpoint);
    return response.data;
  }

  /**
   * Set or update project permission for a user
   * @param projectId - The project ID
   * @param userId - The user ID
   * @param permission - The permission type to grant
   * @returns Created or updated permission with user details
   */
  async setProjectPermission(
    projectId: string,
    userId: string,
    permission: PermissionType
  ): Promise<ProjectPermissionWithUser> {
    const response = await this.post<
      ApiResponse<ProjectPermissionWithUser>
    >(`/api/projects/${projectId}/permissions`, { userId, permission });
    return response.data;
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
    const response = await this.post<ApiResponse<Chat>>("/api/chats", request);
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
