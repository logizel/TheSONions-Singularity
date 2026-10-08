/**
 * One-screen dashboard (D-01): static fixture load per page load (D-24),
 * header timestamp + manual Refresh (D-27), skeleton while mounting and
 * guided empty state when the network has no hospitals (D-25).
 * Clicking a hospital anywhere filters every card; selection syncs both
 * ways with ?hospital=id (D-04, D-16). No polling, no per-card fetching —
 * every card renders from the single static fixture slices below.
 */
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import fixtureJson from "./data/mock-results.json";
import {
  isKnownHospitalId,
  type ResultsFixture,
} from "./data/results";
import { Header } from "@/components/Header";
import { DashboardGrid } from "@/components/cards/DashboardGrid";
import { InventoryCard, type InventoryCardRow } from "@/components/cards/InventoryCard";
import { ForecastCard, type ForecastCardRow } from "@/components/cards/ForecastCard";
import { ShortageCard, type ShortageCardRow } from "@/components/cards/ShortageCard";
import { ExpiryCard, type ExpiryCardRow } from "@/components/cards/ExpiryCard";
import {
  MovesCard,
  type MovesCardOrder,
  type MovesCardTransfer,
} from "@/components/cards/MovesCard";
import {
  PrioritiesCard,
  type PrioritiesCardRow,
} from "@/components/cards/PrioritiesCard";
import { SkeletonCard } from "@/components/cards/ui";
import { HospitalPanel } from "@/components/panel/HospitalPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import {
  PROTOTYPE_DEFAULT_ROLE,
  PROTOTYPE_OWN_HOSPITAL_ID,
  RoleSwitcher,
  type Role,
} from "@/components/roles";
import { colors, layout, spacing } from "@/theme/tokens";

const fixture = fixtureJson as ResultsFixture;

function buildInventoryRows(
  data: ResultsFixture,
  selectedId: string | null,
): InventoryCardRow[] {
  // G-04-1: filter to the validated selectedId before mapping, so an
  // active ?hospital filter yields exactly one inventory row.
  return data.hospitals
    .filter((h) => selectedId === null || h.id === selectedId)
    .map((h) => {
    const rows = data.inventory.filter((r) => r.hospitalId === h.id);
    const totalStock = rows.reduce((sum, r) => sum + r.stock, 0);
    // G-04-2: share the panel per-row semantics (HospitalPanel.tsx:107-120).
    // The badge evaluates riskForDaysToStockout on the min row's OWN
    // medicine lead/buffer — not global maxima — so dashboard and drill-in
    // agree for the same stock. First-min-row wins on ties; `?? 0`
    // fallbacks match the panel.
    const minRow = rows.reduce<(typeof rows)[number] | null>(
      (min, r) =>
        min === null || r.daysToStockout < min.daysToStockout ? r : min,
      null,
    );
    const minDaysToStockout = minRow?.daysToStockout ?? 0;
    const leadByMedicine = new Map(
      data.leadDays
        .filter((l) => l.hospitalId === h.id)
        .map((l) => [l.medicineId, l.days] as const),
    );
    const leadDays =
      minRow !== null ? (leadByMedicine.get(minRow.medicineId) ?? 0) : 0;
    const bufferDays =
      minRow !== null
        ? (data.medicines.find((m) => m.id === minRow.medicineId)
            ?.bufferDays ?? 0)
        : 0;
    const trend = rows[0]?.trend ?? [];
    return {
      hospitalId: h.id,
      hospitalName: h.name,
      totalStock,
      minDaysToStockout,
      leadDays,
      bufferDays,
      trend,
      selected: selectedId === h.id,
    };
  });
}

