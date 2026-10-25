/**
 * npm run test:check — makes sure the validator catches what it should.
 * Each case mutates a valid day and asserts the expected error or warning.
 */
import { validateDays, type SourceFile } from '../src/lib/validate.ts';

const body = Array.from({ length: 320 }, (_, i) => `word${i}`).join(' ');

function day(overrides: Record<string, unknown> = {}, year = 1950): string {
  const base: Record<string, unknown> = {
    year,
    date: `${year}-06-01`,
    title: 'SAMPLE – test',
    summary: 'One sentence.',
    why_it_matters: 'Testing.',
    place: { name: 'X', country_then: 'A', country_today: 'B', continent: 'Europe', lat: 10, lon: 10 },
    themes: ['politics'],
    go_deeper: [{ type: 'book', title: 'T', language: 'en', note: 'N', url: `https://example.com/${year}` }],
    sources: [{ title: 'S', url: `https://example.com/s/${year}` }],
    status: 'published',
  };
  const data = deepMerge(base, overrides);
  return `---\n${JSON.stringify(data, null, 2)}\n---\n\n${body}\n`;
}

function deepMerge(a: Record<string, unknown>, b: Record<string, unknown>): Record<string, unknown> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v === undefined) delete out[k];
    else if (v && typeof v === 'object' && !Array.isArray(v) && typeof a[k] === 'object') out[k] = deepMerge(a[k] as Record<string, unknown>, v as Record<string, unknown>);
    else out[k] = v;
  }
  return out;
}

const f = (path: string, raw: string): SourceFile => ({ path: `content/days/${path}`, raw });

interface Case {
  name: string;
  files: SourceFile[];
  error?: RegExp;
  warning?: RegExp;
}

const cases: Case[] = [
  { name: 'valid day passes', files: [f('1950.md', day())] },
  { name: 'duplicate year', files: [f('1950.md', day()), f('1950-copy.md', day())], error: /duplicate year 1950/ },
  { name: 'year before 1900', files: [f('1899.md', day({ year: 1899, date: '1899-06-01' }, 1899))], error: /year: 1899 is outside 1900–2000/ },
  { name: 'year after 2000', files: [f('2001.md', day({}, 2001))], error: /outside 1900–2000/ },
  { name: 'date not in year', files: [f('1950.md', day({ date: '1951-06-01' }))], error: /date: is in 1951 but year is 1950/ },
  { name: 'impossible date', files: [f('1950.md', day({ date: '1950-02-30' }))], error: /date: is not a real calendar date/ },
  { name: 'file name ≠ year', files: [f('1951.md', day())], error: /file is named 1951\.md/ },
  { name: 'missing title', files: [f('1950.md', day({ title: undefined }))], error: /title: is required/ },
  { name: 'missing place', files: [f('1950.md', day({ place: undefined }))], error: /place: is required/ },
  { name: 'missing lat', files: [f('1950.md', day({ place: { lat: undefined } }))], error: /place\.lat: is required/ },
  { name: 'lat out of range', files: [f('1950.md', day({ place: { lat: 95 } }))], error: /place\.lat: must be ≤ 90/ },
  { name: 'lon out of range', files: [f('1950.md', day({ place: { lon: -200 } }))], error: /place\.lon: must be ≥ -180/ },
  { name: 'unknown theme', files: [f('1950.md', day({ themes: ['music'] }))], error: /themes\[0\]: "music" is not allowed/ },
  { name: 'no themes', files: [f('1950.md', day({ themes: [] }))], error: /themes: needs at least 1/ },
  {
    name: 'unknown go_deeper type',
    files: [f('1950.md', day({ go_deeper: [{ type: 'novel', title: 'T', language: 'en', note: 'N' }] }))],
    error: /go_deeper\[0\]\.type: "novel" is not allowed/,
  },
  {
    name: 'bad language code',
    files: [f('1950.md', day({ go_deeper: [{ type: 'book', title: 'T', language: 'english', note: 'N' }] }))],
    error: /go_deeper\[0\]\.language: must be a two-letter ISO 639-1 code/,
  },
  { name: 'unknown status', files: [f('1950.md', day({ status: 'done' }))], error: /status: "done" is not allowed/ },
  { name: 'misspelt field', files: [f('1950.md', day({ why_it_maters: 'x' }))], error: /unknown field\(s\) "why_it_maters"/ },
  { name: 'missing visual file', files: [f('1950.md', day({ visual: 'nope.png' }))], error: /visual: "nope.png" not found/ },
  { name: 'published without go_deeper warns', files: [f('1950.md', day({ go_deeper: [] }))], warning: /no go_deeper items/ },
  { name: 'published without sources warns', files: [f('1950.md', day({ sources: [] }))], warning: /no sources/ },
  { name: 'draft without sources does not warn', files: [f('1950.md', day({ sources: [], status: 'draft' }))] },
  {
    name: 'duplicate URL warns',
    files: [f('1950.md', day()), f('1960.md', day({ sources: [{ title: 'S', url: 'https://example.com/1950' }] }, 1960))],
    warning: /duplicate URL https:\/\/example\.com\/1950/,
  },
  {
    name: 'inconsistent country spelling warns',
    files: [f('1950.md', day()), f('1960.md', day({ place: { country_today: ' b ' } }, 1960))],
    warning: /inconsistent spellings/,
  },
];

let failed = 0;
for (const c of cases) {
  const { errors, warnings } = validateDays(c.files, { visuals: new Set() });
  const errText = errors.map((e) => `${e.field ?? ''}: ${e.message}`).join('\n');
  const warnText = warnings.map((w) => `${w.field ?? ''}: ${w.message}`).join('\n');
  let ok: boolean;
  if (c.error) ok = c.error.test(errText);
  else if (c.warning) ok = errors.length === 0 && c.warning.test(warnText);
  else ok = errors.length === 0 && warnings.length === 0;
  if (!ok) {
    failed++;
    console.log(`✖ ${c.name}\n  errors:\n    ${errText.replace(/\n/g, '\n    ') || '(none)'}\n  warnings:\n    ${warnText.replace(/\n/g, '\n    ') || '(none)'}`);
  } else {
    console.log(`✔ ${c.name}`);
  }
}
console.log(failed ? `\n${failed} of ${cases.length} failed` : `\nAll ${cases.length} cases passed`);
process.exit(failed ? 1 : 0);
