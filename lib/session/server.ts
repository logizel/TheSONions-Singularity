/**
 * Read the current session in Server Components / Server Functions (D-13).
 * Kept apart from index.ts so the pure signing code stays testable without
 * Next's request context.
 */
import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession, type SessionPayload } from './index';

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value, process.env.SESSION_SECRET);
}
