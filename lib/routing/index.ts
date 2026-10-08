/**
 * Road routing between two hospitals (Phase 6, D-06) via an OSRM server.
 *
 * OSRM speaks [lng, lat] (URL and GeoJSON geometry); everything this module
 * returns is Leaflet order [lat, lng]. Results are cached in memory per
 * from/to pair. On any OSRM failure the caller still gets a straight line
 * with haversine distance, flagged `approximate: true`.
 *
 * The default base URL is the public OSRM demo server: fair-use only, no SLA,
 * fine for a prototype demo, not for production traffic. Override with
 * ROUTING_BASE_URL (e.g. a self-hosted OSRM).
 */
import { haversineM, isValidLatLng, type LatLng, type LatLngTuple } from '../geo';

export const DEFAULT_ROUTING_BASE_URL = 'https://router.project-osrm.org';
export const ROUTE_TIMEOUT_MS = 5000;
/** Bound the in-memory cache; with a handful of hospitals this never fills. */
export const ROUTE_CACHE_MAX = 200;

export interface RouteResult {
  /** Road (or straight-line when approximate) distance in metres. */
  distanceM: number;
  /** Road drive time in seconds; null when approximate (no road data). */
  durationS: number | null;
  /** Polyline in Leaflet order [lat, lng]. */
  path: LatLngTuple[];
  /** True when OSRM was unavailable and this is a straight line. */
  approximate: boolean;
}

/** Accepts only absolute http(s) URLs; anything else falls back to the default. */
export function routingBaseUrl(raw: string | undefined): string {
  if (raw) {
    try {
      const u = new URL(raw);
      if (u.protocol === 'https:' || u.protocol === 'http:') return u.toString().replace(/\/+$/, '');
    } catch {
      // fall through to the default
    }
  }
  return DEFAULT_ROUTING_BASE_URL;
}

/** OSRM route URL. NOTE the lng,lat order OSRM expects. */
export function osrmRouteUrl(baseUrl: string, from: LatLng, to: LatLng): string {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  return `${baseUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson`;
}

/** Parses an OSRM /route response; null unless it is a usable route. */
export function parseOsrmRoute(json: unknown): RouteResult | null {
  if (typeof json !== 'object' || json === null) return null;
  const body = json as { code?: unknown; routes?: unknown };
  if (body.code !== 'Ok' || !Array.isArray(body.routes) || body.routes.length === 0) return null;
  const route = body.routes[0] as { distance?: unknown; duration?: unknown; geometry?: unknown };
  const { distance, duration } = route;
  if (typeof distance !== 'number' || !Number.isFinite(distance) || distance < 0) return null;
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration < 0) return null;
  const coords = (route.geometry as { coordinates?: unknown } | undefined)?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const path: LatLngTuple[] = [];
  for (const c of coords) {
    if (!Array.isArray(c) || c.length < 2) return null;
    const [lng, lat] = c as unknown[]; // GeoJSON order -> flip below
    if (!isValidLatLng(lat, lng)) return null;
    path.push([lat as number, lng as number]);
  }
  return { distanceM: distance, durationS: duration, path, approximate: false };
}

/** Fallback when no road route is available: straight line, haversine length. */
export function straightLineRoute(from: LatLng, to: LatLng): RouteResult {
  return {
    distanceM: haversineM(from, to),
    durationS: null,
    path: [
      [from.lat, from.lng],
      [to.lat, to.lng],
    ],
    approximate: true,
  };
}

export interface RouterOptions {
  fetch?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
}

export interface RouteEndpoint extends LatLng {
  id: string;
}

/**
 * Creates a router with its own pair cache. Only real OSRM results are
 * cached; fallbacks are recomputed so a recovered OSRM is picked up.
 */
export function createRouter(opts: RouterOptions = {}) {
  const doFetch = opts.fetch ?? fetch;
  const baseUrl = opts.baseUrl ?? DEFAULT_ROUTING_BASE_URL;
  const timeoutMs = opts.timeoutMs ?? ROUTE_TIMEOUT_MS;
  const cache = new Map<string, RouteResult>();

  async function getRoute(from: RouteEndpoint, to: RouteEndpoint): Promise<RouteResult> {
    const key = `${from.id}->${to.id}`;
    const hit = cache.get(key);
    if (hit) return hit;
    try {
      const res = await doFetch(osrmRouteUrl(baseUrl, from, to), {
        signal: AbortSignal.timeout(timeoutMs),
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (res.ok) {
        const parsed = parseOsrmRoute(await res.json());
        if (parsed) {
          if (cache.size >= ROUTE_CACHE_MAX) {
            const oldest = cache.keys().next().value;
            if (oldest !== undefined) cache.delete(oldest);
          }
          cache.set(key, parsed);
          return parsed;
        }
      }
    } catch {
      // network error, timeout or bad JSON: fall back below
    }
    return straightLineRoute(from, to);
  }

  return { getRoute, cacheSize: () => cache.size };
}
