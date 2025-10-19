import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const queryKey = searchParams.get('queryKey');
    const userId = searchParams.get('userId');

    const where: any = {};
    if (queryKey) where.queryKey = queryKey;
    if (userId) where.userId = userId;

    const chats = await prisma.chat.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        quotedChat: {
          select: {
            id: true,
            message: true,
            user: {
              select: {
                username: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
    return NextResponse.json(chats);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch chats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { queryKey, userId, message, quoteChatId } = body;

    if (!queryKey || !userId || !message) {
      return NextResponse.json(
        { error: 'Missing required fields (queryKey, userId, message)' },
        { status: 400 }
      );
    }

    const chat = await prisma.chat.create({
      data: {
        queryKey,
        userId,
        message,
        quoteChatId,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
        quotedChat: {
          select: {
            id: true,
            message: true,
            user: {
              select: {
                username: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(chat, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid userId or quoteChatId' },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create chat' },
      { status: 500 }
    );
  }
}
