import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const userId = searchParams.get('userId');
    const taskId = searchParams.get('taskId');

    const where: any = {};
    if (userId) where.userId = userId;
    if (taskId) where.taskId = taskId;

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, taskId, permission } = body;

    if (!userId || !taskId || !permission) {
      return NextResponse.json(
        { error: 'Missing required fields (userId, taskId, permission)' },
        { status: 400 }
      );
    }

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
