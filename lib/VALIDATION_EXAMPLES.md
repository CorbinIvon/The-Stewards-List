# Validation Module - Usage Examples

This document provides practical examples of how to use the validation and middleware modules in various scenarios.

## Table of Contents

1. [Basic Validation](#basic-validation)
2. [Type Safety](#type-safety)
3. [Error Handling](#error-handling)
4. [API Integration](#api-integration)
5. [Middleware Usage](#middleware-usage)
6. [Testing Validation](#testing-validation)

## Basic Validation

### Validating User Input

```typescript
import { validateRequest, createUserSchema, isValidationError } from '@/lib/validation';

// User data from API request
const userData = {
  email: 'user@example.com',
  username: 'john_doe',
  displayName: 'John Doe',
  password: 'SecurePass@123!',
};

// Validate
const result = validateRequest(userData, createUserSchema);

if (isValidationError(result)) {
  // Handle validation errors
  console.log('Validation failed:', result.errors);
  // Output: [{ field: 'password', message: '...' }]
} else {
  // Use validated data (strings are sanitized)
  const { email, username, displayName, password } = result.data;
  console.log('Valid user data:', result.data);
}
```

### Validating Task Input

```typescript
import { validateRequest, createTaskSchema, isValidationError } from '@/lib/validation';

const taskData = {
  ownerId: '550e8400-e29b-41d4-a716-446655440000',
  title: 'Buy groceries',
  description: 'Milk, eggs, bread',
  frequency: 'WEEKLY',
};

const result = validateRequest(taskData, createTaskSchema);

if (!isValidationError(result)) {
  // Task is valid
  const { ownerId, title, description, frequency } = result.data;
}
```

### Validating Query Parameters

```typescript
import { validateRequest, taskQuerySchema, isValidationError } from '@/lib/validation';

// Extract from request
const searchParams = request.nextUrl.searchParams;
const ownerId = searchParams.get('ownerId');

const result = validateRequest({ ownerId }, taskQuerySchema);

if (!isValidationError(result)) {
  const where = result.data.ownerId ? { ownerId: result.data.ownerId } : {};
}
```

## Type Safety

### Using Inferred Types

```typescript
import type { CreateUserInput, CreateTaskInput } from '@/lib/validation-types';

// Function that expects validated user data
async function createUserInDatabase(user: CreateUserInput): Promise<void> {
  // TypeScript knows user has these exact fields with correct types
  console.log(user.email, user.username, user.displayName, user.password);
}

// Function that expects validated task data
async function createTaskInDatabase(task: CreateTaskInput): Promise<void> {
  console.log(task.ownerId, task.title);
}

// Usage with validation
const userValidation = validateRequest(body, createUserSchema);
if (!isValidationError(userValidation)) {
  await createUserInDatabase(userValidation.data); // Type-safe!
}
```

### Generic Helper Function

```typescript
async function createResource<T>(
  data: unknown,
  schema: z.ZodSchema<T>,
  handler: (validated: T) => Promise<void>
): Promise<NextResponse> {
  const result = validateRequest(data, schema);

  if (isValidationError(result)) {
    return validationErrorResponse(result);
  }

  try {
    await handler(result.data);
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create resource' },
      { status: 500 }
    );
  }
}
```

## Error Handling

### Comprehensive Error Response

```typescript
import {
  validateRequest,
  createPermissionSchema,
  isValidationError,
  validationErrorResponse,
} from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = validateRequest(body, createPermissionSchema);

    if (isValidationError(result)) {
      // Returns formatted response with detailed errors
      return validationErrorResponse(result, 400);
    }

    // ... rest of handler
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
```

### Custom Error Messages

```typescript
import { z } from 'zod';

const customSchema = z.object({
  email: z
    .string()
    .email('Please enter a valid email address'),
  age: z
    .number()
    .int('Age must be a whole number')
    .min(18, 'You must be at least 18 years old')
    .max(120, 'Age seems unrealistic'),
});

const result = validateRequest(data, customSchema);

if (isValidationError(result)) {
  // result.errors will include your custom messages
  result.errors.forEach(err => {
    console.log(`${err.field}: ${err.message}`);
  });
}
```

## API Integration

### Complete POST Endpoint Example

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  validateRequest,
  createUserSchema,
  isValidationError,
  validationErrorResponse,
} from '@/lib/validation';
import { withApiProtection } from '@/lib/middleware';
import { hashPassword } from '@/lib/auth';

async function POST(request: NextRequest) {
  try {
    // Parse and validate
    const body = await request.json();
    const result = validateRequest(body, createUserSchema);

    if (isValidationError(result)) {
      return validationErrorResponse(result);
    }

    const { email, username, displayName, password } = result.data;

    // Check for duplicates
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'Email or username already exists',
        },
        { status: 409 }
      );
    }

    // Hash password and create user
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
        email: true,
        username: true,
        displayName: true,
        createdAt: true,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    // Handle database errors
    if (error.code === 'P2002') {
      return NextResponse.json(
        {
          error: 'Conflict',
          message: 'Email or username already exists',
        },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export const POST = withApiProtection(POST);
```

### Complete GET Endpoint with Filtering

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import {
  validateRequest,
  taskQuerySchema,
  isValidationError,
  validationErrorResponse,
} from '@/lib/validation';
import { withApiProtection } from '@/lib/middleware';

async function GET(request: NextRequest) {
  try {
    // Validate query parameters
    const searchParams = request.nextUrl.searchParams;
    const ownerId = searchParams.get('ownerId');

    const result = validateRequest({ ownerId }, taskQuerySchema);

    if (isValidationError(result)) {
      return validationErrorResponse(result);
    }

    // Build query
    const where = result.data.ownerId ? { ownerId: result.data.ownerId } : {};

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
      orderBy: {
        createdAt: 'desc',
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

export const GET = withApiProtection(GET);
```

## Middleware Usage

### Using withApiProtection

All endpoints should use this wrapper:

```typescript
import { withApiProtection } from '@/lib/middleware';

async function GET(request: NextRequest) {
  // Your handler code
}

async function POST(request: NextRequest) {
  // Your handler code
}

// Wrap handlers
export const GET = withApiProtection(GET);
export const POST = withApiProtection(POST);
```

### Security Headers Applied

All wrapped handlers automatically get these headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), microphone=(), camera=()
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

### CORS Configuration

Update allowed origins in `lib/middleware.ts`:

```typescript
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://yourdomain.com',
  'https://www.yourdomain.com',
].filter(Boolean) as string[];
```

Or use environment variable:

```bash
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

## Testing Validation

### Unit Test Examples

```typescript
import { validateRequest, createUserSchema, isValidationError } from '@/lib/validation';

describe('User Validation', () => {
  test('accepts valid user data', () => {
    const data = {
      email: 'user@example.com',
      username: 'john_doe',
      displayName: 'John Doe',
      password: 'ValidPass@123!',
    };

    const result = validateRequest(data, createUserSchema);
    expect(result.success).toBe(true);
  });

  test('rejects weak password', () => {
    const data = {
      email: 'user@example.com',
      username: 'john_doe',
      displayName: 'John Doe',
      password: 'weak', // Too short, no special char, etc.
    };

    const result = validateRequest(data, createUserSchema);
    expect(isValidationError(result)).toBe(true);
    expect(result.errors.some(e => e.field === 'password')).toBe(true);
  });

  test('rejects invalid email', () => {
    const data = {
      email: 'not-an-email',
      username: 'john_doe',
      displayName: 'John Doe',
      password: 'ValidPass@123!',
    };

    const result = validateRequest(data, createUserSchema);
    expect(isValidationError(result)).toBe(true);
    expect(result.errors.some(e => e.field === 'email')).toBe(true);
  });

  test('sanitizes user input', () => {
    const data = {
      email: 'user@example.com',
      username: 'john_doe',
      displayName: '<script>alert("xss")</script>',
      password: 'ValidPass@123!',
    };

    const result = validateRequest(data, createUserSchema);
    if (!isValidationError(result)) {
      expect(result.data.displayName).not.toContain('<script>');
    }
  });
});
```

### API Endpoint Test Examples

```typescript
import { POST } from '@/app/api/users/route';

describe('POST /api/users', () => {
  test('creates user with valid data', async () => {
    const request = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'new@example.com',
        username: 'newuser',
        displayName: 'New User',
        password: 'ValidPass@123!',
      }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(201);
  });

  test('returns 400 for invalid email', async () => {
    const request = new Request('http://localhost/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'invalid-email',
        username: 'newuser',
        displayName: 'New User',
        password: 'ValidPass@123!',
      }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });
});
```

## Password Strength Examples

### Valid Passwords

- `MyP@ssw0rd123` - meets all requirements
- `SecurePass!456` - strong password
- `Tr0pic@lFruit#$ - creative password
- `Ch@ngeMe2024!` - date-based password

### Invalid Passwords

- `password` - no uppercase, number, or special character
- `Password1` - no special character
- `PASSWORD@123` - no lowercase letter
- `Pass@12` - only 7 characters (needs 12+)
- `NoSpecialChar123` - missing special character
- `nouppercase@123` - missing uppercase letter

## String Sanitization Examples

### Input Examples

```
Input: <script>alert('xss')</script>
Output: &lt;script&gt;alert(&#x27;xss&#x27;)&lt;/script&gt;

Input: <img src="x" onerror="alert('xss')">
Output: &lt;img src=&quot;x&quot; onerror=&quot;alert(&#x27;xss&#x27;)&quot;&gt;

Input: Normal text with <tags>
Output: Normal text with &lt;tags&gt;

Input: "quoted"
Output: &quot;quoted&quot;
```

## Common Patterns

### Optional Field Handling

```typescript
const taskValidation = validateRequest(
  {
    ownerId: 'uuid-here',
    title: 'Task title',
    description: undefined, // optional
    frequency: undefined,   // optional
  },
  createTaskSchema
);

if (!isValidationError(taskValidation)) {
  const { ownerId, title, description, frequency } = taskValidation.data;
  // description and frequency might be undefined
}
```

### Batch Operations

```typescript
const items = [{ ... }, { ... }, { ... }];

const results = items.map(item =>
  validateRequest(item, createTaskSchema)
);

const errors = results.filter(isValidationError);
const valid = results.filter(r => !isValidationError(r));

if (errors.length > 0) {
  console.log('Some items failed validation:', errors);
}
```

## Performance Considerations

- Validation schemas are compiled once at module load
- Sanitization adds minimal overhead (only on strings)
- UUID validation uses efficient regex
- Email validation uses built-in Zod validator
- All validation is synchronous (no async operations)

## Security Reminders

1. Always validate on the server side - client validation is not enough
2. Never trust user input, always sanitize
3. Use strong password requirements
4. Validate UUIDs to prevent injection attacks
5. Keep security headers updated
6. Monitor and log validation failures
7. Test validation with malicious input patterns

## Further Reading

- [Zod Documentation](https://zod.dev)
- [OWASP Input Validation](https://owasp.org/www-community/attacks/xss/)
- [Password Security](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
