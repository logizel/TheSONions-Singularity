/**
 * DB rows -> engine -> ResultsJSON v2 (Phase 6, D-02/D-03).
 *
 * Pure: no I/O, no clock (asOf/generatedAt are inputs). Every engine
 * function is called, never reimplemented. Integration choices that the
 * engine leaves to its caller are made here and documented inline:
 *  - history: last 60 calendar days ending at the latest usage date, gaps
 *    interpolated (history.ts);
 *  - stock: non-archived batches not yet expired at asOf;
 *  - waste: wasteRisk() per expiry tier (cumulative stock up to that
 *    expiry), worst tier reported;
 *  - need: demand over (lead + buffer) days minus stock, for pairs that
 *    stock out before a supplier order can land (RISK-02);
 *  - senders: other hospitals without their own warning for the medicine,
 *    with allocated units deducted so two receivers never share a surplus;
 *  - events: rulebook uplift on the chosen forecast (lib/engine/events.ts).
 */
import type {
  EmergencyOrderSuggestion,
  EngineInput,
  HospitalEventFlag,
  HospitalMedicineForecast,
  HospitalSummary,
  InventoryEntry,
  MedicineSummary,
  PriorityEntry,
  ResultsJSON,
  Severity,
  StockBatchRow,
  StockoutWarning,
  TransferSuggestion,
  WasteWarning,
} from '../contracts';
import { applyEventUplift, eventsAffecting, type AffectingEvent } from '../engine/events';
import { forecast, mape, networkMean } from '../engine/forecast';
import { SENDER_BUFFER_DAYS, suggestMoves, type MoveSender } from '../engine/moves';
import { detectOutbreak, trendForecast } from '../engine/outbreak';
import { rankPriorities, type PrioritySignal } from '../engine/priorities';
import { stockoutRisk } from '../engine/stockout';
import { ADVISORY_FROM_DAY, FORECAST_DAYS, HISTORY_DAYS, type ForecastDay } from '../engine/types';
import { wasteRisk } from '../engine/waste';
import { dayNumber, historyWindow, interpolateGaps, isoFromDayNumber } from './history';

/** Default per-pair buffer when no live batch carries one (schema default). */
const DEFAULT_BUFFER_DAYS = 7;
/** Waste within this many days of expiry is critical. */
const WASTE_CRITICAL_DAYS = 30;
/** Window for "current" patient load / emergency share. */
const RECENT_DAYS = 7;

