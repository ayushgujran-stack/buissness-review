import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { PaymentGateway } from '@/lib/payment';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { planId, orderId, paymentId, signature, paymentMethod } = await req.json();

    if (!planId || !orderId || !paymentId || !signature) {
      return NextResponse.json({ error: 'Missing payment verification parameters' }, { status: 400 });
    }

    // SERVER-SIDE CRYPTOGRAPHIC VERIFICATION - NEVER TRUST FRONTEND!
    const isVerified = PaymentGateway.verifyPaymentSignature({
      orderId,
      paymentId,
      signature,
    });

    if (!isVerified) {
      return NextResponse.json({ error: 'Payment signature verification failed' }, { status: 400 });
    }

    // Activate license and generate invoice
    const result = await PaymentGateway.activateLicenseAfterPayment({
      ownerId: session.userId,
      planId,
      transactionId: paymentId,
      signature,
      paymentMethod,
    });

    return NextResponse.json({
      success: true,
      message: 'License activated successfully',
      invoiceNumber: result.invoiceNumber,
      expiresAt: result.expiresAt,
    });
  } catch (err: any) {
    console.error('Payment verification error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
