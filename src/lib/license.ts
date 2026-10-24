import prisma from './prisma';
import { logAuditEvent } from './audit';

export interface LicenseStatus {
  hasActiveLicense: boolean;
  status: 'TRIAL' | 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'NO_LICENSE';
  licenseType: string;
  planName: string;
  maxBranches: number;
  currentBranches: number;
  availableBranches: number;
  canCreateBranch: boolean;
  daysRemaining: number;
  isTrial: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  warningLevel: 'NONE' | '30_DAYS' | '15_DAYS' | '7_DAYS' | '3_DAYS' | 'EXPIRED';
  assignmentSource?: string;
  assignedBy?: string | null;
  reason?: string | null;
  licenseId?: string;
}

export async function getOwnerLicenseStatus(ownerId: string): Promise<LicenseStatus> {
  const currentBranches = await prisma.branch.count({
    where: {
      business: { ownerId },
      status: { not: 'INACTIVE' },
    },
  });

  const license = await prisma.license.findFirst({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
  });

  const now = new Date();

  if (!license) {
    return {
      hasActiveLicense: false,
      status: 'NO_LICENSE',
      licenseType: 'NONE',
      planName: 'None',
      maxBranches: 0,
      currentBranches,
      availableBranches: 0,
      canCreateBranch: false,
      daysRemaining: 0,
      isTrial: false,
      startsAt: null,
      expiresAt: null,
      warningLevel: 'EXPIRED',
    };
  }

  const expiresAt = new Date(license.expiresAt);
  const diffTime = expiresAt.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  const isExpired = diffTime <= 0;

  let warningLevel: LicenseStatus['warningLevel'] = 'NONE';
  if (isExpired) warningLevel = 'EXPIRED';
  else if (daysRemaining <= 3) warningLevel = '3_DAYS';
  else if (daysRemaining <= 7) warningLevel = '7_DAYS';
  else if (daysRemaining <= 15) warningLevel = '15_DAYS';
  else if (daysRemaining <= 30) warningLevel = '30_DAYS';

  let effectiveStatus: LicenseStatus['status'] = license.status as LicenseStatus['status'];
  if (isExpired && license.status !== 'SUSPENDED') {
    effectiveStatus = 'EXPIRED';
  }

  const hasActiveLicense = !isExpired && effectiveStatus !== 'SUSPENDED';
  const canCreateBranch = hasActiveLicense && currentBranches < license.maxBranches;

  return {
    hasActiveLicense,
    status: effectiveStatus,
    licenseType: license.licenseType,
    planName: license.planName,
    maxBranches: license.maxBranches,
    currentBranches,
    availableBranches: Math.max(0, license.maxBranches - currentBranches),
    canCreateBranch,
    daysRemaining,
    isTrial: license.licenseType === 'TRIAL' || license.status === 'TRIAL',
    startsAt: license.startsAt,
    expiresAt: license.expiresAt,
    warningLevel,
    assignmentSource: license.assignmentSource,
    assignedBy: license.assignedBy,
    reason: license.reason,
    licenseId: license.id,
  };
}

export async function assertCanCreateBranch(ownerId: string): Promise<void> {
  const status = await getOwnerLicenseStatus(ownerId);
  if (!status.hasActiveLicense) {
    if (status.status === 'EXPIRED') {
      throw new Error('Your ReviewFlow license has expired. Please renew your subscription to add another branch.');
    }
    if (status.status === 'SUSPENDED') {
      throw new Error('Your ReviewFlow license has been suspended. Please contact administrator.');
    }
    throw new Error('No active license found. Protected application access remains disabled until a license is assigned.');
  }

  if (status.currentBranches >= status.maxBranches) {
    throw new Error(
      `Your license allows ${status.maxBranches} branches, and you are already using all ${status.currentBranches}. Upgrade your license to add another branch.`
    );
  }
}

export async function assertOwnerLicenseActive(ownerId: string): Promise<LicenseStatus> {
  const status = await getOwnerLicenseStatus(ownerId);
  if (!status.hasActiveLicense) {
    if (status.status === 'EXPIRED') {
      throw new Error('Your ReviewFlow license has expired. All data is preserved, but access is restricted until renewed.');
    }
    if (status.status === 'SUSPENDED') {
      throw new Error('Your ReviewFlow license has been suspended by an administrator.');
    }
    throw new Error('No active license assigned to this account.');
  }
  return status;
}

// ----------------------------------------------------
// Super Admin License Assignment & Modification Helpers
// ----------------------------------------------------

