/**
 * Activity log persistence (Phase 6). logActivity never throws: a failed log
 * must never block the action it describes. db/client loads lazily.
 */
import { randomUUID } from 'node:crypto';

import { canSee, involved } from './scope';
import type { Actor, LogAction, LogEntry } from './types';

export * from './types';
export * from './scope';

/** Postgres timestamptz text ("2026-10-09 05:12:33.1+00") -> ISO 8601 UTC. */
export function pgTimestampToIso(v: string): string {
  const t = Date.parse(v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00'));
  return Number.isNaN(t) ? v : new Date(t).toISOString();
}

async function dbAndSchema() {
  const [{ db }, schema, orm] = await Promise.all([import('../../db/client'), import('../../db/schema'), import('drizzle-orm')]);
  return { db, s: schema, orm };
}

export async function logActivity(
  actor: Actor,
  action: LogAction,
  summary: string,
  opts: { orderId?: string | null; hospitals?: (string | null | undefined)[] } = {},
): Promise<void> {
  try {
    const { db, s } = await dbAndSchema();
    await db.insert(s.activityLog).values({
      id: `log-${randomUUID()}`,
      actorRole: actor.role,
      actorHospital: actor.hospitalId ?? null,
      action,
      orderId: opts.orderId ?? null,
      hospitalIds: involved(actor, ...(opts.hospitals ?? [])),
      summary,
    });
  } catch {
    // Logging is best-effort by design.
  }
}

export interface LogFilter {
  hospitalId?: string;
  action?: LogAction;
  limit?: number;
}

/** Rows visible to `viewer`, newest first. Throws on DB failure. */
export async function listLogs(viewer: Actor, f: LogFilter = {}): Promise<LogEntry[]> {
  const { db, s, orm } = await dbAndSchema();
  const conds = [];
  if (viewer.role === 'hospital_admin') {
    const own = viewer.hospitalId ?? '';
    conds.push(orm.or(orm.eq(s.activityLog.actorHospital, own), orm.arrayContains(s.activityLog.hospitalIds, [own])));
  }
  if (f.hospitalId) {
    conds.push(orm.or(orm.eq(s.activityLog.actorHospital, f.hospitalId), orm.arrayContains(s.activityLog.hospitalIds, [f.hospitalId])));
  }
  if (f.action) conds.push(orm.eq(s.activityLog.action, f.action));
  const rows = await db
    .select()
    .from(s.activityLog)
    .where(conds.length ? orm.and(...conds) : undefined)
    .orderBy(orm.desc(s.activityLog.at))
    .limit(Math.min(Math.max(f.limit ?? 100, 1), 500));
  return rows
    .map((r) => ({
      id: r.id,
      at: pgTimestampToIso(r.at),
      actorRole: r.actorRole as LogEntry['actorRole'],
      actorHospital: r.actorHospital,
      action: r.action as LogEntry['action'],
      orderId: r.orderId,
      hospitalIds: r.hospitalIds,
      summary: r.summary,
    }))
    .filter((e) => canSee(viewer, e));
}
