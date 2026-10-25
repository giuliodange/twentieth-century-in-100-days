/**
 * Browser side of the map: year selection, camera moves, input handling,
 * and the link between the map and the day overlay (/YYYY/ URLs).
 *
 * The #map-shell element is persisted by Astro's ClientRouter, so one
 * MapController lives as long as the visitor stays on map pages.
 */
import { navigate } from 'astro:transitions/client';
import { interpolateZoom } from 'd3-interpolate';
import { easeCubicInOut } from 'd3-ease';
import { worldView, pointView, viewBox, type View, type Frame } from '../../lib/camera.ts';
import { useUI } from '../../i18n';

interface Entry {
  year: number;
  date: string;
  title: string;
  summary: string;
  place: string;
  x: number;
  y: number;
  zoom: number;
  draft: boolean;
}

interface IndexData {
  days: Entry[];
  world: [number, number];
  min: number;
  max: number;
}

const ui = useUI();
const WIDE = '(min-width: 900px)';
const NAV_HEIGHT = 48;
/** Effective zoom above which the detailed (50m) coastline is shown. */
const HI_RES_ZOOM = 2.5;
const DRAG_STEP_PX = { mouse: 22, touch: 26, pen: 22 } as Record<string, number>;
const WHEEL_STEP = 40;
const WHEEL_COOLDOWN_MS = 70;
const INTRO_DELAY_MS = 350;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const cssNumber = (name: string, fallback: number) => {
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name));
  return Number.isFinite(v) ? v : fallback;
};
const dayHref = (year: number) => `/${year}/`;
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

let hiResPath: Promise<string> | undefined;
function loadHiRes(): Promise<string> {
  return (hiResPath ??= fetch('/geo/land-50m.txt').then((r) => (r.ok ? r.text() : '')).catch(() => ''));
}

class MapController {
  readonly el: HTMLElement;
  private svg: SVGSVGElement;
  private data: IndexData;
  private byYear: Map<number, Entry>;
  private points = new Map<number, { g: SVGGElement; dot: SVGCircleElement; hit: SVGCircleElement }>();
  private ticks = new Map<number, HTMLElement>();
  private scrubber: HTMLElement;
  private thumb: HTMLElement;
  private thumbLabel: HTMLElement;
  private cardLink: HTMLAnchorElement;
  private cardEmpty: HTMLElement;

  year: number;
  overlayOpen = false;
  /** True when the overlay was opened from the map in this visit, so Close can go back. */
  openedFromMap = false;
  private synced = false;
  private view: View;
  private frame!: Frame;
  private anim = 0;
  private hiResReady = false;

  constructor(el: HTMLElement) {
    this.el = el;
    this.svg = el.querySelector('svg.map')!;
    this.data = JSON.parse(el.querySelector('#days-index')!.textContent!);
    this.byYear = new Map(this.data.days.map((d) => [d.year, d]));
    this.scrubber = el.querySelector('.scrubber')!;
    this.thumb = el.querySelector('.thumb')!;
    this.thumbLabel = el.querySelector('.thumb-label')!;
    this.cardLink = el.querySelector('a.day-card')!;
    this.cardEmpty = el.querySelector('.day-card.is-empty')!;
    el.querySelectorAll<SVGGElement>('.pt').forEach((g) => {
      this.points.set(Number(g.dataset.year), {
        g,
        dot: g.querySelector('.pt-dot')!,
        hit: g.querySelector('.pt-hit')!,
      });
    });
    el.querySelectorAll<HTMLElement>('.tick').forEach((t) => this.ticks.set(Number(t.dataset.year), t));

    this.year = Number(el.dataset.initialYear);
    // The server rendered for an assumed screen; re-fit to the real one now.
    // sync() runs right after, in the same task, so nothing is painted in between.
    this.measure();
    this.view = worldView(...this.data.world, this.frame);
    this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    this.applyView(this.view);

    this.bindPointer();
    this.bindScrubber();
    this.bindWheel();
    new ResizeObserver(() => this.onResize()).observe(this.el);
  }

  // ---- Page sync (called on every astro:page-load) ----

