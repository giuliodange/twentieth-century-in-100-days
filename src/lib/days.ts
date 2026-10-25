/**
 * Queries over the days collection. Drafts are included in `astro dev`
 * (shown with a badge) and excluded from production builds.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { YEAR_MIN, YEAR_MAX } from '../schema.ts';
import { project, DEFAULT_ZOOM } from './geo.ts';

export type Day = CollectionEntry<'days'>;

export const SHOW_DRAFTS = import.meta.env.DEV;

export async function getDays(): Promise<Day[]> {
  const all = await getCollection('days', (d: Day) => SHOW_DRAFTS || d.data.status === 'published');
  return all.sort((a: Day, b: Day) => a.data.year - b.data.year);
}

export const YEARS = Array.from({ length: YEAR_MAX - YEAR_MIN + 1 }, (_, i) => YEAR_MIN + i);

export const dayHref = (year: number) => `/${year}/`;

/** Decade label: 1900–1909 → 1900, …, 1990–1999 → 1990, 2000 → 2000. */
export const decadeOf = (year: number) => Math.floor(year / 10) * 10;
export const DECADES = Array.from({ length: 11 }, (_, i) => YEAR_MIN + i * 10);
export const decadeLabel = (decade: number) => (decade === 2000 ? '2000' : `${decade}s`);
/** How many years each decade bucket holds (2000 is a bucket of one). */
export const decadeCapacity = (decade: number) => (decade === 2000 ? 1 : 10);

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Compact data the map needs in the browser. */
export interface DayIndexEntry {
  year: number;
  date: string;
  title: string;
  summary: string;
  place: string;
  x: number;
  y: number;
  zoom: number;
  draft: boolean;
}

export function toIndexEntry(d: Day): DayIndexEntry {
  const [x, y] = project(d.data.place.lon, d.data.place.lat);
  return {
    year: d.data.year,
    date: formatDate(d.data.date),
    title: d.data.title,
    summary: d.data.summary,
    place: d.data.place.name,
    x,
    y,
    zoom: d.data.place.zoom ?? DEFAULT_ZOOM,
    draft: d.data.status === 'draft',
  };
}

export function neighbours(days: Day[], year: number): { prev?: Day; next?: Day } {
  const i = days.findIndex((d) => d.data.year === year);
  return { prev: i > 0 ? days[i - 1] : undefined, next: i >= 0 && i < days.length - 1 ? days[i + 1] : undefined };
}
