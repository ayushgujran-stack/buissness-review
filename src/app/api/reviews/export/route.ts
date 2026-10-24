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

    if (businessId && businessId !== 'ALL') {
      const hasAccess = await verifyBusinessAccess(session.userId, session.role, businessId);
      if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      where.businessId = businessId;
    }

    if (branchId && branchId !== 'ALL') {
      where.branchId = branchId;
    }

    const reviews = await prisma.review.findMany({
      where,
      include: {
        customer: true,
        business: true,
        branch: true,
        answers: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const csvRows: string[] = [];
    csvRows.push([
      'Review ID',
      'Date',
      'Business',
      'Branch',
      'Customer Name',
      'Customer Mobile',
      'Rating',
      'Sentiment',
      'Status',
      'Feedback Answers',
    ].map((h) => `"${h}"`).join(','));

    for (const r of reviews) {
      const answersText = r.answers
        .map((a) => `[${a.questionText}: ${a.answerText}]`)
        .join('; ')
        .replace(/"/g, '""');

      csvRows.push([
        r.id,
        new Date(r.createdAt).toISOString(),
        `"${r.business.name.replace(/"/g, '""')}"`,
        `"${r.branch.name.replace(/"/g, '""')}"`,
        `"${r.customer.name.replace(/"/g, '""')}"`,
        `"${r.customer.mobile}"`,
        r.rating.toString(),
        r.sentiment,
        r.status,
        `"${answersText}"`,
      ].join(','));
    }

    const csvData = csvRows.join('\n');

    return new NextResponse(csvData, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="reviewflow-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    console.error('Export reviews error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
