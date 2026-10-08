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

/**
 * Single-shot canned matcher. `history` is intentionally NOT a parameter —
 * past turns never influence matching (D-22, T-4-13).
 */
export function answerQuestion(
  _question: string,
  _contextHospitalId: string | null,
): { text: string } {
  void _question;
  void _contextHospitalId;
  // Full four-intent engine lands in the next task; until then the only
  // safe output is the fallback (T-4-11).
  return { text: SAFE_FALLBACK };
}
