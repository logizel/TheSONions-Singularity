/**
 * Dashboard chat answers over ResultsJSON v2 (Phase 6, D-11). Port of the
 * Phase 4 fixture engine (components/chat/mock-answers.ts) to live data.
 *
 * Quote-only, two gates:
 *  1. per-answer allow-set: every number must come from the exact rows cited
 *     (a right-looking number from another row does not pass);
 *  2. validateAnswer(): every number must appear verbatim in the snapshot.
 * Single-shot: only the question and the active ?hospital= scope are used,
 * never chat history. Unanswerable -> SAFE_FALLBACK (carries no numbers).
 */
import type { InventoryEntry, ResultsJSON } from '../contracts';
import { validateAnswer } from './validator';

export const SAFE_FALLBACK = 'I can only answer from system results.';

/** Suggested risk-question chips. */
export const RISK_CHIPS: readonly string[] = [
  'Most at risk next week?',
  'What expires unused?',
  'Which transfers first?',
];

interface CitedAnswer {
  text: string;
  allowed: Set<string>;
}

const NUMERIC_TOKEN_RE = /\d+(?:\.\d+)?/g;
/** Dosage fragments in medicine names ("500mg") are not quantity quotes. */
const DOSAGE_FRAGMENT_RE = /\d+(?:\.\d+)?\s*(?:U\/ml|mg|mcg|g|ml)\b/gi;
/** ISO dates are verified as whole cited strings. */
const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}/g;

function citedAllowSet(...values: Array<string | number>): Set<string> {
  const allowed = new Set<string>();
  for (const v of values) {
    for (const t of String(v).match(NUMERIC_TOKEN_RE) ?? []) allowed.add(t);
    for (const d of String(v).match(ISO_DATE_RE) ?? []) allowed.add(d);
  }
  return allowed;
}

export function passesQuoteCheck(text: string, allowed: ReadonlySet<string>): boolean {
  const dates = text.match(ISO_DATE_RE) ?? [];
  if (!dates.every((d) => allowed.has(d))) return false;
  const scrubbed = text.replace(ISO_DATE_RE, ' ').replace(DOSAGE_FRAGMENT_RE, ' ');
  return (scrubbed.match(NUMERIC_TOKEN_RE) ?? []).every((t) => allowed.has(t));
}

const lcfirst = (s: string) => (s.length === 0 ? s : s.charAt(0).toLowerCase() + s.slice(1));
const days = (n: number) => `${n} day${n === 1 ? '' : 's'}`;

