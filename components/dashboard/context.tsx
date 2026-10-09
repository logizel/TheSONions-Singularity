"use client";

import { createContext, useContext } from "react";

import type { ResultsJSON } from "@/lib/contracts";
import type { Order, TransferOrderMatch } from "@/lib/orders";
import type { RouteState } from "../orders/useRoutes";

export interface DashboardCtx {
  results: ResultsJSON;
  medName: (id: string) => string;
  hospName: (id: string) => string;
  /** "tablets" / "tablet" for a quantity of this medicine. */
  unit: (medicineId: string, qty: number) => string;
  selectedId: string | null;
  selectHospital: (id: string) => void;
  role: "network_admin" | "hospital_admin";
  ownHospitalId: string | null;
  /** null = order store unavailable. */
  orders: Order[] | null;
  orderFor: (t: { fromHospital: string; toHospital: string; medicineId: string }) => TransferOrderMatch | null;
  openCart: () => void;
  /** Open the manual stock entry sheet, optionally pre-selecting a hospital. */
  openStock: (hospitalId?: string) => void;
  track: (orderId: string) => void;
  routes: Record<string, RouteState>;
}

const Ctx = createContext<DashboardCtx | null>(null);

export const DashboardProvider = Ctx.Provider;

export function useDash(): DashboardCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error("useDash outside DashboardProvider");
  return v;
}
