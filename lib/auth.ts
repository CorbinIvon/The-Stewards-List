/**
 * Server-side authentication utilities for API routes and middleware
 * Handles password hashing, JWT token generation/verification, and auth checks
 */

import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { config } from "./config";
import type { AuthUser, User } from "./types";

// ============================================================================
// CONSTANTS
// ============================================================================

export const TOKEN_SECRET = process.env.SESSION_SECRET || "dev-secret-key";
export const TOKEN_EXPIRY = 24 * 60 * 60; // 24 hours in seconds
export const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

// ============================================================================
// PASSWORD HASHING
// ============================================================================

/**
 * Hash a password using bcrypt
 * Uses the configured bcrypt rounds from config
 *
 * @param password - The plaintext password to hash
 * @returns The hashed password
 * @throws Error if hashing fails
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(config.security.bcrypt.rounds);
    return bcrypt.hash(password, salt);
  } catch (error) {
    throw new Error(
      `Failed to hash password: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Verify a password against a hash
 * Uses bcryptjs compare for timing-safe comparison
 *
 * @param password - The plaintext password to verify
 * @param hash - The hash to compare against
 * @returns true if password matches, false otherwise
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  try {
    return bcrypt.compare(password, hash);
  } catch (error) {
    console.error("Password verification error:", error);
    return false;
  }
}

/**
 * Alias for verifyPassword - compares a password with a hash
 * Provides backward compatibility with existing code
 *
 * @param password - The plaintext password to verify
 * @param hash - The hash to compare against
 * @returns true if password matches, false otherwise
 */
export const comparePassword = verifyPassword;

// ============================================================================
// JWT TOKEN HANDLING
// ============================================================================

/**
 * JWT Token interface for header/payload structure
 */
interface JWTPayload {
  header: {
    alg: string;
    typ: string;
  };
  payload: AuthUser & {
    iat: number;
    exp: number;
  };
  signature: string;
}

/**
 * Base64URL encode a string
 * @param str - String to encode
 * @returns Base64URL encoded string
 */
/**
 * Base64URL encode helper that works in both Node and Web runtimes.
 * Accepts a string or ArrayBuffer/Uint8Array and returns a base64url string.
 */
function base64UrlEncodeInput(
  input: string | ArrayBuffer | Uint8Array
): string {
  let b64: string;

  if (typeof input === "string") {
    // encode string to bytes
    const encoder = new TextEncoder();
    const bytes = encoder.encode(input);
    input = bytes;
  }

  const bytes = input instanceof ArrayBuffer ? new Uint8Array(input) : input;

  if (typeof btoa !== "undefined") {
    // browser / edge
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      binary += String.fromCharCode(bytes[i]);
    }
    b64 = btoa(binary);
  } else {
    // Node
    b64 = Buffer.from(bytes).toString("base64");
  }

  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Base64URL decode to string
 */
function base64UrlDecodeToString(str: string): string {
  const padded =
    str.replace(/-/g, "+").replace(/_/g, "/") +
    "".padEnd((4 - (str.length % 4)) % 4, "=");

  if (typeof atob !== "undefined") {
    const binary = atob(padded);
    // convert binary to string
    let result = "";
    // eslint-disable-next-line security/detect-object-injection
    for (let i = 0; i < binary.length; i++) result += binary[i];
    return result;
  }

  return Buffer.from(padded, "base64").toString();
}

/**
 * Create HMAC SHA256 signature in a runtime-compatible way.
 * Returns a base64url encoded signature string.
 */
async function createSignature(
  message: string,
  secret: string
): Promise<string> {
  // Use Web Crypto (available in edge) when possible
  if (
    typeof globalThis !== "undefined" &&
    (globalThis as any).crypto &&
    (globalThis as any).crypto.subtle
  ) {
    const enc = new TextEncoder();
    const keyData = enc.encode(secret);
    const key = await (globalThis as any).crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await (globalThis as any).crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(message)
    );
    return base64UrlEncodeInput(new Uint8Array(signature));
  }

  // Fallback to Node crypto
  const crypto = require("crypto");
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(message);
  return base64UrlEncodeInput(hmac.digest());
}

/**
 * Generate a JWT token from user data
 * Creates a signed JWT with the user's AuthUser payload
 *
 * @param user - User data to encode in token
 * @param expiresIn - Token expiration time in seconds (default: TOKEN_EXPIRY)
 * @returns The signed JWT token
 */
