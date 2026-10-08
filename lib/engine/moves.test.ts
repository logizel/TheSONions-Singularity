/**
 * Transfer suggestions + emergency remainder orders (MOVE-01/02, D-09..D-12).
 *
 * Consumes the committed multi-sender seed (D-22) plus small inline edge
 * fixtures. suggestMoves() takes all risk signals as precomputed inputs —
 * this suite derives sender waste via wasteRisk()/forecast() but moves.ts
 * itself never imports stockout.ts or waste.ts (parallel-safe with 02-02).
 */
import { describe, expect, it } from 'vitest';
import { EngineInputError } from './errors';
import { forecast } from './forecast';
import { stockoutRisk } from './stockout';
import { wasteRisk } from './waste';
import { seeds } from './seeds';
import {
  suggestMoves,
  type MoveRequest,
  type MoveSender,
} from './moves';

const mean = (xs: number[]): number =>
  xs.reduce((a, b) => a + b, 0) / xs.length;

/** Seed senders hydrated into MoveSender inputs (D-11 ordering shape). */
function seedSenders(): MoveSender[] {
  return seeds.multiSender.senders.map((s) => ({
    hospitalId: s.name,
    stock: s.stock,
    dailyDemand: mean(s.history),
    wasteUnits: wasteRisk(s.stock, forecast(s.history), s.daysToExpiry ?? 0)
      .wasteUnits,
    transportDays: s.transportDays,
    daysToExpiry: s.daysToExpiry ?? 0,
  }));
}

