import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

function getResolvedDatabaseUrl(): string {
  // If remote database URL is configured (e.g. Postgres / Supabase / Neon)
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('file:')) {
    return process.env.DATABASE_URL;
  }

  // If running in Vercel or AWS Lambda serverless environment:
  // The root container (/var/task) is read-only, which causes SQLite error 14.
  // /tmp is the only writable directory on Vercel/Lambda.
  if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    const tmpDbPath = '/tmp/dev.db';
    if (!fs.existsSync(tmpDbPath)) {
      const candidates = [
        path.join(process.cwd(), 'prisma/dev.db'),
        '/var/task/prisma/dev.db',
      ];

      for (const candidate of candidates) {
        if (fs.existsSync(/*turbopackIgnore: true*/ candidate)) {
          try {
            fs.copyFileSync(candidate, tmpDbPath);
            fs.chmodSync(tmpDbPath, 0o666);
            break;
          } catch (e) {
            console.error('Error copying dev.db to /tmp:', e);
          }
        }
      }
    }

    if (fs.existsSync(tmpDbPath)) {
      return `file:${tmpDbPath}?connection_limit=1&socket_timeout=15`;
    }
  }

  // Strategy 1: Check environment variable if it points to a local file
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:')) {
    const rawPath = process.env.DATABASE_URL.replace(/^file:/, '').split('?')[0];
    if (fs.existsSync(/*turbopackIgnore: true*/ rawPath)) {
      return `file:${path.resolve(rawPath)}?connection_limit=1&socket_timeout=15`;
    }
  }

  // Strategy 2: Local development fallback
  const localDb = path.join(process.cwd(), 'prisma/dev.db');
  return `file:${localDb}?connection_limit=1&socket_timeout=15`;
}

const dbUrl = getResolvedDatabaseUrl();
const rawDbFilePath = dbUrl.startsWith('file:') ? dbUrl.replace(/^file:/, '').split('?')[0] : null;

// Ensure full read/write permissions on the directory and SQLite files when local
if (rawDbFilePath) {
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
