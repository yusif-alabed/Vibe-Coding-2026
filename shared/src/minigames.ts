import { mulberry32 } from "./rng";
import { TobogganRace, type Entrant, type RaceResult } from "./race";

/**
 * The arcade minigames. Like Toboggan Rush they are deterministic simulations that the game server
 * runs (solo mode runs the same code), stepped with each player's input:
 *   steer (-1..1), an optional second axis (forward/back) and a "press" button.
 *
 *  - 🌰 Pinecone Hunt: grab as many golden pinecones as you can in a meadow in 60 s.
 *  - 🪵 Log Rolling: balance on a spinning log on the lake; last beaver standing wins.
 *  - ⛄ Snowball Fight: two teams on the frozen pond, dodge and throw (press) — most hits wins.
 *  - 🦫 Dam Builder: co-op! Catch floating logs to build the dam before the river overflows.
 */

export type ArcadeGame = "hunt" | "logroll" | "snowball" | "dam";
export type MiniGame = "toboggan" | "canoe" | ArcadeGame;
/** Word Lodge games are keyed apart from the arcade ones on the leaderboards. */
export type WordLeaderKey = `word:${"wordle" | "connections" | "crossword" | "bee"}`;
/** Anything that keeps a weekly best. */
export type LeaderGame = MiniGame | "golf" | WordLeaderKey;

export interface PlayerInput { steer: number; fwd: number; press: boolean }

export interface ScoreResult extends RaceResult { score: number }

export interface GameSim {
  t: number;
  step(dt: number, inputs: Record<string, PlayerInput>): void;
  snapshot(): unknown;
  isOver(): boolean;
  results(): ScoreResult[];
}

export const ARCADE_INFO: Record<MiniGame, { name: string; icon: string; how: string; seconds: number; scoreLabel: string; lowerIsBetter?: boolean }> = {
  toboggan: { name: "Toboggan Rush", icon: "🛷", how: "Steer down the mountain, dodge obstacles, hit the boost rings.", seconds: 70, scoreLabel: "time", lowerIsBetter: true },
  canoe: { name: "Canoe Dash", icon: "🛶", how: "Paddle down the river, dodge rocks and logs, ride the rapids.", seconds: 70, scoreLabel: "time", lowerIsBetter: true },
  hunt: { name: "Pinecone Hunt", icon: "🌰", how: "Run around the meadow and grab golden pinecones! Big ones are worth 3.", seconds: 60, scoreLabel: "pinecones" },
  logroll: { name: "Log Rolling", icon: "🪵", how: "Keep your balance on the spinning log: lean against the wobble (A/D), press to hop when it lurches.", seconds: 60, scoreLabel: "seconds" },
  snowball: { name: "Snowball Fight", icon: "⛄", how: "Move along your side (A/D) and press Space to throw. Dodge the snowballs!", seconds: 60, scoreLabel: "hits" },
  dam: { name: "Dam Builder", icon: "🦫", how: "Team up! Slide along the dam (A/D) to catch logs before the water spills over.", seconds: 75, scoreLabel: "logs" },
};

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const rank = (rows: { id: string; name: string; isBot: boolean; score: number; finished: boolean; time: number | null }[], lowerBetter = false): ScoreResult[] =>
  [...rows]
    .sort((a, b) => (Number(b.finished) - Number(a.finished)) || (lowerBetter ? a.score - b.score : b.score - a.score))
    .map((r, i) => ({ ...r, place: i + 1 }));

// ------------------------------------------------------------------ Toboggan / Canoe wrapper

class RaceSim implements GameSim {
  readonly race: TobogganRace;
  constructor(seed: number, entrants: Entrant[]) { this.race = new TobogganRace(seed, entrants); }
  get t() { return this.race.t; }
  step(dt: number, inputs: Record<string, PlayerInput>) {
    const s: Record<string, number> = {};
    for (const [k, v] of Object.entries(inputs)) s[k] = v.steer;
    this.race.step(dt, s);
  }
  snapshot() { return this.race.snapshot(); }
  isOver() { return this.race.isOver(); }
  results(): ScoreResult[] { return this.race.results().map((r) => ({ ...r, score: r.time ?? 999 })); }
}

