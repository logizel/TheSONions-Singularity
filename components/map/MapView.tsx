"use client";

import dynamic from "next/dynamic";

import styles from "./map.module.css";
import type { HospitalMapProps } from "./types";

// Leaflet touches window at import time: client-only, never prerendered.
const HospitalMap = dynamic(() => import("./HospitalMap"), {
  ssr: false,
  loading: () => (
    <div className={styles.wrap}>
      <p className="sr-only">Loading map</p>
    </div>
  ),
});

export function MapView(props: HospitalMapProps) {
  return <HospitalMap {...props} />;
}
