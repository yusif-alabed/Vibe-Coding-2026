import { mulberry32 } from "./rng";
import type { Entrant } from "./race";
import type { GameSim, PlayerInput, ScoreResult } from "./minigames";

/**
 * The Downtown games, modelled on games people play in real life. Like every minigame they are
 * deterministic simulations stepped by the server (solo mode runs the identical code), driven only
 * by each player's input: steer (-1..1), fwd (-1..1) and a press button.
 *
 *  - ⛏️ Spleef: dig the snow out from under the others; last beaver standing wins.
 *  - 🏰 Fort Timber (tower defence, co-op): build pinecone launchers to shoo raccoons off the dam path.
 *  - 🏐 Beach Volleyball: two-a-side over the net, first to 7.
 *  - 🏀 Hoop Shoot: an arcade shooting contest, time your release on the meter.
 *  - ⚽ Penalty Shootout: five penalties each against the keeper.
 *  - 🥊 Shadow Boxing: punch, uppercut and duck in time with the coach's calls.
 */

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
const blank: PlayerInput = { steer: 0, fwd: 0, press: false };
const rank = (rows: { id: string; name: string; isBot: boolean; score: number; finished: boolean; time: number | null }[]): ScoreResult[] =>
  [...rows].sort((a, b) => Number(b.finished) - Number(a.finished) || b.score - a.score).map((r, i) => ({ ...r, place: i + 1 }));
const r2 = (v: number) => Math.round(v * 100) / 100;

// ------------------------------------------------------------------ Spleef

export const SPLEEF = { n: 12, cell: 1.6, speed: 5, digTime: 0.25, seconds: 90, crumbleAt: 35, crack: 0.7 } as const;

export class SpleefSim implements GameSim {
  t = 0;
  private rand: () => number;
  /** 1 = solid snow, 2 = cracking (falls in a moment), 0 = dug out. Row-major, n×n, centred on the origin. */
  grid: number[];
  private crackT: number[];
  players: { id: string; name: string; isBot: boolean; x: number; z: number; ry: number; out: number | null; dig: number; skill: number; wander: number }[];
  private crumbleT = 0;

  constructor(seed: number, entrants: Entrant[]) {
    this.rand = mulberry32(seed);
    this.grid = Array(SPLEEF.n * SPLEEF.n).fill(1);
    this.crackT = Array(SPLEEF.n * SPLEEF.n).fill(0);
    const R = (SPLEEF.n * SPLEEF.cell) / 2 - 2;
    this.players = entrants.map((e, i) => {
      const a = (i / entrants.length) * Math.PI * 2 + Math.PI / 4;
      return { ...e, x: Math.cos(a) * R, z: Math.sin(a) * R, ry: Math.atan2(-Math.cos(a), -Math.sin(a)), out: null, dig: 0, skill: 0.5 + this.rand() * 0.35, wander: this.rand() * 9 };
    });
  }

  cellAt(x: number, z: number): number {
    const h = (SPLEEF.n * SPLEEF.cell) / 2;
    const i = Math.floor((x + h) / SPLEEF.cell), j = Math.floor((z + h) / SPLEEF.cell);
    if (i < 0 || j < 0 || i >= SPLEEF.n || j >= SPLEEF.n) return -1;
    return j * SPLEEF.n + i;
  }

