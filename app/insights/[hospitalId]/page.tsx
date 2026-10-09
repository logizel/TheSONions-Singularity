import { notFound, redirect } from "next/navigation";

import { HospitalInsights } from "@/components/insights/HospitalInsights";
import { loadHospitalHistory } from "@/lib/insights/history";
import { buildHospitalInsight } from "@/lib/insights/view";
import { getResults } from "@/lib/network";
import { getSession } from "@/lib/session/server";

export const metadata = { title: "Hospital insights · Sanjeevini" };

// One hospital's charts. A hospital admin may only open its own hospital;
// anything else redirects to it (enforced here, not just hidden in the UI).
export default async function HospitalInsightsPage({ params }: { params: Promise<{ hospitalId: string }> }) {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const { hospitalId } = await params;
  if (session.role === "hospital_admin" && hospitalId !== session.hospitalId) redirect(`/insights/${session.hospitalId}`);

  const envelope = await getResults();
  if (!envelope) return <p>Network data unavailable. Try again in a minute.</p>;
  const r = envelope.results;
  if (!r.hospitals.some((h) => h.hospitalId === hospitalId)) notFound();

  const meds = r.inventory.filter((e) => e.hospitalId === hospitalId).map((e) => e.medicineId);
  const history = await loadHospitalHistory(hospitalId, r.historyWindow, meds).catch(() => null);
  const insight = buildHospitalInsight(r, hospitalId, history);
  if (!insight) notFound();

  return (
    <HospitalInsights
      h={insight}
      hospitalNames={Object.fromEntries(r.hospitals.map((h) => [h.hospitalId, h.hospitalName]))}
      canSeeAll={session.role === "network_admin"}
    />
  );
}
