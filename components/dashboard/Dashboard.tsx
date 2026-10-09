"use client";

/**
 * Map-first operations dashboard (Phase 6). Server props carry the one
 * ResultsJSON snapshot, hospital positions, the orders this session may
 * read and the session role. The URL holds selection and views:
 *   ?hospital=<id>  cross-filter + drill-in (toggle; unknown ids dropped)
 *   ?tab=<key>      active network section
 *   ?view=list      list instead of map
 *   ?cart=1         transfer checkout
 *   ?order=<id>     tracking sheet
 *   ?logs=1         activity log;  ?events=1  local events (EVT-04)
 */
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { ResultsJSON, TransferSuggestion } from "@/lib/contracts";
import { isTabKey, scopeResults, unitLabel, type TabKey } from "@/lib/dashboard/panel";
import { fmtDistance, joinMapHospitals, RISK_ORDER, validHospitalId } from "@/lib/dashboard/view";
import { bearingAlongPath, computeBounds, pathLengthM, pointAlongPath, splitPathAt, straightPath, type LatLngTuple, type LeafletBounds } from "@/lib/geo";
import type { HospitalLocationsResponse } from "@/lib/hospital-locations";
import {
  STATUS_LABEL,
  orderForTransfer,
  remainingMs,
  tripDurationMs,
  tripProgress,
  type Order,
  type OrderStatus,
} from "@/lib/orders";
import { layout as L } from "@/theme/tokens";
import { ChatPanel } from "../chat/ChatPanel";
import { MapView } from "../map/MapView";
import type { Connector, MapInsets, RouteLine, TrackingOverlay } from "../map/types";
import { ApiFailure, acceptAll, acceptTransfer, setOrderStatus } from "../orders/api";
import { Cart, laneKey, lineKey } from "../orders/Cart";
import { Tracking } from "../orders/Tracking";
import { useDemoClock } from "../orders/useDemoClock";
import { useRoutes } from "../orders/useRoutes";
import { Glyph } from "../icons/Glyph";
import { DashboardProvider, type DashboardCtx } from "./context";
import styles from "./dashboard.module.css";
import { HospitalDetail } from "./HospitalDetail";
import { HospitalList } from "./HospitalList";
import { Legend } from "./Legend";
import { NetworkPanel } from "./NetworkPanel";
import rows from "./rows.module.css";
import { TopBar } from "./TopBar";
import { LogsSheet } from "../logs/LogsSheet";
import { EventsSheet } from "../events/EventsSheet";
import { StockSheet } from "../stock/StockSheet";
import { hasRightSheet, useLayout, type Breakpoint } from "./useLayout";
import { useUrlState } from "./useUrlState";

export interface DashboardProps {
  results: ResultsJSON | null;
  source: "live" | "snapshot" | null;
  locations: HospitalLocationsResponse | null;
  orders: Order[] | null;
  session: { role: "network_admin" | "hospital_admin"; hospitalId: string | null };
  demoAuth: boolean;
  tileUrl: string;
}

type Snap = "peek" | "half" | "full";

function sheetPx(snap: Snap, vh: number): number {
  if (snap === "peek") return L.sheetPeek;
  if (snap === "half") return Math.round(vh / 2);
  return vh - 72;
}

function panelW(bp: Breakpoint): number {
  return bp === "xxl" ? L.panelW.xxl : bp === "md" ? L.panelW.md : L.panelW.lg;
}

function mergeOrders(base: Order[] | null, updates: readonly Order[]): Order[] | null {
  if (base === null) return null;
  const byId = new Map(base.map((o) => [o.id, o]));
  for (const o of updates) byId.set(o.id, o);
  return [...byId.values()].sort((a, b) => (a.acceptedAt < b.acceptedAt ? 1 : -1));
}

export function Dashboard(props: DashboardProps) {
  const { results } = props;
  if (!results) {
    return (
      <main className={styles.fullState} data-testid="error-state">
        <h1 className={styles.stateHeading}>Network data unavailable</h1>
        <p>The database did not respond and no saved snapshot exists. Try again in a minute.</p>
        <RetryButton />
      </main>
    );
  }
  if (results.hospitals.length === 0) {
    return (
      <main className={styles.fullState} data-testid="empty-state">
        <h1 className={styles.stateHeading}>No hospitals in this network</h1>
        <p>The database has no hospitals yet. Seed it, then press Refresh.</p>
        <RetryButton label="Refresh" />
      </main>
    );
  }
  return <Board {...props} results={results} />;
}

