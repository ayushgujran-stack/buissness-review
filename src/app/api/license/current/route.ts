import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { getOwnerLicenseStatus } from '@/lib/license';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const ownerId = session.role === 'OWNER' ? session.userId : (new URL(req.url).searchParams.get('ownerId') || session.userId);

    const licenseStatus = await getOwnerLicenseStatus(ownerId);

    // Also get payment history and invoices
    const payments = await prisma.payment.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    return NextResponse.json({
      success: true,
      license: licenseStatus,
      payments,
    });
  } catch (err: any) {
    console.error('License status error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
