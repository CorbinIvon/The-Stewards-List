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
  login: (credentials: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
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

  /**
   * Initialize authentication on component mount
   * Checks for existing token and validates user session
   */
  useEffect(() => {
    const initializeAuth = async (): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

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
  }, []);

  /**
   * Clear error message
   */
  const clearError = useCallback((): void => {
    setError(null);
  }, []);

  /**
   * Handle user login
   * Validates credentials and stores authentication token
   */
  const login = useCallback(
    async (credentials: LoginRequest): Promise<void> => {
      try {
        setIsLoading(true);
        setError(null);

        const response: LoginResponse = await apiClient.login(credentials);

        setUser({
          id: response.user.id,
          email: response.user.email,
          username: response.user.username,
          role: response.user.role,
          isActive: response.user.isActive,
          requiresPasswordReset:
            (response.user as any).requiresPasswordReset ?? false,
        });
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
   * Creates new account and stores authentication token
   */
  const signup = useCallback(async (data: SignupRequest): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      const response: SignupResponse = await apiClient.signup(data);

      setUser({
        id: response.user.id,
        email: response.user.email,
        username: response.user.username,
        role: response.user.role,
        isActive: response.user.isActive,
        requiresPasswordReset:
          (response.user as any).requiresPasswordReset ?? false,
      });
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
   * Clears local state and removes authentication token
   */
  const logout = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      setError(null);

      await apiClient.logout();
    } catch (err) {
      console.error("Logout error:", err);
    } finally {
      setUser(null);
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
    login,
    signup,
    logout,
    clearError,
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
