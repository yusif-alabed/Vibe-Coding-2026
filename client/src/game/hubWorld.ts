import { DEFAULT_LOOK, HUB_PLACES } from "@beaver/shared";
import { compose, hash2, hexToRgb, mixRgb, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { bakeBeaver } from "./beaver";
import { P, rgb } from "./palette";
import { bench, cabin, campfire, canoe, flowers, lamp, pine, rock, sign, snowyPine } from "./props";

/**
 * The Beaver Banff village: a meadow ringed by pine forest, a glacier-fed turquoise lake and river,
 * timber cabins around a fountain plaza, and the snowy Rockies all around.
 */

export const WATER_Y = -0.35;
const PL = HUB_PLACES;

/** River centreline: down from the north-east peaks, past the arcade, around the south of the village, into the lake. */
const RIVER: [number, number][] = [
  [70, -80], [52, -48], [38, -20], [34, 2], [32, 22], [18, 40], [-6, 44], [-26, 40], [-38, 36],
];

const PATHS: [number, number, number, number][] = [
  [0, 0, PL.lodge.x, PL.lodge.z],
  [0, 0, PL.outfitter.x, PL.outfitter.z],
  [0, 0, PL.arcade.x, PL.arcade.z],
  [0, 0, PL.dock.x, PL.dock.z],
  [0, 0, PL.trailhead.x, PL.trailhead.z + 2],
  [PL.outfitter.x, PL.outfitter.z, PL.hotSpring.x, PL.hotSpring.z],
  [0, 0, 6, 40], // to the bridge
];

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

/** Ground height anywhere in the hub (shared by rendering, walking and the camera). */
export function heightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  let h = 0;
  if (r > 12) h += 0.35 * Math.sin(x * 0.13) * Math.cos(z * 0.11) * Math.min(1, (r - 12) / 10);
  if (r > 66) h += Math.pow(r - 66, 1.35) * 0.32 + hash2(Math.floor(x / 6), Math.floor(z / 6)) * 1.2;
  // Snowy hill behind the trailhead.
  const th = Math.hypot(x - PL.trailhead.x, (z - PL.trailhead.z + 14) * 0.8);
  if (z < PL.trailhead.z - 3) h += Math.max(0, 16 - th) * 0.45;
  // Lake bowl.
  const ld = Math.hypot(x - PL.lake.x, z - PL.lake.z);
  if (ld < 19) h = Math.min(h, -2.2 * Math.pow(1 - ld / 19, 0.6) + 0.35);
  // River channel.
  const rd = riverDist(x, z);
  if (rd < 4.2) h = Math.min(h, -1.3 * (1 - rd / 4.2) + 0.25 * (rd / 4.2));
  // Hot spring dip.
  const hs = Math.hypot(x - PL.hotSpring.x, z - PL.hotSpring.z);
  if (hs < 3.4) h = Math.min(h, -0.6);
  return h;
}

function groundColor(x: number, y: number, z: number): Vec3 {
  const r = Math.hypot(x, z);
  const n = hash2(Math.floor(x / 3), Math.floor(z / 3));
  if (y > 13 || (z < PL.trailhead.z - 4 && y > 1.2)) return mixRgb(rgb(P.snow), rgb(P.snowShade), n * 0.6);
  if (y > 8) return mixRgb(rgb(P.rock), rgb(P.rockDark), n);
  if (y < WATER_Y - 0.05) return mixRgb(rgb(P.lakebed), rgb(P.glacierDeep), n);
  if (y < 0.05 && (riverDist(x, z) < 5.4 || Math.hypot(x - PL.lake.x, z - PL.lake.z) < 20)) return rgb(P.sand);
  // Paths and the plaza are separate, smooth surface meshes below. Keeping the
  // base terrain grass here avoids jagged colour interpolation at their edges.
  const g = n < 0.33 ? P.grassA : n < 0.66 ? P.grassB : P.grassC;
  return y > 3 ? mixRgb(rgb(g), rgb(P.meadowDark), Math.min(1, (y - 3) / 5)) : rgb(g);
}

