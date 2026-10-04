"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitCustomerReview = exports.resolvePublicQrToken = void 0;
const functions = __importStar(require("firebase-functions"));
const config_1 = require("./config");
/**
 * Resolves a public QR token for customer review access.
 * Returns only the public branding and form definition.
 * Never exposes internal sensitive IDs or other reviews.
 */
exports.resolvePublicQrToken = functions.https.onCall(async (data) => {
    const { secureToken } = data;
    if (!secureToken) {
        throw new functions.https.HttpsError('invalid-argument', 'QR token is required.');
    }
    // 1. Look up QR code by secure token
    const qrSnap = await config_1.db
        .collection('qr_codes')
        .where('secure_token', '==', secureToken)
        .where('status', '==', 'active')
        .limit(1)
        .get();
    if (qrSnap.empty) {
        return {
            valid: false,
            reason: 'QR code is invalid or has been deactivated.'
        };
    }
    const qrData = qrSnap.docs[0].data();
    const { owner_id, business_id, branch_id } = qrData;
    // 2. Validate Owner License
    const licenseSnap = await config_1.db
        .collection('licenses')
        .where('owner_id', '==', owner_id)
        .where('status', 'in', ['trial', 'active'])
        .limit(1)
        .get();
    if (licenseSnap.empty) {
        return {
            valid: false,
            reason: 'Review submissions are currently unavailable (license inactive).'
        };
    }
    const licenseData = licenseSnap.docs[0].data();
    if (new Date(licenseData.expiry_date) < new Date()) {
        return {
            valid: false,
            reason: 'Review submissions are currently disabled because the subscription has expired.'
        };
    }
    // 3. Validate Business status
    const businessDoc = await config_1.db.collection('businesses').doc(business_id).get();
    if (!businessDoc.exists || businessDoc.data()?.status !== 'active') {
        return {
            valid: false,
            reason: 'This business is currently not accepting reviews.'
        };
    }
    const businessData = businessDoc.data();
    // 4. Validate Branch status
    const branchDoc = await config_1.db.collection('branches').doc(branch_id).get();
    if (!branchDoc.exists || branchDoc.data()?.status !== 'active') {
        return {
            valid: false,
            reason: 'This branch is currently inactive.'
        };
    }
    const branchData = branchDoc.data();
    // 5. Fetch published review form for this branch
    const formSnap = await config_1.db
        .collection('review_forms')
        .where('branch_id', '==', branch_id)
        .where('status', '==', 'published')
        .orderBy('published_version', 'desc')
        .limit(1)
        .get();
    if (formSnap.empty) {
        return {
            valid: false,
            reason: 'No published review form is available for this branch yet.'
        };
    }
    const formDoc = formSnap.docs[0];
    const formData = formDoc.data();
    // 6. Fetch pages
    const pagesSnap = await config_1.db
        .collection('review_form_pages')
        .where('form_id', '==', formDoc.id)
        .orderBy('display_order', 'asc')
        .get();
    const pages = pagesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // 7. Fetch active questions
    const questionsSnap = await config_1.db
        .collection('review_questions')
        .where('form_id', '==', formDoc.id)
        .where('active', '==', true)
        .orderBy('display_order', 'asc')
        .get();
    const questions = questionsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    // 8. Fetch question options for MCQ questions
    const questionIds = questions.map(q => q.id);
    let options = [];
    if (questionIds.length > 0) {
        // Firestore in-query batching (up to 30)
        const optionsSnap = await config_1.db
            .collection('question_options')
            .where('active', '==', true)
            .get();
        options = optionsSnap.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(o => questionIds.includes(o.question_id));
    }
    return {
        valid: true,
        branch: {
            name: branchData.name,
            description: branchData.description || '',
            logoUrl: branchData.logo_url || businessData.logo_url || '',
            themeColor: branchData.theme_color || '#2563EB'
        },
        business: {
            name: businessData.name,
            category: businessData.category
        },
        form: {
            id: formDoc.id,
            version: formData.published_version,
            name: formData.name,
            description: formData.description || '',
            pages,
            questions,
            options
        }
    };
});
/**
 * Handles customer review submission through trusted backend logic.
 * Enforces mandatory mobile number, validates answers, snapshots questions,
 * calculates deterministic classification, and dispatches poor review alerts.
 */
