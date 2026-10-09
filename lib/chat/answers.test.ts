/**
 * Dashboard chat answers over the live snapshot: scoped to ?hospital=,
 * quoting only cited numbers, falling back when nothing honest exists.
 */
import { describe, expect, it } from 'vitest';
import type { ResultsJSON } from '../contracts';
import { buildResults } from '../network/build';
import { AS_OF, GENERATED, baseInput } from '../network/test-fixture';
import { RISK_CHIPS, SAFE_FALLBACK, answerQuestion, passesQuoteCheck } from './answers';
import { validateAnswer } from './validator';

const results = buildResults(baseInput(), { asOf: AS_OF, generatedAt: GENERATED });

describe('answerQuestion', () => {
  it('answers each chip from the snapshot with validated numbers', () => {
    for (const chip of RISK_CHIPS) {
      const { text } = answerQuestion(chip, null, results);
      expect(text).not.toBe(SAFE_FALLBACK);
      expect(validateAnswer(text, results)).toBe(true);
    }
  });

  it('quotes the exact engine numbers', () => {
    expect(answerQuestion('What expires unused?', null, results).text).toBe(
      '400 units of Xamol at Bravo Clinic expire unused by 2026-10-29.',
    );
    expect(answerQuestion('Which transfers first?', null, results).text).toBe(
      'Send 240 units of Xamol from Bravo Clinic to Alpha General, a 1 day delivery window. Alpha General runs out in 5 days.',
    );
    expect(answerQuestion('When will we run out?', null, results).text).toBe(
      'Yorin at Alpha General reaches stockout in 0 days, the earliest in the network. Forecast days 15 to 30 are advisory only.',
    );
  });

  it('scopes to the selected hospital and names it', () => {
    const t = answerQuestion('Which transfers first?', 'h-b', results).text;
    expect(t.startsWith('At Bravo Clinic, send 240 units')).toBe(true);
    const risk = answerQuestion('Most at risk next week?', 'h-a', results).text;
    expect(risk.startsWith('Alpha General is most at risk')).toBe(true);
  });

  it('ignores unknown scopes and falls back for off-topic or unloaded data', () => {
    expect(answerQuestion('Which transfers first?', 'h-nope', results).text).toBe(
      answerQuestion('Which transfers first?', null, results).text,
    );
    expect(answerQuestion('Tell me a joke', null, results).text).toBe(SAFE_FALLBACK);
    expect(answerQuestion('Most at risk next week?', null, null).text).toBe(SAFE_FALLBACK);
  });

  it('says so plainly when a section is empty (no numbers invented)', () => {
    const empty: ResultsJSON = { ...results, wasteWarnings: [], transfers: [], emergencyOrders: [] };
    expect(answerQuestion('What expires unused?', null, empty).text).toBe('No stock is forecast to expire unused.');
    expect(answerQuestion('Which transfers first?', null, empty).text).toBe('No transfers are suggested right now.');
  });
});

describe('event reasons (EVT-05: quote-only)', () => {
  const REASON = '+80% rehydration demand: Flood, 1.2 km away, until 2026-10-23';
  const withEvent: ResultsJSON = {
    ...results,
    forecasts: results.forecasts.map((f) =>
      f.hospitalId === 'h-a' && f.medicineId === 'm-x' ? { ...f, eventReasons: [REASON] } : { ...f, eventReasons: [] },
    ),
  };

  it('quotes the reason verbatim and passes both gates', () => {
    const { text } = answerQuestion('Why is Xamol demand up?', 'h-a', withEvent);
    expect(text).toBe(`Xamol demand at Alpha General is expected to rise: ${REASON}.`);
    expect(validateAnswer(text, withEvent)).toBe(true);
    expect(passesQuoteCheck(text, new Set(['80', '1.2', '2026-10-23']))).toBe(true);
  });

  it('routes flood / event questions without a medicine name', () => {
    expect(answerQuestion('Any flood nearby?', null, withEvent).text).toContain(REASON);
    expect(answerQuestion('Which events affect demand?', 'h-a', withEvent).text).toContain(REASON);
  });

  it('says so plainly when no event raises demand (no numbers)', () => {
    const none = 'No local events are raising forecast demand right now.';
    expect(answerQuestion('Why is Xamol demand up?', 'h-a', results).text).toBe(none);
    expect(answerQuestion('Why is Xamol demand up?', 'h-b', withEvent).text).toBe(none);
    expect(answerQuestion('Why is Yorin demand up?', 'h-a', withEvent).text).toBe(none);
  });
});

describe('passesQuoteCheck', () => {
  it('rejects numbers outside the cited rows and accepts dosage fragments', () => {
    expect(passesQuoteCheck('Send 240 units', new Set(['240']))).toBe(true);
    expect(passesQuoteCheck('Send 241 units', new Set(['240']))).toBe(false);
    expect(passesQuoteCheck('Paracetamol 500mg: 240 units', new Set(['240']))).toBe(true);
    expect(passesQuoteCheck('by 2026-10-29', new Set(['2026-10-29']))).toBe(true);
    expect(passesQuoteCheck('by 2026-10-30', new Set(['2026-10-29', '2026', '10', '30']))).toBe(false);
  });
});
