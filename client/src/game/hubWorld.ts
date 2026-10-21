import { TRAIN, BRIDGES, fencePosts, FOOTHILLS_R, FOREST_GRID, forestTreeAt, HUB, HUB_PLACES, LODGE, lodgeToWorld, MEADOW_TREES, PATH_LANTERNS, RIVER_LINE, STREETS, TOWN_AREAS, TOWN_PLACES, TRAILS, townClear } from "@beaver/shared";
import { compose, fbm2, hash2, hexToRgb, mixRgb, noise2, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { P, rgb } from "./palette";
import { bench, canoe, cliff, dock, fencePost, fenceRails, Frame, fountain, grandLodge, lanternPost, timberCabin, box } from "./village/architecture";
import { buildMountainMesh, type MountainOpts } from "./village/mountains";
import { buildTown, type FerrisInfo } from "./village/town";
import { buildNeon } from "./village/neon";
import { BALLOON_COLORS, buildBalloon, buildGondolaLine, buildRailway, buildTrain, gondolaCabins, trainUnit } from "./village/transport";
import { boulder, buttercup, daisy, fern, grassTuft, lupine, spruce, stoneBlock } from "./village/nature";

/**
 * The Beaver Banff village, modelled after a golden-hour postcard of the Rockies:
 * a cobbled plaza around a rocky beaver fountain, a grand timber lodge, flagstone trails through
 * flower meadows, a glacier lake with a dock, waterfalls, spruce forest and huge snowy peaks.
 *
 * Layout (places, trails, river, tree and rock positions) mirrors shared/src/constants.ts and
 * shared/src/village.ts, so what you see is exactly what the server treats as solid.
 */

export const WATER_Y = -0.35;
const PL = HUB_PLACES;
const C = (h: string) => hexToRgb(h);

/** Height of the walkable dock deck, if the given point lies on its boards. */
export function dockHeightAt(x: number, z: number): number | null {
  const angle = Math.atan2(PL.lake.x - PL.dock.x, PL.lake.z - PL.dock.z);
  const dx = x - PL.dock.x, dz = z - PL.dock.z;
  const along = dx * Math.sin(angle) + dz * Math.cos(angle);
  const across = dx * Math.cos(angle) - dz * Math.sin(angle);
  if (along < -0.55 || along > 10.15 || Math.abs(across) > 1.6) return null;
  return 0.25;
}

type Bridge = (typeof BRIDGES)[number];

/** Height of a timber bridge deck at a world point, if it is walkable. */
export function bridgeHeightAt(x: number, z: number): number | null {
  for (const br of BRIDGES) {
    const dx = x - br.x, dz = z - br.z;
    // Inverse of the architecture Frame transform: local x is across the deck, local z runs along it.
    const lx = dx * Math.cos(br.ry) - dz * Math.sin(br.ry);
    const lz = dx * Math.sin(br.ry) + dz * Math.cos(br.ry);
    if (Math.abs(lx) > 1.58 || Math.abs(lz) > br.halfLength) continue;
    return bridgeDeckTop(br, lz);
  }
  return null;
}

/** Ground height at each end of each bridge, so decks land on the banks instead of floating. */
const bridgeEnds = new Map<Bridge, [number, number]>();
/** Top of an arched bridge deck at a point along its length (local z, -halfLength..halfLength). */
function bridgeDeckTop(br: Bridge, lz: number): number {
  let ends = bridgeEnds.get(br);
  if (!ends) {
    const at = (l: number) => heightAt(br.x + l * Math.sin(br.ry), br.z + l * Math.cos(br.ry));
    ends = [at(-br.halfLength), at(br.halfLength)];
    bridgeEnds.set(br, ends);
  }
  const t = (lz + br.halfLength) / (br.halfLength * 2);
  const base = ends[0] + (ends[1] - ends[0]) * Math.max(0, Math.min(1, t));
  return base + 0.04 + Math.pow(Math.max(0, Math.cos((lz / br.halfLength) * (Math.PI / 2))), 0.7) * 1.05;
}

/** River centreline: down from the north-east peaks, past the arcade, around the south of the village, into the lake. */
const RIVER = RIVER_LINE as [number, number][];

/** Trails and town streets (shared with the server, which keeps trees off them). */
const PATHS = TRAILS as [number, number, number, number][];
const MAIN_STREET = STREETS[0];
const SQUARE = TOWN_AREAS.find((a) => a.kind === "square")!;

function distSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

export function riverDist(x: number, z: number): number {
  let d = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) d = Math.min(d, distSeg(x, z, ...RIVER[i], ...RIVER[i + 1]));
  return d;
}

function pathDist(x: number, z: number): number {
  let d = Infinity;
  for (const p of PATHS) d = Math.min(d, distSeg(x, z, ...p));
  return d;
}

/** Outer edge of the cobbled plaza (wobbly, so it doesn't look stamped). */
export function plazaEdge(a: number): number {
  return 13.3 + Math.sin(a * 3 + 0.55) * 0.55 + Math.cos(a * 5 - 1.1) * 0.3;
}

// Waterfall cliff behind the lake (outside the walkable area).
const SW = Math.atan2(PL.lake.z, PL.lake.x);
const LAKE_FALL = { lip: 24, plunge: 18.6 };
const lakePoint = (d: number): [number, number] => [PL.lake.x + Math.cos(SW) * d, PL.lake.z + Math.sin(SW) * d];
const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Ground height anywhere in the hub (shared by rendering, walking and the camera). */
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let h = 0;
  if (r > 12) h += 0.35 * Math.sin(x * 0.13) * Math.cos(z * 0.11) * Math.min(1, (r - 12) / 10);
  // Beyond the walkable area the land rises into gentle forested foothills.
  if (r > FOOTHILLS_R) h += Math.pow(r - FOOTHILLS_R, 1.25) * 0.18 + fbm2(x * 0.03, z * 0.03, 3) * 3 * Math.min(1, (r - FOOTHILLS_R) / 15);
  // Snowy hill behind the trailhead.
  const th = Math.hypot(x - PL.trailhead.x, (z - PL.trailhead.z + 14) * 0.8);
  if (z < PL.trailhead.z - 3) h += Math.max(0, 16 - th) * 0.45;
  // Rock wall behind the far side of the lake (beyond the walkable radius only).
  if (r > 64.5) {
    const lx = x - PL.lake.x, lz = z - PL.lake.z;
    const ld = Math.hypot(lx, lz);
    let da = Math.atan2(lz, lx) - SW;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    h += smooth(19.5, 25, ld) * 24 * Math.exp(-((da / 0.55) ** 2)) * smooth(64.5, 67, r);
  }
  // Lake bowl.
  const ld = Math.hypot(x - PL.lake.x, z - PL.lake.z);
  if (ld < 19) h = Math.min(h, -2.2 * Math.pow(1 - ld / 19, 0.6) + 0.35);
  // Plunge pool under the lake waterfall.
  if (r > 64.5) {
    const [px, pz] = lakePoint(LAKE_FALL.plunge);
    const pd = Math.hypot(x - px, z - pz);
    if (pd < 3.2) h = Math.min(h, -1.4 + pd * 0.35);
  }
  // River channel.
  const rd = riverDist(x, z);
  if (rd < 4.2) h = Math.min(h, -1.3 * (1 - rd / 4.2) + 0.25 * (rd / 4.2));
  // Hot spring dip.
  const hs = Math.hypot(x - PL.hotSpring.x, z - PL.hotSpring.z);
  if (hs < 3.4) h = Math.min(h, -0.6);
  return h;
}

