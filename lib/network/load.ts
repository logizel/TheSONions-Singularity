/**
 * Read-only Neon loader for the engine input (Phase 6, D-02). db/client is
 * imported lazily so importing lib/network never opens a connection.
 */
import type { EngineInput } from '../contracts';

export async function loadEngineInput(): Promise<EngineInput> {
  const [{ db }, schema] = await Promise.all([import('../../db/client'), import('../../db/schema')]);
  const [hospitals, medicines, batches, usage, transport, leads] = await Promise.all([
    // Only what the engine needs: works whether or not the Phase 6
    // coordinate columns (migration 0001) are applied yet.
    db.select({ id: schema.hospitals.id, name: schema.hospitals.name }).from(schema.hospitals),
    db.select().from(schema.medicines),
    db.select().from(schema.stockBatches),
    db.select().from(schema.dailyUsage),
    db.select().from(schema.transportDays),
    db.select().from(schema.supplierLeads),
  ]);
  return { hospitals, medicines, batches, usage, transport, leads };
}