function makeAnswerer(r: ResultsJSON) {
  const hName = (id: string) => r.hospitals.find((h) => h.hospitalId === id)?.hospitalName ?? id;
  const mName = (id: string) => r.medicines.find((m) => m.medicineId === id)?.medicineName ?? id;
  const known = (id: string | null) => (id && r.hospitals.some((h) => h.hospitalId === id) ? id : null);
  const fallback = (): CitedAnswer => ({ text: SAFE_FALLBACK, allowed: new Set() });
  const shortages = (hospitalId?: string): InventoryEntry[] =>
    r.inventory
      .filter((e) => e.severity !== 'ok' && (hospitalId === undefined || e.hospitalId === hospitalId))
      .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout);

  function riskAnswer(hospitalId: string): CitedAnswer {
    const entry = r.priorities.filter((p) => p.hospitalId === hospitalId).sort((a, b) => a.rank - b.rank)[0];
    const worst = shortages(hospitalId)[0];
    const summary = r.hospitals.find((h) => h.hospitalId === hospitalId);
    if (!entry || !worst || !summary) return fallback();
    const text =
      `${hName(hospitalId)} is most at risk: ${mName(worst.medicineId)} reaches stockout in ` +
      `${days(worst.daysUntilStockout)} against a ${days(worst.leadDays)} supplier lead time, ` +
      `priority score ${entry.score}. Emergency share ${summary.emergencyPct}%, ` +
      `${summary.patientLoad} patients a day.`;
    return {
      text,
      allowed: citedAllowSet(worst.daysUntilStockout, worst.leadDays, entry.score, summary.emergencyPct, summary.patientLoad),
    };
  }

  function mostAtRisk(scope: string | null): CitedAnswer {
    if (scope) {
      const scoped = riskAnswer(scope);
      // A hospital with no shortage has no honest risk answer; say so via fallback.
      return scoped;
    }
    // Global: the top-ranked priority whose hospital has a shortage.
    for (const p of [...r.priorities].sort((a, b) => a.rank - b.rank)) {
      if (shortages(p.hospitalId).length > 0) return riskAnswer(p.hospitalId);
    }
    return fallback();
  }

  function waste(scope: string | null): CitedAnswer {
    const pool = scope ? r.wasteWarnings.filter((w) => w.hospitalId === scope) : r.wasteWarnings;
    const rows = [...(pool.length > 0 ? pool : r.wasteWarnings)].sort((a, b) => b.wasteUnits - a.wasteUnits);
    const [first, second] = rows;
    if (!first) {
      return { text: 'No stock is forecast to expire unused.', allowed: new Set() };
    }
    const clause = (w: typeof first) =>
      `${w.wasteUnits} units of ${mName(w.medicineId)} at ${hName(w.hospitalId)} expire unused by ${w.expiryDate}`;
    const body = `${clause(first)}${second ? `, and ${clause(second)}` : ''}.`;
    const prefix = scope && pool.length > 0 ? `At ${hName(scope)}, ` : '';
    return {
      text: prefix ? prefix + lcfirst(body) : body,
      allowed: citedAllowSet(first.wasteUnits, first.expiryDate, ...(second ? [second.wasteUnits, second.expiryDate] : [])),
    };
  }

  function transfers(scope: string | null): CitedAnswer {
    const pool = scope ? r.transfers.filter((t) => t.fromHospital === scope || t.toHospital === scope) : r.transfers;
    const first = (pool.length > 0 ? pool : r.transfers)[0];
    if (!first) {
      const order = r.emergencyOrders[0];
      if (!order) return { text: 'No transfers are suggested right now.', allowed: new Set() };
      return {
        text:
          `No hospital can send stock in time. Order ${order.qty} units of ${mName(order.medicineId)} ` +
          `for ${hName(order.hospitalId)} from the supplier (${days(order.leadDays)} lead time).`,
        allowed: citedAllowSet(order.qty, order.leadDays),
      };
    }
    const need = r.inventory.find((e) => e.hospitalId === first.toHospital && e.medicineId === first.medicineId);
    const body =
      `Send ${first.qty} units of ${mName(first.medicineId)} from ${hName(first.fromHospital)} to ` +
      `${hName(first.toHospital)}, a ${days(first.transportDays)} delivery window.` +
      (need ? ` ${hName(first.toHospital)} runs out in ${days(need.daysUntilStockout)}.` : '');
    const prefix = scope && pool.length > 0 ? `At ${hName(scope)}, ` : '';
    return {
      text: prefix ? prefix + lcfirst(body) : body,
      allowed: citedAllowSet(first.qty, first.transportDays, ...(need ? [need.daysUntilStockout] : [])),
    };
  }

  function stockoutTiming(scope: string | null): CitedAnswer {
    const rows = r.inventory.filter((e) => scope === null || e.hospitalId === scope);
    const worst = [...rows].sort((a, b) => a.daysUntilStockout - b.daysUntilStockout)[0];
    if (!worst) return fallback();
    const text =
      `${mName(worst.medicineId)} at ${hName(worst.hospitalId)} reaches stockout in ` +
      `${days(worst.daysUntilStockout)}, the earliest ${scope ? 'there' : 'in the network'}. ` +
      `Forecast days ${r.advisory.fromDay} to ${r.advisory.toDay} are advisory only.`;
    return { text, allowed: citedAllowSet(worst.daysUntilStockout, r.advisory.fromDay, r.advisory.toDay) };
  }

  /**
   * EVT-05: quote an engine-emitted event reason verbatim (no arithmetic).
   * Narrowed to the scope hospital and, when the question names one, to a
   * medicine. The allow-set is built from the reason string itself.
   */
  function eventReasons(scope: string | null, question: string): CitedAnswer {
    const none: CitedAnswer = { text: 'No local events are raising forecast demand right now.', allowed: new Set() };
    let pool = r.forecasts.filter(
      (f) => (f.eventReasons?.length ?? 0) > 0 && (scope === null || f.hospitalId === scope),
    );
    const named = r.medicines.filter((m) => {
      const name = m.medicineName.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return name.length > 0 && new RegExp(`(^|[^a-z0-9])${name}([^a-z0-9]|$)`).test(question);
    });
    if (named.length > 0) {
      const ids = new Set(named.map((m) => m.medicineId));
      pool = pool.filter((f) => ids.has(f.medicineId));
    }
    const first = [...pool].sort((a, b) =>
      a.hospitalId === b.hospitalId
        ? a.medicineId.localeCompare(b.medicineId)
        : a.hospitalId.localeCompare(b.hospitalId),
    )[0];
    const reason = first?.eventReasons?.[0];
    if (!first || !reason) return none;
    return {
      text: `${mName(first.medicineId)} demand at ${hName(first.hospitalId)} is expected to rise: ${reason}.`,
      allowed: citedAllowSet(reason),
    };
  }

  return { known, mostAtRisk, waste, transfers, stockoutTiming, eventReasons };
}