const GROUT = C("#6f6455");
const DIRT = C("#a07c50");
const SAND = C("#bba47c");
const LAKEBED = C("#3b6b68");
const MEADOW_SUN = C("#93ad4b");
const MEADOW = C("#729c3d");
const MEADOW_DEEP = C("#577f35");
const MEADOW_DRY = C("#aca35c");
const FOREST_FLOOR = C("#3f5b33");
const ROCKY = C("#857c70");

function groundColor(x: number, y: number, z: number, ny: number): Vec3 {
  const r = Math.hypot(x, z);
  const n = fbm2(x * 0.06, z * 0.06, 3);
  const fine = noise2(x * 0.45, z * 0.45);
  if (z < PL.trailhead.z - 4 && y > 1.2 && r < 70) return mixRgb(rgb(P.snow), rgb(P.snowShade), fine * 0.5);
  if (y < WATER_Y - 0.05) return LAKEBED;
  const nearWater = riverDist(x, z) < 5.4 || Math.hypot(x - PL.lake.x, z - PL.lake.z) < 20.5;
  if (y < 0.12 && nearWater) return mixRgb(SAND, C("#8f8a7c"), fine * 0.5);
  const a = Math.atan2(z, x);
  if (r < plazaEdge(a) + 0.15) return GROUT;
  // Cobbled Main Street and town square.
  if (distSeg(x, z, ...MAIN_STREET) < 2.9 && r > 12 || Math.hypot(x - SQUARE.x, z - SQUARE.z) < SQUARE.r) return mixRgb(GROUT, C("#7d7262"), fine * 0.4);
  const pd = pathDist(x, z);
  if (pd < 2.3 && r > 6) return mixRgb(DIRT, C("#80643f"), fine * 0.4);
  if (r > FOOTHILLS_R) {
    if (ny < 0.55) return mixRgb(ROCKY, C("#6d665f"), fine);
    return mixRgb(FOREST_FLOOR, MEADOW_DEEP, n * 0.8);
  }
  let c = mixRgb(MEADOW, MEADOW_SUN, smooth(0.35, 0.7, n));
  c = mixRgb(c, MEADOW_DEEP, smooth(0.55, 0.85, fbm2(x * 0.11 + 9, z * 0.11, 2)) * 0.6);
  c = mixRgb(c, MEADOW_DRY, smooth(0.62, 0.8, noise2(x * 0.03 - 4, z * 0.03 + 2)) * 0.5);
  // Worn dirt fringe beside the trails.
  if (pd < 3.6 && r > 6) c = mixRgb(c, DIRT, (1 - smooth(2.3, 3.6, pd)) * 0.6 * (0.6 + fine * 0.4));
  return mixRgb(c, MEADOW_DEEP, (fine - 0.5) * 0.25);
}

export interface HubWorld {
  terrain: GpuMesh;
  /** Colourful night lights: bright cores and soft halos (halos only show after dark). */
  neon: GpuMesh;
  neonHalo: GpuMesh;
  townGlass: GpuMesh;
  townIce: GpuMesh;
  spins: { mesh: GpuMesh; x: number; y: number; z: number; ry: number; speed: number; axis: "z" | "y"; mode: "lit" | "glow" | "beam" }[];
  gondola: GpuMesh;
  ferris: FerrisInfo | null;
  train: { engine: GpuMesh; car: GpuMesh; lamp: GpuMesh };
  liftCabin: GpuMesh;
  balloons: GpuMesh[];
  chimneys: Vec3[];
  fires: Vec3[];
  ground: GpuMesh;
  grass: GpuMesh;
  flowers: GpuMesh;
  trees: GpuMesh;
  props: GpuMesh[];
  glow: GpuMesh;
  water: GpuMesh;
  falls: GpuMesh;
  foam: GpuMesh;
  mountains: GpuMesh;
  portal: GpuMesh;
  steam: GpuMesh;
  shadow: GpuMesh;
  labels: { text: string; x: number; y: number; z: number }[];
}

/** Kept for older callers: the sky is now drawn procedurally by the renderer. */
export function buildSky(r: Renderer, _top?: string, _horizon?: string, _glow?: string): GpuMesh {
  return r.upload(new MeshBuilder().build());
}

/** Snow-capped mountain ring (also used by the toboggan run). */
export function buildMountains(r: Renderer, seed: number, ring: [number, number], _count: number, center: [number, number] = [0, 0]): GpuMesh {
  const o: MountainOpts = {
    inner: ring[0],
    outer: ring[1] * 1.6,
    baseHeight: () => 0,
    heroAngle: -Math.PI / 2,
    center,
    seed,
  };
  return r.upload(buildMountainMesh(o).build());
}

/** Flat stone (cobble or flagstone): domed top, bevelled edge. */
function stoneTile(m: MeshBuilder, x: number, y: number, z: number, rx: number, rz: number, rot: number, col: Vec3, h: number, seed: number) {
  const K = 6;
  const top: Vec3[] = [], out: Vec3[] = [];
  for (let k = 0; k < K; k++) {
    const a = rot + (k / K) * Math.PI * 2 + (hash2(seed, k) - 0.5) * 0.5;
    const j = 0.82 + hash2(k, seed) * 0.3;
    const ca = Math.cos(a), sa = Math.sin(a);
    const lx = ca * rx * j, lz = sa * rz * j;
    const wx = x + lx * Math.cos(rot) - lz * Math.sin(rot), wz = z + lx * Math.sin(rot) + lz * Math.cos(rot);
    top.push([x + (wx - x) * 0.78, y + h, z + (wz - z) * 0.78]);
    out.push([wx, y + 0.005, wz]);
  }
  const center: Vec3 = [x, y + h * 1.12, z];
  const tone = 0.9 + hash2(seed, 0.3) * 0.2;
  const c: Vec3 = [col[0] * tone, col[1] * tone, col[2] * tone];
  const cEdge: Vec3 = [c[0] * 0.82, c[1] * 0.82, c[2] * 0.82];
  for (let k = 0; k < K; k++) {
    const k1 = (k + 1) % K;
    const nt = (p: Vec3): Vec3 => {
      const dx = p[0] - x, dz = p[2] - z;
      const l = Math.hypot(dx, 0.9, dz);
      return [dx / l * 0.5, 0.9 / l, dz / l * 0.5];
    };
    m.vertex(center, [0, 1, 0], c).vertex(top[k], nt(top[k]), c).vertex(top[k1], nt(top[k1]), c);
    const no = (p: Vec3): Vec3 => {
      const dx = p[0] - x, dz = p[2] - z;
      const l = Math.hypot(dx, 0.5, dz);
      return [dx / l, 0.5 / l, dz / l];
    };
    m.vertex(top[k], nt(top[k]), c).vertex(out[k], no(out[k]), cEdge).vertex(out[k1], no(out[k1]), cEdge);
    m.vertex(top[k], nt(top[k]), c).vertex(out[k1], no(out[k1]), cEdge).vertex(top[k1], nt(top[k1]), c);
  }
}

const COBBLES = ["#b4a794", "#a39684", "#c6b9a3", "#968a7a", "#bfae92", "#a89a8a"].map(C);

