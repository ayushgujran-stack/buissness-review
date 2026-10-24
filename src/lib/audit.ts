import prisma from './prisma';

export async function logAuditEvent(params: {
  userId?: string;
  userName?: string;
  role?: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown> | string;
  ipAddress?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId,
        userName: params.userName,
        role: params.role,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        details: typeof params.details === 'object' ? JSON.stringify(params.details) : params.details,
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    console.error('Failed to log audit event:', err);
  }
}
