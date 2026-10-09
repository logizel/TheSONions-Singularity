/**
 * Neon persistence for local events (EVT-01/04). Server only. Rows are never
 * deleted: ending an event moves ends_on to the day before asOf, so the
 * engine ignores it from today on. db/client loads lazily so importing this
 * module (tests, build) never opens a connection.
 */
import { randomUUID } from 'node:crypto';

import type { LocalEventRow, LocalEventSource, LocalEventType } from '../contracts';
import type { EventInput } from './index';

async function dbAndSchema() {
  const [{ db }, schema, orm] = await Promise.all([
    import('../../db/client'),
    import('../../db/schema'),
    import('drizzle-orm'),
  ]);
  return { db, s: schema, orm };
}

type DbEvent = {
  id: string;
  type: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  startsOn: string;
  endsOn: string;
  severity: number;
  source: string;
  note: string | null;
};

const toRow = (e: DbEvent): LocalEventRow => ({
  id: e.id,
  type: e.type as LocalEventType,
  latitude: e.latitude,
  longitude: e.longitude,
  radiusKm: e.radiusKm,
  startsOn: e.startsOn,
  endsOn: e.endsOn,
  severity: e.severity,
  source: e.source as LocalEventSource,
  note: e.note,
});

const DAY_MS = 86_400_000;
const dayBefore = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - DAY_MS).toISOString().slice(0, 10);

/** Every event, latest ending first. Throws on DB failure. */
export async function listEvents(): Promise<LocalEventRow[]> {
  const { db, s, orm } = await dbAndSchema();
  const rows = await db
    .select()
    .from(s.localEvents)
    .orderBy(orm.desc(s.localEvents.endsOn), orm.asc(s.localEvents.id));
  return rows.map(toRow);
}

export async function createEvent(input: EventInput): Promise<LocalEventRow> {
  const { db, s } = await dbAndSchema();
  const id = `ev-${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const [row] = await db
    .insert(s.localEvents)
    .values({ id, source: 'manual', ...input })
    .returning();
  return toRow(row);
}

/**
 * Ends an event as of `asOf`: ends_on = asOf - 1 day, and starts_on is pulled
 * back to that date if needed so the ends_on >= starts_on check holds.
 * Returns null when the id does not exist.
 */
export async function endEvent(id: string, asOf: string): Promise<LocalEventRow | null> {
  const { db, s, orm } = await dbAndSchema();
  const end = dayBefore(asOf);
  const rows = await db
    .update(s.localEvents)
    .set({
      endsOn: end,
      startsOn: orm.sql`least(${s.localEvents.startsOn}, ${end}::date)`,
    })
    .where(orm.eq(s.localEvents.id, id))
    .returning();
  return rows[0] ? toRow(rows[0]) : null;
}
