# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Links

- **High-Level Overview**: See [`docs/00_HIGH_LEVEL_OVERVIEW.md`](docs/00_HIGH_LEVEL_OVERVIEW.md) for a user-friendly introduction to the project, components, pages, and data types
- **This File**: Detailed architectural guidance and API reference for developers

## Project Overview

**The Stewards List** is a Next.js + Prisma web application for home organization featuring user management, task management, project collaboration, and team communication.

- **Framework**: Next.js 15 (App Router) with TypeScript
- **Database**: PostgreSQL with Prisma ORM (cascade deletes configured)
- **Authentication**: JWT-based with bcryptjs password hashing and refresh tokens
- **UI**: React 19 with Tailwind CSS
- **Testing**: Jest with ts-jest

## Database Schema Structure

Key models and their relationships:

- **User**: Core user account with ADMIN/MANAGER/MEMBER roles, password reset flags, and activity tracking
  - Relations: ownedTasks, assignedTasks (via TaskAssignment), permissions, taskLogs, chats, projectsCreated, projectCollaborations, projectPermissions, refreshTokens
- **Task**: Represents tasks with status lifecycle (TODO → IN_PROGRESS → COMPLETED/CANCELLED), priority levels, and recurring patterns (frequency: DAILY, WEEKLY, MONTHLY, etc.)
  - Relations: owner (User), projectLink (optional Project), assignments, permissions, taskLogs, chats, parentRelations/childRelations (task dependencies)
  - Fields: assignDate (schedule start), dueBy (due date for occurrence), dueDate (generic deadline), completedAt, isDeleted flags
- **Project**: Groups tasks and collaborators with creator and archived status
  - Relations: creator (User), tasks, collaborators (ProjectCollaborator), permissions (ProjectPermission)
- **TaskAssignment**: Junction table linking users to tasks they're assigned to (unique constraint on taskId+userId)
- **Permission**: Task-level access control (READ/WRITE/DELETE/ADMIN)
- **ProjectPermission**: Project-level access control
- **TaskLog**: Audit trail for task actions (CREATED, UPDATED, COMPLETED, CANCELLED, ASSIGNED, UNASSIGNED, COMMENTED) with optional notes and metadata
- **Chat**: Threaded conversation messages with support for quoted messages and soft deletes
- **TaskRelation**: Task dependencies with optional "blocks" flag for task relationship tracking

## Core Architecture

### API Organization

All API routes follow the `/api/{resource}` pattern with Next.js App Router:

```
app/api/
├── auth/
│   ├── login/route.ts        # POST: email/password → JWT token
│   ├── signup/route.ts       # POST: register new user
│   ├── logout/route.ts       # POST: invalidate token
│   └── refresh/route.ts      # POST: refresh token with stored refresh token
├── users/route.ts            # GET all users, POST create user
├── tasks/
│   ├── route.ts              # GET tasks (filterable), POST create task
│   ├── [id]/route.ts         # GET/PUT/DELETE single task
│   ├── [id]/assign/route.ts  # POST assign user to task
│   ├── [id]/unassign/route.ts # POST unassign user from task
│   ├── [id]/relations/route.ts # Task dependency management
├── permissions/
│   ├── route.ts              # GET/POST permissions
│   ├── [id]/route.ts         # PUT/DELETE specific permission
├── task-logs/
│   ├── route.ts              # GET task logs
│   ├── [id]/route.ts         # GET single log
├── chats/
│   ├── route.ts              # GET/POST chat messages
│   └── [id]/route.ts         # GET/PUT/DELETE single chat
└── projects/
    ├── route.ts              # GET projects, POST create project
    ├── [id]/route.ts         # GET/PUT/DELETE project
    └── [id]/(collaborators|permissions)/route.ts # Project access management
```

### Authentication Flow

1. **Login**: `/api/auth/login` returns JWT + refresh token stored in httpOnly cookie
2. **Token Refresh**: `/api/auth/refresh` uses stored refresh token to get new JWT
3. **Middleware Protection**: `middleware.ts` validates JWT on protected routes (guards: `/dashboard`, `/tasks`, `/users`, `/profile`, `/settings` and their API equivalents)
4. **Password Reset**: Users with `requiresPasswordReset=true` must complete reset before accessing app features

### Key Libraries & Utilities