function RetryButton({ label = "Retry" }: { label?: string }) {
  const router = useRouter();
  return (
    <button type="button" className={styles.outlineButton} onClick={() => router.refresh()}>
      {label}
    </button>
  );
}

function Board({ results, source, locations, orders: serverOrders, session, demoAuth, tileUrl }: DashboardProps & { results: ResultsJSON }) {
  const router = useRouter();
  const url = useUrlState();
  const lay = useLayout();
  const [refreshing, startRefresh] = useTransition();
  const [orders, setOrders] = useState<Order[] | null>(serverOrders);
  const [live, setLive] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [focusLine, setFocusLine] = useState<string | null>(null);
  const [snap, setSnap] = useState<Snap>("peek");
  const [drag, setDrag] = useState<number | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const invoker = useRef<HTMLElement | null>(null);

  useEffect(() => setOrders(serverOrders), [serverOrders]);

  // ---- URL state ----------------------------------------------------------------
  const selectedId = validHospitalId(results, url.hospital);
  const tab: TabKey = isTabKey(url.tab) ? url.tab : "stock";
  const view: "map" | "list" = url.view === "list" || !locations ? "list" : "map";
  const trackedOrder = url.order ? (orders?.find((o) => o.id === url.order) ?? null) : null;
  const cartOpen = url.cart === "1";
  const logsOpen = url.logs === "1";
  const eventsOpen = url.events === "1";
  const stockOpen = url.stock === "1";
  const mode: "tracking" | "cart" | "logs" | "events" | "stock" | "hospital" | null = trackedOrder
    ? "tracking"
    : cartOpen
      ? "cart"
      : logsOpen
        ? "logs"
        : eventsOpen
          ? "events"
          : stockOpen
            ? "stock"
            : selectedId
              ? "hospital"
              : null;

  // Unknown ?hospital= / ?order= ids fall back to no selection, param dropped.
  useEffect(() => {
    const patch: Record<string, null> = {};
    if (url.hospital !== null && selectedId === null) patch.hospital = null;
    if (url.order !== null && orders !== null && trackedOrder === null) patch.order = null;
    if (Object.keys(patch).length > 0) url.update(patch, "replace");
  }, [url, selectedId, trackedOrder, orders]);

  const remember = () => {
    if (document.activeElement instanceof HTMLElement) invoker.current = document.activeElement;
  };

  const selectHospital = useCallback(
    (id: string) => {
      remember();
      const next = id === selectedId && !cartOpen && !url.order ? null : id;
      url.update({ hospital: next, cart: null, order: null, logs: null, events: null });
      if (next) setSnap((s) => (s === "peek" ? "half" : s));
    },
    [selectedId, cartOpen, url],
  );

  const closeDetail = useCallback(() => {
    if (mode === "tracking") url.update({ order: null });
    else if (mode === "cart") url.update({ cart: null });
    else if (mode === "logs") url.update({ logs: null });
    else if (mode === "events") url.update({ events: null });
    else if (mode === "stock") url.update({ stock: null });
    else url.update({ hospital: null });
    const back = invoker.current;
    invoker.current = null;
    if (back && document.contains(back)) requestAnimationFrame(() => back.focus());
  }, [mode, url]);

  // Escape closes the topmost sheet and returns focus to its invoker.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mode && !e.defaultPrevented) closeDetail();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, closeDetail]);

  // Opening a sheet moves focus to its heading.
  const detailKey = `${mode}:${trackedOrder?.id ?? ""}:${selectedId ?? ""}`;
  useEffect(() => {
    if (!mode) return;
    requestAnimationFrame(() => document.getElementById("detail-heading")?.focus());
    if (lay.bp === "xs") setSnap((s) => (s === "peek" ? "half" : s));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailKey]);

  // ---- lookups ------------------------------------------------------------------
  const medNames = useMemo(() => new Map(results.medicines.map((m) => [m.medicineId, m] as const)), [results]);
  const hospNames = useMemo(() => new Map(results.hospitals.map((h) => [h.hospitalId, h.hospitalName] as const)), [results]);
  const locById = useMemo(() => new Map((locations?.hospitals ?? []).map((h) => [h.id, h] as const)), [locations]);
  const scoped = useMemo(() => scopeResults(results, selectedId), [results, selectedId]);

  // ---- routes (cart lanes + tracked lane) -------------------------------------------
  const cartLanes = useMemo(() => (mode === "cart" ? results.transfers.map(laneKey) : []), [mode, results]);
  const trackLane = trackedOrder ? laneKey(trackedOrder) : null;
  const lanes = useMemo(() => [...cartLanes, ...(trackLane ? [trackLane] : [])], [cartLanes, trackLane]);
  const routes = useRoutes(lanes);

  // ---- demo clock / tracking geometry ------------------------------------------------
  const trackRoute = trackLane ? routes[trackLane] : null;
  const fallbackPath: LatLngTuple[] | null = useMemo(() => {
    if (!trackedOrder) return null;
    const a = locById.get(trackedOrder.fromHospital);
    const b = locById.get(trackedOrder.toHospital);
    return a && b ? straightPath(a, b) : null;
  }, [trackedOrder, locById]);
  const trackPath: LatLngTuple[] | null = trackRoute?.status === "ok" ? trackRoute.route.path : fallbackPath;
  const trackApprox = !(trackRoute?.status === "ok" && !trackRoute.route.approximate);
  const totalM = trackRoute?.status === "ok" ? trackRoute.route.distanceM : fallbackPath ? pathLengthM(fallbackPath) : 0;
  const clock = useDemoClock(
    trackedOrder && (trackedOrder.status === "in_transit" || trackedOrder.status === "delivered") ? trackedOrder.inTransitAt : null,
    lay.reducedMotion,
  );
  const tripMs = trackedOrder ? tripDurationMs(trackedOrder.transportDays, trackRoute?.status === "ok" ? trackRoute.route.durationS : null) : 0;
  const progress = trackedOrder ? tripProgress(trackedOrder.status, clock.simMs, tripMs) : 0;

  const trackingOverlay: TrackingOverlay | null = useMemo(() => {
    if (!trackedOrder || !trackPath) return null;
    const split = splitPathAt(trackPath, progress);
    // No vehicle once cancelled or delivered (it would sit on the receiver marker).
    const moving = trackedOrder.status !== "cancelled" && trackedOrder.status !== "delivered";
    const pos = pointAlongPath(trackPath, progress);
    return {
      travelled: split.travelled,
      remaining: split.remaining,
      approximate: trackApprox,
      vehicle:
        moving && pos
          ? {
              position: pos,
              bearing: bearingAlongPath(trackPath, progress),
              label: `Simulated vehicle, ${fmtDistance((1 - progress) * totalM)} remaining`,
            }
          : null,
    };
  }, [trackedOrder, trackPath, progress, trackApprox, totalM]);

  // ---- context -----------------------------------------------------------------------
  const ctx: DashboardCtx = useMemo(
    () => ({
      results,
      medName: (id) => medNames.get(id)?.medicineName ?? id,
      hospName: (id) => hospNames.get(id) ?? id,
      unit: (id, qty) => unitLabel(medNames.get(id)?.baseUnit ?? "unit", qty),
      selectedId,
      selectHospital,
      role: session.role,
      ownHospitalId: session.hospitalId,
      orders,
      orderFor: (t) => (orders ? orderForTransfer(orders, t, results.asOf) : null),
      openCart: () => {
        remember();
        url.update({ cart: "1", order: null, logs: null, events: null });
      },
      openStock: (hospitalId?: string) => {
        remember();
        url.update({
          stock: "1",
          order: null,
          cart: null,
          logs: null,
          events: null,
          ...(hospitalId ? { hospital: hospitalId } : {}),
        });
      },
      track: (id) => {
        remember();
        url.update({ order: id });
      },
      routes,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [results, medNames, hospNames, selectedId, selectHospital, session, orders, url, routes],
  );

  // ---- actions -------------------------------------------------------------------------
  const failText = (e: unknown) =>
    e instanceof ApiFailure && e.status === 403
      ? "Only the sending hospital's admin or a network admin can accept this transfer."
      : `Transfer not accepted. ${e instanceof Error ? e.message : "Request failed"}. Try again.`;

  const onAccept = async (t: TransferSuggestion) => {
    setBusy(lineKey(t));
    setActionError(null);
    try {
      const res = await acceptTransfer({ fromHospital: t.fromHospital, toHospital: t.toHospital, medicineId: t.medicineId, qty: t.qty });
      setOrders((o) => mergeOrders(o, res.orders));
      setLive(`${res.created > 0 ? 1 : 0} transfer(s) accepted.`);
      router.refresh();
    } catch (e) {
      setActionError(failText(e));
    } finally {
      setBusy(null);
    }
  };

  const onAcceptAll = async () => {
    setBusy("all");
    setActionError(null);
    try {
      const res = await acceptAll();
      setOrders((o) => mergeOrders(o, res.orders));
      const n = res.orders.reduce((k, o) => k + o.lines.length, 0);
      setLive(`${res.created > 0 ? n : 0} transfer(s) accepted.`);
      router.refresh();
    } catch (e) {
      setActionError(failText(e));
    } finally {
      setBusy(null);
    }
  };

  const onAdvance = async (to: OrderStatus) => {
    if (!trackedOrder) return;
    setBusy("status");
    setActionError(null);
    try {
      const res = await setOrderStatus(trackedOrder.id, to);
      setOrders((o) => mergeOrders(o, [res.order]));
      const med = res.order.lines.map((l) => ctx.medName(l.medicineId)).join(", ");
      setLive(`Transfer ${med} to ${ctx.hospName(res.order.toHospital)}: ${STATUS_LABEL[res.order.status]}.`);
      router.refresh();
    } catch (e) {
      setActionError(
        e instanceof ApiFailure && e.status === 403
          ? "Only the sending hospital's admin or a network admin can update this transfer."
          : `Status not changed. ${e instanceof Error ? e.message : "Request failed"}. Try again.`,
      );
    } finally {
      setBusy(null);
    }
  };

  // Clear stale action errors when the sheet changes.
  useEffect(() => setActionError(null), [detailKey]);

  // ---- map inputs ----------------------------------------------------------------------
  const mapHospitals = useMemo(() => {
    const joined = joinMapHospitals(locations?.hospitals ?? [], results);
    return joined.sort((a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk] || a.name.localeCompare(b.name));
  }, [locations, results]);
  const missing = results.hospitals.filter((h) => !locById.has(h.hospitalId)).length;

  const connectors: Connector[] = useMemo(() => {
    if (tab !== "moves" || mode === "cart" || mode === "tracking") return [];
    return scoped.transfers.flatMap((t) => {
      const a = locById.get(t.fromHospital);
      const b = locById.get(t.toHospital);
      return a && b ? [{ key: lineKey(t), from: [a.lat, a.lng] as LatLngTuple, to: [b.lat, b.lng] as LatLngTuple }] : [];
    });
  }, [tab, mode, scoped, locById]);

  const routeLines: RouteLine[] = useMemo(() => {
    if (mode !== "cart") return [];
    return results.transfers.flatMap((t) => {
      const r = routes[laneKey(t)];
      if (r?.status === "ok") return [{ key: lineKey(t), path: r.route.path, approximate: r.route.approximate, focused: focusLine === lineKey(t) }];
      const a = locById.get(t.fromHospital);
      const b = locById.get(t.toHospital);
      return r?.status === "error" && a && b ? [{ key: lineKey(t), path: straightPath(a, b), approximate: true, focused: focusLine === lineKey(t) }] : [];
    });
  }, [mode, results, routes, focusLine, locById]);

  const fitBounds: LeafletBounds | null = useMemo(() => {
    if (!locations) return null;
    if (mode === "tracking" && trackPath) return computeBounds(trackPath.map(([lat, lng]) => ({ lat, lng }))) ?? locations.bounds;
    if (mode === "cart" && results.transfers.length > 0) {
      const ids = new Set(results.transfers.flatMap((t) => [t.fromHospital, t.toHospital]));
      return computeBounds(locations.hospitals.filter((h) => ids.has(h.id))) ?? locations.bounds;
    }
    return locations.bounds;
  }, [locations, mode, trackPath, results]);

  const sheetH = drag ?? sheetPx(snap, lay.viewportH);
  const xs = lay.bp === "xs";
  const rightSheet = hasRightSheet(lay.bp) && mode !== null;
  const insets: MapInsets = {
    top: xs ? L.insetXs * 2 + L.topbarH : L.inset * 2 + L.topbarH,
    left: xs ? 0 : L.inset * 2 + panelW(lay.bp),
    // The right sheet, or the floating chat panel (>= 1024 px) when open.
    right: rightSheet
      ? L.inset * 2 + (lay.bp === "xxl" ? L.sheetW.xxl : L.sheetW.xl)
      : chatOpen && !xs && lay.bp !== "md"
        ? L.inset * 2 + L.chatW
        : 0,
    bottom: xs ? sheetH : 0,
  };
  const rootVars = {
    "--sheet-height": `${sheetH}px`,
    "--map-inset-top": `${insets.top}px`,
    "--map-inset-left": `${insets.left}px`,
    "--map-inset-right": `${insets.right}px`,
    "--map-inset-bottom": `${insets.bottom}px`,
    "--chat-space": chatOpen && !xs && lay.bp !== "md" ? `${L.chatW + L.inset}px` : "0px",
  } as React.CSSProperties;

  // ---- bottom sheet drag (XS) -----------------------------------------------------------------
  const dragStart = useRef<{ y: number; h: number } | null>(null);
  const onHandleDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragStart.current = { y: e.clientY, h: sheetH };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const h = Math.min(lay.viewportH - 72, Math.max(L.sheetPeek, dragStart.current.h - (e.clientY - dragStart.current.y)));
    setDrag(h);
  };
  const onHandleUp = () => {
    if (!dragStart.current) return;
    dragStart.current = null;
    if (drag !== null) {
      const options: Snap[] = ["peek", "half", "full"];
      const best = options.reduce((b, s) => (Math.abs(sheetPx(s, lay.viewportH) - drag) < Math.abs(sheetPx(b, lay.viewportH) - drag) ? s : b), "peek" as Snap);
      setSnap(best);
    }
    setDrag(null);
  };
  const handle = (label: string) => (
    <div className={styles.handle} onPointerDown={onHandleDown} onPointerMove={onHandleMove} onPointerUp={onHandleUp} onPointerCancel={onHandleUp}>
      <span className={styles.handleBar} aria-hidden="true" />
      <span className={styles.handleLabel}>{label}</span>
      <button
        type="button"
        className={rows.iconButton}
        aria-expanded={snap !== "peek"}
        onClick={() => setSnap(snap === "full" ? "peek" : snap === "peek" ? "half" : "full")}
        data-testid="sheet-expand"
      >
        <Glyph name={snap === "full" ? "chevron-down" : "chevron-up"} />
        {snap === "full" ? "Collapse" : "Expand"}
      </button>
    </div>
  );

  const mapAvailable = !!locations && !!fitBounds;
  const backToNetwork = !rightSheet && !lay.pending;
  const onBack = mode === "tracking" ? () => url.update({ order: null }) : mode === "cart" && selectedId ? () => url.update({ cart: null }) : undefined;

  return (
    <DashboardProvider value={ctx}>
      <div className={styles.root} style={rootVars}>
        <a className="skip-link" href="#panel-tabs" onClick={(e) => {
          e.preventDefault();
          document.querySelector<HTMLElement>('#panel-tabs [aria-selected="true"]')?.focus();
        }}>
          Skip to results
        </a>
        <TopBar
          generatedAt={results.generatedAt}
          asOf={results.asOf}
          source={source}
          view={view}
          onView={(v) => url.update({ view: v === "list" ? "list" : null })}
          onRefresh={() => startRefresh(() => router.refresh())}
          refreshing={refreshing}
          role={session.role}
          ownHospitalId={session.hospitalId}
          hospitals={results.hospitals.map((h) => ({ id: h.hospitalId, name: h.hospitalName }))}
          demoAuth={demoAuth}
          onRoleError={setLive}
          onLogs={() => {
            remember();
            url.update({ logs: logsOpen ? null : "1", events: null, order: null, cart: null });
          }}
          logsOpen={logsOpen}
          onEvents={() => {
            remember();
            url.update({ events: eventsOpen ? null : "1", logs: null, order: null, cart: null });
          }}
          eventsOpen={eventsOpen}
          onStock={() => {
            remember();
            url.update({ stock: stockOpen ? null : "1", order: null, cart: null, logs: null, events: null });
          }}
          stockOpen={stockOpen}
        />

        {view === "map" && mapAvailable ? (
          <section className={styles.mapArea} aria-label="Hospital map" data-testid="hospital-map">
            <p className="sr-only">{mapHospitals.length} hospitals on the map. Use Tab to move between hospitals, or switch to List.</p>
            {lay.pending ? (
              <div className={styles.mapLoading}>Loading map</div>
            ) : (
              <MapView
                hospitals={mapHospitals}
                selectedId={selectedId}
                onSelect={selectHospital}
                fitBounds={fitBounds!}
                insets={insets}
                connectors={connectors}
                routes={routeLines}
                tracking={trackingOverlay}
                reducedMotion={lay.reducedMotion}
                tileUrl={tileUrl}
              />
            )}
            <Legend
              missing={missing}
              showTransfers={connectors.length > 0}
              showRoutes={mode === "cart" || mode === "tracking"}
              showVehicle={mode === "tracking"}
              compact={xs}
            />
          </section>
        ) : (
          <section className={`${styles.listArea} ${rightSheet ? styles.withSheet : ""}`} aria-label="Hospital list">
            {!locations ? (
              <p className={rows.note} role="status">
                Map unavailable. Hospital positions could not be loaded. Showing the list instead.
              </p>
            ) : null}
            <HospitalList locations={locations?.hospitals ?? []} />
          </section>
        )}

        <aside
          className={`${styles.panel} ${mode && !rightSheet ? styles.covered : ""} ${drag !== null ? styles.dragging : ""}`}
          aria-label="Network results"
          data-testid="bottom-sheet"
        >
          {handle(selectedId ? `Filtered: ${ctx.hospName(selectedId)}` : "Network")}
          <div className={styles.scroll}>
            <NetworkPanel
              scoped={scoped}
              tab={tab}
              onTab={(k) => url.update({ tab: k === "stock" ? null : k }, "replace")}
              onClearFilter={() => url.update({ hospital: null })}
              source={source ?? "live"}
              onRetry={() => startRefresh(() => router.refresh())}
            />
          </div>
        </aside>

        {mode ? (
          <section key={mode} className={styles.sheet} role="region" aria-labelledby="detail-heading">
            {handle(mode === "tracking" ? "Tracking" : mode === "cart" ? "Transfers" : mode === "logs" ? "Activity" : mode === "events" ? "Events" : mode === "stock" ? "Enter stock" : "Hospital")}
            <div className={styles.scroll}>
              {mode === "hospital" && selectedId ? (
                <HospitalDetail
                  hospitalId={selectedId}
                  location={locById.get(selectedId) ?? null}
                  onClose={closeDetail}
                  onBack={backToNetwork ? closeDetail : undefined}
                  activityBump={orders}
                />
              ) : null}
              {mode === "logs" ? (
                <LogsSheet
                  onClose={closeDetail}
                  bump={orders}
                  onReset={(msg) => {
                    setOrders((o) => (o === null ? null : []));
                    setLive(msg);
                    router.refresh();
                  }}
                />
              ) : null}
              {mode === "events" ? (
                <EventsSheet
                  onClose={closeDetail}
                  locations={locations?.hospitals ?? []}
                  onChanged={() => {
                    router.refresh();
                  }}
                />
              ) : null}
              {mode === "stock" ? (
                <StockSheet
                  onClose={closeDetail}
                  onChanged={() => {
                    router.refresh();
                  }}
                />
              ) : null}
              {mode === "cart" ? (
                <Cart
                  onClose={closeDetail}
                  onBack={onBack ?? (backToNetwork ? closeDetail : undefined)}
                  onAccept={onAccept}
                  onAcceptAll={onAcceptAll}
                  busy={busy}
                  error={actionError}
                  focused={focusLine}
                  onFocusLine={setFocusLine}
                />
              ) : null}
              {mode === "tracking" && trackedOrder ? (
                <Tracking
                  order={trackedOrder}
                  route={trackRoute ?? { status: "loading" }}
                  totalM={totalM}
                  progress={progress}
                  remainingMs={remainingMs(progress, tripMs)}
                  tripMs={tripMs}
                  clock={clock}
                  onAdvance={onAdvance}
                  busy={busy === "status"}
                  error={actionError}
                  onClose={closeDetail}
                  onBack={onBack}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        <ChatPanel results={results} scopeId={selectedId} sheetOpen={mode !== null} modal={xs} ready={!lay.pending} wide={lay.bp !== "xs" && lay.bp !== "md"} onOpenChange={setChatOpen} />

        <div role="status" aria-live="polite" className="sr-only">
          {live}
        </div>
      </div>
    </DashboardProvider>
  );
}

