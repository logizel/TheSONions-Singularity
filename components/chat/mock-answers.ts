/**
 * Canned mock answer engine (D-19, D-20, D-21, D-23).
 *
 * Quote-only by construction: every answer is built from the static mock
 * ResultsJSON fixture and every numeric token is post-checked against the
 * fixture before it may render (T-4-11). Unanswerable questions resolve to
 * the safe fallback sentence — fake data never renders (D-23).
 *
 * Matching is single-shot (Phase 3 D-12): answerQuestion receives only the
 * current question text plus the active hospital filter. Conversation
 * history is display-only in ChatPanel and is never passed in here (D-22,
 * T-4-13).
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

const fixture = fixtureJson as ResultsFixture;

/**
 * Every numeric token that exists in the fixture, tokenized the same way
 * answers are scanned. Membership here is the exact-match quote gate
 * (Phase 3 D-13 spirit: every number rendered must appear verbatim).
 */
const FIXTURE_NUMERIC_TOKENS: ReadonlySet<string> = new Set(
  JSON.stringify(fixture).match(/\d+(?:\.\d+)?/g) ?? [],
);

/** Post-check: true when every numeric token in text exists in the fixture. */
export function passesQuoteCheck(text: string): boolean {
  const tokens = text.match(/\d+(?:\.\d+)?/g) ?? [];
  return tokens.every((token) => FIXTURE_NUMERIC_TOKENS.has(token));
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

/** Intent 1 — most-at-risk hospital (chip 1). */
function answerMostAtRisk(): string {
  const top = [...fixture.priorities].sort((a, b) => a.rank - b.rank)[0];
  const worst = [...fixture.shortages].sort(
    (a, b) => a.daysToStockout - b.daysToStockout,
  )[0];
  if (!top || !worst) return SAFE_FALLBACK;
  const flagged = fixture.hospitals.find((h) => h.id === top.hospitalId);
  const flags =
    flagged?.outbreak === true
      ? "high load, emergency share, and outbreak"
      : "high load and emergency share";
  return (
    `${hospitalName(top.hospitalId)} is most at risk — ` +
    `${medicineName(worst.medicineId)} reaches stockout in ` +
    `${worst.daysToStockout} days with priority score ${top.score}.` +
    ` ${flags} flags apply.`
  );
}

/** Intent 2 — waste quantities (chip 2). */
function answerWaste(): string {
  const top = [...fixture.expiries].sort((a, b) => b.qty - a.qty);
  const first = top[0];
  const second = top[1];
  if (!first) return SAFE_FALLBACK;
  const secondClause = second
    ? `, and ${second.qty} units of ${medicineName(second.medicineId)} at ` +
      `${hospitalName(second.hospitalId)} expire on ${second.expiryDate}`
    : "";
  return (
    `${first.qty} units of ${medicineName(first.medicineId)} at ` +
    `${hospitalName(first.hospitalId)} expire on ${first.expiryDate}` +
    `${secondClause}. Without a transfer these batches expire unused.`
  );
}

/** Intent 3 — transfer reasons (chip 3). */
function answerTransfers(): string {
  const first = fixture.moves[0];
  if (!first) return SAFE_FALLBACK;
  const shortage = fixture.shortages.find(
    (s) => s.hospitalId === first.toId && s.medicineId === first.medicineId,
  );
  const reason = shortage
    ? ` This covers the ${shortage.daysToStockout}-day stockout at ` +
      `${hospitalName(first.toId)}.`
    : "";
  return (
    `Send ${first.qty} units of ${medicineName(first.medicineId)} from ` +
    `${hospitalName(first.fromId)} to ${hospitalName(first.toId)}, ` +
    `arriving in ${first.arrivesInDays} day${first.arrivesInDays === 1 ? "" : "s"}.` +
    `${reason}`
  );
}

/** Intent 4 — stockout timing, reachable via the composer (D-21). */
function answerStockoutTiming(contextHospitalId: string | null): string {
  const scoped = knownHospitalId(contextHospitalId);
  const rows = scoped
    ? fixture.inventory.filter((r) => r.hospitalId === scoped)
    : fixture.inventory;
  const worst = [...rows].sort(
    (a, b) => a.daysToStockout - b.daysToStockout,
  )[0];
  if (!worst) return SAFE_FALLBACK;
  const scopeNote = scoped ? ", the earliest there" : ", the earliest in the network";
  return (
    `${medicineName(worst.medicineId)} at ` +
    `${hospitalName(worst.hospitalId)} reaches stockout in ` +
    `${worst.daysToStockout} days${scopeNote}.` +
    ` Days 15 to 30 of the forecast are advisory only.`
  );
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
  if (q === RISK_CHIPS[0].toLowerCase()) return checked(answerMostAtRisk());
  if (q === RISK_CHIPS[1].toLowerCase()) return checked(answerWaste());
  if (q === RISK_CHIPS[2].toLowerCase()) return checked(answerTransfers());

  // Free-text composer: keyword routing across all four v1 intents (D-09).
  if (
    q.includes("expir") ||
    q.includes("unused") ||
    q.includes("waste")
  ) {
    return checked(answerWaste());
  }
  if (
    q.includes("transfer") ||
    q.includes(" move") ||
    q.includes("moves") ||
    q.includes("send") ||
    q.includes("which first") ||
    q.includes("supplier order")
  ) {
    return checked(answerTransfers());
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
    return checked(answerMostAtRisk());
  }

  return { text: SAFE_FALLBACK };
}

/** T-4-11: an answer with a non-fixture number never renders. */
function checked(text: string): { text: string } {
  return { text: passesQuoteCheck(text) ? text : SAFE_FALLBACK };
}