export async function generateToken(
  user: AuthUser,
  expiresIn: number = TOKEN_EXPIRY
): Promise<string> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + expiresIn;

    const header = {
      alg: "HS256",
      typ: "JWT",
    };

    const payload: AuthUser & { iat: number; exp: number } = {
      ...user,
      iat: now,
      exp: exp,
    };

    // Create JWT parts
    const encodedHeader = base64UrlEncodeInput(JSON.stringify(header));
    const encodedPayload = base64UrlEncodeInput(JSON.stringify(payload));
    const message = `${encodedHeader}.${encodedPayload}`;

    // Create signature
    const signature = await createSignature(message, TOKEN_SECRET);

    // Return complete JWT
    return `${message}.${signature}`;
  } catch (error) {
    throw new Error(
      `Failed to generate token: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Verify and decode a JWT token
 * Validates signature and expiration
 *
 * @param token - The JWT token to verify
 * @returns The decoded AuthUser payload if valid
 * @throws Error if token is invalid or expired
 */
export async function verifyToken(token: string): Promise<AuthUser> {
  try {
    // Split token into parts
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid token format");
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // Verify signature
    const message = `${encodedHeader}.${encodedPayload}`;
    const expectedSignature = await createSignature(message, TOKEN_SECRET);

    if (signature !== expectedSignature) {
      throw new Error("Invalid token signature");
    }

    // Decode and parse payload
    const payloadStr = base64UrlDecodeToString(encodedPayload);
    const payload = JSON.parse(payloadStr) as AuthUser & {
      iat: number;
      exp: number;
    };

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      throw new Error("Token has expired");
    }

    // Return payload without iat/exp
    const { iat, exp, ...user } = payload;
    return user;
  } catch (error) {
    throw new Error(
      `Failed to verify token: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ============================================================================
// TOKEN EXTRACTION AND PARSING
// ============================================================================

/**
 * Extract JWT token from Authorization header
 * Expects "Bearer <token>" format
 *
 * @param authHeader - The Authorization header value
 * @returns The token or null if not present
 */
export function extractTokenFromHeader(
  authHeader: string | null
): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Extract JWT token from cookies
 * Looks for authToken cookie
 *
 * @param cookieHeader - The Cookie header value
 * @returns The token or null if not present
 */
export function extractTokenFromCookie(
  cookieHeader: string | null
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith("authToken=")) {
      return cookie.substring(10);
    }
  }

  return null;
}

// ============================================================================
// USER EXTRACTION FROM TOKEN
// ============================================================================

/**
 * Get user information from a JWT token
 * Verifies the token and extracts the AuthUser payload
 *
 * @param token - The JWT token
 * @returns The AuthUser if token is valid, null otherwise
 */
export async function getUserFromToken(
  token: string
): Promise<AuthUser | null> {
  try {
    return await verifyToken(token);
  } catch (error) {
    console.error("Error extracting user from token:", error);
    return null;
  }
}

/**
 * Get user from Authorization header (Bearer token)
 *
 * @param authHeader - The Authorization header value
 * @returns The AuthUser if header is valid, null otherwise
 */
export async function getUserFromAuthHeader(
  authHeader: string | null
): Promise<AuthUser | null> {
  const token = extractTokenFromHeader(authHeader);
  if (!token) {
    return null;
  }
  return getUserFromToken(token);
}

/**
 * Get user from cookies
 *
 * @param cookieHeader - The Cookie header value
 * @returns The AuthUser if cookie is valid, null otherwise
 */
export async function getUserFromCookie(
  cookieHeader: string | null
): Promise<AuthUser | null> {
  const token = extractTokenFromCookie(cookieHeader);
  if (!token) {
    return null;
  }
  return getUserFromToken(token);
}

// ============================================================================
// AUTHENTICATION HELPERS
// ============================================================================

/**
 * Create AuthUser from User model
 * Extracts only the fields needed for JWT payload
 *
 * @param user - The User database model
 * @returns The AuthUser JWT payload
 */
export function createAuthUserFromUser(user: User): AuthUser {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    isActive: user.isActive,
    requiresPasswordReset: (user as any).requiresPasswordReset || false,
  };
}

/**
 * Check if a user token is about to expire (within 1 hour)
 *
 * @param token - The JWT token
 * @returns true if token expires within 1 hour
 */
export function isTokenAboutToExpire(token: string): boolean {
  try {
    const payload = JSON.parse(base64UrlDecodeToString(token.split(".")[1]));
    const expiresIn = payload.exp - Math.floor(Date.now() / 1000);
    return expiresIn < 60 * 60; // Less than 1 hour
  } catch {
    return true;
  }
}

// ============================================================================
// REFRESH TOKEN MANAGEMENT AND REVOCATION
// ============================================================================

/**
 * Hash a refresh token for secure storage
 * Uses bcrypt for consistency with password handling
 *
 * @param token - The plaintext refresh token
 * @returns The hashed token
 * @throws Error if hashing fails
 */