export async function assignTrialLicense(params: {
  ownerId: string;
  durationDays: number;
  maxBranches: number;
  startDate?: Date;
  assignedBy: string;
  reason?: string;
}) {
  const startsAt = params.startDate || new Date();
  const expiresAt = new Date(startsAt.getTime() + params.durationDays * 24 * 60 * 60 * 1000);

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.license.findFirst({
      where: { ownerId: params.ownerId },
      orderBy: { createdAt: 'desc' },
    });

    const license = await tx.license.create({
      data: {
        ownerId: params.ownerId,
        planName: `Trial Plan (${params.durationDays} Days, ${params.maxBranches} Branches)`,
        licenseType: 'TRIAL',
        status: 'TRIAL',
        maxBranches: params.maxBranches,
        durationDays: params.durationDays,
        startsAt,
        expiresAt,
        assignmentSource: 'ADMIN_MANUAL',
        assignedBy: params.assignedBy,
        reason: params.reason || 'Admin trial grant',
      },
    });

    await tx.licenseHistory.create({
      data: {
        licenseId: license.id,
        ownerId: params.ownerId,
        action: 'TRIAL_ASSIGNED',
        previousValues: existing ? JSON.stringify({
          planName: existing.planName,
          status: existing.status,
          maxBranches: existing.maxBranches,
          expiresAt: existing.expiresAt,
        }) : null,
        newValues: JSON.stringify({
          planName: license.planName,
          status: license.status,
          maxBranches: license.maxBranches,
          durationDays: license.durationDays,
          startsAt: license.startsAt,
          expiresAt: license.expiresAt,
        }),
        reason: params.reason || 'Trial license assigned by Super Admin',
        performedBy: params.assignedBy,
      },
    });

    await tx.auditLog.create({
      data: {
        userName: params.assignedBy,
        role: 'SUPER_ADMIN',
        action: 'ASSIGN_TRIAL_LICENSE',
        entityType: 'LICENSE',
        entityId: license.id,
        details: JSON.stringify({
          ownerId: params.ownerId,
          durationDays: params.durationDays,
          maxBranches: params.maxBranches,
          expiresAt,
          reason: params.reason,
        }),
      },
    });

    return license;
  });
}

export async function assignPaidLicense(params: {
  ownerId: string;
  planId?: string;
  planName?: string;
  durationDays: number;
  maxBranches: number;
  startDate?: Date;
  assignedBy: string;
  assignmentSource: 'PAYMENT_GATEWAY' | 'ADMIN_MANUAL';
  reason?: string;
  paymentDetails?: {
    amount: number;
    currency?: string;
    gatewayTransactionId?: string;
    paymentGateway?: string;
  };
}) {
  const startsAt = params.startDate || new Date();
  const expiresAt = new Date(startsAt.getTime() + params.durationDays * 24 * 60 * 60 * 1000);

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.license.findFirst({
      where: { ownerId: params.ownerId },
      orderBy: { createdAt: 'desc' },
    });

    const license = await tx.license.create({
      data: {
        ownerId: params.ownerId,
        planId: params.planId || null,
        planName: params.planName || `Paid Plan (${params.durationDays} Days, ${params.maxBranches} Branches)`,
        licenseType: 'PAID',
        status: 'ACTIVE',
        maxBranches: params.maxBranches,
        durationDays: params.durationDays,
        startsAt,
        expiresAt,
        assignmentSource: params.assignmentSource,
        assignedBy: params.assignedBy,
        reason: params.reason || (params.assignmentSource === 'PAYMENT_GATEWAY' ? 'Payment Verified' : 'Manual Entitlement'),
      },
    });

    let paymentId: string | undefined;
    if (params.paymentDetails && params.assignmentSource === 'PAYMENT_GATEWAY') {
      const now = new Date();
      const p = await tx.payment.create({
        data: {
          ownerId: params.ownerId,
          licenseId: license.id,
          amount: params.paymentDetails.amount,
          currency: params.paymentDetails.currency || 'INR',
          gateway: params.paymentDetails.paymentGateway || 'RAZORPAY',
          transactionId: params.paymentDetails.gatewayTransactionId || `PAY-${Date.now()}`,
          gatewayTransactionId: params.paymentDetails.gatewayTransactionId || `GTX-${Date.now()}`,
          status: 'SUCCESS',
          paymentStatus: 'SUCCESS',
          verifiedAt: now,
          invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          paymentMethod: 'GATEWAY_VERIFIED',
          notes: `Verified payment for ${license.planName}`,
        },
      });
      paymentId = p.id;
    }

    await tx.licenseHistory.create({
      data: {
        licenseId: license.id,
        ownerId: params.ownerId,
        action: params.assignmentSource === 'PAYMENT_GATEWAY' ? 'PAID_ACTIVATED_PAYMENT' : 'PAID_ACTIVATED_MANUAL',
        previousValues: existing ? JSON.stringify({
          planName: existing.planName,
          status: existing.status,
          maxBranches: existing.maxBranches,
          expiresAt: existing.expiresAt,
        }) : null,
        newValues: JSON.stringify({
          planName: license.planName,
          status: license.status,
          maxBranches: license.maxBranches,
          durationDays: license.durationDays,
          startsAt: license.startsAt,
          expiresAt: license.expiresAt,
          assignmentSource: params.assignmentSource,
          paymentId,
        }),
        reason: params.reason || (params.assignmentSource === 'PAYMENT_GATEWAY' ? 'Payment verified' : 'Manual administrative entitlement granted'),
        performedBy: params.assignedBy,
      },
    });

    await tx.auditLog.create({
      data: {
        userName: params.assignedBy,
        role: 'SUPER_ADMIN',
        action: params.assignmentSource === 'PAYMENT_GATEWAY' ? 'PAID_LICENSE_PAYMENT_ACTIVATED' : 'ADMINISTRATIVE_ENTITLEMENT_GRANTED',
        entityType: 'LICENSE',
        entityId: license.id,
        details: JSON.stringify({
          ownerId: params.ownerId,
          durationDays: params.durationDays,
          maxBranches: params.maxBranches,
          assignmentSource: params.assignmentSource,
          reason: params.reason,
          paymentId,
        }),
      },
    });

    return license;
  });
}

