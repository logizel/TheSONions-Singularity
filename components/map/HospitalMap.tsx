"use client";

/**
 * Leaflet hospital map (Phase 6, 06-UI-SPEC Map Contract). Client-only:
 * loaded through next/dynamic with ssr:false by MapView. Custom L.divIcon
 * markers (no default-icon path issues under the bundler), OSM attribution
 * always on, controls kept clear of floating UI via CSS inset variables.
 */
import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polyline, TileLayer, ZoomControl, useMap } from "react-leaflet";

import { bearingAlongPath, type LatLngTuple, type LeafletBounds } from "@/lib/geo";
import type { MapHospital } from "@/lib/dashboard/view";
import { colors } from "@/theme/tokens";
import { arrowHtml, markerHtml, vehicleHtml } from "./markerHtml";
import styles from "./map.module.css";
import type { Connector, HospitalMapProps, MapInsets, RouteLine, TrackingOverlay } from "./types";

const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

function padding(insets: MapInsets): { paddingTopLeft: L.PointExpression; paddingBottomRight: L.PointExpression } {
  return {
    paddingTopLeft: [insets.left + 24, insets.top + 24],
    paddingBottomRight: [insets.right + 24, insets.bottom + 72],
  };
}

/** Refits when the target bounds or the floating-UI insets change; pans to a new selection. */
function Viewport({
  fitBounds,
  insets,
  selected,
  reducedMotion,
}: {
  fitBounds: LeafletBounds;
  insets: MapInsets;
  selected: MapHospital | null;
  reducedMotion: boolean;
}) {
  const map = useMap();
  const fitKey = JSON.stringify([fitBounds, insets]);
  useEffect(() => {
    map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  }, [map]);
  useEffect(() => {
    map.fitBounds(fitBounds, { ...padding(insets), animate: false, maxZoom: 15 });
    // fitKey captures bounds + insets by value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, fitKey]);
  const selId = selected?.id ?? null;
  useEffect(() => {
    if (!selected) return;
    map.panInside([selected.lat, selected.lng], { ...padding(insets), animate: !reducedMotion, duration: 0.4 });
    // pan only when the selection changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selId]);
  return null;
}

function HospitalMarker({
  h,
  selected,
  onSelect,
}: {
  h: MapHospital;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  const ref = useRef<L.Marker | null>(null);
  // The icon depends only on risk/outbreak/name/events; selection toggles a
  // class on the same element so keyboard focus survives a selection change.
  const eventsKey = h.events.map((e) => `${e.eventId}:${e.type}`).join(",");
  const icon = useMemo(
    () => L.divIcon({ className: styles.marker, html: markerHtml(h, styles), iconSize: [44, 44], iconAnchor: [22, 22] }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [h.risk, h.outbreak, h.name, eventsKey],
  );
  const sync = useCallback(() => {
    const el = ref.current?.getElement();
    if (!el) return;
    el.setAttribute("aria-label", `${h.label}${selected ? ", selected" : ""}`);
    el.setAttribute("aria-pressed", String(selected));
    el.setAttribute("data-testid", `map-marker-${h.id}`);
    el.removeAttribute("title");
    el.classList.toggle(styles.selected, selected);
    el.classList.toggle(styles.outbreak, h.outbreak);
  }, [h.label, h.id, h.outbreak, selected]);
  useEffect(sync);

  return (
    <Marker
      ref={ref}
      position={[h.lat, h.lng]}
      icon={icon}
      keyboard
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={{
        add: sync,
        click: () => onSelect(h.id),
        keydown: (e: L.LeafletKeyboardEvent) => {
          const k = e.originalEvent.key;
          if (k === "Enter" || k === " ") {
            e.originalEvent.preventDefault();
            onSelect(h.id);
          }
        },
      }}
    />
  );
}

function ConnectorLine({ c }: { c: Connector }) {
  const path: LatLngTuple[] = [c.from, c.to];
  const at: LatLngTuple = [c.from[0] + (c.to[0] - c.from[0]) * 0.6, c.from[1] + (c.to[1] - c.from[1]) * 0.6];
  const bearing = bearingAlongPath(path, 0.6);
  const icon = useMemo(
    () => L.divIcon({ className: styles.arrow, html: arrowHtml(styles), iconSize: [12, 12], iconAnchor: [6, 6] }),
    [],
  );
  const ref = useRef<L.Marker | null>(null);
  useEffect(() => {
    ref.current?.getElement()?.style.setProperty("--bearing", `${bearing}deg`);
  });
  return (
    <>
      <Polyline
        positions={path}
        interactive={false}
        pathOptions={{ color: colors.ink3, weight: 2, dashArray: "4 6", className: styles.connector }}
      />
      <Marker ref={ref} position={at} icon={icon} interactive={false} keyboard={false} />
    </>
  );
}

function CartRoute({ r }: { r: RouteLine }) {
  return (
    <>
      <Polyline positions={r.path} interactive={false} pathOptions={{ color: colors.surface, weight: r.focused ? 8 : 6, opacity: 1 }} />
      <Polyline
        positions={r.path}
        interactive={false}
        pathOptions={{
          color: r.focused ? colors.accent : colors.ink3,
          weight: r.focused ? 4 : 3,
          dashArray: r.approximate ? "8 8" : undefined,
        }}
      />
    </>
  );
}

function Vehicle({ v, reducedMotion }: { v: NonNullable<TrackingOverlay["vehicle"]>; reducedMotion: boolean }) {
  const ref = useRef<L.Marker | null>(null);
  const icon = useMemo(
    () => L.divIcon({ className: styles.vehicle, html: vehicleHtml(styles), iconSize: [44, 44], iconAnchor: [22, 22] }),
    [],
  );
  const lastLabelAt = useRef(0);
  useEffect(() => {
    const m = ref.current;
    if (!m) return;
    m.setLatLng(v.position);
    const el = m.getElement();
    if (!el) return;
    el.style.setProperty("--bearing", `${v.bearing}deg`);
    el.setAttribute("data-testid", "sim-vehicle");
    el.classList.toggle(styles.noTween, reducedMotion);
    // Screen-reader label updates at most every 10 s.
    const now = Date.now();
    if (now - lastLabelAt.current > 10_000 || !el.getAttribute("aria-label")) {
      el.setAttribute("aria-label", v.label);
      el.setAttribute("role", "img");
      lastLabelAt.current = now;
    }
  });
  return <Marker ref={ref} position={v.position} icon={icon} interactive={false} keyboard={false} zIndexOffset={2000} />;
}

function Tracking({ t, reducedMotion }: { t: TrackingOverlay; reducedMotion: boolean }) {
  const full = [...t.travelled, ...t.remaining.slice(1)];
  return (
    <>
      <Polyline positions={full} interactive={false} pathOptions={{ color: colors.surface, weight: 8, opacity: 1 }} />
      {t.remaining.length > 1 ? (
        <Polyline
          positions={t.remaining}
          interactive={false}
          pathOptions={{ color: colors.accent, weight: 4, dashArray: t.approximate ? "8 8" : undefined }}
        />
      ) : null}
      {t.travelled.length > 1 ? (
        <Polyline positions={t.travelled} interactive={false} pathOptions={{ color: colors.ink, weight: 4 }} />
      ) : null}
      {t.vehicle ? <Vehicle v={t.vehicle} reducedMotion={reducedMotion} /> : null}
    </>
  );
}

export default function HospitalMap(props: HospitalMapProps) {
  const { hospitals, selectedId, onSelect, fitBounds, insets, connectors, routes, tracking, reducedMotion, tileUrl } = props;
  const selected = hospitals.find((h) => h.id === selectedId) ?? null;
  const insetVars = {
    "--map-inset-top": `${insets.top}px`,
    "--map-inset-left": `${insets.left}px`,
    "--map-inset-right": `${insets.right}px`,
    "--map-inset-bottom": `${insets.bottom}px`,
  } as React.CSSProperties;

  return (
    <div className={styles.wrap} style={insetVars}>
      <MapContainer
        className={styles.map}
        bounds={fitBounds}
        boundsOptions={padding(insets)}
        zoomControl={false}
        minZoom={11}
        maxZoom={18}
        zoomAnimation={!reducedMotion}
        markerZoomAnimation={!reducedMotion}
        fadeAnimation={!reducedMotion}
      >
        <TileLayer url={tileUrl} attribution={ATTRIBUTION} maxZoom={19} />
        <ZoomControl position="topright" />
        <Viewport fitBounds={fitBounds} insets={insets} selected={selected} reducedMotion={reducedMotion} />
        {connectors.map((c) => (
          <ConnectorLine key={c.key} c={c} />
        ))}
        {routes.map((r) => (
          <CartRoute key={r.key} r={r} />
        ))}
        {tracking ? <Tracking t={tracking} reducedMotion={reducedMotion} /> : null}
        {hospitals.map((h) => (
          <HospitalMarker key={h.id} h={h} selected={h.id === selectedId} onSelect={onSelect} />
        ))}
      </MapContainer>
    </div>
  );
}
