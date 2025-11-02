# Input Validation Module Integration Guide

This guide demonstrates how to integrate the new validation and middleware modules into your API endpoints.

## Files Created

1. **`lib/validation.ts`** - Comprehensive input validation schemas using Zod
2. **`lib/middleware.ts`** - Security middleware with error handling, CORS, rate limiting (placeholder), and security headers
3. **`lib/VALIDATION_INTEGRATION_GUIDE.md`** - This guide

## Quick Start Examples

### Example 1: Update `/api/users/route.ts` with Validation

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import {
  createUserSchema,
  validateRequest,
  validationErrorResponse,
  isValidationError,
} from '@/lib/validation';
import { withApiProtection } from '@/lib/middleware';

async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = validateRequest(body, createUserSchema);

    if (isValidationError(validation)) {
      return validationErrorResponse(validation);
    }

    const { email, username, displayName, password } = validation.data;

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Email or username already exists' },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email,
        username,
        displayName,
        passwordHash,
      },
      select: {
        id: true,
        createdAt: true,
        email: true,
        username: true,
        displayName: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Email or username already exists' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// Wrap POST handler with middleware
export const POST = withApiProtection(POST);
```

### Example 2: Update `/api/tasks/route.ts` with Validation

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createTaskSchema,
  taskQuerySchema,
  validateRequest,
  validationErrorResponse,
  isValidationError,
} from '@/lib/validation';
import { withApiProtection } from '@/lib/middleware';

async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ownerId = searchParams.get('ownerId');

    // Validate query parameters
    const validation = validateRequest({ ownerId }, taskQuerySchema);

    if (isValidationError(validation)) {
      return validationErrorResponse(validation);
    }

    const where = validation.data.ownerId ? { ownerId: validation.data.ownerId } : {};

    const tasks = await prisma.task.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = validateRequest(body, createTaskSchema);

    if (isValidationError(validation)) {
      return validationErrorResponse(validation);
    }

    const { ownerId, title, description, frequency } = validation.data;

    // Verify owner exists
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      return NextResponse.json(
        { error: 'Invalid ownerId: user not found' },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        ownerId,
        title,
        description,
        frequency,
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid ownerId' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}

// Wrap handlers with middleware
export const GET = withApiProtection(GET);
export const POST = withApiProtection(POST);
```

### Example 3: Update `/api/permissions/route.ts` with Validation

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  createPermissionSchema,
  permissionQuerySchema,
  validateRequest,
  validationErrorResponse,
  isValidationError,
} from '@/lib/validation';
import { withApiProtection } from '@/lib/middleware';

async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const taskId = searchParams.get('taskId');

    // Validate query parameters
    const validation = validateRequest({ userId, taskId }, permissionQuerySchema);

    if (isValidationError(validation)) {
      return validationErrorResponse(validation);
    }

    const where: any = {};
    if (validation.data.userId) where.userId = validation.data.userId;
    if (validation.data.taskId) where.taskId = validation.data.taskId;

    const permissions = await prisma.permission.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json(permissions);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}

async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validation = validateRequest(body, createPermissionSchema);

    if (isValidationError(validation)) {
      return validationErrorResponse(validation);
    }

    const { userId, taskId, permission } = validation.data;

    const newPermission = await prisma.permission.create({
      data: {
        userId,
        taskId,
        permission,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        task: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    });

    return NextResponse.json(newPermission, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Permission already exists for this user and task' },
        { status: 409 }
      );
    }
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid userId or taskId' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create permission' },
      { status: 500 }
    );
  }
}

