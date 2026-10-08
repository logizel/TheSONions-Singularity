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
import { InventoryCard, type InventoryCardRow } from "@/components/cards/InventoryCard";
import { SkeletonCard } from "@/components/cards/ui";
import { HospitalPanel } from "@/components/panel/HospitalPanel";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { colors, layout, spacing } from "@/theme/tokens";

const fixture = fixtureJson as ResultsFixture;

function buildInventoryRows(
  data: ResultsFixture,
  selectedId: string | null,
): InventoryCardRow[] {
  return data.hospitals.map((h) => {
    const rows = data.inventory.filter((r) => r.hospitalId === h.id);
    const totalStock = rows.reduce((sum, r) => sum + r.stock, 0);
    const minDaysToStockout = rows.reduce(
      (min, r) => Math.min(min, r.daysToStockout),
      Number.POSITIVE_INFINITY,
    );
    const leadDays = Math.max(
      ...data.leadDays
        .filter((l) => l.hospitalId === h.id)
        .map((l) => l.days),
      0,
    );
    const bufferDays = Math.max(
      ...data.medicines.map((m) => m.bufferDays),
      0,
    );
    const trend = rows[0]?.trend ?? [];
    return {
      hospitalId: h.id,
      hospitalName: h.name,
      totalStock,
      minDaysToStockout:
        minDaysToStockout === Number.POSITIVE_INFINITY ? 0 : minDaysToStockout,
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

  useEffect(() => {
    setMounted(true);
  }, []);

  const rawParam = searchParams.get("hospital");
  const selectedId = isKnownHospitalId(fixture, rawParam) ? rawParam : null;

  // Unknown ids fall back to unfiltered and drop the param (T-4-01).
  useEffect(() => {
    if (rawParam !== null && !isKnownHospitalId(fixture, rawParam)) {
      router.replace(pathname);
    }
  }, [rawParam, router, pathname]);

  const selectHospital = (id: string | null) => {
    if (id !== null && !isKnownHospitalId(fixture, id)) return;
    router.push(id ? `${pathname}?hospital=${encodeURIComponent(id)}` : pathname);
  };

  const inventoryRows = useMemo(
    () => buildInventoryRows(fixture, selectedId),
    [selectedId],
  );
  const visibleInventoryRows = useMemo(
    () =>
      selectedId
        ? inventoryRows.filter((r) => r.hospitalId === selectedId)
        : inventoryRows,
    [inventoryRows, selectedId],
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
        <div data-testid="loading-skeletons" style={gridStyle}>
          {Array.from({ length: 6 }, (_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div style={gridStyle}>
          <InventoryCard
            rows={visibleInventoryRows}
            onSelectHospital={selectHospital}
          />
        </div>
      )}
      <HospitalPanel
        hospitalId={selectedId}
        hospitalName={selectedHospital?.name}
        onClose={() => selectHospital(null)}
        onSelectHospital={selectHospital}
      />
      <ChatPanel contextHospitalId={selectedId} />
    </main>
  );
}

const pageStyle: React.CSSProperties = {
  maxWidth: layout.maxWidthPx,
  margin: "0 auto",
  padding: spacing.xl,
};

const gridStyle: React.CSSProperties = {
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
