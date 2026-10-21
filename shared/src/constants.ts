/** Tuning values shared by client and server. Server-side checks always use these, never client-sent values. */
import { BRIDGE_EAST, buildingColliders, STREETS, TOWN_BUILDINGS, townClear } from "./townLayout";
export * from "./townLayout";
import { TRAIN } from "./townLayout";

export const HUB = {
  /** Players are kept inside this circle (world units ≈ metres). */
  radius: 100,
  /** Max walking speed in units/second. */
  maxSpeed: 9,
  /** Allowance for network jitter when validating movement. */
  speedTolerance: 1.35,
  /** How often the server broadcasts positions (Hz). */
  tickRate: 12,
  capacity: 50,
} as const;

/** Places in the village. Used for scenery on the client and collision/validation on the server. */
export const HUB_PLACES = {
  plaza: { x: 0, z: 0, r: 0 },
  lodge: { x: -20, z: -16, r: 7.5 },
  outfitter: { x: 19, z: -15, r: 6 },
  arcade: { x: 26, z: 14, r: 5.5 },
  dock: { x: -26, z: 22, r: 0 },
  lake: { x: -38, z: 36, r: 15 },
  trailhead: { x: 0, z: -40, r: 0 },
  hotSpring: { x: 30, z: -34, r: 0 },
} as const;

/** Shared dimensions for the walkable timber bridge over the river. */
export const BRIDGE = {
  x: 6,
  z: 41.5,
  ry: 0.05,
  halfWidth: 2,
  halfLength: 5.5,
} as const;

/** Every walkable bridge (the original south bridge and the east bridge into the new quarter). */
export const BRIDGES = [BRIDGE, BRIDGE_EAST] as const;

/** Where the land starts rising into forested foothills (just past the walkable edge). */
export const FOOTHILLS_R = 104;

/** Solid things you can't walk through (circles). */
export const HUB_COLLIDERS: { x: number; z: number; r: number }[] = [
  { x: HUB_PLACES.lodge.x, z: HUB_PLACES.lodge.z, r: HUB_PLACES.lodge.r },
  { x: HUB_PLACES.outfitter.x, z: HUB_PLACES.outfitter.z, r: HUB_PLACES.outfitter.r },
  { x: HUB_PLACES.arcade.x, z: HUB_PLACES.arcade.z, r: HUB_PLACES.arcade.r },
  { x: 0, z: 0, r: 7.15 }, // full plaza fountain basin, not just the pedestal
  { x: HUB_PLACES.hotSpring.x, z: HUB_PLACES.hotSpring.z, r: 4.4 },
  { x: -12, z: -9, r: 1.65 }, // lodge campfire
  { x: 4, z: -12, r: 0.75 }, // village sign
  { x: HUB_PLACES.outfitter.x - 6.5, z: HUB_PLACES.outfitter.z + 2, r: 1.7 }, // canoe rack
  { x: HUB_PLACES.lodge.x + 5, z: HUB_PLACES.lodge.z + 9.5, r: 1.65 },
  { x: HUB_PLACES.lodge.x + 11, z: HUB_PLACES.lodge.z + 5, r: 1.65 },
  { x: HUB_PLACES.dock.x + 5, z: HUB_PLACES.dock.z + 9, r: 1.35 }, // moored canoe
  { x: HUB_PLACES.dock.x - 2, z: HUB_PLACES.dock.z + 13, r: 1.35 },
];

// Plaza furniture is generated from this same layout on the client. Keeping its
// collision circles here makes every connected player receive identical movement rules.
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + 0.5;
  HUB_COLLIDERS.push(
    { x: Math.cos(a) * 11.5, z: Math.sin(a) * 11.5, r: 0.58 }, // lantern
    { x: Math.cos(a + 0.5) * 8.6, z: Math.sin(a + 0.5) * 8.6, r: 1.45 }, // bench
  );
}

