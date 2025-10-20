# Setup Guide

This guide will help you get The Stewards List up and running on your local machine.

## Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Git

You can run a local PostgreSQL instance (recommended) using Docker Compose or point the app at any existing Postgres database.

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

3. **Run a local PostgreSQL (recommended)**

Using Docker Compose (included):

```bash
docker compose up -d db
```

This starts a Postgres instance (image: postgres:15) with a default database `the_stewards_list`, username `postgres` and password `postgres`, exposed on port 5432. You can customize these in `docker-compose.yml`.

4. **Set up environment variables**

Run:

```bash
cp .env.example .env
```

Edit `.env` if you changed the credentials or host/port. The default example uses:

```text
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/the_stewards_list"
```

**Important**: This is just an example format. Never commit actual credentials to version control! The `.env` file is already in `.gitignore` to prevent accidental commits.

5. **Initialize the database**

If you haven't generated the Prisma client yet, run:

```bash
npm run db:generate
```

To push the Prisma schema to your database (create tables):

```bash
npm run db:push
```

6. **Run the development server**

   ```bash
   npm run dev
   ```

7. **Open your browser**

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

To reset the local database and start fresh (DESTROYS DATA):

```bash
npx prisma migrate reset --force
```

Or stop and remove the Docker data volume if you want a full reset:

```bash
docker compose down -v
docker compose up -d db
```

### Using Prisma Studio

You can view and edit your local Postgres database using Prisma Studio:

```bash
npm run db:studio
```

This will open a GUI at [http://localhost:5555](http://localhost:5555) where you can view and edit your data.

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

- `DATABASE_URL` - Your Postgres production database connection string
- `NODE_ENV=production`

**Note**: For production deployments (e.g., Vercel, Netlify), use your production Postgres connection string. You can use the same database for both development and production, or create separate databases for each environment.

If your production Postgres provider supports a pooler-style connection string, use that value for `DATABASE_URL`.

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, you can specify a different port:

```bash
PORT=3001 npm run dev
```

### Database Connection Issues

- Verify your Supabase project is active and accessible
- Check that the `DATABASE_URL` in `.env` is correct (including password and project reference)
- Ensure your IP address is allowed in Supabase Dashboard (Settings > Database > Connection Pooling)
- Try using the direct connection string instead of the pooled connection
- Check Supabase service status at [status.supabase.com](https://status.supabase.com)

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
