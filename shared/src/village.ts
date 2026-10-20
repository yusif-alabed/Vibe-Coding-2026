import { HUB_COLLIDERS, HUB_PLACES, pathDistance, riverDistance, sceneryHash, townClear } from "./constants";

/**
 * Layout of the village's larger hand-placed structures (grand lodge, fences, path lanterns).
 * The client builds the visuals from these same numbers and the server registers matching
 * collision circles, so every player sees and bumps into exactly the same things.
 */

/** Grand lodge: local +z faces the plaza. Sizes in metres. */
export const LODGE = {
  x: HUB_PLACES.lodge.x,
  z: HUB_PLACES.lodge.z,
  ry: Math.atan2(-HUB_PLACES.lodge.x, -HUB_PLACES.lodge.z),
  width: 17,
  depth: 10,
  terrace: 3.2,
  /** Local x of the stairs down from the terrace. */
  stairsX: 6,
} as const;

/** Converts lodge-local (x across, z toward the plaza) to world coordinates. */
export function lodgeToWorld(lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(LODGE.ry), s = Math.sin(LODGE.ry);
  return { x: LODGE.x + lx * c + lz * s, z: LODGE.z - lx * s + lz * c };
}

/** Split-rail fences, as polylines. Posts every FENCE_SPACING metres. */
export const FENCE_SPACING = 2.2;
const lakeArc = (from: number, to: number): [number, number][] => {
  const pts: [number, number][] = [];
  const steps = Math.max(2, Math.round((Math.abs(to - from) * (Math.PI / 180) * 19.2) / FENCE_SPACING));
  for (let i = 0; i <= steps; i++) {
    const a = ((from + ((to - from) * i) / steps) * Math.PI) / 180;
    pts.push([HUB_PLACES.lake.x + Math.cos(a) * 19.2, HUB_PLACES.lake.z + Math.sin(a) * 19.2]);
  }
  return pts;
};
export const FENCES: [number, number][][] = [
  // Along the river bank, east of the plaza.
  [[30.7, -16], [30.6, -12.4]],
  [[30.1, -3.6], [29.6, 3]],
  // Lake shore on the village side, leaving a gap for the dock.
  lakeArc(-100, -62),
  lakeArc(-36, -12),
  // West side of the path down to the bridge.
  [[-1.2, 16], [0.1, 24], [1.4, 32]],
];

/** Every fence post position (lanterns sit on every third post). Posts that would sit in a tree or rock are left out. */
export function fencePosts(): { x: number; z: number; lantern: boolean }[] {
  return FENCE_POSTS;
}
const FENCE_POSTS = (() => {
  const solids = HUB_COLLIDERS.slice();
  const posts: { x: number; z: number; lantern: boolean }[] = [];
  for (const line of FENCES) {
    let n = 0;
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i], [bx, bz] = line[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      const steps = Math.max(1, Math.round(len / FENCE_SPACING));
      for (let k = 0; k < steps + (i === line.length - 2 ? 1 : 0); k++) {
        const t = k / steps;
        const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
        n++;
        if (solids.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 0.6)) continue;
        posts.push({ x, z, lantern: (n - 1) % 3 === 0 });
      }
    }
  }
  return posts;
})();

/** Free-standing lantern posts lining the main trails. */
export const PATH_LANTERNS: { x: number; z: number }[] = (() => {
  const out: { x: number; z: number }[] = [];
  const trails: [number, number][] = [
    [HUB_PLACES.lodge.x, HUB_PLACES.lodge.z],
    [HUB_PLACES.outfitter.x, HUB_PLACES.outfitter.z],
    [HUB_PLACES.arcade.x, HUB_PLACES.arcade.z],
    [HUB_PLACES.dock.x, HUB_PLACES.dock.z],
    [HUB_PLACES.trailhead.x, HUB_PLACES.trailhead.z + 2],
  ];
  trails.forEach(([tx, tz], i) => {
    const len = Math.hypot(tx, tz);
    const dx = tx / len, dz = tz / len;
    const side = i % 2 ? 1 : -1;
    for (const d of [17, 25]) {
      if (d > len - 6) continue;
      out.push({ x: dx * d - dz * 2.6 * side, z: dz * d + dx * 2.6 * side });
    }
  });
  return out;
})();

