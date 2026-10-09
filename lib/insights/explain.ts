/**
 * Plain-language explanations for the insights charts. Templates only (no
 * AI): every number quoted is one already shown in the chart beside it, or
 * a simple difference of two of them (e.g. "15 days before help arrives").
 */
import type { HospitalCard, HospitalInsight, MedicineInsight } from './view';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const days = (n: number) => plural(n, 'day');
export const unitWord = (unit: string, n: number) => (n === 1 ? unit : /(s|x|ch|sh)$/.test(unit) ? `${unit}es` : `${unit}s`);
const qty = (n: number) => (Number.isInteger(n) ? n.toLocaleString('en-IN') : (Math.round(n * 10) / 10).toLocaleString('en-IN'));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function niceDate(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function addDays(iso: string, n: number): string {
  const t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + n * 86_400_000;
  return new Date(t).toISOString().slice(0, 10);
}

/** Days of cover against the supplier lead time. */
export function coverSentence(m: MedicineInsight): string {
  const d = m.daysUntilStockout;
  if (m.severity === 'critical') {
    return `${m.name} lasts about ${days(d)}, but an order from the supplier takes ${days(m.leadDays)}. Without help it runs out ${days(m.leadDays - d)} before a supplier delivery could arrive.`;
  }
  if (m.severity === 'warning') {
    return `${m.name} lasts about ${days(d)}. That is just enough to reorder from the supplier (${days(m.leadDays)}), but it eats into the ${m.bufferDays}-day safety buffer.`;
  }
  return `${m.name} lasts about ${days(d)}, comfortably longer than the ${m.leadDays}-day supplier lead time plus a ${m.bufferDays}-day safety buffer.`;
}

/** What the usage history and forecast say. */
export function demandSentences(m: MedicineInsight, hospitalName: string): string[] {
  const out: string[] = [];
  const unit = unitWord(m.baseUnit, 2);
  if (m.history.length > 0) {
    const vals = m.history.map((p) => p.value);
    const avg = vals.reduce((s, v) => s + v, 0) / vals.length;
    const wk = m.history.filter((p) => {
      const g = new Date(`${p.date}T00:00:00Z`).getUTCDay();
      return g !== 0 && g !== 6;
    });
    const we = m.history.filter((p) => !wk.includes(p));
    const mean = (xs: typeof m.history) => (xs.length ? xs.reduce((s, p) => s + p.value, 0) / xs.length : 0);
    out.push(
      `Over the last ${m.history.length} days ${hospitalName} used about ${qty(Math.round(avg))} ${unit} a day: around ${qty(Math.round(mean(wk)))} on weekdays and ${qty(Math.round(mean(we)))} at weekends.`,
    );
    const filled = m.history.filter((p) => p.filled).length;
    if (filled > 0) out.push(`${plural(filled, 'day')} had no record and ${filled === 1 ? 'was' : 'were'} filled in from the days either side.`);
  }
  out.push(`For the next 30 days the forecast expects about ${qty(m.dailyDemand)} ${unit} a day.`);
  // Quoted verbatim from the engine: never recomputed here.
  for (const reason of m.eventReasons) out.push(`A nearby event raises this forecast: ${reason}.`);
  if (m.mode === 'trend') {
    out.push('Usage jumped sharply in the last few days (an outbreak), so the forecast follows the recent trend instead of the usual weekly pattern.');
  }
  if (m.mapePct !== null) {
    out.push(`Checked against the past month, the forecast was off by about ${m.mapePct}% on an average day, so read it as give or take ${m.mapePct}%.`);
  }
  out.push('The shaded part (days 15 to 30) is further ahead and less certain: use it for planning, not for decisions today.');
  return out;
}

/** When stock hits zero, and what can arrive before then. */
export function runDownSentences(m: MedicineInsight, asOf: string, hospitalName: (id: string) => string): string[] {
  const out: string[] = [];
  const unit = unitWord(m.baseUnit, 2);
  out.push(
    `${qty(m.stock)} ${unit} in stock today. At the forecast rate that reaches zero around ${niceDate(addDays(asOf, m.daysUntilStockout))}, in ${days(m.daysUntilStockout)}.`,
  );
  out.push(`An order placed with the supplier today would arrive in ${days(m.leadDays)}, around ${niceDate(addDays(asOf, m.leadDays))}.`);
  for (const t of m.transfersIn) {
    out.push(`Sanjeevini suggests a transfer of ${qty(t.qty)} ${unit} from ${hospitalName(t.fromHospital)}, which can arrive in ${days(t.transportDays)}.`);
  }
  for (const t of m.transfersOut) {
    out.push(`This hospital can spare ${qty(t.qty)} ${unit} for ${hospitalName(t.toHospital)} and still keep its own buffer.`);
  }
  if (m.supplierOrder) {
    out.push(`Transfers cannot cover all of it, so order ${qty(m.supplierOrder.qty)} ${unit} from the supplier now.`);
  }
  for (const w of m.waste) {
    out.push(`${qty(w.wasteUnits)} ${unit} expire on ${niceDate(w.expiryDate)} before they can be used. Moving them to a hospital that needs them avoids the waste.`);
  }
  return out;
}

const FACTOR_WORDS: Record<string, string> = {
  soonness: 'how soon it runs out',
  emergencyShare: 'the share of emergency patients',
  patientLoad: 'how many patients the hospital sees',
  substitute: 'whether a substitute medicine is available',
};

export function prioritySentences(h: HospitalInsight, medName: (id: string) => string): string[] {
  const top = h.priorities[0];
  if (!top) return ['None of this hospital’s medicines is ranked for attention right now.'];
  const f = top.factors as unknown as Record<string, number>;
  const biggest = Object.entries(f)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])[0];
  const out = [
    `${medName(top.medicineId)} here is #${top.rank} of ${h.networkRanked} on the network's attention list, with a score of ${top.score} out of 100.`,
  ];
  if (biggest) out.push(`The biggest reason is ${FACTOR_WORDS[biggest[0]] ?? biggest[0]}.`);
  if (f.substitute < 0) out.push('A substitute medicine exists, which lowers the urgency a little.');
  return out;
}

