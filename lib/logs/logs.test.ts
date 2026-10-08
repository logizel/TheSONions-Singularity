import { describe, expect, it } from 'vitest';

import { pgTimestampToIso } from './index';
import { actorLabel, canSee, involved } from './scope';

const row = (actorHospital: string | null, hospitalIds: string[]) => ({ actorHospital, hospitalIds });

describe('log visibility', () => {
  it('network admin sees everything', () => {
    expect(canSee({ role: 'network_admin' }, row('h-civil', ['h-civil', 'h-north']))).toBe(true);
    expect(canSee({ role: 'network_admin' }, row(null, []))).toBe(true);
  });

  it('hospital admin sees own actions and rows involving its hospital', () => {
    const civil = { role: 'hospital_admin' as const, hospitalId: 'h-civil' };
    expect(canSee(civil, row('h-civil', ['h-civil']))).toBe(true);
    expect(canSee(civil, row(null, ['h-civil', 'h-north']))).toBe(true);
    expect(canSee(civil, row('h-stmary', ['h-stmary', 'h-north']))).toBe(false);
    expect(canSee(civil, row(null, []))).toBe(false);
  });

  it('hospital admin without a hospital sees nothing', () => {
    expect(canSee({ role: 'hospital_admin' }, row('h-civil', ['h-civil']))).toBe(false);
  });

  it('indexes actor + involved hospitals once', () => {
    expect(involved({ role: 'hospital_admin', hospitalId: 'h-civil' }, 'h-civil', 'h-north', null)).toEqual(['h-civil', 'h-north']);
    expect(involved({ role: 'network_admin' }, 'h-a', undefined)).toEqual(['h-a']);
  });

  it('labels actors', () => {
    expect(actorLabel('network_admin', null)).toBe('Network admin');
    expect(actorLabel('hospital_admin', 'St Mary Clinic')).toBe('Hospital admin, St Mary Clinic');
  });
});

describe('pgTimestampToIso', () => {
  it('parses Postgres short offsets', () => {
    expect(pgTimestampToIso('2026-10-09 05:12:33.123+00')).toBe('2026-10-09T05:12:33.123Z');
    expect(pgTimestampToIso('2026-10-09 10:42:33+05:30')).toBe('2026-10-09T05:12:33.000Z');
  });
});
