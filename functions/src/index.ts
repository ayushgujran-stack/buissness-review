import * as functions from 'firebase-functions';
import { createBranch } from './branch';
import { resolvePublicQrToken, submitCustomerReview } from './reviews';
import { createRazorpayOrder, verifyRazorpayPayment, razorpayWebhook } from './payments';
import { runDemoSeed } from './seed';

// Export Cloud Functions
export {
  createBranch,
  resolvePublicQrToken,
  submitCustomerReview,
  createRazorpayOrder,
  verifyRazorpayPayment,
  razorpayWebhook
};

/**
 * Callable function for Super Admin / Dev mode to seed the Raj demo environment
 */
export const seedDemoData = functions.https.onCall(async (data, context) => {
  // Allow if running in emulator or user is Super Admin
  const isSuperAdmin = context.auth?.token?.role === 'SUPER_ADMIN' || !context.auth;
  if (!isSuperAdmin && process.env.NODE_ENV === 'production') {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only Super Admin can trigger demo data seeding.'
    );
  }

  const result = await runDemoSeed();
  return result;
});
