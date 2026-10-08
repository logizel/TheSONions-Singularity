/**
 * Shared inline test network (3 hospitals x 2 medicines x 60 days) for the
 * pipeline and chat tests. Designed to hit: NULL-gap interpolation, expired
 * and archived batches, a waste-first transfer, an emergency order with no
 * feasible sender, and an outbreak series. Not imported by app code.
 */
import type { DailyUsageRow, EngineInput, StockBatchRow } from '../contracts';
import { historyWindow } from './history';

export const AS_OF = '2026-10-09';
export const GENERATED = '2026-10-09T08:00:00.000Z';
export const { dates: DATES } = historyWindow('2026-10-07');

export function series(
  hospitalId: string,
  medicineId: string,
  perDay: (i: number) => number | null,
  load = 100,
  emergencyPct = 20,
): DailyUsageRow[] {
  return DATES.map((usageDate, i) => ({
    usageDate,
    hospitalId,
    medicineId,
    usedQty: perDay(i),
    patientLoad: load,
    emergencyPct,
  }));
}

let n = 0;
const batch = (hospitalId: string, medicineId: string, qty: number, expiryDate: string, archived = false): StockBatchRow => ({
  id: `b${++n}`,
  hospitalId,
  medicineId,
  qty,
  expiryDate,
  archived,
  bufferDays: 7,
});

export const FAR = '2027-06-30';
export const NEAR = '2026-10-29'; // asOf + 20 days

export function baseInput(): EngineInput {
  return {
    hospitals: [
      { id: 'h-a', name: 'Alpha General' },
      { id: 'h-b', name: 'Bravo Clinic' },
      { id: 'h-c', name: 'Charlie Hospital' },
    ],
    medicines: [
      { id: 'm-x', name: 'Xamol', category: 'c', isCritical: true, baseUnit: 'tablet', substituteIds: [] },
      { id: 'm-y', name: 'Yorin', category: 'c', isCritical: false, baseUnit: 'vial', substituteIds: ['m-x'] },
    ],
    batches: [
      batch('h-a', 'm-x', 100, FAR),
      batch('h-a', 'm-x', 500, '2026-10-01'), // expired, not archived: unusable
      batch('h-a', 'm-x', 900, FAR, true), // archived: unusable
      batch('h-b', 'm-x', 600, NEAR), // near expiry -> waste at Bravo
      batch('h-b', 'm-x', 400, FAR),
      batch('h-c', 'm-x', 50, FAR),
      batch('h-b', 'm-y', 40, FAR),
      batch('h-c', 'm-y', 35, FAR),
    ],
    usage: [
      // Alpha/Xamol: 20/day with gaps, interpolated back to 20.
      ...series('h-a', 'm-x', (i) => (i % 9 === 4 ? null : 20), 100, 20),
      ...series('h-b', 'm-x', () => 10, 60, 10),
      ...series('h-c', 'm-x', () => 10, 80, 30),
      ...series('h-a', 'm-y', () => 5, 100, 20),
      ...series('h-b', 'm-y', () => 5, 60, 10),
      // Charlie/Yorin spikes on the last two days -> outbreak, trend forecast.
      ...series('h-c', 'm-y', (i) => (i >= 58 ? 50 : 5), 80, 30),
    ],
    transport: [
      { fromHospital: 'h-b', toHospital: 'h-a', days: 1 },
      { fromHospital: 'h-c', toHospital: 'h-a', days: 2 },
      { fromHospital: 'h-a', toHospital: 'h-b', days: 1 },
      { fromHospital: 'h-b', toHospital: 'h-c', days: 1 },
      { fromHospital: 'h-a', toHospital: 'h-c', days: 2 },
      { fromHospital: 'h-c', toHospital: 'h-b', days: 1 },
    ],
    leads: [
      { hospitalId: 'h-a', medicineId: 'm-x', leadDays: 10 },
      { hospitalId: 'h-b', medicineId: 'm-x', leadDays: 7 },
      { hospitalId: 'h-c', medicineId: 'm-x', leadDays: 3 },
      { hospitalId: 'h-a', medicineId: 'm-y', leadDays: 5 },
      { hospitalId: 'h-b', medicineId: 'm-y', leadDays: 7 },
      { hospitalId: 'h-c', medicineId: 'm-y', leadDays: 7 },
    ],
  };
}
