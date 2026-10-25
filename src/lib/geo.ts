/**
 * Server-side geography: projection, land outlines and point positions.
 * Everything is projected once at build time into "world units"
 * (WORLD_W × WORLD_H), so the browser never needs d3-geo.
 */
import { geoEqualEarth, geoPath, geoCentroid } from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryObject } from 'topojson-specification';
import type { FeatureCollection, Geometry } from 'geojson';
import land110 from 'world-atlas/land-110m.json';
import land50 from 'world-atlas/land-50m.json';

export const WORLD_W = 1000;

const sphere = { type: 'Sphere' } as const;
export const projection = geoEqualEarth().fitWidth(WORLD_W, sphere);
const bounds = geoPath(projection).bounds(sphere);
export const WORLD_H = Math.round(bounds[1][1] - bounds[0][1]);

/** Camera zoom used when a day has no place.zoom. 1 = whole world. */
export const DEFAULT_ZOOM = 3;

function landPath(topo: unknown, digits: number): string {
  const t = topo as Topology<{ land: GeometryObject }>;
  const geo = feature(t, t.objects.land) as unknown as FeatureCollection<Geometry>;
  return geoPath(projection).digits(digits)(geo) ?? '';
}

let cache110: string | undefined;
let cache50: string | undefined;
export const land110Path = () => (cache110 ??= landPath(land110, 1));
export const land50Path = () => (cache50 ??= landPath(land50, 2));
export const spherePath = () => geoPath(projection).digits(1)(sphere) ?? '';

export function project(lon: number, lat: number): [number, number] {
  const p = projection([lon, lat])!;
  return [round(p[0]), round(p[1])];
}

/** Spherical mean of a set of [lon, lat] points (correct across the date line). */
export function centreOfGravity(points: [number, number][]): [number, number] | null {
  if (points.length === 0) return null;
  const c = geoCentroid({ type: 'MultiPoint', coordinates: points });
  return Number.isFinite(c[0]) && Number.isFinite(c[1]) ? c : null;
}

const round = (n: number) => Math.round(n * 100) / 100;