  step(dt: number, inputs: Record<string, PlayerInput>) {
    this.t += dt;
    const h = (SPLEEF.n * SPLEEF.cell) / 2 - 0.3;
    for (const p of this.players) {
      if (p.out !== null) continue;
      let mx: number, mz: number, press: boolean;
      if (p.isBot) {
        // Circle the nearest rival at a careful distance, dig toward them now and then, and never
        // knowingly step onto a hole (looking a little ahead, trying a few headings).
        const foes = this.players.filter((o) => o !== p && o.out === null);
        const f = foes.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z))[0];
        let tx = Math.sin(this.t * 0.5 + p.wander) * 4, tz = Math.cos(this.t * 0.4 + p.wander) * 4;
        let dist = 99;
        if (f) {
          dist = Math.hypot(f.x - p.x, f.z - p.z);
          const keep = 2.6 + Math.sin(this.t * 0.8 + p.wander) * 0.8;
          tx = f.x + ((p.x - f.x) / (dist || 1)) * keep; tz = f.z + ((p.z - f.z) / (dist || 1)) * keep;
        }
        // Standing on cracking snow: get off it, toward the nearest solid block.
        const here = this.cellAt(p.x, p.z);
        if (here >= 0 && this.grid[here] === 2) {
          let best = -1, bd = Infinity;
          for (let k = 0; k < this.grid.length; k++) {
            if (this.grid[k] !== 1) continue;
            const cx = ((k % SPLEEF.n) + 0.5) * SPLEEF.cell - (SPLEEF.n * SPLEEF.cell) / 2, cz = (Math.floor(k / SPLEEF.n) + 0.5) * SPLEEF.cell - (SPLEEF.n * SPLEEF.cell) / 2;
            const d = Math.hypot(cx - p.x, cz - p.z);
            if (d < bd) { bd = d; best = k; tx = cx; tz = cz; }
          }
          if (best < 0) { tx = p.x; tz = p.z; }
        }
        let dx = tx - p.x, dz = tz - p.z;
        const want = Math.hypot(dx, dz);
        mx = 0; mz = 0;
        if (want > 0.25) {
          dx /= want; dz /= want;
          for (const turn of [0, 0.6, -0.6, 1.3, -1.3, 2.2, -2.2]) {
            const c = Math.cos(turn), sn = Math.sin(turn);
            const hx = dx * c - dz * sn, hz = dx * sn + dz * c;
            // Sample the path (not just one point) so a diagonal can't clip the corner of a hole.
            const fleeing = here >= 0 && this.grid[here] === 2;
            const safe = [0.3, 0.65, 1.0].every((k) => {
              const a = this.cellAt(p.x + hx * k, p.z + hz * k);
              return a >= 0 && (this.grid[a] === 1 || (fleeing && this.grid[a] === 2 && a === here));
            });
            if (safe) { mx = hx * (0.6 + p.skill * 0.4); mz = hz * (0.6 + p.skill * 0.4); break; }
          }
        }
        // Face the rival before digging toward them.
        if (f && dist < 3.8) p.ry = Math.atan2(f.x - p.x, f.z - p.z);
        press = !!f && dist < 3.8 && this.rand() < dt * 0.9 * p.skill;
      } else {
        const inp = inputs[p.id] ?? blank;
        mx = clamp(inp.steer, -1, 1); mz = clamp(-inp.fwd, -1, 1); press = inp.press;
      }
      const l = Math.hypot(mx, mz);
      if (l > 0.05) {
        const k = Math.min(1, l);
        p.x = clamp(p.x + (mx / l) * SPLEEF.speed * k * dt, -h, h);
        p.z = clamp(p.z + (mz / l) * SPLEEF.speed * k * dt, -h, h);
        p.ry = Math.atan2(mx, mz);
      }
      p.dig = Math.max(0, p.dig - dt);
      if (press && p.dig <= 0) {
        // Dig the block just in front of you (never the one you're standing on).
        p.dig = SPLEEF.digTime;
        const c = this.cellAt(p.x + Math.sin(p.ry) * SPLEEF.cell, p.z + Math.cos(p.ry) * SPLEEF.cell);
        if (c >= 0 && c !== this.cellAt(p.x, p.z) && this.grid[c] === 1) { this.grid[c] = 2; this.crackT[c] = SPLEEF.crack; }
      }
    }
    // Late in the round the edges start crumbling away.
    if (this.t > SPLEEF.crumbleAt) {
      this.crumbleT -= dt;
      if (this.crumbleT <= 0) {
        this.crumbleT = 0.45;
        const solid = this.grid.map((v, i) => (v === 1 ? i : -1)).filter((i) => i >= 0);
        if (solid.length) { const c = solid[Math.floor(this.rand() * solid.length)]; if (this.grid[c] === 1) { this.grid[c] = 2; this.crackT[c] = SPLEEF.crack * 1.5; } }
      }
    }
    for (let c = 0; c < this.grid.length; c++) {
      if (this.grid[c] !== 2) continue;
      this.crackT[c] -= dt;
      if (this.crackT[c] <= 0) this.grid[c] = 0;
    }
    for (const p of this.players) {
      if (p.out !== null) continue;
      const c = this.cellAt(p.x, p.z);
      if (c < 0 || this.grid[c] === 0) p.out = this.t;
    }
  }
  snapshot() {
    return {
      p: this.players.map((p) => ({ id: p.id, x: r2(p.x), z: r2(p.z), ry: r2(p.ry), out: p.out !== null, dig: p.dig > SPLEEF.digTime - 0.15 })),
      g: this.grid.join(""),
    };
  }
  isOver() {
    const alive = this.players.filter((p) => p.out === null).length;
    return this.t >= SPLEEF.seconds || alive === 0 || (this.players.length > 1 && alive <= 1);
  }
  results() {
    return rank(this.players.map((p) => {
      const s = Math.round((p.out ?? this.t) * 10) / 10;
      return { id: p.id, name: p.name, isBot: p.isBot, score: s, finished: p.out === null, time: s };
    }));
  }
}