  sync() {
    const page = document.querySelector<HTMLElement>('[data-day-page]');
    const first = !this.synced;
    const wasOpen = this.overlayOpen;
    this.synced = true;
    this.overlayOpen = !!page;
    this.measure();

    if (page) {
      if (!wasOpen) this.openedFromMap = !first;
      const year = Number(page.dataset.year);
      this.select(year, { animate: !first, force: true });
      if (!wasOpen) page.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
      return;
    }

    this.openedFromMap = false;
    if (first) {
      const fromHash = /^#(\d{4})$/.exec(location.hash);
      const hashYear = fromHash ? clamp(Number(fromHash[1]), this.data.min, this.data.max) : undefined;
      if (hashYear !== undefined) {
        this.select(hashYear, { animate: false, force: true });
      } else if (this.byYear.has(this.year)) {
        // Home: start on the whole world, then fly to the latest day.
        if (reducedMotion()) this.select(this.year, { animate: false, force: true });
        else setTimeout(() => this.select(this.year, { animate: true, force: true }), INTRO_DELAY_MS);
      }
    } else {
      // Back from the overlay: keep the selection, re-centre for the wider free area.
      this.select(this.year, { animate: true, force: true });
      if (wasOpen) this.scrubber.focus({ preventScroll: true });
    }
    this.writeHash();
  }

  // ---- Selection ----

  select(year: number, { animate = true, force = false } = {}) {
    year = clamp(Math.round(year), this.data.min, this.data.max);
    if (year === this.year && !force) return;
    this.year = year;
    const day = this.byYear.get(year);

    for (const [y, p] of this.points) p.g.dataset.state = y === year ? 'current' : y < year ? 'past' : 'future';
    for (const [y, t] of this.ticks) t.classList.toggle('selected', y === year);
    const pct = ((year - this.data.min) / (this.data.max - this.data.min)) * 100;
    this.thumb.style.left = `${pct}%`;
    this.thumbLabel.textContent = String(year);
    this.scrubber.setAttribute('aria-valuenow', String(year));
    this.scrubber.setAttribute('aria-valuetext', `${year}: ${day ? day.title : ui.map.notWritten}`);
    this.renderCard(day);

    if (day) this.flyTo(pointView(day.x, day.y, day.zoom, ...this.data.world, this.frame), animate);
    else this.applyView(this.view); // update point radii for the new states
    if (!this.overlayOpen) this.writeHash();
  }

  step(delta: number) {
    this.select(this.year + delta);
  }

  open(year = this.year) {
    if (!this.byYear.has(year)) return;
    navigate(dayHref(year), { history: this.overlayOpen ? 'replace' : 'push' });
  }

  close() {
    if (!this.overlayOpen) return;
    if (this.openedFromMap) history.back();
    else navigate(`/#${this.year}`);
  }

  private writeHash() {
    if (location.pathname !== '/') return;
    const hash = `#${this.year}`;
    if (location.hash !== hash) history.replaceState(history.state, '', `/${hash}`);
  }

  private renderCard(day: Entry | undefined) {
    this.cardLink.hidden = !day;
    this.cardEmpty.hidden = !!day;
    if (day) {
      this.cardLink.href = dayHref(day.year);
      this.cardLink.querySelector('.card-date-text')!.textContent = day.date;
      this.cardLink.querySelector<HTMLElement>('.badge')!.hidden = !day.draft;
      this.cardLink.querySelector('.card-title')!.textContent = day.title;
      this.cardLink.querySelector('.card-summary')!.textContent = day.summary;
    } else {
      this.cardEmpty.querySelector('.card-date-text')!.textContent = String(this.year);
      this.cardEmpty.querySelector('.card-title')!.textContent = this.data.days.length ? ui.map.notWritten : ui.map.empty;
    }
  }

  // ---- Camera ----

