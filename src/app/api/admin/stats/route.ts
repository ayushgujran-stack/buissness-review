import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Super Admin access required' }, { status: 403 });
    }

    const totalOwners = await prisma.user.count({ where: { role: 'OWNER' } });
    const totalBusinesses = await prisma.business.count();
    const totalBranches = await prisma.branch.count();

    const activeLicenses = await prisma.license.count({
      where: { status: 'ACTIVE', expiresAt: { gt: new Date() } },
    });
    const trialLicenses = await prisma.license.count({
      where: { status: 'TRIAL', expiresAt: { gt: new Date() } },
    });
    const expiredLicenses = await prisma.license.count({
      where: {
        OR: [{ status: 'EXPIRED' }, { expiresAt: { lte: new Date() } }],
      },
    });

    const totalReviews = await prisma.review.count();
    const poorReviews = await prisma.review.count({ where: { sentiment: 'POOR' } });

    const paymentsSum = await prisma.payment.aggregate({
      where: { status: 'SUCCESS' },
      _sum: { amount: true },
    });
    const totalRevenue = paymentsSum._sum.amount || 0;

    // Recent 5 businesses and branches
    const recentBusinesses = await prisma.business.findMany({
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { branches: true, reviews: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return NextResponse.json({
      success: true,
      stats: {
        totalOwners,
        totalBusinesses,
        totalBranches,
        activeLicenses,
        trialLicenses,
        expiredLicenses,
        totalReviews,
        poorReviews,
        totalRevenue,
      },
      recentBusinesses,
    });
  } catch (err: any) {
    console.error('Super admin stats error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
