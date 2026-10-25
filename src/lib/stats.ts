/**
 * All statistics, computed from the days at build time.
 */
import { rollup } from 'd3-array';
import { CONTINENTS, GO_DEEPER_TYPES, THEMES, TOTAL_YEARS, languageName } from '../schema.ts';
import { DECADES, decadeOf, decadeCapacity, decadeLabel, type Day } from './days.ts';
import { centreOfGravity, project } from './geo.ts';

/** Below this many days, every stat is flagged as not yet meaningful. */
export const SPARSE_THRESHOLD = 20;

export interface Count {
  key: string;
  label: string;
  value: number;
  /** For bounded categories, e.g. a decade holds 10 years. */
  capacity?: number;
  href?: string;
}

export interface Centre {
  decade: number;
  label: string;
  days: number;
  /** Projected position, or null when the points cancel out. */
  x: number | null;
  y: number | null;
}

const count = <T>(items: T[], key: (t: T) => string) => rollup(items, (v) => v.length, key);
const byValue = (a: Count, b: Count) => b.value - a.value || a.label.localeCompare(b.label);

function weekdayIndex(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7; // Monday = 0
}

/** Meteorological seasons; flipped for the southern hemisphere. 0 = winter. */
function seasonIndex(iso: string, lat: number): number {
  const month = Number(iso.slice(5, 7));
  const north = Math.floor((month % 12) / 3); // Dec–Feb 0, Mar–May 1, …
  return lat < 0 ? (north + 2) % 4 : north;
}

export function computeStats(days: Day[], labels: { weekdays: string[]; months: string[]; seasons: string[]; themes: Record<string, string>; types: Record<string, { many: string }> }) {
  const data = days.map((d) => d.data);
  const n = data.length;

  const decades: Count[] = DECADES.map((dec) => ({
    key: String(dec),
    label: decadeLabel(dec),
    value: data.filter((d) => decadeOf(d.year) === dec).length,
    capacity: decadeCapacity(dec),
  }));

  const wd = count(data, (d) => String(weekdayIndex(d.date)));
  const weekdays: Count[] = labels.weekdays.map((label, i) => ({ key: String(i), label, value: wd.get(String(i)) ?? 0 }));

  const mo = count(data, (d) => String(Number(d.date.slice(5, 7)) - 1));
  const months: Count[] = labels.months.map((label, i) => ({ key: String(i), label, value: mo.get(String(i)) ?? 0 }));

  const se = count(data, (d) => String(seasonIndex(d.date, d.place.lat)));
  const seasons: Count[] = labels.seasons.map((label, i) => ({ key: String(i), label, value: se.get(String(i)) ?? 0 }));

  const co = count(data, (d) => d.place.continent);
  const continents: Count[] = CONTINENTS.map((c) => ({ key: c, label: c, value: co.get(c) ?? 0 })).sort(byValue);

  const countries = (field: 'country_then' | 'country_today'): Count[] =>
    [...count(data, (d) => d.place[field])].map(([k, v]) => ({ key: k, label: k, value: v })).sort(byValue);

  const th = count(
    data.flatMap((d) => d.themes),
    (t) => t,
  );
  const themes: Count[] = THEMES.map((t) => ({ key: t, label: labels.themes[t], value: th.get(t) ?? 0, href: `/go-deeper/?theme=${t}` })).sort(byValue);

  const pe = count(
    data.flatMap((d) => d.people),
    (p) => p,
  );
  const people: Count[] = [...pe].map(([k, v]) => ({ key: k, label: k, value: v })).sort(byValue);

  const items = data.flatMap((d) => d.go_deeper);
  const ty = count(items, (i) => i.type);
  const goDeeperByType: Count[] = GO_DEEPER_TYPES.map((t) => ({ key: t, label: labels.types[t].many, value: ty.get(t) ?? 0, href: `/go-deeper/?type=${t}` })).sort(byValue);
  const la = count(items, (i) => i.language);
  const goDeeperByLanguage: Count[] = [...la].map(([k, v]) => ({ key: k, label: languageName(k), value: v, href: `/go-deeper/?language=${k}` })).sort(byValue);

  const perDay = data
    .map((d) => ({ key: String(d.year), label: `${d.year}: ${d.title}`, value: d.go_deeper.length, href: `/${d.year}/` }))
    .sort((a, b) => b.value - a.value || Number(a.key) - Number(b.key));
  const mostItems = perDay.slice(0, Math.min(5, Math.ceil(n / 2)));
  const fewestItems = perDay.slice(mostItems.length).reverse().slice(0, 5);

  const centres: Centre[] = DECADES.map((dec) => {
    const pts = data.filter((d) => decadeOf(d.year) === dec).map((d) => [d.place.lon, d.place.lat] as [number, number]);
    const c = centreOfGravity(pts);
    const p = c ? project(c[0], c[1]) : null;
    return { decade: dec, label: decadeLabel(dec), days: pts.length, x: p?.[0] ?? null, y: p?.[1] ?? null };
  }).filter((c) => c.days > 0);
  const overall = centreOfGravity(data.map((d) => [d.place.lon, d.place.lat]));
  const overallXY = overall ? project(overall[0], overall[1]) : null;
  const allPoints = data.map((d) => project(d.place.lon, d.place.lat));

  return {
    n,
    total: TOTAL_YEARS,
    sparse: n < SPARSE_THRESHOLD,
    decades,
    weekdays,
    months,
    seasons,
    continents,
    countriesThen: countries('country_then'),
    countriesToday: countries('country_today'),
    themes,
    people,
    itemsTotal: items.length,
    goDeeperByType,
    goDeeperByLanguage,
    mostItems,
    fewestItems,
    centres,
    overall: overallXY,
    allPoints,
  };
}

export type Stats = ReturnType<typeof computeStats>;
