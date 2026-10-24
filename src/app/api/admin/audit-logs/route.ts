import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const action = searchParams.get('action');

    const where: any = {};
    if (action) where.action = action;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    const parsed = logs.map((l) => ({
      ...l,
      details: l.details ? JSON.parse(l.details) : null,
    }));

    return NextResponse.json({ success: true, logs: parsed });
  } catch (err: any) {
    console.error('List audit logs error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