// ------------------------------------------------------------------ Pinecone Hunt

export const HUNT = { radius: 20, speed: 8, reach: 1.3, cones: 7 } as const;

class HuntSim implements GameSim {
  t = 0;
  private rand: () => number;
  players: { id: string; name: string; isBot: boolean; x: number; z: number; ry: number; score: number; skill: number; tx: number; tz: number }[];
  cones: { id: number; x: number; z: number; big: boolean }[] = [];
  private nextId = 0;

  constructor(seed: number, entrants: Entrant[]) {
    this.rand = mulberry32(seed);
    this.players = entrants.map((e, i) => {
      const a = (i / entrants.length) * Math.PI * 2;
      return { ...e, x: Math.cos(a) * 4, z: Math.sin(a) * 4, ry: a, score: 0, skill: 0.45 + this.rand() * 0.3, tx: 0, tz: 0 };
    });
    for (let i = 0; i < HUNT.cones; i++) this.spawn();
  }

  private spawn() {
    const a = this.rand() * Math.PI * 2, r = Math.sqrt(this.rand()) * (HUNT.radius - 2);
    this.cones.push({ id: this.nextId++, x: Math.cos(a) * r, z: Math.sin(a) * r, big: this.rand() < 0.15 });
  }

  step(dt: number, inputs: Record<string, PlayerInput>) {
    this.t += dt;
    for (const p of this.players) {
      let mx: number, mz: number;
      if (p.isBot) {
        // Head for the closest pinecone (a bit sloppily).
        let best = this.cones[0], bd = Infinity;
        for (const c of this.cones) {
          const d = Math.hypot(c.x - p.x, c.z - p.z) - (c.big ? 4 : 0);
          if (d < bd) { bd = d; best = c; }
        }
        mx = (best?.x ?? 0) - p.x; mz = (best?.z ?? 0) - p.z;
        const l = Math.hypot(mx, mz) || 1;
        mx = (mx / l) * p.skill; mz = (mz / l) * p.skill;
      } else {
        const inp = inputs[p.id] ?? { steer: 0, fwd: 0, press: false };
        mx = clamp(inp.steer, -1, 1); mz = clamp(-inp.fwd, -1, 1);
      }
      const l = Math.hypot(mx, mz);
      if (l > 0.05) {
        const k = Math.min(1, l);
        p.x += (mx / l) * HUNT.speed * k * dt;
        p.z += (mz / l) * HUNT.speed * k * dt;
        p.ry = Math.atan2(mx, mz);
      }
      const r = Math.hypot(p.x, p.z);
      if (r > HUNT.radius) { p.x *= HUNT.radius / r; p.z *= HUNT.radius / r; }
      for (let i = this.cones.length - 1; i >= 0; i--) {
        const c = this.cones[i];
        if (Math.hypot(c.x - p.x, c.z - p.z) < HUNT.reach) {
          p.score += c.big ? 3 : 1;
          this.cones.splice(i, 1);
          this.spawn();
        }
      }
    }
  }
  snapshot() {
    return {
      p: this.players.map((p) => ({ id: p.id, x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100, ry: Math.round(p.ry * 100) / 100, score: p.score })),
      c: this.cones.map((c) => [c.id, Math.round(c.x * 10) / 10, Math.round(c.z * 10) / 10, c.big ? 1 : 0]),
    };
  }
  isOver() { return this.t >= ARCADE_INFO.hunt.seconds; }
  results() { return rank(this.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, score: p.score, finished: true, time: null }))); }
}

// ------------------------------------------------------------------ Log Rolling

class LogSim implements GameSim {
  t = 0;
  private rand: () => number;
  players: { id: string; name: string; isBot: boolean; a: number; w: number; out: number | null; hop: number; skill: number; push: number; pushT: number; lean: number }[];

  constructor(seed: number, entrants: Entrant[]) {
    this.rand = mulberry32(seed);
    this.players = entrants.map((e) => ({ ...e, a: 0, w: 0, out: null, hop: 0, skill: 0.55 + this.rand() * 0.35, push: 0, pushT: 0, lean: 0 }));
  }

