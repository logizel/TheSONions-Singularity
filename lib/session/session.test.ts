/**
 * Session cookie tests: sign/verify round trip, tampering, expiry, the
 * gen-cookie.ts format, and that middleware.ts accepts/rejects the same
 * cookies (both sides must agree, D-13).
 */
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import middleware from '../../middleware';
import { SESSION_COOKIE, demoAuthEnabled, signSession, verifySession } from './index';

const SECRET = 'test-secret-for-session-tests';
const NOW = 1_800_000_000;

/** Exactly what scripts/gen-cookie.ts emits (no exp). */
function genCookie(role: string, hospitalId?: string): string {
  const payload: Record<string, string> = { role };
  if (hospitalId) payload.hospitalId = hospitalId;
  const part = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${part}.${createHmac('sha256', SECRET).update(part).digest('base64url')}`;
}

describe('signSession / verifySession', () => {
  it('round-trips both roles', () => {
    const na = signSession({ role: 'network_admin', exp: NOW + 60 }, SECRET);
    expect(verifySession(na, SECRET, NOW)).toEqual({ role: 'network_admin', exp: NOW + 60 });
    const ha = signSession({ role: 'hospital_admin', hospitalId: 'h-civil', exp: NOW + 60 }, SECRET);
    expect(verifySession(ha, SECRET, NOW)).toEqual({ role: 'hospital_admin', hospitalId: 'h-civil', exp: NOW + 60 });
  });

  it('accepts gen-cookie.ts cookies without exp', () => {
    expect(verifySession(genCookie('hospital_admin', 'h-north'), SECRET, NOW)).toEqual({
      role: 'hospital_admin',
      hospitalId: 'h-north',
    });
  });

  it('rejects wrong secret, tampering, expiry and bad shapes', () => {
    const good = signSession({ role: 'network_admin', exp: NOW + 60 }, SECRET);
    expect(verifySession(good, 'other-secret', NOW)).toBeNull();
    expect(verifySession(good, undefined, NOW)).toBeNull();
    expect(verifySession(undefined, SECRET, NOW)).toBeNull();
    expect(verifySession('nodot', SECRET, NOW)).toBeNull();
    expect(verifySession(good, SECRET, NOW + 60)).toBeNull(); // exp is exclusive
    const [part, sig] = good.split('.');
    const forged = Buffer.from(JSON.stringify({ role: 'network_admin', exp: NOW + 9999 })).toString('base64url');
    expect(verifySession(`${forged}.${sig}`, SECRET, NOW)).toBeNull();
    expect(verifySession(`${part}.${sig}x`, SECRET, NOW)).toBeNull();
    expect(verifySession(signSession({ role: 'hospital_admin', exp: NOW + 60 }, SECRET), SECRET, NOW)).toBeNull();
    expect(verifySession(signSession({ role: 'root' as never }, SECRET), SECRET, NOW)).toBeNull();
  });

  it('refuses to sign without a secret', () => {
    expect(() => signSession({ role: 'network_admin' }, '')).toThrow();
  });

  it('enables demo auth only for DEMO_AUTH=true', () => {
    expect(demoAuthEnabled({ DEMO_AUTH: 'true' })).toBe(true);
    expect(demoAuthEnabled({ DEMO_AUTH: '1' })).toBe(false);
    expect(demoAuthEnabled({})).toBe(false);
  });
});

describe('middleware agrees with lib/session', () => {
  const saved = process.env.SESSION_SECRET;
  beforeEach(() => {
    process.env.SESSION_SECRET = SECRET;
  });
  afterEach(() => {
    process.env.SESSION_SECRET = saved;
  });

  const call = (cookie: string | null, method = 'GET', path = '/api/results') => {
    const headers = new Headers();
    if (cookie !== null) headers.set('cookie', `${SESSION_COOKIE}=${cookie}`);
    return middleware(new NextRequest(`http://localhost${path}`, { method, headers }));
  };
  const nowS = () => Math.floor(Date.now() / 1000);

  it('passes a fresh signed session and a gen-cookie session', async () => {
    expect((await call(signSession({ role: 'network_admin', exp: nowS() + 600 }, SECRET))).status).toBe(200);
    expect((await call(genCookie('hospital_admin', 'h-civil'))).status).toBe(200);
  });

  it('401s missing, expired and forged sessions', async () => {
    expect((await call(null)).status).toBe(401);
    expect((await call(signSession({ role: 'network_admin', exp: nowS() - 1 }, SECRET))).status).toBe(401);
    const other = createHmac('sha256', 'nope').update('x').digest('base64url');
    expect((await call(`eyJyb2xlIjoibmV0d29ya19hZG1pbiJ9.${other}`)).status).toBe(401);
  });

  it('403s hospital_admin on network-admin-only paths', async () => {
    const ha = signSession({ role: 'hospital_admin', hospitalId: 'h-civil', exp: nowS() + 600 }, SECRET);
    expect((await call(ha, 'GET', '/api/moves/accept')).status).toBe(403);
    expect((await call(ha, 'POST', '/api/orders/x')).status).toBe(403);
  });
});
