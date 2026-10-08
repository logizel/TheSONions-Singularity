"use client";

import { dShort } from "@/lib/dashboard/panel";
import { hospitalRisk } from "@/lib/dashboard/view";
import type { HospitalLocation } from "@/lib/hospital-locations";
import { OutbreakTag, RiskTag } from "../ui/Tag";
import { useDash } from "./context";
import styles from "./list.module.css";

const SEV = { critical: "critical", low: "warning", ok: "ok" } as const;
const ORDER = { critical: 0, low: 1, ok: 2 } as const;

/** Non-map alternative (`?view=list`): same information as the markers, plus more. */
export function HospitalList({ locations }: { locations: readonly HospitalLocation[] }) {
  const { results, medName, selectedId, selectHospital } = useDash();
  const list = results.hospitals
    .map((h) => ({ h, risk: hospitalRisk(results, h.hospitalId), loc: locations.find((l) => l.id === h.hospitalId) ?? null }))
    .sort((a, b) => ORDER[a.risk.level] - ORDER[b.risk.level] || a.h.hospitalName.localeCompare(b.h.hospitalName));

  return (
    <div className={styles.wrap} data-testid="hospital-list">
      <table className={styles.table}>
        <caption className={styles.caption}>{list.length} hospitals, worst first. Select a hospital to open it.</caption>
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Hospital</th>
            <th scope="col">Lowest cover</th>
            <th scope="col">Lead</th>
            <th scope="col">Positions</th>
            <th scope="col">Outbreak</th>
            <th scope="col">Top priority</th>
            <th scope="col">Moves</th>
          </tr>
        </thead>
        <tbody>
          {list.map(({ h, risk, loc }) => {
            const inv = results.inventory.filter((e) => e.hospitalId === h.hospitalId);
            const lowest = [...inv].sort((a, b) => a.daysUntilStockout - b.daysUntilStockout)[0];
            const worst = risk.worst ?? lowest;
            const crit = inv.filter((e) => e.severity === "critical").length;
            const low = inv.filter((e) => e.severity === "warning").length;
            const top = results.priorities.filter((p) => p.hospitalId === h.hospitalId).sort((a, b) => a.rank - b.rank)[0];
            const ins = results.transfers.filter((t) => t.toHospital === h.hospitalId).length;
            const outs = results.transfers.filter((t) => t.fromHospital === h.hospitalId).length;
            const selected = selectedId === h.hospitalId;
            return (
              <tr key={h.hospitalId} className={selected ? styles.selected : undefined}>
                <td>
                  <RiskTag severity={SEV[risk.level]} />
                </td>
                <td>
                  <button
                    type="button"
                    className={styles.rowButton}
                    aria-pressed={selected}
                    onClick={() => selectHospital(h.hospitalId)}
                    data-testid={`hospital-list-row-${h.hospitalId}`}
                  >
                    {h.hospitalName}
                  </button>
                  <span className={styles.addr}>{loc?.address ?? "No position on file"}</span>
                </td>
                <td data-label="Lowest cover">{worst ? `${medName(worst.medicineId)} ${dShort(worst.daysUntilStockout)}` : "—"}</td>
                <td data-label="Lead">{worst ? dShort(worst.leadDays) : "—"}</td>
                <td data-label="Positions">
                  {crit} critical · {low} low
                </td>
                <td data-label="Outbreak">{h.outbreak ? <OutbreakTag /> : "—"}</td>
                <td data-label="Top priority">{top ? `#${top.rank} · ${top.score}` : "—"}</td>
                <td data-label="Moves">
                  {ins} in · {outs} out
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
