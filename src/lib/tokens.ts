/**
 * Read design tokens from tokens.css at build time, for places that cannot
 * use CSS variables (the PNG Open Graph images).
 */
import css from '../styles/tokens.css?raw';

const values = new Map<string, string>();
// Only the first :root block (light, default values).
const root = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
for (const m of root.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) values.set(m[1], m[2].trim());

/** Resolve a token, following var(--other) references. */
export function token(name: string, fallback = ''): string {
  let v = values.get(name);
  for (let i = 0; v && i < 5; i++) {
    const ref = /^var\((--[\w-]+)\)$/.exec(v);
    if (!ref) break;
    v = values.get(ref[1]);
  }
  return v ?? fallback;
}
