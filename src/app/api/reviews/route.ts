import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, verifyBusinessAccess, verifyBranchAccess } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    const branchId = searchParams.get('branchId');
    const sentiment = searchParams.get('sentiment'); // GOOD, OKAY, POOR
    const status = searchParams.get('status'); // NEW, READ, RESOLVED
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const where: any = {};

    // Role-based scoping
    if (session.role === 'OWNER') {
      where.business = { ownerId: session.userId };
    } else if (session.role === 'MANAGER' || session.role === 'SUPER_MANAGER') {
      const assignments = await prisma.branchUser.findMany({
        where: { userId: session.userId },
        select: { branchId: true, businessId: true },
      });
      const branchIds = assignments.filter((a) => a.branchId).map((a) => a.branchId as string);
      const bizIds = assignments.filter((a) => !a.branchId).map((a) => a.businessId);

      where.OR = [
        { branchId: { in: branchIds } },
        { businessId: { in: bizIds } },
      ];
    } else if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Apply specific filters
    if (businessId && businessId !== 'ALL') {
      const hasAccess = await verifyBusinessAccess(session.userId, session.role, businessId);
      if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      where.businessId = businessId;
    }

    if (branchId && branchId !== 'ALL') {
      const hasAccess = await verifyBranchAccess(session.userId, session.role, branchId);
      if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      where.branchId = branchId;
    }

    if (sentiment && sentiment !== 'ALL') {
      where.sentiment = sentiment;
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (search) {
      where.customer = {
        OR: [
          { name: { contains: search } },
          { mobile: { contains: search } },
        ],
      };
    }

    const reviews = await prisma.review.findMany({
      where,
      include: {
        customer: {
          select: { id: true, name: true, mobile: true, email: true },
        },
        business: {
          select: { id: true, name: true, category: true },
        },
        branch: {
          select: { id: true, name: true, themeColor: true },
        },
        answers: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ success: true, reviews });
  } catch (err: any) {
    console.error('List reviews error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
