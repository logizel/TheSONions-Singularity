/**
 * Chat over ResultsJSON v2 (Phase 6, D-11): every answer quotes numbers that
 * appear verbatim in the snapshot; anything else is rejected.
 */
import { describe, expect, it } from 'vitest';
import { buildResults } from '../network/build';
import { AS_OF, GENERATED, baseInput } from '../network/test-fixture';
import { chat, REJECTION_SENTENCE } from './index';
import { quoteView } from './quotes';
import { validateAnswer } from './validator';

const results = buildResults(baseInput(), { asOf: AS_OF, generatedAt: GENERATED });

describe('quoteView', () => {
  it('joins names and copies numbers verbatim', () => {
    const v = quoteView(results);
    expect(v.hospitals.map((h) => h.hospitalName)).toEqual(['Alpha General', 'Bravo Clinic', 'Charlie Hospital']);
    // Most urgent stock position first.
    expect(v.stockouts[0]).toMatchObject({ daysUntilStockout: 0, leadTimeComparison: 'shorter than' });
    expect(v.transfers[0]).toMatchObject({
      transferUnits: 240,
      medicineName: 'Xamol',
      senderHospital: 'Bravo Clinic',
      receiverHospital: 'Alpha General',
    });
    expect(v.waste[0]).toMatchObject({ hospitalName: 'Bravo Clinic', wasteUnits: 400, expiryDays: 20 });
  });
});

describe('chat over the live snapshot', () => {
  it('answers each intent with validated quotes', () => {
    const answers = [
      chat('Which hospital is most at risk?', results).answer,
      chat('Hospital Alpha General will run out of Xamol in how many days?', results).answer,
      chat('How much will expire unused?', results).answer,
      chat('Why transfer Xamol?', results).answer,
    ];
    for (const a of answers) {
      expect(a).not.toBe(REJECTION_SENTENCE);
      expect(validateAnswer(a, results)).toBe(true);
    }
    expect(answers[1]).toBe(
      'Hospital Alpha General will run out of Xamol in 5 days, which is shorter than the supplier lead time of 10 days.',
    );
    expect(answers[2]).toBe('Hospital Bravo Clinic has 400 units of Xamol expiring unused within 20 days.');
    expect(answers[3]).toContain('Transfer 240 units of Xamol from Bravo Clinic to Alpha General because arrives in 1d');
  });

  it('rejects off-topic questions and unknown hospitals', () => {
    expect(chat('What is the weather?', results).answer).toBe(REJECTION_SENTENCE);
    expect(chat('Hospital Nowhere will run out of Xamol in how many days?', results).answer).toBe(REJECTION_SENTENCE);
  });

  it('would reject an answer containing a number not in the snapshot', () => {
    expect(validateAnswer('Alpha General has 98765 units', results)).toBe(false);
  });
});