function Dashboard() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);
  // Prototype role stub (D-26): defaults to network_admin; flipping to
  // hospital_admin scopes move/order actions to the prototype own hospital.
  // Display-only — real enforcement belongs to the Phase 3 server-side
  // auth layer with final wiring in Phase 5.
  const [role, setRole] = useState<Role>(PROTOTYPE_DEFAULT_ROLE);
  const ownHospitalId =
    role === "hospital_admin" ? PROTOTYPE_OWN_HOSPITAL_ID : null;

  useEffect(() => {
    setMounted(true);
  }, []);

  const rawParam = searchParams.get("hospital");
  const selectedId = isKnownHospitalId(fixture, rawParam) ? rawParam : null;

  // Unknown ids fall back to unfiltered and drop the param (T-4-01).
  useEffect(() => {
    if (rawParam !== null && !isKnownHospitalId(fixture, rawParam)) {
      router.replace(pathname, { scroll: false });
    }
  }, [rawParam, router, pathname]);

  // Single-selection cross-filter with toggle; URL is the source of truth
  // so refresh, back/forward and shared links all restore context (D-16).
  // scroll:false keeps the one-screen position while cards refilter.
  const selectHospital = (id: string | null) => {
    if (id !== null && !isKnownHospitalId(fixture, id)) return;
    const next = id === selectedId ? null : id;
    router.push(
      next ? `${pathname}?hospital=${encodeURIComponent(next)}` : pathname,
      { scroll: false },
    );
  };

  const hospitalNameById = useMemo(
    () => Object.fromEntries(fixture.hospitals.map((h) => [h.id, h.name])),
    [],
  );
  const medicineNameById = useMemo(
    () => Object.fromEntries(fixture.medicines.map((m) => [m.id, m.name])),
    [],
  );
  const trendByKey = useMemo(
    () =>
      Object.fromEntries(
        fixture.inventory.map((r) => [
          `${r.hospitalId}|${r.medicineId}`,
          r.trend,
        ]),
      ),
    [],
  );

  const inScope = (hospitalId: string) =>
    selectedId === null || hospitalId === selectedId;

  const inventoryRows = useMemo(
    () => buildInventoryRows(fixture, selectedId),
    [selectedId],
  );

  const forecastRows: ForecastCardRow[] = useMemo(
    () =>
      fixture.forecast
        .filter((f) => inScope(f.hospitalId))
        .map((f) => ({
          hospitalId: f.hospitalId,
          hospitalName: hospitalNameById[f.hospitalId] ?? f.hospitalId,
          medicineName: medicineNameById[f.medicineId] ?? f.medicineId,
          mode: f.mode,
          next7: f.next7,
          avgDaily: f.avgDaily,
          // Envelope outbreak flag drives the red chip + trend note (D-08).
          outbreak:
            fixture.hospitals.find((h) => h.id === f.hospitalId)?.outbreak ??
            false,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, hospitalNameById, medicineNameById],
  );

  const shortageRows: ShortageCardRow[] = useMemo(
    () =>
      fixture.shortages
        .filter((s) => inScope(s.hospitalId))
        .map((s) => ({
          hospitalId: s.hospitalId,
          hospitalName: hospitalNameById[s.hospitalId] ?? s.hospitalId,
          medicineName: medicineNameById[s.medicineId] ?? s.medicineId,
          daysToStockout: s.daysToStockout,
          severity: s.severity,
          trend: trendByKey[`${s.hospitalId}|${s.medicineId}`] ?? [],
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, hospitalNameById, medicineNameById, trendByKey],
  );

  const expiryRows: ExpiryCardRow[] = useMemo(
    () =>
      fixture.expiries
        .filter((e) => inScope(e.hospitalId))
        .map((e) => ({
          hospitalId: e.hospitalId,
          hospitalName: hospitalNameById[e.hospitalId] ?? e.hospitalId,
          medicineName: medicineNameById[e.medicineId] ?? e.medicineId,
          qty: e.qty,
          expiryDate: e.expiryDate,
          severity: e.severity,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, hospitalNameById, medicineNameById],
  );

  const transferRows: MovesCardTransfer[] = useMemo(
    () =>
      fixture.moves
        .filter(
          (m) =>
            selectedId === null ||
            m.fromId === selectedId ||
            m.toId === selectedId,
        )
        .map((m) => ({
          fromId: m.fromId,
          fromName: hospitalNameById[m.fromId] ?? m.fromId,
          toId: m.toId,
          toName: hospitalNameById[m.toId] ?? m.toId,
          medicineName: medicineNameById[m.medicineId] ?? m.medicineId,
          qty: m.qty,
          arrivesInDays: m.arrivesInDays,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, hospitalNameById, medicineNameById],
  );

  const orderRows: MovesCardOrder[] = useMemo(
    () =>
      fixture.emergencyOrders
        .filter((o) => inScope(o.hospitalId))
        .map((o) => ({
          hospitalId: o.hospitalId,
          hospitalName: hospitalNameById[o.hospitalId] ?? o.hospitalId,
          medicineName: medicineNameById[o.medicineId] ?? o.medicineId,
          qty: o.qty,
          leadDays: o.leadDays,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, hospitalNameById],
  );

  const priorityRows: PrioritiesCardRow[] = useMemo(
    () =>
      fixture.priorities
        .filter((p) => inScope(p.hospitalId))
        .map((p) => ({
          rank: p.rank,
          hospitalId: p.hospitalId,
          hospitalName: hospitalNameById[p.hospitalId] ?? p.hospitalId,
          score: p.score,
          reasons: p.reasons,
          outbreak:
            fixture.hospitals.find((h) => h.id === p.hospitalId)?.outbreak ??
            false,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedId, hospitalNameById],
  );

  const selectedHospital = fixture.hospitals.find((h) => h.id === selectedId);

  if (fixture.hospitals.length === 0) {
    return (
      <main style={pageStyle}>
        <Header
          generatedAt={fixture.generatedAt}
          onRefresh={() => window.location.reload()}
        />
        <div
          data-testid="empty-state"
          style={{
            background: colors.cardSurface,
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 12,
            padding: spacing.xxl,
            textAlign: "center",
          }}
        >
          <h2 style={{ margin: "0 0 8px" }}>No hospitals seeded yet</h2>
          <p style={{ color: colors.textSecondary }}>
            Upload CSV in{" "}
            <a href="/data-entry" data-testid="empty-state-data-entry-link">
              data entry
            </a>{" "}
            to populate the network dashboard.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <Header
        generatedAt={fixture.generatedAt}
        onRefresh={() => window.location.reload()}
      />
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: spacing.md,
        }}
      >
        <RoleSwitcher role={role} onChange={setRole} />
      </div>
      {selectedId && selectedHospital ? (
        <div
          data-testid="filter-banner"
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing.sm,
            marginBottom: spacing.md,
            fontSize: 13,
          }}
        >
          <span>
            Filtered to <strong>{selectedHospital.name}</strong>
          </span>
          <button
            data-testid="clear-filter"
            type="button"
            onClick={() => selectHospital(null)}
            style={{
              background: "transparent",
              border: `1px solid ${colors.cardBorder}`,
              borderRadius: 999,
              padding: "2px 12px",
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      ) : null}
      {!mounted ? (
        <div data-testid="loading-skeletons" style={loadingGridStyle}>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <DashboardGrid
          cards={[
            <InventoryCard
              key="inventory"
              rows={inventoryRows}
              onSelectHospital={selectHospital}
              scope={selectedHospital?.name ?? null}
            />,
            <ForecastCard
              key="forecast"
              rows={forecastRows}
              mape={fixture.mape}
              advisoryLabel={fixture.advisory.label}
              onSelectHospital={selectHospital}
            />,
            <ShortageCard
              key="shortage"
              rows={shortageRows}
              onSelectHospital={selectHospital}
            />,
            <ExpiryCard
              key="expiry"
              rows={expiryRows}
              onSelectHospital={selectHospital}
            />,
            <MovesCard
              key="moves"
              transfers={transferRows}
              orders={orderRows}
              onSelectHospital={selectHospital}
              role={role}
              ownHospitalId={ownHospitalId}
            />,
            <PrioritiesCard
              key="priorities"
              rows={priorityRows}
              onSelectHospital={selectHospital}
            />,
          ]}
        />
      )}
      <HospitalPanel
        hospitalId={selectedId}
        hospitalName={selectedHospital?.name}
        onClose={() => selectHospital(null)}
        onSelectHospital={selectHospital}
        role={role}
        ownHospitalId={ownHospitalId}
      />
      {/* Chat dock collapses to a floating button while the drill-in
          panel is open so the two never collide (D-17). */}
      <ChatPanel
        contextHospitalId={selectedId}
        drillInOpen={selectedId !== null}
      />
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: layout.maxWidthPx,
  margin: "0 auto",
  padding: spacing.xl,
};

const loadingGridStyle: React.CSSProperties = {
  display: "grid",
  gap: spacing.lg,
};

export default function Page() {
  return (
    <Suspense fallback={<SkeletonCard testId="page-suspense-fallback" />}>
      <Dashboard />
    </Suspense>
  );
}
