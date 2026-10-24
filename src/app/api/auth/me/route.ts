import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { getOwnerLicenseStatus } from '@/lib/license';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        phone: true,
        status: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    // Role-specific context
    let license = null;
    let businesses: any[] = [];

    if (user.role === 'OWNER') {
      license = await getOwnerLicenseStatus(user.id);
      businesses = await prisma.business.findMany({
        where: { ownerId: user.id },
        include: {
          branches: {
            select: {
              id: true,
              name: true,
              status: true,
              qrToken: true,
              themeColor: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } else if (user.role === 'MANAGER' || user.role === 'SUPER_MANAGER') {
      // Find businesses and branches assigned
      const assignments = await prisma.branchUser.findMany({
        where: { userId: user.id },
        include: {
          business: {
            include: {
              branches: true,
            },
          },
          branch: true,
          permissions: true,
        },
      });

      // Filter branches strictly based on assignment
      businesses = assignments.map((a) => {
        const b = a.business;
        const permittedBranches = a.branchId
          ? b.branches.filter((br) => br.id === a.branchId)
          : b.branches;
        return {
          ...b,
          branches: permittedBranches,
          assignmentRole: a.role,
          permissions: a.permissions.map((p) => p.permission),
        };
      });
    }

    return NextResponse.json({
      authenticated: true,
      user,
      license,
      businesses,
    });
  } catch (err: any) {
    console.error('Session me error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
