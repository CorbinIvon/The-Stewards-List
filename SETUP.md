# Setup Guide

This guide will help you get The Stewards List up and running on your local machine.

## Prerequisites

- Node.js 18 or higher
- npm or yarn package manager
- Git
- A Supabase account and project ([Create one for free](https://supabase.com))

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

3. **Set up Supabase**
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Create a new project or use an existing one
   - Go to Project Settings > Database
   - Copy your connection string from the "Connection string" section (use the "URI" format)

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` and replace the placeholders with your Supabase connection details:
   ```
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres"
   ```
   
   **Important**: This is just an example format. Never commit actual credentials to version control! The `.env` file is already in `.gitignore` to prevent accidental commits.

5. **Initialize the database**
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

To reset the database and start fresh, you can use the Supabase Dashboard or drop all tables using Prisma:

```bash
npx prisma migrate reset
```

**Warning**: This will delete all data in your database!

Alternatively, you can use Supabase Dashboard:
1. Go to your Supabase project
2. Navigate to Database > Tables
3. Delete the tables manually
4. Run `npm run db:push` to recreate the schema

### Using Prisma Studio

You can view and edit your Supabase database locally using Prisma Studio:

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
- `DATABASE_URL` - Your Supabase production database connection string
- `NODE_ENV=production`

**Note**: For production deployments (e.g., Vercel, Netlify), use your Supabase production connection string. You can use the same Supabase project for both development and production, or create separate projects for each environment.

To use connection pooling in production (recommended for serverless environments):
```
DATABASE_URL="postgresql://postgres.pooler:[YOUR-PASSWORD]@[YOUR-REGION].pooler.supabase.com:5432/postgres"
```

Replace `[YOUR-REGION]` with your Supabase project's region (e.g., `aws-0-us-east-1`, `aws-0-eu-west-1`, etc.). You can find this in your Supabase project's database settings.

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
