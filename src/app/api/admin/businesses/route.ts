import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const businesses = await prisma.business.findMany({
      include: {
        owner: {
          select: { id: true, name: true, email: true, organizationName: true },
        },
        branches: {
          select: { id: true, name: true, status: true, qrToken: true },
        },
        _count: {
          select: { reviews: true, branches: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, businesses });
  } catch (err: any) {
    console.error('Admin businesses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
