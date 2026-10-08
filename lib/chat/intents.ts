export interface IntentMatch {
  intent: string;
  params: Record<string, unknown>;
}

interface IntentDef {
  intent: string;
  keywords: string[];
}

// Plan 03-01 tracer scope: exactly one intent wired end-to-end.
// Plan 03-03 adds stockout-timing, waste-quantities, transfer-reasons.
const INTENT_DEFS: IntentDef[] = [
  {
    intent: "most-at-risk",
    keywords: ["most at risk", "at risk", "risk", "danger", "critical"],
  },
];

const MIN_CONFIDENCE = 1;

// Keyword scoring: each keyword occurrence in the question adds to the
// intent's score. Highest score wins; below MIN_CONFIDENCE -> "unknown".
export function matchIntent(question: string): IntentMatch {
  const q = question.toLowerCase();

  let best: { intent: string; score: number } | null = null;
  for (const def of INTENT_DEFS) {
    let score = 0;
    for (const kw of def.keywords) {
      if (q.includes(kw)) score += 1;
    }
    if (score >= MIN_CONFIDENCE && (best === null || score > best.score)) {
      best = { intent: def.intent, score };
    }
  }

  if (best === null) {
    return { intent: "unknown", params: {} };
  }
  return { intent: best.intent, params: {} };
}
