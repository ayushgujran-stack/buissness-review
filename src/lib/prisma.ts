import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getResolvedDatabaseUrl(): string {
  // Strategy 1: Check environment variable if it exists and points to a file
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
    const rawPath = process.env.DATABASE_URL.replace(/^file:/, '').split('?')[0];
    if (fs.existsSync(rawPath)) {
      return `file:${path.resolve(rawPath)}?connection_limit=1&socket_timeout=15`;
    }
  }

  // Strategy 2: Check standard candidate paths
  const candidates = [
    '/Users/ayushrajeshpoojary/PROJECTS/Review/prisma/dev.db',
    path.resolve(process.cwd(), 'prisma/dev.db'),
    path.resolve(process.cwd(), 'dev.db'),
    path.resolve(__dirname, '../../prisma/dev.db'),
    path.resolve(__dirname, '../prisma/dev.db'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return `file:${path.resolve(candidate)}?connection_limit=1&socket_timeout=15`;
    }
  }

  // Fallback default
  const defaultPath = path.resolve(process.cwd(), 'prisma/dev.db');
  return `file:${defaultPath}?connection_limit=1&socket_timeout=15`;
}

const dbUrl = getResolvedDatabaseUrl();
const rawDbFilePath = dbUrl.replace(/^file:/, '').split('?')[0];

// Ensure full read/write permissions on the directory and SQLite files
try {
  const dir = path.dirname(rawDbFilePath);
  if (fs.existsSync(dir)) {
    fs.chmodSync(dir, 0o777);
  }
  if (fs.existsSync(rawDbFilePath)) {
    fs.chmodSync(rawDbFilePath, 0o666);
  }
  const walPath = `${rawDbFilePath}-wal`;
  if (fs.existsSync(walPath)) {
    fs.chmodSync(walPath, 0o666);
  }
  const shmPath = `${rawDbFilePath}-shm`;
  if (fs.existsSync(shmPath)) {
    fs.chmodSync(shmPath, 0o666);
  }
} catch {
  // Ignore permission adjustment errors
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