export async function hashRefreshToken(token: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(config.security.bcrypt.rounds);
    return bcrypt.hash(token, salt);
  } catch (error) {
    throw new Error(
      `Failed to hash refresh token: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Check if a refresh token is revoked in the database
 * Helper function to verify token revocation status
 *
 * @param tokenHash - The hashed token to check
 * @returns true if token is revoked, false otherwise
 */
export async function checkIfTokenRevoked(tokenHash: string): Promise<boolean> {
  try {
    const { prisma } = await import("./prisma");

    const refreshToken = await prisma.refreshToken.findUnique({
      where: { token: tokenHash },
      select: { revokedAt: true },
    });

    return refreshToken?.revokedAt !== null && refreshToken?.revokedAt !== undefined;
  } catch (error) {
    console.error("Error checking token revocation status:", error);
    // Fail open in case of database error - allow the token
    return false;
  }
}

/**
 * Revoke a refresh token by marking it as revoked
 * Sets revokedAt timestamp to invalidate the token
 *
 * @param tokenHash - The hashed refresh token to revoke
 * @returns true if successfully revoked, false if token not found
 * @throws Error if database operation fails
 */
export async function revokeRefreshToken(tokenHash: string): Promise<boolean> {
  try {
    const { prisma } = await import("./prisma");

    const result = await prisma.refreshToken.update({
      where: { token: tokenHash },
      data: { revokedAt: new Date() },
    });

    return !!result;
  } catch (error) {
    // Token not found or already revoked - gracefully continue
    if (
      error instanceof Error &&
      error.message.includes("Record to update not found")
    ) {
      return false;
    }

    console.error("Error revoking refresh token:", error);
    throw new Error(
      `Failed to revoke refresh token: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Verify a refresh token and check if it's revoked
 * Performs all validation: signature, expiration, and revocation status
 *
 * @param plainToken - The plaintext refresh token to verify
 * @returns The decoded AuthUser payload if valid
 * @throws Error with specific message if token is invalid, expired, or revoked
 */
export async function verifyRefreshToken(
  plainToken: string
): Promise<AuthUser> {
  try {
    // Hash the token to look it up in database
    const tokenHash = await hashRefreshToken(plainToken);

    // Check if token is revoked
    const isRevoked = await checkIfTokenRevoked(tokenHash);
    if (isRevoked) {
      throw new Error("Token revoked, please login again");
    }

    // Verify the JWT token itself
    const user = await verifyToken(plainToken);
    return user;
  } catch (error) {
    throw new Error(
      `Failed to verify refresh token: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Extract both access and refresh tokens from a request
 * Checks cookies first, then request body, then Authorization header
 *
 * @param request - The NextRequest object
 * @returns Object with accessToken and refreshToken (both optional)
 */
export async function getTokenFromRequest(
  request: NextRequest
): Promise<{ accessToken?: string; refreshToken?: string }> {
  try {
    const cookieHeader = request.headers.get("cookie");
    const authHeader = request.headers.get("authorization");

    const tokens: { accessToken?: string; refreshToken?: string } = {};

    // Extract access token from cookies or Authorization header
    const accessTokenFromCookie = extractTokenFromCookie(cookieHeader);
    if (accessTokenFromCookie) {
      tokens.accessToken = accessTokenFromCookie;
    } else {
      const accessTokenFromHeader = extractTokenFromHeader(authHeader);
      if (accessTokenFromHeader) {
        tokens.accessToken = accessTokenFromHeader;
      }
    }

    // Extract refresh token from cookies first
    const refreshTokenFromCookie = extractRefreshTokenFromCookie(cookieHeader);
    if (refreshTokenFromCookie) {
      tokens.refreshToken = refreshTokenFromCookie;
    } else {
      // Try to get from request body for mobile clients
      try {
        const body = await request.json();
        if (body.refreshToken) {
          tokens.refreshToken = body.refreshToken;
        }
      } catch {
        // Body is not JSON or cannot be parsed, continue
      }
    }

    return tokens;
  } catch (error) {
    console.error("Error extracting tokens from request:", error);
    return {};
  }
}

/**
 * Extract refresh token from cookies
 * Looks for authRefreshToken cookie
 *
 * @param cookieHeader - The Cookie header value
 * @returns The token or null if not present
 */
function extractRefreshTokenFromCookie(
  cookieHeader: string | null
): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith("authRefreshToken=")) {
      return cookie.substring(17);
    }
  }

  return null;
}

// ============================================================================
// REFRESH TOKEN GENERATION AND STORAGE
// ============================================================================

/**
 * Generate a refresh token JWT for user session extension
 * Creates a signed JWT with 7-day expiration
 *
 * @param user - User data to encode in refresh token
 * @returns Object containing the token string and expiresIn seconds
 * @throws Error if token generation fails
 */
export async function generateRefreshToken(
  user: AuthUser
): Promise<{ token: string; expiresIn: number }> {
  try {
    const token = await generateToken(user, REFRESH_TOKEN_EXPIRY);
    return {
      token,
      expiresIn: REFRESH_TOKEN_EXPIRY,
    };
  } catch (error) {
    throw new Error(
      `Failed to generate refresh token: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Store a refresh token in the database
 * Persists the hashed token for later validation
 *
 * @param userId - The user ID to associate with the token
 * @param hashedToken - The bcrypt-hashed token to store
 * @param expiresAt - When the refresh token expires
 * @returns The created RefreshToken record if successful, null on error
 */
export async function storeRefreshToken(
  userId: string,
  hashedToken: string,
  expiresAt: Date
): Promise<any | null> {
  try {
    const { prisma } = await import("./prisma");

    const refreshToken = await prisma.refreshToken.create({
      data: {
        userId,
        token: hashedToken,
        expiresAt,
      },
    });

    return refreshToken;
  } catch (error) {
    console.error("Error storing refresh token:", error);
    return null;
  }
}
