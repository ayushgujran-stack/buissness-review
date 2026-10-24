import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, hashPassword } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find all businesses owned by this owner
    const businesses = await prisma.business.findMany({
      where: session.role === 'OWNER' ? { ownerId: session.userId } : {},
      select: { id: true },
    });
    const bizIds = businesses.map((b) => b.id);

    // Find branchUsers linked to these businesses
    const branchUsers = await prisma.branchUser.findMany({
      where: { businessId: { in: bizIds } },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            phone: true,
            role: true,
            status: true,
            createdAt: true,
          },
        },
        business: {
          select: { id: true, name: true },
        },
        branch: {
          select: { id: true, name: true },
        },
        permissions: true,
      },
    });

    // Group assignments by user
    const userMap = new Map<string, any>();
    for (const bu of branchUsers) {
      if (!userMap.has(bu.user.id)) {
        userMap.set(bu.user.id, {
          ...bu.user,
          assignments: [],
        });
      }
      userMap.get(bu.user.id).assignments.push({
        assignmentId: bu.id,
        businessId: bu.businessId,
        businessName: bu.business.name,
        branchId: bu.branchId,
        branchName: bu.branch ? bu.branch.name : 'All Branches (Super Manager)',
        role: bu.role,
        permissions: bu.permissions.map((p) => p.permission),
      });
    }

    const team = Array.from(userMap.values());

    return NextResponse.json({ success: true, team });
  } catch (err: any) {
    console.error('List team error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, username, password, phone, role, assignments, permissions } = body;

    if (!name || !email || !username || !password || !role) {
      return NextResponse.json({ error: 'Name, email, username, password, and role are required' }, { status: 400 });
    }

    if (role !== 'MANAGER' && role !== 'SUPER_MANAGER') {
      return NextResponse.json({ error: 'Role must be MANAGER or SUPER_MANAGER' }, { status: 400 });
    }

    // Check existing
    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });
    if (existing) {
      return NextResponse.json({ error: 'User with this email or username already exists' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        username,
        passwordHash,
        phone: phone || null,
        role,
        status: 'ACTIVE',
        mustChangePassword: false,
      },
    });

    // Create branch assignments
    // assignments is array of { businessId, branchId }
    const effectivePermissions = permissions && permissions.length > 0
      ? permissions
      : ['VIEW_DASHBOARD', 'VIEW_REVIEWS', 'VIEW_CUSTOMERS', 'VIEW_REPORTS', 'RECEIVE_ALERTS', 'EXPORT_DATA'];

    if (assignments && Array.isArray(assignments)) {
      for (const assign of assignments) {
        if (!assign.businessId) continue;

        const bu = await prisma.branchUser.create({
          data: {
            userId: newUser.id,
            businessId: assign.businessId,
            branchId: assign.branchId || null,
            role,
          },
        });

        for (const perm of effectivePermissions) {
          await prisma.managerPermission.create({
            data: {
              branchUserId: bu.id,
              permission: perm,
              granted: true,
            },
          });
        }
      }
    }

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: newUser.id,
      details: { role, email: newUser.email, name: newUser.name },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (err: any) {
    console.error('Create team user error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
