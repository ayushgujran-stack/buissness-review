import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hashPassword } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const owners = await prisma.user.findMany({
      where: { role: 'OWNER' },
      include: {
        businesses: {
          include: {
            branches: { select: { id: true, name: true, status: true } },
          },
        },
        licenses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { payments: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = owners.map((o) => {
      const activeLicense = o.licenses[0];
      const totalBranches = o.businesses.reduce((acc, b) => acc + b.branches.length, 0);

      return {
        id: o.id,
        name: o.name,
        email: o.email,
        username: o.username,
        phone: o.phone,
        status: o.status,
        createdAt: o.createdAt,
        totalBusinesses: o.businesses.length,
        totalBranches,
        license: activeLicense
          ? {
              planName: activeLicense.planName,
              maxBranches: activeLicense.maxBranches,
              status: activeLicense.status,
              expiresAt: activeLicense.expiresAt,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, owners: formatted });
  } catch (err: any) {
    console.error('List owners error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can modify owner status' }, { status: 403 });
    }

    const { ownerId, status } = await req.json();

    if (!ownerId || !status) {
      return NextResponse.json({ error: 'ownerId and status are required' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: ownerId },
      data: { status },
    });

    // If suspended, also cascade suspend owner's businesses
    if (status === 'SUSPENDED') {
      await prisma.business.updateMany({
        where: { ownerId },
        data: { status: 'SUSPENDED' },
      });
    } else if (status === 'ACTIVE') {
      await prisma.business.updateMany({
        where: { ownerId },
        data: { status: 'ACTIVE' },
      });
    }

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: status === 'SUSPENDED' ? 'OWNER_SUSPENDED' : 'OWNER_ACTIVATED',
      entityType: 'USER',
      entityId: ownerId,
      details: { newStatus: status },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (err: any) {
    console.error('Update owner error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