// The hub's scenery is deterministic. These helpers deliberately mirror the
// placement rules in the renderer so collision stays authoritative on the
// server while every visible rock and tree remains solid on the client.
export const sceneryHash = (x: number, y: number) => {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
};
export const sceneryDistSeg = (px: number, pz: number, ax: number, az: number, bx: number, bz: number) => {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
};
const RIVER: [number, number][] = [[70, -80], [52, -48], [38, -20], [34, 2], [32, 22], [18, 40], [-6, 44], [-26, 40], [-38, 36]];
const PATHS: [number, number, number, number][] = [
  [0, 0, HUB_PLACES.lodge.x, HUB_PLACES.lodge.z], [0, 0, HUB_PLACES.outfitter.x, HUB_PLACES.outfitter.z],
  [0, 0, HUB_PLACES.arcade.x, HUB_PLACES.arcade.z], [0, 0, HUB_PLACES.dock.x, HUB_PLACES.dock.z],
  [0, 0, HUB_PLACES.trailhead.x, HUB_PLACES.trailhead.z + 2], [HUB_PLACES.outfitter.x, HUB_PLACES.outfitter.z, HUB_PLACES.hotSpring.x, HUB_PLACES.hotSpring.z], [0, 0, 6, 40],
  ...STREETS,
];
/** All trails and streets as segments (the client draws them from this list). */
export const TRAILS: readonly [number, number, number, number][] = PATHS;
/** River centreline (the client carves and fills the channel from this). */
export const RIVER_LINE: readonly [number, number][] = RIVER;
export const pathDistance = (x: number, z: number) => Math.min(...PATHS.map((p) => sceneryDistSeg(x, z, ...p)));
export const riverDistance = (x: number, z: number) => Math.min(...RIVER.slice(0, -1).map((p, i) => sceneryDistSeg(x, z, ...p, ...RIVER[i + 1])));
export const sceneryHeight = (x: number, z: number) => {
  const r = Math.hypot(x, z);
  let h = 0;
  if (r > 12) h += 0.35 * Math.sin(x * 0.13) * Math.cos(z * 0.11) * Math.min(1, (r - 12) / 10);
  if (r > FOOTHILLS_R) h += Math.pow(r - FOOTHILLS_R, 1.35) * 0.32 + sceneryHash(Math.floor(x / 6), Math.floor(z / 6)) * 1.2;
  const th = Math.hypot(x - HUB_PLACES.trailhead.x, (z - HUB_PLACES.trailhead.z + 14) * 0.8);
  if (z < HUB_PLACES.trailhead.z - 3) h += Math.max(0, 16 - th) * 0.45;
  const lake = Math.hypot(x - HUB_PLACES.lake.x, z - HUB_PLACES.lake.z);
  if (lake < 19) h = Math.min(h, -2.2 * Math.pow(1 - lake / 19, 0.6) + 0.35);
  const river = riverDistance(x, z);
  if (river < 4.2) h = Math.min(h, -1.3 * (1 - river / 4.2) + 0.25 * (river / 4.2));
  const spring = Math.hypot(x - HUB_PLACES.hotSpring.x, z - HUB_PLACES.hotSpring.z);
  if (spring < 3.4) h = Math.min(h, -0.6);
  return h;
};
const addSolid = (x: number, z: number, r: number) => HUB_COLLIDERS.push({ x, z, r });

// Hot-spring boulders, dock posts and trailhead arch posts.
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  addSolid(HUB_PLACES.hotSpring.x + Math.cos(a) * 3.8, HUB_PLACES.hotSpring.z + Math.sin(a) * 3.8, 1.2);
}
const dockAngle = Math.atan2(HUB_PLACES.lake.x - HUB_PLACES.dock.x, HUB_PLACES.lake.z - HUB_PLACES.dock.z);
for (let i = 0; i < 9; i += 3) for (const side of [-1, 1]) {
  const x = HUB_PLACES.dock.x + Math.sin(dockAngle) * i * 1.2 + Math.cos(dockAngle) * side * 1.6;
  const z = HUB_PLACES.dock.z + Math.cos(dockAngle) * i * 1.2 - Math.sin(dockAngle) * side * 1.6;
  addSolid(x, z, 0.55);
}
// Bridge guard rails. The deck itself stays walkable; overlapping rail
// colliders keep players from clipping through the visible side posts/ropes.
for (const br of BRIDGES) {
  for (const side of [-1, 1]) {
    for (let along = -Math.floor(br.halfLength); along <= Math.floor(br.halfLength); along += 1) {
      const lx = side * 1.9, lz = along;
      const x = br.x + lx * Math.cos(br.ry) + lz * Math.sin(br.ry);
      const z = br.z - lx * Math.sin(br.ry) + lz * Math.cos(br.ry);
      addSolid(x, z, 0.58);
    }
  }
}
// Town buildings.
for (const b of TOWN_BUILDINGS) for (const c of buildingColliders(b)) addSolid(c.x, c.z, c.r);
// The rock wall and waterfall behind the far side of the lake.
{
  const sw = Math.atan2(HUB_PLACES.lake.z, HUB_PLACES.lake.x);
  for (let da = -0.95; da <= 0.951; da += 0.1) {
    for (const d of [20.5, 23.5, 27, 31]) {
      const x = HUB_PLACES.lake.x + Math.cos(sw + da) * d, z = HUB_PLACES.lake.z + Math.sin(sw + da) * d;
      if (Math.hypot(x, z) > 64 && Math.hypot(x, z) < HUB.radius + 3) addSolid(x, z, 2.3);
    }
  }
}
for (const side of [-1, 1]) addSolid(HUB_PLACES.trailhead.x + side * 4, HUB_PLACES.trailhead.z, 1.0);

