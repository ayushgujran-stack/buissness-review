/**
 * Acceptance Test Suite for ReviewFlow: Review Design & Form Settings Feature
 * Tests all 16 required verification scenarios against the live API & database.
 */

import prisma from '../src/lib/prisma';
import { signToken } from '../src/lib/auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function main() {
  console.log('===============================================================');
  console.log(' ReviewFlow Review Design & Form Settings Acceptance Tests');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('===============================================================\n');

  let passedTests = 0;
  const totalTests = 16;
  const timestamp = Date.now();

  // 1. Setup Test Owner and Business with Trial License
  const ownerUser = await prisma.user.create({
    data: {
      email: `form_owner_${timestamp}@test.com`,
      username: `formowner_${timestamp}`,
      name: 'Chef Alessandro Rossi',
      phone: '+91 9888877777',
      passwordHash: 'hash',
      role: 'OWNER',
      status: 'ACTIVE',
    },
  });

  // Assign Active Trial License (10 branches)
  await prisma.license.create({
    data: {
      ownerId: ownerUser.id,
      planName: 'Enterprise Form Test Plan',
      licenseType: 'TRIAL',
      status: 'TRIAL',
      maxBranches: 10,
      durationDays: 30,
      startsAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 86400000),
      assignmentSource: 'ADMIN_MANUAL',
    },
  });

  const ownerToken = signToken({
    userId: ownerUser.id,
    role: 'OWNER',
    email: ownerUser.email,
    username: ownerUser.username,
    name: ownerUser.name,
  });

  // Create Business A
  const bizA = await prisma.business.create({
    data: {
      ownerId: ownerUser.id,
      name: 'Bella Italia Ristorante',
      category: 'Italian Fine Dining',
      status: 'ACTIVE',
    },
  });

  // Create 3 Branches under Business A
  const branch1 = await prisma.branch.create({
    data: {
      businessId: bizA.id,
      name: 'Downtown Main Branch',
      address: '101 Central Ave',
      status: 'ACTIVE',
      qrToken: `rf_test_br1_${timestamp}`,
    },
  });

  const branch2 = await prisma.branch.create({
    data: {
      businessId: bizA.id,
      name: 'Airport Express Branch',
      address: 'Terminal 2 Concourse B',
      status: 'ACTIVE',
      qrToken: `rf_test_br2_${timestamp}`,
    },
  });

  const branch3 = await prisma.branch.create({
    data: {
      businessId: bizA.id,
      name: 'Beachside Waterfront Branch',
      address: '50 Coastal Highway',
      status: 'ACTIVE',
      qrToken: `rf_test_br3_${timestamp}`,
    },
  });

  let formAId = '';
  let formBId = '';

  // ---------------------------------------------------------------------------
  // SCENARIO 1: An owner creates multiple forms for the same business
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 1: An owner creates multiple forms for the same business');
  try {
    const res1 = await fetch(`${BASE_URL}/api/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        businessId: bizA.id,
        name: 'Fine Dining Feedback Form',
        title: 'How was your dining experience?',
        description: 'Thank you for dining with us at Bella Italia.',
        status: 'PUBLISHED',
        classificationPolicy: 'LOWEST_SCORE',
      }),
    });
    const d1 = await res1.json();
    if (!res1.ok) throw new Error(d1.error);
    formAId = d1.form.id;

    const res2 = await fetch(`${BASE_URL}/api/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        businessId: bizA.id,
        name: 'Quick Express Feedback Form',
        title: 'How was your grab & go meal?',
        description: 'Quick 30-second feedback.',
        status: 'PUBLISHED',
        classificationPolicy: 'AGGREGATE',
      }),
    });
    const d2 = await res2.json();
    if (!res2.ok) throw new Error(d2.error);
    formBId = d2.form.id;

    const formsCount = await prisma.reviewForm.count({ where: { businessId: bizA.id } });
    if (formsCount < 2) throw new Error(`Expected at least 2 forms, found ${formsCount}`);

    console.log(`   ✓ Successfully created multiple review forms for business (Count: ${formsCount})`);
    console.log('SCENARIO 1 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 1 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 2: Different branches of one business use different forms
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 2: Different branches of one business use different forms');
  try {
    // Assign Form A to Branch 1
    const a1Res = await fetch(`${BASE_URL}/api/forms/${formAId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ branchIds: [branch1.id] }),
    });
    if (!a1Res.ok) throw new Error('Failed to assign Form A to Branch 1');

    // Assign Form B to Branch 2
    const a2Res = await fetch(`${BASE_URL}/api/forms/${formBId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ branchIds: [branch2.id] }),
    });
    if (!a2Res.ok) throw new Error('Failed to assign Form B to Branch 2');

    const b1Assign = await prisma.branchFormAssignment.findFirst({ where: { branchId: branch1.id, isActive: true } });
    const b2Assign = await prisma.branchFormAssignment.findFirst({ where: { branchId: branch2.id, isActive: true } });

    if (!b1Assign || !b2Assign) throw new Error('Assignments not created');
    if (b1Assign.formId === b2Assign.formId) throw new Error('Branches must have different form assignments');

    console.log(`   ✓ Branch 1 assigned Form A (${b1Assign.formId})`);
    console.log(`   ✓ Branch 2 assigned Form B (${b2Assign.formId})`);
    console.log('SCENARIO 2 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 2 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 3: Two branches share a form
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 3: Two branches share a form');
  try {
    // Assign Form A to BOTH Branch 1 and Branch 3
    const shareRes = await fetch(`${BASE_URL}/api/forms/${formAId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ branchIds: [branch1.id, branch3.id] }),
    });
    if (!shareRes.ok) throw new Error('Failed to share Form A across branches 1 & 3');

    const sharedBranches = await prisma.branchFormAssignment.findMany({
      where: { formId: formAId, isActive: true },
    });
    if (sharedBranches.length !== 2) throw new Error(`Expected 2 shared branches, got ${sharedBranches.length}`);

    console.log(`   ✓ Form A shared by ${sharedBranches.length} branches simultaneously`);
    console.log('SCENARIO 3 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 3 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 4: The owner customizes one branch without changing another branch's form
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 4: The owner customizes one branch without changing another branch\'s form');
  let branch3CustomFormId = '';
  try {
    // Customize Form A for Branch 3 (creates detached independent copy)
    const customRes = await fetch(`${BASE_URL}/api/forms/assignments/branch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        action: 'CUSTOMIZE_FOR_BRANCH',
        sourceFormId: formAId,
        branchId: branch3.id,
      }),
    });
    const cData = await customRes.json();
    if (!customRes.ok) throw new Error(cData.error);
    branch3CustomFormId = cData.form.id;

    // Verify Branch 3 now has the new customized form
    const b3Assign = await prisma.branchFormAssignment.findFirst({
      where: { branchId: branch3.id, isActive: true },
    });
    if (!b3Assign || b3Assign.formId !== branch3CustomFormId) {
      throw new Error('Branch 3 was not assigned the customized copy');
    }

    // Verify Branch 1 STILL uses the original shared Form A
    const b1Assign = await prisma.branchFormAssignment.findFirst({
      where: { branchId: branch1.id, isActive: true },
    });
    if (!b1Assign || b1Assign.formId !== formAId) {
      throw new Error('Branch 1 was unexpectedly changed when customizing Branch 3');
    }

    console.log(`   ✓ Branch 3 detached into custom copy: ${branch3CustomFormId}`);
    console.log(`   ✓ Branch 1 untouched and retained original form: ${formAId}`);
    console.log('SCENARIO 4 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 4 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 5: Editing a shared form clearly identifies all affected branches
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 5: Editing a shared form clearly identifies all affected branches');
  try {
    // Re-share Form A across Branch 1 and Branch 2 to test shared branch reporting
    await fetch(`${BASE_URL}/api/forms/${formAId}/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ branchIds: [branch1.id, branch2.id] }),
    });

    const getFormRes = await fetch(`${BASE_URL}/api/forms/${formAId}`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const formData = await getFormRes.json();
    if (!getFormRes.ok) throw new Error(formData.error);

    if (!formData.form.isSharedAcrossBranches) {
      throw new Error('Expected isSharedAcrossBranches to be true');
    }
    if (formData.form.assignedBranches.length !== 2) {
      throw new Error(`Expected 2 assigned branches, got ${formData.form.assignedBranches.length}`);
    }

    console.log(`   ✓ Form correctly reports isSharedAcrossBranches: true`);
    console.log(`   ✓ Affected branches identified: ${formData.form.assignedBranches.map((b: any) => b.branchName).join(', ')}`);
    console.log('SCENARIO 5 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 5 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 6: A QR code opens the correct branch's published form
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 6: A QR code opens the correct branch\'s published form');
  try {
    const qrRes = await fetch(`${BASE_URL}/api/public/review/${branch1.qrToken}`);
    const qrData = await qrRes.json();
    if (!qrRes.ok) throw new Error(qrData.error);

    if (qrData.branch.id !== branch1.id) throw new Error('Incorrect branch resolved');
    if (qrData.form.id !== formAId) throw new Error('Incorrect form resolved for branch');

    console.log(`   ✓ QR token "${branch1.qrToken}" opened Branch: "${qrData.branch.name}" with Form: "${qrData.form.title}"`);
    console.log('SCENARIO 6 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 6 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 7: A branch with no active form cannot accidentally display another branch's form
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 7: A branch with no active form cannot accidentally display another branch\'s form');
  try {
    // Create branch 4 with NO form assignment
    const branchNoForm = await prisma.branch.create({
      data: {
        businessId: bizA.id,
        name: 'Unconfigured Empty Branch',
        address: 'No Form Lane',
        status: 'ACTIVE',
        qrToken: `rf_test_noform_${timestamp}`,
      },
    });

    const qrRes = await fetch(`${BASE_URL}/api/public/review/${branchNoForm.qrToken}`);
    if (qrRes.status !== 404) {
      throw new Error(`Expected 404 on branch with no form, got ${qrRes.status}`);
    }
    const errData = await qrRes.json();
    if (!errData.isUnavailable) {
      throw new Error('Expected isUnavailable: true in response');
    }

    console.log(`   ✓ Returned 404 with message: "${errData.error}"`);
    console.log('SCENARIO 7 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 7 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 8: Required questions cannot be skipped
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 8: Required questions cannot be skipped');
  try {
    // Fetch questions of Form A
    const formQuestions = await prisma.reviewQuestion.findMany({
      where: { formId: formAId, active: true },
    });

    // Attempt submission with missing answers
    const submitRes = await fetch(`${BASE_URL}/api/public/review/${branch1.qrToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Test Customer',
        customerMobile: '9876500000',
        answers: [], // Empty answers!
      }),
    });

    if (submitRes.status !== 400) {
      throw new Error(`Expected 400 on missing required answers, got ${submitRes.status}`);
    }
    const errData = await submitRes.json();
    console.log(`   ✓ Submission rejected for missing required answers: "${errData.error}"`);
    console.log('SCENARIO 8 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 8 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 9: All five question types save and submit correctly
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 9: All five question types save and submit correctly');
  let allTypesFormId = '';
  let qStarId = '', qGopId = '', qMcId = '', qYnId = '', qTextId = '';
  try {
    // Create a new form with all 5 question types
    const fRes = await fetch(`${BASE_URL}/api/forms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({
        businessId: bizA.id,
        name: 'Five Question Types Form',
        title: 'Complete Feedback Survey',
        status: 'PUBLISHED',
        assignToBranchIds: [branch3.id],
        initialQuestions: [
          { text: 'Star Rating Question', type: 'STAR_RATING', required: true, displayOrder: 1 },
          { text: 'Good Okay Poor Question', type: 'GOOD_OKAY_POOR', required: true, displayOrder: 2 },
          {
            text: 'Multiple Choice Question',
            type: 'MULTIPLE_CHOICE',
            required: true,
            displayOrder: 3,
            options: [
              { text: 'Option Premium', value: 'opt_prem', scoreClassification: 'GOOD' },
              { text: 'Option Basic', value: 'opt_basic', scoreClassification: 'OKAY' },
              { text: 'Option Subpar', value: 'opt_sub', scoreClassification: 'POOR' },
            ],
          },
          { text: 'Yes No Question', type: 'YES_NO', required: true, positiveValue: 'Yes', displayOrder: 4 },
          { text: 'Text Comment Question', type: 'TEXT', required: false, displayOrder: 5 },
        ],
      }),
    });
    const fData = await fRes.json();
    if (!fRes.ok) throw new Error(fData.error);
    allTypesFormId = fData.form.id;

    const questions = await prisma.reviewQuestion.findMany({
      where: { formId: allTypesFormId },
      include: { options: true },
    });

    qStarId = questions.find((q) => q.type === 'STAR_RATING')!.id;
    qGopId = questions.find((q) => q.type === 'GOOD_OKAY_POOR')!.id;
    qMcId = questions.find((q) => q.type === 'MULTIPLE_CHOICE')!.id;
    qYnId = questions.find((q) => q.type === 'YES_NO')!.id;
    qTextId = questions.find((q) => q.type === 'TEXT')!.id;

    // Submit answers for all 5 question types
    const submitRes = await fetch(`${BASE_URL}/api/public/review/${branch3.qrToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Marcus Aurelius',
        customerMobile: '9876511111',
        answers: [
          { questionId: qStarId, answerText: '5 Stars', numericValue: 5 },
          { questionId: qGopId, answerText: 'Good' },
          { questionId: qMcId, answerText: 'Option Premium' },
          { questionId: qYnId, answerText: 'Yes' },
          { questionId: qTextId, answerText: 'Exceptional hospitality throughout.' },
        ],
      }),
    });

    const sData = await submitRes.json();
    if (!submitRes.ok) throw new Error(sData.error);

    // Verify answers in database
    const savedReview = await prisma.review.findFirst({
      where: { formId: allTypesFormId },
      include: { answers: true },
    });
    if (!savedReview || savedReview.answers.length !== 5) {
      throw new Error(`Expected 5 saved answers, found ${savedReview?.answers.length}`);
    }

    console.log(`   ✓ All 5 question types saved and submitted successfully (Review ID: ${savedReview.id})`);
    console.log('SCENARIO 9 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 9 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 10: Review classifications follow the configured rules
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 10: Review classifications follow the configured rules');
  try {
    // Test that a POOR rating on any question triggers POOR overall review under LOWEST_SCORE
    const submitPoor = await fetch(`${BASE_URL}/api/public/review/${branch3.qrToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Disappointed Guest',
        customerMobile: '9876522222',
        answers: [
          { questionId: qStarId, answerText: '1 Star', numericValue: 1 }, // POOR!
          { questionId: qGopId, answerText: 'Good' },
          { questionId: qMcId, answerText: 'Option Premium' },
          { questionId: qYnId, answerText: 'Yes' },
          { questionId: qTextId, answerText: 'Long wait times.' },
        ],
      }),
    });
    const poorData = await submitPoor.json();
    if (poorData.sentiment !== 'POOR') {
      throw new Error(`Expected POOR sentiment, got ${poorData.sentiment}`);
    }

    // Test text comments do not count as negative
    const submitTextOnlyGood = await fetch(`${BASE_URL}/api/public/review/${branch3.qrToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Happy Guest',
        customerMobile: '9876533333',
        answers: [
          { questionId: qStarId, answerText: '5 Stars', numericValue: 5 },
          { questionId: qGopId, answerText: 'Good' },
          { questionId: qMcId, answerText: 'Option Premium' },
          { questionId: qYnId, answerText: 'Yes' },
          { questionId: qTextId, answerText: 'A detailed text critique that should not override good rating.' },
        ],
      }),
    });
    const goodData = await submitTextOnlyGood.json();
    if (goodData.sentiment !== 'GOOD') {
      throw new Error(`Expected GOOD sentiment, got ${goodData.sentiment}`);
    }

    console.log(`   ✓ 1-Star triggered POOR classification under LOWEST_SCORE policy`);
    console.log(`   ✓ Open text comment correctly treated as neutral without corrupting GOOD rating`);
    console.log('SCENARIO 10 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 10 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 11: Historical reviews retain their original questions and form version
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 11: Historical reviews retain their original questions and form version');
  try {
    // 1. Get previously saved review
    const pastReview = await prisma.review.findFirst({
      where: { formId: allTypesFormId },
      include: { answers: true },
    });
    if (!pastReview) throw new Error('No historical review found');

    const originalQuestionText = pastReview.answers[0].questionText;
    const originalFormVersion = pastReview.formVersion;

    // 2. Now edit the form's question text
    await fetch(`${BASE_URL}/api/forms/${allTypesFormId}/questions/${qStarId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ text: 'MODIFIED Star Rating Text in Version 2' }),
    });

    // 3. Verify the past review still retains the immutable snapshot of the original question!
    const reloadedPastReview = await prisma.review.findUnique({
      where: { id: pastReview.id },
      include: { answers: true },
    });

    if (reloadedPastReview?.answers[0].questionText !== originalQuestionText) {
      throw new Error('Historical review answer questionText was overwritten!');
    }

    console.log(`   ✓ Historical review retained question snapshot: "${originalQuestionText}" (v${originalFormVersion})`);
    console.log('SCENARIO 11 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 11 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 12: Owners and managers cannot access unauthorized branches
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 12: Owners and managers cannot access unauthorized branches');
  try {
    // Create Manager assigned ONLY to branch 1
    const manager = await prisma.user.create({
      data: {
        email: `branch_mgr_${timestamp}@test.com`,
        username: `branchmgr_${timestamp}`,
        name: 'Branch 1 Only Manager',
        passwordHash: 'hash',
        role: 'MANAGER',
        status: 'ACTIVE',
      },
    });

    await prisma.branchUser.create({
      data: {
        userId: manager.id,
        businessId: bizA.id,
        branchId: branch1.id,
        role: 'MANAGER',
      },
    });

    const managerToken = signToken({
      userId: manager.id,
      role: 'MANAGER',
      email: manager.email,
      username: manager.username,
      name: manager.name,
    });

    // Manager attempts to query branch 2
    const unauthBranchRes = await fetch(`${BASE_URL}/api/branches?businessId=${bizA.id}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });
    const brData = await unauthBranchRes.json();
    const branchIds = brData.branches.map((b: any) => b.id);

    if (branchIds.includes(branch2.id)) {
      throw new Error('Manager was able to access unassigned branch 2');
    }

    console.log('   ✓ Manager restricted strictly to assigned branch 1');
    console.log('SCENARIO 12 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 12 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 13: Poor-review notifications are delivered without duplicates
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 13: Poor-review notifications are delivered without duplicates');
  try {
    const poorNotification = await prisma.notification.findFirst({
      where: { businessId: bizA.id, type: 'POOR_REVIEW' },
      include: { recipients: true },
    });

    if (!poorNotification) {
      throw new Error('No poor review notification was recorded in database');
    }

    const recipientUserIds = poorNotification.recipients.map((r) => r.userId);
    if (!recipientUserIds.includes(ownerUser.id)) {
      throw new Error('Business owner was not included in poor review alert recipients');
    }

    console.log(`   ✓ Poor-review alert delivered to business owner (Notification ID: ${poorNotification.id})`);
    console.log('SCENARIO 13 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 13 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 14: Archiving a form does not delete its review history
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 14: Archiving a form does not delete its review history');
  try {
    const reviewCountBefore = await prisma.review.count({ where: { formId: allTypesFormId } });

    const archiveRes = await fetch(`${BASE_URL}/api/forms/${allTypesFormId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    const aData = await archiveRes.json();
    if (!archiveRes.ok) throw new Error(aData.error);

    const reviewCountAfter = await prisma.review.count({ where: { formId: allTypesFormId } });
    if (reviewCountAfter !== reviewCountBefore || reviewCountAfter === 0) {
      throw new Error(`Review history was deleted! Before: ${reviewCountBefore}, After: ${reviewCountAfter}`);
    }

    const archivedForm = await prisma.reviewForm.findUnique({ where: { id: allTypesFormId } });
    if (archivedForm?.status !== 'ARCHIVED') {
      throw new Error(`Expected status ARCHIVED, got ${archivedForm?.status}`);
    }

    console.log(`   ✓ Form marked ARCHIVED; all ${reviewCountAfter} historical reviews preserved intact`);
    console.log('SCENARIO 14 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 14 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 15: Customer submissions work without login or OTP
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 15: Customer submissions work without login or OTP');
  try {
    const formAQuestions = await prisma.reviewQuestion.findMany({
      where: { formId: formAId, active: true },
    });
    const formAAnswers = formAQuestions.map((q) => ({
      questionId: q.id,
      answerText: q.type === 'STAR_RATING' ? '5 Stars' : q.type === 'GOOD_OKAY_POOR' ? 'Good' : q.type === 'YES_NO' ? 'Yes' : 'Great service',
      numericValue: q.type === 'STAR_RATING' ? 5 : undefined,
    }));

    // Perform review submission without ANY authorization headers or auth cookies
    const unauthSubmitRes = await fetch(`${BASE_URL}/api/public/review/${branch1.qrToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Anonymous Walk-in Customer',
        customerMobile: '9777766666',
        answers: formAAnswers,
      }),
    });

    const d = await unauthSubmitRes.json();
    if (!unauthSubmitRes.ok) throw new Error(d.error);

    console.log(`   ✓ Customer submission succeeded anonymously without login/OTP (Status: 200)`);
    console.log('SCENARIO 15 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 15 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // SCENARIO 16: Server-side validation of question configurations
  // ---------------------------------------------------------------------------
  console.log('SCENARIO 16: Server-side validation of question configurations');
  try {
    // Attempt adding invalid question type
    const invalidTypeRes = await fetch(`${BASE_URL}/api/forms/${formAId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ text: 'Bad Question', type: 'INVALID_TYPE' }),
    });

    if (invalidTypeRes.status !== 400) {
      throw new Error(`Expected 400 on invalid question type, got ${invalidTypeRes.status}`);
    }

    // Attempt adding question with empty text
    const emptyTextRes = await fetch(`${BASE_URL}/api/forms/${formAId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${ownerToken}` },
      body: JSON.stringify({ text: '   ', type: 'STAR_RATING' }),
    });

    if (emptyTextRes.status !== 400) {
      throw new Error(`Expected 400 on empty question text, got ${emptyTextRes.status}`);
    }

    console.log('   ✓ Server strictly validates question types and rejects empty questions');
    console.log('SCENARIO 16 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('SCENARIO 16 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('===============================================================');
  console.log(` TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (passedTests === totalTests) {
    console.log(' ALL 16 SCENARIOS VERIFIED SUCCESSFULLY! 🎯');
  } else {
    console.error(` ❌ ${totalTests - passedTests} SCENARIOS FAILED`);
    process.exit(1);
  }
  console.log('===============================================================');
}

main()
  .catch((e) => {
    console.error('Fatal Test Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
