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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';

    const payments = await prisma.payment.findMany({
      where: search ? {
        OR: [
          { invoiceNumber: { contains: search } },
          { transactionId: { contains: search } },
          { owner: { name: { contains: search } } },
          { owner: { email: { contains: search } } },
        ]
      } : {},
      include: {
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            organizationName: true,
          },
        },
        license: {
          select: {
            id: true,
            planName: true,
            licenseType: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, payments });
  } catch (err: any) {
    console.error('List payments error:', err);
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
    const { ownerId, licenseId, amount, currency = 'INR', gateway = 'RAZORPAY', gatewayTransactionId, notes } = body;

    if (!ownerId || !amount) {
      return NextResponse.json({ error: 'ownerId and amount are required' }, { status: 400 });
    }

    const now = new Date();
    const invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const txId = gatewayTransactionId || `PAY-${Date.now()}`;

    const payment = await prisma.payment.create({
      data: {
        ownerId,
        licenseId: licenseId || null,
        amount: parseFloat(amount),
        currency,
        gateway,
        transactionId: txId,
        gatewayTransactionId: gatewayTransactionId || txId,
        status: 'SUCCESS',
        paymentStatus: 'SUCCESS',
        verifiedAt: now,
        invoiceNumber,
        notes: notes || 'Verified Super Admin payment record',
      },
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'PAYMENT_RECORDED',
      entityType: 'PAYMENT',
      entityId: payment.id,
      details: { ownerId, amount, currency, invoiceNumber, gatewayTransactionId },
    });

    return NextResponse.json({ success: true, payment });
  } catch (err: any) {
    console.error('Record payment error:', err);
    return NextResponse.json({ error: err.message || 'Failed to record payment' }, { status: 500 });
  }
}
