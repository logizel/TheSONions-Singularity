/**
 * Routing tests: OSRM URL order (lng,lat), response parsing with the flip to
 * Leaflet [lat, lng], straight-line fallback, and the per-pair cache. No
 * network: fetch is injected.
 */
import { describe, expect, it, vi } from 'vitest';
import { haversineM } from '../geo';
import {
  DEFAULT_ROUTING_BASE_URL,
  createRouter,
  osrmRouteUrl,
  parseOsrmRoute,
  routingBaseUrl,
  straightLineRoute,
} from './index';

const CIVIL = { id: 'h-civil', lat: 12.8703, lng: 74.8436 };
const NORTH = { id: 'h-north', lat: 12.933, lng: 74.818 };

const osrmOk = {
  code: 'Ok',
  routes: [
    {
      distance: 9876.5,
      duration: 1234.5,
      // GeoJSON order: [lng, lat]
      geometry: { type: 'LineString', coordinates: [[74.8436, 12.8703], [74.83, 12.9], [74.818, 12.933]] },
    },
  ],
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('routingBaseUrl', () => {
  it('defaults to the public OSRM demo server', () => {
    expect(routingBaseUrl(undefined)).toBe(DEFAULT_ROUTING_BASE_URL);
    expect(routingBaseUrl('')).toBe(DEFAULT_ROUTING_BASE_URL);
  });

  it('accepts http(s) URLs and strips trailing slashes', () => {
    expect(routingBaseUrl('https://osrm.example.org/')).toBe('https://osrm.example.org');
    expect(routingBaseUrl('http://localhost:5000')).toBe('http://localhost:5000');
  });

  it('rejects non-http schemes and garbage', () => {
    expect(routingBaseUrl('file:///etc/passwd')).toBe(DEFAULT_ROUTING_BASE_URL);
    expect(routingBaseUrl('javascript:alert(1)')).toBe(DEFAULT_ROUTING_BASE_URL);
    expect(routingBaseUrl('not a url')).toBe(DEFAULT_ROUTING_BASE_URL);
  });
});

describe('osrmRouteUrl', () => {
  it('puts longitude before latitude', () => {
    const url = osrmRouteUrl('https://osrm.test', CIVIL, NORTH);
    expect(url).toBe(
      'https://osrm.test/route/v1/driving/74.8436,12.8703;74.818,12.933?overview=full&geometries=geojson',
    );
  });
});

describe('parseOsrmRoute', () => {
  it('flips GeoJSON [lng, lat] to Leaflet [lat, lng]', () => {
    const r = parseOsrmRoute(osrmOk)!;
    expect(r.approximate).toBe(false);
    expect(r.distanceM).toBe(9876.5);
    expect(r.durationS).toBe(1234.5);
    expect(r.path[0]).toEqual([12.8703, 74.8436]);
    expect(r.path[2]).toEqual([12.933, 74.818]);
  });

  it('rejects non-Ok codes, empty routes and malformed geometry', () => {
    expect(parseOsrmRoute(null)).toBeNull();
    expect(parseOsrmRoute({ code: 'NoRoute', routes: [] })).toBeNull();
    expect(parseOsrmRoute({ code: 'Ok', routes: [] })).toBeNull();
    const bad = (geometry: unknown, extra: Record<string, unknown> = {}) => ({
      code: 'Ok',
      routes: [{ distance: 1, duration: 1, geometry, ...extra }],
    });
    expect(parseOsrmRoute(bad({ coordinates: [[1, 2]] }))).toBeNull();
    expect(parseOsrmRoute(bad({ coordinates: [[1, 2], [200, 2]] }))).toBeNull();
    expect(parseOsrmRoute(bad({ coordinates: [[1, 2], 'x'] }))).toBeNull();
    expect(parseOsrmRoute(bad({ coordinates: [[1, 2], [3, 4]] }, { distance: -1 }))).toBeNull();
    expect(parseOsrmRoute(bad({ coordinates: [[1, 2], [3, 4]] }, { duration: 'fast' }))).toBeNull();
  });
});

describe('straightLineRoute', () => {
  it('is a two-point line with haversine distance and no drive time', () => {
    const r = straightLineRoute(CIVIL, NORTH);
    expect(r.approximate).toBe(true);
    expect(r.durationS).toBeNull();
    expect(r.path).toEqual([
      [CIVIL.lat, CIVIL.lng],
      [NORTH.lat, NORTH.lng],
    ]);
    expect(r.distanceM).toBeCloseTo(haversineM(CIVIL, NORTH), 6);
  });
});

describe('createRouter', () => {
  it('returns the parsed OSRM route and caches it per pair', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(osrmOk));
    const router = createRouter({ fetch: fetchMock as unknown as typeof fetch, baseUrl: 'https://osrm.test' });
    const a = await router.getRoute(CIVIL, NORTH);
    const b = await router.getRoute(CIVIL, NORTH);
    expect(a.approximate).toBe(false);
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(router.cacheSize()).toBe(1);
    // Direction matters (asymmetric roads): the reverse pair is fetched separately.
    await router.getRoute(NORTH, CIVIL);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('falls back to a straight line on HTTP errors, bad bodies and network failures', async () => {
    for (const impl of [
      async () => jsonResponse({ error: 'boom' }, 500),
      async () => jsonResponse({ code: 'NoRoute', routes: [] }),
      async () => new Response('not json', { status: 200 }),
      async () => {
        throw new TypeError('network down');
      },
    ]) {
      const router = createRouter({ fetch: vi.fn(impl) as unknown as typeof fetch });
      const r = await router.getRoute(CIVIL, NORTH);
      expect(r.approximate).toBe(true);
      expect(r.path).toHaveLength(2);
      // Fallbacks are not cached, so a recovered OSRM is picked up next time.
      expect(router.cacheSize()).toBe(0);
    }
  });
});
