import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

async function hash(pw: string) {
  return bcrypt.hash(pw, 10);
}

function token() {
  return `rf_${crypto.randomBytes(12).toString('hex')}`;
}

async function main() {
  console.log('🌱 Starting database seeding for ReviewFlow...');

  // Clean old data if re-seeding
  await prisma.notificationRecipient.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.reviewAnswer.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.questionOption.deleteMany({});
  await prisma.reviewQuestion.deleteMany({});
  await prisma.reviewForm.deleteMany({});
  await prisma.qrCode.deleteMany({});
  await prisma.managerPermission.deleteMany({});
  await prisma.branchUser.deleteMany({});
  await prisma.branch.deleteMany({});
  await prisma.business.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.license.deleteMany({});
  await prisma.licensePlan.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.platformSetting.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('🧹 Cleaned existing tables.');

  // 1. Platform Settings
  await prisma.platformSetting.createMany({
    data: [
      { key: 'trial_duration_days', value: '15', description: 'Default duration in days for new trial accounts' },
      { key: 'default_branch_limit', value: '20', description: 'Branch capacity limit for standard business owners' },
      { key: 'poor_review_threshold', value: '2', description: 'Ratings at or below this are marked POOR and trigger alerts' },
      { key: 'company_name', value: 'ReviewFlow Technologies', description: 'Platform company brand' },
      { key: 'support_email', value: 'support@reviewflow.io', description: 'Global customer support email' },
      { key: 'razorpay_key_id', value: 'rzp_test_reviewflow_demo', description: 'Razorpay Public Key for payments' },
    ],
  });

  // 2. License Plans
  const trialPlan = await prisma.licensePlan.create({
    data: {
      name: 'Free Trial',
      code: 'TRIAL',
      durationDays: 15,
      maxBranches: 5,
      price: 0,
      currency: 'INR',
      isTrial: true,
      features: JSON.stringify(['Up to 5 Branches', 'Unlimited Businesses', 'QR Generation', 'Real-time Poor Review Alerts', '15 Days Trial']),
    },
  });

  const starterPlan = await prisma.licensePlan.create({
    data: {
      name: 'Starter Plan',
      code: 'STARTER_5',
      durationDays: 365,
      maxBranches: 5,
      price: 4999,
      currency: 'INR',
      features: JSON.stringify(['5 Branches across Unlimited Businesses', 'Custom Review Forms', 'QR Standee Artwork Generator', 'CSV & Excel Export', 'Email & In-App Alerts']),
    },
  });

  const growthPlan = await prisma.licensePlan.create({
    data: {
      name: 'Growth Plan',
      code: 'GROWTH_20',
      durationDays: 365,
      maxBranches: 20,
      price: 14999,
      currency: 'INR',
      features: JSON.stringify(['20 Branches across Unlimited Businesses', 'Multi-Manager & Super Manager Roles', 'Instant Push Notifications', 'Advanced Analytics & Trends', 'Priority Support']),
    },
  });

  const enterprisePlan = await prisma.licensePlan.create({
    data: {
      name: 'Enterprise Plan',
      code: 'ENTERPRISE_50',
      durationDays: 365,
      maxBranches: 50,
      price: 29999,
      currency: 'INR',
      features: JSON.stringify(['50 Branches across Unlimited Businesses', 'Dedicated Account Manager', 'Custom API & Webhooks', 'Unlimited Managers', 'White-labeled Review Pages']),
    },
  });

  // 3. Super Admin (Username: admin, Password: admin123, mustChangePassword: true)
  const superAdmin = await prisma.user.create({
    data: {
      name: 'Super Administrator',
      email: 'admin@reviewflow.io',
      username: 'admin',
      passwordHash: await hash('admin123'),
      role: 'SUPER_ADMIN',
      mustChangePassword: true, // Required by prompt: Force password change on first login!
      phone: '+91 9876543210',
      status: 'ACTIVE',
    },
  });

  // Platform Admin
  await prisma.user.create({
    data: {
      name: 'Operations Admin',
      email: 'staff@reviewflow.io',
      username: 'staff_admin',
      passwordHash: await hash('admin123'),
      role: 'ADMIN',
      mustChangePassword: false,
      phone: '+91 9876543211',
      status: 'ACTIVE',
    },
  });

  // 4. Demo Business Owner: Raj
  const rajOwner = await prisma.user.create({
    data: {
      name: 'Raj Malhotra',
      email: 'raj@example.com',
      username: 'raj',
      passwordHash: await hash('password123'),
      role: 'OWNER',
      mustChangePassword: false,
      phone: '+91 9820011223',
      status: 'ACTIVE',
    },
  });

  // License for Raj: 20 Branches total capacity
  const now = new Date();
  const rajLicenseExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
  const rajLicense = await prisma.license.create({
    data: {
      ownerId: rajOwner.id,
      planId: growthPlan.id,
      planName: growthPlan.name,
      status: 'ACTIVE',
      maxBranches: 20,
      startsAt: now,
      expiresAt: rajLicenseExpiry,
    },
  });

  // Seed initial payment for Raj
  await prisma.payment.create({
    data: {
      ownerId: rajOwner.id,
      licenseId: rajLicense.id,
      amount: 14999,
      currency: 'INR',
      gateway: 'RAZORPAY',
      transactionId: 'pay_rzp_init_raj_2026',
      status: 'SUCCESS',
      invoiceNumber: 'INV-2026-881920',
      paymentMethod: 'UPI / Razorpay',
      notes: 'Annual Growth Plan (20 Branches Limit)',
    },
  });

  console.log('👤 Created Super Admin and Owner Raj with 20 branch capacity.');

  // 5. Create Raj's Businesses:
  // Business 1: Royal Spice Restaurant
  const royalSpice = await prisma.business.create({
    data: {
      ownerId: rajOwner.id,
      name: 'Royal Spice Restaurant',
      category: 'Restaurant & Dining',
      description: 'Authentic Indian royal cuisine and fine dining experience.',
      phone: '+91 9820055441',
      email: 'contact@royalspice.in',
      website: 'https://royalspice.example.com',
      address: '102 Heritage Boulevard, Bandra West',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      status: 'ACTIVE',
    },
  });

  // Business 2: Grand Horizon Hotel
  const grandHorizon = await prisma.business.create({
    data: {
      ownerId: rajOwner.id,
      name: 'Grand Horizon Hotel',
      category: 'Hotel & Hospitality',
      description: 'Luxury hotel & suites offering world-class comfort and service.',
      phone: '+91 9820055442',
      email: 'reservations@grandhorizon.in',
      website: 'https://grandhorizon.example.com',
      address: '88 Marine Drive',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      status: 'ACTIVE',
    },
  });

  // Business 3: Urban Cuts Salon
  const urbanCuts = await prisma.business.create({
    data: {
      ownerId: rajOwner.id,
      name: 'Urban Cuts Salon',
      category: 'Salon & Spa',
      description: 'Modern styling, hair care, and relaxing wellness spa.',
      phone: '+91 9820055443',
      email: 'hello@urbancuts.in',
      website: 'https://urbancuts.example.com',
      address: '45 Linking Road, Khar',
      city: 'Mumbai',
      state: 'Maharashtra',
      country: 'India',
      status: 'ACTIVE',
    },
  });

  // 6. Create Branches: Total 6 Branches (Leaves 14 available out of 20)
  // Royal Spice Branches:
  const rsBranch1 = await prisma.branch.create({
    data: {
      businessId: royalSpice.id,
      name: 'Royal Spice — Main Branch',
      address: '102 Heritage Blvd, Bandra West, Mumbai',
      phone: '+91 9820055441',
      description: 'Our flagship dining lounge and outdoor terrace.',
      themeColor: '#E11D48',
      qrToken: 'rf_royal_spice_main_101',
    },
  });

  const rsBranch2 = await prisma.branch.create({
    data: {
      businessId: royalSpice.id,
      name: 'Royal Spice — City Center',
      address: 'Shop 14, Phoenix Palladium, Lower Parel, Mumbai',
      phone: '+91 9820055444',
      description: 'Express gourmet dining in the heart of the business district.',
      themeColor: '#E11D48',
      qrToken: 'rf_royal_spice_city_102',
    },
  });

  const rsBranch3 = await prisma.branch.create({
    data: {
      businessId: royalSpice.id,
      name: 'Royal Spice — Mall Branch',
      address: 'Level 3, Seawoods Grand Central Mall, Navi Mumbai',
      phone: '+91 9820055445',
      description: 'Family dining and buffet special hall.',
      themeColor: '#E11D48',
      qrToken: 'rf_royal_spice_mall_103',
    },
  });

  // Grand Horizon Branches:
  const ghBranch1 = await prisma.branch.create({
    data: {
      businessId: grandHorizon.id,
      name: 'Grand Horizon — Main Hotel',
      address: '88 Marine Drive, South Mumbai',
      phone: '+91 9820055442',
      description: 'Sea-facing luxury suites, fine dining, and convention center.',
      themeColor: '#2563EB',
      qrToken: 'rf_grand_horizon_main_201',
    },
  });

  const ghBranch2 = await prisma.branch.create({
    data: {
      businessId: grandHorizon.id,
      name: 'Grand Horizon — Airport',
      address: 'Sahar Airport Road, Andheri East, Mumbai',
      phone: '+91 9820055446',
      description: 'Transit suites, 24/7 business lounge, and rooftop bistro.',
      themeColor: '#2563EB',
      qrToken: 'rf_grand_horizon_airport_202',
    },
  });

  // Urban Cuts Branch:
  const ucBranch1 = await prisma.branch.create({
    data: {
      businessId: urbanCuts.id,
      name: 'Urban Cuts — Main Branch',
      address: '45 Linking Road, Khar West, Mumbai',
      phone: '+91 9820055443',
      description: 'Full-service hair, beard styling, and aesthetic treatments.',
      themeColor: '#059669',
      qrToken: 'rf_urban_cuts_main_301',
    },
  });

  const allBranches = [rsBranch1, rsBranch2, rsBranch3, ghBranch1, ghBranch2, ucBranch1];

  // Generate QR records for each branch
  for (const b of allBranches) {
    const reviewUrl = `/review/${b.qrToken}`;
    const qrDataUrl = await QRCode.toDataURL(`http://localhost:3000${reviewUrl}`, { margin: 2, width: 400 });
    await prisma.qrCode.create({
      data: {
        branchId: b.id,
        token: b.qrToken,
        targetUrl: reviewUrl,
        qrImageUrl: qrDataUrl,
        scanCount: Math.floor(Math.random() * 40) + 10,
        lastScannedAt: new Date(Date.now() - Math.floor(Math.random() * 86400000)),
        active: true,
      },
    });
  }

  console.log('📍 Created 6 branches across 3 businesses with unique QR tokens.');

  // 7. Review Forms & Questions
  // Royal Spice Review Form
  const rsForm = await prisma.reviewForm.create({
    data: {
      businessId: royalSpice.id,
      title: 'Dine-in Guest Feedback',
      description: 'Help us make your dining experience even more memorable.',
      isPublished: true,
      isDefault: true,
    },
  });

  const rsQ1 = await prisma.reviewQuestion.create({
    data: {
      formId: rsForm.id,
      text: 'How would you rate the taste and presentation of your food?',
      type: 'STAR_RATING',
      required: true,
      displayOrder: 1,
    },
  });

  const rsQ2 = await prisma.reviewQuestion.create({
    data: {
      formId: rsForm.id,
      text: 'How was the speed and attentiveness of our service staff?',
      type: 'GOOD_OKAY_POOR',
      required: true,
      displayOrder: 2,
    },
  });

  const rsQ3 = await prisma.reviewQuestion.create({
    data: {
      formId: rsForm.id,
      text: 'What stood out most during your visit today?',
      type: 'MULTIPLE_CHOICE',
      required: false,
      displayOrder: 3,
    },
  });

  await prisma.questionOption.createMany({
    data: [
      { questionId: rsQ3.id, text: 'Delicious food flavor', value: 'Delicious food flavor', scoreClassification: 'GOOD', displayOrder: 1 },
      { questionId: rsQ3.id, text: 'Ambiance & Music', value: 'Ambiance & Music', scoreClassification: 'GOOD', displayOrder: 2 },
      { questionId: rsQ3.id, text: 'Friendly staff greeting', value: 'Friendly staff greeting', scoreClassification: 'GOOD', displayOrder: 3 },
      { questionId: rsQ3.id, text: 'Slow order delivery', value: 'Slow order delivery', scoreClassification: 'POOR', displayOrder: 4 },
      { questionId: rsQ3.id, text: 'Food was served cold', value: 'Food was served cold', scoreClassification: 'POOR', displayOrder: 5 },
    ],
  });

  const rsQ4 = await prisma.reviewQuestion.create({
    data: {
      formId: rsForm.id,
      text: 'Would you recommend Royal Spice to friends and family?',
      type: 'YES_NO',
      required: true,
      displayOrder: 4,
      positiveValue: 'Yes',
    },
  });

  const rsQ5 = await prisma.reviewQuestion.create({
    data: {
      formId: rsForm.id,
      text: 'Any additional feedback or compliments for our culinary team?',
      type: 'TEXT',
      required: false,
      displayOrder: 5,
    },
  });

  // Grand Horizon Review Form
  const ghForm = await prisma.reviewForm.create({
    data: {
      businessId: grandHorizon.id,
      title: 'Hotel Stay & Guest Experience',
      description: 'We value your comfort. Please share your stay feedback.',
      isPublished: true,
      isDefault: true,
    },
  });

  await prisma.reviewQuestion.createMany({
    data: [
      { formId: ghForm.id, text: 'Overall room comfort and cleanliness', type: 'STAR_RATING', required: true, displayOrder: 1 },
      { formId: ghForm.id, text: 'Check-in and front desk reception experience', type: 'GOOD_OKAY_POOR', required: true, displayOrder: 2 },
      { formId: ghForm.id, text: 'Did the room amenities meet your expectations?', type: 'YES_NO', required: true, displayOrder: 3, positiveValue: 'Yes' },
      { formId: ghForm.id, text: 'Suggestions to make your next stay exceptional', type: 'TEXT', required: false, displayOrder: 4 },
    ],
  });

  // Urban Cuts Review Form
  const ucForm = await prisma.reviewForm.create({
    data: {
      businessId: urbanCuts.id,
      title: 'Styling & Salon Experience',
      description: 'Your hair and care feedback helps us keep perfection sharp.',
      isPublished: true,
      isDefault: true,
    },
  });

  await prisma.reviewQuestion.createMany({
    data: [
      { formId: ucForm.id, text: 'How satisfied are you with your hair cut / styling today?', type: 'STAR_RATING', required: true, displayOrder: 1 },
      { formId: ucForm.id, text: 'Hygiene and cleanliness of styling tools', type: 'GOOD_OKAY_POOR', required: true, displayOrder: 2 },
      { formId: ucForm.id, text: 'Was your stylist attentive to your desired look?', type: 'YES_NO', required: true, displayOrder: 3, positiveValue: 'Yes' },
      { formId: ucForm.id, text: 'Tell us about your stylist or service', type: 'TEXT', required: false, displayOrder: 4 },
    ],
  });

  console.log('📝 Created dynamic review forms for all 3 businesses.');

  // 8. Create Super Manager & Manager
  // Super Manager: John (assigned to Royal Spice Branches 1 & 2 + Grand Horizon Main Hotel)
  const smJohn = await prisma.user.create({
    data: {
      name: 'John Fernandes',
      email: 'john@example.com',
      username: 'john',
      passwordHash: await hash('manager123'),
      role: 'SUPER_MANAGER',
      phone: '+91 9820099881',
      status: 'ACTIVE',
    },
  });

  // Assign John to Royal Spice branch 1
  const buJohn1 = await prisma.branchUser.create({
    data: {
      userId: smJohn.id,
      businessId: royalSpice.id,
      branchId: rsBranch1.id,
      role: 'SUPER_MANAGER',
    },
  });
  // Assign John to Royal Spice branch 2
  const buJohn2 = await prisma.branchUser.create({
    data: {
      userId: smJohn.id,
      businessId: royalSpice.id,
      branchId: rsBranch2.id,
      role: 'SUPER_MANAGER',
    },
  });
  // Assign John to Grand Horizon branch 1
  const buJohn3 = await prisma.branchUser.create({
    data: {
      userId: smJohn.id,
      businessId: grandHorizon.id,
      branchId: ghBranch1.id,
      role: 'SUPER_MANAGER',
    },
  });

  // Assign permissions to John
  const permissions = ['VIEW_DASHBOARD', 'VIEW_REVIEWS', 'VIEW_CUSTOMERS', 'VIEW_REPORTS', 'RECEIVE_ALERTS', 'EXPORT_DATA'];
  for (const bu of [buJohn1, buJohn2, buJohn3]) {
    for (const p of permissions) {
      await prisma.managerPermission.create({
        data: {
          branchUserId: bu.id,
          permission: p,
          granted: true,
        },
      });
    }
  }

  // Manager: Priya (assigned to Urban Cuts Main Branch)
  const mPriya = await prisma.user.create({
    data: {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      username: 'priya',
      passwordHash: await hash('manager123'),
      role: 'MANAGER',
      phone: '+91 9820099882',
      status: 'ACTIVE',
    },
  });

  const buPriya = await prisma.branchUser.create({
    data: {
      userId: mPriya.id,
      businessId: urbanCuts.id,
      branchId: ucBranch1.id,
      role: 'MANAGER',
    },
  });

  for (const p of permissions) {
    await prisma.managerPermission.create({
      data: {
        branchUserId: buPriya.id,
        permission: p,
        granted: true,
      },
    });
  }

  console.log('👥 Created Super Manager John and Manager Priya with strict branch access.');

  // 9. Customers and Sample Reviews (Good, Okay, and POOR)
  // Customer 1: Rohan Mehta (Good Review)
  const cust1 = await prisma.customer.create({
    data: {
      name: 'Rohan Mehta',
      mobile: '+91 9811122233',
      email: 'rohan.mehta@gmail.com',
      totalReviews: 2,
    },
  });

  const rev1 = await prisma.review.create({
    data: {
      businessId: royalSpice.id,
      branchId: rsBranch1.id,
      customerId: cust1.id,
      rating: 4.8,
      sentiment: 'GOOD',
      source: 'QR_SCAN',
      status: 'READ',
      createdAt: new Date(Date.now() - 2 * 3600000),
    },
  });

  await prisma.reviewAnswer.createMany({
    data: [
      { reviewId: rev1.id, questionId: rsQ1.id, questionText: 'Food Taste & Presentation', questionType: 'STAR_RATING', answerText: '5 Stars', numericValue: 5, classification: 'GOOD' },
      { reviewId: rev1.id, questionId: rsQ2.id, questionText: 'Service Speed', questionType: 'GOOD_OKAY_POOR', answerText: 'GOOD', numericValue: 5, classification: 'GOOD' },
      { reviewId: rev1.id, questionId: rsQ3.id, questionText: 'Standout Experience', questionType: 'MULTIPLE_CHOICE', answerText: 'Delicious food flavor', numericValue: 5, classification: 'GOOD' },
      { reviewId: rev1.id, questionId: rsQ4.id, questionText: 'Would Recommend', questionType: 'YES_NO', answerText: 'Yes', numericValue: 5, classification: 'GOOD' },
      { reviewId: rev1.id, questionId: rsQ5.id, questionText: 'Compliments', questionType: 'TEXT', answerText: 'The Dal Makhani and Garlic Naan were out of this world! Excellent hospitality.', classification: 'NEUTRAL' },
    ],
  });

  // Customer 2: Amit Verma (POOR Review -> Trigger Alert!)
  const cust2 = await prisma.customer.create({
    data: {
      name: 'Amit Verma',
      mobile: '+91 9822233344',
      email: 'amit.verma@yahoo.com',
      totalReviews: 1,
    },
  });

  const rev2 = await prisma.review.create({
    data: {
      businessId: royalSpice.id,
      branchId: rsBranch1.id,
      customerId: cust2.id,
      rating: 1.5,
      sentiment: 'POOR',
      source: 'QR_SCAN',
      status: 'NEW',
      createdAt: new Date(Date.now() - 30 * 60000), // 30 minutes ago
    },
  });

  await prisma.reviewAnswer.createMany({
    data: [
      { reviewId: rev2.id, questionId: rsQ1.id, questionText: 'Food Taste & Presentation', questionType: 'STAR_RATING', answerText: '1 Star', numericValue: 1, classification: 'POOR' },
      { reviewId: rev2.id, questionId: rsQ2.id, questionText: 'Service Speed', questionType: 'GOOD_OKAY_POOR', answerText: 'POOR', numericValue: 1, classification: 'POOR' },
      { reviewId: rev2.id, questionId: rsQ3.id, questionText: 'Standout Experience', questionType: 'MULTIPLE_CHOICE', answerText: 'Food was served cold', numericValue: 1, classification: 'POOR' },
      { reviewId: rev2.id, questionId: rsQ4.id, questionText: 'Would Recommend', questionType: 'YES_NO', answerText: 'No', numericValue: 1, classification: 'POOR' },
      { reviewId: rev2.id, questionId: rsQ5.id, questionText: 'Additional feedback', questionType: 'TEXT', answerText: 'Waited 45 minutes for our starters. Main course was lukewarm. Very disappointing for a royal fine dining venue.', classification: 'NEUTRAL' },
    ],
  });

  // Notification for Amit's poor review: Goes to Raj (Owner) and John (Super Manager of RS Main Branch)
  const notif1 = await prisma.notification.create({
    data: {
      type: 'POOR_REVIEW',
      title: 'Poor Review Alert',
      body: 'A customer submitted a poor review for Royal Spice — Main Branch.',
      businessId: royalSpice.id,
      branchId: rsBranch1.id,
      reviewId: rev2.id,
      status: 'UNREAD',
      metadata: JSON.stringify({
        customerName: cust2.name,
        customerMobile: cust2.mobile,
        rating: 1.5,
        sentiment: 'POOR',
        branchName: rsBranch1.name,
        businessName: royalSpice.name,
      }),
    },
  });

  await prisma.notificationRecipient.createMany({
    data: [
      { notificationId: notif1.id, userId: rajOwner.id, isRead: false },
      { notificationId: notif1.id, userId: smJohn.id, isRead: false },
    ],
  });

  // Customer 3: Sneha Patel (Okay Review)
  const cust3 = await prisma.customer.create({
    data: {
      name: 'Sneha Patel',
      mobile: '+91 9833344455',
      email: 'sneha.p@outlook.com',
      totalReviews: 1,
    },
  });

  const rev3 = await prisma.review.create({
    data: {
      businessId: royalSpice.id,
      branchId: rsBranch2.id,
      customerId: cust3.id,
      rating: 3.0,
      sentiment: 'OKAY',
      source: 'QR_SCAN',
      status: 'READ',
      createdAt: new Date(Date.now() - 5 * 3600000),
    },
  });

  await prisma.reviewAnswer.createMany({
    data: [
      { reviewId: rev3.id, questionId: rsQ1.id, questionText: 'Food Taste & Presentation', questionType: 'STAR_RATING', answerText: '3 Stars', numericValue: 3, classification: 'OKAY' },
      { reviewId: rev3.id, questionId: rsQ2.id, questionText: 'Service Speed', questionType: 'GOOD_OKAY_POOR', answerText: 'OKAY', numericValue: 3, classification: 'OKAY' },
      { reviewId: rev3.id, questionId: rsQ3.id, questionText: 'Standout Experience', questionType: 'MULTIPLE_CHOICE', answerText: 'Ambiance & Music', numericValue: 3, classification: 'OKAY' },
      { reviewId: rev3.id, questionId: rsQ4.id, questionText: 'Would Recommend', questionType: 'YES_NO', answerText: 'Yes', numericValue: 5, classification: 'GOOD' },
    ],
  });

  // Customer 4: Vikram Nair at Grand Horizon Main Hotel (Good review)
  const cust4 = await prisma.customer.create({
    data: {
      name: 'Vikram Nair',
      mobile: '+91 9844455566',
      email: 'vikram.nair@corp.in',
      totalReviews: 3,
    },
  });

  const rev4 = await prisma.review.create({
    data: {
      businessId: grandHorizon.id,
      branchId: ghBranch1.id,
      customerId: cust4.id,
      rating: 5.0,
      sentiment: 'GOOD',
      source: 'QR_SCAN',
      status: 'RESOLVED',
      createdAt: new Date(Date.now() - 1 * 86400000),
    },
  });

  // Customer 5: Pooja Singh at Urban Cuts (Poor Review -> Notification for Priya & Raj)
  const cust5 = await prisma.customer.create({
    data: {
      name: 'Pooja Singh',
      mobile: '+91 9855566677',
      email: 'pooja.s@gmail.com',
      totalReviews: 1,
    },
  });

  const rev5 = await prisma.review.create({
    data: {
      businessId: urbanCuts.id,
      branchId: ucBranch1.id,
      customerId: cust5.id,
      rating: 1.8,
      sentiment: 'POOR',
      source: 'QR_SCAN',
      status: 'UNREAD',
      createdAt: new Date(Date.now() - 2 * 3600000),
    },
  });

  const notif2 = await prisma.notification.create({
    data: {
      type: 'POOR_REVIEW',
      title: 'Poor Review Alert',
      body: 'A customer submitted a poor review for Urban Cuts Salon — Urban Cuts — Main Branch.',
      businessId: urbanCuts.id,
      branchId: ucBranch1.id,
      reviewId: rev5.id,
      status: 'UNREAD',
      metadata: JSON.stringify({
        customerName: cust5.name,
        customerMobile: cust5.mobile,
        rating: 1.8,
        sentiment: 'POOR',
        branchName: ucBranch1.name,
        businessName: urbanCuts.name,
      }),
    },
  });

  await prisma.notificationRecipient.createMany({
    data: [
      { notificationId: notif2.id, userId: rajOwner.id, isRead: false },
      { notificationId: notif2.id, userId: mPriya.id, isRead: false },
    ],
  });

  // 10. Audit Logs
  await prisma.auditLog.createMany({
    data: [
      { role: 'SYSTEM', action: 'DATABASE_INITIALIZED', entityType: 'SYSTEM', details: JSON.stringify({ timestamp: now }) },
      { userId: rajOwner.id, userName: 'Raj Malhotra', role: 'OWNER', action: 'BUSINESS_CREATED', entityType: 'BUSINESS', entityId: royalSpice.id, details: JSON.stringify({ name: royalSpice.name }) },
      { userId: rajOwner.id, userName: 'Raj Malhotra', role: 'OWNER', action: 'BUSINESS_CREATED', entityType: 'BUSINESS', entityId: grandHorizon.id, details: JSON.stringify({ name: grandHorizon.name }) },
      { userId: rajOwner.id, userName: 'Raj Malhotra', role: 'OWNER', action: 'BUSINESS_CREATED', entityType: 'BUSINESS', entityId: urbanCuts.id, details: JSON.stringify({ name: urbanCuts.name }) },
      { userId: rajOwner.id, userName: 'Raj Malhotra', role: 'OWNER', action: 'BRANCH_CREATED', entityType: 'BRANCH', entityId: rsBranch1.id, details: JSON.stringify({ name: rsBranch1.name }) },
      { userId: rajOwner.id, userName: 'Raj Malhotra', role: 'OWNER', action: 'LICENSE_ACTIVATED', entityType: 'LICENSE', entityId: rajLicense.id, details: JSON.stringify({ plan: 'Growth Plan', maxBranches: 20 }) },
    ],
  });

  console.log('✅ ReviewFlow database seeding successfully finished!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