export const GET = withApiProtection(GET);
export const POST = withApiProtection(POST);
```

## Validation Schemas Reference

### User Creation Schema
- **email**: Valid email format, will be lowercased and trimmed
- **username**: 3-32 characters, alphanumeric with underscores and hyphens, sanitized
- **displayName**: 1-128 characters, sanitized
- **password**: 12+ characters with uppercase, lowercase, number, and special character

```typescript
const validation = validateRequest(
  { email, username, displayName, password },
  createUserSchema
);
```

### Task Creation Schema
- **ownerId**: Valid UUID
- **title**: 1-256 characters, required, sanitized
- **description**: Optional, max 2000 characters, sanitized
- **frequency**: Optional, one of: DAILY, WEEKLY, MONTHLY, YEARLY, ONE_TIME

```typescript
const validation = validateRequest(
  { ownerId, title, description, frequency },
  createTaskSchema
);
```

### Task Queries
- **ownerId**: Optional UUID

```typescript
const validation = validateRequest({ ownerId }, taskQuerySchema);
```

### Permission Creation Schema
- **userId**: Valid UUID
- **taskId**: Valid UUID
- **permission**: One of: READ, WRITE, DELETE, ADMIN

```typescript
const validation = validateRequest(
  { userId, taskId, permission },
  createPermissionSchema
);
```

### Permission Queries
- **userId**: Optional UUID
- **taskId**: Optional UUID

```typescript
const validation = validateRequest({ userId, taskId }, permissionQuerySchema);
```

### Task Log Creation Schema
- **taskId**: Valid UUID
- **userId**: Valid UUID

```typescript
const validation = validateRequest({ taskId, userId }, createTaskLogSchema);
```

### Task Log Queries
- **taskId**: Optional UUID
- **userId**: Optional UUID

```typescript
const validation = validateRequest({ taskId, userId }, taskLogQuerySchema);
```

### Chat Creation Schema
- **queryKey**: 1-256 characters, required, sanitized
- **userId**: Valid UUID
- **message**: 1-4000 characters, required, sanitized
- **quoteChatId**: Optional UUID

```typescript
const validation = validateRequest(
  { queryKey, userId, message, quoteChatId },
  createChatSchema
);
```

### Chat Queries
- **queryKey**: Optional string
- **userId**: Optional UUID

```typescript
const validation = validateRequest({ queryKey, userId }, chatQuerySchema);
```

## Middleware Features

### Security Headers
Automatically added to all responses:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: geolocation=(), microphone=(), camera=()`
- `Strict-Transport-Security: max-age=31536000; includeSubDomains`

### CORS Protection
- Validates origin against whitelist (configurable in `ALLOWED_ORIGINS`)
- Handles preflight (OPTIONS) requests
- Strict origin checking in production

### Error Handling
- Wraps all API handlers
- Captures and logs errors
- Returns appropriate error responses
- Development mode includes stack traces

### Rate Limiting (Placeholder)
- Currently disabled, requires Redis setup
- To enable, install Redis client and set `REDIS_URL`
- See documentation in `middleware.ts` for implementation

### Request Validation
- Validates Content-Type for POST/PUT/PATCH requests
- Ensures application/json content type

## String Sanitization

All user-provided strings are automatically sanitized to prevent XSS attacks:
- Removes/escapes dangerous HTML characters: `<`, `>`, `"`, `'`
- Trims whitespace
- Applied to: username, displayName, title, description, message, queryKey

## Environment Configuration

### CORS
Set `NEXT_PUBLIC_APP_URL` to configure allowed origin:
```bash
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

### Rate Limiting
To enable rate limiting, set `REDIS_URL`:
```bash
REDIS_URL=redis://localhost:6379
```

### Logging
In development mode, detailed request logs are printed to console.
In production, logs go to stderr for container log capture.

To integrate with external logging (Sentry, DataDog), update the `logRequest` function in `middleware.ts`.

## Type Safety

All schemas export TypeScript types for use in your application:

```typescript
import type { CreateUserInput, CreateTaskInput, CreatePermissionInput } from '@/lib/validation';

function handleUserCreation(user: CreateUserInput) {
  // TypeScript knows the shape of user
}
```

## Error Response Format

Validation errors return consistent format:

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "password",
      "message": "Password must be at least 12 characters long"
    },
    {
      "field": "email",
      "message": "Must be a valid email address"
    }
  ]
}
```

## Next Steps

1. Update all API endpoints to use the validation schemas
2. Configure `ALLOWED_ORIGINS` in `middleware.ts` for your deployment
3. Set up Redis and enable rate limiting (optional but recommended)
4. Integrate with logging service (Sentry, DataDog, etc.)
5. Test all validation rules in development
6. Deploy and monitor error responses in production

## Password Requirements

Passwords must meet these criteria:
- Minimum 12 characters
- At least one uppercase letter (A-Z)
- At least one lowercase letter (a-z)
- At least one number (0-9)
- At least one special character: `!@#$%^&*()_+-=[]{}';:"\\|,.<>/?`

Example valid password: `MyP@ssw0rd123`