export interface HubWorld {
  terrain: GpuMesh;
  terrainTexture: WebGLTexture;
  surfaces: GpuMesh;
  grass: GpuMesh;
  shadow: GpuMesh;
  props: GpuMesh[];
  glow: GpuMesh;
  water: GpuMesh;
  mountains: GpuMesh;
  sky: GpuMesh;
  portal: GpuMesh;
  steam: GpuMesh;
  labels: { text: string; x: number; y: number; z: number }[];
}

export function buildSky(r: Renderer, top: string, horizon: string, glowCol: string): GpuMesh {
  const m = new MeshBuilder();
  const t = hexToRgb(top), h = hexToRgb(horizon), g = hexToRgb(glowCol);
  m.sphere(compose(0, 0, 0, 0, 0, 0, 900), (x, y, z) => {
    const k = Math.max(0, y / 900);
    const sun = Math.max(0, (x * 0.5 - z * 0.6) / 900);
    return mixRgb(mixRgb(h, t, Math.pow(k, 0.55)), g, Math.pow(sun, 3) * (1 - k) * 0.8);
  }, 20, 32);
  return r.upload(m.build());
}

export function buildMountains(r: Renderer, seed: number, ring: [number, number], count: number, center: [number, number] = [0, 0]): GpuMesh {
  const m = new MeshBuilder();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + hash2(i, seed) * 0.4;
    const d = ring[0] + hash2(seed, i) * (ring[1] - ring[0]);
    const x = center[0] + Math.cos(a) * d, z = center[1] + Math.sin(a) * d;
    const h = 70 + hash2(i * 3, seed) * 75;
    const w = 55 + hash2(i, seed * 7) * 40;
    const snowLine = h * (0.55 + hash2(i, 2) * 0.12);
    const col = (_x: number, y: number) => {
      if (y > snowLine) return rgb(P.snow);
      if (y > snowLine - 6 && hash2(Math.floor(_x), Math.floor(y)) > 0.5) return rgb(P.snowShade);
      return mixRgb(rgb(P.rockDark), rgb(P.rock), Math.min(1, y / snowLine));
    };
    m.cone(compose(x, h / 2 - 8, z, a * 3, 0, 0, w, h, w * 0.8), col, 10, 0.12);
    // A shoulder peak for a craggier silhouette.
    m.cone(compose(x + Math.cos(a + 1.6) * w * 0.4, h * 0.32 - 8, z + Math.sin(a + 1.6) * w * 0.4, a, 0, 0, w * 0.7, h * 0.65, w * 0.6), col, 8, 0.12);
    // Forested foothill.
    m.cone(compose(x - Math.cos(a) * w * 0.45, 6, z - Math.sin(a) * w * 0.45, a, 0, 0, w * 0.9, 30, w * 0.7), mixRgb(rgb(P.pineDark), rgb(P.pine), hash2(i, 9)), 6, 0.1);
  }
  return r.upload(m.build());
}

