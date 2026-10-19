import { CATALOG_BY_ID, type Look } from "@beaver/shared";
import { compose, hexToRgb, mixRgb, multiply, type Mat4, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";

/**
 * Original chibi beaver: big round head, buck teeth, paddle tail.
 * Built from parts so it can waddle, wave and wag.
 */

type PartName = "body" | "head" | "armL" | "armR" | "footL" | "footR" | "tail";

export interface BeaverMeshes {
  parts: Record<PartName, GpuMesh>;
}

const PIVOTS: Record<PartName, [number, number, number]> = {
  body: [0, 0, 0],
  head: [0, 1.15, 0],
  armL: [0.48, 1.0, 0.1],
  armR: [-0.48, 1.0, 0.1],
  footL: [0.25, 0.32, 0.05],
  footR: [-0.25, 0.32, 0.05],
  tail: [0, 0.38, -0.42],
};

const cream: Vec3 = [0.99, 0.9, 0.74];
const dark: Vec3 = [0.18, 0.1, 0.06];
const TAIL = "#4b3a36";

function partBuilders(look: Look): Record<PartName, MeshBuilder> {
  const fur = hexToRgb(look.fur);
  const furLight = mixRgb(fur, cream, 0.5);
  const furDark = mixRgb(fur, dark, 0.35);
  const b: Record<PartName, MeshBuilder> = {
    body: new MeshBuilder(), head: new MeshBuilder(), armL: new MeshBuilder(), armR: new MeshBuilder(),
    footL: new MeshBuilder(), footR: new MeshBuilder(), tail: new MeshBuilder(),
  };
  // Body (pivot at feet level).
  // Use a denser, rounded silhouette for the hero character. The rest of the world
  // stays deliberately low-poly, so every beaver reads as soft and collectible.
  b.body.sphere(compose(0, 0.78, 0, 0, 0, 0, 0.6, 0.62, 0.54), fur, 10, 18);
  b.body.sphere(compose(0, 0.72, 0.29, 0, 0, 0, 0.43, 0.48, 0.31), furLight, 10, 18);

  // Head (pivot at neck: subtract 1.15 in y).
  const H = (y: number) => y - 1.15;
  b.head.sphere(compose(0, H(1.5), 0.02, 0, 0, 0, 0.58, 0.53, 0.52), fur, 12, 20);
  b.head.sphere(compose(0, H(1.38), 0.42, 0, 0, 0, 0.32, 0.23, 0.21), furLight, 10, 16);
  b.head.sphere(compose(0, H(1.47), 0.61, 0, 0, 0, 0.105, 0.08, 0.075), "#3a2218", 8, 12);
  b.head.box(compose(-0.045, H(1.22), 0.535, 0, 0.1, 0, 0.08, 0.15, 0.04), "#fffaf0");
  b.head.box(compose(0.045, H(1.22), 0.535, 0, 0.1, 0, 0.08, 0.15, 0.04), "#fffaf0");
  for (const s of [1, -1]) {
    b.head.sphere(compose(0.2 * s, H(1.58), 0.4, 0, 0, 0, 0.078, 0.095, 0.065), "#1d120c", 8, 12);
    b.head.sphere(compose(0.18 * s, H(1.62), 0.45, 0, 0, 0, 0.028), "#ffffff", 3, 5);
    b.head.sphere(compose(0.34 * s, H(1.4), 0.3, 0, 0, 0, 0.09, 0.06, 0.04), "#f39a8a", 7, 10);
    b.head.sphere(compose(0.38 * s, H(1.86), -0.02, 0, 0, 0, 0.125, 0.125, 0.085), furDark, 9, 14);
    b.head.sphere(compose(0.38 * s, H(1.86), 0.055, 0, 0, 0, 0.075, 0.075, 0.045), furLight, 8, 12);
  }
  // Arms (pivot at shoulder) & feet (pivot at hip).
  b.armL.sphere(compose(0.05, -0.16, 0.05, 0, 0, 0.35, 0.12, 0.22, 0.12), furDark, 8, 12);
  b.armR.sphere(compose(-0.05, -0.16, 0.05, 0, 0, -0.35, 0.12, 0.22, 0.12), furDark, 8, 12);
  b.footL.sphere(compose(0, -0.24, 0.1, 0, 0, 0, 0.17, 0.09, 0.26), furDark, 8, 12);
  b.footR.sphere(compose(0, -0.24, 0.1, 0, 0, 0, 0.17, 0.09, 0.26), furDark, 8, 12);
  // Paddle tail with a darker cross-hatch stripe.
  b.tail.sphere(compose(0, -0.12, -0.45, 0, 0.25, 0, 0.32, 0.07, 0.5), TAIL, 8, 16);
  b.tail.box(compose(0, -0.05, -0.45, 0, 0.25, 0, 0.42, 0.03, 0.06), "#3a2b28");
  b.tail.box(compose(0, -0.07, -0.6, 0, 0.25, 0, 0.36, 0.03, 0.06), "#3a2b28");

  addHat(b.head, look.hat);
  addScarf(b.body, look.scarf);
  addBackpack(b.body, look.backpack);
  return b;
}

function addHat(m: MeshBuilder, id: string | null) {
  const item = id ? CATALOG_BY_ID[id] : null;
  if (!item) return;
  const c = hexToRgb(item.color);
  const cDark = mixRgb(c, dark, 0.25);
  const top = 1.92 - 1.15;
  switch (item.shape) {
    case "toque":
      m.cylinder(compose(0, top - 0.02, 0, 0, -0.08, 0, 1.0, 0.16, 1.0), cDark, 12, 0.5, 0.52);
      m.cylinder(compose(0, top + 0.17, -0.02, 0, -0.12, 0, 1.0, 0.36, 1.0), c, 12, 0.28, 0.48);
      m.sphere(compose(0, top + 0.42, -0.06, 0, 0, 0, 0.15), "#fff6ee", 5, 8);
      break;
    case "ranger":
      m.cylinder(compose(0, top, 0, 0, -0.06, 0, 1.6, 0.05, 1.6), c, 14);
      m.cylinder(compose(0, top + 0.16, 0, 0, -0.06, 0, 0.72, 0.3, 0.72), c, 10, 0.4, 0.5);
      m.cylinder(compose(0, top + 0.07, 0, 0, -0.06, 0, 0.76, 0.07, 0.76), "#4a2f1d", 10);
      break;
    case "antlers":
      for (const s of [1, -1]) {
        m.box(compose(0.32 * s, top + 0.12, 0, 0, 0, -0.5 * s, 0.07, 0.4, 0.07), c);
        m.box(compose(0.55 * s, top + 0.33, 0, 0, 0, -0.2 * s, 0.32, 0.08, 0.18), c);
        for (let k = 0; k < 3; k++) m.cone(compose((0.42 + k * 0.1) * s, top + 0.48, 0, 0, 0, 0, 0.07, 0.22, 0.07), c, 5);
      }
      break;
    case "crown":
      m.cylinder(compose(0, top + 0.06, 0, 0, -0.08, 0, 0.78, 0.2, 0.78), c, 10);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        m.cone(compose(Math.cos(a) * 0.33, top + 0.27, Math.sin(a) * 0.33, 0, 0, 0, 0.13, 0.24, 0.13), c, 5);
        m.sphere(compose(Math.cos(a) * 0.33, top + 0.16, Math.sin(a) * 0.33, 0, 0, 0, 0.05), "#7a4b2c", 3, 5);
      }
      break;
  }
}

