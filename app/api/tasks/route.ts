import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const ownerId = searchParams.get('ownerId');

    const where = ownerId ? { ownerId } : {};

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
    });
    return NextResponse.json(tasks);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ownerId, title, description, frequency } = body;

    if (!ownerId || !title) {
      return NextResponse.json(
        { error: 'Missing required fields (ownerId, title)' },
        { status: 400 }
      );
    }

    const task = await prisma.task.create({
      data: {
        ownerId,
        title,
        description,
        frequency,
      },
      include: {
        owner: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
    });

    return NextResponse.json(task, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid ownerId' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}
