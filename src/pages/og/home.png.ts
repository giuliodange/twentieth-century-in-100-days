import type { APIRoute } from 'astro';
import { getDays, toIndexEntry } from '../../lib/days.ts';
import { renderOg } from '../../lib/og.ts';
import { useUI } from '../../i18n';
import { TOTAL_YEARS } from '../../schema.ts';

export const GET: APIRoute = async () => {
  const ui = useUI();
  const days = (await getDays()).map(toIndexEntry);
  const png = renderOg({
    kicker: '1900–2000',
    title: ui.siteName,
    footer: ui.stats.progress(days.length, TOTAL_YEARS),
    points: days,
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
