import { mulberry32 } from "./rng";
import { hashString } from "./quests";

/**
 * Bow Valley Golf: nine holes inspired by the famous mountain course along the Bow River in Banff,
 * laid out by Stanley Thompson in the 1920s: tree-lined fairways beside the river, Mount Rundle
 * towering over everything, elk grazing on the fairways, sculpted bunkers, the "Devil's Cauldron"
 * par 3 over a glacial pond at the foot of the mountain, and the castle-like hotel at the finish.
 *
 * Simple, readable golf physics like most browser golf games: aim, pick a club, set the power;
 * the ball flies (gravity, a little air drag and wind), bounces, rolls with surface friction and
 * slopes, and drops in the cup if it's moving slowly enough. Water and out-of-bounds cost a stroke.
 * The simulation is deterministic, so the server can compute every shot and send the path out.
 */

export type Surface = "tee" | "fairway" | "rough" | "green" | "sand" | "water" | "ob";
export type Club = "driver" | "iron" | "wedge" | "putter";

export interface GolfHole {
  n: number;
  name: string;
  par: 3 | 4 | 5;
  blurb: string;
  tee: [number, number];
  pin: [number, number];
  /** Fairway centreline from the tee to the green. */
  path: [number, number][];
  /** Fairway half-width (0 = no fairway, carry it all the way). */
  fw: number;
  green: { x: number; z: number; r: number; slope: [number, number] };
  bunkers: { x: number; z: number; rx: number; rz: number }[];
  ponds: { x: number; z: number; r: number }[];
  river?: { pts: [number, number][]; w: number };
  /** How far the tee sits above (+) or below (−) the green. */
  teeHeight: number;
  wind: [number, number];
  backdrop: "rundle" | "cascade" | "sulphur" | "castle";
  /** Grazing elk (decoration; they're also gentle obstacles). */
  elk?: [number, number][];
}

