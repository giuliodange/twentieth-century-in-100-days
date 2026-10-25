/**
 * npm run check — validates every day in content/days/.
 * Exits with code 1 on errors; warnings are printed but do not fail.
 *
 * Usage: npm run check [-- --dir path/to/days]
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { validateDays, type Problem } from '../src/lib/validate.ts';
import { TOTAL_YEARS } from '../src/schema.ts';

const args = process.argv.slice(2);
const dirArg = args.indexOf('--dir');
const dir = dirArg >= 0 ? args[dirArg + 1] : 'content/days';
const visualsDir = 'src/assets/visuals';

const color = process.stdout.isTTY && !process.env.NO_COLOR;
const red = (s: string) => (color ? `\x1b[31m${s}\x1b[0m` : s);
const yellow = (s: string) => (color ? `\x1b[33m${s}\x1b[0m` : s);
const green = (s: string) => (color ? `\x1b[32m${s}\x1b[0m` : s);
const dim = (s: string) => (color ? `\x1b[2m${s}\x1b[0m` : s);

if (!existsSync(dir)) {
  console.error(red(`✖ ${dir} does not exist`));
  process.exit(1);
}

const files = readdirSync(dir)
  .filter((f) => f.endsWith('.md'))
  .sort()
  .map((f) => {
    const path = join(dir, f);
    return { path: relative(process.cwd(), path), raw: readFileSync(path, 'utf8') };
  });

const visuals = existsSync(visualsDir) ? new Set(readdirSync(visualsDir)) : new Set<string>();
const { errors, warnings, days } = validateDays(files, { visuals });

const line = (p: Problem) => `${p.file}${p.field ? ` › ${p.field}` : ''}: ${p.message}`;

for (const w of warnings) console.log(yellow('⚠ ') + line(w));
for (const e of errors) console.log(red('✖ ') + line(e));

const published = days.filter((d) => d.data.status === 'published').length;
const drafts = days.length - published;
console.log(
  dim(
    `\n${files.length} file(s) · ${published} published · ${drafts} draft(s) · ${published}/${TOTAL_YEARS} years written`,
  ),
);

if (errors.length) {
  console.log(red(`\n✖ ${errors.length} error(s), ${warnings.length} warning(s). Fix the errors above.`));
  process.exit(1);
}
console.log(green(`\n✔ No errors`) + (warnings.length ? yellow(` · ${warnings.length} warning(s)`) : ''));
