/**
 * Canned mock answer engine (D-19, D-20, D-21, D-23).
 *
 * Quote-only by construction: every answer is built from the static mock
 * ResultsJSON fixture and every numeric token is post-checked against a
 * per-answer allow-set built from the exact cited rows before it may
 * render (T-4-11, T-4-17). Unanswerable questions resolve to the safe
 * fallback sentence — fake data never renders (D-23).
 *
 * Matching is single-shot (Phase 3 D-12): answerQuestion receives only the
 * current question text plus the active hospital filter. Conversation
 * history is display-only in ChatPanel and is never passed in here (D-22,
 * T-4-13).
 *
 * All four intents honor the active hospital cross-filter (G-04-3): the
 * validated scope threads through answerMostAtRisk, answerWaste,
 * answerTransfers, and answerStockoutTiming via knownHospitalId. Scoped
 * answers name the hospital so the filter is visible in the reply; an
 * empty scoped slice degrades to the global answer, or to SAFE_FALLBACK
 * where no honest scoped answer exists.
 *
 * Most-at-risk pairs within one hospital (G-04-4): the worst shortage of
 * the top-ranked priority hospital itself, quoting that entry's own
 * reasons vocabulary — never a cross-hospital join, never hardcoded
 * flag wording.
 *
 * Answers are plain text with no source tags (D-20) and carry no
 * Approve/Order affordances — the chat never renders move-approval actions
 * under any role (D-26 holds trivially in v1).
 */
import fixtureJson from "@/app/data/mock-results.json";
import { type ResultsFixture } from "@/app/data/results";

/** Placeholder rejection copy (D-23; exact wording owned by Phase 3). */
export const SAFE_FALLBACK = "I can only answer from system results";

/** The three suggested risk-question chips (D-21). */
export const RISK_CHIPS: readonly string[] = [
  "Most at risk next week?",
  "What expires unused?",
  "Which transfers first?",
];

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  text: string;
}

/** One built answer plus the allow-set its quote gate enforces. */
interface CitedAnswer {
  text: string;
  allowed: ReadonlySet<string>;
}

const fixture = fixtureJson as ResultsFixture;

const NUMERIC_TOKEN_RE = /\d+(?:\.\d+)?/g;
/** Dosage fragments embedded in medicine names ("500mg", "100mcg",
 * "100U/ml") are never quantity quotes — stripped before the gate scans. */
const DOSAGE_FRAGMENT_RE = /\d+(?:\.\d+)?\s*(?:U\/ml|mg|mcg|g|ml)\b/gi;
/** ISO dates are verified as whole cited strings, never as loose parts. */
const ISO_DATE_RE = /\d{4}-\d{2}-\d{2}/g;

function numericTokens(value: string | number): string[] {
  return String(value).match(NUMERIC_TOKEN_RE) ?? [];
}

/**
 * Per-answer allow-set from the exact cited rows: quantity fields (days,
 * scores, qtys) plus the full ISO date strings actually quoted.
 * Medicine-name dosage fragments are never collected here (G-04-5).
 */
function citedAllowSet(...values: Array<string | number>): Set<string> {
  const allowed = new Set<string>();
  for (const value of values) {
    for (const token of numericTokens(value)) allowed.add(token);
    for (const date of String(value).match(ISO_DATE_RE) ?? [])
      allowed.add(date);
  }
  return allowed;
}

/**
 * Per-answer quote gate (G-04-5, T-4-17): every ISO date in the text must
 * equal a cited date actually quoted, and every remaining numeric token —
 * after stripping medicine-name dosage fragments — must appear in the
 * allow-set built from the cited rows' quantity fields. A wrong quantity
 * whose digits merely exist elsewhere in the fixture no longer passes;
 * dosage fragments and date parts are rejected as quantity quotes.
 */
export function passesQuoteCheck(
  text: string,
  allowed: ReadonlySet<string>,
): boolean {
  const dates = text.match(ISO_DATE_RE) ?? [];
  if (!dates.every((date) => allowed.has(date))) return false;
  const scrubbed = text
    .replace(ISO_DATE_RE, " ")
    .replace(DOSAGE_FRAGMENT_RE, " ");
  const tokens = scrubbed.match(NUMERIC_TOKEN_RE) ?? [];
  return tokens.every((token) => allowed.has(token));
}

function hospitalName(id: string): string {
  return fixture.hospitals.find((h) => h.id === id)?.name ?? id;
}