/** Questions about local events / demand rises route to the event answer (EVT-05). */
const EVENT_WORDS = ['event', 'flood', 'heat', 'cyclone', 'earthquake', 'epidemic', 'festival', 'demand up', 'demand rising'];

function asksAboutEvents(q: string): boolean {
  return EVENT_WORDS.some((w) => q.includes(w)) || (q.includes('why is') && q.includes('demand'));
}

/** Single-shot answer; `results` null (not loaded) always falls back. */
export function answerQuestion(
  question: string,
  contextHospitalId: string | null,
  results: ResultsJSON | null,
): { text: string } {
  if (!results) return { text: SAFE_FALLBACK };
  const a = makeAnswerer(results);
  const scope = a.known(contextHospitalId);
  const q = question.trim().toLowerCase();
  const done = (ans: CitedAnswer) =>
    passesQuoteCheck(ans.text, ans.allowed) && validateAnswer(ans.text, results)
      ? { text: ans.text }
      : { text: SAFE_FALLBACK };

  if (q === RISK_CHIPS[0].toLowerCase()) return done(a.mostAtRisk(scope));
  if (q === RISK_CHIPS[1].toLowerCase()) return done(a.waste(scope));
  if (q === RISK_CHIPS[2].toLowerCase()) return done(a.transfers(scope));

  if (asksAboutEvents(q)) return done(a.eventReasons(scope, q));
  if (q.includes('expir') || q.includes('unused') || q.includes('waste')) return done(a.waste(scope));
  if (
    q.includes('transfer') ||
    q.includes(' move') ||
    q.includes('moves') ||
    q.includes('send') ||
    q.includes('which first') ||
    q.includes('supplier order')
  ) {
    return done(a.transfers(scope));
  }
  if (
    q.includes('stockout') ||
    q.includes('stock out') ||
    q.includes('run out') ||
    q.includes('timing') ||
    q.includes('how long') ||
    q.includes('when will') ||
    q.includes('days left')
  ) {
    return done(a.stockoutTiming(scope));
  }
  if (q.includes('risk') || q.includes('next week') || q.includes('worst') || q.includes('critical') || q.includes('outbreak')) {
    return done(a.mostAtRisk(scope));
  }
  return { text: SAFE_FALLBACK };
}
