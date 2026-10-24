import { NextRequest, NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const settings = await prisma.platformSetting.findMany({
      orderBy: { key: 'asc' },
    });

    return NextResponse.json({ success: true, settings });
  } catch (err: any) {
    console.error('List settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSessionUser(req);
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Super Admin required' }, { status: 403 });
    }

    const { settings } = await req.json();

    if (!settings || !Array.isArray(settings)) {
      return NextResponse.json({ error: 'settings array required' }, { status: 400 });
    }

    for (const s of settings) {
      await prisma.platformSetting.upsert({
        where: { key: s.key },
        create: { key: s.key, value: s.value, description: s.description },
        update: { value: s.value, description: s.description },
      });
    }

    await logAuditEvent({
      userId: session.userId,
      userName: session.name,
      role: session.role,
      action: 'PLATFORM_SETTINGS_UPDATED',
      entityType: 'PLATFORM_SETTINGS',
      details: { count: settings.length },
      ipAddress: req.headers.get('x-forwarded-for') || '127.0.0.1',
    });

    return NextResponse.json({ success: true, message: 'Settings updated' });
  } catch (err: any) {
    console.error('Update settings error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
