import { DAM, HUNT, SNOW } from "./minigames";
import { SPLEEF, TD } from "./arcade2";

/**
 * Running your own character ahead of the server in the walking minigames.
 *
 * The server decides where everyone is, and what it tells you is a round trip behind your fingers.
 * Rather than wait for it, the client takes the server's last word about you and replays the last
 * `rtt` milliseconds of your own input through the same movement rules the server uses. When the
 * server and the prediction agree (almost always), your character moves the instant you press a
 * key; when the server disagrees (you were pushed, or fell through the ice) the next answer simply
 * overrides the guess. Only your own character is predicted: everyone else is drawn from the server.
 */

export interface InputSample { t: number; steer: number; fwd: number }
/** What the server last said about us, and when that news reached us (ms). */
export interface ServerSpot { x: number; z: number; at: number }

export type WalkRule =
  | { kind: "free"; speed: number; circle?: number; box?: number }
  | { kind: "slide"; speed: number; half: number };

/** How each walking game moves a player (taken from the games' step() in minigames.ts and arcade2.ts). */
export function walkRule(game: string): WalkRule | null {
  switch (game) {
    case "hunt": return { kind: "free", speed: HUNT.speed, circle: HUNT.radius };
    case "spleef": return { kind: "free", speed: SPLEEF.speed, box: (SPLEEF.n * SPLEEF.cell) / 2 - 0.3 };
    case "td": return { kind: "free", speed: TD.speed, circle: TD.radius };
    case "snowball": return { kind: "slide", speed: SNOW.move, half: SNOW.halfWidth };
    case "dam": return { kind: "slide", speed: DAM.move, half: DAM.halfWidth };
    default: return null;
  }
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * Where our character is once the server has caught up with our input. `log` holds the steer/fwd values
 * we have been *sending* (newest last). `mirror` is true for snowball's second team, which the server
 * mirrors (see SnowSim.step).
 */
export function predictWalk(rule: WalkRule, srv: ServerSpot, log: InputSample[], now: number, rtt: number, mirror = false): { x: number; z: number } {
  let x = srv.x, z = srv.z, i = 0, steer = 0, fwd = 0;
  for (let t = srv.at - rtt; t < now;) {
    const stepMs = Math.min(1000 / 60, now - t), dt = stepMs / 1000;
    while (i < log.length && log[i].t <= t) { steer = log[i].steer; fwd = log[i].fwd; i++; }
    if (rule.kind === "slide") {
      const mv = clamp(mirror ? -steer : steer, -1, 1);
      x = clamp(x + mv * rule.speed * dt, -rule.half, rule.half);
    } else {
      const mx = clamp(steer, -1, 1), mz = clamp(-fwd, -1, 1);
      const l = Math.hypot(mx, mz);
      if (l > 0.05) {
        const k = Math.min(1, l);
        x += (mx / l) * rule.speed * k * dt;
        z += (mz / l) * rule.speed * k * dt;
        if (rule.box !== undefined) { x = clamp(x, -rule.box, rule.box); z = clamp(z, -rule.box, rule.box); }
        if (rule.circle !== undefined) {
          const r = Math.hypot(x, z);
          if (r > rule.circle) { x *= rule.circle / r; z *= rule.circle / r; }
        }
      }
    }
    t += stepMs;
  }
  return { x, z };
}
