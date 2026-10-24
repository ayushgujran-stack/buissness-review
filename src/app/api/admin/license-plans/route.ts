import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSessionUser } from '@/lib/auth';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 403 });
    }

    const plans = await prisma.licensePlan.findMany({
      orderBy: { price: 'asc' },
      include: {
        _count: { select: { licenses: true } },
      },
    });

    return NextResponse.json({ success: true, plans });
  } catch (err: any) {
    console.error('List license plans error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Unauthorized: Super Admin required' }, { status: 403 });
    }

    const body = await req.json();
    const { name, code, licenseType = 'PAID', durationDays, maxBranches, price, currency = 'INR', features = '[]', isTrial = false } = body;

    if (!name || !code || !durationDays || !maxBranches) {
      return NextResponse.json({ error: 'Name, code, durationDays, and maxBranches are required' }, { status: 400 });
    }

    const plan = await prisma.licensePlan.create({
      data: {
        name,
        code: code.toUpperCase().trim(),
        licenseType,
        durationDays: parseInt(durationDays, 10),
        maxBranches: parseInt(maxBranches, 10),
        price: parseFloat(price || '0'),
        currency,
        features: typeof features === 'string' ? features : JSON.stringify(features),
        isTrial: Boolean(isTrial),
        active: true,
      },
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'LICENSE_PLAN_CREATED',
      entityType: 'LICENSE_PLAN',
      entityId: plan.id,
      details: { name: plan.name, code: plan.code, maxBranches: plan.maxBranches, durationDays: plan.durationDays },
    });

    return NextResponse.json({ success: true, plan });
  } catch (err: any) {
    console.error('Create plan error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create plan' }, { status: 500 });
  }
}