function addScarf(m: MeshBuilder, id: string | null) {
  const item = id ? CATALOG_BY_ID[id] : null;
  if (!item) return;
  const c = hexToRgb(item.color);
  m.torus(compose(0, 1.13, 0.0, 0, 0.1, 0, 0.44, 0.9, 0.42), c, 1, 0.24, 14, 6);
  m.box(compose(0.2, 0.9, 0.42, 0.1, 0.15, 0.15, 0.17, 0.4, 0.07), c);
  m.box(compose(0.2, 0.75, 0.45, 0.1, 0.15, 0.15, 0.19, 0.05, 0.08), mixRgb(c, [1, 1, 1], 0.6));
}

function addBackpack(m: MeshBuilder, id: string | null) {
  const item = id ? CATALOG_BY_ID[id] : null;
  if (!item) return;
  const c = hexToRgb(item.color);
  if (item.shape === "canoe") {
    m.sphere(compose(0, 0.95, -0.52, 0, 0, 0, 0.24, 0.85, 0.16), c, 5, 10);
    m.box(compose(0, 0.95, -0.42, 0, 0, 0, 0.42, 0.06, 0.05), "#7a4b2c");
  } else {
    m.box(compose(0, 0.88, -0.5, 0, 0, 0, 0.56, 0.6, 0.3), c);
    m.box(compose(0, 1.12, -0.48, 0.25, 0, 0, 0.58, 0.18, 0.32), mixRgb(c, dark, 0.25));
    m.cylinder(compose(0, 0.62, -0.58, 0, 0, Math.PI / 2, 0.14, 0.62, 0.14), "#c94f3a", 8);
  }
}

