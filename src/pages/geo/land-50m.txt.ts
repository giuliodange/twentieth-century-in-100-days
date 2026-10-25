import type { APIRoute } from 'astro';
import { land50Path } from '../../lib/geo.ts';

/** Detailed coastline as a ready-to-use SVG path, fetched lazily when the camera zooms in. */
export const GET: APIRoute = () =>
  new Response(land50Path(), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