export const GOLF_HOLES: GolfHole[] = [
  {
    n: 1, name: "Bow River Bend", par: 4, backdrop: "rundle",
    blurb: "A gentle opener alongside the Bow River. Stay left of the water!",
    tee: [0, 0], pin: [-10, 122], path: [[0, 0], [0, 70], [-10, 120]], fw: 11,
    green: { x: -10, z: 122, r: 9, slope: [0.02, -0.015] },
    bunkers: [{ x: 13, z: 76, rx: 4, rz: 6 }, { x: -21, z: 118, rx: 3.5, rz: 5 }],
    ponds: [], river: { pts: [[30, -20], [28, 60], [24, 140]], w: 9 }, teeHeight: 1.5, wind: [0.4, 0.2],
  },
  {
    n: 2, name: "Rundle's Shadow", par: 4, backdrop: "rundle",
    blurb: "A dogleg left beneath Mount Rundle. Cut the corner if you dare.",
    tee: [0, 0], pin: [-47, 121], path: [[0, 0], [0, 82], [-46, 120]], fw: 11,
    green: { x: -47, z: 121, r: 9, slope: [-0.02, 0.02] },
    bunkers: [{ x: -14, z: 88, rx: 5, rz: 5 }, { x: -58, z: 130, rx: 4, rz: 3.5 }, { x: -36, z: 131, rx: 4, rz: 3 }],
    ponds: [], teeHeight: 2, wind: [-0.5, 0.3],
  },
  {
    n: 3, name: "Elk Meadow", par: 3, backdrop: "cascade",
    blurb: "A short par 3. The elk have right of way!",
    tee: [0, 0], pin: [2, 63], path: [[0, 0], [2, 60]], fw: 8,
    green: { x: 2, z: 63, r: 8, slope: [0.015, 0.02] },
    bunkers: [{ x: -8, z: 56, rx: 3.5, rz: 3 }, { x: 11, z: 58, rx: 3.5, rz: 3 }],
    ponds: [], teeHeight: 0.5, wind: [0.2, -0.3], elk: [[-14, 30], [16, 38], [-12, 44]],
  },
  {
    n: 4, name: "Devil's Cauldron", par: 3, backdrop: "rundle",
    blurb: "The famous one: from a high tee, over a glacial pond, to a green at the foot of the mountain.",
    tee: [0, 0], pin: [0, 60], path: [[0, 0], [0, 60]], fw: 0,
    green: { x: 0, z: 60, r: 8.5, slope: [0, -0.025] },
    bunkers: [{ x: -10, z: 62, rx: 3, rz: 4 }, { x: 10, z: 61, rx: 3, rz: 4 }, { x: 0, z: 70.5, rx: 6, rz: 2.5 }],
    ponds: [{ x: 0, z: 33, r: 15 }], teeHeight: 9, wind: [0.6, 0],
  },
  {
    n: 5, name: "Spray River", par: 5, backdrop: "sulphur",
    blurb: "The long one. The Spray River crosses the fairway, so lay up or go for it.",
    tee: [0, 0], pin: [0, 180], path: [[0, 0], [10, 72], [-6, 132], [0, 178]], fw: 12,
    green: { x: 0, z: 180, r: 9, slope: [0.02, 0.01] },
    bunkers: [{ x: 22, z: 70, rx: 4, rz: 6 }, { x: -18, z: 128, rx: 5, rz: 4 }, { x: 11, z: 172, rx: 3.5, rz: 4 }],
    ponds: [], river: { pts: [[-60, 102], [0, 99], [60, 104]], w: 6 }, teeHeight: 2, wind: [-0.3, -0.4],
  },
  {
    n: 6, name: "Sulphur Mountain", par: 4, backdrop: "sulphur",
    blurb: "Uphill all the way to a two-tier green. Take an extra club.",
    tee: [0, 0], pin: [-2, 114], path: [[0, 0], [7, 60], [-2, 112]], fw: 10,
    green: { x: -2, z: 114, r: 8.5, slope: [0, -0.03] },
    bunkers: [{ x: -11, z: 66, rx: 4, rz: 5 }, { x: 9, z: 108, rx: 3, rz: 4 }, { x: -12, z: 112, rx: 3, rz: 4 }],
    ponds: [], teeHeight: -6, wind: [0.2, 0.5],
  },
  {
    n: 7, name: "Cascade", par: 3, backdrop: "cascade",
    blurb: "Cascade Mountain in view and bunkers guarding every side of the green.",
    tee: [0, 0], pin: [-6, 72], path: [[0, 0], [-6, 70]], fw: 6,
    green: { x: -6, z: 72, r: 8, slope: [0.02, 0] },
    bunkers: [{ x: -16, z: 70, rx: 3, rz: 4 }, { x: 4, z: 71, rx: 3, rz: 4 }, { x: -6, z: 61, rx: 5, rz: 2 }, { x: -6, z: 82, rx: 5, rz: 2 }],
    ponds: [{ x: -24, z: 40, r: 9 }], teeHeight: 2.5, wind: [-0.4, 0.2],
  },
  {
    n: 8, name: "Riverside", par: 4, backdrop: "rundle",
    blurb: "The river hugs the left side the whole way. Favour the right.",
    tee: [0, 0], pin: [6, 126], path: [[0, 0], [-4, 80], [6, 124]], fw: 11,
    green: { x: 6, z: 126, r: 9, slope: [-0.02, 0.01] },
    bunkers: [{ x: 12, z: 84, rx: 4, rz: 5 }, { x: 17, z: 124, rx: 3, rz: 4 }],
    ponds: [], river: { pts: [[-26, -20], [-27, 70], [-18, 150]], w: 9 }, teeHeight: 1, wind: [0.5, -0.2],
  },
  {
    n: 9, name: "The Castle", par: 5, backdrop: "castle",
    blurb: "Finish in style below the castle hotel, past the pond guarding the green.",
    tee: [0, 0], pin: [0, 172], path: [[0, 0], [-8, 80], [4, 140], [0, 170]], fw: 12,
    green: { x: 0, z: 172, r: 10, slope: [0.015, -0.02] },
    bunkers: [{ x: -21, z: 84, rx: 5, rz: 5 }, { x: 16, z: 136, rx: 4, rz: 5 }, { x: -12, z: 168, rx: 3.5, rz: 4 }],
    ponds: [{ x: 16, z: 154, r: 8.5 }], teeHeight: 2, wind: [-0.2, 0.3],
  },
];

export const CLUBS: Record<Club, { name: string; icon: string; v: number; angle: number }> = {
  driver: { name: "Driver", icon: "🏌️", v: 35, angle: 0.22 },
  iron: { name: "Iron", icon: "🥢", v: 26.5, angle: 0.42 },
  wedge: { name: "Wedge", icon: "⛳", v: 17.5, angle: 0.85 },
  putter: { name: "Putter", icon: "🎯", v: 7.5, angle: 0 },
};

