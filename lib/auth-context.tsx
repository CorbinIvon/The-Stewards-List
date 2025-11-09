"use client";

/**
 * React Context for authentication state management
 * Provides authentication state, login/signup/logout methods, and auth hooks
 * Must be used as a client component for localStorage and React hooks
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { apiClient, ApiClientError } from "./api-client";
import type {
  AuthUser,
  LoginRequest,
  SignupRequest,
  LoginResponse,
  SignupResponse,
} from "./types";

// ============================================================================
// CONTEXT TYPES
// ============================================================================

/**
 * Authentication context state and methods
 */
interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
  refreshToken?: string;
  isTokenExpiring: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  checkAndRefreshToken: () => Promise<void>;
}

// ============================================================================
// CONTEXT CREATION
// ============================================================================

/**
 * Create the authentication context with default values
 */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// AUTH PROVIDER COMPONENT
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication provider component
 * Wraps the application and provides authentication context
 * Handles token verification and auth state on mount
 *
 * Usage:
 * ```tsx
 * <AuthProvider>
 *   <YourApp />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({
  children,
}: AuthProviderProps): React.ReactElement {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const [isTokenExpiring, setIsTokenExpiring] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);

  /**
   * Check if access token is expiring soon (within 5 minutes)
   * and attempt to refresh if needed
   */
  const checkAndRefreshToken = useCallback(async (): Promise<void> => {
    const storedRefreshToken = apiClient.getRefreshToken();
    if (!storedRefreshToken) {
      setIsTokenExpiring(false);
      return;
    }

    // Prevent excessive refresh attempts (max once per 10 seconds)
    const now = Date.now();
    if (now - lastRefreshTime < 10000) {
      return;
    }

    try {
      // Call apiClient to check if token is expiring
      // The apiClient has isTokenExpired() that checks if token expires in next 5 minutes
      const expirationCheckNeeded = (apiClient as any).isTokenExpired?.() ?? true;

      if (expirationCheckNeeded) {
        setIsTokenExpiring(true);
        setLastRefreshTime(now);

        // Attempt to refresh the access token
        const result = await apiClient.refreshAccessToken(storedRefreshToken);

        // Update context with new tokens
        setRefreshToken(result.refreshToken);
        setIsTokenExpiring(false);

        // Update user info if available
        if (result.user) {
          setUser({
            id: result.user.id,
            email: result.user.email,
            username: result.user.username,
            role: result.user.role,
            isActive: result.user.isActive,
            requiresPasswordReset:
              (result.user as any).requiresPasswordReset ?? false,
          });
        }
      }
    } catch (err) {
      // If refresh fails with 401, token is revoked or invalid - auto logout
      if (err instanceof ApiClientError && err.status === 401) {
        console.warn("Refresh token expired or revoked, logging out");
        await logout();
      } else {
        console.error("Token refresh error:", err);
        setIsTokenExpiring(false);
      }
    }
  }, [lastRefreshTime]);

  /**
   * Initialize authentication on component mount
   * Checks for existing token, validates user session, and refreshes if needed
   */
  useEffect(() => {
    const initializeAuth = async (): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        // Load refresh token from storage
        const storedRefreshToken = apiClient.getRefreshToken();
        if (storedRefreshToken) {
          setRefreshToken(storedRefreshToken);
        }

        // Check if token needs refreshing before attempting to get user
        if (storedRefreshToken) {
          try {
            await checkAndRefreshToken();
          } catch (refreshErr) {
            console.error("Auto-refresh on mount failed:", refreshErr);
          }
        }

        // Check if token exists and try to get current user
        try {
          const currentUser = await apiClient.getCurrentUser();
          setUser({
            id: currentUser.id,
            email: currentUser.email,
            username: currentUser.username,
            role: currentUser.role,
            isActive: currentUser.isActive,
            // preserve server flag so UI can react (e.g. force complete-reset flow)
            requiresPasswordReset:
              (currentUser as any).requiresPasswordReset ?? false,
          });
        } catch (err) {
          // No valid token or token expired - user is not authenticated
          setUser(null);
        }
      } catch (err) {
        console.error("Error initializing auth:", err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [checkAndRefreshToken]);

  /**
   * Clear error message
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /**
   * Handle user login
   * Validates credentials and stores authentication token and refresh token
   */
  const login = useCallback(
    async (credentials: LoginRequest): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        const response: LoginResponse = await apiClient.login(credentials);

        // Extract and store refresh token
        const refreshTokenFromResponse = (response as any).refreshToken;
        if (refreshTokenFromResponse) {
          apiClient.setRefreshToken(refreshTokenFromResponse);
          setRefreshToken(refreshTokenFromResponse);
        }

        setUser({
          id: response.user.id,
          email: response.user.email,
          username: response.user.username,
          role: response.user.role,
          isActive: response.user.isActive,
          requiresPasswordReset:
            (response.user as any).requiresPasswordReset ?? false,
        });

        setIsTokenExpiring(false);
        setLastRefreshTime(0);
      } catch (err) {
        const message =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
            ? err.message
            : "Login failed";

        setError(message);
        setUser(null);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  /**
   * Handle user signup
   * Creates new account and stores authentication token and refresh token
   */
  const signup = useCallback(async (data: SignupRequest): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response: SignupResponse = await apiClient.signup(data);

      // Extract and store refresh token
      const refreshTokenFromResponse = (response as any).refreshToken;
      if (refreshTokenFromResponse) {
        apiClient.setRefreshToken(refreshTokenFromResponse);
        setRefreshToken(refreshTokenFromResponse);
      }

      setUser({
        id: response.user.id,
        email: response.user.email,
        username: response.user.username,
        role: response.user.role,
        isActive: response.user.isActive,
        requiresPasswordReset:
          (response.user as any).requiresPasswordReset ?? false,
      });

      setIsTokenExpiring(false);
      setLastRefreshTime(0);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
          ? err.message
          : "Signup failed";

      setError(message);
      setUser(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Handle user logout
   * Calls logout on apiClient to revoke refresh token server-side,
   * then clears local state and removes both authentication tokens
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      // Call server-side logout to revoke refresh token
      await apiClient.logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      // Clear tokens from context and apiClient
      setUser(null);
      setRefreshToken(null);
      apiClient.clearRefreshToken();
      setIsTokenExpiring(false);
      setLastRefreshTime(0);
      setIsLoading(false);
    }
  }, []);

  /**
   * Context value with auth state and methods
   */
  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: user !== null,
    error,
    refreshToken: refreshToken ?? undefined,
    isTokenExpiring,
    login,
    signup,
    logout,
    clearError,
    checkAndRefreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Hook to access authentication context
 * Must be used within AuthProvider
 *
 * Returns:
 * - user: Current authenticated user or null
 * - isLoading: Whether auth state is being loaded
 * - isAuthenticated: Whether user is authenticated
 * - error: Error message if auth failed
 * - login(): Function to log in user
 * - signup(): Function to sign up new user
 * - logout(): Function to log out user
 * - clearError(): Function to clear error message
 *
 * Example:
 * ```tsx
 * const { user, login, logout } = useAuth();
 * ```
 *
 * @throws Error if used outside of AuthProvider
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }

  return context;
}

/**
 * Hook to access authenticated user
 * Returns current user or null if not authenticated
 *
 * Example:
 * ```tsx
 * const user = useAuthUser();
 * if (user) {
 *   console.log(user.email);
 * }
 * ```
 *
 * @throws Error if used outside of AuthProvider
 */
export function useAuthUser(): AuthUser | null {
  const { user } = useAuth();
  return user;
}

/**
 * Hook to check if user is authenticated
 * Returns boolean value for authentication status
 *
 * Example:
 * ```tsx
 * const isAuthenticated = useIsAuthenticated();
 * if (isAuthenticated) {
 *   return <Dashboard />;
 * }
 * ```
 *
 * @throws Error if used outside of AuthProvider
 */
export function useIsAuthenticated(): boolean {
  const { isAuthenticated } = useAuth();
  return isAuthenticated;
}

/**
 * Hook to check if auth is loading
 * Returns boolean value for loading state
 *
 * Useful for showing loading indicators during auth initialization
 *
 * Example:
 * ```tsx
 * const isLoading = useAuthLoading();
 * if (isLoading) {
 *   return <LoadingSpinner />;
 * }
 * ```
 *
 * @throws Error if used outside of AuthProvider
 */
export function useAuthLoading(): boolean {
  const { isLoading } = useAuth();
  return isLoading;
}

/**
 * Hook to get authentication error
 * Returns error message or null if no error
 *
 * Example:
 * ```tsx
 * const error = useAuthError();
 * if (error) {
 *   return <ErrorAlert message={error} />;
 * }
 * ```
 *
 * @throws Error if used outside of AuthProvider
 */
export function useAuthError(): string | null {
  const { error } = useAuth();
  return error;
}

/**
 * Hook to access login function
 * Returns login function for use in login forms
 *
 * Example:
 * ```tsx
 * const login = useLogin();
 * const handleLogin = async (email, password) => {
 *   await login({ email, password });
 * };
 * ```
 *
 * @throws Error if used outside of AuthProvider
 */
export function useLogin(): (credentials: LoginRequest) => Promise<void> {
  const { login } = useAuth();
  return login;
}

/**
 * Hook to access signup function
 * Returns signup function for use in signup forms
 *
 * Example:
 * ```tsx
 * const signup = useSignup();
 * const handleSignup = async (data) => {
 *   await signup(data);
 * };
 * ```
 *
 * @throws Error if used outside of AuthProvider
 */
export function useSignup(): (data: SignupRequest) => Promise<void> {
  const { signup } = useAuth();
  return signup;
}

/**
 * Hook to access logout function
 * Returns logout function
 *
 * Example:
 * ```tsx
 * const logout = useLogout();
 * const handleLogout = async () => {
 *   await logout();
 *   navigate("/login");
 * };
 * ```
 *
 * @throws Error if used outside of AuthProvider
 */
export function useLogout(): () => Promise<void> {
  const { logout } = useAuth();
  return logout;
}

/**
 * Hook to check token expiration status
 * Returns boolean indicating if token is expiring soon
 *
 * Useful for showing warnings or triggering refresh UI
 *
 * Example:
 * ```tsx
 * const isTokenExpiring = useTokenExpiration();
 * if (isTokenExpiring) {
 *   return <TokenExpirationWarning />;
 * }
 * ```
 *
 * @throws Error if used outside of AuthProvider
 */
export function useTokenExpiration(): boolean {
  const { isTokenExpiring } = useAuth();
  return isTokenExpiring;
}

/**
 * Hook to manually trigger token refresh
 * Returns the checkAndRefreshToken function
 *
 * Useful for forcing a refresh before an operation that requires
 * a valid token, or for implementing background refresh intervals
 *
 * Example:
 * ```tsx
 * const checkAndRefreshToken = useCheckToken();
 * const handleImportantAction = async () => {
 *   await checkAndRefreshToken();
 *   await apiClient.doSomethingImportant();
 * };
 * ```
 *
 * @throws Error if used outside of AuthProvider
 */
export function useCheckToken(): () => Promise<void> {
  const { checkAndRefreshToken } = useAuth();
  return checkAndRefreshToken;
}
