/**
 * Who sees which log rows: network admin sees everything; a hospital admin
 * sees its own actions and anything that involves its hospital.
 */
import type { Actor, LogEntry } from './types';

export function canSee(viewer: Actor, e: Pick<LogEntry, 'actorHospital' | 'hospitalIds'>): boolean {
  if (viewer.role === 'network_admin') return true;
  const own = viewer.hospitalId;
  if (!own) return false;
  return e.actorHospital === own || e.hospitalIds.includes(own);
}

/** Hospitals to index a row under: the actor's plus any involved, deduplicated. */
export function involved(actor: Actor, ...hospitalIds: (string | null | undefined)[]): string[] {
  return [...new Set([actor.hospitalId, ...hospitalIds].filter((h): h is string => typeof h === 'string' && h !== ''))];
}

export function actorLabel(role: Actor['role'], hospitalName: string | null): string {
  return role === 'network_admin' ? 'Network admin' : `Hospital admin, ${hospitalName ?? 'unknown hospital'}`;
}
