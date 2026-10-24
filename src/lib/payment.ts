import crypto from 'crypto';
import prisma from './prisma';

export interface PaymentGatewayOrder {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  planId: string;
}

export interface PaymentVerificationResult {
  verified: boolean;
  transactionId: string;
  paymentId: string;
  orderId: string;
  error?: string;
}

export class PaymentGateway {
  static getRazorpayKeyId(): string {
    return process.env.RAZORPAY_KEY_ID || 'rzp_test_reviewflow_demo';
  }

  static getRazorpaySecret(): string {
    return process.env.RAZORPAY_KEY_SECRET || 'rzp_secret_demo_reviewflow';
  }

  // Create an order for checkout
  static async createOrder(ownerId: string, planId: string): Promise<PaymentGatewayOrder> {
    const plan = await prisma.licensePlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Invalid plan selected');

    const orderId = `order_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    return {
      orderId,
      amount: plan.price,
      currency: plan.currency,
      keyId: this.getRazorpayKeyId(),
      planId: plan.id,
    };
  }

  // Server-side verification: Razorpay HMAC or Mock signature
  static verifyPaymentSignature(params: {
    orderId: string;
    paymentId: string;
    signature: string;
  }): boolean {
    const { orderId, paymentId, signature } = params;
    const secret = this.getRazorpaySecret();

    // Support mock dev verification or standard Razorpay SHA256 HMAC
    if (signature.startsWith('mock_sig_')) {
      const expectedMock = `mock_sig_${crypto.createHash('sha256').update(orderId + paymentId).digest('hex').substring(0, 16)}`;
      return signature === expectedMock;
    }

    const generatedSignature = crypto
      .createHmac('sha256', secret)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    return generatedSignature === signature;
  }

  // Process verified payment: updates or activates license, creates invoice, logs audit
  static async activateLicenseAfterPayment(params: {
    ownerId: string;
    planId: string;
    transactionId: string;
    signature: string;
    paymentMethod?: string;
  }): Promise<{ paymentId: string; invoiceNumber: string; expiresAt: Date }> {
    const { ownerId, planId, transactionId, signature, paymentMethod } = params;

    const plan = await prisma.licensePlan.findUnique({ where: { id: planId } });
    if (!plan) throw new Error('Plan not found');

    const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // Calculate expiry: if current active license exists and has time left, extend from that date; else start from now
    const currentLicense = await prisma.license.findFirst({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });

    let startDate = new Date();
    if (currentLicense && new Date(currentLicense.expiresAt) > startDate && currentLicense.status === 'ACTIVE') {
      startDate = new Date(currentLicense.expiresAt);
    }

    const newExpiry = new Date(startDate.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    // Create or update license
    const license = await prisma.license.create({
      data: {
        ownerId,
        planId: plan.id,
        planName: plan.name,
        status: 'ACTIVE',
        maxBranches: plan.maxBranches,
        startsAt: new Date(),
        expiresAt: newExpiry,
      },
    });

    // Record payment
    const payment = await prisma.payment.create({
      data: {
        ownerId,
        licenseId: license.id,
        amount: plan.price,
        currency: plan.currency,
        gateway: 'RAZORPAY',
        transactionId,
        signature,
        status: 'SUCCESS',
        invoiceNumber,
        paymentMethod: paymentMethod || 'Card / UPI / NetBanking',
        notes: `Activated ${plan.name} (${plan.maxBranches} branches) for ${plan.durationDays} days.`,
      },
    });

    // Create notification
    await prisma.notification.create({
      data: {
        type: 'PAYMENT_SUCCESS',
        title: 'Payment Successful & License Activated',
        body: `Your payment of ${plan.currency} ${plan.price} was successful. Invoice: ${invoiceNumber}. You now have capacity for ${plan.maxBranches} branches until ${newExpiry.toLocaleDateString()}.`,
        status: 'UNREAD',
        recipients: {
          create: {
            userId: ownerId,
          },
        },
      },
    });

    // Record audit log
    await prisma.auditLog.create({
      data: {
        userId: ownerId,
        role: 'OWNER',
        action: 'LICENSE_ACTIVATED',
        entityType: 'LICENSE',
        entityId: license.id,
        details: JSON.stringify({
          plan: plan.name,
          maxBranches: plan.maxBranches,
          amount: plan.price,
          invoiceNumber,
          transactionId,
        }),
      },
    });

    return {
      paymentId: payment.id,
      invoiceNumber,
      expiresAt: newExpiry,
    };
  }
}
