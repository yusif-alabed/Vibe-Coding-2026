import { HUB } from "@beaver/shared";

/**
 * Smooth movement for other beavers.
 *
 * The server sends positions 20 times a second, and on a real network they don't arrive evenly:
 * two can land together after a hiccup, then nothing for a moment. Chasing the newest one makes
 * friends speed up, slow down and jitter. Instead:
 *
 *  - every update carries the server's own clock, so samples sit on the server's steady timeline
 *    no matter when the network delivered them (a late burst doesn't look like a sprint), and
 *  - each beaver is drawn a little in the past, sliding between the two samples either side of
 *    that moment. How far back is learned from how late updates actually run: a steady
 *    connection stays snappy, a shaky one (tunnel, Wi-Fi) gets just enough cushion to keep
 *    gliding instead of freezing.
 *
 * Without a server clock (solo mode) it falls back to timing samples by when they arrived.
 */

const INTERVAL = 1000 / HUB.tickRate;
const MIN_DELAY = INTERVAL * 1.6;
const MAX_DELAY = 320;
const HISTORY = 14;

let delay = MIN_DELAY * 1.1;
/** Smallest (arrival − server clock) seen lately: the one-way delay plus the clock difference. */
let offset: number | null = null;
/** The longest a walking beaver's newest position has lately been out of date. Fades over time. */
let stalePeak = 0;
let stalePeakAt = 0;

/** Current drawing delay in ms (for the connection badge and tests). */
export function interpDelay(): number {
  return delay;
}

export interface Track { s: { t: number; x: number; z: number }[]; arr?: number }

export function newTrack(x: number, z: number, now = performance.now()): Track {
  return { s: [{ t: now - delay * 2, x, z }] };
}

/** Records a position from the server. `serverTs` is the server's clock when it sent it. */
export function pushSample(tr: Track, x: number, z: number, now = performance.now(), serverTs?: number) {
  let at = now;
  if (serverTs !== undefined) {
    const off = now - serverTs;
    // Track the fastest deliveries; creep upward very slowly so clock drift can't strand us.
    offset = offset === null || off < offset ? off : offset + (off - offset) * 0.0002;
    at = serverTs + offset;
  }
  tr.arr = now;
  const s = tr.s;
  const last = s[s.length - 1];
  if (last && at <= last.t) at = last.t + 1; // keep the timeline strictly forward
  if (last && Math.abs(last.x - x) < 1e-4 && Math.abs(last.z - z) < 1e-4) { last.t = Math.max(last.t, at - INTERVAL); return; }
  // The drawing delay has to cover the worst gap we draw through: how out of date the newest
  // sample had become by the time the next one showed up (network lateness plus the server's own
  // tick spacing). Only counted while the beaver is walking steadily, not after a pause.
  if (last && at - last.t < INTERVAL * 3) {
    const stale = now - last.t;
    stalePeak = Math.max(stale, stalePeak - (now - stalePeakAt) * 0.012); // fades ~12 ms per second
    stalePeakAt = now;
    const want = Math.min(MAX_DELAY, Math.max(MIN_DELAY, stalePeak * 1.12 + 6));
    // Grow fast (a freeze is worse than lag), shrink slowly (so nothing visibly stretches).
    delay += (want - delay) * (want > delay ? 0.12 : 0.01);
  }
  // Standing still for a while then setting off: start the walk from "one tick ago", not from
  // when they stopped, or the first step would be stretched across the whole pause.
  if (last && at - last.t > INTERVAL * 1.5) s.push({ t: at - INTERVAL, x: last.x, z: last.z });
  // A teleport (gondola, joining a friend): jump rather than slide across the map.
  if (last && Math.hypot(last.x - x, last.z - z) > 12) s.length = 0;
  s.push({ t: at, x, z });
  if (s.length > HISTORY) s.splice(0, s.length - HISTORY);
}

/** Where to draw the beaver right now. */
export function sampleAt(tr: Track, now = performance.now()): { x: number; z: number } {
  const s = tr.s;
  const t = now - delay;
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