const meshCache = new Map<string, BeaverMeshes>();

export function lookKey(look: Look): string {
  return [look.fur, look.hat, look.scarf, look.backpack].join("|");
}

export function getBeaverMeshes(r: Renderer, look: Look): BeaverMeshes {
  const key = lookKey(look);
  let m = meshCache.get(key);
  if (!m) {
    const b = partBuilders(look);
    m = { parts: Object.fromEntries(Object.entries(b).map(([k, v]) => [k, r.upload(v.build())])) as Record<PartName, GpuMesh> };
    meshCache.set(key, m);
  }
  return m;
}

/** Bakes a beaver into an existing static mesh (used for the plaza statue). */
export function bakeBeaver(into: MeshBuilder, look: Look, m: Mat4) {
  const b = partBuilders(look);
  for (const [name, builder] of Object.entries(b) as [PartName, MeshBuilder][]) {
    const [px, py, pz] = PIVOTS[name];
    const d = builder.build();
    const tris: number[][] = [];
    for (let i = 0; i < d.count; i += 3) {
      tris.push(Array.from(d.positions.slice(i * 3, i * 3 + 9)).map((v, k) => v + [px, py, pz][k % 3]));
    }
    into.addTris(tris, m, (x, y, z) => {
      const s = 0.55 + 0.1 * Math.sin(x * 3 + y * 2 + z);
      return [s * 0.95, s * 0.92, s * 0.86];
    });
  }
}

export interface BeaverPose {
  walk: number; // walk cycle phase
  moving: number; // 0..1 blend
  swim: number; // 0..1 blend
  jump: number; // 0..1 emote hop
  wave: number; // 0..1 arm wave
  sled: number; // 0..1 seated pose
  time: number;
}

/** Draws an animated beaver at a world transform. */
export function drawBeaver(r: Renderer, meshes: BeaverMeshes, root: Mat4, pose: BeaverPose, tint?: [number, number, number, number]) {
  const t = pose.time;
  const w = pose.walk;
  const mv = pose.moving;
  const bob = Math.abs(Math.sin(w)) * 0.12 * mv + Math.sin(t * 2.2) * 0.015 + pose.jump * 0.9;
  const sway = Math.sin(w) * 0.12 * mv;
  const swimDrop = -0.85 * pose.swim;
  const sledDrop = -0.25 * pose.sled;
  const base = multiply(root, compose(0, bob + swimDrop + sledDrop, 0, 0, 0, sway, 1, 1 - pose.jump * 0.08 + Math.sin(t * 2.2) * 0.01, 1));
  const opts = { outline: 0.035, tint };
  const part = (name: PartName, rx: number, ry: number, rz: number) => {
    const [px, py, pz] = PIVOTS[name];
    r.draw(meshes.parts[name], multiply(base, compose(px, py, pz, ry, rx, rz)), opts);
  };
  part("body", 0, 0, 0);
  part("head", -0.05 * mv + Math.sin(t * 1.3) * 0.04 - pose.sled * 0.05, Math.sin(t * 0.7) * 0.12 * (1 - mv), 0);
  const armSwing = Math.sin(w) * 0.7 * mv;
  const swimStroke = Math.sin(t * 6) * 1.1 * pose.swim;
  part("armL", armSwing + swimStroke - pose.sled * 0.9, 0, pose.wave * (2.4 + Math.sin(t * 14) * 0.35));
  part("armR", -armSwing - swimStroke - pose.sled * 0.9, 0, 0);
  part("footL", -Math.sin(w) * 0.8 * mv - pose.sled * 1.2, 0, 0);
  part("footR", Math.sin(w) * 0.8 * mv - pose.sled * 1.2, 0, 0);
  part("tail", -0.15 + Math.sin(t * 3) * 0.05 + pose.swim * 0.4, Math.sin(t * (mv > 0.1 ? 9 : 2.5)) * (0.15 + mv * 0.25), 0);
}
