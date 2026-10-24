import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, verifyBranchAccess } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generateSecureToken, generateQrDataUrl } from '@/lib/qr';
import { logAuditEvent } from '@/lib/audit';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: branchId } = await context.params;

    const hasAccess = await verifyBranchAccess(session.userId, session.role, branchId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { business: true },
    });
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    // Generate new token
    const newToken = generateSecureToken();
    const publicUrl = `/review/${newToken}`;
    const qrDataUrl = await generateQrDataUrl(`http://localhost:3000${publicUrl}`);

    // Update branch qrToken
    await prisma.branch.update({
      where: { id: branchId },
      data: { qrToken: newToken },
    });

    // Mark old QR inactive, insert new active QR
    await prisma.qrCode.updateMany({
      where: { branchId },
      data: { active: false },
    });

    const qrRecord = await prisma.qrCode.create({
      data: {
        branchId,
        token: newToken,
        targetUrl: publicUrl,
        qrImageUrl: qrDataUrl,
        active: true,
      },
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'QR_REGENERATED',
      entityType: 'QR_CODE',
      entityId: qrRecord.id,
      details: { branchName: branch.name, businessName: branch.business.name, newToken },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({
      success: true,
      token: newToken,
      reviewUrl: publicUrl,
      qrImageUrl: qrDataUrl,
    });
  } catch (err: any) {
    console.error('Regenerate QR error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
