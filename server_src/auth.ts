/**
 * Session, Rate Limiting & RBAC Middleware
 * @license Apache-2.0
 */

import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

export interface UserSession {
  token: string;
  userId: string;
  username: string;
  name: string;
  role: 'admin' | 'user';
  allowedTabs: string[];
  createdAt: number;
  lastActive: number;
}

// In-memory server session store (revocable)
const sessions = new Map<string, UserSession>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Rate limiter store
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60 * 1000; // 1 minute lockout

export function createSession(user: {
  id: string;
  username: string;
  name: string;
  role: 'admin' | 'user';
  allowedTabs: string[];
}): UserSession {
  const token = crypto.randomBytes(32).toString('hex');
  const session: UserSession = {
    token,
    userId: user.id,
    username: user.username,
    name: user.name,
    role: user.role,
    allowedTabs: user.allowedTabs || [],
    createdAt: Date.now(),
    lastActive: Date.now(),
  };
  sessions.set(token, session);
  return session;
}

export function revokeSession(token: string): boolean {
  return sessions.delete(token);
}

export function revokeAllUserSessions(userId: string): void {
  for (const [token, sess] of sessions.entries()) {
    if (sess.userId === userId) {
      sessions.delete(token);
    }
  }
}

export function getSession(token: string): UserSession | null {
  if (!token) return null;
  const sess = sessions.get(token);
  if (!sess) return null;
  if (Date.now() - sess.lastActive > SESSION_TTL_MS) {
    sessions.delete(token);
    return null;
  }
  sess.lastActive = Date.now();
  return sess;
}

export function checkLoginRateLimit(ipOrUsername: string): { allowed: boolean; retryAfterSec?: number } {
  const key = ipOrUsername.toLowerCase();
  const entry = loginAttempts.get(key);
  if (!entry) return { allowed: true };
  const now = Date.now();
  if (entry.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((entry.lockedUntil - now) / 1000),
    };
  }
  if (entry.lockedUntil <= now && entry.count >= MAX_ATTEMPTS) {
    loginAttempts.delete(key);
    return { allowed: true };
  }
  return { allowed: true };
}

export function recordFailedLogin(ipOrUsername: string): void {
  const key = ipOrUsername.toLowerCase();
  const now = Date.now();
  const entry = loginAttempts.get(key) || { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
  loginAttempts.set(key, entry);
}

export function resetLoginAttempts(ipOrUsername: string): void {
  loginAttempts.delete(ipOrUsername.toLowerCase());
}

// Extract token from Authorization header or cookie
export function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  // Check cookie if available
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/smartpos_token=([^;]+)/);
    if (match) return decodeURIComponent(match[1].trim());
  }
  return null;
}

// Express Auth Middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Authentication required' });
  }
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ ok: false, error: 'Unauthorized: Invalid or expired session' });
  }
  (req as any).user = session;
  next();
}

// Require Admin Role Middleware
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = (req as any).user as UserSession | undefined;
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Forbidden: Administrator privileges required' });
  }
  next();
}