// ------------------------------------------------------------------ Fort Timber (tower defence)

export const TD = {
  radius: 17, speed: 6, cost: 30, start: 60, bounty: 5, waves: 8, lives: 10, range: 5.2, reload: 0.8, seconds: 170,
  /** The raccoons' trail from the woods to the dam. */
  path: [[-16, -10], [-6, -10], [-6, 4], [6, 4], [6, -6], [14, -6], [14, 10]] as [number, number][],
} as const;

const pathLen = (() => {
  let s = 0;
  for (let i = 0; i < TD.path.length - 1; i++) s += Math.hypot(TD.path[i + 1][0] - TD.path[i][0], TD.path[i + 1][1] - TD.path[i][1]);
  return s;
})();

/** A point along the trail, d metres from the start. */
export function tdPoint(d: number): [number, number] {
  let rest = d;
  for (let i = 0; i < TD.path.length - 1; i++) {
    const [ax, az] = TD.path[i], [bx, bz] = TD.path[i + 1];
    const l = Math.hypot(bx - ax, bz - az);
    if (rest <= l) return [ax + ((bx - ax) * rest) / l, az + ((bz - az) * rest) / l];
    rest -= l;
  }
  return TD.path[TD.path.length - 1];
}
export const TD_PATH_LEN = pathLen;

