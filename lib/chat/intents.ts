export interface IntentMatch {
  intent: string;
  params: Record<string, unknown>;
}

interface IntentDef {
  intent: string;
  keywords: string[];
}

// The 4 D-09 intents plus event-reasons (EVT-05). Hospitals/medicines are matched by scanning the
// ResultsJSON-free question text for quoted or capitalized names; extraction
// is best-effort entity capture only — matching stays keyword-scored.
const INTENT_DEFS: IntentDef[] = [
  {
    intent: "most-at-risk",
    keywords: ["most at risk", "at risk", "risk", "danger", "critical"],
  },
  {
    intent: "stockout-timing",
    keywords: ["stockout", "stock out", "run out", "runout", "when.*out", "days until"],
  },
  {
    intent: "waste-quantities",
    keywords: ["waste", "expire", "expiry", "expiring", "unused", "expiration"],
  },
  {
    intent: "transfer-reasons",
    keywords: ["transfer", "move", "send", "why.*transfer", "reason"],
  },
  {
    intent: "event-reasons",
    keywords: ["event", "flood", "heat wave", "heatwave", "cyclone", "earthquake", "epidemic", "demand up"],
  },
];

const MIN_CONFIDENCE = 1;

// Extract a hospital or medicine name from the question when the user names
// one explicitly, e.g. "Hospital General will ..." or "... of Aspirin ...".
// Case-insensitive; returns undefined when no name is detectable.
function extractEntity(question: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = question.match(re);
    if (m && m[1]) {
      return m[1].trim();
    }
  }
  return undefined;
}

// Keyword scoring: each keyword occurrence in the question adds to the
// intent's score. Highest score wins; below MIN_CONFIDENCE -> "unknown".
// Case-insensitive throughout.
export function matchIntent(question: string): IntentMatch {
  const q = question.toLowerCase();

  let best: { intent: string; score: number } | null = null;
  for (const def of INTENT_DEFS) {
    let score = 0;
    for (const kw of def.keywords) {
      if (kw.includes(".*") ? new RegExp(kw).test(q) : q.includes(kw)) {
        score += 1;
      }
    }
    if (score >= MIN_CONFIDENCE && (best === null || score > best.score)) {
      best = { intent: def.intent, score };
    }
  }

  if (best === null) {
    return { intent: "unknown", params: {} };
  }

  const params: Record<string, unknown> = {};
  const hospital = extractEntity(question, [
    /hospital\s+([A-Za-z][A-Za-z0-9' -]*?)(?=\s+(?:will|is|has|of|and|to|from|,|\?)|$)/i,
    /([A-Z][A-Za-z0-9' -]*?(?:Hospital|Medical Center|Clinic))/,
  ]);
  if (hospital) params.hospitalName = hospital;

  const medicine = extractEntity(question, [
    /of\s+([A-Z][A-Za-z0-9' -]*?)(?=\s+(?:in|at|from|to|will|is|has|expire|expiring|,|\?)|$)/,
    /"([^"]+)"/,
  ]);
  if (medicine) params.medicineName = medicine;

  return { intent: best.intent, params };
}
