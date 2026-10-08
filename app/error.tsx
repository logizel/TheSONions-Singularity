"use client";

import styles from "@/components/dashboard/dashboard.module.css";

// Route-level error boundary. Copy per 06-UI-SPEC.
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className={styles.fullState}>
      <h1 className={styles.stateHeading}>The dashboard failed to render</h1>
      <p>Reload the page. Stock data is unaffected.</p>
      <button type="button" className={styles.outlineButton} onClick={() => reset()}>
        Reload
      </button>
    </main>
  );
}