const G = 9.8;
const CUP_R = 0.4;
const TREE_H = 9;

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number): { d: number; t: number } {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return { d: Math.hypot(px - (ax + dx * t), pz - (az + dz * t)), t };
}

/** Distance from the fairway centreline and how far along the hole (0 = tee, 1 = green) a point is. */
const lenCache = new Map<number, { lens: number[]; total: number }>();
export function alongHole(h: GolfHole, x: number, z: number): { d: number; s: number } {
  let best = Infinity, along = 0, acc = 0;
  let c = lenCache.get(h.n);
  if (!c) {
    const lens = h.path.slice(1).map((p, i) => Math.hypot(p[0] - h.path[i][0], p[1] - h.path[i][1]));
    lenCache.set(h.n, (c = { lens, total: lens.reduce((a, b) => a + b, 0) || 1 }));
  }
  const { lens, total } = c;
  for (let i = 0; i < h.path.length - 1; i++) {
    const r = segDist(x, z, h.path[i][0], h.path[i][1], h.path[i + 1][0], h.path[i + 1][1]);
    if (r.d < best) { best = r.d; along = acc + r.t * lens[i]; }
    acc += lens[i];
  }
  return { d: best, s: along / total };
}

function riverDist(h: GolfHole, x: number, z: number) {
  if (!h.river) return Infinity;
  let d = Infinity;
  for (let i = 0; i < h.river.pts.length - 1; i++) d = Math.min(d, segDist(x, z, ...h.river.pts[i], ...h.river.pts[i + 1]).d);
  return d;
}

/** Trees lining the fairways (deterministic per hole). */
export function golfTrees(h: GolfHole): { x: number; z: number; s: number }[] {
  const out: { x: number; z: number; s: number }[] = [];
  const rand = mulberry32(hashString(`golf-trees-${h.n}`));
  const xs = h.path.map((p) => p[0]), zs = h.path.map((p) => p[1]);
  const minX = Math.min(...xs) - 50, maxX = Math.max(...xs) + 50, minZ = -25, maxZ = Math.max(...zs) + 35;
  for (let x = minX; x <= maxX; x += 6) {
    for (let z = minZ; z <= maxZ; z += 6) {
      const jx = x + (rand() - 0.5) * 4.5, jz = z + (rand() - 0.5) * 4.5;
      const { d } = alongHole(h, jx, jz);
      const edge = h.fw + 9;
      if (d < edge || d > edge + 26) { rand(); continue; }
      if (Math.hypot(jx - h.green.x, jz - h.green.z) < h.green.r + 10) { rand(); continue; }
      if (Math.hypot(jx - h.tee[0], jz - h.tee[1]) < 12) { rand(); continue; }
      if (riverDist(h, jx, jz) < (h.river?.w ?? 0) / 2 + 4) { rand(); continue; }
      if (h.ponds.some((p) => Math.hypot(jx - p.x, jz - p.z) < p.r + 3)) { rand(); continue; }
      if (rand() < 0.45 + (d - edge) / 60) out.push({ x: jx, z: jz, s: 0.8 + rand() * 0.6 });
    }
  }
  return out;
}

type Tree = { x: number; z: number; s: number };
const CELL = 8;
const treeCache = new Map<number, Map<number, Tree[]>>();
/** Trees bucketed into an 8 m grid so the shot simulation only checks the ones nearby. */
const treeGrid = (h: GolfHole) => {
  let g = treeCache.get(h.n);
  if (!g) {
    g = new Map();
    for (const t of golfTrees(h)) {
      const k = Math.floor(t.x / CELL) * 4096 + Math.floor(t.z / CELL);
      let list = g.get(k);
      if (!list) g.set(k, (list = []));
      list.push(t);
    }
    treeCache.set(h.n, g);
  }
  return g;
};
const NO_TREES: Tree[] = [];
function treesNear(grid: Map<number, Tree[]>, x: number, z: number): Tree[] {
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  let out: Tree[] | null = null;
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const l = grid.get((cx + i) * 4096 + cz + j);
    if (l) (out ??= []).push(...l);
  }
  return out ?? NO_TREES;
}

