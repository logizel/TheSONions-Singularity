import type { ResultsJSON } from "../contracts";
import { matchIntent } from "./intents";
import { fillTemplate, REJECTION_SENTENCE } from "./templates";
import { validateAnswer } from "./validator";

export interface ChatResponse {
  answer: string;
}

// Orchestrator: intent match -> template fill -> validator check (D-15, D-16).
// Any failure returns the fixed rejection sentence; the answer is never shown.
export function chat(
  question: string,
  resultsJson: ResultsJSON,
): ChatResponse {
  try {
    const match = matchIntent(question);
    if (match.intent === "unknown") {
      return { answer: REJECTION_SENTENCE };
    }

    const answer = fillTemplate(match.intent, match.params, resultsJson);
    if (answer === REJECTION_SENTENCE) {
      return { answer };
    }

    if (!validateAnswer(answer, resultsJson)) {
      return { answer: REJECTION_SENTENCE };
    }

    return { answer };
  } catch {
    return { answer: REJECTION_SENTENCE };
  }
}

export { REJECTION_SENTENCE };
