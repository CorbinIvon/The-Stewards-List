import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const taskId = searchParams.get('taskId');
    const userId = searchParams.get('userId');

    const where: any = {};
    if (taskId) where.taskId = taskId;
    if (userId) where.userId = userId;

    const taskLogs = await prisma.taskLog.findMany({
      where,
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        user: {
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
    return NextResponse.json(taskLogs);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch task logs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { taskId, userId } = body;

    if (!taskId || !userId) {
      return NextResponse.json(
        { error: 'Missing required fields (taskId, userId)' },
        { status: 400 }
      );
    }

    const taskLog = await prisma.taskLog.create({
      data: {
        taskId,
        userId,
      },
      include: {
        task: {
          select: {
            id: true,
            title: true,
          },
        },
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json(taskLog, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid taskId or userId' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create task log' },
      { status: 500 }
    );
  }
}