/**
 * Extra shade trees scattered through the meadow (on top of the forest rule in constants.ts),
 * so the village feels framed by big spruces. Each is solid on the server too.
 */
export const MEADOW_TREES: { x: number; z: number; s: number }[] = (() => {
  const out: { x: number; z: number; s: number }[] = [];
  const solids = HUB_COLLIDERS.slice();
  const lodgeSpots = [[-6, -1.5], [0, -1.5], [6, -1.5], [-6, 4.5], [0, 4.5], [6, 4.5]].map(([a, b]) => lodgeToWorld(a, b));
  for (let x = -98; x <= 98; x += 7) {
    for (let z = -98; z <= 98; z += 7) {
      const jx = x + (sceneryHash(x + 5, z) - 0.5) * 4, jz = z + (sceneryHash(z, x + 5) - 0.5) * 4;
      const r = Math.hypot(jx, jz);
      if (r < 22 || r > 97 || sceneryHash(jx * 2.1, jz * 1.7) > 0.32) continue;
      if (townClear(jx, jz, 5)) continue;
      // Keep the arrival view (south of the plaza, looking north) open.
      if (jz > 12 && Math.abs(jx) < 16) continue;
      if (pathDistance(jx, jz) < 5 || riverDistance(jx, jz) < 7) continue;
      if (Object.values(HUB_PLACES).some((p) => Math.hypot(jx - p.x, jz - p.z) < p.r + 8)) continue;
      if (Math.hypot(jx - HUB_PLACES.lake.x, jz - HUB_PLACES.lake.z) < 22) continue;
      if (Math.hypot(jx - HUB_PLACES.trailhead.x, jz - HUB_PLACES.trailhead.z) < 14) continue;
      if (lodgeSpots.some((q) => Math.hypot(q.x - jx, q.z - jz) < 8)) continue;
      if (solids.some((c) => Math.hypot(c.x - jx, c.z - jz) < c.r + 3)) continue;
      if (FENCES.some((line) => line.some(([fx, fz]) => Math.hypot(fx - jx, fz - jz) < 4))) continue;
      if (PATH_LANTERNS.some((l) => Math.hypot(l.x - jx, l.z - jz) < 3)) continue;
      out.push({ x: jx, z: jz, s: 1.1 + sceneryHash(jx, jz) * 0.6 });
    }
  }
  return out;
})();

// ---- Collision for the structures above ----
for (const [lx, lz] of [[-6, -1.5], [0, -1.5], [6, -1.5], [-6, 4.5], [0, 4.5], [6, 4.5]]) {
  const p = lodgeToWorld(lx, lz);
  HUB_COLLIDERS.push({ x: p.x, z: p.z, r: 4 });
}
{
  const posts = fencePosts();
  for (let i = 0; i < posts.length; i++) {
    HUB_COLLIDERS.push({ x: posts[i].x, z: posts[i].z, r: 0.32 });
    const next = posts[i + 1];
    // Rails between posts of the same fence line.
    if (next && Math.hypot(next.x - posts[i].x, next.z - posts[i].z) < FENCE_SPACING * 1.3) {
      HUB_COLLIDERS.push({ x: (posts[i].x + next.x) / 2, z: (posts[i].z + next.z) / 2, r: 0.42 });
    }
  }
}
for (const l of PATH_LANTERNS) HUB_COLLIDERS.push({ x: l.x, z: l.z, r: 0.3 });
for (const t of MEADOW_TREES) HUB_COLLIDERS.push({ x: t.x, z: t.z, r: 1.35 * t.s + 0.35 });