/**
 * Forest trees inside the walkable area, on a jittered 4.5 m grid. The client draws exactly these
 * (and adds a denser, purely visual forest beyond the edge), so every tree you see is solid.
 */
export function forestTreeAt(x: number, z: number): { x: number; z: number; s: number } | null {
  const jx = x + (sceneryHash(x, z) - 0.5) * 3.5, jz = z + (sceneryHash(z, x) - 0.5) * 3.5;
  const radius = Math.hypot(jx, jz);
  const chance = radius < 16 ? 0 : radius < 40 ? 0.1 : radius < 58 ? 0.22 : radius < 72 ? 0.3 : 0.38;
  if (radius > HUB.radius + 2 || sceneryHash(jx * 1.3, jz * 0.7) > chance) return null;
  if (pathDistance(jx, jz) < 4 || riverDistance(jx, jz) < 6) return null;
  if (Object.values(HUB_PLACES).some((place) => Math.hypot(jx - place.x, jz - place.z) < place.r + 7)) return null;
  if (Math.hypot(jx - HUB_PLACES.trailhead.x, jz - HUB_PLACES.trailhead.z) < 12 || sceneryHeight(jx, jz) < 0.05) return null;
  if (townClear(jx, jz, 3.5)) return null;
  if (Math.abs(radius - TRAIN.r) < 4.5) return null; // the railway runs here
  const s = 0.8 + sceneryHash(jx, jz * 3) * 0.7 + (radius > 60 ? 0.4 : 0);
  return { x: jx, z: jz, s };
}
export const FOREST_GRID = { from: -112, to: 112, step: 4.5 } as const;
for (let x = FOREST_GRID.from; x <= FOREST_GRID.to; x += FOREST_GRID.step) {
  for (let z = FOREST_GRID.from; z <= FOREST_GRID.to; z += FOREST_GRID.step) {
    const t = forestTreeAt(x, z);
    if (t) addSolid(t.x, t.z, 1.35 * t.s + 0.35);
  }
}
for (let i = 0; i < 30; i++) {
  const a = sceneryHash(i, 7) * Math.PI * 2, d = 20 + sceneryHash(i, 8) * 45;
  const x = Math.cos(a) * d, z = Math.sin(a) * d;
  if (pathDistance(x, z) > 2.5 && !townClear(x, z, 1)) addSolid(x, z, 0.9 + sceneryHash(i, 9) * 1.2);
}

/** Standing inside this radius of the trailhead portal offers the toboggan race. */
export const PORTAL_RADIUS = 4;

export const CHAT = {
  maxLength: 120,
  /** Token bucket: burst of 5 messages, then one every 1.5 s. */
  burst: 5,
  refillMs: 1500,
  /** Identical message repeated within this window is treated as spam. */
  duplicateWindowMs: 8000,
} as const;

export const ECONOMY = {
  startingCoins: 100,
} as const;

export const RACE = {
  size: 4,
  queueWaitMs: 8000,
  countdownMs: 3000,
  tickRate: 20,
  timeLimitS: 70,
} as const;

export const FUR_COLORS = ["#8a5a3b", "#a8703f", "#6b4428", "#c48a52", "#4e3324", "#b5835a", "#d9b38c", "#3b2a20", "#9a6f58"] as const;
export const NAME_MAX = 16;