const round1 = (n: number): number => Math.round(n * 10) / 10;
const mean = (xs: readonly number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

export interface BuildOptions {
  /** ISO date (YYYY-MM-DD) the stock / expiry math is evaluated at. */
  asOf: string;
  /** ISO timestamp stamped on the result. */
  generatedAt: string;
}

/** Forecast demand over the first `days` days, extending at the 30-day mean beyond. */
export function demandOver(fc: readonly ForecastDay[], days: number): number {
  const n = Math.max(0, Math.floor(days));
  const total30 = fc.reduce((s, d) => s + d.value, 0);
  if (n <= fc.length) return fc.slice(0, n).reduce((s, d) => s + d.value, 0);
  return total30 + (n - fc.length) * (total30 / fc.length);
}

/** In-sample fit error of the weekday baseline over the last 30 history days, percent. */
function inSampleMapePct(history: number[], baseline: ForecastDay[]): number {
  // forecast()[i] is the weekday mean for history weekday (HISTORY_DAYS + i) % 7,
  // so history day j maps to baseline index (j - HISTORY_DAYS) mod 7.
  const actual = history.slice(HISTORY_DAYS - 30);
  const fitted = actual.map((_, k) => {
    const j = HISTORY_DAYS - 30 + k;
    const i = (((j - HISTORY_DAYS) % 7) + 7) % 7;
    return baseline[i].value;
  });
  return round1(mape(actual, fitted) * 100);
}

interface PairState {
  hospitalId: string;
  medicineId: string;
  history: number[];
  fc: ForecastDay[];
  /** Quotable local-event reasons behind any uplift in fc (EVT-03). */
  eventReasons: string[];
  mode: 'base' | 'trend';
  outbreak: boolean;
  mapePct: number;
  stock: number;
  usable: StockBatchRow[];
  nearestExpiry: string | null;
  leadDays: number;
  bufferDays: number;
  daysUntilStockout: number;
  warnsStockout: boolean;
  dailyDemand: number;
  waste: { units: number; expiryDate: string; expiryDays: number } | null;
  emergencyPct: number;
}

const key = (h: string, m: string) => `${h}|${m}`;

export function buildResults(input: EngineInput, opts: BuildOptions): ResultsJSON {
  const asOfDay = dayNumber(opts.asOf);
  const hospitals = [...input.hospitals].sort((a, b) => a.id.localeCompare(b.id));
  const medicines = [...input.medicines].sort((a, b) => a.id.localeCompare(b.id));
  const hospitalName = new Map(hospitals.map((h) => [h.id, h.name]));
  const medicineName = new Map(medicines.map((m) => [m.id, m.name]));

  // ---- history window ------------------------------------------------------
  const latest = input.usage.reduce<string | null>(
    (max, u) => (max === null || u.usageDate > max ? u.usageDate : max),
    null,
  );
  const window = historyWindow(latest ?? isoFromDayNumber(asOfDay - 1));
  const dateIndex = new Map(window.dates.map((d, i) => [d, i]));
  const recentFrom = window.dates.length - RECENT_DAYS;

  const usageSeries = new Map<string, (number | null)[]>();
  const emergencyByPair = new Map<string, number[]>();
  const loadByHospital = new Map<string, Map<string, number[]>>(); // hospital -> date -> loads
  const emergencyByHospital = new Map<string, number[]>();
  for (const u of input.usage) {
    const i = dateIndex.get(u.usageDate);
    if (i === undefined) continue; // outside the 60-day window
    const k = key(u.hospitalId, u.medicineId);
    let s = usageSeries.get(k);
    if (!s) {
      s = new Array<number | null>(HISTORY_DAYS).fill(null);
      usageSeries.set(k, s);
    }
    s[i] = u.usedQty;
    if (i >= recentFrom) {
      (emergencyByPair.get(k) ?? emergencyByPair.set(k, []).get(k)!).push(u.emergencyPct);
      (emergencyByHospital.get(u.hospitalId) ?? emergencyByHospital.set(u.hospitalId, []).get(u.hospitalId)!).push(
        u.emergencyPct,
      );
      const byDate = loadByHospital.get(u.hospitalId) ?? loadByHospital.set(u.hospitalId, new Map()).get(u.hospitalId)!;
      (byDate.get(u.usageDate) ?? byDate.set(u.usageDate, []).get(u.usageDate)!).push(u.patientLoad);
    }
  }

  const leadDays = new Map(input.leads.map((l) => [key(l.hospitalId, l.medicineId), l.leadDays]));
  const transportDays = new Map(input.transport.map((t) => [`${t.fromHospital}>${t.toHospital}`, t.days]));

  // Forecast day 0 is the day after the last usage row (may precede asOf).
  const firstForecastDay = dayNumber(window.to) + 1;
  const forecastStart = isoFromDayNumber(firstForecastDay);

  // ---- per pair: forecast, outbreak, events, stock, stock-out, waste -------
  const pairs = new Map<string, PairState>();
  const affectingByHospital = new Map<string, AffectingEvent[]>();
  for (const h of hospitals) {
    const affecting = eventsAffecting(h, input.events ?? [], opts.asOf);
    affectingByHospital.set(h.id, affecting);
    for (const m of medicines) {
      const k = key(h.id, m.id);
      const history = interpolateGaps(usageSeries.get(k) ?? new Array(HISTORY_DAYS).fill(null));
      const baseline = forecast(history);
      const outbreak = detectOutbreak(history).flagged;
      const selected = outbreak ? trendForecast(history) : baseline;
      const { fc, reasons: eventReasons } = applyEventUplift(selected, m.category, affecting, forecastStart);

      const usable = input.batches
        .filter(
          (b) => b.hospitalId === h.id && b.medicineId === m.id && !b.archived && dayNumber(b.expiryDate) > asOfDay,
        )
        .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate) || a.id.localeCompare(b.id));
      const stock = usable.reduce((s, b) => s + b.qty, 0);
      const lead = leadDays.get(k) ?? 0;
      const buffer = usable[0]?.bufferDays ?? DEFAULT_BUFFER_DAYS;
      const risk = stockoutRisk(stock, fc, lead);

      // Waste per expiry tier: cumulative stock expiring by that date.
      let waste: PairState['waste'] = null;
      let cumulative = 0;
      for (let i = 0; i < usable.length; i++) {
        cumulative += usable[i].qty;
        const last = i === usable.length - 1 || usable[i + 1].expiryDate !== usable[i].expiryDate;
        if (!last) continue;
        const expiryDays = dayNumber(usable[i].expiryDate) - asOfDay;
        const w = wasteRisk(cumulative, fc, expiryDays);
        if (w.warns && (waste === null || w.wasteUnits > waste.units)) {
          waste = { units: w.wasteUnits, expiryDate: usable[i].expiryDate, expiryDays };
        }
      }

      pairs.set(k, {
        hospitalId: h.id,
        medicineId: m.id,
        history,
        fc,
        eventReasons,
        mode: outbreak ? 'trend' : 'base',
        outbreak,
        mapePct: inSampleMapePct(history, baseline),
        stock,
        usable,
        nearestExpiry: usable[0]?.expiryDate ?? null,
        leadDays: lead,
        bufferDays: buffer,
        daysUntilStockout: risk.daysUntilStockout,
        warnsStockout: risk.warns,
        dailyDemand: round1(fc.reduce((s, d) => s + d.value, 0) / FORECAST_DAYS),
        waste,
        emergencyPct: Math.round(mean(emergencyByPair.get(k) ?? [])),
      });
    }
  }

  // ---- transfers + emergency orders (MOVE-01/02) ----------------------------
  const transfers: TransferSuggestion[] = [];
  const emergencyOrders: EmergencyOrderSuggestion[] = [];
  const allocated = new Map<string, number>(); // sender pair -> units already promised
  // Most urgent receivers claim surplus first.
  const receivers = [...pairs.values()]
    .filter((p) => p.warnsStockout)
    .sort((a, b) => a.daysUntilStockout - b.daysUntilStockout || a.hospitalId.localeCompare(b.hospitalId) || a.medicineId.localeCompare(b.medicineId));

  for (const r of receivers) {
    const need = round1(demandOver(r.fc, r.leadDays + r.bufferDays) - r.stock);
    if (need < 0.1) continue;
    const senders: MoveSender[] = [];
    for (const h of hospitals) {
      if (h.id === r.hospitalId) continue;
      const s = pairs.get(key(h.id, r.medicineId))!;
      const days = transportDays.get(`${h.id}>${r.hospitalId}`);
      if (s.warnsStockout || days === undefined || s.nearestExpiry === null) continue;
      const stock = round1(s.stock - (allocated.get(key(h.id, r.medicineId)) ?? 0));
      if (stock <= 0) continue;
      senders.push({
        hospitalId: h.id,
        stock,
        dailyDemand: s.dailyDemand,
        wasteUnits: s.waste?.units ?? 0,
        transportDays: days,
        daysToExpiry: dayNumber(s.nearestExpiry) - asOfDay,
      });
    }

    const receiverName = hospitalName.get(r.hospitalId) ?? r.hospitalId;
    const { transfers: moves, orders } =
      senders.length > 0
        ? suggestMoves({
            receiverHospitalId: r.hospitalId,
            medicine: r.medicineId,
            needUnits: need,
            receiverDaysUntilStockout: r.daysUntilStockout,
            senders,
          })
        : {
            transfers: [],
            orders: [
              {
                toHospitalId: r.hospitalId,
                medicine: r.medicineId,
                quantity: need,
                reason: `Emergency supplier order for the ${need}u need: no hospital can send ${medicineName.get(r.medicineId) ?? r.medicineId} in time`,
              },
            ],
          };

    for (const t of moves) {
      const sender = senders.find((s) => s.hospitalId === t.fromHospitalId)!;
      const senderName = hospitalName.get(t.fromHospitalId) ?? t.fromHospitalId;
      const keep = round1(SENDER_BUFFER_DAYS * sender.dailyDemand);
      const sk = key(t.fromHospitalId, r.medicineId);
      allocated.set(sk, round1((allocated.get(sk) ?? 0) + t.quantity));
      transfers.push({
        fromHospital: t.fromHospitalId,
        toHospital: t.toHospitalId,
        medicineId: t.medicine,
        qty: t.quantity,
        transportDays: t.transportDays,
        checksPassed: [
          `Arrives in ${t.transportDays}d, before ${receiverName} runs out in ${r.daysUntilStockout}d`,
          `Shelf life ${sender.daysToExpiry}d at ${senderName}, longer than ${t.transportDays}d in transit`,
          `${senderName} keeps its ${SENDER_BUFFER_DAYS}-day buffer of ${keep} units`,
          `Within ${receiverName}'s need of ${need} units`,
          sender.wasteUnits > 0
            ? `Waste-first: ${sender.wasteUnits} units would expire unused at ${senderName}`
            : `Nearest qualifying sender: ${t.transportDays}d away`,
        ],
      });
    }
    for (const o of orders) {
      emergencyOrders.push({
        hospitalId: o.toHospitalId,
        medicineId: o.medicine,
        qty: o.quantity,
        leadDays: r.leadDays,
        reason: o.reason,
      });
    }
  }

  // ---- priorities (PRIOR-01/02) --------------------------------------------
  const hospitalLoad = new Map<string, number>();
  for (const h of hospitals) {
    const byDate = loadByHospital.get(h.id);
    // One load per hospital-day (rows repeat it per medicine): mean per date, then across dates.
    const perDay = byDate ? [...byDate.values()].map(mean) : [];
    hospitalLoad.set(h.id, Math.round(mean(perDay)));
  }
  const signals: PrioritySignal[] = [...pairs.values()].map((p) => ({
    hospitalId: p.hospitalId,
    medicine: p.medicineId,
    daysUntilStockout: p.daysUntilStockout,
    emergencySharePct: p.emergencyPct,
    patientLoad: hospitalLoad.get(p.hospitalId) ?? 0,
    hasSubstitute: (medicines.find((m) => m.id === p.medicineId)?.substituteIds.length ?? 0) > 0,
  }));
  const priorities: PriorityEntry[] = rankPriorities(signals).map((p, i) => ({
    rank: i + 1,
    hospitalId: p.hospitalId,
    medicineId: p.medicine,
    score: p.score,
    factors: p.factors,
    reasons: [p.reason],
  }));

  // ---- assemble -------------------------------------------------------------
  const pairList = [...pairs.values()];
  const severityOf = (p: PairState): Severity =>
    p.warnsStockout ? 'critical' : p.daysUntilStockout < p.leadDays + p.bufferDays ? 'warning' : 'ok';

  const hospitalSummaries: HospitalSummary[] = hospitals.map((h) => {
    const own = pairList.filter((p) => p.hospitalId === h.id);
    return {
      hospitalId: h.id,
      hospitalName: h.name,
      patientLoad: hospitalLoad.get(h.id) ?? 0,
      emergencyPct: Math.round(mean(emergencyByHospital.get(h.id) ?? [])),
      outbreak: own.some((p) => p.outbreak),
      riskScore: Math.max(0, ...priorities.filter((p) => p.hospitalId === h.id).map((p) => p.score)),
      daysUntilStockout: own.length > 0 ? Math.min(...own.map((p) => p.daysUntilStockout)) : 0,
      events: (affectingByHospital.get(h.id) ?? []).map(
        (e): HospitalEventFlag => ({
          eventId: e.id,
          type: e.type,
          severity: e.severity,
          distanceKm: e.distanceKm,
          startsOn: e.startsOn,
          endsOn: e.endsOn,
        }),
      ),
    };
  });

  const medicineSummaries: MedicineSummary[] = medicines.map((m) => ({
    medicineId: m.id,
    medicineName: m.name,
    isCritical: m.isCritical,
    baseUnit: m.baseUnit,
    substituteIds: [...m.substituteIds],
  }));

  const inventory: InventoryEntry[] = pairList.map((p) => ({
    hospitalId: p.hospitalId,
    medicineId: p.medicineId,
    stock: p.stock,
    daysUntilStockout: p.daysUntilStockout,
    leadDays: p.leadDays,
    bufferDays: p.bufferDays,
    dailyDemand: p.dailyDemand,
    trend: p.history.slice(-RECENT_DAYS).map(round1),
    nearestExpiry: p.nearestExpiry,
    severity: severityOf(p),
  }));

  const forecasts: HospitalMedicineForecast[] = pairList.map((p) => ({
    hospitalId: p.hospitalId,
    medicineId: p.medicineId,
    mode: p.mode,
    forecast: p.fc.map((d, i) => ({
      date: isoFromDayNumber(firstForecastDay + i),
      demand: d.value,
      advisory: d.advisory,
    })),
    mapePct: p.mapePct,
    outbreak: p.outbreak,
    eventReasons: [...p.eventReasons],
  }));

  const stockoutWarnings: StockoutWarning[] = pairList
    .filter((p) => p.warnsStockout)
    .map((p) => ({
      hospitalId: p.hospitalId,
      medicineId: p.medicineId,
      daysUntilStockout: p.daysUntilStockout,
      leadDays: p.leadDays,
    }));

  const wasteWarnings: WasteWarning[] = pairList
    .filter((p) => p.waste !== null)
    .map((p) => ({
      hospitalId: p.hospitalId,
      medicineId: p.medicineId,
      wasteUnits: p.waste!.units,
      expiryDate: p.waste!.expiryDate,
      expiryDays: p.waste!.expiryDays,
      severity: p.waste!.expiryDays <= WASTE_CRITICAL_DAYS ? 'critical' : 'warning',
    }));

  return {
    generatedAt: opts.generatedAt,
    asOf: opts.asOf,
    historyWindow: { from: window.from, to: window.to },
    mapePct: pairList.length > 0 ? round1(networkMean(pairList.map((p) => p.mapePct))) : 0,
    advisory: { fromDay: ADVISORY_FROM_DAY, toDay: FORECAST_DAYS, label: 'advisory' },
    hospitals: hospitalSummaries,
    medicines: medicineSummaries,
    transport: [...input.transport].sort(
      (a, b) => a.fromHospital.localeCompare(b.fromHospital) || a.toHospital.localeCompare(b.toHospital),
    ),
    leads: [...input.leads].sort(
      (a, b) => a.hospitalId.localeCompare(b.hospitalId) || a.medicineId.localeCompare(b.medicineId),
    ),
    inventory,
    forecasts,
    stockoutWarnings,
    wasteWarnings,
    transfers,
    emergencyOrders,
    priorities,
  };
}
