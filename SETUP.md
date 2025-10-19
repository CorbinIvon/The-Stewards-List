# Setup Guide

This guide will help you get The Stewards List up and running on your local machine.

## Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Git

## Quick Start

1. **Clone the repository**
   ```bash
   git clone https://github.com/CorbinIvon/The-Stewards-List.git
   cd The-Stewards-List
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   The default `.env` uses SQLite for development, which requires no additional setup.

4. **Initialize the database**
   ```bash
   npm run db:push
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

6. **Open your browser**
   
   Navigate to [http://localhost:3000](http://localhost:3000)

## Verify Installation

Run the database test to ensure everything is working:

```bash
npm run test:db
```

You should see all tests passing:
- ✓ User created
- ✓ Task created
- ✓ Permission created
- ✓ Task log created
- ✓ Chat message created
- ✓ Task with relations retrieved

## Using the API

### Create a User

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "username",
    "displayName": "Display Name",
    "password": "securepassword"
  }'
```

### Create a Task

```bash
curl -X POST http://localhost:3000/api/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "ownerId": "user_id_here",
    "title": "Task Title",
    "description": "Task description",
    "frequency": "daily"
  }'
```

### Get All Tasks

```bash
curl http://localhost:3000/api/tasks
```

### Get Tasks for a Specific User

```bash
curl http://localhost:3000/api/tasks?ownerId=user_id_here
```

### Log Task Completion

```bash
curl -X POST http://localhost:3000/api/task-logs \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task_id_here",
    "userId": "user_id_here"
  }'
```

### Grant Permission

```bash
curl -X POST http://localhost:3000/api/permissions \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_id_here",
    "taskId": "task_id_here",
    "permission": "read"
  }'
```

### Send a Chat Message

```bash
curl -X POST http://localhost:3000/api/chats \
  -H "Content-Type: application/json" \
  -d '{
    "queryKey": "general",
    "userId": "user_id_here",
    "message": "Hello, world!"
  }'
```

## Database Management

### View Database with Prisma Studio

```bash
npm run db:studio
```

This will open a GUI at [http://localhost:5555](http://localhost:5555) where you can view and edit your data.

### Reset Database

To reset the database and start fresh:

```bash
rm prisma/dev.db
npm run db:push
```

### Switching to PostgreSQL

1. Update your `.env` file:
   ```
   DATABASE_URL="postgresql://user:password@localhost:5432/stewards_list?schema=public"
   ```

2. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. Push the schema:
   ```bash
   npm run db:push
   ```

## Production Deployment

### Build for Production

```bash
npm run build
```

### Start Production Server

```bash
npm start
```

### Environment Variables

For production, ensure you set:
- `DATABASE_URL` - Your production database connection string
- `NODE_ENV=production`

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, you can specify a different port:

```bash
PORT=3001 npm run dev
```

### Database Connection Issues

- Ensure the database file has proper permissions
- Check that the `DATABASE_URL` in `.env` is correct
- Try deleting and recreating the database

### Build Errors

- Clear the `.next` folder: `rm -rf .next`
- Clear node_modules and reinstall: `rm -rf node_modules && npm install`
- Ensure TypeScript and all dependencies are properly installed

## Next Steps

- Implement authentication and sessions
- Add frontend pages for user interaction
- Create UI components for task management
- Add real-time features with WebSockets
- Implement file uploads for task attachments
- Add notifications for task assignments and completions

## Getting Help

- Check the [README.md](README.md) for more information
- Review the Prisma schema in `prisma/schema.prisma`
- Examine the API routes in `app/api/*/route.ts`
- Run the test script to verify database operations
