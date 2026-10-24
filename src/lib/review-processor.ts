import prisma from './prisma';

export interface SubmittedAnswer {
  questionId: string;
  questionText: string;
  questionType: string;
  answerText: string;
  numericValue?: number;
}

export interface QuestionDefinition {
  id: string;
  type: string;
  text?: string;
  positiveValue?: string | null;
  options?: Array<{
    id?: string;
    text: string;
    value: string;
    scoreClassification: string;
  }>;
}

export interface ClassifyReviewOptions {
  policy?: 'LOWEST_SCORE' | 'OVERALL_QUESTION' | 'AGGREGATE';
  overallRatingQuestionId?: string | null;
  questions?: QuestionDefinition[];
}

export interface ReviewProcessingResult {
  overallScore: number;
  sentiment: 'GOOD' | 'OKAY' | 'POOR';
  classifiedAnswers: {
    questionId: string;
    questionText: string;
    questionType: string;
    answerText: string;
    numericValue?: number;
    classification: 'GOOD' | 'OKAY' | 'POOR' | 'NEUTRAL';
  }[];
}

export function classifyReview(
  answers: SubmittedAnswer[],
  options?: ClassifyReviewOptions
): ReviewProcessingResult {
  const policy = options?.policy || 'LOWEST_SCORE';
  const overallRatingQuestionId = options?.overallRatingQuestionId;
  const questionsMap = new Map<string, QuestionDefinition>();

  if (options?.questions) {
    for (const q of options.questions) {
      questionsMap.set(q.id, q);
    }
  }

  let totalScorePoints = 0;
  let scorableCount = 0;

  const classifiedAnswers = answers.map((ans) => {
    let classification: 'GOOD' | 'OKAY' | 'POOR' | 'NEUTRAL' = 'NEUTRAL';
    let numericValue = ans.numericValue;
    const qDef = questionsMap.get(ans.questionId);

    if (ans.questionType === 'STAR_RATING') {
      const stars = numericValue || parseInt(ans.answerText, 10) || 5;
      numericValue = stars;
      if (stars <= 2) {
        classification = 'POOR';
        totalScorePoints += (stars / 5) * 100;
        scorableCount++;
      } else if (stars === 3) {
        classification = 'OKAY';
        totalScorePoints += 60;
        scorableCount++;
      } else {
        classification = 'GOOD';
        totalScorePoints += (stars / 5) * 100;
        scorableCount++;
      }
    } else if (ans.questionType === 'GOOD_OKAY_POOR') {
      const val = ans.answerText.trim().toUpperCase();
      if (val === 'POOR') {
        classification = 'POOR';
        numericValue = 1;
        totalScorePoints += 20;
        scorableCount++;
      } else if (val === 'OKAY') {
        classification = 'OKAY';
        numericValue = 3;
        totalScorePoints += 60;
        scorableCount++;
      } else if (val === 'GOOD') {
        classification = 'GOOD';
        numericValue = 5;
        totalScorePoints += 100;
        scorableCount++;
      }
    } else if (ans.questionType === 'YES_NO') {
      const positiveValue = (qDef?.positiveValue || 'Yes').trim().toLowerCase();
      const val = ans.answerText.trim().toLowerCase();
      if (val === positiveValue) {
        classification = 'GOOD';
        numericValue = 5;
        totalScorePoints += 100;
        scorableCount++;
      } else {
        classification = 'POOR';
        numericValue = 1;
        totalScorePoints += 20;
        scorableCount++;
      }
    } else if (ans.questionType === 'MULTIPLE_CHOICE') {
      const rawText = ans.answerText.trim();
      let matchedOpt = qDef?.options?.find(
        (o) => o.text.trim().toLowerCase() === rawText.toLowerCase() || o.value.trim().toLowerCase() === rawText.toLowerCase()
      );

      if (matchedOpt && matchedOpt.scoreClassification) {
        classification = matchedOpt.scoreClassification as any;
        if (classification === 'GOOD') {
          numericValue = 5;
          totalScorePoints += 100;
          scorableCount++;
        } else if (classification === 'OKAY') {
          numericValue = 3;
          totalScorePoints += 60;
          scorableCount++;
        } else if (classification === 'POOR') {
          numericValue = 1;
          totalScorePoints += 20;
          scorableCount++;
        } else {
          classification = 'NEUTRAL';
        }
      } else {
        const textLower = rawText.toLowerCase();
        if (textLower.includes('excellent') || textLower.includes('great') || textLower.includes('clean') || textLower.includes('fast') || textLower.includes('polite')) {
          classification = 'GOOD';
          numericValue = 5;
          totalScorePoints += 100;
          scorableCount++;
        } else if (textLower.includes('bad') || textLower.includes('poor') || textLower.includes('slow') || textLower.includes('dirty') || textLower.includes('rude')) {
          classification = 'POOR';
          numericValue = 1;
          totalScorePoints += 20;
          scorableCount++;
        } else {
          classification = 'OKAY';
          numericValue = 3;
          totalScorePoints += 60;
          scorableCount++;
        }
      }
    } else {
      // TEXT questions are comments - must NOT automatically be treated as negative or positive!
      classification = 'NEUTRAL';
    }

    return {
      ...ans,
      numericValue,
      classification,
    };
  });

  // Calculate overall score (normalized 1 to 5)
  let overallRating = 5.0;
  if (scorableCount > 0) {
    const avgScorePct = totalScorePoints / scorableCount;
    overallRating = parseFloat((((avgScorePct / 100) * 4) + 1).toFixed(1));
  }

  let overallSentiment: 'GOOD' | 'OKAY' | 'POOR' = 'GOOD';

  if (policy === 'OVERALL_QUESTION') {
    // Designated rating question dictates the classification
    let designated = classifiedAnswers.find((a) => a.questionId === overallRatingQuestionId);
    if (!designated) {
      designated = classifiedAnswers.find((a) => a.questionType === 'STAR_RATING' || a.questionType === 'GOOD_OKAY_POOR');
    }
    if (designated && designated.classification !== 'NEUTRAL') {
      overallSentiment = designated.classification as 'GOOD' | 'OKAY' | 'POOR';
    } else {
      // Fallback to lowest score if designated not available
      const hasPoor = classifiedAnswers.some((a) => a.classification === 'POOR');
      const hasOkay = classifiedAnswers.some((a) => a.classification === 'OKAY');
      overallSentiment = hasPoor ? 'POOR' : (hasOkay ? 'OKAY' : 'GOOD');
    }
  } else if (policy === 'AGGREGATE') {
    // Aggregate percentage of classified answers
    if (scorableCount === 0) {
      overallSentiment = 'GOOD';
    } else if (overallRating <= 2.5) {
      overallSentiment = 'POOR';
    } else if (overallRating <= 3.7) {
      overallSentiment = 'OKAY';
    } else {
      overallSentiment = 'GOOD';
    }
  } else {
    // Default: LOWEST_SCORE
    // If ANY answer is POOR -> overall is POOR
    // Else if ANY answer is OKAY -> overall is OKAY
    // Else GOOD
    const hasPoor = classifiedAnswers.some((a) => a.classification === 'POOR');
    const hasOkay = classifiedAnswers.some((a) => a.classification === 'OKAY');
    if (hasPoor) {
      overallSentiment = 'POOR';
    } else if (hasOkay) {
      overallSentiment = 'OKAY';
    } else {
      overallSentiment = 'GOOD';
    }
  }

  return {
    overallScore: overallRating,
    sentiment: overallSentiment,
    classifiedAnswers,
  };
}

