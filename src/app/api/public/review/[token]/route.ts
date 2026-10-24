import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { classifyReview, triggerPoorReviewAlert } from '@/lib/review-processor';
import { getOwnerLicenseStatus } from '@/lib/license';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    if (!token) {
      return NextResponse.json({ error: 'Invalid QR token' }, { status: 400 });
    }

    // Find branch by QR token
    const branch = await prisma.branch.findUnique({
      where: { qrToken: token },
      include: {
        business: {
          include: {
            owner: {
              select: { id: true, status: true },
            },
          },
        },
      },
    });

    if (!branch) {
      return NextResponse.json({ error: 'Review link not found or invalid QR code' }, { status: 404 });
    }

    if (branch.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'This branch is currently inactive for new feedback' }, { status: 403 });
    }

    if (branch.business.status !== 'ACTIVE') {
      return NextResponse.json({ error: 'This business is currently unavailable' }, { status: 403 });
    }

    // Verify owner license
    const licenseStatus = await getOwnerLicenseStatus(branch.business.ownerId);
    if (!licenseStatus.hasActiveLicense) {
      if (licenseStatus.status === 'EXPIRED') {
        return NextResponse.json(
          { error: 'Review submissions are temporarily closed as the business subscription has expired. Please contact the business owner.', isExpired: true },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: 'This business feedback portal is currently unavailable or suspended.', isSuspended: true },
        { status: 403 }
      );
    }

    // Increment scan count asynchronously
    await prisma.qrCode.updateMany({
      where: { token },
      data: {
        scanCount: { increment: 1 },
        lastScannedAt: new Date(),
      },
    }).catch(() => {});

    // BRANCH-WISE FORM RESOLUTION:
    // Look up the explicit active assignment for THIS branch
    const assignment = await prisma.branchFormAssignment.findFirst({
      where: {
        branchId: branch.id,
        isActive: true,
        form: {
          status: 'PUBLISHED',
          isPublished: true,
        },
      },
      include: {
        form: {
          include: {
            questions: {
              where: { active: true },
              orderBy: { displayOrder: 'asc' },
              include: {
                options: {
                  orderBy: { displayOrder: 'asc' },
                },
              },
            },
          },
        },
      },
    });

    // If branch has no active published form assignment, reject with clear unavailable message!
    if (!assignment || !assignment.form || assignment.form.questions.length === 0) {
      return NextResponse.json(
        {
          error: 'No active review form is currently available for this branch.',
          isUnavailable: true,
          branchName: branch.name,
          businessName: branch.business.name,
        },
        { status: 404 }
      );
    }

    const form = assignment.form;

    // Parse design & customer field settings
    let design = null;
    try {
      design = form.designSettings ? JSON.parse(form.designSettings) : null;
    } catch {}

    let customerFields = null;
    try {
      customerFields = form.customerFieldSettings ? JSON.parse(form.customerFieldSettings) : null;
    } catch {}

    return NextResponse.json({
      success: true,
      branch: {
        id: branch.id,
        name: branch.name,
        address: branch.address,
        description: branch.description,
        themeColor: design?.primaryColor || branch.themeColor || '#1E3A8A',
        businessName: branch.business.name,
        businessCategory: branch.business.category,
        businessLogoUrl: design?.logoUrl || branch.logoUrl || branch.business.logoUrl,
      },
      form: {
        id: form.id,
        title: form.title,
        description: form.description,
        version: form.version,
        welcomeMessage: form.welcomeMessage,
        thankYouMessage: form.thankYouMessage,
        submitButtonText: form.submitButtonText || 'Submit Feedback',
        privacyNotice: form.privacyNotice || 'Your feedback is private and protected.',
        designSettings: design,
        customerFieldSettings: customerFields,
        questions: form.questions.map((q) => ({
          id: q.id,
          text: q.text,
          description: q.description,
          type: q.type,
          required: q.required,
          positiveValue: q.positiveValue,
          options: q.options.map((opt) => ({
            id: opt.id,
            text: opt.text,
            value: opt.value,
          })),
        })),
      },
    });
  } catch (err: any) {
    console.error('Public review load error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;

    const body = await req.json();
    const { customerName, customerMobile, customerEmail, answers } = body;

    const branch = await prisma.branch.findUnique({
      where: { qrToken: token },
      include: { business: true },
    });

    if (!branch) {
      return NextResponse.json({ error: 'Invalid review session' }, { status: 404 });
    }

    // Verify owner license before accepting submission
    const licenseStatus = await getOwnerLicenseStatus(branch.business.ownerId);
    if (!licenseStatus.hasActiveLicense) {
      return NextResponse.json(
        {
          error: licenseStatus.status === 'EXPIRED'
            ? 'Review submissions are disabled because the business license has expired.'
            : 'Review submissions are temporarily suspended.',
          licenseStatus: licenseStatus.status,
        },
        { status: 403 }
      );
    }

    // Resolve the active published form assigned to THIS branch
    const assignment = await prisma.branchFormAssignment.findFirst({
      where: {
        branchId: branch.id,
        isActive: true,
        form: {
          status: 'PUBLISHED',
          isPublished: true,
        },
      },
      include: {
        form: {
          include: {
            questions: {
              where: { active: true },
              orderBy: { displayOrder: 'asc' },
              include: {
                options: { orderBy: { displayOrder: 'asc' } },
              },
            },
          },
        },
      },
    });

    if (!assignment || !assignment.form || assignment.form.questions.length === 0) {
      return NextResponse.json(
        { error: 'No active review form is available for this branch' },
        { status: 404 }
      );
    }

    const form = assignment.form;

    // Validate customer fields based on form's customerFieldSettings
    let customerFields: any = null;
    try {
      customerFields = form.customerFieldSettings ? JSON.parse(form.customerFieldSettings) : null;
    } catch {}

    const requireName = customerFields?.nameRequired !== false; // Default required
    const requireMobile = customerFields?.mobileRequired !== false; // Default required

    if (requireName && (!customerName || typeof customerName !== 'string' || !customerName.trim())) {
      return NextResponse.json({ error: 'Please provide your name' }, { status: 400 });
    }

    if (requireMobile && (!customerMobile || typeof customerMobile !== 'string' || !customerMobile.trim())) {
      return NextResponse.json({ error: 'Please provide your mobile number' }, { status: 400 });
    }

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      return NextResponse.json({ error: 'Please answer the feedback questions' }, { status: 400 });
    }

    // Validate required questions (cannot skip required questions)
    const answersMap = new Map<string, string>();
    for (const a of answers) {
      if (a.questionId && a.answerText !== undefined && a.answerText !== null && String(a.answerText).trim() !== '') {
        answersMap.set(a.questionId, String(a.answerText).trim());
      }
    }

    for (const q of form.questions) {
      if (q.required) {
        const provided = answersMap.get(q.id);
        if (!provided) {
          return NextResponse.json(
            { error: `"${q.text}" is required and cannot be skipped` },
            { status: 400 }
          );
        }
      }
    }

    // Upsert customer by mobile number (or temporary guest phone if mobile not required)
    const normalizedMobile = (customerMobile?.trim() || `anon_${Date.now()}`);
    const normalizedName = (customerName?.trim() || 'Guest Customer');

    let customer = await prisma.customer.findUnique({
      where: { mobile: normalizedMobile },
    });

    if (customer) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: normalizedName,
          email: customerEmail || customer.email,
          lastVisitAt: new Date(),
          totalReviews: { increment: 1 },
        },
      });
    } else {
      customer = await prisma.customer.create({
        data: {
          name: normalizedName,
          mobile: normalizedMobile,
          email: customerEmail || null,
        },
      });
    }

    // Format submitted answers with question definitions for classification
    const formattedAnswers = answers.map((a: any) => {
      const q = form.questions.find((x) => x.id === a.questionId);
      return {
        questionId: a.questionId,
        questionText: q?.text || a.questionText || 'Question',
        questionType: q?.type || a.questionType || 'TEXT',
        answerText: String(a.answerText || ''),
        numericValue: a.numericValue !== undefined ? Number(a.numericValue) : undefined,
      };
    });

    // Classify review using the form's configured policy and questions
    const processed = classifyReview(formattedAnswers, {
      policy: form.classificationPolicy as any,
      overallRatingQuestionId: form.overallRatingQuestionId,
      questions: form.questions.map((q) => ({
        id: q.id,
        type: q.type,
        positiveValue: q.positiveValue,
        options: q.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          value: opt.value,
          scoreClassification: opt.scoreClassification,
        })),
      })),
    });

    // Create immutable form snapshot for historical preservation
    const formSnapshot = JSON.stringify({
      formId: form.id,
      formName: form.name,
      formTitle: form.title,
      formVersion: form.version,
      classificationPolicy: form.classificationPolicy,
      questions: form.questions.map((q) => ({
        id: q.id,
        text: q.text,
        type: q.type,
        displayOrder: q.displayOrder,
      })),
    });

    // Save review
    const review = await prisma.review.create({
      data: {
        businessId: branch.businessId,
        branchId: branch.id,
        formId: form.id,
        formVersion: form.version,
        formSnapshot,
        customerId: customer.id,
        rating: processed.overallScore,
        sentiment: processed.sentiment,
        overallClassification: processed.sentiment,
        source: 'QR_SCAN',
        status: 'NEW',
        answers: {
          create: processed.classifiedAnswers.map((ca) => ({
            questionId: ca.questionId,
            questionText: ca.questionText,
            questionType: ca.questionType,
            answerText: ca.answerText,
            numericValue: ca.numericValue,
            classification: ca.classification,
          })),
        },
      },
    });

    // POOR REVIEW ALERT: trigger immediate notifications if classified as POOR
    if (processed.sentiment === 'POOR') {
      await triggerPoorReviewAlert({
        reviewId: review.id,
        businessId: branch.businessId,
        branchId: branch.id,
        businessName: branch.business.name,
        branchName: branch.name,
        customerName: customer.name,
        customerMobile: customer.mobile,
        rating: processed.overallScore,
      });
    }

    return NextResponse.json({
      success: true,
      message: form.thankYouMessage || 'Thank you for your valuable feedback!',
      sentiment: processed.sentiment,
      rating: processed.overallScore,
    });
  } catch (err: any) {
    console.error('Submit review error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
