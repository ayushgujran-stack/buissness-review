import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import prisma from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'reviewflow-secret-super-key-2026';

export interface TokenPayload {
  userId: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'OWNER' | 'MANAGER' | 'SUPER_MANAGER';
  email: string;
  username: string;
  name: string;
  mustChangePassword?: boolean;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function getSessionUser(req?: NextRequest): Promise<TokenPayload | null> {
  let token: string | undefined;

  if (req) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else {
      const cookieHeader = req.cookies.get('rf_token');
      token = cookieHeader?.value;
    }
  }

  if (!token) {
    try {
      const cookieStore = await cookies();
      token = cookieStore.get('rf_token')?.value;
    } catch {
      // In non-request context or test
    }
  }

  if (!token) return null;
  return verifyToken(token);
}

// Server-side permission & tenant verification
export async function verifyBusinessAccess(userId: string, role: string, businessId: string): Promise<boolean> {
  if (role === 'SUPER_ADMIN') return true;

  if (role === 'OWNER') {
    const business = await prisma.business.findFirst({
      where: { id: businessId, ownerId: userId },
    });
    return !!business;
  }

  if (role === 'MANAGER' || role === 'SUPER_MANAGER') {
    const assignment = await prisma.branchUser.findFirst({
      where: { userId, businessId },
    });
    return !!assignment;
  }

  return false;
}

export async function verifyBranchAccess(userId: string, role: string, branchId: string): Promise<boolean> {
  if (role === 'SUPER_ADMIN') return true;

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    include: { business: true },
  });
  if (!branch) return false;

  if (role === 'OWNER') {
    return branch.business.ownerId === userId;
  }

  if (role === 'MANAGER') {
    const assignment = await prisma.branchUser.findFirst({
      where: { userId, branchId },
    });
    return !!assignment;
  }

  if (role === 'SUPER_MANAGER') {
    // Super manager might be assigned at the business level or specific branch
    const assignment = await prisma.branchUser.findFirst({
      where: {
        userId,
        OR: [
          { branchId: branch.id },
          { businessId: branch.businessId, branchId: null },
        ],
      },
    });
    return !!assignment;
  }

  return false;
}
