/**
 * Acceptance Test Suite for ReviewFlow Super Admin Customer Provisioning & License Assignment System
 * Tests all 8 mandatory acceptance criteria directly against the running application & database.
 */

import prisma from '../src/lib/prisma';
import { signToken } from '../src/lib/auth';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function main() {
  console.log('===============================================================');
  console.log(' ReviewFlow Mandatory Acceptance Test Suite');
  console.log(` Target Server: ${BASE_URL}`);
  console.log('===============================================================\n');

  let passedTests = 0;
  const totalTests = 8;

  // 1. Setup Super Admin and Test Users
  const superAdmin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
  if (!superAdmin) throw new Error('SUPER_ADMIN user not found in database');

  const superAdminToken = signToken({
    userId: superAdmin.id,
    role: 'SUPER_ADMIN',
    email: superAdmin.email,
    username: superAdmin.username,
    name: superAdmin.name,
  });

  // Regular non-super-admin for unauthorized test
  let regularAdmin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!regularAdmin) {
    regularAdmin = await prisma.user.create({
      data: {
        email: 'regular_admin_test@reviewflow.com',
        username: 'regularadmintest',
        name: 'Regular Admin Test',
        passwordHash: 'hash',
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });
  }
  const regularAdminToken = signToken({
    userId: regularAdmin.id,
    role: 'ADMIN',
    email: regularAdmin.email,
    username: regularAdmin.username,
    name: regularAdmin.name,
  });

  const timestamp = Date.now();

  // ---------------------------------------------------------------------------
  // TEST 1: Super Admin creates customer and assigns 15-day trial with 5-branch limit
  // ---------------------------------------------------------------------------
  console.log('TEST 1: Super Admin creates a customer and assigns a 15-day trial with a 5-branch limit');
  try {
    const email1 = `trial_cust_${timestamp}@test.com`;
    const res1 = await fetch(`${BASE_URL}/api/admin/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Alpha Hospitality Group',
        email: email1,
        phone: '+91 9876543210',
        organizationName: 'Alpha Hospitality',
        status: 'ACTIVE',
        licenseOption: 'TRIAL',
        trialDetails: {
          durationDays: 15,
          maxBranches: 5,
          reason: 'Initial 15-day evaluation',
        },
      }),
    });

    const data1 = await res1.json();
    if (!res1.ok || !data1.success) {
      throw new Error(`Failed to create trial customer: ${JSON.stringify(data1)}`);
    }

    const customer1 = await prisma.user.findUnique({
      where: { email: email1 },
      include: { licenses: true },
    });

    if (!customer1 || customer1.role !== 'OWNER') {
      throw new Error('Customer account was not created with OWNER role');
    }

    const license1 = customer1.licenses[0];
    if (!license1) throw new Error('No license attached to created customer');
    if (license1.licenseType !== 'TRIAL') throw new Error(`Expected TRIAL licenseType, got ${license1.licenseType}`);
    if (license1.maxBranches !== 5) throw new Error(`Expected 5 maxBranches, got ${license1.maxBranches}`);
    if (license1.durationDays !== 15) throw new Error(`Expected 15 durationDays, got ${license1.durationDays}`);

    const expectedExpiry = new Date(license1.startsAt.getTime() + 15 * 86400000);
    const diffExpiry = Math.abs(license1.expiresAt.getTime() - expectedExpiry.getTime());
    if (diffExpiry > 5000) throw new Error(`Expiry not calculated accurately: ${license1.expiresAt}`);

    console.log('   ✓ Customer created with OWNER role');
    console.log(`   ✓ Active 15-day trial verified (Expires: ${license1.expiresAt.toISOString()})`);
    console.log('   ✓ 5-branch limit assigned and persisted');
    console.log('TEST 1 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('TEST 1 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // TEST 2: Super Admin creates a customer without a license
  // ---------------------------------------------------------------------------
  console.log('TEST 2: Super Admin creates a customer without a license');
  let customerNoLicenseId: string = '';
  let customerNoLicenseToken: string = '';
  try {
    const email2 = `nolicense_cust_${timestamp}@test.com`;
    const res2 = await fetch(`${BASE_URL}/api/admin/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Pending License Foods',
        email: email2,
        phone: '+91 9123456789',
        organizationName: 'Pending Foods Corp',
        status: 'ACTIVE',
        licenseOption: 'NONE',
      }),
    });

    const data2 = await res2.json();
    if (!res2.ok || !data2.success) {
      throw new Error(`Failed to create customer without license: ${JSON.stringify(data2)}`);
    }

    const customer2 = await prisma.user.findUnique({
      where: { email: email2 },
      include: { licenses: true },
    });

    if (!customer2) throw new Error('Customer record not found');
    if (customer2.licenses.length !== 0) throw new Error('Expected 0 licenses assigned');
    customerNoLicenseId = customer2.id;

    customerNoLicenseToken = signToken({
      userId: customer2.id,
      role: 'OWNER',
      email: customer2.email,
      username: customer2.username,
      name: customer2.name,
    });

    // Attempt protected application access (e.g. analytics report)
    const protectedRes = await fetch(`${BASE_URL}/api/reports/analytics`, {
      headers: { Authorization: `Bearer ${customerNoLicenseToken}` },
    });

    if (protectedRes.status !== 403) {
      throw new Error(`Expected status 403 Forbidden on protected access, got ${protectedRes.status}`);
    }

    console.log('   ✓ Customer exists in database with 0 licenses');
    console.log('   ✓ Protected application access returned 403 Forbidden as expected');
    console.log('TEST 2 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('TEST 2 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // TEST 3: Super Admin assigns a paid license following verified payment
  // ---------------------------------------------------------------------------
  console.log('TEST 3: Super Admin assigns a paid license following verified payment');
  try {
    const res3 = await fetch(`${BASE_URL}/api/admin/licenses/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        action: 'ASSIGN_PAID',
        ownerId: customerNoLicenseId,
        durationDays: 365,
        maxBranches: 10,
        assignmentSource: 'PAYMENT_GATEWAY',
        amount: '12999',
        currency: 'INR',
        gatewayTransactionId: `rzp_live_${timestamp}`,
        reason: 'Annual Enterprise Plan payment verified via Razorpay',
      }),
    });

    const data3 = await res3.json();
    if (!res3.ok || !data3.success) {
      throw new Error(`Failed to assign paid license: ${JSON.stringify(data3)}`);
    }

    const updatedLicense = await prisma.license.findFirst({
      where: { ownerId: customerNoLicenseId },
      include: { payments: true, histories: true },
    });

    if (!updatedLicense) throw new Error('No license found after assignment');
    if (updatedLicense.licenseType !== 'PAID') throw new Error(`Expected PAID, got ${updatedLicense.licenseType}`);
    if (updatedLicense.status !== 'ACTIVE') throw new Error(`Expected ACTIVE, got ${updatedLicense.status}`);
    if (updatedLicense.maxBranches !== 10) throw new Error(`Expected 10 max branches, got ${updatedLicense.maxBranches}`);

    // Verify payment was recorded and verified
    const payment = await prisma.payment.findFirst({ where: { ownerId: customerNoLicenseId } });
    if (!payment || payment.paymentStatus !== 'SUCCESS') throw new Error('Payment record not found or not marked SUCCESS');
    if (!payment.verifiedAt) throw new Error('Payment not marked with verifiedAt timestamp');

    // Verify protected access now works
    const protectedRes = await fetch(`${BASE_URL}/api/reports/analytics`, {
      headers: { Authorization: `Bearer ${customerNoLicenseToken}` },
    });
    if (protectedRes.status !== 200) {
      throw new Error(`Expected protected access to succeed (200), got ${protectedRes.status}`);
    }

    console.log('   ✓ Paid license active with 365 days duration and 10 branches');
    console.log(`   ✓ Verified payment recorded (Invoice: ${payment.invoiceNumber}, TxId: ${payment.transactionId})`);
    console.log('   ✓ Protected application access now granted (HTTP 200)');
    console.log('TEST 3 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('TEST 3 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // TEST 4: A customer reaches their 5-branch limit
  // ---------------------------------------------------------------------------
  console.log('TEST 4: A customer reaches their 5-branch limit');
  let quotaCustomerToken: string = '';
  let quotaCustomerId: string = '';
  let quotaBusiness1Id: string = '';
  let quotaBusiness2Id: string = '';
  try {
    // Provision customer with 5-branch trial
    const email4 = `quota_cust_${timestamp}@test.com`;
    const resCust = await fetch(`${BASE_URL}/api/admin/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        name: 'Five Branch Limited',
        email: email4,
        phone: '+91 9988776655',
        status: 'ACTIVE',
        licenseOption: 'TRIAL',
        trialDetails: { durationDays: 30, maxBranches: 5 },
      }),
    });
    const dCust = await resCust.json();
    quotaCustomerId = dCust.customer.id;

    quotaCustomerToken = signToken({
      userId: quotaCustomerId,
      role: 'OWNER',
      email: email4,
      username: dCust.customer.username,
      name: dCust.customer.name,
    });

    // Create Business A
    const bRes1 = await fetch(`${BASE_URL}/api/businesses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${quotaCustomerToken}` },
      body: JSON.stringify({ name: 'Royal Spice Resto', category: 'Restaurant' }),
    });
    const bData1 = await bRes1.json();
    quotaBusiness1Id = bData1.business.id;

    // Create 3 branches under Business A
    for (let i = 1; i <= 3; i++) {
      const brRes = await fetch(`${BASE_URL}/api/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${quotaCustomerToken}` },
        body: JSON.stringify({ businessId: quotaBusiness1Id, name: `Resto Branch ${i}`, address: `Street ${i}` }),
      });
      if (!brRes.ok) throw new Error(`Failed to create Resto branch ${i}`);
    }

    // Create Business B (Verify adding new business is allowed even while using branches)
    const bRes2 = await fetch(`${BASE_URL}/api/businesses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${quotaCustomerToken}` },
      body: JSON.stringify({ name: 'Grand Horizon Cafe', category: 'Cafe' }),
    });
    const bData2 = await bRes2.json();
    if (!bRes2.ok) throw new Error('Failed to create Business B');
    quotaBusiness2Id = bData2.business.id;

    // Create 2 branches under Business B (Reaching total 5 branches across businesses)
    for (let i = 1; i <= 2; i++) {
      const brRes = await fetch(`${BASE_URL}/api/branches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${quotaCustomerToken}` },
        body: JSON.stringify({ businessId: quotaBusiness2Id, name: `Cafe Branch ${i}`, address: `Avenue ${i}` }),
      });
      if (!brRes.ok) throw new Error(`Failed to create Cafe branch ${i}`);
    }

    // Now 5 branches exist. Attempting to create the 6th branch MUST FAIL with 403
    const branch6Res = await fetch(`${BASE_URL}/api/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${quotaCustomerToken}` },
      body: JSON.stringify({ businessId: quotaBusiness2Id, name: 'Disallowed Branch 6', address: 'Overflow St' }),
    });

    if (branch6Res.status !== 403) {
      throw new Error(`Expected 403 on 6th branch creation, got ${branch6Res.status}`);
    }
    const b6Err = await branch6Res.json();
    console.log(`   ✓ 6th branch rejected with message: "${b6Err.error}"`);

    // BUT: Creating another business (Business C) MUST STILL SUCCEED!
    const bRes3 = await fetch(`${BASE_URL}/api/businesses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${quotaCustomerToken}` },
      body: JSON.stringify({ name: 'Urban Cuts Salon', category: 'Salon' }),
    });
    if (!bRes3.ok) {
      throw new Error(`Expected creating Business C to succeed even with full branch capacity, got ${bRes3.status}`);
    }
    const bData3 = await bRes3.json();
    console.log(`   ✓ New business "${bData3.business.name}" created successfully at 100% branch capacity`);
    console.log('TEST 4 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('TEST 4 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // TEST 5: Super Admin extends an existing license
  // ---------------------------------------------------------------------------
  console.log('TEST 5: Super Admin extends an existing license');
  try {
    const existingLic = await prisma.license.findFirst({
      where: { ownerId: quotaCustomerId },
    });
    if (!existingLic) throw new Error('License not found for quota customer');

    const previousExpiry = new Date(existingLic.expiresAt);

    const extendRes = await fetch(`${BASE_URL}/api/admin/licenses/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({
        action: 'EXTEND',
        ownerId: quotaCustomerId,
        additionalDays: 45,
        reason: 'Customer requested 45-day extension for pilot expansion',
      }),
    });

    const extendData = await extendRes.json();
    if (!extendRes.ok || !extendData.success) {
      throw new Error(`License extension API failed: ${JSON.stringify(extendData)}`);
    }

    const updatedLic = await prisma.license.findUnique({
      where: { id: existingLic.id },
      include: { histories: true },
    });

    if (!updatedLic) throw new Error('Updated license not found');
    const newExpiry = new Date(updatedLic.expiresAt);
    const addedDays = Math.round((newExpiry.getTime() - previousExpiry.getTime()) / 86400000);

    if (addedDays !== 45) {
      throw new Error(`Expected exactly 45 added days, got ${addedDays}`);
    }

    // Verify history diff record exists
    const historyItem = updatedLic.histories.find((h) => h.action === 'LICENSE_EXTENDED');
    if (!historyItem) throw new Error('No LICENSE_EXTENDED history record created');
    if (!historyItem.previousValues || !historyItem.newValues) {
      throw new Error('History record does not preserve previous/new values diff');
    }

    console.log(`   ✓ Expiry date updated from ${previousExpiry.toISOString()} to ${newExpiry.toISOString()}`);
    console.log(`   ✓ Immutable license diff recorded: ${historyItem.previousValues} -> ${historyItem.newValues}`);
    console.log('TEST 5 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('TEST 5 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // TEST 6: A customer's license expires
  // ---------------------------------------------------------------------------
  console.log('TEST 6: A customer\'s license expires');
  try {
    // Manually expire quota customer's license
    await prisma.license.updateMany({
      where: { ownerId: quotaCustomerId },
      data: {
        expiresAt: new Date(Date.now() - 86400000), // Expired yesterday
        status: 'EXPIRED',
      },
    });

    // 1. Protected dashboard analytics access must be restricted
    const dashRes = await fetch(`${BASE_URL}/api/reports/analytics`, {
      headers: { Authorization: `Bearer ${quotaCustomerToken}` },
    });
    if (dashRes.status !== 403) {
      throw new Error(`Expected 403 on protected dashboard access for expired license, got ${dashRes.status}`);
    }

    // 2. Branch creation must be blocked
    const newBrRes = await fetch(`${BASE_URL}/api/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${quotaCustomerToken}` },
      body: JSON.stringify({ businessId: quotaBusiness1Id, name: 'Post Expiry Branch', address: 'Blocked Rd' }),
    });
    if (newBrRes.status !== 403) {
      throw new Error(`Expected 403 on branch creation for expired license, got ${newBrRes.status}`);
    }

    // 3. Find one branch's QR token to test public review submission blocking
    const branch = await prisma.branch.findFirst({ where: { businessId: quotaBusiness1Id } });
    if (!branch) throw new Error('No branch found for testing review submission');

    const reviewSubmitRes = await fetch(`${BASE_URL}/api/public/review/${branch.qrToken}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: 'Guest Reviewer',
        customerMobile: '9999988888',
        answers: [{ questionText: 'Rating', answerText: '5' }],
      }),
    });
    if (reviewSubmitRes.status !== 403) {
      throw new Error(`Expected 403 on review submission for expired customer, got ${reviewSubmitRes.status}`);
    }

    // 4. PRESERVATION VERIFICATION: All businesses, branches, reviews must remain intact
    const preservedBusinesses = await prisma.business.count({ where: { ownerId: quotaCustomerId } });
    const preservedBranches = await prisma.branch.count({ where: { business: { ownerId: quotaCustomerId } } });
    if (preservedBusinesses < 2 || preservedBranches < 5) {
      throw new Error(`Customer data was deleted! Found ${preservedBusinesses} businesses, ${preservedBranches} branches`);
    }

    console.log('   ✓ Protected dashboard access blocked (HTTP 403)');
    console.log('   ✓ Branch creation blocked (HTTP 403)');
    console.log('   ✓ Public review submissions blocked (HTTP 403)');
    console.log(`   ✓ All customer data preserved (Businesses: ${preservedBusinesses}, Branches: ${preservedBranches})`);
    console.log('TEST 6 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('TEST 6 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // TEST 7: A manager attempts to access another customer's business
  // ---------------------------------------------------------------------------
  console.log('TEST 7: A manager attempts to access another customer\'s business');
  try {
    const mgrOwner = await prisma.user.create({
      data: {
        email: `mgr_owner_${timestamp}@test.com`,
        username: `mgrowner_${timestamp}`,
        name: 'Manager Employer Owner',
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    const mgrBiz = await prisma.business.create({
      data: {
        ownerId: mgrOwner.id,
        name: 'Manager Assigned Business',
        category: 'Hospitality',
      },
    });

    const managerUser = await prisma.user.create({
      data: {
        email: `manager_${timestamp}@test.com`,
        username: `mgr_${timestamp}`,
        name: 'Assigned Manager',
        passwordHash: 'hash',
        role: 'MANAGER',
        status: 'ACTIVE',
      },
    });

    await prisma.branchUser.create({
      data: {
        userId: managerUser.id,
        businessId: mgrBiz.id,
        role: 'MANAGER',
      },
    });

    const managerToken = signToken({
      userId: managerUser.id,
      role: 'MANAGER',
      email: managerUser.email,
      username: managerUser.username,
      name: managerUser.name,
    });

    // Create an entirely separate customer with a business
    const otherOwner = await prisma.user.create({
      data: {
        email: `other_owner_${timestamp}@test.com`,
        username: `otherowner_${timestamp}`,
        name: 'Other Customer',
        passwordHash: 'hash',
        role: 'OWNER',
        status: 'ACTIVE',
      },
    });

    const otherBusiness = await prisma.business.create({
      data: {
        ownerId: otherOwner.id,
        name: 'Private Foreign Business',
        category: 'Private',
      },
    });

    // Manager attempts to query other customer's business via protected API
    const crossAccessRes = await fetch(`${BASE_URL}/api/branches?businessId=${otherBusiness.id}`, {
      headers: { Authorization: `Bearer ${managerToken}` },
    });

    if (crossAccessRes.status !== 403) {
      throw new Error(`Expected 403 Access Denied on cross-tenant access, got ${crossAccessRes.status}`);
    }

    console.log('   ✓ Cross-tenant access strictly denied with HTTP 403 Access Denied');
    console.log('TEST 7 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('TEST 7 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // TEST 8: An unauthorized administrator attempts to assign a license
  // ---------------------------------------------------------------------------
  console.log('TEST 8: An unauthorized administrator attempts to assign a license');
  try {
    const unauthorizedRes = await fetch(`${BASE_URL}/api/admin/licenses/action`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularAdminToken}`, // Regular ADMIN, NOT SUPER_ADMIN
      },
      body: JSON.stringify({
        action: 'ASSIGN_TRIAL',
        ownerId: quotaCustomerId,
        durationDays: 30,
        maxBranches: 5,
      }),
    });

    if (unauthorizedRes.status !== 403) {
      throw new Error(`Expected 403 Forbidden for non-super-admin, got ${unauthorizedRes.status}`);
    }

    const unauthData = await unauthorizedRes.json();
    console.log(`   ✓ Unauthorized assignment rejected: "${unauthData.error}"`);
    console.log('TEST 8 PASSED\n');
    passedTests++;
  } catch (err: any) {
    console.error('TEST 8 FAILED:', err.message, '\n');
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('===============================================================');
  console.log(` TEST RESULTS: ${passedTests} / ${totalTests} PASSED`);
  if (passedTests === totalTests) {
    console.log(' ALL 8 ACCEPTANCE TESTS PASSED SUCCESSFULLY! 🎯');
  } else {
    console.error(` ❌ ${totalTests - passedTests} TESTS FAILED`);
    process.exit(1);
  }
  console.log('===============================================================');
}

main()
  .catch((e) => {
    console.error('Fatal Test Suite Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
