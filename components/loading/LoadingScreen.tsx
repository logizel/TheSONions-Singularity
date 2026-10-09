/**
 * Branded loading screen (app/loading.tsx). The theme is the name: in the
 * Ramayana, Hanuman carried a life-saving herb over the mountains to revive
 * Lakshmana. Sanjeevini does the same job for a hospital network, so the
 * scene is that herb growing on the mountain, and below it a hospital with
 * spare stock (OK ring) sending a leaf to a hospital that is running out
 * (critical diamond), which then turns OK: the product's whole loop.
 * Server component, pure CSS motion, all of it switched off for
 * prefers-reduced-motion (the herb and route are then shown still).
 */
import { Tiro_Devanagari_Hindi } from "next/font/google";

import styles from "./loading.module.css";

// Used only on this screen, so only this route preloads it.
const devanagari = Tiro_Devanagari_Hindi({ subsets: ["devanagari"], weight: "400", display: "swap" });

/** A leaf pointing along +x from its base at the origin (20 long). */
const LEAF = "M0 0 C5 -6 14 -6 20 0 C14 6 5 6 0 0Z";
const VEIN = "M2 0 L16 0";

function Leaf({ x, y, rotate, scale, className }: { x: number; y: number; rotate: number; scale: number; className: string }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rotate}) scale(${scale})`}>
      <g className={`${styles.leaf} ${className}`}>
        <path d={LEAF} fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth={1} strokeLinejoin="round" />
        <path d={VEIN} stroke="var(--color-surface)" strokeWidth={1} strokeLinecap="round" fill="none" />
      </g>
    </g>
  );
}

/** Same shapes as the map markers: OK = hollow ring, Critical = filled diamond. */
function OkRing({ cx, cy, className }: { cx: number; cy: number; className?: string }) {
  return (
    <g className={className}>
      <circle cx={cx} cy={cy} r={10} fill="none" stroke="var(--color-surface)" strokeWidth={6} />
      <circle cx={cx} cy={cy} r={10} fill="none" stroke="var(--color-ink)" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={7.5} fill="var(--color-surface)" stroke="var(--risk-ok)" strokeWidth={3} />
    </g>
  );
}

function CriticalDiamond({ cx, cy, className }: { cx: number; cy: number; className?: string }) {
  const d = `M${cx} ${cy - 12} L${cx + 12} ${cy} L${cx} ${cy + 12} L${cx - 12} ${cy} Z`;
  return (
    <g className={className}>
      <path d={d} fill="none" stroke="var(--color-surface)" strokeWidth={6} strokeLinejoin="round" />
      <path d={d} fill="var(--risk-critical)" stroke="var(--color-ink)" strokeWidth={2} strokeLinejoin="round" />
      <path d={`M${cx} ${cy - 6.5} v6.5 M${cx} ${cy + 4.5} v.8`} stroke="var(--color-surface)" strokeWidth={2.6} strokeLinecap="round" />
    </g>
  );
}

export function LoadingScreen() {
  return (
    <main className={styles.screen} role="status" aria-live="polite" data-testid="loading-skeletons">
      <div className={styles.stage}>
        <svg className={styles.scene} viewBox="0 0 320 190" aria-hidden="true" focusable="false">
          <defs>
            <pattern id="sj-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="var(--color-ink-3)" strokeWidth="0.8" />
            </pattern>
            <clipPath id="sj-sky">
              <rect x="0" y="0" width="320" height="176" />
            </clipPath>
          </defs>
          {/* terrain contours */}
          <g className={styles.contours} fill="none" clipPath="url(#sj-sky)">
            <ellipse cx="160" cy="150" rx="152" ry="96" />
            <ellipse cx="160" cy="150" rx="118" ry="72" />
            <ellipse cx="160" cy="150" rx="84" ry="50" />
          </g>
          {/* the mountain */}
          <path d="M10 176 L74 128 L110 146 L160 92 L214 140 L248 118 L310 176 Z" fill="var(--color-sunk)" stroke="var(--color-ink)" strokeWidth={1.5} strokeLinejoin="round" />
          <path d="M160 92 L214 140 L248 118 L310 176 L160 176 Z" fill="url(#sj-hatch)" opacity={0.55} />
          <path d="M10 176 L310 176" stroke="var(--color-ink)" strokeWidth={1.5} />
          {/* life pulse from the herb tip */}
          <circle className={styles.pulse} cx="160" cy="26" r="8" fill="none" stroke="var(--color-accent)" strokeWidth={1.5} />
          {/* the herb */}
          <g fill="none" stroke="var(--color-accent-strong)" strokeWidth={2} strokeLinecap="round">
            <path className={styles.stem} pathLength={1} d="M160 92 C159 76 161 58 160 28" />
            <path className={styles.branch1} pathLength={1} d="M160 62 C170 60 177 55 182 46" />
            <path className={styles.branch2} pathLength={1} d="M160 70 C150 68 142 63 137 54" />
            <path className={styles.branch3} pathLength={1} d="M160 80 C169 80 176 76 181 69" />
            <path className={styles.branch4} pathLength={1} d="M160 84 C151 85 144 82 139 76" />
          </g>
          <Leaf x={160} y={28} rotate={-90} scale={1.2} className={styles.l1} />
          <Leaf x={182} y={46} rotate={-35} scale={1.1} className={styles.l2} />
          <Leaf x={137} y={54} rotate={-150} scale={1.1} className={styles.l3} />
          <Leaf x={181} y={69} rotate={-25} scale={0.9} className={styles.l4} />
          <Leaf x={139} y={76} rotate={-165} scale={0.9} className={styles.l5} />
        </svg>

        <svg className={styles.route} viewBox="0 0 320 56" aria-hidden="true" focusable="false">
          <path d="M54 22 H266" stroke="var(--color-ink-3)" strokeWidth={2} strokeDasharray="4 6" fill="none" />
          <OkRing cx={36} cy={22} />
          {/* receiving hospital: critical, then covered */}
          <CriticalDiamond cx={284} cy={22} className={styles.needs} />
          <OkRing cx={284} cy={22} className={styles.covered} />
          {/* the herb, carried across */}
          <g transform="translate(54 22)">
            <g className={styles.carry}>
              <g transform="translate(-10 0)">
                <path d={LEAF} transform="scale(1.1)" fill="var(--color-accent)" stroke="var(--color-ink)" strokeWidth={1} strokeLinejoin="round" />
              </g>
            </g>
          </g>
          <g fontFamily="var(--font-body), sans-serif" fontSize={12} fontWeight={600} fill="var(--color-ink)" textAnchor="middle">
            <text x={36} y={52}>Has stock</text>
            <text x={284} y={52} className={styles.needs}>
              Running out
            </text>
            <text x={284} y={52} className={styles.covered}>
              Covered
            </text>
          </g>
        </svg>

        <div className={styles.words}>
          <h1 className={styles.wordmark}>Sanjeevini</h1>
          <p className={`${styles.deva} ${devanagari.className}`} lang="sa">
            संजीविनी
          </p>
          <p className={styles.meaning}>Sanskrit for that which restores life.</p>
          <p className={styles.story}>
            In the Ramayana, Hanuman carried a life-saving herb over the mountains to revive Lakshmana. Sanjeevini moves medicine between hospitals the same
            way.
          </p>
        </div>

        <div className={styles.status}>
          <span className={styles.statusLabel}>Loading network results</span>
          <span className={styles.track} aria-hidden="true">
            <span className={styles.bar} />
          </span>
        </div>
      </div>
    </main>
  );
}