function medicineName(id: string): string {
  return fixture.medicines.find((m) => m.id === id)?.name ?? id;
}

/** Raw hospital filter is validated against the fixture, never trusted. */
function knownHospitalId(id: string | null): string | null {
  if (!id) return null;
  return fixture.hospitals.some((h) => h.id === id) ? id : null;
}

/** Lowercase the first letter so a scoped "At X, …" prefix reads naturally. */
function lcfirst(text: string): string {
  return text.length === 0 ? text : text.charAt(0).toLowerCase() + text.slice(1);
}

/** Safe fallback carries no numbers, so it passes any per-answer gate. */
function fallback(): CitedAnswer {
  return { text: SAFE_FALLBACK, allowed: new Set<string>() };
}

/** Worst shortage row for one hospital; undefined when it has none. */
function worstShortageFor(hospitalId: string) {
  return [...fixture.shortages]
    .filter((s) => s.hospitalId === hospitalId)
    .sort((a, b) => a.daysToStockout - b.daysToStockout)[0];
}

/**
 * Two-sentence risk answer quoting the priority entry's own reasons
 * vocabulary (G-04-4). The hospital is named, so a scoped filter stays
 * visible in the reply (G-04-3).
 */
function riskAnswer(
  entry: ResultsFixture["priorities"][number],
  worst: ResultsFixture["shortages"][number],
): CitedAnswer {
  const text =
    `${hospitalName(entry.hospitalId)} is most at risk — ` +
    `${medicineName(worst.medicineId)} reaches stockout in ` +
    `${worst.daysToStockout} days with priority score ${entry.score}.` +
    ` Reasons: ${entry.reasons.join(", ")}.`;
  const allowed = citedAllowSet(
    worst.daysToStockout,
    entry.score,
    ...entry.reasons,
  );
  return { text, allowed };
}

/** Global path: worst shortage of the top-ranked priority hospital (G-04-4). */
function globalMostAtRisk(): CitedAnswer {
  const top = [...fixture.priorities].sort((a, b) => a.rank - b.rank)[0];
  if (!top) return fallback();
  const worst = worstShortageFor(top.hospitalId);
  if (!worst) return fallback();
  return riskAnswer(top, worst);
}

/** Intent 1 — most-at-risk hospital (chip 1). */
function answerMostAtRisk(contextHospitalId: string | null): CitedAnswer {
  const scoped = knownHospitalId(contextHospitalId);
  if (scoped === null) return globalMostAtRisk();
  const entry = fixture.priorities.find((p) => p.hospitalId === scoped);
  // No priority entry for the filtered hospital: degrade to global (G-04-3).
  if (!entry) return globalMostAtRisk();
  const worst = worstShortageFor(entry.hospitalId);
  // A hospital with no shortage row has no honest risk answer (G-04-4).
  if (!worst) return fallback();
  return riskAnswer(entry, worst);
}

/** Intent 2 — waste quantities (chip 2). */
function answerWaste(contextHospitalId: string | null): CitedAnswer {
  const scoped = knownHospitalId(contextHospitalId);
  const pool = scoped
    ? fixture.expiries.filter((e) => e.hospitalId === scoped)
    : fixture.expiries;
  // Empty scoped slice degrades to the global answer (G-04-3).
  const rows = pool.length > 0 ? pool : fixture.expiries;
  const top = [...rows].sort((a, b) => b.qty - a.qty);
  const first = top[0];
  const second = top[1];
  if (!first) return fallback();
  const secondClause = second
    ? `, and ${second.qty} units of ${medicineName(second.medicineId)} at ` +
      `${hospitalName(second.hospitalId)} expire on ${second.expiryDate}`
    : "";
  const body =
    `${first.qty} units of ${medicineName(first.medicineId)} at ` +
    `${hospitalName(first.hospitalId)} expire on ${first.expiryDate}` +
    `${secondClause}. Without a transfer these batches expire unused.`;
  // The filter stays visible in the reply when scoping applied (G-04-3).
  const prefix =
    scoped && pool.length > 0 ? `At ${hospitalName(scoped)}, ` : "";
  const text = prefix === "" ? body : prefix + lcfirst(body);
  const allowed = citedAllowSet(
    first.qty,
    first.expiryDate,
    ...(second ? [second.qty, second.expiryDate] : []),
  );
  return { text, allowed };
}

