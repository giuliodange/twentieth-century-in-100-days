/**
 * Validation rules for content/days/*.md, shared by `npm run check` and its tests.
 * Errors make the check fail; warnings are reported but do not.
 */
import matter from 'gray-matter';
import type { core } from 'astro/zod';
import { daySchema, YEAR_MIN, YEAR_MAX, type DayData } from '../schema.ts';

export interface SourceFile {
  /** Path shown in messages, e.g. "content/days/1969.md". */
  path: string;
  raw: string;
}

export interface Problem {
  file: string;
  field?: string;
  message: string;
}

export interface ValidationResult {
  errors: Problem[];
  warnings: Problem[];
  days: { file: string; data: DayData; body: string }[];
}

export interface ValidateOptions {
  /** File names available in src/assets/visuals/. Skip the check when undefined. */
  visuals?: Set<string>;
}

const BODY_MIN_WORDS = 300;
const BODY_MAX_WORDS = 500;

export function validateDays(files: SourceFile[], opts: ValidateOptions = {}): ValidationResult {
  const errors: Problem[] = [];
  const warnings: Problem[] = [];
  const days: ValidationResult['days'] = [];

  for (const f of files) {
    let parsed: matter.GrayMatterFile<string>;
    try {
      // Pass an options object so gray-matter does not cache by content.
      parsed = matter(f.raw, {});
    } catch (e) {
      errors.push({ file: f.path, message: `frontmatter is not valid YAML: ${(e as Error).message}` });
      continue;
    }

    const result = daySchema.safeParse(parsed.data, { reportInput: true });
    if (!result.success) {
      for (const issue of result.error.issues) errors.push(formatIssue(f.path, issue));
      continue;
    }

    const data = result.data;
    const base = fileBase(f.path);
    if (/^\d{4}$/.test(base) && Number(base) !== data.year) {
      errors.push({ file: f.path, field: 'year', message: `is ${data.year} but the file is named ${base}.md` });
    } else if (!/^\d{4}$/.test(base)) {
      errors.push({ file: f.path, message: `file name must be the year, e.g. ${data.year}.md` });
    }

    if (data.visual && opts.visuals && !opts.visuals.has(data.visual)) {
      errors.push({
        file: f.path,
        field: 'visual',
        message: `"${data.visual}" not found in src/assets/visuals/`,
      });
    }

    days.push({ file: f.path, data, body: parsed.content });
  }

  // One day per year.
  const byYear = groupBy(days, (d) => d.data.year);
  for (const [year, list] of byYear) {
    if (list.length > 1) {
      for (const d of list) {
        errors.push({
          file: d.file,
          field: 'year',
          message: `duplicate year ${year}, also used by ${list.filter((o) => o !== d).map((o) => o.file).join(', ')}`,
        });
      }
    }
  }

  for (const d of days) {
    const { data, file } = d;
    if (data.status === 'published') {
      if (data.go_deeper.length === 0) warnings.push({ file, field: 'go_deeper', message: 'published day has no go_deeper items' });
      if (data.sources.length === 0) warnings.push({ file, field: 'sources', message: 'published day has no sources' });
    }
    const words = countWords(d.body);
    if (words < BODY_MIN_WORDS || words > BODY_MAX_WORDS) {
      warnings.push({ file, field: 'body', message: `${words} words (aim for ${BODY_MIN_WORDS}–${BODY_MAX_WORDS})` });
    }
    const sentences = countSentences(data.summary);
    if (sentences > 2) warnings.push({ file, field: 'summary', message: `${sentences} sentences (max 2)` });
  }

  // Duplicate URLs across go_deeper and sources of every day.
  const urlUses = new Map<string, string[]>();
  for (const d of days) {
    const urls = [
      ...d.data.go_deeper.flatMap((g, i) => (g.url ? [[g.url, `go_deeper[${i}]`]] : [])),
      ...d.data.sources.map((s, i) => [s.url, `sources[${i}]`]),
    ];
    for (const [u, where] of urls) {
      const key = normaliseUrl(u);
      urlUses.set(key, [...(urlUses.get(key) ?? []), `${d.file} › ${where}`]);
    }
  }
  for (const [u, uses] of urlUses) {
    if (uses.length > 1) warnings.push({ file: uses[0].split(' › ')[0], message: `duplicate URL ${u} used in: ${uses.join('; ')}` });
  }

  // Country names that differ only by case, spacing or accents split the stats.
  for (const field of ['country_then', 'country_today'] as const) {
    const spellings = new Map<string, Set<string>>();
    for (const d of days) {
      const name = d.data.place[field];
      const key = name.normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ').trim().toLowerCase();
      spellings.set(key, (spellings.get(key) ?? new Set()).add(name));
    }
    for (const set of spellings.values()) {
      if (set.size > 1) {
        warnings.push({ file: '(all days)', field: `place.${field}`, message: `inconsistent spellings: ${[...set].map((s) => `"${s}"`).join(', ')}` });
      }
    }
  }

  return { errors, warnings, days };
}

function formatIssue(file: string, issue: core.$ZodIssue): Problem {
  const field = issue.path.join('.').replace(/\.(\d+)(?=\.|$)/g, '[$1]') || undefined;
  const input = (issue as { input?: unknown }).input;
  let message: string;
  switch (issue.code) {
    case 'invalid_type':
      message = input === undefined ? 'is required' : `should be a ${issue.expected}, got ${JSON.stringify(input)}`;
      break;
    case 'invalid_value':
      message = `${JSON.stringify(input)} is not allowed; use one of: ${issue.values.join(', ')}`;
      break;
    case 'too_small':
      message =
        issue.origin === 'array'
          ? `needs at least ${issue.minimum} item(s)`
          : issue.origin === 'string'
            ? 'must not be empty'
            : `must be ≥ ${issue.minimum} (got ${JSON.stringify(input)})`;
      break;
    case 'too_big':
      message = `must be ≤ ${issue.maximum} (got ${JSON.stringify(input)})`;
      break;
    case 'unrecognized_keys':
      message = `unknown field(s) ${issue.keys.map((k) => `"${k}"`).join(', ')}: check the spelling`;
      break;
    case 'invalid_format':
      message = issue.format === 'url' ? `is not a valid http(s) URL: ${JSON.stringify(input)}` : issue.message;
      break;
    default:
      message = issue.message;
  }
  if (field === 'year' && (issue.code === 'too_small' || issue.code === 'too_big')) {
    message = `${JSON.stringify(input)} is outside ${YEAR_MIN}–${YEAR_MAX}`;
  }
  return { file, field, message };
}

function fileBase(path: string): string {
  return path.split('/').pop()!.replace(/\.md$/, '');
}

function groupBy<T, K>(items: T[], key: (t: T) => K): Map<K, T[]> {
  const m = new Map<K, T[]>();
  for (const it of items) m.set(key(it), [...(m.get(key(it)) ?? []), it]);
  return m;
}

export function countWords(markdown: string): number {
  const plain = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~-]/g, ' ');
  return plain.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

function countSentences(s: string): number {
  return s.split(/[.!?…]+(?:\s+|$)/).filter((p) => p.trim().length > 0).length;
}

function normaliseUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return u.trim();
  }
}
