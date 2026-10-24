import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const notifications = await prisma.notification.findMany({
      where: {
        recipients: {
          some: { userId: session.userId },
        },
      },
      include: {
        recipients: {
          where: { userId: session.userId },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const formatted = notifications.map((n) => {
      const recipient = n.recipients[0];
      return {
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        status: n.status,
        metadata: n.metadata ? JSON.parse(n.metadata) : null,
        createdAt: n.createdAt,
        isRead: recipient ? recipient.isRead : false,
      };
    });

    const unreadCount = formatted.filter((f) => !f.isRead).length;

    return NextResponse.json({
      success: true,
      unreadCount,
      notifications: formatted,
    });
  } catch (err: any) {
    console.error('List notifications error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
