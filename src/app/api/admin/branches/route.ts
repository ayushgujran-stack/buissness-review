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

    const branches = await prisma.branch.findMany({
      include: {
        business: {
          select: {
            id: true,
            name: true,
            owner: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        _count: {
          select: { reviews: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, branches });
  } catch (err: any) {
    console.error('Admin branches error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
