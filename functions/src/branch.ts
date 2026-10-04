import * as functions from 'firebase-functions';
import * as crypto from 'crypto';
import { db } from './config';
import { Branch, License, QrCodeRecord } from './types';

/**
 * Atomically creates a branch after verifying the Owner's active license capacity.
 * Enforces transaction-safe branch limits across ALL businesses belonging to the tenant.
 */
export const createBranch = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to create a branch.'
    );
  }

  const { businessId, name, address, phone, description, logoUrl, themeColor } = data;

  if (!businessId || !name) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Business ID and Branch Name are required.'
    );
  }

  const authUid = context.auth.uid;

  // Retrieve user record to identify role and ownerId
  const userDoc = await db.collection('users').doc(authUid).get();
  if (!userDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'User record not found.');
  }

  const userData = userDoc.data();
  const ownerId = userData?.owner_id || authUid;
  const userRole = userData?.role;

  // Verify permission: Only Owner or Admin with MANAGE_BRANCH can create a branch
  if (userRole !== 'OWNER' && userRole !== 'SUPER_ADMIN') {
    // Check user_access for MANAGE_BRANCH permission
    const accessQuery = await db
      .collection('user_access')
      .where('user_id', '==', authUid)
      .where('business_id', '==', businessId)
      .where('status', '==', 'active')
      .get();

    const hasPermission = accessQuery.docs.some(doc =>
      (doc.data().permissions || []).includes('MANAGE_BRANCH')
    );

    if (!hasPermission) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'User lacks MANAGE_BRANCH permission for this business.'
      );
    }
  }

  // Verify business belongs to the same tenant
  const businessDoc = await db.collection('businesses').doc(businessId).get();
  if (!businessDoc.exists || businessDoc.data()?.owner_id !== ownerId) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Business not found or does not belong to your tenant.'
    );
  }

  const newBranchRef = db.collection('branches').doc();
  const newQrRef = db.collection('qr_codes').doc();
  const now = new Date().toISOString();

  // Generate cryptographic secure token for public QR scanning
  const secureToken = crypto.randomBytes(16).toString('hex');

  // Execute inside an atomic transaction
  await db.runTransaction(async transaction => {
    // 1. Get active license for the tenant
    const licenseQuery = db
      .collection('licenses')
      .where('owner_id', '==', ownerId)
      .where('status', 'in', ['trial', 'active']);

    const licenseSnap = await transaction.get(licenseQuery);

    if (licenseSnap.empty) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'No active or trial license found. Please activate a license to create branches.'
      );
    }

    const licenseData = licenseSnap.docs[0].data() as License;
    const maxBranches = licenseData.maximum_branches || 1;

    // Check expiry
    if (new Date(licenseData.expiry_date) < new Date()) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'Your license has expired. Please renew your subscription to add branches.'
      );
    }

    // 2. Count all active branches for this owner across ALL businesses
    const branchesQuery = db
      .collection('branches')
      .where('owner_id', '==', ownerId)
      .where('status', '==', 'active');

    const branchesSnap = await transaction.get(branchesQuery);
    const activeBranchCount = branchesSnap.size;

    if (activeBranchCount >= maxBranches) {
      throw new functions.https.HttpsError(
        'resource-exhausted',
        `Branch limit of ${maxBranches} reached across your businesses. Upgrade your license to add another branch.`
      );
    }

    // 3. Atomically create the branch
    const branchRecord: Branch = {
      id: newBranchRef.id,
      owner_id: ownerId,
      business_id: businessId,
      name,
      address: address || '',
      phone: phone || '',
      description: description || '',
      logo_url: logoUrl || '',
      theme_color: themeColor || '#2563EB',
      status: 'active',
      created_at: now,
      updated_at: now
    };

    transaction.set(newBranchRef, branchRecord);

    // 4. Create initial default QR code record with secure token
    const qrRecord: QrCodeRecord = {
      id: newQrRef.id,
      owner_id: ownerId,
      business_id: businessId,
      branch_id: newBranchRef.id,
      secure_token: secureToken,
      status: 'active',
      created_at: now
    };

    transaction.set(newQrRef, qrRecord);

    // 5. Create audit log
    const auditRef = db.collection('audit_logs').doc();
    transaction.set(auditRef, {
      id: auditRef.id,
      owner_id: ownerId,
      actor_user_id: authUid,
      action: 'BRANCH_CREATED',
      entity_type: 'BRANCH',
      entity_id: newBranchRef.id,
      metadata: {
        branch_name: name,
        business_id: businessId,
        total_active_branches: activeBranchCount + 1,
        branch_limit: maxBranches
      },
      created_at: now
    });
  });

  return {
    success: true,
    branchId: newBranchRef.id,
    qrToken: secureToken,
    message: 'Branch created successfully.'
  };
});
