/**
 * The data model for one day. This file is the single source of truth:
 * Astro's content collection (src/content.config.ts) and the validation
 * script (scripts/check.ts) both use it.
 *
 * Keep it free of `astro:*` imports so it also runs under plain Node (tsx).
 */
import { z } from 'astro/zod';

export const YEAR_MIN = 1900;
export const YEAR_MAX = 2000;
export const TOTAL_YEARS = YEAR_MAX - YEAR_MIN + 1;

export const THEMES = [
  'politics',
  'war',
  'science',
  'technology',
  'culture',
  'economy',
  'society',
  'sport',
  'environment',
  'religion',
] as const;

export const GO_DEEPER_TYPES = [
  'book',
  'film',
  'documentary',
  'podcast',
  'article',
  'place',
  'archive',
] as const;

export const CONTINENTS = [
  'Africa',
  'Antarctica',
  'Asia',
  'Europe',
  'North America',
  'Oceania',
  'South America',
] as const;

export const STATUSES = ['draft', 'published'] as const;

export type Theme = (typeof THEMES)[number];
export type GoDeeperType = (typeof GO_DEEPER_TYPES)[number];
export type Continent = (typeof CONTINENTS)[number];

const languageNames = new Intl.DisplayNames(['en'], { type: 'language' });

/** True for two-letter ISO 639-1 codes that the runtime knows ("en", "it", "ja"…). */
export function isLanguageCode(code: string): boolean {
  return /^[a-z]{2}$/.test(code) && languageNames.of(code) !== code;
}

export function languageName(code: string): string {
  return languageNames.of(code) ?? code;
}

const text = z.string().trim().min(1);
const url = z.url({ protocol: /^https?$/ });

/** YAML turns `1969-07-20` into a Date; accept both and normalise to "YYYY-MM-DD". */
const isoDate = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v.trim()))
  .pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'must be an ISO date like 1969-07-20' })
      .refine((s) => new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s, {
        error: 'is not a real calendar date',
      }),
  );

export const placeSchema = z.strictObject({
  name: text,
  country_then: text,
  country_today: text,
  continent: z.enum(CONTINENTS),
  lat: z.number().min(-90).max(90),
  lon: z.number().min(-180).max(180),
  /**
   * Optional camera zoom (1 = whole world). Default: DEFAULT_ZOOM in src/lib/geo.ts.
   * Above ~8 the Natural Earth 1:50m coastline starts to look coarse.
   */
  zoom: z.number().min(1).max(12).optional(),
});

export const goDeeperSchema = z.strictObject({
  type: z.enum(GO_DEEPER_TYPES),
  title: text,
  author: text.optional(),
  year: z.number().int().min(1).max(2100).optional(),
  language: z.string().refine(isLanguageCode, {
    error: 'must be a two-letter ISO 639-1 code such as "en", "it" or "fr"',
  }),
  url: url.optional(),
  note: text,
});

export const sourceSchema = z.strictObject({
  title: text,
  url,
});

export const daySchema = z
  .strictObject({
    year: z.number().int().min(YEAR_MIN).max(YEAR_MAX),
    date: isoDate,
    date_note: text.optional(),
    title: text,
    summary: text,
    why_it_matters: text,
    place: placeSchema,
    people: z.array(text).default([]),
    themes: z.array(z.enum(THEMES)).min(1),
    go_deeper: z.array(goDeeperSchema).default([]),
    sources: z.array(sourceSchema).default([]),
    /** File name inside src/assets/visuals/, e.g. "1969.svg". */
    visual: text.optional(),
    status: z.enum(STATUSES),
  })
  .superRefine((day, ctx) => {
    const dateYear = Number(day.date.slice(0, 4));
    if (dateYear !== day.year) {
      ctx.addIssue({
        code: 'custom',
        path: ['date'],
        message: `is in ${dateYear} but year is ${day.year}`,
      });
    }
  });

export type DayData = z.output<typeof daySchema>;
export type GoDeeperItem = z.output<typeof goDeeperSchema>;
