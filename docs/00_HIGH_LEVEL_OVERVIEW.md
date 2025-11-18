# The Stewards List - High Level Overview

Welcome to **The Stewards List**, a modern home organization web application built with cutting-edge technologies. This document provides a user-friendly overview of the project structure, technologies, data types, components, and pages.

---

## Table of Contents

1. [General Information](#general-information)
2. [Technology Stack](#technology-stack)
3. [Types & Data Models](#types--data-models)
4. [Components](#components)
5. [Pages & Routes](#pages--routes)
6. [Feature Overview](#feature-overview)

---

## General Information

### Project Purpose

The Stewards List is a comprehensive home organization platform designed to help households manage tasks, organize projects, collaborate with family members, and communicate about household responsibilities.

### Core Philosophy

- **Type-Safe**: Built with TypeScript for maximum safety and IDE support
- **User-Centric**: Clean, intuitive dark-themed UI for easy task management
- **Scalable**: Modular component architecture for easy feature expansion
- **Secure**: JWT-based authentication with encrypted passwords
- **Collaborative**: Multi-user support with role-based permissions

### Key Features

- ✅ **Task Management**: Create, organize, and track household tasks with status and priority
- ✅ **Projects**: Group related tasks into projects with collaborators
- ✅ **User Roles**: Three-tier permission system (Admin, Manager, Member)
- ✅ **Activity Feed**: Real-time chat and automatic system messages for task updates
- ✅ **Collaboration**: Add team members to projects and assign tasks
- ✅ **Dark Theme**: Modern dark UI optimized for comfortable viewing

---

## Technology Stack

### Frontend & Framework

| Technology | Purpose |
|------------|---------|
| **Next.js 15** | React framework with server-side rendering and App Router |
| **React 19** | UI component library and state management |
| **TypeScript** | Type-safe JavaScript for development |
| **Tailwind CSS** | Utility-first CSS for responsive, dark-themed design |

### Backend & Database

| Technology | Purpose |
|------------|---------|
| **Next.js API Routes** | Server-side endpoints in `/api` directory |
| **PostgreSQL** | Relational database for persistent data storage |
| **Prisma ORM** | Type-safe database client and migration tool |
| **JWT Tokens** | Secure authentication and session management |
| **bcryptjs** | Password hashing for security |

### Development Tools

| Tool | Purpose |
|------|---------|
| **Jest** | Unit and integration testing framework |
| **ESLint** | Code quality and style enforcement |
| **Zod** | Runtime data validation for API requests |
| **Docker Compose** | Local PostgreSQL database containerization |

---

## Types & Data Models

### Core Data Types

The application uses TypeScript interfaces for type safety. Here are the main data models:

#### 1. **User**
Represents a user account in the system.

```typescript
{
  id: string                          // Unique user ID
  email: string                       // Email address (unique)
  username: string                    // Display username
  displayName: string                 // Full name
  role: 'ADMIN' | 'MANAGER' | 'MEMBER'  // User permission level
  passwordHash: string                // Encrypted password
  requiresPasswordReset: boolean      // Password reset flag
  isActive: boolean                   // Account active status
  lastLoginAt: Date | null            // Last login timestamp
  createdAt: Date
  updatedAt: Date
}
```

#### 2. **Task**
Represents a household task with status and details.

```typescript
{
  id: string
  title: string                       // Task name (required)
  description: string | null          // Detailed description
  status: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' | null  // Recurrence pattern
  ownerId: string                     // User who created the task
  projectId: string | null            // Associated project (if any)
  dueDate: Date | null                // Due date
  assignDate: Date | null             // Scheduled start date
  dueBy: Date | null                  // Due date for current occurrence
  completedAt: Date | null            // When task was completed
  isDeleted: boolean                  // Soft delete flag
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

#### 3. **Project**
Groups related tasks and team members.

```typescript
{
  id: string
  projectName: string                 // Project title
  description: string | null          // Project details
  creatorId: string                   // User who created the project
  archived: boolean                   // Archived status
  createdAt: Date
  updatedAt: Date
}
```

#### 4. **TaskAssignment**
Links users to tasks they're assigned to.

```typescript
{
  id: string
  taskId: string                      // Associated task
  userId: string                      // Assigned user
  assignedBy: string | null           // User who assigned it
  createdAt: Date
}
```

#### 5. **Permission**
Controls access levels to tasks.

```typescript
{
  id: string
  userId: string
  taskId: string
  permission: 'READ' | 'WRITE' | 'DELETE' | 'ADMIN'
  createdAt: Date
  updatedAt: Date
}
```

#### 6. **UniversalChat**
Messages and activity feed for any resource (tasks, projects).

```typescript
{
  id: string
  posterId: string                    // User who wrote/system created it
  associativeKey: string              // e.g., "tasks/task-id-123"
  message: string                     // Message content
  isSystem: boolean                   // Server-generated activity message
  isEdited: boolean                   // Whether message was edited
  isDeleted: boolean                  // Soft delete flag
  deletedAt: Date | null
  createdAt: Date
  updatedAt: Date
}
```

#### 7. **TaskLog**
Audit trail for task changes and actions.

```typescript
{
  id: string
  taskId: string
  userId: string
  action: 'CREATED' | 'UPDATED' | 'COMPLETED' | 'ASSIGNED' | 'UNASSIGNED'
  note: string | null
  metadata: object | null             // Additional data about the change
  createdAt: Date
}
```

### Key Enums

```typescript
// Task Status Lifecycle
TaskStatus: 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'

// Priority Levels
TaskPriority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

// Recurrence Patterns
TaskFrequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'ONCE'

// User Roles
UserRole: 'ADMIN' | 'MANAGER' | 'MEMBER'

// Permission Types
PermissionType: 'READ' | 'WRITE' | 'DELETE' | 'ADMIN'
```

---

## Components

The application uses a modular component architecture organized by feature area. All components are React functional components using hooks.

### UI Components (`components/ui/`)

Base reusable UI building blocks with dark theme styling:

| Component | Purpose |
|-----------|---------|
| **Button** | Interactive button with variants (primary, secondary, danger) |
| **Card** | Container component with header, body, footer sections |
| **Badge** | Small status/tag indicator (success, warning, danger, info, default) |
| **Alert** | User notification with variant styles and dismiss functionality |
| **Input** | Text input field with label and validation |
| **Textarea** | Multi-line text input for longer content |
| **Select** | Dropdown selector with label |
| **Spinner** | Loading indicator |
| **Modal** | Dialog component for confirmations and forms |

### Task Components (`components/tasks/`)

Task management and display:

| Component | Purpose |
|-----------|---------|
| **TaskCard** | Compact task summary card showing title, status, priority, due date |
| **TaskForm** | Create/edit task form with validation |
| **TaskFilters** | Filter controls (status, priority, search) |
| **TaskStatusBadge** | Visual indicator for task status |
| **TaskPriorityBadge** | Visual indicator for task priority |
| **TaskHistory** | Timeline of task changes (audit trail) |
| **TaskChat** | Legacy threaded discussion messages on tasks |
| **TaskAssignmentPicker** | User selector for task assignments |

### Project Components (`components/projects/`)

Project management and collaboration:

| Component | Purpose |
|-----------|---------|
| **ProjectCard** | Project summary card showing name, member count, task count |
| **ProjectForm** | Create/edit project form |
| **CollaboratorsList** | Display and manage project team members |

### Navigation Components (`components/navigation/`)

Header and sidebar navigation:

| Component | Purpose |
|-----------|---------|
| **Header** | Top navigation bar with logo and user menu |
| **Sidebar** | Left navigation panel with menu links |

### Profile & User Components (`components/profile/`, `components/users/`)

User account management:

| Component | Purpose |
|-----------|---------|
| **ProfileForm** | Edit user profile information |
| **PasswordChangeForm** | Change password interface |
| **UserCard** | Display user information |
| **UserRoleBadge** | Visual indicator for user role |

### Universal Components (`components/universal/`)

Reusable feature components across the app:

| Component | Purpose |
|-----------|---------|
| **UniversalChat** | Reusable messaging component for any resource (tasks, projects) |
| **Activity** | Activity log/timeline placeholder |

---

## Pages & Routes

The application uses Next.js App Router with grouped routes. Pages are organized by feature area:

### Authentication Pages (`app/(auth)/`)

Public pages for authentication (no login required):

| Route | Purpose |
|-------|---------|
| `/` | Landing page / redirect |
| `/login` | User login form |
| `/signup` | New user registration |
| `/complete-reset` | Password reset completion |

### Dashboard Pages (`app/(dashboard)/`)

Protected pages (login required):

#### Dashboard

| Route | Purpose |
|-------|---------|
| `/dashboard` | Main dashboard / home with quick stats |

#### Tasks Management

| Route | Purpose |
|-------|---------|
| `/tasks` | List all tasks with filtering and search |
| `/tasks/new` | Create new task form (supports `?projectId=` query param) |
| `/tasks/[id]` | Task detail view with chat, activity, and metadata (GitHub issue style) |
| `/tasks/[id]/edit` | Edit task form with project selector |

#### Projects Management

| Route | Purpose |
|-------|---------|
| `/projects` | List all projects |
| `/projects/new` | Create new project form |
| `/projects/[id]` | Project detail view with tabs (Overview, Tasks, Collaborators) |
| `/projects/[id]/edit` | Edit project information |

#### User Management (Admin/Manager Only)

| Route | Purpose |
|-------|---------|
| `/users` | List all users in the system |
| `/users/new` | Create new user account (Admin only) |
| `/users/[id]` | View user profile and details |

#### Account Pages

| Route | Purpose |
|-------|---------|
| `/profile` | Edit current user profile |
| `/settings` | Application settings and preferences |

### Route Structure

```
app/
├── (auth)/                  # Public authentication routes
│   ├── page.tsx            # Redirect to dashboard
│   ├── login/page.tsx
│   ├── signup/page.tsx
│   └── complete-reset/page.tsx
│
└── (dashboard)/             # Protected dashboard routes (require login)
    ├── dashboard/page.tsx
    ├── tasks/
    │   ├── page.tsx         # Task list
    │   ├── new/page.tsx     # Create task
    │   └── [id]/
    │       ├── page.tsx     # Task detail
    │       └── edit/page.tsx
    ├── projects/
    │   ├── page.tsx         # Project list
    │   ├── new/page.tsx     # Create project
    │   └── [id]/
    │       ├── page.tsx     # Project detail
    │       └── edit/page.tsx
    ├── users/
    │   ├── page.tsx         # User list
    │   ├── new/page.tsx     # Create user
    │   └── [id]/page.tsx    # User detail
    ├── profile/page.tsx
    └── settings/page.tsx
```

---

## Feature Overview

### 1. Task Management

**What**: Create and manage household tasks with detailed metadata

**Features**:
- Create tasks with title, description, priority, due date
- Set task status (TODO → IN_PROGRESS → COMPLETED/CANCELLED)
- Configure recurring tasks (daily, weekly, monthly, etc.)
- Assign tasks to team members
- Edit and delete tasks
- Soft delete (recoverable)
- Overdue indicators

**Pages**: `/tasks`, `/tasks/new`, `/tasks/[id]`, `/tasks/[id]/edit`

### 2. Project Organization

**What**: Group related tasks into projects for better organization

**Features**:
- Create projects with description
- Link tasks to projects
- Archive completed projects
- Add team collaborators to projects
- Set collaborator permissions
- View project statistics (task count, member count)

**Pages**: `/projects`, `/projects/new`, `/projects/[id]`, `/projects/[id]/edit`

### 3. User & Collaboration

**What**: Manage team members and permissions

**Features**:
- Three-tier role system (Admin, Manager, Member)
- Create and manage user accounts
- Assign users to projects as collaborators
- Permission-based access control
- User profile management
- Password management

**Pages**: `/users`, `/users/new`, `/users/[id]`, `/profile`, `/settings`

### 4. Activity & Communication

**What**: Unified messaging and activity tracking

**Features**:
- Comment on tasks and projects (UniversalChat)
- Automatic system messages on task updates (status, priority, assignment changes)
- Message pagination (20 messages per page)
- Edit and delete your messages
- Activity timeline shows all changes
- Unified feed across all resource types

**Components**: `UniversalChat`, `Activity`

### 5. Authentication & Security

**What**: Secure access control and session management

**Features**:
- Email/password authentication
- JWT token-based sessions
- Refresh token rotation (stored in httpOnly cookies)
- Password hashing with bcryptjs
- Admin-initiated password resets
- Protected API routes and pages
- Role-based access control (RBAC)

**Pages**: `/login`, `/signup`, `/complete-reset`

---

## Data Flow Overview

### Typical User Journey

1. **Login**: User enters email/password → Receives JWT token
2. **Dashboard**: User sees overview of tasks and projects
3. **Create Task**: Fill form → POST to `/api/tasks` → Redirects to task detail
4. **Task Detail**: View task → See chat messages and activity → Edit or complete
5. **Create Project**: Fill project form → Add collaborators → Link tasks
6. **Collaborate**: Team members comment on tasks → See activity feed update

### API Communication

- **Frontend**: React components use `apiClient` (lib/api-client.ts)
- **Client Library**: Provides typed methods for all API endpoints
- **Backend**: Next.js API routes in `/api` directory
- **Database**: Prisma ORM manages PostgreSQL interactions
- **Response Format**: Consistent JSON with `{ success, data, error, timestamp }`

---

## Development Workflow

### Local Setup

```bash
# Install dependencies
npm install

# Start PostgreSQL database
npm run db:start

# Sync database schema
npm run db:push

# Start development server
npm run dev
```

### Development Server

Visit `http://localhost:3000` in your browser.

### Build & Deploy

```bash
# Build for production
npm run build

# Start production server
npm run start
```

---

## Quick Reference: Common Tasks

### Adding a New Page

1. Create file in `app/(dashboard)/feature/page.tsx`
2. Mark as `"use client"` for client components
3. Use existing page templates as reference
4. Add route link in navigation

### Creating a New Component

1. Create file in `components/feature/FeatureName.tsx`
2. Export as default function component
3. Define TypeScript props interface
4. Use Tailwind classes for dark theme styling

### Adding an API Endpoint

1. Create file in `app/api/resource/route.ts`
2. Export `GET`, `POST`, `PUT`, or `DELETE` functions
3. Use `requireAuth` middleware for protection
4. Return consistent response format with `NextResponse.json()`

### Connecting to API from Components

```typescript
import { apiClient } from "@/lib/api-client";

// In your component:
const response = await apiClient.getTasks({ projectId: id });
const newTask = await apiClient.createTask(data);
```

---

## Learning Resources

- **Types**: See `lib/types.ts` for all TypeScript interfaces
- **Validation**: See `lib/validation.ts` for Zod schemas
- **API Client**: See `lib/api-client.ts` for all available API methods
- **Authentication**: See `lib/auth.ts` for token handling
- **Middleware**: See `lib/middleware/auth.ts` for route protection

---

## Next Steps

- For detailed architectural information, see `CLAUDE.md`
- For API route specifics, explore `/app/api` directory
- For component implementation, browse `components/` directory
- For database schema, see `prisma/schema.prisma`