  step(dt: number, inputs: Record<string, PlayerInput>) {
    this.t += dt;
    const spin = 1 + this.t / 25; // the log spins faster and faster
    for (const p of this.players) {
      if (p.out !== null) continue;
      // Random lurches from the spinning log.
      p.pushT -= dt;
      if (p.pushT <= 0) {
        p.push = (this.rand() * 2 - 1) * 1.6 * spin;
        p.pushT = 0.35 + this.rand() * 0.6;
      }
      let lean: number, press = false;
      if (p.isBot) {
        // React with a delay that depends on skill.
        lean = clamp(-(p.a * 2.2 + p.w * 0.9) * p.skill, -1, 1);
        if (Math.abs(p.a) > 0.85 && this.rand() < dt * 3 * p.skill) press = true;
      } else {
        const inp = inputs[p.id] ?? { steer: 0, fwd: 0, press: false };
        lean = clamp(inp.steer, -1, 1);
        press = inp.press;
      }
      p.lean = lean;
      if (press && p.hop <= 0) { p.hop = 0.5; p.w *= 0.3; }
      const onLog = p.hop <= 0;
      p.hop = Math.max(0, p.hop - dt);
      // Tipping: gravity pulls further off-balance, leaning pushes back.
      const acc = (onLog ? p.push : 0) + p.a * 2.4 - lean * 3.6;
      p.w += acc * dt;
      p.w *= 1 - dt * 0.8;
      p.a += p.w * dt;
      if (Math.abs(p.a) > 1.25) p.out = this.t;
    }
  }
  snapshot() {
    return this.players.map((p) => ({ id: p.id, a: Math.round(p.a * 100) / 100, hop: p.hop > 0, out: p.out !== null, lean: Math.round(p.lean * 100) / 100 }));
  }
  isOver() {
    const alive = this.players.filter((p) => p.out === null).length;
    return this.t >= ARCADE_INFO.logroll.seconds || alive === 0 || (this.players.length > 1 && alive <= 1 && this.t > 3);
  }
  results() {
    return rank(this.players.map((p) => {
      const s = Math.round((p.out ?? this.t) * 10) / 10;
      return { id: p.id, name: p.name, isBot: p.isBot, score: s, finished: p.out === null, time: s };
    }));
  }
}

// ------------------------------------------------------------------ Snowball Fight

export const SNOW = { halfWidth: 7, gap: 12, speed: 14, move: 6, reload: 0.8, hitR: 0.75 } as const;

class SnowSim implements GameSim {
  t = 0;
  private rand: () => number;
  players: { id: string; name: string; isBot: boolean; team: 0 | 1; x: number; cd: number; score: number; skill: number; wobble: number; hitT: number }[];
  balls: { id: number; team: 0 | 1; x: number; z: number; owner: string }[] = [];
  private nextId = 0;

  constructor(seed: number, entrants: Entrant[]) {
    this.rand = mulberry32(seed);
    this.players = entrants.map((e, i) => ({ ...e, team: (i % 2) as 0 | 1, x: (Math.floor(i / 2) - 0.5) * 4, cd: 1 + this.rand(), score: 0, skill: 0.5 + this.rand() * 0.4, wobble: this.rand() * 9, hitT: 0 }));
  }
  /** z of a team's baseline (team 0 at -gap/2, team 1 at +gap/2). */
  static lineZ(team: 0 | 1) { return team === 0 ? -SNOW.gap / 2 : SNOW.gap / 2; }

