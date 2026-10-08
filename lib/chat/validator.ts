// Pure post-check (D-16): no DB access, no calculation, no side effects.
// Exact-match semantics (D-13): each numeric token in the answer must appear
// verbatim in the stringified ResultsJSON — no float comparison, no rounding
// tolerance, no unit conversion.
export function validateAnswer(answer: string, resultsJson: unknown): boolean {
  const haystack = JSON.stringify(resultsJson);
  if (typeof haystack !== "string") {
    return false;
  }

  // 1. Dates (YYYY-MM-DD) — removed first so their parts are not re-matched.
  const dateTokens = answer.match(/\d{4}-\d{2}-\d{2}/g) ?? [];
  const withoutDates = answer.replace(/\d{4}-\d{2}-\d{2}/g, " ");

  // 2. Percentages (e.g. "15%") — removed so "15" is not double-counted.
  const percentTokens = withoutDates.match(/\d+(?:\.\d+)?%/g) ?? [];
  const withoutPercents = withoutDates.replace(/\d+(?:\.\d+)?%/g, " ");

  // 3. Remaining integers / decimals (day-counts like "14" in "14 days").
  const numberTokens = withoutPercents.match(/\d+(?:\.\d+)?/g) ?? [];

  const tokens = [...dateTokens, ...percentTokens, ...numberTokens];
  return tokens.every((token) => haystack.includes(token));
}
