import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, verifyBusinessAccess } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: formId } = await context.params;
    const form = await prisma.reviewForm.findUnique({ where: { id: formId } });
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, form.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const body = await req.json();
    const {
      text,
      description,
      type,
      required = true,
      displayOrder,
      positiveValue,
      settings,
      classificationRules,
      options,
    } = body;

    // Server-side validation of question
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Question text is required' }, { status: 400 });
    }

    const validTypes = ['STAR_RATING', 'GOOD_OKAY_POOR', 'MULTIPLE_CHOICE', 'YES_NO', 'TEXT'];
    if (!type || !validTypes.includes(type)) {
      return NextResponse.json({ error: `Question type must be one of: ${validTypes.join(', ')}` }, { status: 400 });
    }

    // Determine display order
    let order = displayOrder;
    if (order === undefined) {
      const highestOrder = await prisma.reviewQuestion.findFirst({
        where: { formId, active: true },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });
      order = (highestOrder?.displayOrder ?? 0) + 1;
    }

    const newQuestion = await prisma.$transaction(async (tx) => {
      const q = await tx.reviewQuestion.create({
        data: {
          formId,
          text: text.trim(),
          description: description?.trim() || null,
          type,
          required: Boolean(required),
          displayOrder: order,
          positiveValue: type === 'YES_NO' ? (positiveValue?.trim() || 'Yes') : null,
          settings: settings ? (typeof settings === 'string' ? settings : JSON.stringify(settings)) : null,
          classificationRules: classificationRules ? (typeof classificationRules === 'string' ? classificationRules : JSON.stringify(classificationRules)) : null,
        },
      });

      // Insert options if MULTIPLE_CHOICE or if options provided
      if (type === 'MULTIPLE_CHOICE' && Array.isArray(options) && options.length > 0) {
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          await tx.questionOption.create({
            data: {
              questionId: q.id,
              text: opt.text?.trim() || `Option ${i + 1}`,
              value: opt.value?.trim() || opt.text?.trim() || `opt_${i + 1}`,
              scoreClassification: opt.scoreClassification || 'GOOD',
              displayOrder: opt.displayOrder ?? i + 1,
            },
          });
        }
      }

      // Increment form version to track schema change
      await tx.reviewForm.update({
        where: { id: formId },
        data: { version: { increment: 1 }, updatedAt: new Date() },
      });

      return q;
    });

    // Return complete question with options
    const createdWithOpts = await prisma.reviewQuestion.findUnique({
      where: { id: newQuestion.id },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'QUESTION_ADDED',
      entityType: 'REVIEW_QUESTION',
      entityId: newQuestion.id,
      details: { formId, type, text: newQuestion.text },
    });

    return NextResponse.json({ success: true, question: createdWithOpts });
  } catch (err: any) {
    console.error('Add question error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: formId } = await context.params;
    const form = await prisma.reviewForm.findUnique({ where: { id: formId } });
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, form.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { questions } = await req.json();
    if (!Array.isArray(questions)) {
      return NextResponse.json({ error: 'questions array is required' }, { status: 400 });
    }

    // Reorder / update questions in transaction
    await prisma.$transaction(async (tx) => {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (q.id) {
          await tx.reviewQuestion.update({
            where: { id: q.id },
            data: {
              displayOrder: i + 1,
              text: q.text !== undefined ? q.text.trim() : undefined,
              description: q.description !== undefined ? q.description?.trim() || null : undefined,
              required: q.required !== undefined ? Boolean(q.required) : undefined,
              positiveValue: q.positiveValue !== undefined ? q.positiveValue : undefined,
            },
          });
        }
      }

      await tx.reviewForm.update({
        where: { id: formId },
        data: { version: { increment: 1 }, updatedAt: new Date() },
      });
    });

    return NextResponse.json({ success: true, message: 'Questions reordered successfully' });
  } catch (err: any) {
    console.error('Reorder questions error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
