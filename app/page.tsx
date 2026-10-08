import { redirect } from "next/navigation";

import { Dashboard } from "@/components/dashboard/Dashboard";
import { getHospitalLocations, type HospitalLocationsResponse } from "@/lib/hospital-locations";
import { getResults } from "@/lib/network";
import { visibleOrders, type Order } from "@/lib/orders";
import { listOrders } from "@/lib/orders/store";
import { demoAuthEnabled } from "@/lib/session";
import { getSession } from "@/lib/session/server";

// Map-first dashboard (Phase 6). Server side: session gate, then the one
// ResultsJSON snapshot (D-02), hospital positions and the orders this
// session may read, loaded in parallel. Refresh = router.refresh().
export default async function Page() {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const [envelope, locations, orders] = await Promise.all([
    getResults(),
    getHospitalLocations().catch((): HospitalLocationsResponse | null => null),
    listOrders().then(
      (all): Order[] | null => visibleOrders(all, session.role, session.hospitalId),
      (): Order[] | null => null,
    ),
  ]);

  return (
    <Dashboard
      results={envelope?.results ?? null}
      source={envelope?.source ?? null}
      locations={locations}
      orders={orders}
      session={{ role: session.role, hospitalId: session.hospitalId ?? null }}
      demoAuth={demoAuthEnabled()}
      tileUrl={process.env.NEXT_PUBLIC_TILE_URL || "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"}
    />
  );
}