function distToPath(x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i < TD.path.length - 1; i++) {
    const [ax, az] = TD.path[i], [bx, bz] = TD.path[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

export class TowerSim implements GameSim {
  t = 0;
  private rand: () => number;
  players: { id: string; name: string; isBot: boolean; x: number; z: number; ry: number; score: number; skill: number; plan: [number, number] | null; cd: number }[];
  towers: { x: number; z: number; owner: number; cd: number; aim: number }[] = [];
  foes: { id: number; d: number; hp: number; max: number; speed: number; hit: number }[] = [];
  shots: { x: number; z: number; tx: number; tz: number; t: number }[] = [];
  wave = 0;
  lives: number = TD.lives;
  coins: number = TD.start;
  private toSpawn = 0;
  private spawnT = 0;
  private breakT = 4;
  private nextId = 0;
  done: "win" | "lose" | null = null;

  constructor(seed: number, entrants: Entrant[]) {
    this.rand = mulberry32(seed);
    this.players = entrants.map((e, i) => ({ ...e, x: -4 + i * 2.5, z: 10, ry: Math.PI, score: 0, skill: 0.6 + this.rand() * 0.3, plan: null, cd: 1 + i }));
  }

  canBuild(x: number, z: number) {
    return distToPath(x, z) > 1.6 && Math.hypot(x, z) < TD.radius - 0.5 && this.towers.every((t) => Math.hypot(t.x - x, t.z - z) > 2.2);
  }

  step(dt: number, inputs: Record<string, PlayerInput>) {
    if (this.done) return;
    this.t += dt;
    // Waves: a short break, then a line of raccoons; each wave has more of them, a little tougher.
    if (this.toSpawn === 0 && this.foes.length === 0) {
      this.breakT -= dt;
      if (this.breakT <= 0) {
        if (this.wave >= TD.waves) { this.done = "win"; return; }
        this.wave += 1;
        this.toSpawn = 4 + this.wave * 2;
        this.spawnT = 0;
        this.breakT = 5;
      }
    }
    if (this.toSpawn > 0) {
      this.spawnT -= dt;
      if (this.spawnT <= 0) {
        this.spawnT = Math.max(0.45, 1.1 - this.wave * 0.07);
        this.toSpawn -= 1;
        const hp = 2 + Math.floor(this.wave * 1.3) + (this.wave >= 6 && this.toSpawn === 0 ? 8 : 0);
        this.foes.push({ id: this.nextId++, d: 0, hp, max: hp, speed: 2.2 + this.wave * 0.12, hit: 0 });
      }
    }
    // Beavers walk about and build.
    for (const [i, p] of this.players.entries()) {
      let mx: number, mz: number, press: boolean;
      p.cd -= dt;
      if (p.isBot) {
        if (!p.plan || !this.canBuild(...p.plan)) {
          // Pick a spot beside the trail near a bend, where a launcher covers the most path.
          let best: [number, number] | null = null, bs = -1;
          for (let k = 0; k < 14; k++) {
            const d = this.rand() * pathLen;
            const [px, pz] = tdPoint(d);
            const a = this.rand() * Math.PI * 2;
            const cx = px + Math.cos(a) * 2.6, cz = pz + Math.sin(a) * 2.6;
            if (!this.canBuild(cx, cz)) continue;
            let cover = 0;
            for (let s = 0; s < pathLen; s += 1) { const q = tdPoint(s); if (Math.hypot(q[0] - cx, q[1] - cz) < TD.range) cover++; }
            if (cover > bs) { bs = cover; best = [cx, cz]; }
          }
          p.plan = best;
        }
        const [tx, tz] = p.plan ?? [p.x, p.z];
        mx = tx - p.x; mz = tz - p.z;
        const l = Math.hypot(mx, mz);
        if (l > 0.3) { mx = (mx / l) * p.skill; mz = (mz / l) * p.skill; } else { mx = 0; mz = 0; }
        press = l < 0.5 && p.cd <= 0 && this.coins >= TD.cost;
      } else {
        const inp = inputs[p.id] ?? blank;
        mx = clamp(inp.steer, -1, 1); mz = clamp(-inp.fwd, -1, 1); press = inp.press;
      }
      const l = Math.hypot(mx, mz);
      if (l > 0.05) {
        const k = Math.min(1, l);
        p.x += (mx / l) * TD.speed * k * dt;
        p.z += (mz / l) * TD.speed * k * dt;
        const r = Math.hypot(p.x, p.z);
        if (r > TD.radius) { p.x *= TD.radius / r; p.z *= TD.radius / r; }
        p.ry = Math.atan2(mx, mz);
      }
      if (press && this.coins >= TD.cost && this.canBuild(p.x, p.z)) {
        this.coins -= TD.cost;
        this.towers.push({ x: p.x, z: p.z, owner: i, cd: 0.3, aim: 0 });
        p.score += 3;
        p.cd = 2;
        p.plan = null;
      }
    }
    // Raccoons trundle toward the dam; reaching it costs a life.
    for (const f of this.foes) {
      f.d += f.speed * dt;
      f.hit = Math.max(0, f.hit - dt);
    }
    for (let i = this.foes.length - 1; i >= 0; i--) {
      if (this.foes[i].d >= pathLen) {
        this.foes.splice(i, 1);
        this.lives -= 1;
        if (this.lives <= 0) { this.done = "lose"; return; }
      }
    }
    // Launchers lob pinecones at the raccoon furthest along the trail within range.
    for (const t of this.towers) {
      t.cd -= dt;
      if (t.cd > 0) continue;
      let target: (typeof this.foes)[number] | null = null;
      for (const f of this.foes) {
        const [fx, fz] = tdPoint(f.d);
        if (Math.hypot(fx - t.x, fz - t.z) <= TD.range && (!target || f.d > target.d)) target = f;
      }
      if (!target) continue;
      t.cd = TD.reload;
      const [fx, fz] = tdPoint(target.d);
      t.aim = Math.atan2(fx - t.x, fz - t.z);
      this.shots.push({ x: t.x, z: t.z, tx: fx, tz: fz, t: 0 });
      target.hp -= 1;
      target.hit = 0.15;
      if (target.hp <= 0) {
        this.foes.splice(this.foes.indexOf(target), 1);
        this.coins += TD.bounty;
        this.players[t.owner].score += 1;
      }
    }
    for (const s of this.shots) s.t += dt;
    this.shots = this.shots.filter((s) => s.t < 0.35);
  }
  snapshot() {
    return {
      p: this.players.map((p) => ({ id: p.id, x: r2(p.x), z: r2(p.z), ry: r2(p.ry), score: p.score })),
      tw: this.towers.map((t) => [r2(t.x), r2(t.z), t.owner, r2(t.aim)]),
      f: this.foes.map((f) => [f.id, r2(f.d), f.hp, f.max, f.hit > 0 ? 1 : 0]),
      sh: this.shots.map((s) => [r2(s.x), r2(s.z), r2(s.tx), r2(s.tz), r2(s.t)]),
      wave: this.wave, lives: this.lives, coins: this.coins, done: this.done,
      next: this.toSpawn === 0 && this.foes.length === 0 ? Math.ceil(this.breakT) : 0,
    };
  }
  isOver() { return this.done !== null || this.t >= TD.seconds; }
  results() {
    const won = this.done === "win" || (this.done === null && this.lives > 0);
    return rank(this.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, score: p.score + (won ? 10 : 0), finished: won, time: null })));
  }
}

