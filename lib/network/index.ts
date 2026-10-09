/**
 * The one ResultsJSON snapshot the dashboard, chat and cart read (Phase 6).
 *
 * getResults(): short in-memory cache -> live Neon + engine -> last written
 * blob (data/results.json, flagged as a snapshot) -> null (caller 503s).
 */
import type { ResultsJSON } from '../contracts';
import { buildResults } from './build';
import { loadEngineInput } from './load';

export { buildResults, demandOver } from './build';
export { loadEngineInput } from './load';

/** Live results are reused for this long so a page load + chat share one snapshot. */
export const RESULTS_TTL_MS = 30_000;

export type ResultsSource = 'live' | 'snapshot';

export interface ResultsEnvelope {
  results: ResultsJSON;
  source: ResultsSource;
}

// Shared via globalThis: route handlers and pages can load separate module
// copies, and a delivery must invalidate the snapshot for both.
const store = globalThis as unknown as { __resultsCache?: { at: number; results: ResultsJSON } | null };

/** Structural check for a v2 blob; rejects the pre-Phase-6 shape. */
export function isResultsV2(v: unknown): v is ResultsJSON {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.generatedAt === 'string' &&
    typeof r.asOf === 'string' &&
    typeof r.mapePct === 'number' &&
    ['hospitals', 'medicines', 'inventory', 'forecasts', 'transfers', 'emergencyOrders', 'priorities'].every((k) =>
      Array.isArray(r[k]),
    )
  );
}

export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}

async function readSnapshot(): Promise<ResultsJSON | null> {
  try {
    const [{ readFile }, path] = await Promise.all([import('node:fs/promises'), import('node:path')]);
    const blob: unknown = JSON.parse(await readFile(path.join(process.cwd(), 'data', 'results.json'), 'utf8'));
    return isResultsV2(blob) ? blob : null;
  } catch {
    return null;
  }
}

export async function getResults(now: Date = new Date()): Promise<ResultsEnvelope | null> {
  const cached = store.__resultsCache;
  if (cached && now.getTime() - cached.at < RESULTS_TTL_MS) {
    return { results: cached.results, source: 'live' };
  }
  try {
    const input = await loadEngineInput();
    const results = buildResults(input, { asOf: todayIso(now), generatedAt: now.toISOString() });
    store.__resultsCache = { at: now.getTime(), results };
    return { results, source: 'live' };
  } catch {
    const snapshot = await readSnapshot();
    return snapshot ? { results: snapshot, source: 'snapshot' } : null;
  }
}

/** Test hook: drop the in-memory cache. */
export function resetResultsCache(): void {
  store.__resultsCache = null;
}
