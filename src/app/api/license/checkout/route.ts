import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import { PaymentGateway } from '@/lib/payment';

export async function POST(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.role !== 'OWNER') {
      return NextResponse.json({ error: 'Only owners can purchase licenses' }, { status: 403 });
    }

    const { planId } = await req.json();
    if (!planId) return NextResponse.json({ error: 'planId is required' }, { status: 400 });

    const order = await PaymentGateway.createOrder(session.userId, planId);

    return NextResponse.json({ success: true, order });
  } catch (err: any) {
    console.error('Checkout error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