// ------------------------------------------------------------------ Beach volleyball

export const VOLLEY = { half: 8, net: 2.3, g: 14, move: 7, jump: 7.5, reach: 0.85, toWin: 7, seconds: 150 } as const;

export class VolleySim implements GameSim {
  t = 0;
  private rand: () => number;
  players: { id: string; name: string; isBot: boolean; team: 0 | 1; x: number; y: number; vy: number; skill: number; touch: number; err: number }[];
  ball = { x: -4, y: 4, vx: 0, vy: 0 };
  score: [number, number] = [0, 0];
  private serveT = 1.2;
  private servingTeam: 0 | 1 = 0;
  lastPoint = -1;
  private lastTouch: 0 | 1 = 0;

  constructor(seed: number, entrants: Entrant[]) {
    this.rand = mulberry32(seed);
    this.players = entrants.map((e, i) => {
      const team = (i % 2) as 0 | 1;
      const slot = Math.floor(i / 2);
      const x = (team === 0 ? -1 : 1) * (2.5 + slot * 3);
      return { ...e, team, x, y: 0, vy: 0, skill: 0.55 + this.rand() * 0.35, touch: 0, err: 0 };
    });
    this.resetServe();
  }

  private resetServe() {
    const s = this.servingTeam === 0 ? -1 : 1;
    this.ball = { x: s * 5, y: 4.2, vx: 0, vy: 0 };
    this.serveT = 1.2;
  }

  /** Where the ball will come down (for bots). */
  private landingX() {
    let { x, y, vx, vy } = this.ball;
    for (let i = 0; i < 200 && y > 1.3; i++) { vy -= VOLLEY.g * 0.02; x += vx * 0.02; y += vy * 0.02; if (Math.abs(x) > VOLLEY.half) vx = -vx; }
    return x;
  }

  private lastSide = 0;

  step(dt: number, inputs: Record<string, PlayerInput>) {
    this.t += dt;
    const landing = this.landingX();
    // Each time the ball comes over, every bot misjudges it a little (more if less skilled).
    const ballSide = Math.sign(this.ball.vx);
    if (ballSide !== this.lastSide) {
      this.lastSide = ballSide;
      for (const p of this.players) p.err = (this.rand() - 0.5) * 2 * (1.0 + (1 - p.skill) * 3.2);
    }
    for (const p of this.players) {
      const side = p.team === 0 ? -1 : 1;
      let mv: number, jump: boolean;
      if (p.isBot) {
        const mates = this.players.filter((o) => o.team === p.team);
        const mine = Math.sign(landing) === side;
        const target = mine ? landing + side * 0.4 + p.err : side * (2.5 + mates.indexOf(p) * 3);
        // Teammates share the ball: the closer one goes for it.
        const closest = mates.reduce((a, b) => (Math.abs(a.x - landing) < Math.abs(b.x - landing) ? a : b));
        const goal = mine && closest !== p ? side * (2 + mates.indexOf(p) * 4) : target;
        mv = clamp((goal - p.x) * 2, -1, 1) * (0.55 + p.skill * 0.35);
        jump = mine && closest === p && Math.abs(this.ball.x - p.x) < 1.6 && this.ball.y < 4 && this.ball.y > 2 && this.ball.vy < 0 && this.rand() < 0.4;
      } else {
        const inp = inputs[p.id] ?? blank;
        mv = clamp(inp.steer, -1, 1); jump = inp.press || inp.fwd > 0.5;
      }
      p.x += mv * VOLLEY.move * dt;
      // Stay on your own side of the net.
      p.x = side < 0 ? clamp(p.x, -VOLLEY.half + 0.5, -0.6) : clamp(p.x, 0.6, VOLLEY.half - 0.5);
      if (jump && p.y <= 0) p.vy = VOLLEY.jump;
      p.vy -= VOLLEY.g * dt;
      p.y = Math.max(0, p.y + p.vy * dt);
      if (p.y <= 0) p.vy = 0;
      p.touch = Math.max(0, p.touch - dt);
    }
    if (this.serveT > 0) { this.serveT -= dt; return; }
    const b = this.ball;
    b.vy -= VOLLEY.g * 0.55 * dt; // a floaty beach ball
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (Math.abs(b.x) > VOLLEY.half + 1) { b.x = Math.sign(b.x) * (VOLLEY.half + 1); b.vx = -b.vx * 0.6; }
    // The net.
    if (Math.abs(b.x) < 0.25 && b.y < VOLLEY.net) { b.x = Math.sign(b.vx || 1) * -0.26; b.vx = -b.vx * 0.5; }
    if (Math.abs(b.x) < 0.25 && b.y >= VOLLEY.net && b.y < VOLLEY.net + 0.3 && b.vy < 0) { b.vy = Math.abs(b.vy) * 0.5; }
    // Beavers bump the ball up and over.
    for (const p of this.players) {
      const hx = p.x, hy = p.y + 1.5;
      const dx = b.x - hx, dy = b.y - hy;
      const d = Math.hypot(dx, dy);
      if (d < VOLLEY.reach + 0.35 && p.touch <= 0) {
        const side = p.team === 0 ? -1 : 1;
        const nx = dx / (d || 1), ny = Math.max(0.35, dy / (d || 1));
        // A jump spike is harder and flatter; every touch has a little wobble, so rallies end.
        const spike = p.y > 0.3;
        const pow = 9 + (spike ? 2.5 : 0);
        b.vx = nx * pow * 0.6 - side * (3.4 + this.rand() * (spike ? 4.5 : 2.6));
        b.vy = ny * pow * (spike ? 0.75 : 1);
        p.touch = 0.25;
        this.lastTouch = p.team;
      }
    }
    if (b.y <= 0.3) {
      // Landing in a court scores for the other side; landing out scores against whoever touched it last.
      const out = Math.abs(b.x) > VOLLEY.half;
      const winner: 0 | 1 = out ? (this.lastTouch === 0 ? 1 : 0) : b.x < 0 ? 1 : 0;
      this.score[winner] += 1;
      this.servingTeam = winner;
      this.lastPoint = this.t;
      this.resetServe();
    }
  }
  snapshot() {
    return {
      p: this.players.map((p) => ({ id: p.id, team: p.team, x: r2(p.x), y: r2(p.y) })),
      b: [r2(this.ball.x), r2(this.ball.y)],
      s: this.score,
      serve: this.serveT > 0,
    };
  }
  isOver() { return this.score[0] >= VOLLEY.toWin || this.score[1] >= VOLLEY.toWin || this.t >= VOLLEY.seconds; }
  results() {
    const w = this.score[0] === this.score[1] ? -1 : this.score[0] > this.score[1] ? 0 : 1;
    return [...this.players]
      .sort((a, b) => Number(b.team === w) - Number(a.team === w))
      .map((p, i) => ({ id: p.id, name: p.name, isBot: p.isBot, score: this.score[p.team], finished: w === -1 || p.team === w, time: null, place: i + 1 }));
  }
}