  private measure() {
    const width = this.el.clientWidth || window.innerWidth;
    const height = this.el.clientHeight || window.innerHeight;
    const wide = matchMedia(WIDE).matches;
    let freeWidth = width;
    let freeHeight: number;
    let fy: number;
    if (this.overlayOpen) {
      const overlay = document.querySelector<HTMLElement>('.overlay');
      if (wide && overlay) freeWidth = Math.max(200, width - overlay.getBoundingClientRect().width);
      freeHeight = height - NAV_HEIGHT;
      fy = (NAV_HEIGHT + freeHeight / 2) / height;
    } else {
      const hudTop = this.el.querySelector('.hud')!.getBoundingClientRect().top - this.el.getBoundingClientRect().top;
      freeHeight = Math.max(120, hudTop - NAV_HEIGHT);
      fy = (NAV_HEIGHT + freeHeight / 2) / height;
    }
    this.frame = { width, height, fx: freeWidth / 2 / width, fy, freeWidth, freeHeight };
  }

  private targetView(): View {
    const day = this.byYear.get(this.year);
    return day ? pointView(day.x, day.y, day.zoom, ...this.data.world, this.frame) : this.view;
  }

  private flyTo(target: View, animate: boolean) {
    cancelAnimationFrame(this.anim);
    this.anim = 0;
    if (!animate || reducedMotion()) {
      this.applyView(target);
      this.settle();
      return;
    }
    this.svg.classList.remove('hi-res');
    const interp = interpolateZoom(this.view, target);
    const ms = clamp(interp.duration * cssNumber('--camera-speed', 1), cssNumber('--camera-min-ms', 700), cssNumber('--camera-max-ms', 2200));
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      this.applyView(interp(easeCubicInOut(t)) as View);
      if (t < 1) this.anim = requestAnimationFrame(tick);
      else {
        this.anim = 0;
        this.settle();
      }
    };
    this.anim = requestAnimationFrame(tick);
  }

  private applyView(view: View) {
    if (!view.every(Number.isFinite) || view[2] <= 0) return;
    this.view = view;
    const vb = viewBox(view, this.frame);
    this.svg.setAttribute('viewBox', vb.map((n) => n.toFixed(2)).join(' '));
    const k = view[2] / this.frame.width; // world units per px
    const r = cssNumber('--map-point-radius', 6);
    const rPast = cssNumber('--map-point-past-radius', 3);
    for (const [y, p] of this.points) {
      p.dot.setAttribute('r', ((y === this.year ? r : rPast) * k).toFixed(3));
      p.hit.setAttribute('r', (16 * k).toFixed(3));
    }
  }

  /** After the camera stops: swap in the detailed coastline when zoomed in. */
  private settle() {
    const zoom = (this.data.world[0] * (this.frame.width / this.frame.freeWidth)) / this.view[2];
    const wantHi = zoom >= HI_RES_ZOOM;
    if (wantHi && !this.hiResReady) {
      loadHiRes().then((d) => {
        if (!d) return;
        this.svg.querySelector('.land-hi')!.setAttribute('d', d);
        this.hiResReady = true;
        if (!this.anim) this.settle();
      });
      return;
    }
    this.svg.classList.toggle('hi-res', wantHi && this.hiResReady);
  }

  private resizeFrame = 0;
  private onResize() {
    cancelAnimationFrame(this.resizeFrame);
    this.resizeFrame = requestAnimationFrame(() => {
      this.measure();
      const day = this.byYear.get(this.year);
      // With no day selected yet (or an empty year), keep or fit the world view.
      const target = day ? this.targetView() : worldView(...this.data.world, this.frame);
      if (!this.anim) {
        this.applyView(day || !this.synced ? target : this.view);
        this.settle();
      }
    });
  }

  // ---- Input ----

  private bindPointer() {
    let start: { x: number; y: number; year: number; id: number; type: string; hitYear?: number } | null = null;
    let moved = false;

    this.svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      const hit = (e.target as Element).closest<SVGGElement>('.pt');
      start = { x: e.clientX, y: e.clientY, year: this.year, id: e.pointerId, type: e.pointerType, hitYear: hit ? Number(hit.dataset.year) : undefined };
      moved = false;
    });
    this.svg.addEventListener('pointermove', (e) => {
      if (!start || e.pointerId !== start.id || this.overlayOpen) return;
      const dx = e.clientX - start.x;
      if (!moved && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(e.clientY - start.y)) {
        moved = true;
        this.svg.setPointerCapture(e.pointerId);
        this.svg.classList.add('is-dragging');
      }
      // Dragging left moves forward in time, like pushing the timeline.
      if (moved) this.select(start.year + Math.trunc(-dx / (DRAG_STEP_PX[start.type] ?? 22)));
    });
    const end = (e: PointerEvent) => {
      if (!start || e.pointerId !== start.id) return;
      if (!moved && start.hitYear !== undefined) this.onPointClick(start.hitYear);
      this.svg.classList.remove('is-dragging');
      start = null;
    };
    this.svg.addEventListener('pointerup', end);
    this.svg.addEventListener('pointercancel', () => {
      start = null;
      this.svg.classList.remove('is-dragging');
    });
  }

  private onPointClick(year: number) {
    if (this.overlayOpen) this.open(year);
    else if (year === this.year) this.open(year);
    else this.select(year);
  }

  private bindScrubber() {
    const track = this.scrubber.querySelector<HTMLElement>('.track')!;
    const yearAt = (clientX: number) => {
      const r = track.getBoundingClientRect();
      return this.data.min + Math.round(clamp((clientX - r.left) / r.width, 0, 1) * (this.data.max - this.data.min));
    };
    let dragging = false;
    this.scrubber.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      dragging = true;
      this.scrubber.setPointerCapture(e.pointerId);
      this.scrubber.focus({ preventScroll: true });
      this.select(yearAt(e.clientX));
      e.preventDefault();
    });
    this.scrubber.addEventListener('pointermove', (e) => {
      if (dragging) this.select(yearAt(e.clientX));
    });
    const stop = () => (dragging = false);
    this.scrubber.addEventListener('pointerup', stop);
    this.scrubber.addEventListener('pointercancel', stop);
    // Ticks are real links for crawlers and no-JS visitors; with JS they only select.
    this.scrubber.addEventListener('click', (e) => e.preventDefault(), true);
  }

  private bindWheel() {
    let acc = 0;
    let last = 0;
    let lastEvent = 0;
    this.el.addEventListener(
      'wheel',
      (e) => {
        if (this.overlayOpen) return;
        e.preventDefault();
        const now = performance.now();
        if (now - lastEvent > 250) acc = 0;
        lastEvent = now;
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1;
        const d = (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit;
        acc = clamp(acc + d, -WHEEL_STEP * 2, WHEEL_STEP * 2);
        if (Math.abs(acc) >= WHEEL_STEP && now - last >= WHEEL_COOLDOWN_MS) {
          this.step(Math.sign(acc));
          acc = 0;
          last = now;
        }
      },
      { passive: false },
    );
  }
}