export function surfaceAt(h: GolfHole, x: number, z: number): Surface {
  if (h.ponds.some((p) => Math.hypot(x - p.x, z - p.z) < p.r)) return "water";
  if (riverDist(h, x, z) < (h.river?.w ?? 0) / 2) return "water";
  const gd = Math.hypot(x - h.green.x, z - h.green.z);
  if (gd < h.green.r) return "green";
  if (h.bunkers.some((b) => ((x - b.x) / b.rx) ** 2 + ((z - b.z) / b.rz) ** 2 < 1)) return "sand";
  if (Math.hypot(x - h.tee[0], z - h.tee[1]) < 3.2) return "tee";
  const { d, s } = alongHole(h, x, z);
  // The fairway narrows into an apron before the green, then fringe.
  if (h.fw > 0 && d < h.fw && s > 0.03) return "fairway";
  if (gd < h.green.r + 3) return "fairway";
  if (d < h.fw + 30 && z > -30) return "rough";
  return "ob";
}

/** Ground height: the tee is raised (or sunk), with gentle rolls, bowls for ponds and a river channel. */
export function golfHeight(h: GolfHole, x: number, z: number): number {
  const { s } = alongHole(h, x, z);
  const k = Math.max(0, Math.min(1, s));
  let y = h.teeHeight * (1 - k * k * (3 - 2 * k));
  y += Math.sin(x * 0.09 + h.n) * 0.5 + Math.cos(z * 0.07 + h.n * 2) * 0.5;
  // Raised tee box.
  const td = Math.hypot(x - h.tee[0], z - h.tee[1]);
  if (td < 4.5) y += 0.35 * Math.min(1, (4.5 - td) / 1.2);
  // Gently tilted, smooth green.
  const gd = Math.hypot(x - h.green.x, z - h.green.z);
  if (gd < h.green.r + 2) {
    const base = Math.sin(h.green.x * 0.09 + h.n) * 0.5 + Math.cos(h.green.z * 0.07 + h.n * 2) * 0.5 + h.teeHeight * 0;
    const tilt = (x - h.green.x) * h.green.slope[0] + (z - h.green.z) * h.green.slope[1];
    const blend = Math.min(1, (h.green.r + 2 - gd) / 2);
    y = y * (1 - blend) + (base + tilt + 0.15) * blend;
  }
  // Bunkers are shallow hollows.
  for (const b of h.bunkers) {
    const q = ((x - b.x) / b.rx) ** 2 + ((z - b.z) / b.rz) ** 2;
    if (q < 1) y -= 0.45 * (1 - q);
  }
  for (const p of h.ponds) {
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < p.r + 2) y = Math.min(y, -1.2 + Math.max(0, d - p.r) * 0.55 + (h.n === 4 ? 0 : 0));
  }
  const rd = riverDist(h, x, z);
  if (rd < (h.river?.w ?? 0) / 2 + 2) y = Math.min(y, -1.4 + Math.max(0, rd - (h.river!.w / 2)) * 0.6);
  return y;
}

/** Water surface height (for drawing ponds and the river). */
export const GOLF_WATER_Y = -0.75;

const BOUNCE: Record<Surface, number> = { tee: 0.32, fairway: 0.32, rough: 0.18, green: 0.24, sand: 0, water: 0, ob: 0 };
const KEEP: Record<Surface, number> = { tee: 0.6, fairway: 0.6, rough: 0.38, green: 0.55, sand: 0.08, water: 0, ob: 0 };
const ROLL: Record<Surface, number> = { tee: 4.2, fairway: 4.2, rough: 8, green: 1.3, sand: 14, water: 0, ob: 0 };

export interface ShotResult {
  /** Flattened [x, y, z, x, y, z, …] samples at 30 per second. */
  path: number[];
  end: [number, number];
  lie: Surface;
  holed: boolean;
  penalty: boolean;
}

