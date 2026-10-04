import * as admin from 'firebase-admin';

// Initialize Firebase Admin once
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();
export const messaging = admin.messaging();

export const CONFIG = {
  isEmulator: Boolean(process.env.FUNCTIONS_EMULATOR || process.env.FIRESTORE_EMULATOR_HOST),
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_reviewflow_mock',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'test_secret_mock_12345',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'webhook_secret_mock_12345'
  },
  defaultTrialDays: 15,
  defaultTrialBranchLimit: 3
};
