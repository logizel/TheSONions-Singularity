import { redirect } from "next/navigation";

import { listHospitals } from "@/lib/hospital-locations";
import { demoAuthEnabled } from "@/lib/session";
import { getSession } from "@/lib/session/server";
import { SignInForm } from "./SignInForm";
import styles from "./sign-in.module.css";

export const metadata = { title: "Demo sign-in · Hospital Stock Balancer" };

// Demo sign-in (D-13): role + hospital, no password. Enabled only with
// DEMO_AUTH=true; otherwise the page explains how to turn it on.
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  if (await getSession()) redirect("/");
  const nextParam = (await searchParams).next;
  const next = typeof nextParam === "string" ? nextParam : "/";

  const enabled = demoAuthEnabled();
  let hospitals: { id: string; name: string }[] = [];
  let hospitalsError = false;
  if (enabled) {
    try {
      hospitals = await listHospitals();
    } catch {
      hospitalsError = true;
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="signin-heading">
        <p className={styles.kicker}>Hospital Stock Balancer</p>
        <h1 id="signin-heading" className={styles.heading}>
          Demo sign-in
        </h1>
        <p className={styles.body}>Prototype access. Pick a role. No password.</p>
        {enabled ? (
          <SignInForm hospitals={hospitals} hospitalsError={hospitalsError} next={next} />
        ) : (
          <p className={styles.disabled} data-testid="signin-disabled">
            Demo sign-in is off. Set DEMO_AUTH=true on the server to enable it.
          </p>
        )}
      </section>
    </main>
  );
}