export async function extendLicense(params: {
  ownerId: string;
  additionalDays: number;
  assignedBy: string;
  reason: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.license.findFirst({
      where: { ownerId: params.ownerId },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      throw new Error('No license exists for this customer to extend.');
    }

    const currentExpiry = new Date(existing.expiresAt);
    const baseDate = currentExpiry.getTime() > Date.now() ? currentExpiry : new Date();
    const newExpiresAt = new Date(baseDate.getTime() + params.additionalDays * 24 * 60 * 60 * 1000);
    const newDurationDays = existing.durationDays + params.additionalDays;

    const updated = await tx.license.update({
      where: { id: existing.id },
      data: {
        expiresAt: newExpiresAt,
        durationDays: newDurationDays,
        status: existing.status === 'EXPIRED' ? (existing.licenseType === 'TRIAL' ? 'TRIAL' : 'ACTIVE') : existing.status,
        updatedAt: new Date(),
      },
    });

    await tx.licenseHistory.create({
      data: {
        licenseId: existing.id,
        ownerId: params.ownerId,
        action: 'LICENSE_EXTENDED',
        previousValues: JSON.stringify({
          expiresAt: existing.expiresAt,
          durationDays: existing.durationDays,
          status: existing.status,
        }),
        newValues: JSON.stringify({
          expiresAt: updated.expiresAt,
          durationDays: updated.durationDays,
          status: updated.status,
          extendedByDays: params.additionalDays,
        }),
        reason: params.reason,
        performedBy: params.assignedBy,
      },
    });

    await tx.auditLog.create({
      data: {
        userName: params.assignedBy,
        role: 'SUPER_ADMIN',
        action: 'EXTEND_LICENSE',
        entityType: 'LICENSE',
        entityId: existing.id,
        details: JSON.stringify({
          ownerId: params.ownerId,
          additionalDays: params.additionalDays,
          oldExpiry: existing.expiresAt,
          newExpiry: updated.expiresAt,
          reason: params.reason,
        }),
      },
    });

    return updated;
  });
}

export async function renewLicense(params: {
  ownerId: string;
  durationDays: number;
  maxBranches?: number;
  assignedBy: string;
  reason: string;
  planId?: string;
  assignmentSource?: 'PAYMENT_GATEWAY' | 'ADMIN_MANUAL';
}) {
  const startsAt = new Date();
  const expiresAt = new Date(startsAt.getTime() + params.durationDays * 24 * 60 * 60 * 1000);

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.license.findFirst({
      where: { ownerId: params.ownerId },
      orderBy: { createdAt: 'desc' },
    });

    const maxBranches = params.maxBranches || (existing ? existing.maxBranches : 5);

    const license = await tx.license.create({
      data: {
        ownerId: params.ownerId,
        planId: params.planId || null,
        planName: `Renewed Plan (${params.durationDays} Days, ${maxBranches} Branches)`,
        licenseType: 'PAID',
        status: 'ACTIVE',
        maxBranches,
        durationDays: params.durationDays,
        startsAt,
        expiresAt,
        assignmentSource: params.assignmentSource || 'ADMIN_MANUAL',
        assignedBy: params.assignedBy,
        reason: params.reason,
      },
    });

    await tx.licenseHistory.create({
      data: {
        licenseId: license.id,
        ownerId: params.ownerId,
        action: 'LICENSE_RENEWED',
        previousValues: existing ? JSON.stringify({
          licenseId: existing.id,
          status: existing.status,
          expiresAt: existing.expiresAt,
          maxBranches: existing.maxBranches,
        }) : null,
        newValues: JSON.stringify({
          licenseId: license.id,
          status: license.status,
          expiresAt: license.expiresAt,
          maxBranches: license.maxBranches,
          durationDays: license.durationDays,
        }),
        reason: params.reason,
        performedBy: params.assignedBy,
      },
    });

    await tx.auditLog.create({
      data: {
        userName: params.assignedBy,
        role: 'SUPER_ADMIN',
        action: 'RENEW_LICENSE',
        entityType: 'LICENSE',
        entityId: license.id,
        details: JSON.stringify({
          ownerId: params.ownerId,
          durationDays: params.durationDays,
          maxBranches,
          reason: params.reason,
        }),
      },
    });

    return license;
  });
}