  step(dt: number, inputs: Record<string, PlayerInput>) {
    this.t += dt;
    for (const p of this.players) {
      p.cd -= dt;
      p.hitT = Math.max(0, p.hitT - dt);
      let mv: number, press: boolean;
      if (p.isBot) {
        // Dodge the nearest incoming snowball, otherwise line up with an opponent.
        const incoming = this.balls.filter((b) => b.team !== p.team && Math.abs(b.z - SnowSim.lineZ(p.team)) < 5);
        const danger = incoming.find((b) => Math.abs(b.x - p.x) < 1.2);
        const foes = this.players.filter((o) => o.team !== p.team);
        const target = foes[Math.floor((this.t * 0.3 + p.wobble) % foes.length)] ?? foes[0];
        mv = danger ? (p.x > danger.x ? 1 : -1) : clamp(((target?.x ?? 0) - p.x) * 0.8, -1, 1) * p.skill;
        press = !danger && Math.abs((target?.x ?? 0) - p.x) < 1.5 && this.rand() < dt * 4 * p.skill;
      } else {
        const inp = inputs[p.id] ?? { steer: 0, fwd: 0, press: false };
        mv = clamp(p.team === 0 ? inp.steer : -inp.steer, -1, 1);
        press = inp.press;
      }
      p.x = clamp(p.x + mv * SNOW.move * dt, -SNOW.halfWidth, SNOW.halfWidth);
      if (press && p.cd <= 0) {
        p.cd = SNOW.reload;
        this.balls.push({ id: this.nextId++, team: p.team, x: p.x, z: SnowSim.lineZ(p.team), owner: p.id });
      }
    }
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i];
      const dir = b.team === 0 ? 1 : -1;
      const prevZ = b.z;
      b.z += dir * SNOW.speed * dt;
      const foeZ = SnowSim.lineZ(b.team === 0 ? 1 : 0);
      if ((prevZ - foeZ) * (b.z - foeZ) <= 0) {
        const hit = this.players.find((o) => o.team !== b.team && Math.abs(o.x - b.x) < SNOW.hitR);
        if (hit) {
          hit.hitT = 0.6;
          const thrower = this.players.find((o) => o.id === b.owner);
          if (thrower) thrower.score += 1;
        }
        this.balls.splice(i, 1);
      }
    }
  }
  teamScore(team: 0 | 1) { return this.players.filter((p) => p.team === team).reduce((s, p) => s + p.score, 0); }
  snapshot() {
    return {
      p: this.players.map((p) => ({ id: p.id, team: p.team, x: Math.round(p.x * 100) / 100, score: p.score, hit: p.hitT > 0, throw: p.cd > SNOW.reload - 0.25 })),
      b: this.balls.map((b) => [b.id, b.team, Math.round(b.x * 100) / 100, Math.round(b.z * 100) / 100]),
      s: [this.teamScore(0), this.teamScore(1)],
    };
  }
  isOver() { return this.t >= ARCADE_INFO.snowball.seconds; }
  results() {
    const s0 = this.teamScore(0), s1 = this.teamScore(1);
    const winner = s0 === s1 ? -1 : s0 > s1 ? 0 : 1;
    return [...this.players]
      .sort((a, b) => (Number(b.team === winner) - Number(a.team === winner)) || b.score - a.score)
      .map((p, i) => ({ id: p.id, name: p.name, isBot: p.isBot, score: p.score, finished: winner === -1 || p.team === winner, time: null, place: i + 1 }));
  }
}

// ------------------------------------------------------------------ Dam Builder (co-op)

export const DAM = { halfWidth: 6, move: 7, catchR: 1.1, logSpeed: 4.5, goal: 24, startWater: 2, flood: 0.17 } as const;

class DamSim implements GameSim {
  t = 0;
  private rand: () => number;
  players: { id: string; name: string; isBot: boolean; x: number; score: number; skill: number; carry: number }[];
  logs: { id: number; x: number; z: number }[] = [];
  height = 0;
  water: number = DAM.startWater;
  private spawnT = 0;
  private nextId = 0;
  done: "win" | "flood" | null = null;

  constructor(seed: number, entrants: Entrant[]) {
    this.rand = mulberry32(seed);
    this.players = entrants.map((e, i) => ({ ...e, x: (i - (entrants.length - 1) / 2) * 2.5, score: 0, skill: 0.55 + this.rand() * 0.35, carry: 0 }));
  }

