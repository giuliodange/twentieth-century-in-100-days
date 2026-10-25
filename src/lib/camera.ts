/**
 * Camera maths shared by the server render and the browser.
 * A view is [cx, cy, w]: the world point in focus and how many world units
 * the container's width spans. This is the shape d3.interpolateZoom expects.
 */
export type View = [cx: number, cy: number, w: number];

export interface Frame {
  /** Container size in px. */
  width: number;
  height: number;
  /** Where the focus point sits on screen, as a fraction of width/height. */
  fx: number;
  fy: number;
  /** Height (px) of the area actually free for the map (above card + slider). */
  freeHeight: number;
  /** Width (px) of the area free for the map (left of the overlay on wide screens). */
  freeWidth: number;
}

/** The view that shows the whole world inside the free area. */
export function worldView(worldW: number, worldH: number, f: Frame): View {
  const pad = 1.08;
  const w = Math.max(worldW * (f.width / f.freeWidth), worldH * (f.width / f.freeHeight)) * pad;
  return [worldW / 2, worldH / 2, w];
}

/** The view centred on a point at a given zoom (1 = world width fills the free area). */
export function pointView(x: number, y: number, zoom: number, worldW: number, worldH: number, f: Frame): View {
  const world = worldView(worldW, worldH, f);
  const w = Math.min(world[2], (worldW * (f.width / f.freeWidth)) / zoom);
  return [x, y, w];
}

/** SVG viewBox for a view in a frame. */
export function viewBox([cx, cy, w]: View, f: Frame): [number, number, number, number] {
  const h = w * (f.height / f.width);
  return [cx - w * f.fx, cy - h * f.fy, w, h];
}

/** Frame assumed when rendering on the server (no viewport known). */
export const SERVER_FRAME: Frame = { width: 1440, height: 900, fx: 0.5, fy: 0.42, freeHeight: 720, freeWidth: 1440 };
