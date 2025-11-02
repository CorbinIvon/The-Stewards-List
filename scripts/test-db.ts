/**
 * Simple database connectivity test script
 * This tests that Prisma can connect to the database and perform basic operations
 */

import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../lib/auth';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database test...\n');

  try {
    // Test 1: Create a user
    console.log('Test 1: Creating a test user...');
    const passwordHash = await hashPassword('testpassword123');
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        username: 'testuser',
        displayName: 'Test User',
        passwordHash,
      },
    });
    console.log('✓ User created:', {
      id: user.id,
      username: user.username,
      email: user.email,
    });

    // Test 2: Create a task
    console.log('\nTest 2: Creating a test task...');
    const task = await prisma.task.create({
      data: {
        ownerId: user.id,
        title: 'Test Task',
        description: 'This is a test task',
        frequency: 'DAILY',
      },
    });
    console.log('✓ Task created:', {
      id: task.id,
      title: task.title,
      ownerId: task.ownerId,
    });

    // Test 3: Create a permission
    console.log('\nTest 3: Creating a permission...');
    const permission = await prisma.permission.create({
      data: {
        userId: user.id,
        taskId: task.id,
        permission: 'READ',
      },
    });
    console.log('✓ Permission created:', {
      id: permission.id,
      permission: permission.permission,
    });

    // Test 4: Create a task log
    console.log('\nTest 4: Creating a task log...');
    const taskLog = await prisma.taskLog.create({
      data: {
        taskId: task.id,
        userId: user.id,
        action: 'CREATED',
      },
    });
    console.log('✓ Task log created:', {
      id: taskLog.id,
      createdAt: taskLog.createdAt,
    });

    // Test 5: Create a chat message
    console.log('\nTest 5: Creating a chat message...');
    const chat = await prisma.chat.create({
      data: {
        queryKey: 'test-chat',
        userId: user.id,
        message: 'Hello, this is a test message!',
      },
    });
    console.log('✓ Chat message created:', {
      id: chat.id,
      message: chat.message,
    });

    // Test 6: Query with relations
    console.log('\nTest 6: Querying task with relations...');
    const taskWithRelations = await prisma.task.findUnique({
      where: { id: task.id },
      include: {
        owner: {
          select: {
            username: true,
            displayName: true,
          },
        },
        permissions: true,
        taskLogs: true,
      },
    });
    console.log('✓ Task with relations retrieved:', {
      title: taskWithRelations?.title,
      owner: taskWithRelations?.owner,
      permissionsCount: taskWithRelations?.permissions.length,
      taskLogsCount: taskWithRelations?.taskLogs.length,
    });

    console.log('\n✅ All database tests passed!');
  } catch (error) {
    console.error('\n❌ Database test failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exit(1);
  } finally {
    // Clean up test data
    console.log('\nCleaning up test data...');
    await prisma.chat.deleteMany({});
    await prisma.taskLog.deleteMany({});
    await prisma.permission.deleteMany({});
    await prisma.task.deleteMany({});
    await prisma.user.deleteMany({});
    console.log('✓ Test data cleaned up');

    await prisma.$disconnect();
  }
}

main();