  step(dt: number, inputs: Record<string, PlayerInput>) {
    if (this.done) return;
    this.t += dt;
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = 0.7 + this.rand() * 0.6 - Math.min(0.35, this.t / 200);
      this.logs.push({ id: this.nextId++, x: (this.rand() * 2 - 1) * DAM.halfWidth, z: -18 });
    }
    for (const l of this.logs) l.z += DAM.logSpeed * dt;
    for (const p of this.players) {
      let mv: number;
      if (p.isBot) {
        // Go for the log that will arrive soonest within reach, leaving others to teammates.
        const mine = this.logs.filter((l) => l.z < 0.5).sort((a, b) => b.z - a.z).find((l, k) => k % this.players.length === this.players.indexOf(p) % this.players.length) ?? this.logs[0];
        mv = mine ? clamp((mine.x - p.x) * 1.4, -1, 1) * p.skill : 0;
      } else mv = clamp((inputs[p.id] ?? { steer: 0, fwd: 0, press: false }).steer, -1, 1);
      p.x = clamp(p.x + mv * DAM.move * dt, -DAM.halfWidth, DAM.halfWidth);
      p.carry = Math.max(0, p.carry - dt);
    }
    for (let i = this.logs.length - 1; i >= 0; i--) {
      const l = this.logs[i];
      if (l.z < -0.4) continue;
      const catcher = this.players.find((p) => Math.abs(p.x - l.x) < DAM.catchR);
      if (catcher) {
        catcher.score += 1;
        catcher.carry = 0.4;
        this.height += 1;
        this.logs.splice(i, 1);
      } else if (l.z > 1.2) this.logs.splice(i, 1);
    }
    // The river keeps rising; the dam has to stay ahead of it.
    this.water += DAM.flood * dt * (1 + this.t / 60);
    if (this.height >= DAM.goal) this.done = "win";
    else if (this.water > this.height + 6) this.done = "flood";
  }
  snapshot() {
    return {
      p: this.players.map((p) => ({ id: p.id, x: Math.round(p.x * 100) / 100, score: p.score, carry: p.carry > 0 })),
      l: this.logs.map((l) => [l.id, Math.round(l.x * 100) / 100, Math.round(l.z * 100) / 100]),
      h: this.height,
      w: Math.round(this.water * 100) / 100,
      done: this.done,
    };
  }
  isOver() { return this.done !== null || this.t >= ARCADE_INFO.dam.seconds; }
  results() {
    const won = this.done === "win";
    return rank(this.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, score: p.score, finished: won, time: won ? Math.round(this.t * 10) / 10 : null })));
  }
}

export function makeSim(game: MiniGame, seed: number, entrants: Entrant[]): GameSim {
  switch (game) {
    case "hunt": return new HuntSim(seed, entrants);
    case "logroll": return new LogSim(seed, entrants);
    case "snowball": return new SnowSim(seed, entrants);
    case "dam": return new DamSim(seed, entrants);
    default: return new RaceSim(seed, entrants);
  }
}

/** How many coins a result is worth (same scale as the races). */
export function coinsForGame(game: MiniGame, r: ScoreResult, players: number): number {
  const base = [30, 20, 15, 10][r.place - 1] ?? 8;
  if (game === "dam") return r.finished ? 35 + r.score * 2 : 10 + r.score;
  if (game === "hunt") return 8 + r.score * 2 + (r.place === 1 && players > 1 ? 10 : 0);
  if (game === "snowball") return (r.finished ? 25 : 10) + r.score * 2;
  if (game === "logroll") return base;
  return base;
}

/** Monday-based week key, e.g. "2026-W43" (leaderboards reset every week). */
export function weekKey(now = Date.now()): string {
  const d = new Date(now);
  const day = (d.getUTCDay() + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
  const jan1 = Date.UTC(monday.getUTCFullYear(), 0, 1);
  const wk = Math.floor((monday.getTime() - jan1) / (7 * 86400000)) + 1;
  return `${monday.getUTCFullYear()}-W${String(wk).padStart(2, "0")}`;
}

/** Where each minigame is joined from in the village. */
export const GAME_SPOTS: Record<MiniGame, string> = {
  toboggan: "trailhead",
  canoe: "dock",
  hunt: "camp",
  logroll: "lighthouse",
  snowball: "rink",
  dam: "watermill",
};
