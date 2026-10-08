/**
 * Signed `session` cookie, server side (Phase 6, D-13).
 *
 * Format is shared with middleware.ts and scripts/gen-cookie.ts:
 *   base64url(JSON payload) + "." + base64url(HMAC-SHA256(secret, payloadPart))
 * Payload: { role, hospitalId?, exp? }. `exp` (epoch seconds) is optional so
 * cookies minted by gen-cookie.ts keep working; demo sign-in always sets it.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'session';
/** Demo sessions last one working day. */
export const SESSION_TTL_S = 12 * 60 * 60;

export type SessionRole = 'hospital_admin' | 'network_admin';

export interface SessionPayload {
  role: SessionRole;
  hospitalId?: string;
  /** Expiry, epoch seconds. */
  exp?: number;
}

function hmac(secret: string, data: string): string {
  return createHmac('sha256', secret).update(data).digest('base64url');
}

export function signSession(payload: SessionPayload, secret: string): string {
  if (!secret) throw new Error('SESSION_SECRET is not set');
  const part = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${part}.${hmac(secret, part)}`;
}

/** Returns the payload when the signature, shape and expiry all check out. */
export function verifySession(
  cookie: string | undefined,
  secret: string | undefined,
  nowS: number = Math.floor(Date.now() / 1000),
): SessionPayload | null {
  if (!cookie || !secret) return null;
  const dot = cookie.lastIndexOf('.');
  if (dot <= 0) return null;
  const part = cookie.slice(0, dot);
  const sig = Buffer.from(cookie.slice(dot + 1));
  const expected = Buffer.from(hmac(secret, part));
  if (sig.length !== expected.length || !timingSafeEqual(sig, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
    if (p.role !== 'hospital_admin' && p.role !== 'network_admin') return null;
    if (p.role === 'hospital_admin' && (typeof p.hospitalId !== 'string' || p.hospitalId === '')) return null;
    if (p.exp !== undefined && (typeof p.exp !== 'number' || p.exp <= nowS)) return null;
    const out: SessionPayload = { role: p.role };
    if (typeof p.hospitalId === 'string') out.hospitalId = p.hospitalId;
    if (typeof p.exp === 'number') out.exp = p.exp;
    return out;
  } catch {
    return null;
  }
}

/** Demo sign-in is opt-in per deployment. */
export function demoAuthEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.DEMO_AUTH === 'true';
}