/** Simulates one shot from (x, z). aim = direction in radians (0 = +z), power 0..1. */
export function simulateShot(h: GolfHole, from: [number, number], aim: number, power: number, club: Club): ShotResult {
  const c = CLUBS[club];
  const p = Math.max(0.05, Math.min(1, power));
  const lie0 = surfaceAt(h, from[0], from[1]);
  // Hitting out of sand or deep rough loses some power (not with the putter on the green).
  const lieK = club === "putter" ? 1 : lie0 === "sand" ? (club === "wedge" ? 0.75 : 0.45) : lie0 === "rough" ? 0.82 : 1;
  // Putts roll a distance roughly proportional to power, which feels fair on the greens.
  const v = c.v * (club === "putter" ? Math.sqrt(p) : p) * lieK;
  let x = from[0], z = from[1], y = golfHeight(h, x, z) + 0.05;
  let vx = Math.sin(aim) * Math.cos(c.angle) * v, vz = Math.cos(aim) * Math.cos(c.angle) * v, vy = Math.sin(c.angle) * v;
  let rolling = c.angle === 0;
  const path: number[] = [];
  const dt = 1 / 120;
  const grid = treeGrid(h);
  let t = 0, holed = false, penalty = false, lie: Surface = lie0;
  const push = () => path.push(Math.round(x * 100) / 100, Math.round(y * 100) / 100, Math.round(z * 100) / 100);
  push();
  for (let i = 0; t < 14; i++) {
    t += dt;
    if (!rolling) {
      vy -= G * dt;
      vx += h.wind[0] * 0.45 * dt;
      vz += h.wind[1] * 0.45 * dt;
      const drag = 1 - 0.05 * dt;
      vx *= drag; vz *= drag;
      x += vx * dt; y += vy * dt; z += vz * dt;
      // Pine canopies knock the ball down.
      for (const tr of y < TREE_H * 1.6 ? treesNear(grid, x, z) : NO_TREES) {
        const d = Math.hypot(x - tr.x, z - tr.z);
        if (d < 2.3 * tr.s && y < TREE_H * tr.s && y > 1.2) {
          vx *= -0.2; vz *= -0.2; vy = Math.min(vy, 0) * 0.3;
          x += (x - tr.x) / (d || 1) * 0.3; z += (z - tr.z) / (d || 1) * 0.3;
        }
      }
      for (const e of h.elk ?? []) {
        if (Math.hypot(x - e[0], z - e[1]) < 1.4 && y < 2.6) { vx *= -0.3; vz *= -0.3; }
      }
      const gy = golfHeight(h, x, z);
      if (y <= gy) {
        y = gy;
        const s = surfaceAt(h, x, z);
        if (s === "water" || s === "ob") { lie = s; penalty = true; push(); break; }
        // Bounce, then roll once the bounce is small.
        if (Math.abs(vy) * BOUNCE[s] > 1.4) vy = -vy * BOUNCE[s];
        else { vy = 0; rolling = true; }
        vx *= KEEP[s]; vz *= KEEP[s];
      }
    } else {
      const s = surfaceAt(h, x, z);
      if (s === "water" || s === "ob") { lie = s; penalty = true; push(); break; }
      const e = 0.4;
      const gx = (golfHeight(h, x + e, z) - golfHeight(h, x - e, z)) / (2 * e);
      const gz = (golfHeight(h, x, z + e) - golfHeight(h, x, z - e)) / (2 * e);
      const slopeK = s === "green" ? 0.6 : s === "sand" ? 0 : 0.35;
      vx -= gx * G * slopeK * dt;
      vz -= gz * G * slopeK * dt;
      const sp = Math.hypot(vx, vz);
      const dec = ROLL[s] * dt;
      if (sp <= dec) { vx = 0; vz = 0; } else { vx -= (vx / sp) * dec; vz -= (vz / sp) * dec; }
      x += vx * dt; z += vz * dt;
      y = golfHeight(h, x, z);
      for (const tr of treesNear(grid, x, z)) {
        const d = Math.hypot(x - tr.x, z - tr.z);
        if (d < 0.6 * tr.s) { vx = -vx * 0.4; vz = -vz * 0.4; x = tr.x + ((x - tr.x) / (d || 1)) * 0.62 * tr.s; z = tr.z + ((z - tr.z) / (d || 1)) * 0.62 * tr.s; }
      }
      // Into the cup?
      const cd = Math.hypot(x - h.pin[0], z - h.pin[1]);
      if (cd < CUP_R && Math.hypot(vx, vz) < 4.2) {
        holed = true;
        x = h.pin[0]; z = h.pin[1]; y = golfHeight(h, x, z) - 0.25;
        push();
        break;
      }
      const still = Math.hypot(vx, vz) < 0.06 && Math.hypot(gx, gz) * G * slopeK < ROLL[s] * 0.9;
      if (still) { lie = s; push(); break; }
      lie = s;
    }
    if (i % 4 === 0) push();
  }
  if (!penalty && !holed) push();
  return { path, end: penalty ? [from[0], from[1]] : [x, z], lie: penalty ? lie0 : lie, holed, penalty };
}

