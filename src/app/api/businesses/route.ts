import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let whereClause: any = {};
    if (session.role === 'OWNER') {
      whereClause.ownerId = session.userId;
    } else if (session.role === 'MANAGER' || session.role === 'SUPER_MANAGER') {
      const assignments = await prisma.branchUser.findMany({
        where: { userId: session.userId },
        select: { businessId: true },
      });
      const bIds = assignments.map((a) => a.businessId);
      whereClause.id = { in: bIds };
    } else if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const businesses = await prisma.business.findMany({
      where: whereClause,
      include: {
        branches: {
          select: {
            id: true,
            name: true,
            status: true,
            qrToken: true,
            themeColor: true,
          },
        },
        _count: {
          select: {
            branches: true,
            reviews: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ success: true, businesses });
  } catch (err: any) {
    console.error('List businesses error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Only business owners can create new businesses' }, { status: 403 });
    }

    const data = await req.json();
    const { name, category, description, phone, email, website, address, city, state, country } = data;

    if (!name || !category) {
      return NextResponse.json({ error: 'Business name and category are required' }, { status: 400 });
    }

    // Notice: NO business-count limit! Owner can create unlimited businesses at any time.
    const targetOwnerId = (session.role === 'SUPER_ADMIN' && data.ownerId) ? data.ownerId : session.userId;
    const business = await prisma.business.create({
      data: {
        ownerId: targetOwnerId,
        name,
        category,
        description: description || null,
        phone: phone || null,
        email: email || null,
        website: website || null,
        address: address || null,
        city: city || null,
        state: state || null,
        country: country || 'India',
        status: 'ACTIVE',
      },
    });

    // Auto-create a default review form for this new business
    const defaultForm = await prisma.reviewForm.create({
      data: {
        businessId: business.id,
        title: `${business.name} Customer Experience`,
        description: 'Thank you for visiting! Please help us improve by sharing your thoughts.',
        isPublished: true,
        isDefault: true,
      },
    });

    // Add 3 standard initial questions
    await prisma.reviewQuestion.createMany({
      data: [
        {
          formId: defaultForm.id,
          text: 'How would you rate your overall experience today?',
          type: 'STAR_RATING',
          required: true,
          displayOrder: 1,
        },
        {
          formId: defaultForm.id,
          text: 'How was the quality and attentiveness of our service?',
          type: 'GOOD_OKAY_POOR',
          required: true,
          displayOrder: 2,
        },
        {
          formId: defaultForm.id,
          text: 'Would you recommend us to a friend or colleague?',
          type: 'YES_NO',
          required: true,
          displayOrder: 3,
          positiveValue: 'Yes',
        },
        {
          formId: defaultForm.id,
          text: 'What did you like most, or how can we improve?',
          type: 'TEXT',
          required: false,
          displayOrder: 4,
        },
      ],
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'BUSINESS_CREATED',
      entityType: 'BUSINESS',
      entityId: business.id,
      details: { name: business.name, category: business.category },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({ success: true, business });
  } catch (err: any) {
    console.error('Create business error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