exports.submitCustomerReview = functions.https.onCall(async (data) => {
    const { secureToken, customerName, customerMobile, answers } = data;
    if (!secureToken) {
        throw new functions.https.HttpsError('invalid-argument', 'QR token is required.');
    }
    if (!customerMobile || customerMobile.trim().length < 10) {
        throw new functions.https.HttpsError('invalid-argument', 'A valid mandatory mobile number is required to submit feedback.');
    }
    const cleanMobile = customerMobile.trim();
    const cleanName = (customerName || 'Anonymous Guest').trim();
    // 1. Resolve QR Code
    const qrSnap = await config_1.db
        .collection('qr_codes')
        .where('secure_token', '==', secureToken)
        .where('status', '==', 'active')
        .limit(1)
        .get();
    if (qrSnap.empty) {
        throw new functions.https.HttpsError('not-found', 'Invalid or inactive QR code.');
    }
    const qrRecord = qrSnap.docs[0].data();
    const { owner_id, business_id, branch_id } = qrRecord;
    // 2. Validate License
    const licenseSnap = await config_1.db
        .collection('licenses')
        .where('owner_id', '==', owner_id)
        .where('status', 'in', ['trial', 'active'])
        .limit(1)
        .get();
    if (licenseSnap.empty) {
        throw new functions.https.HttpsError('failed-precondition', 'Submissions are currently disabled.');
    }
    const license = licenseSnap.docs[0].data();
    if (new Date(license.expiry_date) < new Date()) {
        throw new functions.https.HttpsError('failed-precondition', 'The business license has expired.');
    }
    // 3. Find published form
    const formSnap = await config_1.db
        .collection('review_forms')
        .where('branch_id', '==', branch_id)
        .where('status', '==', 'published')
        .orderBy('published_version', 'desc')
        .limit(1)
        .get();
    if (formSnap.empty) {
        throw new functions.https.HttpsError('not-found', 'Published form not found.');
    }
    const formDoc = formSnap.docs[0];
    const formData = formDoc.data();
    // 4. Fetch all active questions to validate and calculate score
    const questionsSnap = await config_1.db
        .collection('review_questions')
        .where('form_id', '==', formDoc.id)
        .where('active', '==', true)
        .get();
    const questionsMap = new Map();
    questionsSnap.docs.forEach(doc => {
        questionsMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    // Check required questions
    for (const [qId, q] of questionsMap.entries()) {
        if (q.required) {
            const given = (answers || {})[qId];
            if (given === undefined || given === null || given === '') {
                throw new functions.https.HttpsError('invalid-argument', `Question "${q.text}" is required.`);
            }
        }
    }
    // 5. Ingestion & Deterministic Classification:
    // GOOD = 3, OKAY = 2, POOR = 1
    let totalScore = 0;
    let scoredQuestionsCount = 0;
    const reviewAnswersToSave = [];
    for (const [qId, val] of Object.entries(answers || {})) {
        const question = questionsMap.get(qId);
        if (!question)
            continue;
        let sentiment = 'NONE';
        let itemScore;
        if (question.type === 'star') {
            const starVal = Number(val);
            if (starVal <= 2) {
                sentiment = 'POOR';
                itemScore = 1;
            }
            else if (starVal === 3) {
                sentiment = 'OKAY';
                itemScore = 2;
            }
            else {
                sentiment = 'GOOD';
                itemScore = 3;
            }
            totalScore += itemScore;
            scoredQuestionsCount++;
        }
        else if (question.type === 'good_okay_poor') {
            const strVal = String(val).toUpperCase();
            if (strVal === 'POOR') {
                sentiment = 'POOR';
                itemScore = 1;
            }
            else if (strVal === 'OKAY') {
                sentiment = 'OKAY';
                itemScore = 2;
            }
            else if (strVal === 'GOOD') {
                sentiment = 'GOOD';
                itemScore = 3;
            }
            if (itemScore) {
                totalScore += itemScore;
                scoredQuestionsCount++;
            }
        }
        else if (question.type === 'yes_no') {
            const boolVal = Boolean(val);
            const positiveVal = question.classification_config?.positiveAnswer ?? true;
            if (boolVal === positiveVal) {
                sentiment = 'GOOD';
                itemScore = 3;
            }
            else {
                sentiment = 'POOR';
                itemScore = 1;
            }
            totalScore += itemScore;
            scoredQuestionsCount++;
        }
        else if (question.type === 'text') {
            // Per constraints: Text answers do NOT affect numerical classification
            sentiment = 'NONE';
        }
        reviewAnswersToSave.push({
            question_id: qId,
            question_text_snapshot: question.text,
            question_type: question.type,
            answer_value: val,
            classification: sentiment,
            score: itemScore
        });
    }
    // Calculate Overall Classification
    let averageScore = 3.0;
    let overallClassification = 'GOOD';
    if (scoredQuestionsCount > 0) {
        averageScore = Number((totalScore / scoredQuestionsCount).toFixed(2));
        if (averageScore < 1.75) {
            overallClassification = 'POOR';
        }
        else if (averageScore < 2.5) {
            overallClassification = 'OKAY';
        }
        else {
            overallClassification = 'GOOD';
        }
    }
    const now = new Date().toISOString();
    // 6. Look up or create Customer record
    const customerQuery = await config_1.db
        .collection('customers')
        .where('owner_id', '==', owner_id)
        .where('mobile', '==', cleanMobile)
        .limit(1)
        .get();
    let customerId;
    if (!customerQuery.empty) {
        customerId = customerQuery.docs[0].id;
        await config_1.db.collection('customers').doc(customerId).update({
            name: cleanName,
            updated_at: now
        });
    }
    else {
        const customerRef = config_1.db.collection('customers').doc();
        customerId = customerRef.id;
        const newCustomer = {
            id: customerId,
            owner_id,
            name: cleanName,
            mobile: cleanMobile,
            created_at: now,
            updated_at: now
        };
        await customerRef.set(newCustomer);
    }
    // 7. Create Immutable Review Record
    const reviewRef = config_1.db.collection('reviews').doc();
    const reviewRecord = {
        id: reviewRef.id,
        owner_id,
        business_id,
        branch_id,
        form_id: formDoc.id,
        form_version: formData.published_version,
        qr_id: qrSnap.docs[0].id,
        customer_id: customerId,
        classification: overallClassification,
        average_score: averageScore,
        submitted_at: now,
        created_at: now
    };
    const batch = config_1.db.batch();
    batch.set(reviewRef, reviewRecord);
    // 8. Save Review Answers
    for (const ans of reviewAnswersToSave) {
        const ansRef = config_1.db.collection('review_answers').doc();
        batch.set(ansRef, {
            id: ansRef.id,
            review_id: reviewRef.id,
            ...ans
        });
    }
    await batch.commit();
    // 9. If POOR classification: Dispatch Notifications
    if (overallClassification === 'POOR') {
        await handlePoorReviewNotification({
            ownerId: owner_id,
            businessId: business_id,
            branchId: branch_id,
            reviewId: reviewRef.id,
            customerName: cleanName,
            averageScore
        });
    }
    return {
        success: true,
        message: 'Thank you for your feedback!'
    };
});
/**
 * Triggers in-app notification records and push notifications
 * for Owner, authorized Managers, and Super Managers.
 */
async function handlePoorReviewNotification(params) {
    const { ownerId, businessId, branchId, reviewId } = params;
    // Retrieve branch name
    const branchDoc = await config_1.db.collection('branches').doc(branchId).get();
    const branchName = branchDoc.data()?.name || 'Your Branch';
    const title = 'Poor Review Alert';
    const message = `A customer submitted a poor review for ${branchName}.`;
    const now = new Date().toISOString();
    // Create notification record
    const notifRef = config_1.db.collection('notifications').doc();
    await notifRef.set({
        id: notifRef.id,
        owner_id: ownerId,
        business_id: businessId,
        branch_id: branchId,
        review_id: reviewId,
        title,
        message,
        type: 'POOR_REVIEW_ALERT',
        created_at: now
    });
    // Find recipient users:
    // 1. Owner
    // 2. Managers assigned to this branch
    // 3. Super Managers assigned to this business/branch
    const recipients = new Set();
    recipients.add(ownerId);
    const accessSnap = await config_1.db
        .collection('user_access')
        .where('business_id', '==', businessId)
        .where('status', '==', 'active')
        .get();
    for (const doc of accessSnap.docs) {
        const acc = doc.data();
        // Must have RECEIVE_ALERTS or VIEW_REVIEWS
        const perms = acc.permissions || [];
        if (perms.includes('RECEIVE_ALERTS') || perms.includes('VIEW_REVIEWS')) {
            // If branch_id specified, must match branchId
            if (!acc.branch_id || acc.branch_id === branchId) {
                recipients.add(acc.user_id);
            }
        }
    }
    // Create recipient records
    const batch = config_1.db.batch();
    for (const userId of recipients) {
        const recRef = config_1.db.collection('notification_recipients').doc();
        batch.set(recRef, {
            id: recRef.id,
            notification_id: notifRef.id,
            user_id: userId,
            owner_id: ownerId,
            business_id: businessId,
            branch_id: branchId,
            status: 'UNREAD',
            created_at: now,
            updated_at: now
        });
    }
    await batch.commit();
    // Dispatch FCM push notifications to registered devices
    try {
        const devicesSnap = await config_1.db
            .collection('push_devices')
            .where('user_id', 'in', Array.from(recipients).slice(0, 30))
            .where('status', '==', 'active')
            .get();
        const tokens = devicesSnap.docs
            .map(d => d.data().device_token)
            .filter(Boolean);
        if (tokens.length > 0) {
            await config_1.messaging.sendEachForMulticast({
                tokens,
                notification: {
                    title,
                    body: message
                },
                data: {
                    review_id: reviewId,
                    business_id: businessId,
                    branch_id: branchId,
                    click_action: 'FLUTTER_NOTIFICATION_CLICK'
                }
            });
        }
    }
    catch (err) {
        console.error('Push notification delivery error:', err);
    }
}
//# sourceMappingURL=reviews.js.map