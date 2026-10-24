import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { getOwnerLicenseStatus } from '@/lib/license';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const { id } = await context.params;

    const customer = await prisma.user.findUnique({
      where: { id },
      include: {
        businesses: {
          include: {
            branches: {
              where: { status: { not: 'INACTIVE' } },
              include: {
                _count: { select: { reviews: true } },
              },
            },
          },
        },
        licenses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        licenseHistories: {
          orderBy: { createdAt: 'desc' },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer || customer.role !== 'OWNER') {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // License status computation
    const licenseStatus = await getOwnerLicenseStatus(customer.id);
    const totalBusinesses = customer.businesses.length;
    const totalBranches = customer.businesses.reduce((acc, b) => acc + b.branches.length, 0);

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        username: customer.username,
        phone: customer.phone,
        organizationName: customer.organizationName,
        address: customer.address,
        status: customer.status,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt,
      },
      metrics: {
        totalBusinesses,
        totalBranches,
        branchLimit: licenseStatus.maxBranches,
        availableBranches: licenseStatus.availableBranches,
        canCreateBranch: licenseStatus.canCreateBranch,
      },
      license: {
        id: licenseStatus.licenseId,
        type: licenseStatus.licenseType,
        planName: licenseStatus.planName,
        status: licenseStatus.status,
        maxBranches: licenseStatus.maxBranches,
        startsAt: licenseStatus.startsAt,
        expiresAt: licenseStatus.expiresAt,
        daysRemaining: licenseStatus.daysRemaining,
        isTrial: licenseStatus.isTrial,
        assignmentSource: licenseStatus.assignmentSource,
        assignedBy: licenseStatus.assignedBy,
        reason: licenseStatus.reason,
      },
      licenseHistory: customer.licenseHistories.map((h) => ({
        id: h.id,
        action: h.action,
        previousValues: h.previousValues ? JSON.parse(h.previousValues) : null,
        newValues: h.newValues ? JSON.parse(h.newValues) : null,
        reason: h.reason,
        performedBy: h.performedBy,
        createdAt: h.createdAt,
      })),
      payments: customer.payments.map((p) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        gateway: p.gateway,
        transactionId: p.transactionId,
        gatewayTransactionId: p.gatewayTransactionId,
        status: p.status,
        invoiceNumber: p.invoiceNumber,
        verifiedAt: p.verifiedAt,
        createdAt: p.createdAt,
      })),
      businesses: customer.businesses.map((b) => ({
        id: b.id,
        name: b.name,
        category: b.category,
        status: b.status,
        branchCount: b.branches.length,
        branches: b.branches.map((br) => ({
          id: br.id,
          name: br.name,
          address: br.address,
          status: br.status,
          reviewCount: br._count.reviews,
          qrToken: br.qrToken,
        })),
      })),
    });
  } catch (err: any) {
    console.error('Customer details error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Only Super Admin can modify customer records' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await req.json();
    const { name, phone, organizationName, address, status } = body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing || existing.role !== 'OWNER') {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: name !== undefined ? name.trim() : existing.name,
        phone: phone !== undefined ? phone.trim() : existing.phone,
        organizationName: organizationName !== undefined ? organizationName.trim() : existing.organizationName,
        address: address !== undefined ? address.trim() : existing.address,
        status: status !== undefined ? status : existing.status,
      },
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'CUSTOMER_PROFILE_UPDATED',
      entityType: 'USER',
      entityId: id,
      details: {
        previous: {
          name: existing.name,
          phone: existing.phone,
          status: existing.status,
        },
        updated: {
          name: updated.name,
          phone: updated.phone,
          status: updated.status,
        },
      },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({ success: true, customer: updated });
  } catch (err: any) {
    console.error('Update customer error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update customer' }, { status: 500 });
  }
}
