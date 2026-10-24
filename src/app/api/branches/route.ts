import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, verifyBusinessAccess } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { assertCanCreateBranch, getOwnerLicenseStatus } from '@/lib/license';
import { generateSecureToken, generateQrDataUrl } from '@/lib/qr';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const businessId = searchParams.get('businessId');

    if (businessId) {
      const hasAccess = await verifyBusinessAccess(session.userId, session.role, businessId);
      if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    let whereClause: any = {};

    if (session.role === 'OWNER') {
      whereClause.business = { ownerId: session.userId };
      if (businessId) {
        whereClause.businessId = businessId;
      }
    } else if (session.role === 'MANAGER' || session.role === 'SUPER_MANAGER') {
      const assignments = await prisma.branchUser.findMany({
        where: { userId: session.userId },
        select: { branchId: true, businessId: true },
      });
      const branchIds = assignments.filter((a) => a.branchId).map((a) => a.branchId as string);
      const bizIds = assignments.filter((a) => !a.branchId).map((a) => a.businessId);

      const managerConditions: any[] = [];
      if (branchIds.length > 0) {
        managerConditions.push({ id: { in: branchIds } });
      }
      if (bizIds.length > 0) {
        managerConditions.push({ businessId: { in: bizIds } });
      }

      if (managerConditions.length === 0) {
        return NextResponse.json({ success: true, branches: [] });
      }

      whereClause.OR = managerConditions;
      if (businessId) {
        whereClause.businessId = businessId;
      }
    } else if (session.role === 'SUPER_ADMIN' || session.role === 'ADMIN') {
      if (businessId) {
        whereClause.businessId = businessId;
      }
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const branches = await prisma.branch.findMany({
      where: whereClause,
      include: {
        business: {
          select: { id: true, name: true, category: true, ownerId: true },
        },
        qrCodes: {
          where: { active: true },
          take: 1,
        },
        _count: {
          select: { reviews: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, branches });
  } catch (err: any) {
    console.error('List branches error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Only business owners can create branches' }, { status: 403 });
    }

    const data = await req.json();
    const { businessId, name, address, phone, description, logoUrl, themeColor } = data;

    if (!businessId || !name || !address) {
      return NextResponse.json({ error: 'Business ID, branch name, and address are required' }, { status: 400 });
    }

    // Verify ownership of the business
    const business = await prisma.business.findUnique({ where: { id: businessId } });
    if (!business) return NextResponse.json({ error: 'Business not found' }, { status: 404 });

    if (session.role !== 'SUPER_ADMIN' && business.ownerId !== session.userId) {
      return NextResponse.json({ error: 'You do not own this business' }, { status: 403 });
    }

    // SERVER-SIDE LICENSE QUOTA ENFORCEMENT
    // Check total branch capacity across ALL businesses owned by this owner
    try {
      await assertCanCreateBranch(business.ownerId);
    } catch (quotaErr: any) {
      const licenseStatus = await getOwnerLicenseStatus(business.ownerId);
      return NextResponse.json(
        {
          error: quotaErr.message || 'Branch limit reached. Upgrade your license to add another branch.',
          code: 'BRANCH_LIMIT_REACHED',
          currentBranches: licenseStatus.currentBranches,
          maxBranches: licenseStatus.maxBranches,
          status: licenseStatus.status,
        },
        { status: 403 }
      );
    }

    // Generate unique secure public QR token
    const qrToken = generateSecureToken();

    // Create branch
    const branch = await prisma.branch.create({
      data: {
        businessId,
        name,
        address,
        phone: phone || null,
        description: description || null,
        logoUrl: logoUrl || null,
        themeColor: themeColor || '#4F46E5',
        status: 'ACTIVE',
        qrToken,
      },
    });

    // Create active QR code entry
    const publicReviewUrl = `/review/${qrToken}`;
    const qrDataUrl = await generateQrDataUrl(`http://localhost:3000${publicReviewUrl}`);

    await prisma.qrCode.create({
      data: {
        branchId: branch.id,
        token: qrToken,
        targetUrl: publicReviewUrl,
        qrImageUrl: qrDataUrl,
        active: true,
      },
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'BRANCH_CREATED',
      entityType: 'BRANCH',
      entityId: branch.id,
      details: { branchName: branch.name, businessName: business.name, qrToken },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      branch: {
        ...branch,
        reviewUrl: publicReviewUrl,
        qrImageUrl: qrDataUrl,
      },
    });
  } catch (err: any) {
    console.error('Create branch error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
