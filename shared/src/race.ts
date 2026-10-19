import { clamp, mulberry32 } from "./rng";
import { RACE } from "./constants";

/**
 * Toboggan Rush — the first minigame.
 *
 * Racers slide down a winding snowy run. Steer left/right to dodge rocks, pines and snowmen,
 * and slide through glowing snowflake rings for a speed boost. First to the bottom wins.
 *
 * The simulation is deterministic and runs on the game server (authoritative).
 * The offline preview reuses the exact same code locally.
 */

export const TRACK = {
  length: 520,
  halfWidth: 8,
  baseSpeed: 24,
  boostSpeed: 35,
  steerSpeed: 11,
  stunSeconds: 0.9,
  boostSeconds: 1.6,
  racerRadius: 0.6,
  gateRadius: 1.9,
  /** Visual slope: height drop per unit along the track. */
  slope: 0.32,
} as const;

/** Track centreline wiggle, so the run curves through the forest. */
export function trackCenterX(z: number): number {
  return 10 * Math.sin(z / 55) + 4 * Math.sin(z / 23);
}

export type ObstacleKind = "rock" | "pine" | "snowman";

export interface Obstacle {
  id: number;
  kind: ObstacleKind;
  x: number; // lateral offset from centreline
  z: number;
  r: number;
}

export interface Gate {
  id: number;
  x: number;
  z: number;
}

export interface TrackLayout {
  obstacles: Obstacle[];
  gates: Gate[];
}

export function buildTrack(seed: number): TrackLayout {
  const rand = mulberry32(seed);
  const obstacles: Obstacle[] = [];
  const gates: Gate[] = [];
  let id = 0;
  for (let z = 45; z < TRACK.length - 30; z += 9 + rand() * 9) {
    const count = rand() < 0.3 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const roll = rand();
      const kind: ObstacleKind = roll < 0.45 ? "rock" : roll < 0.85 ? "pine" : "snowman";
      const r = kind === "rock" ? 1.1 : kind === "pine" ? 1.0 : 0.9;
      obstacles.push({ id: id++, kind, x: (rand() * 2 - 1) * (TRACK.halfWidth - 1.2), z: z + k * 2.5, r });
    }
  }
  for (let z = 70; z < TRACK.length - 40; z += 40 + rand() * 20) {
    // Keep rings away from obstacles at the same z.
    let x = (rand() * 2 - 1) * (TRACK.halfWidth - 2);
    for (let tries = 0; tries < 6; tries++) {
      const clash = obstacles.some((o) => Math.abs(o.z - z) < 4 && Math.abs(o.x - x) < 3);
      if (!clash) break;
      x = (rand() * 2 - 1) * (TRACK.halfWidth - 2);
    }
    gates.push({ id: id++, x, z });
  }
  return { obstacles, gates };
}

export interface Entrant {
  id: string;
  name: string;
  isBot: boolean;
}

export interface RacerState {
  id: string;
  name: string;
  isBot: boolean;
  x: number;
  z: number;
  speed: number;
  steer: number;
  stunUntil: number;
  boostUntil: number;
  finishedAt: number | null;
  hits: number[];
  boosts: number[];
}

export interface RaceResult {
  id: string;
  name: string;
  isBot: boolean;
  place: number;
  finished: boolean;
  time: number | null;
}

export class TobogganRace {
  readonly layout: TrackLayout;
  readonly racers: RacerState[];
  t = 0;
  private botSkill = new Map<string, number>();
  private botRand: () => number;

  constructor(readonly seed: number, entrants: Entrant[]) {
    this.layout = buildTrack(seed);
    this.botRand = mulberry32(seed ^ 0x9e3779b9);
    const lanes = entrants.length;
    this.racers = entrants.map((e, i) => {
      if (e.isBot) this.botSkill.set(e.id, 0.55 + this.botRand() * 0.3);
      return {
        ...e,
        x: lanes > 1 ? -TRACK.halfWidth * 0.6 + (i * (TRACK.halfWidth * 1.2)) / (lanes - 1) : 0,
        z: 0,
        speed: 0,
        steer: 0,
        stunUntil: 0,
        boostUntil: 0,
        finishedAt: null,
        hits: [],
        boosts: [],
      };
    });
  }

