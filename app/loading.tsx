import styles from "@/components/dashboard/dashboard.module.css";

// Static skeleton while the server loads results (no shimmer, per spec).
export default function Loading() {
  return (
    <div className={styles.root}>
      <div className={styles.mapLoading}>Loading map</div>
      <div className={styles.panel} data-testid="loading-skeletons">
        <span className="sr-only">Loading network results</span>
        <div className={styles.skeletonBoard} aria-hidden="true">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
        <div className={styles.skeletonRows} aria-hidden="true">
          {Array.from({ length: 7 }, (_, i) => (
            <span key={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