// ------------------------------------------------------------------ Hoop Shoot (arcade basketball)

export const HOOPS = { seconds: 60, deepAt: 40, meterHz: 0.9, flight: 0.9 } as const;

/** Where a shot meter is (0..1, 0.5 = perfect) at time t for a player whose meter started at phase. */
export function hoopMeter(t: number, phase: number) {
  return 0.5 + 0.5 * Math.sin((t * HOOPS.meterHz + phase) * Math.PI * 2);
}

export class HoopSim implements GameSim {
  t = 0;
  private rand: () => number;
  players: { id: string; name: string; isBot: boolean; phase: number; score: number; cd: number; last: { t: number; made: boolean; swish: boolean } | null; skill: number; streak: number; aim: number }[];

  constructor(seed: number, entrants: Entrant[]) {
    this.rand = mulberry32(seed);
    this.players = entrants.map((e) => ({ ...e, phase: this.rand(), score: 0, cd: 1, last: null, skill: 0.55 + this.rand() * 0.35, streak: 0, aim: -1 }));
  }

  step(dt: number, inputs: Record<string, PlayerInput>) {
    this.t += dt;
    for (const p of this.players) {
      p.cd = Math.max(0, p.cd - dt);
      const m = hoopMeter(this.t, p.phase);
      let press: boolean;
      if (p.isBot) {
        // Like a person: pick how full the meter should be this shot, and sometimes jump the gun.
        if (p.aim < 0) p.aim = 0.5 + this.rand() * (0.3 + p.skill * 0.18);
        press = p.cd <= 0 && Math.abs(m - 0.5) * 2 >= p.aim;
      } else press = (inputs[p.id] ?? blank).press;
      if (!press || p.cd > 0) continue;
      // The meter peaks are the sweet spot (closest to 1 or 0 swings → full arc). Accuracy = distance from a peak.
      const acc = Math.abs(Math.abs(m - 0.5) * 2 - 1); // 0 perfect … 1 worst
      const swish = acc < 0.08;
      const made = swish || (acc < 0.22 && this.rand() < 0.65) || (acc < 0.4 && this.rand() < 0.2);
      const deep = this.t >= HOOPS.deepAt;
      if (made) { p.score += deep ? 3 : 2; p.streak += 1; } else p.streak = 0;
      if (p.streak >= 3 && made) p.score += 1; // on fire!
      p.last = { t: this.t, made, swish };
      p.cd = 1.6; // chase the rebound
      p.aim = -1;
    }
  }
  snapshot() {
    return {
      p: this.players.map((p) => ({ id: p.id, ph: r2(p.phase), score: p.score, streak: p.streak, last: p.last ? [r2(p.last.t), p.last.made ? 1 : 0, p.last.swish ? 1 : 0] : null })),
      deep: this.t >= HOOPS.deepAt,
    };
  }
  isOver() { return this.t >= HOOPS.seconds; }
  results() { return rank(this.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, score: p.score, finished: true, time: null }))); }
}

