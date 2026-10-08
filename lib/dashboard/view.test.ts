/**
 * Dashboard view-model tests: risk levels from engine severities, the
 * location x results join, marker labels, and display formatters.
 */
import { describe, expect, it } from 'vitest';
import { buildResults } from '../network/build';
import { AS_OF, GENERATED, baseInput } from '../network/test-fixture';
import {
  fmtDays,
  fmtDistance,
  fmtDuration,
  fmtUnits,
  fmtUpdated,
  hospitalRisk,
  joinMapHospitals,
  riskFromSeverity,
  validHospitalId,
} from './view';

const results = buildResults(baseInput(), { asOf: AS_OF, generatedAt: GENERATED });

describe('risk', () => {
  it('maps engine severities onto the critical / low / ok scale', () => {
    expect(riskFromSeverity('critical')).toBe('critical');
    expect(riskFromSeverity('warning')).toBe('low');
    expect(riskFromSeverity('ok')).toBe('ok');
  });

  it('takes the worst severity, then the lowest cover', () => {
    const a = hospitalRisk(results, 'h-a');
    expect(a.level).toBe('critical');
    // Alpha: Yorin 0 days beats Xamol 5 days (both critical).
    expect(a.worst).toMatchObject({ medicineId: 'm-y', daysUntilStockout: 0 });
    expect(hospitalRisk(results, 'h-b').worst?.severity ?? 'ok').not.toBe('critical');
    expect(hospitalRisk(results, 'h-missing')).toEqual({ level: 'ok', worst: null });
  });
});

describe('joinMapHospitals', () => {
  it('joins by id and writes screen-reader labels', () => {
    const joined = joinMapHospitals(
      [
        { id: 'h-a', name: 'Alpha General', lat: 1, lng: 1 },
        { id: 'h-c', name: 'Charlie Hospital', lat: 2, lng: 2 },
        { id: 'h-zzz', name: 'Unknown Annex', lat: 3, lng: 3 },
      ],
      results,
    );
    expect(joined[0].risk).toBe('critical');
    expect(joined[0].label).toBe('Alpha General, critical: Yorin 0 days cover');
    expect(joined[1].outbreak).toBe(true);
    expect(joined[1].label.endsWith(', outbreak')).toBe(true);
    expect(joined[2]).toMatchObject({ summary: null, risk: 'ok', label: 'Unknown Annex, stock ok' });
  });
});

describe('formatters', () => {
  it('keeps engine decimals only where they exist', () => {
    expect(fmtUnits(240)).toBe('240');
    expect(fmtUnits(521.4)).toBe('521.4');
    expect(fmtUnits(12000)).toBe('12,000');
  });

  it('formats days, distance and duration with units', () => {
    expect(fmtDays(1)).toBe('1 day');
    expect(fmtDays(10)).toBe('10 days');
    expect(fmtDistance(850.4)).toBe('850 m');
    expect(fmtDistance(9960.4)).toBe('9.96 km');
    expect(fmtDistance(12460)).toBe('12.5 km');
    expect(fmtDistance(NaN)).toBe('—');
    expect(fmtDuration(null)).toBe('—');
    expect(fmtDuration(45)).toBe('45 s');
    expect(fmtDuration(774)).toBe('13 min');
    expect(fmtDuration(3900)).toBe('1 h 05 min');
  });

  it('describes freshness', () => {
    const now = new Date('2026-10-09T10:00:00Z');
    expect(fmtUpdated('2026-10-09T09:59:30Z', now)).toBe('just now');
    expect(fmtUpdated('2026-10-09T09:56:00Z', now)).toBe('4 min ago');
    expect(fmtUpdated('2026-10-09T07:00:00Z', now)).toBe('3 h ago');
    expect(fmtUpdated('2026-10-01T07:00:00Z', now)).toBe('2026-10-01');
    expect(fmtUpdated('nope', now)).toBe('—');
  });

  it('accepts only known hospital ids for ?hospital=', () => {
    expect(validHospitalId(results, 'h-a')).toBe('h-a');
    expect(validHospitalId(results, 'h-nope')).toBeNull();
    expect(validHospitalId(results, null)).toBeNull();
    expect(validHospitalId(null, 'h-a')).toBeNull();
  });
});
