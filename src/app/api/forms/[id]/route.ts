import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser, verifyBusinessAccess } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await context.params;

    const form = await prisma.reviewForm.findUnique({
      where: { id },
      include: {
        business: {
          select: { id: true, name: true, category: true, ownerId: true, logoUrl: true },
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
          where: { isActive: true },
          include: {
            branch: {
              select: { id: true, name: true, address: true, status: true, qrToken: true },
            },
          },
        },
        _count: {
          select: { reviews: true },
        },
      },
    });

    if (!form) {
      return NextResponse.json({ error: 'Form not found' }, { status: 404 });
    }

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, form.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // Identify all branches in the same business that are NOT yet assigned to this form
    const allBusinessBranches = await prisma.branch.findMany({
      where: { businessId: form.businessId, status: { not: 'INACTIVE' } },
      select: { id: true, name: true, address: true, qrToken: true },
    });

    const assignedBranchIds = new Set(form.branchAssignments.map((ba) => ba.branchId));
    const availableBranches = allBusinessBranches.filter((br) => !assignedBranchIds.has(br.id));

    return NextResponse.json({
      success: true,
      form: {
        id: form.id,
        businessId: form.businessId,
        businessName: form.business.name,
        businessCategory: form.business.category,
        businessLogoUrl: form.business.logoUrl,
        name: form.name,
        title: form.title,
        description: form.description,
        status: form.status,
        version: form.version,
        isPublished: form.isPublished,
        isDefault: form.isDefault,
        classificationPolicy: form.classificationPolicy,
        overallRatingQuestionId: form.overallRatingQuestionId,
        designSettings: form.designSettings ? JSON.parse(form.designSettings) : null,
        customerFieldSettings: form.customerFieldSettings ? JSON.parse(form.customerFieldSettings) : null,
        welcomeMessage: form.welcomeMessage,
        thankYouMessage: form.thankYouMessage,
        submitButtonText: form.submitButtonText,
        privacyNotice: form.privacyNotice,
        createdBy: form.createdBy,
        publishedAt: form.publishedAt,
        archivedAt: form.archivedAt,
        createdAt: form.createdAt,
        updatedAt: form.updatedAt,
        questions: form.questions,
        totalReviews: form._count.reviews,
        assignedBranches: form.branchAssignments.map((ba) => ({
          assignmentId: ba.id,
          branchId: ba.branch.id,
          branchName: ba.branch.name,
          address: ba.branch.address,
          status: ba.branch.status,
          qrToken: ba.branch.qrToken,
          isActive: ba.isActive,
          isDefault: ba.isDefault,
          assignedAt: ba.assignedAt,
        })),
        availableBranches,
        isSharedAcrossBranches: form.branchAssignments.length > 1,
      },
    });
  } catch (err: any) {
    console.error('Get form details error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
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

    const { id } = await context.params;
    const body = await req.json();

    const existingForm = await prisma.reviewForm.findUnique({
      where: { id },
      include: { branchAssignments: true },
    });

    if (!existingForm) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, existingForm.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const {
      name,
      title,
      description,
      status,
      classificationPolicy,
      overallRatingQuestionId,
      designSettings,
      customerFieldSettings,
      welcomeMessage,
      thankYouMessage,
      submitButtonText,
      privacyNotice,
    } = body;

    const dataToUpdate: any = {
      updatedAt: new Date(),
    };

    if (name !== undefined) dataToUpdate.name = name.trim();
    if (title !== undefined) dataToUpdate.title = title.trim();
    if (description !== undefined) dataToUpdate.description = description ? description.trim() : null;
    if (classificationPolicy !== undefined) dataToUpdate.classificationPolicy = classificationPolicy;
    if (overallRatingQuestionId !== undefined) dataToUpdate.overallRatingQuestionId = overallRatingQuestionId;
    if (designSettings !== undefined) {
      dataToUpdate.designSettings = typeof designSettings === 'string' ? designSettings : JSON.stringify(designSettings);
    }
    if (customerFieldSettings !== undefined) {
      dataToUpdate.customerFieldSettings = typeof customerFieldSettings === 'string' ? customerFieldSettings : JSON.stringify(customerFieldSettings);
    }
    if (welcomeMessage !== undefined) dataToUpdate.welcomeMessage = welcomeMessage ? welcomeMessage.trim() : null;
    if (thankYouMessage !== undefined) dataToUpdate.thankYouMessage = thankYouMessage ? thankYouMessage.trim() : null;
    if (submitButtonText !== undefined) dataToUpdate.submitButtonText = submitButtonText.trim();
    if (privacyNotice !== undefined) dataToUpdate.privacyNotice = privacyNotice ? privacyNotice.trim() : null;

    if (status !== undefined) {
      dataToUpdate.status = status;
      if (status === 'PUBLISHED') {
        dataToUpdate.isPublished = true;
        dataToUpdate.publishedAt = new Date();
        dataToUpdate.version = { increment: 1 };
      } else if (status === 'PAUSED' || status === 'DRAFT') {
        dataToUpdate.isPublished = false;
      } else if (status === 'ARCHIVED') {
        dataToUpdate.isPublished = false;
        dataToUpdate.archivedAt = new Date();
      }
    }

    const updated = await prisma.reviewForm.update({
      where: { id },
      data: dataToUpdate,
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'FORM_UPDATED',
      entityType: 'REVIEW_FORM',
      entityId: id,
      details: {
        title: updated.title,
        status: updated.status,
        affectedBranchesCount: existingForm.branchAssignments.length,
      },
    });

    return NextResponse.json({
      success: true,
      form: updated,
      affectedBranchesCount: existingForm.branchAssignments.length,
    });
  } catch (err: any) {
    console.error('Update form error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'OWNER' && session.role !== 'SUPER_ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await context.params;

    const form = await prisma.reviewForm.findUnique({
      where: { id },
      include: {
        _count: { select: { reviews: true } },
      },
    });

    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, form.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    // Archive form instead of deleting, guaranteeing all historical reviews are strictly preserved!
    const archived = await prisma.reviewForm.update({
      where: { id },
      data: {
        status: 'ARCHIVED',
        isPublished: false,
        archivedAt: new Date(),
        updatedAt: new Date(),
      },
    });

    // Also deactivate branch assignments for this archived form
    await prisma.branchFormAssignment.updateMany({
      where: { formId: id },
      data: { isActive: false, isDefault: false },
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'FORM_ARCHIVED',
      entityType: 'REVIEW_FORM',
      entityId: id,
      details: { title: form.title, historicalReviewsPreserved: form._count.reviews },
    });

    return NextResponse.json({
      success: true,
      message: 'Form archived successfully. Historical reviews preserved.',
      preservedReviewsCount: form._count.reviews,
    });
  } catch (err: any) {
    console.error('Delete/Archive form error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
