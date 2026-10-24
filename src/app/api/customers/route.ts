import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search');

    let customerIds: string[] = [];

    if (session.role === 'OWNER') {
      const reviews = await prisma.review.findMany({
        where: { business: { ownerId: session.userId } },
        select: { customerId: true },
        distinct: ['customerId'],
      });
      customerIds = reviews.map((r) => r.customerId);
    } else if (session.role === 'MANAGER' || session.role === 'SUPER_MANAGER') {
      const assignments = await prisma.branchUser.findMany({
        where: { userId: session.userId },
        select: { branchId: true, businessId: true },
      });
      const branchIds = assignments.filter((a) => a.branchId).map((a) => a.branchId as string);
      const bizIds = assignments.filter((a) => !a.branchId).map((a) => a.businessId);

      const reviews = await prisma.review.findMany({
        where: {
          OR: [
            { branchId: { in: branchIds } },
            { businessId: { in: bizIds } },
          ],
        },
        select: { customerId: true },
        distinct: ['customerId'],
      });
      customerIds = reviews.map((r) => r.customerId);
    } else if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const where: any = {};
    if (session.role !== 'SUPER_ADMIN') {
      where.id = { in: customerIds };
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { mobile: { contains: search } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        reviews: {
          select: {
            id: true,
            rating: true,
            sentiment: true,
            createdAt: true,
            business: { select: { name: true } },
            branch: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
      orderBy: { lastVisitAt: 'desc' },
    });

    return NextResponse.json({ success: true, customers });
  } catch (err: any) {
    console.error('List customers error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