export function buildHub(r: Renderer): HubWorld {
  // --- Terrain ---
  const t = new MeshBuilder();
  // A one-unit terrain grid keeps paths, snow banks and shorelines smooth from
  // the close third-person camera instead of exposing broad low-poly facets.
  const S = 1.0, R = 120;
  const groundNormal = (x: number, z: number): Vec3 => {
    const e = 0.45;
    const nx = heightAt(x - e, z) - heightAt(x + e, z);
    const nz = heightAt(x, z - e) - heightAt(x, z + e);
    const l = Math.hypot(nx, e * 2, nz) || 1;
    return [nx / l, (e * 2) / l, nz / l];
  };
  const terrainCol = (x: number, y: number, z: number) => groundColor(x, y, z);
  for (let x = -R; x < R; x += S) {
    for (let z = -R; z < R; z += S) {
      const a: Vec3 = [x, heightAt(x, z), z];
      const b: Vec3 = [x + S, heightAt(x + S, z), z];
      const c: Vec3 = [x + S, heightAt(x + S, z + S), z + S];
      const d: Vec3 = [x, heightAt(x, z + S), z + S];
      const na = groundNormal(a[0], a[2]), nb = groundNormal(b[0], b[2]);
      const nc = groundNormal(c[0], c[2]), nd = groundNormal(d[0], d[2]);
      t.triSmooth(a, b, c, terrainCol, na, nb, nc);
      t.triSmooth(a, c, d, terrainCol, na, nc, nd);
    }
  }

  // Hand-built plaza and trail surfaces sit just over the terrain. They have
  // clean continuous edges rather than being inferred from terrain vertex colour.
  const surfaces = new MeshBuilder();
  const flatUp: Vec3 = [0, 1, 0];
  // A gentle hand-shaped clearing: deliberately asymmetric where the village
  // trails enter it, rather than a perfect stamped circle of snow/paving.
  const plazaRadius = (a: number) => 8.05 + Math.sin(a * 3 + 0.55) * 0.48 + Math.cos(a * 5 - 1.1) * 0.22 + Math.sin(a * 2 - 0.8) * 0.16;
  for (let i = 0; i < 64; i++) {
    const a = i / 64 * Math.PI * 2, b = (i + 1) / 64 * Math.PI * 2;
    const center: Vec3 = [0, heightAt(0, 0) + 0.035, 0];
    const ra = plazaRadius(a), rb = plazaRadius(b);
    const pa: Vec3 = [Math.cos(a) * ra, heightAt(Math.cos(a) * ra, Math.sin(a) * ra) + 0.035, Math.sin(a) * ra];
    const pb: Vec3 = [Math.cos(b) * rb, heightAt(Math.cos(b) * rb, Math.sin(b) * rb) + 0.035, Math.sin(b) * rb];
    surfaces.triSmooth(center, pa, pb, "#bfd6dc", flatUp, flatUp, flatUp);
  }
  const ribbon = (ax: number, az: number, bx: number, bz: number, half: number, lift: number, color: string) => {
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len * half, nz = dx / len * half;
    const steps = Math.max(2, Math.ceil(len / 0.55));
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps, t1 = (i + 1) / steps;
      const x0 = ax + dx * t0, z0 = az + dz * t0, x1 = ax + dx * t1, z1 = az + dz * t1;
      const a: Vec3 = [x0 + nx, heightAt(x0 + nx, z0 + nz) + lift, z0 + nz];
      const b: Vec3 = [x0 - nx, heightAt(x0 - nx, z0 - nz) + lift, z0 - nz];
      const c: Vec3 = [x1 - nx, heightAt(x1 - nx, z1 - nz) + lift, z1 - nz];
      const d: Vec3 = [x1 + nx, heightAt(x1 + nx, z1 + nz) + lift, z1 + nz];
      surfaces.triSmooth(a, b, c, color, flatUp, flatUp, flatUp);
      surfaces.triSmooth(a, c, d, color, flatUp, flatUp, flatUp);
    }
  };
  for (const [ax, az, bx, bz] of PATHS) {
    // Main village trails meet the clearing at its edge, never through the
    // fountain centre. The outfitter-to-spring trail keeps both endpoints.
    const fromCenter = Math.hypot(ax, az) < 0.1;
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const sx = fromCenter ? (bx - ax) / len * 7.5 : ax;
    const sz = fromCenter ? (bz - az) / len * 7.5 : az;
    ribbon(sx, sz, bx, bz, 2.08, 0.026, "#9b6d3d"); // packed-earth border
    ribbon(sx, sz, bx, bz, 1.68, 0.047, "#d2a45f"); // warm walkable centre
  }

  // Physical grass, built from individual bent blade strips rather than cones
  // or a flat texture. Each tuft has crossed blades so it reads from any camera
  // direction, while paths, snow and shorelines remain clear.
  const grass = new MeshBuilder();
  const blade = (x: number, y: number, z: number, angle: number, bend: number, width: number, height: number, color: string) => {
    const sideX = Math.cos(angle + Math.PI / 2) * width, sideZ = Math.sin(angle + Math.PI / 2) * width;
    const bx = Math.cos(bend), bz = Math.sin(bend);
    const l0: Vec3 = [x - sideX, y, z - sideZ], r0: Vec3 = [x + sideX, y, z + sideZ];
    const mx = x + bx * height * 0.10, mz = z + bz * height * 0.10;
    const l1: Vec3 = [mx - sideX * 0.58, y + height * 0.56, mz - sideZ * 0.58];
    const r1: Vec3 = [mx + sideX * 0.58, y + height * 0.56, mz + sideZ * 0.58];
    const tip: Vec3 = [x + bx * height * 0.30, y + height, z + bz * height * 0.30];
    grass.tri(l0, r0, r1, color); grass.tri(l0, r1, l1, color);
    grass.tri(l1, r1, tip, color);
  };
  for (let x = -58; x <= 58; x += 1.55) {
    for (let z = -58; z <= 58; z += 1.55) {
      const jx = x + (hash2(x, z) - 0.5) * 0.9, jz = z + (hash2(z, x) - 0.5) * 0.9;
      const d = Math.hypot(jx, jz), y = heightAt(jx, jz);
      if (d < 12 || y < 0.04 || pathDist(jx, jz) < 2.6 || riverDist(jx, jz) < 5.3 || hash2(jx * 4, jz * 3) > 0.27) continue;
      if (Object.values(PL).some((place) => Math.hypot(jx - place.x, jz - place.z) < place.r + 5.5)) continue;
      const baseAngle = hash2(jx, jz) * Math.PI * 2;
      for (let i = 0; i < 3; i++) {
        const a = baseAngle + i * (Math.PI / 3) + hash2(i, jx) * 0.5;
        const spread = 0.10 + hash2(jx + i, jz) * 0.12;
        const h = 0.33 + hash2(jx * (i + 2), jz + i) * 0.32;
        const col = i === 0 ? P.pineLight : i === 1 ? P.grassA : P.meadowDark;
        blade(jx + Math.cos(a) * spread, y + 0.015, jz + Math.sin(a) * spread, a, a + 0.45 + hash2(jz, i) * 0.45, 0.045 + hash2(i, jx) * 0.018, h, col);
      }
    }
  }

  // A soft flattened disc grounds characters without adding a full shadow system.
  // It is reused below every avatar and remains independent from world geometry.
  const shadow = new MeshBuilder();
  shadow.cylinder(compose(0, 0, 0, 0, 0, 0, 0.72, 0.025, 0.48), "#2c1d17", 24);

  // --- Props (outlined) and glowing bits (unlit) ---
  // Major world pieces are uploaded independently: their ink hulls can no longer
  // cut through cabins, benches and the plaza statue as one giant combined mesh.
  const props: GpuMesh[] = [];
  let p = new MeshBuilder();
  const finishProp = () => {
    if (p.vertexCount) props.push(r.upload(p.build()));
    p = new MeshBuilder();
  };
  const glow = new MeshBuilder();
  const face = (x: number, z: number) => Math.atan2(-x, -z); // rotate +z to face the plaza

  // Plaza fountain with a beaver statue.
  // Recessed fountain bowl: a substantial stone body plus a separate raised lip
  // keeps the water visibly inside the fountain instead of reading as a flat disc.
  p.cylinder(compose(0, 0.35, 0, 0, 0, 0, 4.4, 0.7, 4.4), P.stoneDark, 16, 0.5, 0.5, 0.035);
  p.torus(compose(0, 0.73, 0, 0, 0, 0, 4.02, 0.32, 4.02), P.stone, 1, 0.2, 24, 7);
  p.cylinder(compose(0, 0.58, 0, 0, 0, 0, 3.75, 0.18, 3.75), P.pavingDark, 20, 0.5, 0.5);
  p.cylinder(compose(0, 1.0, 0, 0, 0, 0, 1.6, 1.4, 1.6), P.stoneDark, 8);
  p.cylinder(compose(0, 1.75, 0, 0, 0, 0, 2.6, 0.25, 2.6), P.stone, 10);
  bakeBeaver(p, { ...DEFAULT_LOOK, hat: "hat_ranger" }, compose(0, 1.9, 0, 0.4, 0, 0, 1.3));
  finishProp();

  // Lodge café — big, warm, with a deck.
  cabin(p, glow, PL.lodge.x, PL.lodge.z, face(PL.lodge.x, PL.lodge.z), 11, 8, 4.4, P.roofGreen);
  finishProp();
  campfire(p, PL.lodge.x + 8, PL.lodge.z + 7);
  finishProp();
  bench(p, PL.lodge.x + 5, PL.lodge.z + 9.5, -0.6);
  finishProp();
  bench(p, PL.lodge.x + 11, PL.lodge.z + 5, -2.2);
  finishProp();
  // Outfitter with a canoe rack.
  cabin(p, glow, PL.outfitter.x, PL.outfitter.z, face(PL.outfitter.x, PL.outfitter.z), 8, 6.5, 3.6, P.roofRed);
  finishProp();
  canoe(p, PL.outfitter.x - 6.5, 0.9, PL.outfitter.z + 2, 0.5, "#ffb03b");
  finishProp();
  // Riverside arcade — teal roof and a neon ring.
  cabin(p, glow, PL.arcade.x, PL.arcade.z, face(PL.arcade.x, PL.arcade.z), 7.5, 6.5, 3.4, P.roofTeal);
  finishProp();
  glow.torus(compose(PL.arcade.x - 3.2, 7.4, PL.arcade.z - 1.2, face(PL.arcade.x, PL.arcade.z), Math.PI / 2, 0, 1.3), "#ff6fb5", 1, 0.14, 18, 5);

  // Dock into the lake + canoes.
  const dockA = Math.atan2(PL.lake.x - PL.dock.x, PL.lake.z - PL.dock.z);
  for (let i = 0; i < 9; i++) {
    const dx = PL.dock.x + Math.sin(dockA) * i * 1.2, dz = PL.dock.z + Math.cos(dockA) * i * 1.2;
    p.box(compose(dx, 0.15, dz, dockA, 0, 0, 3.2, 0.2, 1.05), i % 2 ? P.timber : P.timberLight);
    if (i % 3 === 0) for (const s of [-1, 1]) p.cylinder(compose(dx + Math.cos(dockA) * s * 1.6, -0.3, dz - Math.sin(dockA) * s * 1.6, 0, 0, 0, 0.3, 1.4, 0.3), P.timberDark, 6);
  }
  canoe(p, PL.dock.x + 5, WATER_Y + 0.1, PL.dock.z + 9, 0.9, P.roofRed);
  finishProp();
  canoe(p, PL.dock.x - 2, WATER_Y + 0.1, PL.dock.z + 13, 2.2, "#2b8fd6");
  finishProp();

  // Bridge over the river south of the plaza.
  for (let i = -5; i <= 5; i++) {
    const y = 0.55 + Math.cos((i / 5) * 1.2) * 0.6;
    p.box(compose(6 + i * 0.05, y, 41.5 + i * 1.0, 0.05, 0, 0, 4, 0.22, 0.95), i % 2 ? P.timber : P.timberLight);
  }
  for (const s of [-1, 1]) p.box(compose(6 + s * 2, 1.4, 41.5, 0.05, 0, 0, 0.18, 0.18, 11), P.timberDark);
  finishProp();

  // Trailhead portal: timber arch + snowy hill + sign.
  const th = PL.trailhead;
  for (const s of [-1, 1]) p.cylinder(compose(th.x + s * 4, 3, th.z, 0, 0, 0, 0.7, 6, 0.7), P.timberDark, 7);
  p.box(compose(th.x, 6.2, th.z, 0, 0, 0, 10, 0.9, 1.1), P.timber);
  p.box(compose(th.x, 7.0, th.z, 0, 0, 0.0, 6, 1.1, 0.5), P.roofRed);
  for (let i = 0; i < 4; i++) snowyPine(p, th.x - 9 - i * 4, heightAt(th.x - 9 - i * 4, th.z - 6 - i * 3), th.z - 6 - i * 3, 1.1, i);
  for (let i = 0; i < 4; i++) snowyPine(p, th.x + 9 + i * 4, heightAt(th.x + 9 + i * 4, th.z - 6 - i * 3), th.z - 6 - i * 3, 1.1, i + 2);
  finishProp();

  // Hot spring: ring of rocks.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    rock(p, PL.hotSpring.x + Math.cos(a) * 3.8, -0.1, PL.hotSpring.z + Math.sin(a) * 3.8, 0.9 + hash2(i, 3) * 0.4);
  }
  finishProp();

  // Lamps and benches around the plaza, flower patches, signposts.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    lamp(p, glow, Math.cos(a) * 11.5, Math.sin(a) * 11.5);
    bench(p, Math.cos(a + 0.5) * 8.6, Math.sin(a + 0.5) * 8.6, Math.atan2(-Math.cos(a + 0.5), -Math.sin(a + 0.5)) + Math.PI);
  }
  finishProp();
  for (let i = 0; i < 26; i++) {
    const a = hash2(i, 1) * Math.PI * 2, d = 14 + hash2(i, 2) * 40;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (pathDist(x, z) > 3 && heightAt(x, z) > 0 && riverDist(x, z) > 6) flowers(p, x, z);
  }
  sign(p, 4, -12, 0);
  finishProp();

  // Forest: denser toward the edge so the world feels enclosed.
  for (let x = -110; x <= 110; x += 4.5) {
    for (let z = -110; z <= 110; z += 4.5) {
      const jx = x + (hash2(x, z) - 0.5) * 3.5, jz = z + (hash2(z, x) - 0.5) * 3.5;
      const r = Math.hypot(jx, jz);
      const chance = r < 16 ? 0 : r < 40 ? 0.1 : r < 58 ? 0.22 : r < 88 ? 0.55 : 0.18;
      if (hash2(jx * 1.3, jz * 0.7) > chance) continue;
      if (pathDist(jx, jz) < 4 || riverDist(jx, jz) < 6) continue;
      if (Object.values(PL).some((pl) => Math.hypot(jx - pl.x, jz - pl.z) < pl.r + 7)) continue;
      if (Math.hypot(jx - PL.trailhead.x, jz - PL.trailhead.z) < 12) continue;
      const h = heightAt(jx, jz);
      if (h < 0.05) continue;
      const s = 0.8 + hash2(jx, jz * 3) * 0.7 + (r > 60 ? 0.4 : 0);
      if (h > 6 || jz < PL.trailhead.z - 6) snowyPine(p, jx, h - 0.1, jz, s, Math.floor(jx));
      else pine(p, jx, h - 0.1, jz, s, Math.floor(jx));
    }
  }
  for (let i = 0; i < 30; i++) {
    const a = hash2(i, 7) * Math.PI * 2, d = 20 + hash2(i, 8) * 45;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (pathDist(x, z) > 2.5) rock(p, x, heightAt(x, z) - 0.2, z, 0.6 + hash2(i, 9) * 1.2);
  }
  finishProp();

  // --- Water: continuous lake and river surfaces, not a terrain-cell overlay. ---
  const w = new MeshBuilder();
  const waterCol = (x: number, _y: number, z: number): Vec3 => {
    const deep = Math.min(1, Math.max(0, -heightAt(x, z) / 2));
    return mixRgb(rgb(P.glacier), rgb(P.glacierDeep), deep * 0.7);
  };
  const waterY = WATER_Y + 0.035;
  const up: Vec3 = [0, 1, 0];
  const disc = (x: number, z: number, radius: number, color: string, segments = 40) => {
    const center: Vec3 = [x, waterY, z];
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * Math.PI * 2, b = ((i + 1) / segments) * Math.PI * 2;
      const p: Vec3 = [x + Math.cos(a) * radius, waterY, z + Math.sin(a) * radius];
      const q: Vec3 = [x + Math.cos(b) * radius, waterY, z + Math.sin(b) * radius];
      w.triSmooth(center, p, q, color, up, up, up);
    }
  };
  // The lake sits inside its bowl, leaving a clean dry shoreline with no overlapping cells.
  disc(PL.lake.x, PL.lake.z, 17.2, P.glacier, 56);
  // Smooth ribbon follows the river centreline. Each section shares edges with the next.
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i], [bx, bz] = RIVER[i + 1];
    const dx = bx - ax, dz = bz - az, len = Math.hypot(dx, dz) || 1;
    const nx = -dz / len * 2.65, nz = dx / len * 2.65;
    const a: Vec3 = [ax + nx, waterY, az + nz], b: Vec3 = [ax - nx, waterY, az - nz];
    const c: Vec3 = [bx - nx, waterY, bz - nz], d: Vec3 = [bx + nx, waterY, bz + nz];
    w.triSmooth(a, b, c, waterCol, up, up, up);
    w.triSmooth(a, c, d, waterCol, up, up, up);
  }
  disc(PL.hotSpring.x, PL.hotSpring.z, 3.1, "#73cfc7", 40);
  // Fountain water gets its own high-resolution surface instead of a faceted cap.
  const fountainY = 0.66;
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2, b = ((i + 1) / 48) * Math.PI * 2;
    w.triSmooth([0, fountainY, 0], [Math.cos(a) * 3.48, fountainY, Math.sin(a) * 3.48], [Math.cos(b) * 3.48, fountainY, Math.sin(b) * 3.48], "#5bcfc9", up, up, up);
  }

  // Portal ring (drawn animated) + steam puff (drawn many times).
  const portal = new MeshBuilder().torus(compose(0, 0, 0, 0, Math.PI / 2, 0), P.portal, 3, 0.35, 24, 6);
  const steam = new MeshBuilder().sphere(compose(0, 0, 0), "#ffffff", 4, 6);

  return {
    terrain: r.upload(t.build()),
    terrainTexture: r.loadTexture("/assets/textures/alpine-meadow-stylized-v3.png"),
    surfaces: r.upload(surfaces.build()),
    grass: r.upload(grass.build()),
    shadow: r.upload(shadow.build()),
    props,
    glow: r.upload(glow.build()),
    water: r.upload(w.build()),
    mountains: buildMountains(r, 3, [150, 230], 16),
    sky: buildSky(r, "#287fb8", "#b9dce9", "#ffe39b"),
    portal: r.upload(portal.build()),
    steam: r.upload(steam.build()),
    labels: [
      { text: "☕ Lodge Café", x: PL.lodge.x, y: 9.5, z: PL.lodge.z },
      { text: "🎒 Outfitter", x: PL.outfitter.x, y: 8, z: PL.outfitter.z },
      { text: "🕹️ Riverside Arcade", x: PL.arcade.x, y: 8.5, z: PL.arcade.z },
      { text: "🛶 Lake Dock", x: PL.dock.x, y: 3, z: PL.dock.z },
      { text: "🛷 Toboggan Rush", x: PL.trailhead.x, y: 9.2, z: PL.trailhead.z },
      { text: "♨️ Hot Springs", x: PL.hotSpring.x, y: 3.5, z: PL.hotSpring.z },
      { text: "⛲ Village Plaza", x: 0, y: 6.4, z: 0 },
    ],
  };
}
