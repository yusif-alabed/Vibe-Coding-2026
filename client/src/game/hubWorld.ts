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
  if (r < 10.5) return (Math.floor(x / 1.6) + Math.floor(z / 1.6)) % 2 ? rgb(P.snow) : rgb(P.snowShade);
  if (pathDist(x, z) < 1.8) return mixRgb(rgb(P.dirt), rgb(P.sand), n * 0.4);
  const g = n < 0.33 ? P.grassA : n < 0.66 ? P.grassB : P.grassC;
  return y > 3 ? mixRgb(rgb(g), rgb(P.meadowDark), Math.min(1, (y - 3) / 5)) : rgb(g);
}

export interface HubWorld {
  terrain: GpuMesh;
  terrainTexture: WebGLTexture;
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
  // Denser terrain keeps the slopes and snowy plaza from reading as giant facets.
  const S = 1.6, R = 120;
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
  p.cylinder(compose(0, 0.35, 0, 0, 0, 0, 4.4, 0.7, 4.4), P.stone, 12, 0.5, 0.5, 0.06);
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

  // --- Water: lake, river ribbon, hot spring, fountain ---
  const w = new MeshBuilder();
  const waterCol = (x: number, _y: number, z: number): Vec3 => {
    const deep = Math.min(1, Math.max(0, -heightAt(x, z) / 2));
    return mixRgb(rgb(P.glacier), rgb(P.glacierDeep), deep * 0.7);
  };
  // A smaller grid and an all-corners test keeps the shoreline on the wet side of
  // the terrain. The old min-corner test put water over cells that were mostly dry.
  for (let x = -70; x < 70; x += 1) {
    for (let z = -100; z < 70; z += 1) {
      const cells = [heightAt(x, z), heightAt(x + 1, z), heightAt(x, z + 1), heightAt(x + 1, z + 1)];
      if (Math.max(...cells) > WATER_Y + 0.015) continue;
      if (Math.hypot(x - PL.hotSpring.x, z - PL.hotSpring.z) < 5) continue;
      const a: Vec3 = [x, WATER_Y, z], b: Vec3 = [x + 1, WATER_Y, z];
      const c: Vec3 = [x + 1, WATER_Y, z + 1], d: Vec3 = [x, WATER_Y, z + 1];
      const up: Vec3 = [0, 1, 0];
      w.triSmooth(a, b, c, waterCol, up, up, up);
      w.triSmooth(a, c, d, waterCol, up, up, up);
    }
  }
  w.cylinder(compose(PL.hotSpring.x, -0.25, PL.hotSpring.z, 0, 0, 0, 7, 0.1, 7), "#8fe3d8", 12);
  w.cylinder(compose(0, 0.68, 0, 0, 0, 0, 7.6, 0.08, 7.6), "#62d6d0", 14);

  // Portal ring (drawn animated) + steam puff (drawn many times).
  const portal = new MeshBuilder().torus(compose(0, 0, 0, 0, Math.PI / 2, 0), P.portal, 3, 0.35, 24, 6);
  const steam = new MeshBuilder().sphere(compose(0, 0, 0), "#ffffff", 4, 6);

  return {
    terrain: r.upload(t.build()),
    terrainTexture: r.loadTexture("/assets/textures/alpine-meadow-cartoon-v2.png"),
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
