import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, verifyBranchAccess } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;

    const review = await prisma.review.findUnique({
      where: { id },
      include: {
        customer: true,
        business: true,
        branch: true,
        answers: true,
      },
    });

    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    const hasAccess = await verifyBranchAccess(session.userId, session.role, review.branchId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    return NextResponse.json({ success: true, review });
  } catch (err: any) {
    console.error('Get review error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;
    const { status, notes } = await req.json();

    const review = await prisma.review.findUnique({
      where: { id },
      include: { branch: true },
    });

    if (!review) return NextResponse.json({ error: 'Review not found' }, { status: 404 });

    const hasAccess = await verifyBranchAccess(session.userId, session.role, review.branchId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const updated = await prisma.review.update({
      where: { id },
      data: {
        status: status || review.status,
        notes: notes !== undefined ? notes : review.notes,
      },
    });

    // Also mark associated notification resolved if resolved
    if (status === 'RESOLVED') {
      await prisma.notification.updateMany({
        where: { reviewId: id },
        data: { status: 'RESOLVED' },
      });
    }

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'REVIEW_STATUS_UPDATED',
      entityType: 'REVIEW',
      entityId: id,
      details: { status, notes },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({ success: true, review: updated });
  } catch (err: any) {
    console.error('Update review error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