// ------------------------------------------------------------------ Penalty shootout

export const PENS = { kicks: 5, aimTime: 4, flight: 0.7, rest: 1.6, goalW: 7.3, goalH: 2.44, meterHz: 0.8 } as const;

export class PenaltySim implements GameSim {
  t = 0;
  private rand: () => number;
  players: {
    id: string; name: string; isBot: boolean; kick: number; goals: number; phaseT: number; state: "aim" | "flight" | "rest" | "done";
    ax: number; ay: number; meterPh: number; skill: number;
    last: { x: number; y: number; dive: number; goal: boolean; saved: boolean; miss: boolean } | null;
  }[];

  constructor(seed: number, entrants: Entrant[]) {
    this.rand = mulberry32(seed);
    this.players = entrants.map((e) => ({ ...e, kick: 0, goals: 0, phaseT: 0, state: "aim", ax: 0, ay: 0.4, meterPh: this.rand(), skill: 0.5 + this.rand() * 0.4, last: null }));
  }

  step(dt: number, inputs: Record<string, PlayerInput>) {
    this.t += dt;
    for (const p of this.players) {
      if (p.state === "done") continue;
      p.phaseT += dt;
      if (p.state === "flight" && p.phaseT >= PENS.flight) { p.state = "rest"; p.phaseT = 0; }
      if (p.state === "rest" && p.phaseT >= PENS.rest) {
        p.kick += 1;
        p.state = p.kick >= PENS.kicks ? "done" : "aim";
        p.phaseT = 0; p.ax = 0; p.ay = 0.4;
      }
      if (p.state !== "aim") continue;
      let press: boolean;
      const meter = 0.5 + 0.5 * Math.sin((this.t * PENS.meterHz + p.meterPh) * Math.PI * 2);
      if (p.isBot) {
        const wantX = (p.kick % 2 ? 1 : -1) * (0.55 + this.rand() * 0.4);
        p.ax += clamp(wantX - p.ax, -dt * 2, dt * 2);
        p.ay += clamp(0.35 - p.ay, -dt, dt);
        press = p.phaseT > 1.6 && Math.abs(meter - 0.7) < 0.1 + 0.1 * (1 - p.skill);
      } else {
        const inp = inputs[p.id] ?? blank;
        p.ax = clamp(p.ax + inp.steer * dt * 1.4, -1, 1);
        p.ay = clamp(p.ay + inp.fwd * dt * 1.2, 0, 1);
        press = inp.press;
      }
      if (press || p.phaseT >= PENS.aimTime) {
        // Power: too little and the keeper gets to it; too much and it sails over.
        const power = press ? meter : 0.4;
        const sx = p.ax * (PENS.goalW / 2) * (0.9 + (this.rand() - 0.5) * 0.2 * (1 - power));
        const sy = p.ay * PENS.goalH + (power - 0.7) * 1.6;
        const miss = Math.abs(sx) > PENS.goalW / 2 - 0.1 || sy > PENS.goalH - 0.05 || sy < 0;
        // The keeper guesses a side; a hard, well-placed shot beats even a good guess.
        const dive = this.rand() < 0.34 ? 0 : this.rand() < 0.5 ? -1 : 1;
        const reach = dive === 0 ? Math.abs(sx) < 1.1 : Math.sign(sx) === dive && Math.abs(sx) < 3.1 && sy < 1.9;
        const beat = power > 0.6 && Math.abs(sx) > 2.6;
        const saved = !miss && reach && !beat;
        const goal = !miss && !saved;
        if (goal) p.goals += 1;
        p.last = { x: r2(sx), y: r2(Math.max(0, sy)), dive, goal, saved, miss };
        p.state = "flight"; p.phaseT = 0;
      }
    }
  }
  snapshot() {
    return {
      p: this.players.map((p) => ({ id: p.id, kick: p.kick, goals: p.goals, st: p.state, pt: r2(p.phaseT), ax: r2(p.ax), ay: r2(p.ay), mp: r2(p.meterPh), last: p.last })),
    };
  }
  isOver() { return this.players.every((p) => p.state === "done"); }
  results() { return rank(this.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, score: p.goals, finished: true, time: null }))); }
}