export async function changeBranchLimit(params: {
  ownerId: string;
  newMaxBranches: number;
  assignedBy: string;
  reason: string;
}) {
  if (params.newMaxBranches < 1) {
    throw new Error('Branch limit must be at least 1.');
  }

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.license.findFirst({
      where: { ownerId: params.ownerId },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      throw new Error('No active license exists for this customer.');
    }

    const previousLimit = existing.maxBranches;
    const updated = await tx.license.update({
      where: { id: existing.id },
      data: {
        maxBranches: params.newMaxBranches,
        updatedAt: new Date(),
      },
    });

    await tx.licenseHistory.create({
      data: {
        licenseId: existing.id,
        ownerId: params.ownerId,
        action: 'BRANCH_LIMIT_CHANGED',
        previousValues: JSON.stringify({ maxBranches: previousLimit }),
        newValues: JSON.stringify({ maxBranches: params.newMaxBranches }),
        reason: params.reason,
        performedBy: params.assignedBy,
      },
    });

    await tx.auditLog.create({
      data: {
        userName: params.assignedBy,
        role: 'SUPER_ADMIN',
        action: 'CHANGE_BRANCH_LIMIT',
        entityType: 'LICENSE',
        entityId: existing.id,
        details: JSON.stringify({
          ownerId: params.ownerId,
          previousLimit,
          newLimit: params.newMaxBranches,
          reason: params.reason,
        }),
      },
    });

    return updated;
  });
}

export async function suspendLicense(params: {
  ownerId: string;
  assignedBy: string;
  reason: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.license.findFirst({
      where: { ownerId: params.ownerId },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      throw new Error('No license exists for this customer.');
    }

    const previousStatus = existing.status;
    const updated = await tx.license.update({
      where: { id: existing.id },
      data: {
        status: 'SUSPENDED',
        reason: params.reason,
        updatedAt: new Date(),
      },
    });

    await tx.licenseHistory.create({
      data: {
        licenseId: existing.id,
        ownerId: params.ownerId,
        action: 'LICENSE_SUSPENDED',
        previousValues: JSON.stringify({ status: previousStatus }),
        newValues: JSON.stringify({ status: 'SUSPENDED' }),
        reason: params.reason,
        performedBy: params.assignedBy,
      },
    });

    await tx.auditLog.create({
      data: {
        userName: params.assignedBy,
        role: 'SUPER_ADMIN',
        action: 'SUSPEND_LICENSE',
        entityType: 'LICENSE',
        entityId: existing.id,
        details: JSON.stringify({
          ownerId: params.ownerId,
          previousStatus,
          reason: params.reason,
        }),
      },
    });

    return updated;
  });
}

export async function reactivateLicense(params: {
  ownerId: string;
  assignedBy: string;
  reason: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.license.findFirst({
      where: { ownerId: params.ownerId },
      orderBy: { createdAt: 'desc' },
    });

    if (!existing) {
      throw new Error('No license exists for this customer.');
    }

    const now = new Date();
    const isExpired = new Date(existing.expiresAt).getTime() <= now.getTime();
    const restoredStatus = isExpired ? 'EXPIRED' : (existing.licenseType === 'TRIAL' ? 'TRIAL' : 'ACTIVE');

    const updated = await tx.license.update({
      where: { id: existing.id },
      data: {
        status: restoredStatus,
        reason: params.reason,
        updatedAt: new Date(),
      },
    });

    await tx.licenseHistory.create({
      data: {
        licenseId: existing.id,
        ownerId: params.ownerId,
        action: 'LICENSE_REACTIVATED',
        previousValues: JSON.stringify({ status: existing.status }),
        newValues: JSON.stringify({ status: restoredStatus }),
        reason: params.reason,
        performedBy: params.assignedBy,
      },
    });

    await tx.auditLog.create({
      data: {
        userName: params.assignedBy,
        role: 'SUPER_ADMIN',
        action: 'REACTIVATE_LICENSE',
        entityType: 'LICENSE',
        entityId: existing.id,
        details: JSON.stringify({
          ownerId: params.ownerId,
          restoredStatus,
          reason: params.reason,
        }),
      },
    });

    return updated;
  });
}
