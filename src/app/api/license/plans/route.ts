import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const plans = await prisma.licensePlan.findMany({
      where: { active: true },
      orderBy: { price: 'asc' },
    });

    const parsedPlans = plans.map((p) => ({
      ...p,
      featuresList: p.features ? JSON.parse(p.features) : [],
    }));

    return NextResponse.json({ success: true, plans: parsedPlans });
  } catch (err: any) {
    console.error('List plans error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