export function buildHub(r: Renderer): HubWorld {
  const groundNormal = (x: number, z: number): Vec3 => {
    const e = 0.6;
    const nx = heightAt(x - e, z) - heightAt(x + e, z);
    const nz = heightAt(x, z - e) - heightAt(x, z + e);
    const l = Math.hypot(nx, e * 2, nz) || 1;
    return [nx / l, (e * 2) / l, nz / l];
  };

  // ------------------------------------------------------------ Terrain
  const t = new MeshBuilder();
  const S = 1.5, R = 160;
  const cache = new Map<string, { p: Vec3; n: Vec3; c: Vec3 }>();
  const vtx = (x: number, z: number) => {
    const k = `${x},${z}`;
    let v = cache.get(k);
    if (!v) {
      const y = heightAt(x, z);
      const n = groundNormal(x, z);
      v = { p: [x, y, z], n, c: groundColor(x, y, z, n[1]) };
      cache.set(k, v);
    }
    return v;
  };
  for (let x = -R; x < R; x += S) {
    for (let z = -R; z < R; z += S) {
      if (Math.hypot(x + S / 2, z + S / 2) > 158) continue;
      const a = vtx(x, z), b = vtx(x + S, z), c = vtx(x + S, z + S), d = vtx(x, z + S);
      for (const v of [a, b, c, a, c, d]) t.vertex(v.p, v.n, v.c);
    }
  }
  cache.clear();

  // ------------------------------------------------------------ Plaza cobbles, trails, flagstones
  const ground = new MeshBuilder();
  for (let ri = 0; ; ri++) {
    const rr = 7.45 + ri * 0.44;
    if (rr > 14.6) break;
    const n = Math.floor((Math.PI * 2 * rr) / 0.47);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ri * 0.37 + (hash2(ri, i) - 0.5) * 0.04;
      if (rr > plazaEdge(a) - 0.1) continue;
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      const col = COBBLES[Math.floor(hash2(i, ri * 7) * COBBLES.length)];
      stoneTile(ground, x, heightAt(x, z) + 0.01, z, 0.21, 0.24, a, col, 0.07, i * 131 + ri);
    }
  }
  // Curb of larger stones around the plaza edge.
  for (let i = 0; i < 92; i++) {
    const a = (i / 92) * Math.PI * 2;
    const rr = plazaEdge(a) + 0.12;
    const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    if (pathDist(x, z) < 1.9) continue;
    stoneTile(ground, x, heightAt(x, z) + 0.01, z, 0.36, 0.28, a + Math.PI / 2, mixRgb(COBBLES[2], C("#8d8272"), hash2(i, 5)), 0.11, i * 17);
  }
  // Cobbled Main Street and the town square.
  {
    const [ax, az, bx, bz] = MAIN_STREET;
    const len = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / len, dz = (bz - az) / len;
    for (let d = 13.6; d < len; d += 0.46) {
      for (let k = -5; k <= 5; k++) {
        const off = k * 0.5 + (Math.floor(d / 0.46) % 2 ? 0.25 : 0);
        if (Math.abs(off) > 2.7) continue;
        const x = ax + dx * d - dz * off, z = az + dz * d + dx * off;
        if (Math.hypot(x - SQUARE.x, z - SQUARE.z) < SQUARE.r - 0.3) continue;
        const col = COBBLES[Math.floor(hash2(d * 3, k) * COBBLES.length)];
        stoneTile(ground, x, heightAt(x, z) + 0.01, z, 0.22, 0.24, Math.atan2(dz, dx), col, 0.07, Math.floor(d * 31) + k * 7);
      }
    }
    for (let ri = 0; ; ri++) {
      const rr = 0.5 + ri * 0.46;
      if (rr > SQUARE.r - 0.2) break;
      const n = Math.max(6, Math.floor((Math.PI * 2 * rr) / 0.48));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + ri * 0.3;
        const x = SQUARE.x + Math.cos(a) * rr, z = SQUARE.z + Math.sin(a) * rr;
        const col = COBBLES[Math.floor(hash2(i, ri * 5 + 1) * COBBLES.length)];
        stoneTile(ground, x, heightAt(x, z) + 0.01, z, 0.22, 0.24, a, col, 0.07, i * 97 + ri);
      }
    }
  }
  const up: Vec3 = [0, 1, 0];
  const ribbon = (ax: number, az: number, bx: number, bz: number, half: number, lift: number, colA: Vec3, colB: Vec3) => {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * half, nz = (dx / len) * half;
    const steps = Math.max(2, Math.ceil(len / 0.6));
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const x0 = ax + dx * t0, z0 = az + dz * t0, x1 = ax + dx * t1, z1 = az + dz * t1;
      const wob = (tt: number) => 1 + (noise2(ax * 3 + tt * len * 0.4, az) - 0.5) * 0.35;
      const w0 = wob(t0), w1 = wob(t1);
      const A: Vec3 = [x0 + nx * w0, heightAt(x0 + nx * w0, z0 + nz * w0) + lift, z0 + nz * w0];
      const B: Vec3 = [x0 - nx * w0, heightAt(x0 - nx * w0, z0 - nz * w0) + lift, z0 - nz * w0];
      const Cc: Vec3 = [x1 - nx * w1, heightAt(x1 - nx * w1, z1 - nz * w1) + lift, z1 - nz * w1];
      const D: Vec3 = [x1 + nx * w1, heightAt(x1 + nx * w1, z1 + nz * w1) + lift, z1 + nz * w1];
      const ca = mixRgb(colA, colB, noise2(x0 * 0.7, z0 * 0.7)), cb = mixRgb(colA, colB, noise2(x1 * 0.7, z1 * 0.7));
      ground.vertex(A, up, ca).vertex(B, up, ca).vertex(Cc, up, cb);
      ground.vertex(A, up, ca).vertex(Cc, up, cb).vertex(D, up, cb);
    }
  };
  const FLAG = [C("#b9ad98"), C("#a99c87"), C("#c9bfa9"), C("#9c907e")];
  PATHS.forEach(([ax, az, bx, bz], pi) => {
    if (ax === MAIN_STREET[0] && az === MAIN_STREET[1] && bx === MAIN_STREET[2] && bz === MAIN_STREET[3]) return;
    const fromCenter = Math.hypot(ax, az) < 0.1;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const dx = (bx - ax) / len, dz = (bz - az) / len;
    const a = Math.atan2(dz, dx);
    const sx = fromCenter ? dx * (plazaEdge(a) - 0.4) : ax;
    const sz = fromCenter ? dz * (plazaEdge(a) - 0.4) : az;
    ribbon(sx, sz, bx, bz, 2.05, 0.02, C("#8d6c45"), C("#a17e52"));
    ribbon(sx, sz, bx, bz, 1.6, 0.035, C("#bd9a68"), C("#cdae7c"));
    // Flagstones set into the trail.
    const tl = Math.hypot(bx - sx, bz - sz);
    for (let d = 0.6; d < tl - 0.5; d += 0.78) {
      for (let k = 0; k < 2; k++) {
        if (hash2(d * 3 + k, pi) < 0.25) continue;
        const side = (k === 0 ? -0.55 : 0.55) + (hash2(d, k + pi) - 0.5) * 0.5;
        const x = sx + dx * (d + hash2(k, d) * 0.3) - dz * side, z = sz + dz * (d + hash2(k, d) * 0.3) + dx * side;
        const s = 0.28 + hash2(d, pi * 3 + k) * 0.18;
        stoneTile(ground, x, heightAt(x, z) + 0.03, z, s, s * (0.7 + hash2(k, d * 2) * 0.4), hash2(d, k) * 6, FLAG[Math.floor(hash2(k * 7, d) * 4)], 0.06, Math.floor(d * 100) + k + pi * 999);
      }
    }
    // Pebbles along the trail edges.
    for (let d = 0.5; d < tl; d += 0.9) {
      for (const side of [-1, 1]) {
        if (hash2(d, side + pi) < 0.45) continue;
        const off = side * (1.75 + hash2(side, d) * 0.6);
        const x = sx + dx * d - dz * off, z = sz + dz * d + dx * off;
        stoneTile(ground, x, heightAt(x, z), z, 0.14, 0.11, d, FLAG[3], 0.08, Math.floor(d * 37) + pi);
      }
    }
  });

  // ------------------------------------------------------------ Props
  const props: GpuMesh[] = [];
  let p = new MeshBuilder();
  const finish = () => {
    if (p.vertexCount) props.push(r.upload(p.build()));
    p = new MeshBuilder();
  };
  const glow = new MeshBuilder();
  const falls = new MeshBuilder();
  const foam = new MeshBuilder();
  const w = new MeshBuilder();
  const face = (x: number, z: number) => Math.atan2(-x, -z);

  // Fountain.
  const fountainInfo = fountain(p, falls, foam, heightAt(0, 0));
  finish();
  // Plaza benches and lantern posts (positions match the shared collision layout).
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const lx = Math.cos(a) * 11.5, lz = Math.sin(a) * 11.5;
    lanternPost(p, glow, lx, heightAt(lx, lz), lz, -a);
    const bx = Math.cos(a + 0.5) * 8.6, bz = Math.sin(a + 0.5) * 8.6;
    bench(p, bx, heightAt(bx, bz) + 0.02, bz, Math.atan2(-bx, -bz) + Math.PI, i);
  }
  for (const l of PATH_LANTERNS) lanternPost(p, glow, l.x, heightAt(l.x, l.z), l.z, Math.atan2(l.x, l.z));
  finish();

  // Grand lodge with its fire pit and benches.
  grandLodge(p, glow, heightAt(LODGE.x, LODGE.z));
  finish();
  {
    const fx = -12, fz = -9, fy = heightAt(fx, fz);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      stoneBlock(p, compose(fx + Math.cos(a) * 1.15, fy + 0.15, fz + Math.sin(a) * 1.15, -a, 0, 0, 0.32, 0.22, 0.26), i + 400);
    }
    for (const a of [0.4, 2.0, 3.6]) p.cylinder(compose(fx, fy + 0.25, fz, a, 0, Math.PI / 2 - 0.35, 0.2, 1.2, 0.2), C("#5a3a24"), 6);
    glow.sphere(compose(fx, fy + 0.45, fz, 0, 0, 0, 0.55, 0.7, 0.55), C("#ffb347"), 4, 6);
    glow.sphere(compose(fx, fy + 0.7, fz, 0, 0, 0, 0.3, 0.5, 0.3), C("#ffe08a"), 4, 6);
    bench(p, PL.lodge.x + 5, heightAt(PL.lodge.x + 5, PL.lodge.z + 9.5), PL.lodge.z + 9.5, -0.6 + Math.PI, 11);
    bench(p, PL.lodge.x + 11, heightAt(PL.lodge.x + 11, PL.lodge.z + 5), PL.lodge.z + 5, -2.2 + Math.PI, 12);
  }
  finish();

  // Outfitter and arcade cabins.
  timberCabin(p, glow, PL.outfitter.x, heightAt(PL.outfitter.x, PL.outfitter.z), PL.outfitter.z, face(PL.outfitter.x, PL.outfitter.z), 8, 6.5, C("#c8473a"), 21);
  {
    const rx = PL.outfitter.x - 6.5, rz = PL.outfitter.z + 2, ry = heightAt(rx, rz);
    const fr = new Frame(rx, ry, rz, 0.5);
    for (const s of [-1.1, 1.1]) box(p, fr, s, 0.8, 0, 0.18, 1.6, 0.18, C("#6f4426"));
    for (const h of [0.75, 1.4]) box(p, fr, 0, h, 0, 2.6, 0.12, 0.2, C("#6f4426"));
    canoe(p, rx, ry + 1.0, rz, 0.5, C("#e08a2c"));
    canoe(p, rx, ry + 1.6, rz, 0.5, C("#2f7fb0"));
  }
  finish();
  timberCabin(p, glow, PL.arcade.x, heightAt(PL.arcade.x, PL.arcade.z), PL.arcade.z, face(PL.arcade.x, PL.arcade.z), 7.5, 6.5, C("#28b9b7"), 33);
  glow.torus(compose(PL.arcade.x - 2.6, 7.6, PL.arcade.z - 1.8, face(PL.arcade.x, PL.arcade.z), Math.PI / 2, 0, 1.1), C("#ff6fb5"), 1, 0.12, 20, 5);
  for (let i = 0; i < 9; i++) {
    const fr = new Frame(PL.arcade.x, heightAt(PL.arcade.x, PL.arcade.z), PL.arcade.z, face(PL.arcade.x, PL.arcade.z));
    const pp = fr.p(-3.4 + i * 0.85, 3.9 - Math.sin((i / 8) * Math.PI) * 0.35, 5.3);
    glow.sphere(compose(pp[0], pp[1], pp[2], 0, 0, 0, 0.16), [C("#ffd166"), C("#ff6fb5"), C("#7ff3f0")][i % 3], 3, 5);
  }
  finish();

  // Distant chalets on the forested slopes.
  const CHALETS: [number, number][] = [[-60, -106], [-28, -118], [32, -116], [112, -30], [-116, 18], [-114, -22], [108, 52], [-70, 100], [40, 112]];
  CHALETS.forEach(([x, z], i) => timberCabin(p, glow, x, heightAt(x, z), z, face(x, z), 6, 5, null, 50 + i, false));
  finish();

  // Fences with lanterns.
  const posts = fencePosts();
  posts.forEach((q, i) => {
    const y = heightAt(q.x, q.z);
    fencePost(p, glow, q.x, y, q.z, i, q.lantern);
    const nx = posts[i + 1];
    if (nx && Math.hypot(nx.x - q.x, nx.z - q.z) < 2.9) fenceRails(p, [q.x, y, q.z], [nx.x, heightAt(nx.x, nx.z), nx.z], i);
  });
  finish();

  // Dock and canoes.
  const dockA = Math.atan2(PL.lake.x - PL.dock.x, PL.lake.z - PL.dock.z);
  dock(p, glow, PL.dock.x, PL.dock.z, dockA, 0.25, 10.4);
  canoe(p, PL.dock.x + 5, WATER_Y + 0.12, PL.dock.z + 9, 0.9, C("#c8473a"));
  canoe(p, PL.dock.x - 2, WATER_Y + 0.12, PL.dock.z + 13, 2.2, C("#2f7fb0"));
  finish();

  // Bridges over the river, with railings.
  const bridgeRails: Vec3[][] = [];
  for (const BRIDGE of BRIDGES) {
    const fr = new Frame(BRIDGE.x, 0, BRIDGE.z, BRIDGE.ry);
    // Each board follows the arch at its own position, so the ends sit right on the banks.
    const deck = (lz: number) => bridgeDeckTop(BRIDGE, Math.max(-BRIDGE.halfLength, Math.min(BRIDGE.halfLength, lz))) - 0.11;
    const nb = Math.floor(BRIDGE.halfLength);
    for (let i = -nb; i <= nb; i++) {
      const lz = i * 1.0;
      const y = deck(lz), y0 = deck(lz - 0.48), y1 = deck(lz + 0.48);
      box(p, fr, 0, y, lz, 4, 0.22, 0.98, i % 2 ? C("#b9804c") : C("#9b6338"), 0, -Math.atan2(y1 - y0, 0.96), 0);
      if (Math.abs(i) % 2 === 1) for (const s of [-1.9, 1.9]) box(p, fr, s, y + 0.55, lz, 0.18, 1.1, 0.18, C("#6f4426"));
    }
    // Stout posts under the deck, down into the riverbed, plus a log sill on each bank.
    for (const lz of [-3, 3]) for (const s of [-1.7, 1.7]) {
      const top = deck(lz) - 0.1;
      const bed = heightAt(BRIDGE.x + lz * Math.sin(BRIDGE.ry) + s * Math.cos(BRIDGE.ry), BRIDGE.z + lz * Math.cos(BRIDGE.ry) - s * Math.sin(BRIDGE.ry)) - 0.4;
      p.cylinder(fr.m(s, (top + bed) / 2, lz, 0.32, top - bed, 0.32), C("#6f4426"), 8);
    }
    for (const lz of [-BRIDGE.halfLength + 0.15, BRIDGE.halfLength - 0.15]) {
      p.cylinder(fr.m(0, deck(lz) - 0.18, lz, 0.34, 4.4, 0.34, 0, 0, Math.PI / 2), C("#7a4b2c"), 8);
    }
    for (const s of [-1.9, 1.9]) {
      const rail: Vec3[] = [];
      for (let i = -nb; i <= nb; i++) rail.push(fr.p(s, deck(i) + 1.05, i));
      bridgeRails.push(rail);
    }
    for (const s of [-1.9, 1.9]) for (let i = -nb; i < nb; i++) {
      const y0 = deck(i), y1 = deck(i + 1);
      box(p, fr, s, (y0 + y1) / 2 + 1.05, i + 0.5, 0.12, 0.12, 1.05, C("#b9804c"), 0, -Math.atan2(y1 - y0, 1), 0);
    }
  }
  finish();

  // Trailhead arch: big log posts, a crossbeam and a sign, with snowy spruces behind.
  {
    const th = PL.trailhead, ty = heightAt(th.x, th.z);
    const fr = new Frame(th.x, ty, th.z, 0);
    for (const s of [-4, 4]) {
      p.cylinder(fr.m(s, 3.4, 0, 0.9, 6.8, 0.9), C("#6f4426"), 8);
      stoneBlock(p, fr.m(s, 0.3, 0, 1.3, 0.6, 1.3), s + 7);
    }
    p.cylinder(fr.m(0, 6.6, 0, 0.7, 10.6, 0.7, 0, 0, Math.PI / 2), C("#8a5532"), 8);
    box(p, fr, 0, 7.6, 0.1, 5.6, 1.2, 0.25, C("#c8473a"));
    box(p, fr, 0, 7.6, 0.25, 5.0, 0.8, 0.06, C("#f2e6c8"));
    for (const s of [-1.6, 1.6]) box(p, fr, s, 7.0, 0.1, 0.08, 0.6, 0.08, C("#2e2b2a"));
  }
  finish();

  // Hot spring boulder ring.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = PL.hotSpring.x + Math.cos(a) * 3.8, z = PL.hotSpring.z + Math.sin(a) * 3.8;
    boulder(p, x, heightAt(x, z) + 0.2, z, 1.25, 0.8, 1.1, i + 300, 0.4);
  }
  finish();

  // Loose boulders (same positions as the shared collision rocks).
  for (let i = 0; i < 30; i++) {
    const a = hash2(i, 7) * Math.PI * 2, d = 20 + hash2(i, 8) * 45;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (pathDist(x, z) <= 2.5 || townClear(x, z, 1)) continue;
    const rr = 0.9 + hash2(i, 9) * 1.2;
    boulder(p, x, heightAt(x, z) + rr * 0.15, z, rr, rr * 0.7, rr * 0.85, i * 7 + 1, 0.7);
  }
  // Decorative small stones along the plaza rim and trails.
  for (let i = 0; i < 70; i++) {
    const a = hash2(i, 31) * Math.PI * 2;
    const d = plazaEdge(a) + 0.8 + hash2(i, 32) * 3;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (pathDist(x, z) < 2.2) continue;
    const s = 0.18 + hash2(i, 33) * 0.32;
    boulder(p, x, heightAt(x, z) + s * 0.1, z, s, s * 0.6, s * 0.8, i + 700, 0.5);
  }
  finish();

  // Waterfall cliffs.
  const ne = { x: 70, z: -80 };
  const neDir = Math.atan2(52 - 70, -48 - -80); // facing down the river
  const lip: Vec3 = [ne.x + Math.sin(neDir + Math.PI) * 5.5, 0, ne.z + Math.cos(neDir + Math.PI) * 5.5];
  lip[1] = Math.min(heightAt(lip[0], lip[2]), 48);
  cliff(p, ne.x - Math.sin(neDir) * 7, 0, ne.z - Math.cos(neDir) * 7, neDir, 34, lip[1] + 4, 900);
  const [sx, sz] = lakePoint(21.8);
  const swTop = heightAt(...lakePoint(LAKE_FALL.lip + 1.5));
  cliff(p, sx, heightAt(...lakePoint(19.5)) - 1.5, sz, Math.atan2(-Math.cos(SW), -Math.sin(SW)), 30, swTop + 2, 950);
  finish();

  // ------------------------------------------------------------ Trees
  const trees = new MeshBuilder();
  const clear = CHALETS.map(([x, z]) => ({ x, z }));
  // Inside the walkable area: exactly the server's solid trees.
  for (let x = FOREST_GRID.from; x <= FOREST_GRID.to; x += FOREST_GRID.step) {
    for (let z = FOREST_GRID.from; z <= FOREST_GRID.to; z += FOREST_GRID.step) {
      const tr = forestTreeAt(x, z);
      if (!tr) continue;
      const h = heightAt(tr.x, tr.z);
      const rr = Math.hypot(tr.x, tr.z);
      const snow = h > 30 || (tr.z < PL.trailhead.z - 6 && rr < 70);
      spruce(trees, tr.x, h - 0.15, tr.z, tr.s, Math.floor(tr.x * 7 + tr.z), { lod: rr > 70 ? "far" : "near", snow });
    }
  }
  // Beyond the edge: a dense, purely visual forest climbing the foothills.
  for (let x = -158; x <= 158; x += 4.5) {
    for (let z = -158; z <= 158; z += 4.5) {
      const jx = x + (hash2(x, z) - 0.5) * 3.5, jz = z + (hash2(z, x) - 0.5) * 3.5;
      const rr = Math.hypot(jx, jz);
      if (rr > 158 || rr <= HUB.radius + 2) continue;
      if (Math.abs(rr - TRAIN.r) < 5) continue; // the railway
      if (hash2(jx * 1.3, jz * 0.7) > (rr < 125 ? 0.75 : 0.5)) continue;
      if (riverDist(jx, jz) < 6) continue;
      const h = heightAt(jx, jz);
      if (h < 0.05) continue;
      if (clear.some((c) => Math.hypot(c.x - jx, c.z - jz) < 8)) continue;
      if (groundNormal(jx, jz)[1] < 0.55 || h > 70) continue;
      if (Math.hypot(jx - lakePoint(21)[0], jz - lakePoint(21)[1]) < 9) continue;
      const s = 1.2 + hash2(jx, jz * 3) * 0.7;
      spruce(trees, jx, h - 0.15, jz, s, Math.floor(jx * 7 + jz), { lod: "far", snow: h > 30 });
    }
  }
  for (const tr of MEADOW_TREES) spruce(trees, tr.x, heightAt(tr.x, tr.z) - 0.15, tr.z, tr.s, Math.floor(tr.x * 13 + tr.z));
  // Snowy spruces around the trailhead hill.
  const th = PL.trailhead;
  for (let i = 0; i < 4; i++) for (const s of [-1, 1]) {
    const x = th.x + s * (9 + i * 4), z = th.z - 6 - i * 3;
    spruce(trees, x, heightAt(x, z) - 0.1, z, 1.15, i + (s > 0 ? 2 : 0), { snow: true });
  }

  // ------------------------------------------------------------ Grass & flowers
  const grass = new MeshBuilder();
  const flowers = new MeshBuilder();
  const lodgeSolids = [[-6, -1.5], [0, -1.5], [6, -1.5], [-6, 4.5], [0, 4.5], [6, 4.5]].map(([a, b]) => lodgeToWorld(a, b));
  const blocked = (x: number, z: number, pad: number) => {
    const rr = Math.hypot(x, z);
    if (rr < plazaEdge(Math.atan2(z, x)) + 0.25 + pad * 0.5) return true;
    if (pathDist(x, z) < 1.95 - pad * 0.3) return true;
    if (riverDist(x, z) < 4.7) return true;
    if (Math.hypot(x - PL.lake.x, z - PL.lake.z) < 19.6) return true;
    if (z < th.z - 4 && heightAt(x, z) > 1.2) return true;
    if (lodgeSolids.some((q) => Math.hypot(q.x - x, q.z - z) < 4.2)) return true;
    if (Math.hypot(x - PL.outfitter.x, z - PL.outfitter.z) < 5.6 || Math.hypot(x - PL.arcade.x, z - PL.arcade.z) < 5.4) return true;
    if (Math.hypot(x - PL.hotSpring.x, z - PL.hotSpring.z) < 4.6) return true;
    if (dockHeightAt(x, z) !== null) return true;
    if (bridgeHeightAt(x, z) !== null) return true;
    if (townClear(x, z, 0.6 + pad)) return true;
    if (distSeg(x, z, ...MAIN_STREET) < 3.0 && rr > 12) return true;
    return false;
  };
  for (let x = -98; x <= 98; x += 0.62) {
    for (let z = -98; z <= 98; z += 0.62) {
      const jx = x + (hash2(x, z) - 0.5) * 0.55, jz = z + (hash2(z, x) - 0.5) * 0.55;
      const rr = Math.hypot(jx, jz);
      // Out in the town and countryside the grass thins a little to keep the frame rate up.
      if (rr > 98 || (rr > 62 && hash2(jx * 5.3, jz * 4.1) > 0.34) || blocked(jx, jz, 0)) continue;
      const lushN = fbm2(jx * 0.09, jz * 0.09, 3);
      const nearEdge = pathDist(jx, jz) < 3.2 || rr < plazaEdge(Math.atan2(jz, jx)) + 2.2;
      const keep = 0.35 + lushN * 0.45 + (nearEdge ? 0.25 : 0);
      if (hash2(jx * 3.1, jz * 2.7) > keep) continue;
      const y = heightAt(jx, jz);
      const dry = Math.max(0, noise2(jx * 0.03 - 4, jz * 0.03 + 2) - 0.6) * 1.6;
      grassTuft(grass, jx, y - 0.01, jz, Math.floor(jx * 131 + jz * 17), Math.min(1, lushN * 1.2 + (nearEdge ? 0.25 : 0)), dry);
    }
  }
  for (let x = -96; x <= 96; x += 0.95) {
    for (let z = -96; z <= 96; z += 0.95) {
      const jx = x + (hash2(x + 3, z) - 0.5) * 0.8, jz = z + (hash2(z, x + 3) - 0.5) * 0.8;
      const fr = Math.hypot(jx, jz);
      if (fr > 96 || (fr > 60 && hash2(jx * 2.9, jz * 3.7) > 0.35) || blocked(jx, jz, 0.4)) continue;
      const y = heightAt(jx, jz);
      const seed = Math.floor(jx * 71 + jz * 13);
      const lupN = fbm2(jx * 0.07 + 30, jz * 0.07, 3);
      const daisyN = fbm2(jx * 0.09 - 12, jz * 0.09 + 5, 3);
      const edge = pathDist(jx, jz) < 3.4 || Math.hypot(jx, jz) < plazaEdge(Math.atan2(jz, jx)) + 2.5;
      const roll = hash2(jx * 1.7, jz * 2.3);
      if (lupN > 0.62 && roll < (lupN - 0.6) * 2.4 + (edge ? 0.08 : 0)) lupine(flowers, jx, y, jz, 1.0 + hash2(seed, 2) * 0.45, seed);
      else if (daisyN > 0.52 && roll < (daisyN - 0.45) * 2.8) for (let k = 0; k < 3; k++) daisy(flowers, jx + (hash2(seed, k) - 0.5) * 0.6, y, jz + (hash2(k, seed) - 0.5) * 0.6, 1, seed + k);
      else if (roll < 0.06) buttercup(flowers, jx, y, jz, seed);
      else if (roll > 0.985 && Math.hypot(jx, jz) > 30) fern(flowers, jx, y, jz, 1, seed);
    }
  }
  // Flower beds hugging the plaza rim and the lodge terrace.
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2 + hash2(i, 1) * 0.03;
    const d = plazaEdge(a) + 0.7 + hash2(i, 2) * 1.6;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (blocked(x, z, -1)) continue;
    const y = heightAt(x, z);
    const roll = hash2(i, 3);
    if (roll < 0.22) lupine(flowers, x, y, z, 0.95 + hash2(i, 4) * 0.4, i * 7);
    else if (roll < 0.7) daisy(flowers, x, y, z, 1.1, i * 7);
    else if (roll < 0.85) buttercup(flowers, x, y, z, i * 7);
  }

  // ------------------------------------------------------------ Water
  const waterY = WATER_Y + 0.035;
  const disc = (x: number, z: number, radius: number, colFn: (x: number, z: number) => Vec3, y = waterY, segments = 48) => {
    const rings = 6;
    for (let ri = 0; ri < rings; ri++) {
      const r0 = (radius * ri) / rings, r1 = (radius * (ri + 1)) / rings;
      for (let i = 0; i < segments; i++) {
        const a0 = (i / segments) * Math.PI * 2, a1 = ((i + 1) / segments) * Math.PI * 2;
        const pts: Vec3[] = [
          [x + Math.cos(a0) * r0, y, z + Math.sin(a0) * r0], [x + Math.cos(a0) * r1, y, z + Math.sin(a0) * r1],
          [x + Math.cos(a1) * r1, y, z + Math.sin(a1) * r1], [x + Math.cos(a1) * r0, y, z + Math.sin(a1) * r0],
        ];
        for (const k of [0, 1, 2, 0, 2, 3]) w.vertex(pts[k], up, colFn(pts[k][0], pts[k][2]));
      }
    }
  };
  const DEEP = C("#1d5d7a"), SHALLOW = C("#3fa3b0");
  const depthCol = (x: number, z: number) => mixRgb(SHALLOW, DEEP, Math.min(1, Math.max(0, -heightAt(x, z) / 1.8)));
  disc(PL.lake.x, PL.lake.z, 17.4, depthCol);
  const [plx, plz] = lakePoint(LAKE_FALL.plunge);
  disc(plx, plz, 3.0, () => SHALLOW, waterY, 24);
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
    const nx = (-dz / len) * 2.7, nz = (dx / len) * 2.7;
    const steps = Math.ceil(len / 2);
    for (let k = 0; k < steps; k++) {
      const t0 = k / steps, t1 = (k + 1) / steps;
      const x0 = ax + dx * t0, z0 = az + dz * t0, x1 = ax + dx * t1, z1 = az + dz * t1;
      const pts: Vec3[] = [[x0 + nx, waterY, z0 + nz], [x0 - nx, waterY, z0 - nz], [x1 - nx, waterY, z1 - nz], [x1 + nx, waterY, z1 + nz]];
      for (const q of [0, 1, 2, 0, 2, 3]) w.vertex(pts[q], up, mixRgb(SHALLOW, DEEP, 0.45));
    }
  }
  disc(PL.hotSpring.x, PL.hotSpring.z, 3.2, () => C("#7fd6cf"), heightAt(PL.hotSpring.x, PL.hotSpring.z) + 0.25, 32);
  // Fountain pools.
  disc(0, 0, 5.25, () => C("#4fa7b3"), fountainInfo.poolY, 48);
  for (const [rad, y] of fountainInfo.pools) disc(0, 0, rad, () => C("#5ab3bd"), y, 24);

  // Waterfalls: curved falling sheets with mist at the bottom.
  const waterfall = (top: Vec3, dirX: number, dirZ: number, drop: number, out: number, width: number, strands: number) => {
    const px = -dirZ, pz = dirX;
    for (let s = 0; s < strands; s++) {
      const off = (s - (strands - 1) / 2) * (width / strands) + (hash2(s, top[0]) - 0.5) * 0.6;
      const wS = (width / strands) * (0.8 + hash2(top[2], s) * 0.5);
      const rows = 14;
      for (let j = 0; j < rows; j++) {
        const t0 = j / rows, t1 = (j + 1) / rows;
        const at = (t: number, side: number): Vec3 => {
          const o = out * Math.sqrt(t) * (1 + side * 0.03);
          const spread = 1 + t * 0.6;
          return [top[0] + dirX * o + px * (off + side * wS * 0.5 * spread), top[1] - drop * t * t * 0.4 - drop * t * 0.6, top[2] + dirZ * o + pz * (off + side * wS * 0.5 * spread)];
        };
        const a = at(t0, -1), b = at(t0, 1), c = at(t1, 1), d = at(t1, -1);
        const n: Vec3 = [dirX, 0.3, dirZ];
        const col = C("#bfe3ec");
        falls.vertex(a, n, col).vertex(b, n, col).vertex(c, n, col);
        falls.vertex(a, n, col).vertex(c, n, col).vertex(d, n, col);
      }
    }
    const bottom: Vec3 = [top[0] + dirX * out, top[1] - drop, top[2] + dirZ * out];
    for (let k = 0; k < 9; k++) {
      const s = 1.6 + hash2(k, top[0]) * 2.2;
      foam.sphere(compose(bottom[0] + (hash2(k, 1) - 0.5) * width, bottom[1] + 0.6 + hash2(k, 2) * 1.5, bottom[2] + (hash2(k, 3) - 0.5) * width * 0.7, 0, 0, 0, s, s * 0.6, s), C("#ffffff"), 5, 8);
    }
  };
  {
    const dx = Math.sin(neDir), dz = Math.cos(neDir);
    waterfall([lip[0] - dx * 0.5, lip[1] - 1, lip[2] - dz * 0.5], dx, dz, lip[1] - waterY, 4.5, 4.2, 4);
    const [tx, tz] = lakePoint(LAKE_FALL.lip);
    const ty = heightAt(tx, tz);
    waterfall([tx, ty - 0.5, tz], -Math.cos(SW), -Math.sin(SW), ty - waterY, 4.8, 3.6, 3);
  }

  // ------------------------------------------------------------ Mountains, portal, steam
  const mountains = buildMountainMesh({ inner: 152, outer: 720, baseHeight: heightAt, heroAngle: -Math.PI / 2 - 0.12 });
  const town = buildTown(heightAt);
  const rail = buildRailway(heightAt);
  const lift = buildGondolaLine(heightAt);
  const trainM = buildTrain();
  town.body.merge(rail.body).merge(lift.body);
  town.glow.merge(rail.glow);
  const neonWire = new MeshBuilder();
  const neon = buildNeon(heightAt, neonWire, { bridgeRails, fountainY: fountainInfo.poolY - 1.3 });
  const portal = new MeshBuilder().torus(compose(0, 0, 0, 0, Math.PI / 2, 0), P.portal, 3, 0.35, 24, 6);
  const steam = new MeshBuilder().sphere(compose(0, 0, 0), "#ffffff", 4, 6);
  const shadow = new MeshBuilder();
  shadow.cylinder(compose(0, 0, 0, 0, 0, 0, 0.68, 0.018, 0.44), "#2d3a30", 32);

  return {
    terrain: r.upload(t.build()),
    townGlass: r.upload(town.glass.build()),
    townIce: r.upload(town.ice.build()),
    spins: town.spins.map((sp) => ({ ...sp, mesh: r.upload(sp.mesh.build()) })),
    gondola: r.upload(town.gondola.build()),
    ferris: town.ferris,
    train: { engine: r.upload(trainM.engine.build()), car: r.upload(trainM.car.build()), lamp: r.upload(trainM.lamp.build()) },
    liftCabin: r.upload(lift.cabin.build()),
    balloons: BALLOON_COLORS.map(([a, b]) => r.upload(buildBalloon(a, b).build())),
    chimneys: town.chimneys,
    fires: town.fires,
    ground: r.upload(ground.build()),
    grass: r.upload(grass.build()),
    flowers: r.upload(flowers.build()),
    trees: r.upload(trees.build()),
    props: [...props, r.upload(town.body.build()), r.upload(neonWire.build())],
    neon: r.upload(neon.core.build()),
    neonHalo: r.upload(neon.halo.build()),
    glow: r.upload(glow.merge(town.glow).build()),
    water: r.upload(w.build()),
    falls: r.upload(falls.build()),
    foam: r.upload(foam.build()),
    mountains: r.upload(mountains.build()),
    portal: r.upload(portal.build()),
    steam: r.upload(steam.build()),
    shadow: r.upload(shadow.build()),
    labels: [
      { text: "☕ Lodge Café", x: PL.lodge.x, y: 15, z: PL.lodge.z },
      { text: "🎒 Outfitter", x: PL.outfitter.x, y: 9, z: PL.outfitter.z },
      { text: "🕹️ Riverside Arcade", x: PL.arcade.x, y: 9, z: PL.arcade.z },
      { text: "🛶 Lake Dock", x: PL.dock.x, y: 3, z: PL.dock.z },
      { text: "🛷 Toboggan Rush", x: PL.trailhead.x, y: 9.4, z: PL.trailhead.z },
      { text: "♨️ Hot Springs", x: PL.hotSpring.x, y: 3.5, z: PL.hotSpring.z },
      { text: "⛲ Village Plaza", x: 0, y: 7.8, z: 0 },
      { text: "🥐 Bakery", x: TOWN_PLACES.bakery.x, y: 10.5, z: -7.5 },
      { text: "📮 Post Office", x: TOWN_PLACES.post.x, y: 10.5, z: -7.5 },
      { text: "📚 Library", x: TOWN_PLACES.library.x, y: 11, z: -8.5 },
      { text: "🍦 Ice Cream", x: TOWN_PLACES.icecream.x, y: 10.5, z: 7 },
      { text: "🏛️ Town Hall", x: -96, y: 19, z: 0.4 },
      { text: "🎺 Town Square", x: -74, y: 7.5, z: 0 },
      { text: "🌾 Windmill", x: -46, y: 14, z: -69 },
      { text: "⛸️ Skating Pond", x: TOWN_PLACES.rink.x, y: 3.5, z: TOWN_PLACES.rink.z },
      { text: "🗼 Lighthouse", x: -61, y: 15.5, z: 29 },
      { text: "⚙️ Watermill", x: 41, y: 8.5, z: 7 },
      { text: "🔥 Fire Lookout", x: 68, y: 18, z: -22 },
      { text: "🔭 Observatory", x: 76, y: 10, z: 0 },
      { text: "🌻 Greenhouse", x: 56, y: 6.5, z: -1 },
      { text: "🎡 Fairground", x: 27, y: 16.5, z: 66 },
      { text: "🌲 Ranger Station", x: -8, y: 8, z: 80 },
      { text: "🏕️ Campground", x: -19, y: 4, z: 62 },
      { text: "⛳ Golf Clubhouse", x: -21, y: 9.5, z: 80 },
      { text: "🚂 Valley Station", x: 90, y: 8, z: 31 },
      { text: "🚡 Summit Gondola", x: 18, y: 10, z: -53 },
      { text: "🎈 Balloon Meadow", x: 52, y: 4, z: -52 },
      { text: "🥕 Community Garden", x: 56, y: 3, z: 11 },
      { text: "🎨 Dye Shop", x: -66, y: 9, z: 7.5 },
      { text: "🏡 Cottage Lane", x: -43.5, y: 3.5, z: -12 },
    ],
  };
}

