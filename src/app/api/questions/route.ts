import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, verifyBusinessAccess } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { formId, text, type, required, displayOrder, positiveValue, options } = await req.json();

    if (!formId || !text || !type) {
      return NextResponse.json({ error: 'formId, text, and type are required' }, { status: 400 });
    }

    const form = await prisma.reviewForm.findUnique({
      where: { id: formId },
      include: { business: true },
    });
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, form.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // Determine max displayOrder if not given
    const currentCount = await prisma.reviewQuestion.count({ where: { formId } });

    const question = await prisma.reviewQuestion.create({
      data: {
        formId,
        text,
        type, // STAR_RATING, GOOD_OKAY_POOR, MULTIPLE_CHOICE, YES_NO, TEXT
        required: required ?? true,
        displayOrder: displayOrder ?? currentCount + 1,
        positiveValue: positiveValue || null,
        active: true,
      },
    });

    if (options && Array.isArray(options) && options.length > 0) {
      await prisma.questionOption.createMany({
        data: options.map((opt: any, idx: number) => ({
          questionId: question.id,
          text: opt.text,
          value: opt.value || opt.text,
          scoreClassification: opt.scoreClassification || 'GOOD',
          displayOrder: idx + 1,
        })),
      });
    }

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'QUESTION_CREATED',
      entityType: 'QUESTION',
      entityId: question.id,
      details: { text: question.text, type: question.type },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    const fullQuestion = await prisma.reviewQuestion.findUnique({
      where: { id: question.id },
      include: { options: true },
    });

    return NextResponse.json({ success: true, question: fullQuestion });
  } catch (err: any) {
    console.error('Create question error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const questionId = searchParams.get('id');

    if (!questionId) {
      return NextResponse.json({ error: 'Question id is required' }, { status: 400 });
    }

    const question = await prisma.reviewQuestion.findUnique({
      where: { id: questionId },
      include: { form: true },
    });
    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, question.form.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    await prisma.reviewQuestion.delete({ where: { id: questionId } });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'QUESTION_DELETED',
      entityType: 'QUESTION',
      entityId: questionId,
      details: { text: question.text },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Delete question error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
