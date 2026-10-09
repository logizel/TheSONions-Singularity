// Seeds only the demo local events (EVT-01): deletes rows with id
// 'seed-ev-%' and re-inserts demoEvents(today). Idempotent; never touches
// admin-entered events or any other table.
//
// Run: node --env-file=.env --import tsx scripts/seed-events.ts
import { like } from "drizzle-orm";

import { db } from "../db/client";
import { localEvents } from "../db/schema";
import { demoEvents } from "./demo-events";

async function main() {
  const today = new Date().toISOString().slice(0, 10);
  const rows = demoEvents(today);
  await db.delete(localEvents).where(like(localEvents.id, "seed-ev-%"));
  await db.insert(localEvents).values(rows);
  console.log(JSON.stringify({ inserted: rows.length }));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
