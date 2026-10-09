import { redirect } from "next/navigation";

import { InsightsGrid } from "@/components/insights/InsightsGrid";
import { niceDate } from "@/lib/insights/explain";
import { buildHospitalCards } from "@/lib/insights/view";
import { getResults } from "@/lib/network";
import { getSession } from "@/lib/session/server";

export const metadata = { title: "Insights · Sanjeevini" };

// Network admin: one card per hospital. Hospital admin: straight to its own.
export default async function InsightsPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  if (session.role === "hospital_admin") redirect(`/insights/${session.hospitalId}`);
  const envelope = await getResults();
  if (!envelope) return <p>Network data unavailable. Try again in a minute.</p>;
  return <InsightsGrid cards={buildHospitalCards(envelope.results)} asOf={niceDate(envelope.results.asOf)} />;
}
