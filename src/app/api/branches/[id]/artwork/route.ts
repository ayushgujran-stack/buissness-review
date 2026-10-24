import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, verifyBranchAccess } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { generatePrintableArtworkHtml, generateQrDataUrl } from '@/lib/qr';

export async function GET(
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

    const origin = req.nextUrl.origin || 'http://localhost:3000';
    const reviewUrl = `${origin}/review/${branch.qrToken}`;
    const qrDataUrl = await generateQrDataUrl(reviewUrl, { width: 600 });

    const html = generatePrintableArtworkHtml({
      businessName: branch.business.name,
      branchName: branch.name,
      category: branch.business.category,
      description: branch.description || branch.business.description || undefined,
      themeColor: branch.themeColor || '#4F46E5',
      qrDataUrl,
      reviewUrl,
    });

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
      },
    });
  } catch (err: any) {
    console.error('Artwork generation error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