describe('suggestMoves', () => {
  it('covers the receiver need with split shipments from both seed senders (D-10)', () => {
    // D-10: multiple surplus hospitals may combine to cover one receiver.
    // Receiver cover is fixed at 6d so both seed transports (1d, 3d) arrive
    // before stockout and the split/ordering behavior is isolated; the true
    // seed-derived cover (~2d) and its arrival rejection are asserted in the
    // feasibility test below.
    const input: MoveRequest = {
      receiverHospitalId: 'receiver',
      medicine: 'TestDrug 500mg',
      needUnits: 500,
      receiverDaysUntilStockout: 6,
      senders: seedSenders(),
    };
    const { transfers, orders } = suggestMoves(input);
    expect(transfers.length).toBe(2); // D-10: split across both senders
    const total = transfers.reduce((s, t) => s + t.quantity, 0);
    expect(total).toBeCloseTo(500, 5); // D-12: quantities sum exactly to need
    expect(orders).toEqual([]); // fully covered -> no emergency order
  });

  it('orders senders waste-first then nearest: most expiring-unused first, ties by fewest transport days (D-11)', () => {
    // D-11: waste-first ordering dominates distance; nearest only breaks ties.
    const base: MoveRequest = {
      receiverHospitalId: 'recv',
      medicine: 'DrugX',
      needUnits: 1000,
      receiverDaysUntilStockout: 10,
      senders: [],
    };
    const farWasteful: MoveSender = {
      hospitalId: 'far-wasteful',
      stock: 900,
      dailyDemand: 10,
      wasteUnits: 500,
      transportDays: 5,
      daysToExpiry: 30,
    };
    const nearLean: MoveSender = {
      hospitalId: 'near-lean',
      stock: 900,
      dailyDemand: 10,
      wasteUnits: 50,
      transportDays: 1,
      daysToExpiry: 30,
    };
    const { transfers } = suggestMoves({
      ...base,
      senders: [nearLean, farWasteful],
    });
    expect(transfers[0]?.fromHospitalId).toBe('far-wasteful'); // D-11: waste beats nearest

    const tieA: MoveSender = {
      hospitalId: 'tie-slow',
      stock: 900,
      dailyDemand: 10,
      wasteUnits: 100,
      transportDays: 4,
      daysToExpiry: 30,
    };
    const tieB: MoveSender = {
      hospitalId: 'tie-fast',
      stock: 900,
      dailyDemand: 10,
      wasteUnits: 100,
      transportDays: 2,
      daysToExpiry: 30,
    };
    const tied = suggestMoves({ ...base, senders: [tieA, tieB] });
    expect(tied.transfers[0]?.fromHospitalId).toBe('tie-fast'); // D-11: tie-break by fewest transport days

    // Seed order check: sender-b carries more waste than sender-a, so it ships first.
    const senders = seedSenders();
    expect(senders[1]?.wasteUnits).toBeGreaterThan(senders[0]?.wasteUnits ?? 0);
    const seeded = suggestMoves({
      receiverHospitalId: 'receiver',
      medicine: 'TestDrug 500mg',
      needUnits: 500,
      receiverDaysUntilStockout: 6,
      senders,
    });
    expect(seeded.transfers[0]?.fromHospitalId).toBe('sender-b'); // D-11 on seed values
  });

  it('excludes or caps a sender that would drop below 7 days of cover (D-09)', () => {
    // D-09: sender must keep exactly 7 days of cover after sending.
    const thin: MoveSender = {
      hospitalId: 'thin',
      stock: 200, // 4d cover at 50/d -> nothing sendable
      dailyDemand: 50,
      wasteUnits: 0,
      transportDays: 1,
      daysToExpiry: 30,
    };
    const capped: MoveSender = {
      hospitalId: 'capped',
      stock: 400, // 8d cover at 50/d -> only 50u sendable
      dailyDemand: 50,
      wasteUnits: 0,
      transportDays: 1,
      daysToExpiry: 30,
    };
    const { transfers, orders } = suggestMoves({
      receiverHospitalId: 'recv',
      medicine: 'DrugX',
      needUnits: 300,
      receiverDaysUntilStockout: 9,
      senders: [thin, capped],
    });
    expect(transfers.find((t) => t.fromHospitalId === 'thin')).toBeUndefined(); // D-09: excluded
    const cappedQty = transfers
      .filter((t) => t.fromHospitalId === 'capped')
      .reduce((s, t) => s + t.quantity, 0);
    expect(cappedQty).toBeCloseTo(50, 5); // D-09: capped to keep the 7d buffer
    expect(orders[0]?.quantity).toBeCloseTo(250, 5); // remainder ordered exactly
  });

  it('never sends beyond the receiver need: quantity is min(need, sendable surplus), exact with no rounding or margin (D-12)', () => {
    // D-12: exact need — no pack rounding, no safety margin (D-02: 1-decimal math).
    const { transfers, orders } = suggestMoves({
      receiverHospitalId: 'recv',
      medicine: 'DrugX',
      needUnits: 100.5,
      receiverDaysUntilStockout: 9,
      senders: [
        {
          hospitalId: 'rich',
          stock: 1000,
          dailyDemand: 10,
          wasteUnits: 0,
          transportDays: 1,
          daysToExpiry: 30,
        },
      ],
    });
    expect(transfers).toHaveLength(1);
    expect(transfers[0]?.quantity).toBeCloseTo(100.5, 5); // D-12: exact, not rounded up
    expect(orders).toEqual([]);
  });

  it('orders exactly the uncovered remainder when need exceeds total sendable surplus (MOVE-02, D-12)', () => {
    // MOVE-02 + D-12: emergency supplier order covers exactly the remainder.
    const { transfers, orders } = suggestMoves({
      receiverHospitalId: 'recv',
      medicine: 'DrugX',
      needUnits: 2000,
      receiverDaysUntilStockout: 9,
      senders: [
        {
          hospitalId: 's1',
          stock: 500, // sendable: 500 - 7*10 = 430
          dailyDemand: 10,
          wasteUnits: 10,
          transportDays: 1,
          daysToExpiry: 30,
        },
        {
          hospitalId: 's2',
          stock: 300, // sendable: 300 - 7*10 = 230
          dailyDemand: 10,
          wasteUnits: 5,
          transportDays: 2,
          daysToExpiry: 30,
        },
      ],
    });
    const sent = transfers.reduce((s, t) => s + t.quantity, 0);
    expect(sent).toBeCloseTo(660, 5);
    expect(orders).toHaveLength(1);
    expect(orders[0]?.toHospitalId).toBe('recv');
    expect(orders[0]?.quantity).toBeCloseTo(2000 - 660, 5); // MOVE-02: exact remainder
  });

  it('rejects transfers arriving after stockout or with insufficient shelf life on arrival (MOVE-01)', () => {
    // MOVE-01 check 1: must arrive before the receiver runs out. The true
    // seed-derived receiver cover (~2.5d) rejects the 3-day seed sender while
    // the 1-day sender still qualifies.
    const recv = seeds.multiSender.receiver;
    const derivedCover = stockoutRisk(
      recv.stock,
      forecast(recv.history),
      recv.leadTimeDays,
    ).daysUntilStockout;
    expect(derivedCover).toBeLessThan(3);
    const feasible = suggestMoves({
      receiverHospitalId: 'receiver',
      medicine: 'TestDrug 500mg',
      needUnits: 100,
      receiverDaysUntilStockout: derivedCover,
      senders: seedSenders(),
    });
    expect(
      feasible.transfers.find((t) => t.fromHospitalId === 'sender-a'),
    ).toBeUndefined(); // MOVE-01: 3d transport cannot beat ~2d cover
    expect(
      feasible.transfers.find((t) => t.fromHospitalId === 'sender-b'),
    ).toBeDefined(); // 1d transport still arrives in time

    // MOVE-01 check 2: enough shelf life on arrival.
    const stale = suggestMoves({
      receiverHospitalId: 'recv',
      medicine: 'DrugX',
      needUnits: 100,
      receiverDaysUntilStockout: 9,
      senders: [
        {
          hospitalId: 'stale',
          stock: 1000,
          dailyDemand: 10,
          wasteUnits: 900,
          transportDays: 5,
          daysToExpiry: 3, // expires before arrival
        },
      ],
    });
    expect(stale.transfers).toEqual([]); // MOVE-01: shelf-life check rejects
    expect(stale.orders[0]?.quantity).toBeCloseTo(100, 5);
  });

  it('throws EngineInputError on bad input (D-20)', () => {
    // D-20 + T-02-01: guard-clauses keep the engine pure and auditable.
    const good: MoveSender = {
      hospitalId: 's',
      stock: 500,
      dailyDemand: 10,
      wasteUnits: 0,
      transportDays: 1,
      daysToExpiry: 30,
    };
    const base: MoveRequest = {
      receiverHospitalId: 'recv',
      medicine: 'DrugX',
      needUnits: 100,
      receiverDaysUntilStockout: 5,
      senders: [good],
    };
    expect(() => suggestMoves({ ...base, needUnits: -5 })).toThrow(
      EngineInputError,
    );
    expect(() =>
      suggestMoves({ ...base, senders: [{ ...good, stock: -1 }] }),
    ).toThrow(EngineInputError);
    expect(() =>
      suggestMoves({ ...base, receiverDaysUntilStockout: -2 }),
    ).toThrow(EngineInputError);
    expect(() =>
      suggestMoves({ ...base, senders: [{ ...good, transportDays: -1 }] }),
    ).toThrow(EngineInputError);
    expect(() =>
      suggestMoves({ ...base, senders: [{ ...good, dailyDemand: NaN }] }),
    ).toThrow(EngineInputError);
    expect(() => suggestMoves({ ...base, senders: [] })).toThrow(
      EngineInputError,
    );
  });

  it('rejects duplicate sender IDs and self-send with EngineInputError (MJ-02, D-09/D-20)', () => {
    // Verifier reproduction: two entries for one sender (stock 100,
    // dailyDemand 10 → D-09 max sendable 30) against a need of 60 must
    // throw instead of shipping 60 and leaving 40 of the required 70 buffer.
    const sender: MoveSender = {
      hospitalId: 'H-S',
      stock: 100,
      dailyDemand: 10,
      wasteUnits: 0,
      transportDays: 1,
      daysToExpiry: 30,
    };
    expect(() =>
      suggestMoves({
        receiverHospitalId: 'H-R',
        medicine: 'DrugX',
        needUnits: 60,
        receiverDaysUntilStockout: 9,
        senders: [sender, { ...sender }],
      }),
    ).toThrow(EngineInputError);
    // A sender equal to the receiver (self-send) must also throw.
    expect(() =>
      suggestMoves({
        receiverHospitalId: 'H-R',
        medicine: 'DrugX',
        needUnits: 10,
        receiverDaysUntilStockout: 9,
        senders: [{ ...sender, hospitalId: 'H-R' }],
      }),
    ).toThrow(EngineInputError);
  });
});
