import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const since = searchParams.get('since');

    const sinceDate = since ? new Date(since) : new Date(Date.now() - 60000); // last 1 min default

    const newNotifications = await prisma.notification.findMany({
      where: {
        createdAt: { gte: sinceDate },
        recipients: {
          some: {
            userId: session.userId,
            isRead: false,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const parsed = newNotifications.map((n) => ({
      ...n,
      metadata: n.metadata ? JSON.parse(n.metadata) : null,
    }));

    return NextResponse.json({
      success: true,
      hasNew: parsed.length > 0,
      notifications: parsed,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Poll notifications error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
