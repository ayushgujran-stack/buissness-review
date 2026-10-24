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

    const { id: formId } = await context.params;
    const form = await prisma.reviewForm.findUnique({
      where: { id: formId },
      include: {
        branchAssignments: {
          include: {
            branch: {
              select: { id: true, name: true, address: true, status: true, qrToken: true },
            },
          },
        },
      },
    });

    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, form.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    return NextResponse.json({
      success: true,
      formId: form.id,
      formTitle: form.title,
      assignments: form.branchAssignments.map((ba) => ({
        assignmentId: ba.id,
        branchId: ba.branch.id,
        branchName: ba.branch.name,
        address: ba.branch.address,
        status: ba.branch.status,
        qrToken: ba.branch.qrToken,
        isActive: ba.isActive,
        isDefault: ba.isDefault,
        assignedAt: ba.assignedAt,
        assignedBy: ba.assignedBy,
      })),
    });
  } catch (err: any) {
    console.error('List assignments error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

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
    const { branchIds, setAsDefault = true, makeActive = true } = body;

    if (!Array.isArray(branchIds) || branchIds.length === 0) {
      return NextResponse.json({ error: 'branchIds array is required' }, { status: 400 });
    }

    // Verify all branches belong to the form's business
    const validBranches = await prisma.branch.findMany({
      where: {
        id: { in: branchIds },
        businessId: form.businessId,
      },
    });

    if (validBranches.length !== branchIds.length) {
      return NextResponse.json({ error: 'One or more branches do not belong to this business' }, { status: 400 });
    }

    // Execute assignment in transaction:
    // When activating this form for these branches, deactivate any other assignments for those branches
    await prisma.$transaction(async (tx) => {
      for (const branch of validBranches) {
        if (makeActive) {
          // Deactivate previous active assignment for this branch
          await tx.branchFormAssignment.updateMany({
            where: { branchId: branch.id },
            data: { isActive: false, isDefault: false },
          });
        }

        await tx.branchFormAssignment.upsert({
          where: { branchId_formId: { branchId: branch.id, formId } },
          update: {
            isActive: makeActive,
            isDefault: setAsDefault,
            assignedAt: new Date(),
            assignedBy: session.name,
          },
          create: {
            businessId: form.businessId,
            branchId: branch.id,
            formId,
            isActive: makeActive,
            isDefault: setAsDefault,
            assignedBy: session.name,
          },
        });
      }
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'FORM_ASSIGNED_TO_BRANCHES',
      entityType: 'BRANCH_FORM_ASSIGNMENT',
      entityId: formId,
      details: {
        formTitle: form.title,
        assignedBranchIds: branchIds,
        assignedCount: branchIds.length,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Form successfully assigned to ${branchIds.length} branch(es)`,
      assignedBranchCount: branchIds.length,
    });
  } catch (err: any) {
    console.error('Assign branches error:', err);
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

    const { id: formId } = await context.params;
    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');

    if (!branchId) {
      return NextResponse.json({ error: 'branchId query parameter is required' }, { status: 400 });
    }

    const form = await prisma.reviewForm.findUnique({ where: { id: formId } });
    if (!form) return NextResponse.json({ error: 'Form not found' }, { status: 404 });

    const hasAccess = await verifyBusinessAccess(session.userId, session.role, form.businessId);
    if (!hasAccess) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    await prisma.branchFormAssignment.deleteMany({
      where: { formId, branchId },
    });

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'FORM_UNASSIGNED_FROM_BRANCH',
      entityType: 'BRANCH_FORM_ASSIGNMENT',
      entityId: formId,
      details: { branchId, formTitle: form.title },
    });

    return NextResponse.json({
      success: true,
      message: 'Branch unassigned successfully from form',
    });
  } catch (err: any) {
    console.error('Unassign branch error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
