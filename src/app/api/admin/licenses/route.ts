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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    let whereClause: any = {};
    if (status) {
      whereClause.status = status;
    }
    if (search) {
      whereClause.OR = [
        { planName: { contains: search } },
        { owner: { name: { contains: search } } },
        { owner: { email: { contains: search } } },
      ];
    }

    const licenses = await prisma.license.findMany({
      where: whereClause,
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            organizationName: true,
            status: true,
            businesses: {
              include: {
                branches: {
                  where: { status: { not: 'INACTIVE' } },
                  select: { id: true },
                },
              },
            },
          },
        },
        histories: {
          orderBy: { createdAt: 'desc' },
          take: 3,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const formatted = licenses.map((lic) => {
      const currentBranches = lic.owner.businesses.reduce((acc, b) => acc + b.branches.length, 0);
      const diffTime = new Date(lic.expiresAt).getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
      const isExpired = diffTime <= 0;

      let effectiveStatus = lic.status;
      if (isExpired && lic.status !== 'SUSPENDED') {
        effectiveStatus = 'EXPIRED';
      }

      return {
        id: lic.id,
        ownerId: lic.ownerId,
        ownerName: lic.owner.name,
        ownerEmail: lic.owner.email,
        organizationName: lic.owner.organizationName,
        planName: lic.planName,
        licenseType: lic.licenseType,
        status: effectiveStatus,
        durationDays: lic.durationDays,
        maxBranches: lic.maxBranches,
        currentBranches,
        availableBranches: Math.max(0, lic.maxBranches - currentBranches),
        startsAt: lic.startsAt,
        expiresAt: lic.expiresAt,
        daysRemaining,
        assignmentSource: lic.assignmentSource,
        assignedBy: lic.assignedBy,
        reason: lic.reason,
        createdAt: lic.createdAt,
        updatedAt: lic.updatedAt,
        recentHistories: lic.histories,
      };
    });

    return NextResponse.json({ success: true, licenses: formatted });
  } catch (err: any) {
    console.error('List licenses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