- **lib/auth.ts**: JWT verification, token extraction from headers/cookies, user resolution
- **lib/prisma.ts**: Singleton Prisma client instance
- **lib/api-client.ts**: Typed frontend client for API calls with automatic token refresh and JWT decoding
- **lib/types.ts**: Comprehensive TypeScript interfaces for all models, API requests/responses, and error types
- **lib/validation.ts**: Zod-based request validation schemas
- **lib/logger.ts**: Structured logging utility
- **lib/middleware/auth.ts**: Route-level authentication guards

## Common Development Commands

```bash
# Development
npm run dev                    # Start dev server (localhost:3000)
npm run lint                   # Run ESLint

# Database
npm run db:start              # Start PostgreSQL via Docker Compose
npm run db:stop               # Stop PostgreSQL container
npm run db:generate           # Generate Prisma Client
npm run db:push               # Sync schema with database (creates/modifies tables)
npm run db:studio             # Open Prisma Studio GUI (localhost:5555)
npm run test:db               # Run database connectivity tests

# Testing
npm test                      # Run Jest tests once
npm run test:watch            # Run Jest in watch mode
npm run test:coverage         # Generate coverage report

# Building
npm run build                 # Build for production
npm run start                 # Start production server
```

## Frontend Architecture

Pages follow the app router pattern with grouped routes (dashboard layout):

```
app/(dashboard)/
├── dashboard/                # Main dashboard/home
├── tasks/
│   ├── new/                  # Create task
│   ├── [id]/                 # View task
│   └── [id]/edit/            # Edit task
├── projects/                 # Project management (NEW)
├── users/                    # User management (ADMIN only)
│   ├── new/                  # Create user
│   └── [id]/                 # View user
├── profile/                  # User profile
└── settings/                 # App settings

app/auth/
├── login/                    # Login page
├── signup/                   # Registration page
└── complete-reset/           # Password reset completion
```

## Important Patterns & Guidelines

### Authentication Context
- `lib/auth-context.tsx` provides React context for current user
- Use `useAuth()` hook in components to access user info and logout
- Token stored in localStorage (access) + httpOnly cookie (refresh)

### Type Safety
- All API responses wrapped in `ApiResponse<T>` or `ApiError`
- Request/response types defined in `lib/types.ts` (e.g., `CreateTaskRequest`, `UpdateTaskRequest`)
- Validate requests with Zod schemas in `lib/validation.ts` before processing

### Error Handling
- API routes return consistent error format: `{ success: false, error: string, details?: unknown, timestamp: string }`
- Use `ErrorCode` enum in `lib/types.ts` for application-specific errors
- `ApiClientError` thrown by frontend API client for type-safe error handling

### Database Relationships
- Task assignments are tracked via `TaskAssignment` junction table (unique constraint prevents duplicate assignments)
- Task dependencies (parent/child) tracked via `TaskRelation` with optional `isBlock` flag
- Project tasks linked via nullable `projectId` on Task model (soft delete via `isDeleted` flag)

### Middleware & Security
- All protected routes guarded by `middleware.ts` (checks JWT validity)
- Security headers applied globally: CSP-like headers, X-Frame-Options, XSS protection
- Password hashing with bcryptjs (rounds configured in auth.ts)

### New Features (Recent Additions)
- **Projects**: Grouping tasks with collaborators and role-based permissions
- **Token Refresh**: Secure refresh token flow with httpOnly cookies
- **Password Reset**: Admin-initiated resets with `requiresPasswordReset` flag
- **Task Dependencies**: Parent/child relationships with blocking indicators

## Testing Setup

- Jest configured with ts-jest preset for TypeScript support
- Test files in `__tests__/` directory mirroring app structure
- Database tests in `scripts/test-db.ts` verify Prisma connectivity and basic operations
- Mock utilities available via jest-mock-extended

## Migration & Schema Changes

When modifying `prisma/schema.prisma`:

1. Update the schema model definition
2. Run `npm run db:push` to sync changes (for development)
3. For production migrations, use `npx prisma migrate dev --name <description>` to create a migration file
4. Commit migration files to version control

## Gotchas & Common Issues

- **Cascade Deletes**: When deleting a User, all related Tasks, Permissions, TaskLogs, Chats are deleted (configured in schema)
- **Task Frequency**: `frequency` field is optional; used for recurring task scheduling logic (not auto-implemented)
- **Soft Deletes**: Tasks use `isDeleted` and `deletedAt` flags; queries may need to filter these out
- **JWT Expiration**: Access tokens are short-lived; UI automatically refreshes via stored refresh token
- **Unique Constraints**: TaskAssignment and ProjectCollaborator have unique constraints to prevent duplicates

