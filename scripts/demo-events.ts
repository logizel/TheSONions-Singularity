// DEMO DATA (EVT-01): local events for the demo network. Dates are relative
// to the run date on purpose, so the demo flood stays live whenever the seed
// is re-run (a fixed date would expire and silently stop showing anything).
//   seed-ev-flood: active flood near Kavoor, reaches h-north only.
//   seed-ev-heat:  heat wave near h-civil that has already ended, to prove
//                  ended events are ignored by the engine.
import type { LocalEventRow } from "../lib/contracts";

const DAY_MS = 86_400_000;
const shift = (iso: string, days: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

export function demoEvents(today: string): LocalEventRow[] {
  return [
    {
      id: "seed-ev-flood",
      type: "flood",
      latitude: 12.94,
      longitude: 74.825,
      radiusKm: 4,
      startsOn: today,
      endsOn: shift(today, 14),
      severity: 2,
      source: "manual",
      note: "DEMO: river flooding near Kavoor",
    },
    {
      id: "seed-ev-heat",
      type: "heatwave",
      latitude: 12.8703,
      longitude: 74.8436,
      radiusKm: 5,
      startsOn: shift(today, -20),
      endsOn: shift(today, -10),
      severity: 2,
      source: "manual",
      note: "DEMO: heat wave (already ended)",
    },
  ];
}