/** Picks a sensible club for a lie and distance (the client suggests it; bots use it). */
export function suggestClub(h: GolfHole, x: number, z: number): Club {
  const s = surfaceAt(h, x, z);
  const d = Math.hypot(h.pin[0] - x, h.pin[1] - z);
  if (s === "green" || (d < 10 && s === "fairway")) return "putter";
  if (d < 32 || s === "sand") return "wedge";
  if (d < 62 || (s !== "tee" && s !== "fairway")) return "iron";
  return "driver";
}

/** A bot's (or the aim assistant's) shot: aims at the pin or the next fairway waypoint, then picks the power. */
export function planShot(h: GolfHole, from: [number, number], skill: number, rand: () => number): { aim: number; power: number; club: Club } {
  const club = suggestClub(h, from[0], from[1]);
  // Aim at the pin, or at the next bend in the fairway if the pin is around a corner.
  let target: [number, number] = h.pin;
  const dPin = Math.hypot(h.pin[0] - from[0], h.pin[1] - from[1]);
  const reach = club === "driver" ? 82 : club === "iron" ? 62 : 40;
  if (dPin > reach) {
    const { s } = alongHole(h, from[0], from[1]);
    for (const p of h.path) {
      const ps = alongHole(h, p[0], p[1]).s;
      if (ps > s + 0.05 && Math.hypot(p[0] - from[0], p[1] - from[1]) <= reach * 1.05) target = p;
    }
    if (target === h.pin) {
      const a = Math.atan2(h.pin[0] - from[0], h.pin[1] - from[1]);
      target = [from[0] + Math.sin(a) * reach * 0.85, from[1] + Math.cos(a) * reach * 0.85];
    }
  }
  const aim = Math.atan2(target[0] - from[0], target[1] - from[1]);
  let best = 0.6, bd = Infinity;
  const tryPower = (pw: number) => {
    if (pw <= 0 || pw > 1) return;
    const r = simulateShot(h, from, aim, pw, club);
    if (r.penalty) return;
    const d = r.holed ? -1 : Math.hypot(r.end[0] - target[0], r.end[1] - target[1]);
    if (d < bd) { bd = d; best = pw; }
  };
  for (let i = 1; i <= 8; i++) tryPower(i / 8);
  const coarse = best;
  for (const dp of [-0.09, -0.06, -0.03, 0.03, 0.06, 0.09]) tryPower(coarse + dp);
  const miss = 1 - skill;
  return { aim: aim + (rand() - 0.5) * 0.12 * miss, power: Math.max(0.05, Math.min(1, best + (rand() - 0.5) * 0.18 * miss)), club };
}

/** Duration of a shot's animation in ms (the path is sampled at 30 per second). */
export function shotMs(r: ShotResult) {
  return (r.path.length / 3 / 30) * 1000;
}

export const GOLF_MAX_STROKES = 10;

export interface GolfPlayer { id: string; name: string; isBot: boolean; ball: [number, number]; strokes: number[]; done: boolean; busyUntil: number; quit: boolean; skill: number; finished: boolean[] }

/**
 * One round of golf for up to four beavers playing at the same time (everyone plays their own ball
 * on the same hole; the group moves on when everyone has holed out). Used by the server and solo mode.
 */
export class GolfMatch {
  holes: number[];
  idx = 0;
  players: GolfPlayer[];
  over = false;
  private rand: () => number;
  /** When the group moves to the next hole (after everyone's done). */
  nextAt = 0;

  constructor(holeCount: number, entrants: { id: string; name: string; isBot: boolean }[], seed = 1) {
    const n = Math.max(1, Math.min(9, Math.floor(holeCount) || 9));
    this.holes = GOLF_HOLES.slice(0, n).map((h) => h.n);
    this.rand = mulberry32(seed);
    this.players = entrants.map((e) => ({ ...e, ball: [...GOLF_HOLES[this.holes[0] - 1].tee] as [number, number], strokes: [], done: false, busyUntil: 0, quit: false, finished: [], skill: 0.6 + this.rand() * 0.3 }));
    for (const p of this.players) p.ball = this.teeSpot(p);
  }

