// Fill hospitals.latitude/longitude/address for the demo seed hospitals
// without reseeding (Phase 6, D-04). Idempotent: UPDATE by id only, never
// inserts or deletes, never touches other tables or non-seed hospitals.
// Requires migration 0001_hospital_coordinates to be applied first.
// Run: node --env-file=.env --import tsx scripts/set-demo-coordinates.ts
import { eq } from "drizzle-orm";

import { db } from "../db/client";
import { hospitals } from "../db/schema";
import { DEMO_COORDINATES } from "./demo-coordinates";

async function main() {
  const updated: string[] = [];
  for (const [id, c] of Object.entries(DEMO_COORDINATES)) {
    const rows = await db
      .update(hospitals)
      .set({ latitude: c.latitude, longitude: c.longitude, address: c.address })
      .where(eq(hospitals.id, id))
      .returning({ id: hospitals.id });
    if (rows.length > 0) updated.push(id);
  }
  console.log(JSON.stringify({ updated, skipped: Object.keys(DEMO_COORDINATES).filter((id) => !updated.includes(id)) }));
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
