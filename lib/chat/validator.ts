// Pure post-check (D-16): no DB access, no calculation, no side effects.
// Exact-match semantics (D-13): each numeric token in the answer must appear
// verbatim in the stringified ResultsJSON — no float comparison, no rounding
// tolerance, no unit conversion.
export function validateAnswer(answer: string, resultsJson: unknown): boolean {
  const haystack = JSON.stringify(resultsJson);
  if (typeof haystack !== "string") {
    return false;
  }

  // 1. ISO dates (YYYY-MM-DD) — removed first so their parts are not re-matched.
  const isoDateTokens = answer.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  let rest = answer.replace(/\d{4}-\d{2}-\d{2}/g, " ");

  // 2. Human dates (e.g. "8 Oct 2026", "08 October 2026") — removed next so
  // the day and year are not double-counted as separate integers.
  const MONTH_DATE =
    /\b\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\b/gi;
  const monthDateTokens = rest.match(MONTH_DATE) ?? [];
  rest = rest.replace(MONTH_DATE, " ");

  // 3. Percentages (e.g. "15%") — removed so "15" is not double-counted.
  const percentTokens = rest.match(/\d+(?:\.\d+)?%/g) ?? [];
  rest = rest.replace(/\d+(?:\.\d+)?%/g, " ");

  // 4. Remaining integers / decimals — day-counts like "14 days" surface as
  // the bare integer "14", which must appear verbatim in ResultsJSON.
  const numberTokens = rest.match(/\d+(?:\.\d+)?/g) ?? [];

  const tokens = [...isoDateTokens, ...monthDateTokens, ...percentTokens, ...numberTokens];
  return tokens.every((token) => haystack.includes(token));
}
