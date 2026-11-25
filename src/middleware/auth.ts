import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../lib/firebase-admin.ts';
import { getUserByUid } from '../db/users.ts';
import type { users } from '../db/schema.ts';

export type DbUser = typeof users.$inferSelect;

export interface AuthRequest extends Request {
  firebaseUser?: DecodedIdToken;
  dbUser?: DbUser;
}

// Ephemeral HMAC key fallback if ADMIN_SESSION_SECRET isn't set in env
const SESSION_HMAC_SECRET =
  process.env.ADMIN_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export function signAdminToken(uid: string, email: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      uid,
      email,
      exp: Date.now() + 1000 * 60 * 60 * 4, // 4 hours
    })
  ).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_HMAC_SECRET)
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminToken(token: string, expectedUid: string): boolean {
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_HMAC_SECRET)
    .update(payload)
    .digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid: string;
      exp: number;
    };
    return parsed.uid === expectedUid && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

export function hashPasscode(passcode: string, existingSalt?: string) {
  const salt = existingSalt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(passcode, salt, 64).toString('hex');
  return { salt, hash };
}

export function verifyPasscodeHash(passcode: string, salt: string, storedHash: string): boolean {
  const { hash } = hashPasscode(passcode, salt);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export const requireFirebaseToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    next();
  } catch (error) {
    console.error('Firebase ID token verification failed:', error);
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. Missing Bearer token.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;
    const dbUser = await getUserByUid(decoded.uid);
    if (!dbUser) {
      return res.status(403).json({
        error: 'Researcher profile not found. Please complete registration first.',
      });
    }
    if (dbUser.accountStatus === 'suspended') {
      return res.status(403).json({
        error: 'Your account has been suspended by an administrator.',
      });
    }
    if (dbUser.accountStatus === 'deactivated') {
      return res.status(403).json({
        error: 'Your account is deactivated. Contact platform administration to reactivate.',
      });
    }
    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid authentication session.' });
  }
};

export const requireAdmin = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Administrator authentication required.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const adminToken = req.headers['x-admin-token'];

  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.firebaseUser = decoded;

    const dbUser = await getUserByUid(decoded.uid);
    if (!dbUser || dbUser.role !== 'admin' || dbUser.accountStatus !== 'active') {
      return res.status(403).json({
        error: 'Forbidden: Server-side administrator authorization failed.',
      });
    }

    if (typeof adminToken !== 'string' || !verifyAdminToken(adminToken, decoded.uid)) {
      return res.status(403).json({
        error: 'Administrator control session expired or unverified. Re-verify via control panel.',
      });
    }

    req.dbUser = dbUser;
    next();
  } catch (error) {
    console.error('Admin verification failed:', error);
    return res.status(401).json({ error: 'Unauthorized administrator session.' });
  }
};
