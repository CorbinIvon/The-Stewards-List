/**
 * Server-side authentication utilities for API routes and middleware
 * Handles password hashing, JWT token generation/verification, and auth checks
 */

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
