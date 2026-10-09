import { describe, expect, it } from 'vitest';

import { buildStockBody, STOCK_ACTIONS, type StockForm } from './form';

const form = (patch: Partial<StockForm> = {}): StockForm => ({
  action: 'add',
  hospitalId: 'h-civil',
  medicineId: 'm-para',
  qty: '20',
  expiryDate: '2027-01-31',
  usageDate: '2026-10-09',
  usedQty: '',
  patientLoad: '120',
  emergencyPct: '15',
  ...patch,
});

const names = { hospitalName: 'City Civil Hospital', medicineName: 'Paracetamol' };

describe('buildStockBody', () => {
  it('exposes exactly the three stock actions', () => {
    expect(STOCK_ACTIONS).toEqual(['add', 'remove', 'usage']);
  });

  it('add carries qty + expiry and no usage keys', () => {
    expect(buildStockBody(form(), names)).toEqual({
      action: 'add',
      hospitalId: 'h-civil',
      medicineId: 'm-para',
      hospitalName: 'City Civil Hospital',
      medicineName: 'Paracetamol',
      qty: 20,
      expiryDate: '2027-01-31',
    });
    expect(Object.keys(buildStockBody(form(), names)).sort()).toEqual([
      'action',
      'expiryDate',
      'hospitalId',
      'hospitalName',
      'medicineId',
      'medicineName',
      'qty',
    ]);
  });

  it('remove carries qty only', () => {
    expect(buildStockBody(form({ action: 'remove' }), names)).toEqual({
      action: 'remove',
      hospitalId: 'h-civil',
      medicineId: 'm-para',
      hospitalName: 'City Civil Hospital',
      medicineName: 'Paracetamol',
      qty: 20,
    });
  });

  it('usage carries the numbers and trims ids and display names', () => {
    expect(buildStockBody(form({ action: 'usage' }), { hospitalName: ' City Civil Hospital ', medicineName: ' Paracetamol ' })).toEqual({
      action: 'usage',
      hospitalId: 'h-civil',
      medicineId: 'm-para',
      hospitalName: 'City Civil Hospital',
      medicineName: 'Paracetamol',
      usageDate: '2026-10-09',
      usedQty: null,
      patientLoad: 120,
      emergencyPct: 15,
    });
  });

  it('usage maps a blank or whitespace used qty to null (missing day)', () => {
    expect(buildStockBody(form({ action: 'usage' }), names).usedQty).toBe(null);
    expect(buildStockBody(form({ action: 'usage', usedQty: '   ' }), names).usedQty).toBe(null);
    expect(buildStockBody(form({ action: 'usage', usedQty: '7' }), names).usedQty).toBe(7);
  });

  it('throws on an action outside add/remove/usage', () => {
    expect(() => buildStockBody(form({ action: 'adds' as StockForm['action'] }), names)).toThrow(/unknown stock action/);
  });
});
