# The Stewards List

A Next.js + Prisma web application for home organization featuring user management, task management, and task tracking.

## Features

- **User Management**: Create and manage user accounts with secure password hashing
- **Task Management**: Create, assign, and track tasks with optional frequency settings
- **Task Logging**: Track who completed tasks and when
- **Permissions**: Control access to tasks with granular permissions
- **Chat**: Communicate with team members with support for threaded conversations

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL) with Prisma ORM
- **Styling**: Tailwind CSS
- **Authentication**: bcryptjs for password hashing

## Database Schema

### Users
- `id` (String, CUID)
- `createdAt` (DateTime)
- `email` (String, unique)
- `username` (String, unique)
- `displayName` (String)
- `passwordHash` (String)

### Tasks
- `id` (String, CUID)
- `createdAt` (DateTime)
- `ownerId` (String, FK to Users)
- `title` (String)
- `description` (String, optional)
- `frequency` (String, optional)

### Permissions
- `id` (String, CUID)
- `createdAt` (DateTime)
- `userId` (String, FK to Users)
- `taskId` (String, FK to Tasks)
- `permission` (String)

### TaskLogs
- `id` (String, CUID)
- `createdAt` (DateTime)
- `taskId` (String, FK to Tasks)
- `userId` (String, FK to Users)

### Chat
- `id` (String, CUID)
- `createdAt` (DateTime)
- `queryKey` (String)
- `userId` (String, FK to Users)
- `quoteChatId` (String, optional FK to Chat)
- `message` (String)

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn package manager

### Installation

1. Clone the repository:
```bash
git clone https://github.com/CorbinIvon/The-Stewards-List.git
cd The-Stewards-List
```

2. Install dependencies:
```bash
npm install
```

3. Set up the database:
```bash
npm run db:push
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Scripts

- `npm run dev` - Start the development server
- `npm run build` - Build the production application
- `npm run start` - Start the production server
- `npm run lint` - Run ESLint
- `npm run db:generate` - Generate Prisma Client
- `npm run db:push` - Push database schema changes
- `npm run db:studio` - Open Prisma Studio

## API Endpoints

### Users
- `GET /api/users` - Get all users
- `POST /api/users` - Create a new user
  - Body: `{ email, username, displayName, password }`

### Tasks
- `GET /api/tasks?ownerId={id}` - Get all tasks (optionally filter by owner)
- `POST /api/tasks` - Create a new task
  - Body: `{ ownerId, title, description?, frequency? }`

### Permissions
- `GET /api/permissions?userId={id}&taskId={id}` - Get permissions (optionally filter)
- `POST /api/permissions` - Create a new permission
  - Body: `{ userId, taskId, permission }`

### Task Logs
- `GET /api/task-logs?taskId={id}&userId={id}` - Get task logs (optionally filter)
- `POST /api/task-logs` - Create a new task log
  - Body: `{ taskId, userId }`

### Chats
- `GET /api/chats?queryKey={key}&userId={id}` - Get chats (optionally filter)
- `POST /api/chats` - Create a new chat message
  - Body: `{ queryKey, userId, message, quoteChatId? }`

## Development

The application uses:
- **Next.js App Router** for routing and API routes
- **Prisma** for database management with cascade deletes
- **TypeScript** for type safety
- **Tailwind CSS** for styling

## License

This project is licensed under the ISC License - see the LICENSE file for details.
