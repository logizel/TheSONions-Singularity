"use client";

/**
 * Transfer checkout (`cart`): the engine's hospital-to-hospital transfers as
 * a basket. Engine delivery window and road drive time are separate rows,
 * never merged (D-10). Accept buttons render for network_admin only; the
 * server enforces the same rule (403).
 */
import type { TransferSuggestion } from "@/lib/contracts";
import { fmtDistance, fmtDuration, fmtUnits } from "@/lib/dashboard/view";
import { useDash } from "../dashboard/context";
import rows from "../dashboard/rows.module.css";
import { SheetHeader } from "../dashboard/SheetHeader";
import { LocalTime } from "../ui/LocalTime";
import { ChecksDisclosure, OrderStatusTag, days } from "./OrderBits";
import styles from "./orders.module.css";
import { SupplierTimeline } from "./SupplierTimeline";

export const laneKey = (t: { fromHospital: string; toHospital: string }) => `${t.fromHospital}>${t.toHospital}`;
export const lineKey = (t: TransferSuggestion) => `${t.fromHospital}-${t.toHospital}-${t.medicineId}`;

export function Cart({
  onClose,
  onBack,
  onAccept,
  onAcceptAll,
  busy,
  error,
  focused,
  onFocusLine,
}: {
  onClose: () => void;
  onBack?: () => void;
  onAccept: (t: TransferSuggestion) => void;
  onAcceptAll: () => void;
  busy: string | null;
  error: string | null;
  focused: string | null;
  onFocusLine: (key: string | null) => void;
}) {
  const { results, medName, hospName, unit, role, ownHospitalId, orders, orderFor, track, routes } = useDash();
  const transfers = results.transfers;
  // Network admin accepts any line; a hospital admin accepts lines its hospital sends.
  const canAcceptLine = (t: TransferSuggestion) => orders !== null && (role === "network_admin" || ownHospitalId === t.fromHospital);
  const canAccept = role === "network_admin" && orders !== null;

  // Summary: units per unit type (never summed across units), distinct medicines,
  // road distance + longest drive (routing), longest engine window (engine).
  const perUnit = new Map<string, number>();
  for (const t of transfers) {
    const u = unit(t.medicineId, 2);
    perUnit.set(u, Math.round(((perUnit.get(u) ?? 0) + t.qty) * 10) / 10);
  }
  const lanes = [...new Set(transfers.map(laneKey))];
  const states = lanes.map((l) => routes[l] ?? { status: "loading" as const });
  const loaded = states.filter((s) => s.status !== "loading").length;
  const ok = states.flatMap((s) => (s.status === "ok" ? [s.route] : []));
  const anyApprox = ok.some((r) => r.approximate) || states.some((s) => s.status === "error");
  const totalM = ok.reduce((n, r) => n + r.distanceM, 0);
  const longest = ok.reduce<(typeof ok)[number] | null>((m, r) => (m === null || (r.durationS ?? -1) > (m.durationS ?? -1) ? r : m), null);
  const longestWindow = transfers.reduce((m, t) => Math.max(m, t.transportDays), 0);
  const suggestedLeft = transfers.filter((t) => {
    const m = orderFor(t);
    return !m || m.order.status === "cancelled";
  }).length;

  return (
    <div data-testid="cart">
      <SheetHeader title="Transfer checkout" onClose={onClose} onBack={onBack} closeLabel="Close transfer checkout" closeTestId="cart-close">
        <p className={rows.caption}>Engine-suggested transfers in this snapshot. Quantities are the engine&apos;s.</p>
      </SheetHeader>

      {transfers.length === 0 ? (
        <div className={rows.empty}>
          <p className={rows.emptyHeading}>No transfers to review</p>
          <p className={rows.caption}>The engine suggested none in this snapshot.</p>
        </div>
      ) : (
        <>
          <dl className={rows.dl} data-testid="cart-summary">
            <dt>Total units</dt>
            <dd>
              {[...perUnit.entries()].map(([u, n]) => (
                <span key={u} className={styles.blockLine}>
                  {fmtUnits(n)} {u}
                </span>
              ))}
            </dd>
            <dt>Medicines</dt>
            <dd>{new Set(transfers.map((t) => t.medicineId)).size}</dd>
            <dt>Road distance (total)</dt>
            <dd>
              {loaded < lanes.length
                ? `Loading routes (${loaded} of ${lanes.length})`
                : ok.length === 0
                  ? "Not available"
                  : `${anyApprox ? "≈ " : ""}${(totalM / 1000).toFixed(1)} km`}
            </dd>
            <dt>Longest drive time (road)</dt>
            <dd>{loaded < lanes.length ? "Loading" : longest && !longest.approximate ? fmtDuration(longest.durationS) : "Not available"}</dd>
            <p className={`${rows.dlNote} ${rows.caption}`}>From the road route (OSRM).</p>
            <dt>Longest delivery window (engine)</dt>
            <dd>{days(longestWindow)}</dd>
            <p className={`${rows.dlNote} ${rows.caption}`}>Planning window used by the stock engine.</p>
          </dl>

          {role !== "network_admin" ? (
            <p className={rows.note}>You can accept transfers sent from {ownHospitalId ? hospName(ownHospitalId) : "your hospital"}. Others are read only.</p>
          ) : null}
          {orders === null ? <p className={rows.note}>Order tracking unavailable: the order store did not respond.</p> : null}
          {error ? (
            <p className={rows.error} role="alert">
              {error}
            </p>
          ) : null}

          <h3 className={`${rows.subhead} ${rows.label}`}>
            <span>Transfers {transfers.length}</span>
          </h3>
          <ul className={rows.rows}>
            {transfers.map((t) => {
              const key = lineKey(t);
              const match = orderFor(t);
              const status = match?.order.status ?? "suggested";
              const route = routes[laneKey(t)];
              const acceptable = !match || match.order.status === "cancelled";
              return (
                <li
                  key={key}
                  className={`${styles.line} ${focused === key ? styles.lineFocused : ""}`}
                  data-testid={`cart-line-${key}`}
                  onMouseEnter={() => onFocusLine(key)}
                  onMouseLeave={() => onFocusLine(null)}
                  onFocus={() => onFocusLine(key)}
                >
                  <div className={styles.lineTop}>
                    <span>
                      <span className={rows.strong}>{medName(t.medicineId)}</span> {fmtUnits(t.qty)} {unit(t.medicineId, t.qty)}
                    </span>
                    <OrderStatusTag status={status} />
                  </div>
                  <span>
                    {hospName(t.fromHospital)} → {hospName(t.toHospital)}
                  </span>
                  <div className={styles.cells}>
                    <span className={styles.cell}>Engine delivery window: {days(t.transportDays)}</span>
                    <span className={styles.cell}>
                      {route?.status === "ok"
                        ? route.route.approximate
                          ? `Road: ≈ ${fmtDistance(route.route.distanceM)} straight line · drive time not available`
                          : `Road: ${fmtDistance(route.route.distanceM)} · ${fmtDuration(route.route.durationS)} drive`
                        : route?.status === "error"
                          ? "Road route unavailable. The engine delivery window still applies."
                          : "Road: loading route"}
                    </span>
                  </div>
                  <ChecksDisclosure checks={t.checksPassed} />
                  <div className={styles.lineActions}>
                    {match ? (
                      <>
                        <span className={rows.caption}>
                          {STATUS_VERB[match.order.status]} <LocalTime iso={stampOf(match.order)} format="stamp" />
                        </span>
                        <button type="button" className={rows.outlineButton} onClick={() => track(match.order.id)} data-testid={`track-${match.order.id}`}>
                          Track
                        </button>
                      </>
                    ) : null}
                    {canAcceptLine(t) && acceptable ? (
                      <button
                        type="button"
                        className={rows.accentButton}
                        onClick={() => onAccept(t)}
                        aria-disabled={busy !== null}
                        disabled={busy !== null}
                        data-testid={`cart-accept-${key}`}
                      >
                        {busy === key ? "Accepting" : "Accept transfer"}
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
          {canAccept ? (
            <div className={rows.footer}>
              <span className={rows.caption}>{suggestedLeft} still suggested</span>
              <button
                type="button"
                className={rows.accentButton}
                onClick={() => suggestedLeft > 0 && busy === null && onAcceptAll()}
                aria-disabled={suggestedLeft === 0 || busy !== null}
                data-testid="cart-accept-all"
              >
                {busy === "all" ? "Accepting" : `Accept all (${suggestedLeft})`}
              </button>
            </div>
          ) : null}
        </>
      )}

      <h3 className={`${rows.subhead} ${rows.label}`}>
        <span>Supplier orders {results.emergencyOrders.length}</span>
      </h3>
      {results.emergencyOrders.length === 0 ? (
        <p className={rows.empty}>No supplier orders needed.</p>
      ) : (
        <ul className={rows.rows}>
          {results.emergencyOrders.map((o) => (
            <li key={`${o.hospitalId}-${o.medicineId}`} className={styles.line} data-testid={`supplier-order-row-${o.hospitalId}-${o.medicineId}`}>
              <span>
                <span className={rows.strong}>{medName(o.medicineId)}</span> {fmtUnits(o.qty)} {unit(o.medicineId, o.qty)} for {hospName(o.hospitalId)}
              </span>
              <span className={rows.caption}>{o.reason}</span>
              <SupplierTimeline order={o} />
            </li>
          ))}
        </ul>
      )}
      <p className={`${rows.sectionHead} ${rows.caption}`}>Place this order with your supplier. This system does not send orders.</p>
    </div>
  );
}

const STATUS_VERB = {
  accepted: "Accepted",
  packed: "Packed",
  in_transit: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
} as const;

function stampOf(o: { status: keyof typeof STATUS_VERB; acceptedAt: string; packedAt: string | null; inTransitAt: string | null; deliveredAt: string | null; cancelledAt: string | null }) {
  return (
    { accepted: o.acceptedAt, packed: o.packedAt, in_transit: o.inTransitAt, delivered: o.deliveredAt, cancelled: o.cancelledAt }[o.status] ?? o.acceptedAt
  );
}
