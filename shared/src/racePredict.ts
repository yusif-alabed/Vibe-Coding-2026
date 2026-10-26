import { TRACK } from "./race";

/** What the server last told us about our own sled, and when that news reached us (ms). */
export interface ServerSled { x: number; steer: number; stun: boolean; at: number }
export interface SteerSample { t: number; v: number }

/**
 * Where our sled will be sideways once the server has caught up with our steering.
 *
 * The server's picture is a round trip behind our fingers: it has not yet seen the last `rtt`
 * milliseconds of steering. So start from its last word and replay those milliseconds of our own
 * steering through the same rules the server uses (smoothed steering, fixed sideways speed,
 * snowbanks at the edges). Obstacle hits are left to the server to correct.
 */
export function predictLateral(srv: ServerSled, log: SteerSample[], now: number, rtt: number): number {
  if (srv.stun) return srv.x; // can't steer while stunned
  const edge = TRACK.halfWidth - TRACK.racerRadius;
  let x = srv.x, st = srv.steer, v = st, i = 0;
  for (let t = srv.at - rtt; t < now;) {
    const stepMs = Math.min(1000 / 60, now - t), sec = stepMs / 1000;
    while (i < log.length && log[i].t <= t) v = log[i++].v;
    st += (v - st) * Math.min(1, sec * 10);
    x += st * TRACK.steerSpeed * sec;
    if (Math.abs(x) > edge) x = Math.sign(x) * edge;
    t += stepMs;
  }
  return x;
}