/** World position of a Ferris wheel gondola's hanging point (gondolas stay upright). */
export function ferrisSeat(fw: FerrisInfo, i: number, time: number): Vec3 {
  const a = time * fw.speed + (i / fw.seats) * Math.PI * 2;
  const lx = Math.cos(a) * fw.radius, ly = Math.sin(a) * fw.radius;
  return [fw.x + lx * Math.cos(fw.ry), fw.y + ly, fw.z - lx * Math.sin(fw.ry)];
}

/** Golden-hour lighting for the village. */
export function applyVillageLight(r: Renderer) {
  const e = r.env;
  e.lightDir = [0.86, 0.42, 0.22];
  e.sunColor = [1.0, 0.8, 0.56];
  e.sunIntensity = 1.45;
  e.skyTop = [0.2, 0.46, 0.82];
  e.skyHorizon = [0.78, 0.87, 0.94];
  e.ground = [0.5, 0.44, 0.3];
  e.ambient = 0.78;
  e.exposure = 1.08;
  e.fogNear = 45;
  e.fogFar = 760;
  e.fogHeight = 0.011;
  e.clouds = 1;
  e.sky = true;
}

/** Draws the whole village (everything except characters and particles). */
export function drawHub(r: Renderer, w: HubWorld, time: number, night = 0) {
  const I = compose(0, 0, 0);
  r.draw(w.mountains, I, { noCast: true });
  r.draw(w.terrain, I, { noCast: true, season: true });
  r.draw(w.ground, I, { noCast: true, season: true });
  // The fast graphics setting skips the (very many) grass blades and flowers.
  if (r.quality !== "low") {
    r.draw(w.grass, I, { sway: 0.06, noCast: true, season: true, cut: true });
    if (r.env.snow < 0.5) r.draw(w.flowers, I, { sway: 0.05, noCast: true, season: true, cut: true });
  }
  r.draw(w.trees, I, { sway: 0.22, season: true, cut: true });
  for (const prop of w.props) r.draw(prop, I, { season: true, cut: true });
  // Windows and lanterns glow brighter as night falls.
  r.draw(w.glow, I, { unlit: true, emissive: 0.25 + night * 0.9, cut: true });
  // Neon signs and festoon lights: pastel bulbs by day, glowing colours with soft halos at night.
  const flicker = 1 + Math.sin(time * 2.1) * 0.06 + Math.sin(time * 7.3) * 0.03;
  r.draw(w.neon, I, { unlit: true, emissive: (0.1 + night * 1.5) * flicker, noCast: true, cut: true });
  if (night > 0.05) r.draw(w.neonHalo, I, { unlit: true, emissive: 0.6, alpha: 0.22 * night, noCast: true, noFog: true });
  r.draw(w.townIce, I, { unlit: true, emissive: 0.05, noCast: true });
  r.draw(w.townGlass, I, { alpha: 0.38, cut: true });
  for (const sp of w.spins) {
    const a = time * sp.speed;
    const m = sp.axis === "y" ? compose(sp.x, sp.y, sp.z, sp.ry + a) : compose(sp.x, sp.y, sp.z, sp.ry, 0, a);
    if (sp.mode === "lit") r.draw(sp.mesh, m, { cut: true });
    else if (sp.mode === "glow") r.draw(sp.mesh, m, { unlit: true, emissive: 0.4, cut: true });
    else r.draw(sp.mesh, m, { unlit: true, alpha: 0.13, noFog: true });
  }
  const fw = w.ferris;
  if (fw) {
    for (let i = 0; i < fw.seats; i++) {
      const p = ferrisSeat(fw, i, time);
      r.draw(w.gondola, compose(p[0], p[1], p[2], fw.ry), { cut: true });
    }
  }
  // The valley train (on the shared timetable, so everyone sees it in the same place).
  const now = Date.now();
  for (let which = 0; which < TRAIN.trains; which++) {
    for (let k = 0; k <= TRAIN.cars; k++) {
      const u = trainUnit(k, now, which);
      if (heightAt(u.x, u.z) > u.y + 3) continue; // in the tunnel
      r.draw(k === 0 ? w.train.engine : w.train.car, compose(u.x, u.y, u.z, u.yaw), { cut: true });
      if (k === 0) r.draw(w.train.lamp, compose(u.x, u.y, u.z, u.yaw), { unlit: true, emissive: 0.4 + night });
    }
  }
  for (const c of gondolaCabins(time)) r.draw(w.liftCabin, compose(c.p[0], c.p[1], c.p[2], c.yaw), { cut: true });
  // Tethered hot-air balloons bobbing on the meadow.
  for (let i = 0; i < 3; i++) {
    const ang = (i / 3) * Math.PI * 2 + 0.3;
    const bx = TOWN_PLACES.balloons.x + Math.cos(ang) * 5, bz = TOWN_PLACES.balloons.z + Math.sin(ang) * 5;
    r.draw(w.balloons[i], compose(bx, heightAt(bx, bz) + 0.05 + Math.max(0, Math.sin(time * 0.5 + i * 2)) * 0.25, bz, time * 0.03 + i, 0, Math.sin(time * 0.7 + i) * 0.02), { cut: true });
  }
  const pulse = 1 + Math.sin(time * 3) * 0.05;
  r.draw(w.portal, compose(PL.trailhead.x, heightAt(PL.trailhead.x, PL.trailhead.z) + 3.3, PL.trailhead.z, 0, 0, time * 0.8, pulse), { unlit: true, emissive: 0.3 });
  r.draw(w.water, I, { wave: 1, alpha: 0.84 });
  r.draw(w.falls, I, { wave: 2, alpha: 0.82, cut: true });
  r.draw(w.foam, I, { unlit: true, alpha: 0.42 });
}
