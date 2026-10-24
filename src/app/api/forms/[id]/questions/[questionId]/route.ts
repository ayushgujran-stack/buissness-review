import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, verifyBusinessAccess } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: formId, questionId } = await context.params;

    const form = await prisma.reviewForm.findUnique({ where: { id: formId } });
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, form.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const question = await prisma.reviewQuestion.findFirst({
      where: { id: questionId, formId },
    });
    if (!question) return NextResponse.json({ error: 'Question not found' }, { status: 404 });

    const body = await req.json();
    const { text, description, required, positiveValue, settings, classificationRules, options } = body;

    const updated = await prisma.$transaction(async (tx) => {
      const q = await tx.reviewQuestion.update({
        where: { id: questionId },
        data: {
          text: text !== undefined ? text.trim() : question.text,
          description: description !== undefined ? (description ? description.trim() : null) : question.description,
          required: required !== undefined ? Boolean(required) : question.required,
          positiveValue: positiveValue !== undefined ? positiveValue : question.positiveValue,
          settings: settings !== undefined ? (typeof settings === 'string' ? settings : JSON.stringify(settings)) : question.settings,
          classificationRules: classificationRules !== undefined ? (typeof classificationRules === 'string' ? classificationRules : JSON.stringify(classificationRules)) : question.classificationRules,
          updatedAt: new Date(),
        },
      });

      // Update options if provided
      if (Array.isArray(options)) {
        await tx.questionOption.deleteMany({ where: { questionId } });
        for (let i = 0; i < options.length; i++) {
          const opt = options[i];
          await tx.questionOption.create({
            data: {
              questionId,
              text: opt.text?.trim() || `Option ${i + 1}`,
              value: opt.value?.trim() || opt.text?.trim() || `opt_${i + 1}`,
              scoreClassification: opt.scoreClassification || 'GOOD',
              displayOrder: opt.displayOrder ?? i + 1,
            },
          });
        }
      }

      await tx.reviewForm.update({
        where: { id: formId },
        data: { version: { increment: 1 }, updatedAt: new Date() },
      });

      return q;
    });

    const result = await prisma.reviewQuestion.findUnique({
      where: { id: questionId },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });

    return NextResponse.json({ success: true, question: result });
  } catch (err: any) {
    console.error('Update question error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string; questionId: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: formId, questionId } = await context.params;

    const form = await prisma.reviewForm.findUnique({ where: { id: formId } });
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, form.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // Check if any reviews have answers for this question
    const answersCount = await prisma.reviewAnswer.count({
      where: { questionId },
    });

    await prisma.$transaction(async (tx) => {
      if (answersCount > 0) {
        // Soft-deactivate so historical review answers keep their reference intact
        await tx.reviewQuestion.update({
          where: { id: questionId },
          data: { active: false, updatedAt: new Date() },
        });
      } else {
        // Safe to hard delete options & question
        await tx.questionOption.deleteMany({ where: { questionId } });
        await tx.reviewQuestion.delete({ where: { id: questionId } });
      }

      await tx.reviewForm.update({
        where: { id: formId },
        data: { version: { increment: 1 }, updatedAt: new Date() },
      });
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'QUESTION_DELETED',
      entityType: 'REVIEW_QUESTION',
      entityId: questionId,
      details: { formId, historicalAnswersPreserved: answersCount },
    });

    return NextResponse.json({
      success: true,
      message: 'Question removed successfully. Historical reviews preserved.',
      preservedAnswersCount: answersCount,
    });
  } catch (err: any) {
    console.error('Delete question error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string; questionId: string }> }
) {
  // Duplicate question action
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id: formId, questionId } = await context.params;
    const body = await req.json();

    if (body.action !== 'DUPLICATE') {
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    const sourceQ = await prisma.reviewQuestion.findUnique({
      where: { id: questionId },
      include: { options: true },
    });
    if (!sourceQ || sourceQ.formId !== formId) {
      return NextResponse.json({ error: 'Source question not found' }, { status: 404 });
    }

    const duplicated = await prisma.$transaction(async (tx) => {
      const highestOrder = await tx.reviewQuestion.findFirst({
        where: { formId, active: true },
        orderBy: { displayOrder: 'desc' },
        select: { displayOrder: true },
      });

      const newQ = await tx.reviewQuestion.create({
        data: {
          formId,
          text: `${sourceQ.text} (Copy)`,
          description: sourceQ.description,
          type: sourceQ.type,
          required: sourceQ.required,
          displayOrder: (highestOrder?.displayOrder ?? 0) + 1,
          positiveValue: sourceQ.positiveValue,
          settings: sourceQ.settings,
          classificationRules: sourceQ.classificationRules,
        },
      });

      for (const opt of sourceQ.options) {
        await tx.questionOption.create({
          data: {
            questionId: newQ.id,
            text: opt.text,
            value: opt.value,
            scoreClassification: opt.scoreClassification,
            displayOrder: opt.displayOrder,
          },
        });
      }

      await tx.reviewForm.update({
        where: { id: formId },
        data: { version: { increment: 1 }, updatedAt: new Date() },
      });

      return newQ;
    });

    const result = await prisma.reviewQuestion.findUnique({
      where: { id: duplicated.id },
      include: { options: { orderBy: { displayOrder: 'asc' } } },
    });

    return NextResponse.json({ success: true, question: result });
  } catch (err: any) {
    console.error('Duplicate question error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
