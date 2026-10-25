import { HUB } from "@beaver/shared";

/**
 * Smooth movement for other beavers.
 *
 * The server sends positions about 12 times a second, and on a real network they don't arrive
 * evenly. Chasing the newest one (the old way) makes friends speed up, slow down and jitter.
 * Instead each beaver keeps a short history of timestamped positions and is drawn a little in the
 * past — about 1.6 server ticks — sliding steadily between the two positions either side of that
 * moment. That small delay is invisible in a cozy game and makes everyone glide.
 */

const INTERVAL = 1000 / HUB.tickRate;
const DELAY = INTERVAL * 1.7;

export interface Track { s: { t: number; x: number; z: number }[] }

export function newTrack(x: number, z: number, now = performance.now()): Track {
  return { s: [{ t: now - DELAY * 2, x, z }] };
}

/** Records a position from the server. */
export function pushSample(tr: Track, x: number, z: number, now = performance.now()) {
  const s = tr.s;
  const last = s[s.length - 1];
  if (last && Math.abs(last.x - x) < 1e-4 && Math.abs(last.z - z) < 1e-4) { last.t = Math.max(last.t, now - INTERVAL); return; }
  // Standing still for a while then setting off: start the walk from "one tick ago", not from
  // when they stopped, or the first step would be stretched across the whole pause.
  if (last && now - last.t > INTERVAL * 1.5) s.push({ t: now - INTERVAL, x: last.x, z: last.z });
  // A teleport (gondola, joining a friend): jump rather than slide across the map.
  if (last && Math.hypot(last.x - x, last.z - z) > 12) s.length = 0;
  s.push({ t: now, x, z });
  if (s.length > 8) s.splice(0, s.length - 8);
}

/** Where to draw the beaver right now. */
export function sampleAt(tr: Track, now = performance.now()): { x: number; z: number } {
  const s = tr.s;
  const t = now - DELAY;
  if (s.length === 1 || t <= s[0].t) return s[0];
  for (let i = s.length - 1; i > 0; i--) {
    const a = s[i - 1], b = s[i];
    if (t >= a.t) {
      if (t >= b.t) return b; // ran out of updates: hold the newest position
      const k = (t - a.t) / Math.max(1, b.t - a.t);
      return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
    }
  }
  return s[0];
}