  get hole(): GolfHole {
    return GOLF_HOLES[this.holes[this.idx] - 1];
  }

  private teeSpot(p: GolfPlayer): [number, number] {
    const i = this.players.indexOf(p);
    return [this.hole.tee[0] + (i - 1.5) * 1.1, this.hole.tee[1]];
  }

  strokes(p: GolfPlayer) {
    return p.strokes[this.idx] ?? 0;
  }

  /** Takes a shot. Returns the result, or null if it's not allowed right now. */
  shoot(id: string, aim: number, power: number, club: Club, now: number): ShotResult | null {
    const p = this.players.find((x) => x.id === id);
    if (!p || p.done || p.quit || this.over || now < p.busyUntil || !(club in CLUBS)) return null;
    if (!Number.isFinite(aim) || !Number.isFinite(power)) return null;
    const r = simulateShot(this.hole, p.ball, aim, power, club);
    p.strokes[this.idx] = this.strokes(p) + 1 + (r.penalty ? 1 : 0);
    p.ball = r.end;
    p.busyUntil = now + shotMs(r) + 400;
    if (r.holed || p.strokes[this.idx] >= GOLF_MAX_STROKES) {
      p.done = true;
      p.finished[this.idx] = true;
      p.strokes[this.idx] = Math.min(GOLF_MAX_STROKES, p.strokes[this.idx]);
    }
    this.checkHoleDone(now);
    return r;
  }

  /** Bots take their shots. Returns who shot what. */
  botTurns(now: number): { id: string; club: Club; result: ShotResult }[] {
    const out: { id: string; club: Club; result: ShotResult }[] = [];
    for (const p of this.players) {
      if (!p.isBot || p.done || now < p.busyUntil + 900 + this.rand() * 1200) continue;
      const plan = planShot(this.hole, p.ball, p.skill, this.rand);
      const r = this.shoot(p.id, plan.aim, plan.power, plan.club, now);
      if (r) out.push({ id: p.id, club: plan.club, result: r });
    }
    return out;
  }

  quit(id: string, now: number) {
    const p = this.players.find((x) => x.id === id);
    if (!p) return;
    p.quit = true;
    p.done = true;
    if (this.players.every((x) => x.quit || x.isBot)) this.over = true;
    this.checkHoleDone(now);
  }

  private checkHoleDone(now: number) {
    if (this.players.every((p) => p.done) && !this.nextAt) this.nextAt = now + 3500;
  }

  /** Moves to the next hole when it's time. Returns true if the hole changed or the round ended. */
  advance(now: number): boolean {
    if (!this.nextAt || now < this.nextAt || this.over) return false;
    this.nextAt = 0;
    if (this.idx >= this.holes.length - 1) {
      this.over = true;
      return true;
    }
    this.idx += 1;
    for (const p of this.players) {
      if (p.quit) continue;
      p.done = false;
      p.busyUntil = now + 500;
      p.ball = this.teeSpot(p);
    }
    return true;
  }

  totals() {
    const par = this.holes.slice(0, this.idx + 1).reduce((s, n) => s + GOLF_HOLES[n - 1].par, 0);
    return this.players.map((p) => {
      const fin = p.strokes.map((_, i) => !!p.finished[i]);
      const total = p.strokes.reduce((s, x, i) => s + (fin[i] ? x ?? 0 : 0), 0);
      const played = fin.filter(Boolean).length;
      const parPlayed = this.holes.reduce((s, n, i) => s + (fin[i] ? GOLF_HOLES[n - 1].par : 0), 0);
      return { id: p.id, name: p.name, isBot: p.isBot, total, toPar: total - parPlayed, quit: p.quit, holes: played, par };
    });
  }
}

/** Coins for a round: a little for every hole finished, more for good scores. */
export function golfCoins(holesPlayed: number, toPar: number, quit: boolean): number {
  if (holesPlayed <= 0) return 0;
  const base = holesPlayed * 8;
  const bonus = Math.max(0, Math.round((holesPlayed * 2 - toPar) * 3));
  return Math.round((base + bonus) * (quit ? 0.8 : 1)) + (quit ? 0 : 10);
}
