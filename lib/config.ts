import { z } from "zod";

/**
 * Environment variable schema validation
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url("DATABASE_URL must be a valid URL"),

  // Node Environment
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // Next.js (optional, has defaults)
  PORT: z.string().optional().default("3000"),
  HOST: z.string().optional().default("localhost"),

  // Security
  SESSION_SECRET: z
    .string()
    .min(32, "SESSION_SECRET must be at least 32 characters")
    .optional(),

  // Future integrations (optional)
  SENDGRID_API_KEY: z.string().optional(),
  SENTRY_DSN: z.string().url().optional(),
  REDIS_URL: z.string().url().optional(),
});

/**
 * Validated environment variables
 * This will throw at startup if validation fails
 */
function validateEnv() {
  try {
    const env = envSchema.parse(process.env);
    return env;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      throw new Error("Invalid environment configuration");
    }
    throw error;
  }
}

/**
 * Configuration object with validated environment variables
 */
export const config = {
  env: process.env.NODE_ENV || "development",
  isDevelopment: process.env.NODE_ENV === "development",
  isProduction: process.env.NODE_ENV === "production",
  isTest: process.env.NODE_ENV === "test",

  database: {
    url: process.env.DATABASE_URL!,
  },

  server: {
    port: parseInt(process.env.PORT || "3000", 10),
    host: process.env.HOST || "localhost",
  },

  security: {
    sessionSecret: process.env.SESSION_SECRET,
    // Argon2 parameters (will be used after migration)
    argon2: {
      timeCost: 3,
      memoryCost: 65536, // 64 MB
      parallelism: 4,
    },
    bcrypt: {
      rounds: 12, // Increased from 10 for better security
    },
  },

  integrations: {
    sendgrid: {
      apiKey: process.env.SENDGRID_API_KEY,
    },
    sentry: {
      dsn: process.env.SENTRY_DSN,
    },
    redis: {
      url: process.env.REDIS_URL,
    },
  },
} as const;

/**
 * Validate environment on module import (fail-fast)
 * Only validate in non-build contexts
 */
if (process.env.NODE_ENV !== "production" || process.env.VERCEL !== "1") {
  try {
    validateEnv();
  } catch (error) {
    if (!process.env.SKIP_ENV_VALIDATION) {
      process.exit(1);
    }
  }
}

/**
 * Export validation function for use in tests
 */
export { validateEnv };
