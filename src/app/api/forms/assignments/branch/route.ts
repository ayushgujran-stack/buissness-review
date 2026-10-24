import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, verifyBusinessAccess } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json({ error: 'branchId is required' }, { status: 400 });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { business: true },
    });

    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, branch.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // Find active assignment
    const activeAssignment = await prisma.branchFormAssignment.findFirst({
      where: { branchId, isActive: true },
      include: {
        form: {
          include: {
            questions: {
              where: { active: true },
              orderBy: { displayOrder: 'asc' },
              include: { options: { orderBy: { displayOrder: 'asc' } } },
            },
            branchAssignments: {
              select: { branchId: true },
            },
          },
        },
      },
    });

    // Also get all available forms in this business
    const businessForms = await prisma.reviewForm.findMany({
      where: { businessId: branch.businessId, status: { not: 'ARCHIVED' } },
      select: {
        id: true,
        name: true,
        title: true,
        status: true,
        version: true,
        _count: { select: { questions: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      branch: {
        id: branch.id,
        name: branch.name,
        businessId: branch.businessId,
        businessName: branch.business.name,
        qrToken: branch.qrToken,
      },
      activeAssignment: activeAssignment
        ? {
            id: activeAssignment.id,
            formId: activeAssignment.form.id,
            formName: activeAssignment.form.name,
            formTitle: activeAssignment.form.title,
            formStatus: activeAssignment.form.status,
            questionsCount: activeAssignment.form.questions.length,
            isShared: activeAssignment.form.branchAssignments.length > 1,
            sharedBranchesCount: activeAssignment.form.branchAssignments.length,
            assignedAt: activeAssignment.assignedAt,
          }
        : null,
      availableForms: businessForms,
    });
  } catch (err: any) {
    console.error('Get branch active form error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { action = 'ASSIGN', branchId } = body;
    const formId = body.formId || body.sourceFormId;

    if (!branchId || !formId) {
      return NextResponse.json({ error: 'branchId and formId are required' }, { status: 400 });
    }

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { business: true },
    });
    if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, branch.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const form = await prisma.reviewForm.findUnique({ where: { id: formId } });
    if (!form || form.businessId !== branch.businessId) {
      return NextResponse.json({ error: 'Form does not belong to this business' }, { status: 400 });
    }

    if (action === 'CUSTOMIZE_FOR_BRANCH') {
      // Clones form and assigns to branch
      const fullForm = await prisma.reviewForm.findUnique({
        where: { id: formId },
        include: {
          questions: {
            where: { active: true },
            orderBy: { displayOrder: 'asc' },
            include: { options: { orderBy: { displayOrder: 'asc' } } },
          },
        },
      });
      if (!fullForm) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

      const customized = await prisma.$transaction(async (tx) => {
        const cloned = await tx.reviewForm.create({
          data: {
            businessId: branch.businessId,
            name: `${fullForm.name} — ${branch.name}`,
            title: `${fullForm.title} (${branch.name})`,
            description: fullForm.description,
            status: 'PUBLISHED',
            version: 1,
            isPublished: true,
            isDefault: false,
            classificationPolicy: fullForm.classificationPolicy,
            designSettings: fullForm.designSettings,
            customerFieldSettings: fullForm.customerFieldSettings,
            welcomeMessage: fullForm.welcomeMessage,
            thankYouMessage: fullForm.thankYouMessage,
            submitButtonText: fullForm.submitButtonText,
            privacyNotice: fullForm.privacyNotice,
            publishedAt: new Date(),
            createdBy: session.name,
          },
        });

        for (const q of fullForm.questions) {
          const newQ = await tx.reviewQuestion.create({
            data: {
              formId: cloned.id,
              text: q.text,
              description: q.description,
              type: q.type,
              required: q.required,
              displayOrder: q.displayOrder,
              positiveValue: q.positiveValue,
              settings: q.settings,
              classificationRules: q.classificationRules,
            },
          });

          for (const opt of q.options) {
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
        }

        await tx.branchFormAssignment.updateMany({
          where: { branchId },
          data: { isActive: false, isDefault: false },
        });

        await tx.branchFormAssignment.upsert({
          where: { branchId_formId: { branchId, formId: cloned.id } },
          update: { isActive: true, isDefault: true, assignedAt: new Date(), assignedBy: session.name },
          create: {
            businessId: branch.businessId,
            branchId,
            formId: cloned.id,
            isActive: true,
            isDefault: true,
            assignedBy: session.name,
          },
        });

        return cloned;
      });

      return NextResponse.json({
        success: true,
        message: 'Branch customized form created and assigned successfully',
        form: customized,
      });
    }

    // Default ASSIGN:
    await prisma.$transaction(async (tx) => {
      await tx.branchFormAssignment.updateMany({
        where: { branchId },
        data: { isActive: false, isDefault: false },
      });

      await tx.branchFormAssignment.upsert({
        where: { branchId_formId: { branchId, formId } },
        update: { isActive: true, isDefault: true, assignedAt: new Date(), assignedBy: session.name },
        create: {
          businessId: branch.businessId,
          branchId,
          formId,
          isActive: true,
          isDefault: true,
          assignedBy: session.name,
        },
      });
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'BRANCH_FORM_ASSIGNED',
      entityType: 'BRANCH_FORM_ASSIGNMENT',
      entityId: branchId,
      details: { branchName: branch.name, formTitle: form.title },
    });

    return NextResponse.json({ success: true, message: 'Form assigned to branch successfully' });
  } catch (err: any) {
    console.error('Branch form assignment error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
