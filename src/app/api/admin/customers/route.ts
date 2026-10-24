import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getSessionUser, hashPassword } from '@/lib/auth';
import { assignTrialLicense, assignPaidLicense, getOwnerLicenseStatus } from '@/lib/license';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const customers = await prisma.user.findMany({
      where: { role: 'OWNER' },
      include: {
        businesses: {
          include: {
            branches: {
              where: { status: { not: 'INACTIVE' } },
              select: { id: true, name: true, status: true },
            },
          },
        },
        licenses: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: { payments: true, businesses: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const now = new Date();
    const formatted = customers.map((c) => {
      const activeLicense = c.licenses[0];
      const totalBranches = c.businesses.reduce((acc, b) => acc + b.branches.length, 0);

      let daysRemaining = 0;
      let effectiveStatus = activeLicense ? activeLicense.status : 'NO_LICENSE';
      if (activeLicense) {
        const diff = new Date(activeLicense.expiresAt).getTime() - now.getTime();
        daysRemaining = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
        if (diff <= 0 && activeLicense.status !== 'SUSPENDED') {
          effectiveStatus = 'EXPIRED';
        }
      }

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        username: c.username,
        phone: c.phone,
        organizationName: c.organizationName,
        address: c.address,
        status: c.status,
        createdAt: c.createdAt,
        totalBusinesses: c.businesses.length,
        totalBranches,
        license: activeLicense
          ? {
              id: activeLicense.id,
              planName: activeLicense.planName,
              licenseType: activeLicense.licenseType,
              status: effectiveStatus,
              maxBranches: activeLicense.maxBranches,
              durationDays: activeLicense.durationDays,
              startsAt: activeLicense.startsAt,
              expiresAt: activeLicense.expiresAt,
              daysRemaining,
              assignmentSource: activeLicense.assignmentSource,
              assignedBy: activeLicense.assignedBy,
            }
          : null,
      };
    });

    return NextResponse.json({ success: true, customers: formatted });
  } catch (err: any) {
    console.error('List customers error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    // Explicit authorization check: Super Admin only
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized: Only Super Admin can provision new customers and assign licenses' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      email,
      phone,
      organizationName,
      address,
      status = 'ACTIVE',
      password,
      licenseOption = 'NONE', // 'TRIAL' | 'PAID' | 'NONE'
      trialDetails,
      paidDetails,
    } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Full name is required' }, { status: 400 });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      return NextResponse.json({ error: 'Mobile number is required' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedMobile = phone.trim();

    // Check for duplicate email
    const existingEmail = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingEmail) {
      return NextResponse.json({ error: 'A user account with this email address already exists' }, { status: 400 });
    }

    // Generate unique username from email
    const baseUsername = normalizedEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '');
    let username = baseUsername;
    let counter = 1;
    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    // Secure temporary password or provided password (never store plaintext)
    const rawPassword = password?.trim() || crypto.randomBytes(8).toString('hex') + 'A1!';
    const passwordHash = await hashPassword(rawPassword);

    // Run creation in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create User with role OWNER
      const customer = await tx.user.create({
        data: {
          email: normalizedEmail,
          username,
          passwordHash,
          name: name.trim(),
          phone: normalizedMobile,
          organizationName: organizationName?.trim() || null,
          address: address?.trim() || null,
          role: 'OWNER',
          status: status || 'ACTIVE',
          mustChangePassword: true,
        },
      });

      // 2. Audit Customer Account Creation
      await tx.auditLog.create({
        data: {
          userId: session.userId,
          userName: session.name,
          role: session.role,
          action: 'CUSTOMER_ACCOUNT_CREATED',
          entityType: 'USER',
          entityId: customer.id,
          details: JSON.stringify({
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            organizationName: customer.organizationName,
            status: customer.status,
            role: 'OWNER',
            licenseOption,
          }),
        },
      });

      return customer;
    });

    let assignedLicense: any = null;

    // 3. Handle License Assignment
    if (licenseOption === 'TRIAL') {
      const durationDays = parseInt(trialDetails?.durationDays || '15', 10);
      const maxBranches = parseInt(trialDetails?.maxBranches || '5', 10);
      const startDate = trialDetails?.startDate ? new Date(trialDetails.startDate) : new Date();

      assignedLicense = await assignTrialLicense({
        ownerId: result.id,
        durationDays,
        maxBranches,
        startDate,
        assignedBy: session.name,
        reason: trialDetails?.reason || 'Super Admin initial trial license grant',
      });
    } else if (licenseOption === 'PAID') {
      const durationDays = parseInt(paidDetails?.durationDays || '365', 10);
      const maxBranches = parseInt(paidDetails?.maxBranches || '10', 10);
      const startDate = paidDetails?.startDate ? new Date(paidDetails.startDate) : new Date();
      const assignmentSource = paidDetails?.assignmentSource === 'PAYMENT_GATEWAY' ? 'PAYMENT_GATEWAY' : 'ADMIN_MANUAL';

      assignedLicense = await assignPaidLicense({
        ownerId: result.id,
        planName: paidDetails?.planName || `Paid Plan (${durationDays} Days, ${maxBranches} Branches)`,
        durationDays,
        maxBranches,
        startDate,
        assignedBy: session.name,
        assignmentSource,
        reason: paidDetails?.reason || (assignmentSource === 'PAYMENT_GATEWAY' ? 'Payment verified' : 'Manual administrative entitlement'),
        paymentDetails: assignmentSource === 'PAYMENT_GATEWAY' ? {
          amount: parseFloat(paidDetails?.amount || '4999'),
          currency: paidDetails?.currency || 'INR',
          gatewayTransactionId: paidDetails?.gatewayTransactionId,
          paymentGateway: paidDetails?.paymentGateway || 'RAZORPAY',
        } : undefined,
      });
    }

    // Build activation invitation details (secure token, temporary credentials for handoff)
    const activationToken = crypto.randomBytes(24).toString('hex');
    const activationUrl = `/auth/activate?token=${activationToken}&email=${encodeURIComponent(result.email)}`;

    return NextResponse.json({
      success: true,
      message: 'Customer provisioned successfully',
      customer: {
        id: result.id,
        name: result.name,
        email: result.email,
        username: result.username,
        phone: result.phone,
        organizationName: result.organizationName,
        address: result.address,
        status: result.status,
        role: result.role,
        createdAt: result.createdAt,
      },
      license: assignedLicense,
      activation: {
        temporaryPassword: rawPassword,
        activationUrl,
        username: result.username,
        email: result.email,
      },
    });
  } catch (err: any) {
    console.error('Customer provisioning error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create customer' }, { status: 500 });
  }
}