export async function triggerPoorReviewAlert(params: {
  reviewId: string;
  businessId: string;
  branchId: string;
  businessName: string;
  branchName: string;
  customerName: string;
  customerMobile: string;
  rating: number;
}): Promise<void> {
  const { reviewId, businessId, branchId, businessName, branchName, customerName, customerMobile, rating } = params;

  // Prevent duplicate notification for the same reviewId
  const existingNotification = await prisma.notification.findFirst({
    where: { reviewId },
  });
  if (existingNotification) return;

  // Find business owner
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { ownerId: true },
  });

  if (!business) return;

  // Find assigned branch manager and super managers
  const branchUsers = await prisma.branchUser.findMany({
    where: {
      businessId,
      OR: [
        { branchId },
        { branchId: null, role: 'SUPER_MANAGER' },
      ],
    },
    include: {
      permissions: true,
    },
  });

  // Collect recipient user IDs: Owner + authorized managers who have RECEIVE_ALERTS permission
  const recipientUserIds = new Set<string>();
  recipientUserIds.add(business.ownerId);

  for (const bu of branchUsers) {
    const hasAlertPermission = bu.permissions.some(
      (p) => p.permission === 'RECEIVE_ALERTS' && p.granted
    );
    if (hasAlertPermission || bu.permissions.length === 0) {
      recipientUserIds.add(bu.userId);
    }
  }

  // Create notification record
  const notification = await prisma.notification.create({
    data: {
      type: 'POOR_REVIEW',
      title: 'Poor Review Alert',
      body: `A customer submitted a poor review for ${businessName} — ${branchName}.`,
      businessId,
      branchId,
      reviewId,
      status: 'UNREAD',
      metadata: JSON.stringify({
        customerName,
        customerMobile,
        rating,
        branchName,
        businessName,
      }),
      recipients: {
        create: Array.from(recipientUserIds).map((userId) => ({
          userId,
          isRead: false,
        })),
      },
    },
  });

  // Record audit log
  await prisma.auditLog.create({
    data: {
      role: 'SYSTEM',
      action: 'POOR_REVIEW_ALERT_TRIGGERED',
      entityType: 'REVIEW',
      entityId: reviewId,
      details: JSON.stringify({
        notificationId: notification.id,
        recipientsCount: recipientUserIds.size,
        branch: branchName,
      }),
    },
  });
}
