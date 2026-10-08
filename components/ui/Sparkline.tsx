import styles from "./ui.module.css";

/** 7-day usage sparkline (aria-hidden; the sentence beside it carries the data). */
export function Sparkline({ values, width = 56, height = 16 }: { values: readonly number[]; width?: number; height?: number }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`);
  return (
    <svg className={styles.spark} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" focusable="false">
      <polyline points={pts.join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export function sparkSentence(values: readonly number[]): string {
  return `7-day usage, oldest first: ${values.join(", ")}.`;
}
