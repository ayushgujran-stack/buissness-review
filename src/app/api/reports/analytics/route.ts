import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, verifyBusinessAccess } from '@/lib/auth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');
    const branchId = searchParams.get('branchId');

    const where: any = {};

    if (session.role === 'OWNER') {
      const licenseStatus = await (await import('@/lib/license')).getOwnerLicenseStatus(session.userId);
      if (!licenseStatus.hasActiveLicense) {
        return NextResponse.json(
          {
            error: licenseStatus.status === 'EXPIRED'
              ? 'Your ReviewFlow license has expired. Please renew your subscription to access analytics.'
              : 'Your license is currently suspended. Protected dashboard access is restricted.',
            code: 'LICENSE_RESTRICTED',
            licenseStatus: licenseStatus.status,
          },
          { status: 403 }
        );
      }
      where.business = { ownerId: session.userId };
    } else if (session.role === 'MANAGER' || session.role === 'SUPER_MANAGER') {
      const assignments = await prisma.branchUser.findMany({
        where: { userId: session.userId },
        include: { business: true },
      });
      if (assignments.length > 0 && assignments[0].business?.ownerId) {
        const licenseStatus = await (await import('@/lib/license')).getOwnerLicenseStatus(assignments[0].business.ownerId);
        if (!licenseStatus.hasActiveLicense) {
          return NextResponse.json(
            {
              error: 'Business license is expired or inactive. Protected dashboard access is restricted.',
              code: 'LICENSE_RESTRICTED',
              licenseStatus: licenseStatus.status,
            },
            { status: 403 }
          );
        }
      }
      const branchIds = assignments.filter((a) => a.branchId).map((a) => a.branchId as string);
      const bizIds = assignments.filter((a) => !a.branchId).map((a) => a.businessId);

      where.OR = [
        { branchId: { in: branchIds } },
        { businessId: { in: bizIds } },
      ];
    } else if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (businessId && businessId !== 'ALL') {
      const hasAccess = await verifyBusinessAccess(session.userId, session.role, businessId);
      if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      where.businessId = businessId;
    }

    if (branchId && branchId !== 'ALL') {
      where.branchId = branchId;
    }

    // Fetch all reviews matching filter
    const reviews = await prisma.review.findMany({
      where,
      include: {
        branch: { select: { id: true, name: true, themeColor: true } },
        business: { select: { id: true, name: true } },
        answers: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalReviews = reviews.length;

    // Today's reviews
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const todaysReviews = reviews.filter((r) => new Date(r.createdAt) >= startOfToday).length;

    // Good / Okay / Poor counts
    const goodReviews = reviews.filter((r) => r.sentiment === 'GOOD').length;
    const okayReviews = reviews.filter((r) => r.sentiment === 'OKAY').length;
    const poorReviews = reviews.filter((r) => r.sentiment === 'POOR').length;

    const avgRating = totalReviews > 0
      ? parseFloat((reviews.reduce((acc, r) => acc + r.rating, 0) / totalReviews).toFixed(1))
      : 5.0;

    // Distribution
    const distribution = {
      good: goodReviews,
      okay: okayReviews,
      poor: poorReviews,
      goodPct: totalReviews > 0 ? Math.round((goodReviews / totalReviews) * 100) : 0,
      okayPct: totalReviews > 0 ? Math.round((okayReviews / totalReviews) * 100) : 0,
      poorPct: totalReviews > 0 ? Math.round((poorReviews / totalReviews) * 100) : 0,
    };

    // Branch comparison
    const branchStatsMap = new Map<string, { id: string; name: string; businessName: string; total: number; good: number; okay: number; poor: number; avgRating: number; ratingSum: number }>();

    for (const r of reviews) {
      if (!branchStatsMap.has(r.branchId)) {
        branchStatsMap.set(r.branchId, {
          id: r.branchId,
          name: r.branch.name,
          businessName: r.business.name,
          total: 0,
          good: 0,
          okay: 0,
          poor: 0,
          avgRating: 0,
          ratingSum: 0,
        });
      }
      const bStat = branchStatsMap.get(r.branchId)!;
      bStat.total++;
      bStat.ratingSum += r.rating;
      if (r.sentiment === 'GOOD') bStat.good++;
      else if (r.sentiment === 'OKAY') bStat.okay++;
      else if (r.sentiment === 'POOR') bStat.poor++;
      bStat.avgRating = parseFloat((bStat.ratingSum / bStat.total).toFixed(1));
    }

    const branchComparison = Array.from(branchStatsMap.values());

    // Review trend by day (last 7 days)
    const trendMap = new Map<string, { date: string; total: number; good: number; poor: number }>();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(5, 10); // MM-DD
      trendMap.set(key, { date: key, total: 0, good: 0, poor: 0 });
    }

    for (const r of reviews) {
      const key = new Date(r.createdAt).toISOString().slice(5, 10);
      if (trendMap.has(key)) {
        const item = trendMap.get(key)!;
        item.total++;
        if (r.sentiment === 'GOOD') item.good++;
        if (r.sentiment === 'POOR') item.poor++;
      }
    }

    const reviewTrend = Array.from(trendMap.values());

    // Question performance breakdown
    const questionMap = new Map<string, { questionText: string; total: number; good: number; poor: number }>();
    for (const r of reviews) {
      for (const a of r.answers) {
        if (!questionMap.has(a.questionText)) {
          questionMap.set(a.questionText, { questionText: a.questionText, total: 0, good: 0, poor: 0 });
        }
        const qStat = questionMap.get(a.questionText)!;
        qStat.total++;
        if (a.classification === 'GOOD') qStat.good++;
        if (a.classification === 'POOR') qStat.poor++;
      }
    }

    const questionPerformance = Array.from(questionMap.values()).map((q) => ({
      ...q,
      satisfactionRate: q.total > 0 ? Math.round((q.good / q.total) * 100) : 100,
    }));

    return NextResponse.json({
      success: true,
      metrics: {
        totalReviews,
        todaysReviews,
        goodReviews,
        okayReviews,
        poorReviews,
        avgRating,
      },
      distribution,
      branchComparison,
      reviewTrend,
      questionPerformance,
    });
  } catch (err: any) {
    console.error('Analytics error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
