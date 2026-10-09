/**
 * Read-only Neon loader for the engine input (Phase 6, D-02). db/client is
 * imported lazily so importing lib/network never opens a connection.
 */
import type { EngineInput, LocalEventRow, LocalEventSource, LocalEventType } from '../contracts';

export async function loadEngineInput(): Promise<EngineInput> {
  const [{ db }, schema] = await Promise.all([import('../../db/client'), import('../../db/schema')]);
  const [hospitals, medicines, batches, usage, transport, leads, events] = await Promise.all([
    // Coordinates (migration 0001) feed the local-event radius check (EVT-03).
    db
      .select({
        id: schema.hospitals.id,
        name: schema.hospitals.name,
        latitude: schema.hospitals.latitude,
        longitude: schema.hospitals.longitude,
      })
      .from(schema.hospitals),
    db.select().from(schema.medicines),
    db.select().from(schema.stockBatches),
    db.select().from(schema.dailyUsage),
    db.select().from(schema.transportDays),
    db.select().from(schema.supplierLeads),
    db.select().from(schema.localEvents),
  ]);
  return {
    hospitals,
    medicines,
    batches,
    usage,
    transport,
    leads,
    // DB CHECK constraints guarantee the unions; the engine re-validates.
    events: events.map(
      (e): LocalEventRow => ({
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
      }),
    ),
  };
}
