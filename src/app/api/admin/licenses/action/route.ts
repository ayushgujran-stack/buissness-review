import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import {
  assignTrialLicense,
  assignPaidLicense,
  extendLicense,
  renewLicense,
  changeBranchLimit,
  suspendLicense,
  reactivateLicense,
} from '@/lib/license';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    // Explicit authorization check: Only Super Admin can manage licenses
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized: Only Super Admin is authorized to assign or modify software licenses' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, ownerId, ...params } = body;

    if (!action || !ownerId) {
      return NextResponse.json({ error: 'Action and ownerId are required' }, { status: 400 });
    }

    let result;

    switch (action) {
      case 'ASSIGN_TRIAL': {
        const durationDays = parseInt(params.durationDays || '15', 10);
        const maxBranches = parseInt(params.maxBranches || '5', 10);
        const startDate = params.startDate ? new Date(params.startDate) : new Date();

        result = await assignTrialLicense({
          ownerId,
          durationDays,
          maxBranches,
          startDate,
          assignedBy: session.name,
          reason: params.reason || 'Super Admin assigned trial',
        });
        break;
      }

      case 'ASSIGN_PAID': {
        const durationDays = parseInt(params.durationDays || '365', 10);
        const maxBranches = parseInt(params.maxBranches || '10', 10);
        const startDate = params.startDate ? new Date(params.startDate) : new Date();
        const assignmentSource = params.assignmentSource === 'PAYMENT_GATEWAY' ? 'PAYMENT_GATEWAY' : 'ADMIN_MANUAL';

        result = await assignPaidLicense({
          ownerId,
          planId: params.planId,
          planName: params.planName,
          durationDays,
          maxBranches,
          startDate,
          assignedBy: session.name,
          assignmentSource,
          reason: params.reason,
          paymentDetails: assignmentSource === 'PAYMENT_GATEWAY' ? {
            amount: parseFloat(params.amount || '4999'),
            currency: params.currency || 'INR',
            gatewayTransactionId: params.gatewayTransactionId,
            paymentGateway: params.paymentGateway || 'RAZORPAY',
          } : undefined,
        });
        break;
      }

      case 'EXTEND': {
        const additionalDays = parseInt(params.additionalDays || '30', 10);
        if (additionalDays <= 0) {
          return NextResponse.json({ error: 'Additional days must be greater than 0' }, { status: 400 });
        }
        if (!params.reason) {
          return NextResponse.json({ error: 'Reason is required for extending a license' }, { status: 400 });
        }

        result = await extendLicense({
          ownerId,
          additionalDays,
          assignedBy: session.name,
          reason: params.reason,
        });
        break;
      }

      case 'RENEW': {
        const durationDays = parseInt(params.durationDays || '365', 10);
        const maxBranches = params.maxBranches ? parseInt(params.maxBranches, 10) : undefined;
        if (!params.reason) {
          return NextResponse.json({ error: 'Reason is required for renewing a license' }, { status: 400 });
        }

        result = await renewLicense({
          ownerId,
          durationDays,
          maxBranches,
          assignedBy: session.name,
          reason: params.reason,
          planId: params.planId,
          assignmentSource: params.assignmentSource || 'ADMIN_MANUAL',
        });
        break;
      }

      case 'CHANGE_BRANCH_LIMIT': {
        const newMaxBranches = parseInt(params.newMaxBranches, 10);
        if (isNaN(newMaxBranches) || newMaxBranches < 1) {
          return NextResponse.json({ error: 'New branch limit must be a positive number' }, { status: 400 });
        }
        if (!params.reason) {
          return NextResponse.json({ error: 'Reason is required for modifying branch limit' }, { status: 400 });
        }

        result = await changeBranchLimit({
          ownerId,
          newMaxBranches,
          assignedBy: session.name,
          reason: params.reason,
        });
        break;
      }

      case 'SUSPEND': {
        if (!params.reason) {
          return NextResponse.json({ error: 'Reason is required for suspending a license' }, { status: 400 });
        }

        result = await suspendLicense({
          ownerId,
          assignedBy: session.name,
          reason: params.reason,
        });
        break;
      }

      case 'REACTIVATE': {
        result = await reactivateLicense({
          ownerId,
          assignedBy: session.name,
          reason: params.reason || 'Reactivated by Super Admin',
        });
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `License action ${action} executed successfully`,
      data: result,
    });
  } catch (err: any) {
    console.error('License action error:', err);
    return NextResponse.json({ error: err.message || 'License operation failed' }, { status: 500 });
  }
}
