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
    const businessId = searchParams.get('businessId');

    let whereClause: any = {
      status: { not: 'ARCHIVED' }, // By default don't list archived unless requested
    };

    const includeArchived = searchParams.get('includeArchived') === 'true';
    if (includeArchived) {
      delete whereClause.status;
    }

    if (businessId) {
      const hasAccess = await verifyBusinessAccess(session.userId, session.role, businessId);
      if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      whereClause.businessId = businessId;
    } else if (session.role === 'OWNER') {
      whereClause.business = { ownerId: session.userId };
    } else if (session.role === 'MANAGER' || session.role === 'SUPER_MANAGER') {
      const assignments = await prisma.branchUser.findMany({
        where: { userId: session.userId },
        select: { businessId: true },
      });
      const bIds = assignments.map((a) => a.businessId);
      whereClause.businessId = { in: bIds };
    } else if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const forms = await prisma.reviewForm.findMany({
      where: whereClause,
      include: {
        business: {
          select: { id: true, name: true, category: true },
        },
        questions: {
          where: { active: true },
          orderBy: { displayOrder: 'asc' },
          include: {
            options: {
              orderBy: { displayOrder: 'asc' },
            },
          },
        },
        branchAssignments: {
          include: {
            branch: {
              select: { id: true, name: true, status: true, qrToken: true },
            },
          },
        },
        _count: {
          select: {
            reviews: true,
            questions: true,
            branchAssignments: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const formatted = forms.map((f) => ({
      id: f.id,
      businessId: f.businessId,
      businessName: f.business.name,
      businessCategory: f.business.category,
      name: f.name,
      title: f.title,
      description: f.description,
      status: f.status,
      version: f.version,
      isPublished: f.isPublished,
      isDefault: f.isDefault,
      classificationPolicy: f.classificationPolicy,
      overallRatingQuestionId: f.overallRatingQuestionId,
      designSettings: f.designSettings ? JSON.parse(f.designSettings) : null,
      customerFieldSettings: f.customerFieldSettings ? JSON.parse(f.customerFieldSettings) : null,
      welcomeMessage: f.welcomeMessage,
      thankYouMessage: f.thankYouMessage,
      submitButtonText: f.submitButtonText,
      privacyNotice: f.privacyNotice,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      publishedAt: f.publishedAt,
      archivedAt: f.archivedAt,
      totalQuestions: f.questions.length,
      questions: f.questions,
      totalReviews: f._count.reviews,
      assignedBranchesCount: f.branchAssignments.length,
      assignedBranches: f.branchAssignments.map((ba) => ({
        assignmentId: ba.id,
        branchId: ba.branch.id,
        branchName: ba.branch.name,
        branchStatus: ba.branch.status,
        qrToken: ba.branch.qrToken,
        isActive: ba.isActive,
        isDefault: ba.isDefault,
      })),
    }));

    return NextResponse.json({ success: true, forms: formatted });
  } catch (err: any) {
    console.error('List forms error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Only business owners can create or duplicate forms' }, { status: 403 });
    }

    const body = await req.json();
    const {
      action = 'CREATE',
      businessId,
      name,
      title,
      description,
      status = 'PUBLISHED',
      classificationPolicy = 'LOWEST_SCORE',
      overallRatingQuestionId,
      designSettings,
      customerFieldSettings,
      welcomeMessage,
      thankYouMessage,
      submitButtonText,
      privacyNotice,
      initialQuestions,
      sourceFormId,
      branchId,
      assignToBranchIds,
    } = body;

    // ----------------------------------------------------
    // ACTION: DUPLICATE A FORM
    // ----------------------------------------------------
    if (action === 'DUPLICATE') {
      if (!sourceFormId) {
        return NextResponse.json({ error: 'sourceFormId is required to duplicate a form' }, { status: 400 });
      }

      const sourceForm = await prisma.reviewForm.findUnique({
        where: { id: sourceFormId },
        include: {
          questions: {
            where: { active: true },
            orderBy: { displayOrder: 'asc' },
            include: {
              options: { orderBy: { displayOrder: 'asc' } },
            },
          },
        },
      });

      if (!sourceForm) return NextResponse.json({ error: 'Source form not found' }, { status: 404 });

      const hasAccess = await verifyBusinessAccess(session.userId, session.role, sourceForm.businessId);
      if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

      const duplicated = await prisma.$transaction(async (tx) => {
        const newForm = await tx.reviewForm.create({
          data: {
            businessId: sourceForm.businessId,
            name: `${sourceForm.name} (Copy)`,
            title: sourceForm.title,
            description: sourceForm.description,
            status: 'DRAFT',
            version: 1,
            isPublished: false,
            isDefault: false,
            classificationPolicy: sourceForm.classificationPolicy,
            designSettings: sourceForm.designSettings,
            customerFieldSettings: sourceForm.customerFieldSettings,
            welcomeMessage: sourceForm.welcomeMessage,
            thankYouMessage: sourceForm.thankYouMessage,
            submitButtonText: sourceForm.submitButtonText,
            privacyNotice: sourceForm.privacyNotice,
            createdBy: session.name,
          },
        });

        for (const q of sourceForm.questions) {
          const newQ = await tx.reviewQuestion.create({
            data: {
              formId: newForm.id,
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

        return newForm;
      });

      await logAuditEvent({
        userId: session.userId,
        userName: session.name,
        role: session.role,
        action: 'FORM_DUPLICATED',
        entityType: 'REVIEW_FORM',
        entityId: duplicated.id,
        details: { sourceFormId, newFormName: duplicated.name },
      });

      return NextResponse.json({ success: true, form: duplicated });
    }

    // ----------------------------------------------------
    // ACTION: CUSTOMIZE FOR A SPECIFIC BRANCH (Branch-Specific Copy)
    // ----------------------------------------------------
    if (action === 'CUSTOMIZE_FOR_BRANCH') {
      if (!sourceFormId || !branchId) {
        return NextResponse.json({ error: 'sourceFormId and branchId are required to customize for branch' }, { status: 400 });
      }

      const branch = await prisma.branch.findUnique({
        where: { id: branchId },
        include: { business: true },
      });
      if (!branch) return NextResponse.json({ error: 'Branch not found' }, { status: 404 });

      const hasAccess = await verifyBusinessAccess(session.userId, session.role, branch.businessId);
      if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

      const sourceForm = await prisma.reviewForm.findUnique({
        where: { id: sourceFormId },
        include: {
          questions: {
            where: { active: true },
            orderBy: { displayOrder: 'asc' },
            include: { options: { orderBy: { displayOrder: 'asc' } } },
          },
        },
      });
      if (!sourceForm) return NextResponse.json({ error: 'Source form not found' }, { status: 404 });

      const customized = await prisma.$transaction(async (tx) => {
        // Create detached independent copy
        const newForm = await tx.reviewForm.create({
          data: {
            businessId: branch.businessId,
            name: `${sourceForm.name} — ${branch.name} Custom`,
            title: `${sourceForm.title} (${branch.name})`,
            description: sourceForm.description,
            status: 'PUBLISHED',
            version: 1,
            isPublished: true,
            isDefault: false,
            classificationPolicy: sourceForm.classificationPolicy,
            designSettings: sourceForm.designSettings,
            customerFieldSettings: sourceForm.customerFieldSettings,
            welcomeMessage: sourceForm.welcomeMessage,
            thankYouMessage: sourceForm.thankYouMessage,
            submitButtonText: sourceForm.submitButtonText,
            privacyNotice: sourceForm.privacyNotice,
            publishedAt: new Date(),
            createdBy: session.name,
          },
        });

        // Clone questions & options
        for (const q of sourceForm.questions) {
          const newQ = await tx.reviewQuestion.create({
            data: {
              formId: newForm.id,
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

        // Deactivate any previous active assignment for this branch
        await tx.branchFormAssignment.updateMany({
          where: { branchId },
          data: { isActive: false, isDefault: false },
        });

        // Assign this newly cloned form to this specific branch as active default
        await tx.branchFormAssignment.upsert({
          where: { branchId_formId: { branchId, formId: newForm.id } },
          update: { isActive: true, isDefault: true, assignedAt: new Date(), assignedBy: session.name },
          create: {
            businessId: branch.businessId,
            branchId,
            formId: newForm.id,
            isActive: true,
            isDefault: true,
            assignedBy: session.name,
          },
        });

        return newForm;
      });

      await logAuditEvent({
        userId: session.userId,
        userName: session.name,
        role: session.role,
        action: 'FORM_CUSTOMIZED_FOR_BRANCH',
        entityType: 'REVIEW_FORM',
        entityId: customized.id,
        details: { branchId, branchName: branch.name, sourceFormId },
      });

      return NextResponse.json({ success: true, form: customized });
    }

    // ----------------------------------------------------
    // ACTION: CREATE BRAND NEW REVIEW FORM
    // ----------------------------------------------------
    if (!businessId || !title) {
      return NextResponse.json({ error: 'businessId and title are required' }, { status: 400 });
    }

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const isPublished = status === 'PUBLISHED';
    const form = await prisma.$transaction(async (tx) => {
      const createdForm = await tx.reviewForm.create({
        data: {
          businessId,
          name: name?.trim() || title.trim(),
          title: title.trim(),
          description: description?.trim() || null,
          status,
          isPublished,
          version: 1,
          isDefault: false,
          classificationPolicy,
          overallRatingQuestionId: overallRatingQuestionId || null,
          designSettings: designSettings ? (typeof designSettings === 'string' ? designSettings : JSON.stringify(designSettings)) : null,
          customerFieldSettings: customerFieldSettings ? (typeof customerFieldSettings === 'string' ? customerFieldSettings : JSON.stringify(customerFieldSettings)) : null,
          welcomeMessage: welcomeMessage?.trim() || null,
          thankYouMessage: thankYouMessage?.trim() || 'Thank you for your valuable feedback! We appreciate your time.',
          submitButtonText: submitButtonText?.trim() || 'Submit Feedback',
          privacyNotice: privacyNotice?.trim() || 'Your feedback is private and protected.',
          publishedAt: isPublished ? new Date() : null,
          createdBy: session.name,
        },
      });

      // Insert initial questions if provided
      if (Array.isArray(initialQuestions) && initialQuestions.length > 0) {
        for (let i = 0; i < initialQuestions.length; i++) {
          const q = initialQuestions[i];
          const newQ = await tx.reviewQuestion.create({
            data: {
              formId: createdForm.id,
              text: q.text,
              description: q.description || null,
              type: q.type || 'STAR_RATING',
              required: q.required ?? true,
              displayOrder: q.displayOrder ?? i + 1,
              positiveValue: q.positiveValue || null,
              settings: q.settings ? (typeof q.settings === 'string' ? q.settings : JSON.stringify(q.settings)) : null,
              classificationRules: q.classificationRules ? (typeof q.classificationRules === 'string' ? q.classificationRules : JSON.stringify(q.classificationRules)) : null,
            },
          });

          if (Array.isArray(q.options) && q.options.length > 0) {
            for (let j = 0; j < q.options.length; j++) {
              const opt = q.options[j];
              await tx.questionOption.create({
                data: {
                  questionId: newQ.id,
                  text: opt.text,
                  value: opt.value || opt.text,
                  scoreClassification: opt.scoreClassification || 'GOOD',
                  displayOrder: opt.displayOrder ?? j + 1,
                },
              });
            }
          }
        }
      } else {
        // Create default starter questions
        const q1 = await tx.reviewQuestion.create({
          data: {
            formId: createdForm.id,
            text: 'How would you rate your overall experience today?',
            type: 'STAR_RATING',
            required: true,
            displayOrder: 1,
          },
        });
        await tx.reviewQuestion.create({
          data: {
            formId: createdForm.id,
            text: 'How was the quality of our service and attentiveness?',
            type: 'GOOD_OKAY_POOR',
            required: true,
            displayOrder: 2,
          },
        });
        await tx.reviewQuestion.create({
          data: {
            formId: createdForm.id,
            text: 'Would you recommend us to friends and family?',
            type: 'YES_NO',
            positiveValue: 'Yes',
            required: true,
            displayOrder: 3,
          },
        });
        await tx.reviewQuestion.create({
          data: {
            formId: createdForm.id,
            text: 'Any additional feedback or suggestions for us?',
            type: 'TEXT',
            required: false,
            displayOrder: 4,
          },
        });
      }

      // Assign to branches if requested
      if (Array.isArray(assignToBranchIds) && assignToBranchIds.length > 0) {
        for (const bId of assignToBranchIds) {
          await tx.branchFormAssignment.updateMany({
            where: { branchId: bId },
            data: { isActive: false },
          });
          await tx.branchFormAssignment.upsert({
            where: { branchId_formId: { branchId: bId, formId: createdForm.id } },
            update: { isActive: true, isDefault: true, assignedAt: new Date(), assignedBy: session.name },
            create: {
              businessId,
              branchId: bId,
              formId: createdForm.id,
              isActive: true,
              isDefault: true,
              assignedBy: session.name,
            },
          });
        }
      }

      return createdForm;
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'FORM_CREATED',
      entityType: 'REVIEW_FORM',
      entityId: form.id,
      details: { title: form.title, businessId, status: form.status },
    });

    return NextResponse.json({ success: true, form });
  } catch (err: any) {
    console.error('Create form error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