/** Intent 3 — transfer reasons (chip 3). */
function answerTransfers(contextHospitalId: string | null): CitedAnswer {
  const scoped = knownHospitalId(contextHospitalId);
  const pool = scoped
    ? fixture.moves.filter((m) => m.fromId === scoped || m.toId === scoped)
    : fixture.moves;
  // Empty scoped slice degrades to the global answer (G-04-3).
  const rows = pool.length > 0 ? pool : fixture.moves;
  const first = rows[0];
  if (!first) return fallback();
  const shortage = fixture.shortages.find(
    (s) => s.hospitalId === first.toId && s.medicineId === first.medicineId,
  );
  const reason = shortage
    ? ` This covers the ${shortage.daysToStockout}-day stockout at ` +
      `${hospitalName(first.toId)}.`
    : "";
  const body =
    `Send ${first.qty} units of ${medicineName(first.medicineId)} from ` +
    `${hospitalName(first.fromId)} to ${hospitalName(first.toId)}, ` +
    `arriving in ${first.arrivesInDays} day${first.arrivesInDays === 1 ? "" : "s"}.` +
    `${reason}`;
  // The filter stays visible in the reply when scoping applied (G-04-3).
  const prefix =
    scoped && pool.length > 0 ? `At ${hospitalName(scoped)}, ` : "";
  const text = prefix === "" ? body : prefix + lcfirst(body);
  const allowed = citedAllowSet(
    first.qty,
    first.arrivesInDays,
    ...(shortage ? [shortage.daysToStockout] : []),
  );
  return { text, allowed };
}

/** Intent 4 — stockout timing, reachable via the composer (D-21). */
function answerStockoutTiming(contextHospitalId: string | null): CitedAnswer {
  const scoped = knownHospitalId(contextHospitalId);
  const rows = scoped
    ? fixture.inventory.filter((r) => r.hospitalId === scoped)
    : fixture.inventory;
  const worst = [...rows].sort(
    (a, b) => a.daysToStockout - b.daysToStockout,
  )[0];
  if (!worst) return fallback();
  const scopeNote = scoped ? ", the earliest there" : ", the earliest in the network";
  const text =
    `${medicineName(worst.medicineId)} at ` +
    `${hospitalName(worst.hospitalId)} reaches stockout in ` +
    `${worst.daysToStockout} days${scopeNote}.` +
    ` Days 15 to 30 of the forecast are advisory only.`;
  const allowed = citedAllowSet(
    worst.daysToStockout,
    fixture.advisory.startDay,
    fixture.advisory.endDay,
  );
  return { text, allowed };
}

/**
 * Single-shot canned matcher. `history` is intentionally NOT a parameter —
 * past turns never influence matching (D-22, T-4-13).
 */
export function answerQuestion(
  question: string,
  contextHospitalId: string | null,
): { text: string } {
  const q = question.trim().toLowerCase();

  // Exact chip taps resolve directly to their intent (D-21).
  if (q === RISK_CHIPS[0].toLowerCase())
    return checked(answerMostAtRisk(contextHospitalId));
  if (q === RISK_CHIPS[1].toLowerCase())
    return checked(answerWaste(contextHospitalId));
  if (q === RISK_CHIPS[2].toLowerCase())
    return checked(answerTransfers(contextHospitalId));

  // Free-text composer: keyword routing across all four v1 intents (D-09).
  if (
    q.includes("expir") ||
    q.includes("unused") ||
    q.includes("waste")
  ) {
    return checked(answerWaste(contextHospitalId));
  }
  if (
    q.includes("transfer") ||
    q.includes(" move") ||
    q.includes("moves") ||
    q.includes("send") ||
    q.includes("which first") ||
    q.includes("supplier order")
  ) {
    return checked(answerTransfers(contextHospitalId));
  }
  if (
    q.includes("stockout") ||
    q.includes("stock out") ||
    q.includes("run out") ||
    q.includes("timing") ||
    q.includes("how long") ||
    q.includes("when will") ||
    q.includes("days left")
  ) {
    return checked(answerStockoutTiming(contextHospitalId));
  }
  if (
    q.includes("risk") ||
    q.includes("next week") ||
    q.includes("worst") ||
    q.includes("critical") ||
    q.includes("outbreak")
  ) {
    return checked(answerMostAtRisk(contextHospitalId));
  }

  return { text: SAFE_FALLBACK };
}

/** T-4-11: an answer with a non-cited number never renders. */
function checked(answer: CitedAnswer): { text: string } {
  return {
    text: passesQuoteCheck(answer.text, answer.allowed)
      ? answer.text
      : SAFE_FALLBACK,
  };
}