  /** Advance the simulation. `inputs` maps player id → steer value in [-1, 1]. Bots steer themselves. */
  step(dt: number, inputs: Record<string, number>): void {
    this.t += dt;
    for (const r of this.racers) {
      if (r.finishedAt !== null) continue;
      const wanted = r.isBot ? this.botSteer(r) : clamp(Number(inputs[r.id]) || 0, -1, 1);
      // Smooth steering so it feels like a sled, not a cursor.
      r.steer += (wanted - r.steer) * Math.min(1, dt * 10);
      const stunned = this.t < r.stunUntil;
      const boosting = this.t < r.boostUntil;
      const target = stunned ? 6 : (boosting ? TRACK.boostSpeed : TRACK.baseSpeed) - Math.abs(r.steer) * 2;
      r.speed += (target - r.speed) * Math.min(1, dt * (boosting ? 2.5 : 0.9));
      if (!stunned) r.x += r.steer * TRACK.steerSpeed * dt;
      const edge = TRACK.halfWidth - TRACK.racerRadius;
      if (Math.abs(r.x) > edge) {
        r.x = Math.sign(r.x) * edge;
        r.speed *= 1 - Math.min(1, dt * 1.5); // snowbank drag
      }
      const prevZ = r.z;
      r.z += r.speed * dt;

      for (const o of this.layout.obstacles) {
        if (o.z < prevZ - 1 || o.z > r.z + 1) continue;
        if (r.hits.includes(o.id)) continue;
        if (Math.abs(r.x - o.x) < o.r + TRACK.racerRadius && prevZ <= o.z + 0.5 && r.z >= o.z - 0.5) {
          r.hits.push(o.id);
          r.stunUntil = this.t + TRACK.stunSeconds;
          r.boostUntil = 0;
          r.speed *= 0.35;
        }
      }
      for (const g of this.layout.gates) {
        if (r.boosts.includes(g.id)) continue;
        if (prevZ <= g.z && r.z >= g.z && Math.abs(r.x - g.x) < TRACK.gateRadius) {
          r.boosts.push(g.id);
          r.boostUntil = this.t + TRACK.boostSeconds;
        }
      }
      if (r.z >= TRACK.length) {
        // Interpolate the exact crossing time for fair ordering.
        const over = (r.z - TRACK.length) / Math.max(r.speed, 0.001);
        r.finishedAt = this.t - over;
        r.z = TRACK.length;
      }
    }
  }

  private botSteer(r: RacerState): number {
    const skill = this.botSkill.get(r.id) ?? 0.6;
    const look = 8 + skill * 22;
    // Dodge the nearest obstacle in our path (low-skill bots miss some).
    let threat: { x: number; dz: number } | null = null;
    for (const o of this.layout.obstacles) {
      const dz = o.z - r.z;
      if (dz < 0 || dz > look) continue;
      if (Math.abs(o.x - r.x) > o.r + 1.4) continue;
      if (((o.id * 2654435761) % 1000) / 1000 > skill + 0.2) continue; // deterministic "didn't see it"
      if (!threat || dz < threat.dz) threat = { x: o.x, dz };
    }
    if (threat) {
      const goRight = threat.x < r.x || (threat.x === r.x && r.x < 0);
      const room = goRight ? TRACK.halfWidth - r.x : TRACK.halfWidth + r.x;
      const dir = room < 2 ? (goRight ? -1 : 1) : goRight ? 1 : -1;
      return dir;
    }
    // Head for the next boost ring if we're good enough.
    const gate = this.layout.gates.find((g) => g.z > r.z && g.z - r.z < 45);
    if (gate && ((gate.id * 40503) % 100) / 100 < skill) {
      return clamp((gate.x - r.x) * 0.5, -1, 1);
    }
    return clamp(-r.x * 0.08 + Math.sin(this.t * 0.7 + skill * 10) * 0.25, -1, 1);
  }

  isOver(): boolean {
    return this.racers.every((r) => r.finishedAt !== null) || this.t >= RACE.timeLimitS;
  }

  results(): RaceResult[] {
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt;
      if (a.finishedAt !== null) return -1;
      if (b.finishedAt !== null) return 1;
      return b.z - a.z;
    });
    return sorted.map((r, i) => ({
      id: r.id,
      name: r.name,
      isBot: r.isBot,
      place: i + 1,
      finished: r.finishedAt !== null,
      time: r.finishedAt === null ? null : Math.round(r.finishedAt * 100) / 100,
    }));
  }

  snapshot() {
    return this.racers.map((r) => ({
      id: r.id,
      x: Math.round(r.x * 100) / 100,
      z: Math.round(r.z * 100) / 100,
      speed: Math.round(r.speed * 10) / 10,
      steer: Math.round(r.steer * 100) / 100,
      stun: this.t < r.stunUntil,
      boost: this.t < r.boostUntil,
      done: r.finishedAt !== null,
    }));
  }
}

export type RaceSnapshot = ReturnType<TobogganRace["snapshot"]>;

export const BOT_NAMES = ["Maple", "Birch", "Pebble", "Timber", "Juniper", "Willow", "Aspen", "Cedar"];
