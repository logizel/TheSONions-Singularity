import type { ResultsJSON } from "../contracts";

export const REJECTION_SENTENCE =
  "I can only answer questions about hospital risk, stockouts, waste, and transfers using current system data.";

// Quote-only: every value in the answer is interpolated straight from
// ResultsJSON. No arithmetic, rounding, or unit conversion (D-10, D-13).
export function fillTemplate(
  intent: string,
  _params: object,
  resultsJson: ResultsJSON,
): string {
  if (intent !== "most-at-risk") {
    return REJECTION_SENTENCE;
  }

  const hospitals = resultsJson?.hospitals;
  if (!Array.isArray(hospitals) || hospitals.length === 0) {
    return REJECTION_SENTENCE;
  }

  let top = hospitals[0];
  for (const h of hospitals) {
    if (h.riskScore > top.riskScore) {
      top = h;
    }
  }

  return `Hospital ${top.hospitalName} is most at risk with a risk score of ${top.riskScore} and ${top.daysUntilStockout} days until stockout.`;
}
