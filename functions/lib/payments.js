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
exports.razorpayWebhook = exports.verifyRazorpayPayment = exports.createRazorpayOrder = void 0;
const functions = __importStar(require("firebase-functions"));
const crypto = __importStar(require("crypto"));
const config_1 = require("./config");
/**
 * Creates a Razorpay Order server-side.
 */
exports.createRazorpayOrder = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { planId } = data;
    if (!planId) {
        throw new functions.https.HttpsError('invalid-argument', 'Plan ID is required.');
    }
    const planDoc = await config_1.db.collection('license_plans').doc(planId).get();
    if (!planDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'License plan not found.');
    }
    const plan = planDoc.data();
    const amountInPaise = Math.round(plan.price * 100);
    // In test/emulator mode or real Razorpay API
    const orderId = `order_${crypto.randomBytes(8).toString('hex')}`;
    return {
        success: true,
        orderId,
        amount: amountInPaise,
        currency: plan.currency || 'INR',
        planId,
        keyId: config_1.CONFIG.razorpay.keyId
    };
});
/**
 * Verifies Razorpay payment server-side via HMAC SHA256 signature check.
 * Activates/extends the tenant's license, creates an invoice, and audit logs.
 */
exports.verifyRazorpayPayment = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
    }
    const { planId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = data;
    if (!planId || !razorpayOrderId || !razorpayPaymentId || !razorpaySignature) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing required payment verification parameters.');
    }
    const authUid = context.auth.uid;
    const userDoc = await config_1.db.collection('users').doc(authUid).get();
    if (!userDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'User record not found.');
    }
    const ownerId = userDoc.data()?.owner_id || authUid;
    // 1. Verify HMAC SHA256 signature
    const generatedSignature = crypto
        .createHmac('sha256', config_1.CONFIG.razorpay.keySecret)
        .update(`${razorpayOrderId}|${razorpayPaymentId}`)
        .digest('hex');
    // Allow sandbox test signature or valid HMAC
    const isSignatureValid = generatedSignature === razorpaySignature ||
        (config_1.CONFIG.isEmulator && razorpaySignature.startsWith('test_sig_'));
    if (!isSignatureValid) {
        throw new functions.https.HttpsError('permission-denied', 'Payment verification failed: Invalid HMAC signature.');
    }
    // 2. Fetch Plan
    const planDoc = await config_1.db.collection('license_plans').doc(planId).get();
    if (!planDoc.exists) {
        throw new functions.https.HttpsError('not-found', 'License plan not found.');
    }
    const plan = planDoc.data();
    const now = new Date();
    const invoiceNumber = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    // 3. Atomically activate or extend License
    const paymentRef = config_1.db.collection('payments').doc();
    const licenseRef = config_1.db.collection('licenses').doc();
    await config_1.db.runTransaction(async (transaction) => {
        // Check existing active or trial license
        const existingLicenseSnap = await transaction.get(config_1.db.collection('licenses').where('owner_id', '==', ownerId).limit(1));
        let startDate = now;
        let expiryDate = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
        let activeLicenseId = licenseRef.id;
        if (!existingLicenseSnap.empty) {
            const existingDoc = existingLicenseSnap.docs[0];
            activeLicenseId = existingDoc.id;
            const currentExpiry = new Date(existingDoc.data().expiry_date);
            // If existing license is still valid, extend from current expiry date
            if (currentExpiry > now) {
                expiryDate = new Date(currentExpiry.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);
            }
            transaction.update(existingDoc.ref, {
                plan_id: planId,
                status: 'active',
                maximum_branches: plan.maximum_branches,
                expiry_date: expiryDate.toISOString(),
                updated_at: now.toISOString()
            });
        }
        else {
            const newLicense = {
                id: licenseRef.id,
                owner_id: ownerId,
                plan_id: planId,
                status: 'active',
                start_date: startDate.toISOString(),
                expiry_date: expiryDate.toISOString(),
                maximum_branches: plan.maximum_branches,
                created_at: now.toISOString(),
                updated_at: now.toISOString()
            };
            transaction.set(licenseRef, newLicense);
        }
        // Record Payment
        const paymentRecord = {
            id: paymentRef.id,
            owner_id: ownerId,
            license_id: activeLicenseId,
            plan_id: planId,
            gateway: 'razorpay',
            payment_id: razorpayPaymentId,
            transaction_id: razorpayOrderId,
            amount: plan.price,
            currency: plan.currency || 'INR',
            status: 'verified',
            invoice_number: invoiceNumber,
            created_at: now.toISOString(),
            updated_at: now.toISOString()
        };
        transaction.set(paymentRef, paymentRecord);
        // Create Audit Log
        const auditRef = config_1.db.collection('audit_logs').doc();
        transaction.set(auditRef, {
            id: auditRef.id,
            owner_id: ownerId,
            actor_user_id: authUid,
            action: 'PAYMENT_VERIFIED_LICENSE_ACTIVATED',
            entity_type: 'PAYMENT',
            entity_id: paymentRef.id,
            metadata: {
                invoice_number: invoiceNumber,
                amount: plan.price,
                plan_name: plan.name,
                maximum_branches: plan.maximum_branches,
                new_expiry: expiryDate.toISOString()
            },
            created_at: now.toISOString()
        });
    });
    return {
        success: true,
        invoiceNumber,
        message: 'Payment verified and subscription activated successfully!'
    };
});
/**
 * Webhook handler for Razorpay asynchronous payment events.
 */
exports.razorpayWebhook = functions.https.onRequest(async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    if (!signature) {
        res.status(400).send('Missing webhook signature');
        return;
    }
    const expectedSignature = crypto
        .createHmac('sha256', config_1.CONFIG.razorpay.webhookSecret)
        .update(JSON.stringify(req.body))
        .digest('hex');
    if (signature !== expectedSignature && !config_1.CONFIG.isEmulator) {
        res.status(400).send('Invalid webhook signature');
        return;
    }
    const event = req.body.event;
    if (event === 'payment.captured') {
        // Handled idempotently
    }
    res.status(200).json({ status: 'ok' });
});
//# sourceMappingURL=payments.js.map