export function hospitalSummary(h: HospitalInsight): string[] {
  const n = h.medicines.length;
  const crit = h.medicines.filter((m) => m.severity === 'critical');
  const low = h.medicines.filter((m) => m.severity === 'warning');
  const incoming = h.medicines.reduce((s, m) => s + m.transfersIn.length, 0);
  const out: string[] = [];
  if (crit.length === 0 && low.length === 0) {
    out.push(`All ${n} medicines last longer than their supplier lead time plus safety buffer. Nothing needs action today.`);
  } else {
    if (crit.length) {
      out.push(
        `${crit.length} of ${n} medicines (${crit.map((m) => m.name).join(', ')}) run out before a supplier delivery could arrive.`,
      );
    }
    if (low.length) out.push(`${low.length} more ${low.length === 1 ? 'is' : 'are'} inside the safety buffer: worth reordering soon.`);
    if (incoming) out.push(`Sanjeevini has found ${plural(incoming, 'transfer')} from nearby hospitals that can arrive in time.`);
  }
  if (h.summary?.outbreak) out.push('An outbreak is under way here: usage has jumped well above normal in the last few days.');
  return out;
}

export function cardSentence(c: HospitalCard): string {
  if (!c.worst) return 'No stock positions.';
  if (c.level === 'critical') return `${c.worst.name} runs out in ${days(c.worst.days)}; a supplier needs ${days(c.worst.leadDays)}.`;
  if (c.level === 'warning') return `${c.worst.name} is inside its safety buffer (${days(c.worst.days)} left).`;
  return `Every medicine covers its supplier lead time. Lowest: ${c.worst.name}, ${days(c.worst.days)}.`;
}

export function networkSummary(cards: readonly HospitalCard[]): string {
  const crit = cards.filter((c) => c.level === 'critical').length;
  const transfers = cards.reduce((s, c) => s + c.transfersIn, 0);
  if (crit === 0) return `All ${cards.length} hospitals cover their supplier lead times.`;
  return `${crit} of ${cards.length} hospitals will run short of at least one medicine before a supplier could deliver. Sanjeevini has ${plural(transfers, 'transfer')} lined up to close the gaps.`;
}