// ------------------------------------------------------------------ Shadow boxing

export type BoxMove = "L" | "R" | "U" | "D";
export const BOX = { seconds: 60, window: 0.32, perfect: 0.12 } as const;

/** The coach's calls for a round: identical for everyone (the client draws them from the same seed). */
export function boxCues(seed: number): { t: number; m: BoxMove }[] {
  const rand = mulberry32(seed ^ 0x5eed);
  const out: { t: number; m: BoxMove }[] = [];
  let t = 2;
  const moves: BoxMove[] = ["L", "R", "U", "D"];
  while (t < BOX.seconds - 0.5) {
    out.push({ t: Math.round(t * 100) / 100, m: moves[Math.floor(rand() * 4)] });
    t += Math.max(0.55, 1.05 - t / 120) * (rand() < 0.2 ? 0.5 : 1);
  }
  return out;
}

export class BoxSim implements GameSim {
  t = 0;
  private rand: () => number;
  cues: { t: number; m: BoxMove }[];
  players: { id: string; name: string; isBot: boolean; score: number; combo: number; best: number; prev: BoxMove | null; done: Set<number>; last: { m: BoxMove; ok: boolean; perfect: boolean; t: number } | null; skill: number }[];

  constructor(seed: number, entrants: Entrant[]) {
    this.rand = mulberry32(seed);
    this.cues = boxCues(seed);
    this.players = entrants.map((e) => ({ ...e, score: 0, combo: 0, best: 0, prev: null, done: new Set(), last: null, skill: 0.6 + this.rand() * 0.3 }));
  }

  private move(inp: PlayerInput): BoxMove | null {
    if (inp.fwd > 0.5) return "U";
    if (inp.fwd < -0.5) return "D";
    if (inp.steer < -0.5) return "L";
    if (inp.steer > 0.5) return "R";
    return null;
  }

  step(dt: number, inputs: Record<string, PlayerInput>) {
    this.t += dt;
    for (const p of this.players) {
      let m: BoxMove | null;
      if (p.isBot) {
        const due = this.cues.findIndex((c, i) => !p.done.has(i) && Math.abs(c.t - this.t) < 0.05 + (1 - p.skill) * 0.15);
        m = due >= 0 && this.rand() < 0.2 + p.skill * 0.45 ? (this.rand() < 0.55 + p.skill * 0.35 ? this.cues[due].m : "D") : null;
        if (m) p.prev = null;
      } else m = this.move(inputs[p.id] ?? blank);
      const fresh = m !== null && m !== p.prev;
      p.prev = m;
      if (fresh && m) {
        const idx = this.cues.findIndex((c, i) => !p.done.has(i) && Math.abs(c.t - this.t) <= BOX.window);
        if (idx >= 0) {
          p.done.add(idx);
          const c = this.cues[idx];
          const ok = c.m === m;
          const perfect = ok && Math.abs(c.t - this.t) <= BOX.perfect;
          if (ok) { p.combo += 1; p.score += (perfect ? 2 : 1) + Math.floor(p.combo / 10); } else p.combo = 0;
          p.best = Math.max(p.best, p.combo);
          p.last = { m, ok, perfect, t: this.t };
        } else {
          p.combo = 0;
          p.last = { m, ok: false, perfect: false, t: this.t };
        }
      }
      // Calls that pass without an answer break the combo.
      for (const [i, c] of this.cues.entries()) {
        if (!p.done.has(i) && c.t < this.t - BOX.window) { p.done.add(i); p.combo = 0; }
        if (c.t > this.t) break;
      }
    }
  }
  snapshot() {
    return { p: this.players.map((p) => ({ id: p.id, score: p.score, combo: p.combo, last: p.last ? [p.last.m, p.last.ok ? 1 : 0, p.last.perfect ? 1 : 0, r2(p.last.t)] : null })) };
  }
  isOver() { return this.t >= BOX.seconds; }
  results() { return rank(this.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, score: p.score, finished: true, time: null }))); }
}
