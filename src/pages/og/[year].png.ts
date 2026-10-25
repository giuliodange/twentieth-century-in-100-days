import type { APIRoute, GetStaticPaths } from 'astro';
import { getDays, toIndexEntry, type Day } from '../../lib/days.ts';
import { renderOg } from '../../lib/og.ts';
import { useUI } from '../../i18n';

export const getStaticPaths = (async () => {
  const days = await getDays();
  return days.map((d) => ({ params: { year: String(d.data.year) }, props: { day: d } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute = ({ props }) => {
  const day = (props as { day: Day }).day;
  const e = toIndexEntry(day);
  const png = renderOg({
    kicker: e.date,
    title: e.title,
    footer: useUI().siteName,
    focus: { x: e.x, y: e.y, zoom: e.zoom },
  });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png' } });
};