// ---- Wiring: one controller per shell element, global listeners once ----

let current: MapController | null = null;

document.addEventListener('astro:page-load', () => {
  const shell = document.getElementById('map-shell');
  if (!shell) {
    current = null;
    return;
  }
  if (!current || current.el !== shell) current = new MapController(shell);
  current.sync();
});

document.addEventListener('keydown', (e) => {
  if (!current || e.metaKey || e.ctrlKey || e.altKey) return;
  const target = e.target as HTMLElement;
  if (target.closest('input, select, textarea, [contenteditable]')) return;

  if (current.overlayOpen) {
    if (e.key === 'Escape') {
      e.preventDefault();
      current.close();
    }
    return;
  }
  const big = e.shiftKey ? 10 : 1;
  const actions: Record<string, () => void> = {
    ArrowRight: () => current!.step(big),
    ArrowUp: () => current!.step(big),
    ArrowLeft: () => current!.step(-big),
    ArrowDown: () => current!.step(-big),
    PageUp: () => current!.step(10),
    PageDown: () => current!.step(-10),
    Home: () => current!.select(1900),
    End: () => current!.select(2000),
  };
  if (actions[e.key]) {
    e.preventDefault();
    actions[e.key]();
  } else if (e.key === 'Enter' && !target.closest('a, button')) {
    e.preventDefault();
    current.open();
  }
});

// Close buttons in the overlay (the overlay itself is swapped on every navigation).
document.addEventListener('click', (e) => {
  const close = (e.target as Element).closest('[data-close]');
  if (close && current?.overlayOpen) {
    e.preventDefault();
    current.close();
  }
});
