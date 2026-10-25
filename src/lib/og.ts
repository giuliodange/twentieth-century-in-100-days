/**
 * Open Graph images (1200×630 PNG), drawn at build time: the same map as the
 * site, focused on the day, with its date and title.
 */
import { resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { WORLD_W, WORLD_H, land110Path, land50Path, spherePath } from './geo.ts';
import { pointView, worldView, viewBox, type Frame } from './camera.ts';
import { token } from './tokens.ts';

const W = 1200;
const H = 630;
const PANEL = 520;
const FONTS = [resolve('src/assets/fonts/Inter_400Regular.ttf'), resolve('src/assets/fonts/Inter_600SemiBold.ttf')];

export interface OgInput {
  kicker: string;
  title: string;
  footer: string;
  /** Focus point in world units; omit for the whole world. */
  focus?: { x: number; y: number; zoom: number };
  /** Other points to draw faintly. */
  points?: { x: number; y: number }[];
}

export function renderOg(input: OgInput): Buffer {
  const frame: Frame = { width: W, height: H, fx: (PANEL + (W - PANEL) / 2) / W, fy: 0.5, freeWidth: W - PANEL, freeHeight: H };
  const view = input.focus
    ? pointView(input.focus.x, input.focus.y, input.focus.zoom, WORLD_W, WORLD_H, frame)
    : worldView(WORLD_W, WORLD_H, frame);
  const vb = viewBox(view, frame);
  const k = view[2] / W;
  const land = input.focus && input.focus.zoom >= 2.5 ? land50Path() : land110Path();

  const lines = wrap(input.title, 18, 4);
  const titleSize = 46;
  const titleY = 230;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${token('--color-bg', '#f6f6f3')}"/>
  <svg x="0" y="0" width="${W}" height="${H}" viewBox="${vb.join(' ')}" preserveAspectRatio="xMidYMid meet">
    <path d="${spherePath()}" fill="${token('--map-sphere', '#ecece7')}"/>
    <path d="${land}" fill="${token('--map-land', '#d4d4cc')}" stroke="${token('--map-coast', '#bdbdb4')}" stroke-width="${0.8 * k}"/>
    ${(input.points ?? []).map((p) => `<circle cx="${p.x}" cy="${p.y}" r="${5 * k}" fill="${token('--map-point-past', '#8a8a84')}" opacity="0.6"/>`).join('')}
    ${input.focus ? `<circle cx="${input.focus.x}" cy="${input.focus.y}" r="${12 * k}" fill="${token('--map-point', '#1b1b1b')}"/>` : ''}
  </svg>
  <rect width="${PANEL}" height="${H}" fill="${token('--color-surface', '#ffffff')}"/>
  <text x="56" y="150" font-family="Inter" font-size="26" fill="${token('--color-text-muted', '#6b6b6b')}">${esc(input.kicker)}</text>
  ${lines.map((l, i) => `<text x="56" y="${titleY + i * titleSize * 1.18}" font-family="Inter" font-weight="600" font-size="${titleSize}" fill="${token('--color-text', '#1b1b1b')}">${esc(l)}</text>`).join('')}
  <text x="56" y="${H - 56}" font-family="Inter" font-size="22" fill="${token('--color-text-muted', '#6b6b6b')}">${esc(input.footer)}</text>
</svg>`;

  const png = new Resvg(svg, {
    font: { fontFiles: FONTS, loadSystemFonts: false, defaultFontFamily: 'Inter' },
    fitTo: { mode: 'width', value: W },
  }).render();
  return png.asPng();
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars && line) {
      lines.push(line);
      line = w;
    } else line = (line + ' ' + w).trim();
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\s*\S*$/, '') + '…';
  }
  return lines;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
