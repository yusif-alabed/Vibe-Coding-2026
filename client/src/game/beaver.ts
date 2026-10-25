import { CATALOG_BY_ID, type Look } from "@beaver/shared";
import { compose, hexToRgb, mixRgb, multiply, type Mat4, type Vec3 } from "../engine/math";
import { MeshBuilder, meshDetail } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";

/**
 * Original chibi beaver: big round head, buck teeth, paddle tail — and a face that reacts.
 *
 * The body is split into parts so it can waddle, swim, wave, cheer and ride a toboggan.
 * The face is made of swappable pieces (eyes, pupils, brows, mouth) drawn on top of the
 * head, which lets one model show many expressions without extra textures.
 */

type PartName = "body" | "head" | "muzzle" | "armL" | "armR" | "footL" | "footR" | "tail";
type FacePart = "eyes" | "pupils" | "eyesHappy" | "eyesDizzy" | "browL" | "browR" | "mouthSmile" | "mouthOpen" | "star";

export type Expression = "neutral" | "happy" | "excited" | "surprised" | "dizzy" | "determined";

export interface BeaverMeshes {
  parts: Record<PartName, GpuMesh>;
  face: Record<FacePart, GpuMesh>;
  /** A low-poly copy drawn when the beaver is further away. */
  low?: BeaverMeshes;
}

const PIVOTS: Record<PartName, [number, number, number]> = {
  body: [0, 0, 0],
  head: [0, 1.15, 0],
  muzzle: [0, 1.15, 0], // drawn with the head, but without the ink outline
  armL: [0.47, 1.0, 0.12],
  armR: [-0.47, 1.0, 0.12],
  footL: [0.25, 0.32, 0.05],
  footR: [-0.25, 0.32, 0.05],
  tail: [0, 0.56, -0.34],
};

// Head geometry, in head-local space (pivot at the neck).
const HEAD_C: Vec3 = [0, 0.39, 0.03];
const HEAD_R: Vec3 = [0.66, 0.6, 0.59];
const EYE_Y = 0.52;
const EYE_X = 0.25;
/** How far the muzzle sits forward of its original design (follows the head size). */
const MZ = 0.04;

/** z of the head's front surface at (x, y), so face pieces sit right on it. */
function surf(x: number, y: number): number {
  const k = 1 - (x / HEAD_R[0]) ** 2 - ((y - HEAD_C[1]) / HEAD_R[1]) ** 2;
  return HEAD_C[2] + HEAD_R[2] * Math.sqrt(Math.max(0, k));
}

const cream: Vec3 = [0.99, 0.9, 0.74];
const dark: Vec3 = [0.18, 0.1, 0.06];
const INK = "#24140c";
const TAIL_A: Vec3 = hexToRgb("#4b3a36");
const TAIL_B: Vec3 = hexToRgb("#3a2b28");

function partBuilders(look: Look): Record<PartName, MeshBuilder> {
  const fur = hexToRgb(look.fur);
  const furLight = mixRgb(fur, cream, 0.5);
  const furDark = mixRgb(fur, dark, 0.35);
  const b: Record<PartName, MeshBuilder> = {
    body: new MeshBuilder(), head: new MeshBuilder(), muzzle: new MeshBuilder(), armL: new MeshBuilder(), armR: new MeshBuilder(),
    footL: new MeshBuilder(), footR: new MeshBuilder(), tail: new MeshBuilder(),
  };

  // Body: a soft pear (wide hips, smaller chest) with a cream belly and a fluffy chest tuft.
  b.body.sphere(compose(0, 0.7, 0, 0, 0, 0, 0.62, 0.58, 0.56), fur, 12, 22);
  b.body.sphere(compose(0, 0.98, 0.01, 0, 0, 0, 0.49, 0.42, 0.46), fur, 12, 22);
  b.body.sphere(compose(0, 0.72, 0.3, 0, 0, 0, 0.43, 0.48, 0.31), furLight, 10, 18);
  for (let i = 0; i < 3; i++) {
    b.body.cone(compose((i - 1) * 0.09, 1.07 - Math.abs(i - 1) * 0.03, 0.38, 0, 1.15, (i - 1) * 0.3, 0.1, 0.16, 0.06), furLight, 5);
  }

  // Head (pivot at neck).
  b.head.sphere(compose(HEAD_C[0], HEAD_C[1], HEAD_C[2], 0, 0, 0, ...HEAD_R), fur, 14, 24);
  // Muzzle: two puffy cheek lobes and a centre pad.
  for (const s of [1, -1]) {
    b.muzzle.sphere(compose(0.13 * s, 0.25, 0.45 + MZ, 0, 0, 0, 0.2, 0.17, 0.17), furLight, 9, 14);
    // Whisker freckles.
    for (let k = 0; k < 2; k++) b.muzzle.sphere(compose((0.17 + k * 0.06) * s, 0.27 - k * 0.03, surfMuzzle(0.17 + k * 0.06, 0.27 - k * 0.03) + MZ, 0, 0, 0, 0.014, 0.014, 0.008), mixRgb(furLight, furDark, 0.55), 4, 6);
  }
  b.muzzle.sphere(compose(0, 0.3, 0.5 + MZ, 0, 0, 0, 0.16, 0.13, 0.13), furLight, 8, 12);
  // Big shiny nose.
  b.muzzle.sphere(compose(0, 0.36, 0.63 + MZ, 0, 0, 0, 0.11, 0.08, 0.075), "#3a2218", 8, 12);
  b.muzzle.sphere(compose(0.035, 0.39, 0.69 + MZ, 0, 0, 0, 0.03, 0.018, 0.015), "#c9a493", 4, 6);
  // The signature buck teeth: two chunky, slightly splayed tiles.
  b.muzzle.box(compose(0, 0.07, 0.567 + MZ, 0, 0.12, 0, 0.008, 0.13, 0.045), "#d9cdb9");
  for (const s of [1, -1]) b.muzzle.box(compose(0.046 * s, 0.07, 0.565 + MZ, 0.05 * s, 0.12, 0.02 * s, 0.082, 0.14, 0.045), "#fffaf0");
  // Round ears with a soft inner colour.
  for (const s of [1, -1]) {
    b.head.sphere(compose(0.42 * s, 0.88, -0.04, 0, 0, -0.3 * s, 0.14, 0.13, 0.09), furDark, 9, 14);
    b.muzzle.sphere(compose(0.42 * s, 0.88, 0.03, 0, 0, -0.3 * s, 0.085, 0.08, 0.04), mixRgb(furLight, [0.96, 0.62, 0.55], 0.4), 8, 12);
  }
  // A little fur tuft on top.
  for (let i = 0; i < 3; i++) {
    b.head.cone(compose((i - 1) * 0.08, 0.99 - Math.abs(i - 1) * 0.04, 0.12, 0, 0.35, (i - 1) * 0.45, 0.09, 0.2, 0.09), furDark, 5);
  }

  // Arms (pivot at shoulder) with darker paws and tiny claws.
  for (const [name, s] of [["armL", 1], ["armR", -1]] as const) {
    b[name].sphere(compose(0.05 * s, -0.14, 0.05, 0, 0, 0.3 * s, 0.12, 0.2, 0.12), fur, 8, 12);
    b[name].sphere(compose(0.1 * s, -0.33, 0.08, 0, 0, 0.3 * s, 0.1, 0.1, 0.1), furDark, 8, 12);
    for (let k = 0; k < 3; k++) b[name].sphere(compose(0.1 * s + (k - 1) * 0.04, -0.41, 0.15, 0, 0, 0, 0.022), "#f2e6d6", 3, 5);
  }
  // Big webbed feet with three toes.
  for (const name of ["footL", "footR"] as const) {
    b[name].sphere(compose(0, -0.25, 0.1, 0, 0, 0, 0.19, 0.08, 0.28), mixRgb(furDark, TAIL_A, 0.5), 8, 12);
    for (let k = 0; k < 3; k++) b[name].sphere(compose((k - 1) * 0.1, -0.24, 0.33, 0, 0, 0, 0.07, 0.065, 0.07), mixRgb(furDark, TAIL_A, 0.5), 6, 8);
  }
  // Paddle tail with a scaly cross-hatch, slightly curved upward at the tip.
  const hatch = (x: number, _y: number, z: number): Vec3 => {
    const u = Math.floor((x + z) * 11), v = Math.floor((x - z) * 11);
    return (u + v) % 2 === 0 ? TAIL_A : TAIL_B;
  };
  // A short, overlapping base physically joins the paddle to the body rather than
  // making it read like a loose prop behind the beaver.
  b.tail.sphere(compose(0, -0.08, -0.04, 0, 0.08, 0, 0.32, 0.2, 0.34), furDark, 10, 18);
  addTail(b.tail, look.tail ?? null, hatch, fur, furDark, furLight);

  addHat(b.head, look.hat, dyeOf(look, "hat"));
  addScarf(b.body, look.scarf, dyeOf(look, "scarf"));
  addBackpack(b.body, look.backpack, dyeOf(look, "backpack"));
  if (CATALOG_BY_ID[look.eyes ?? ""]?.shape === "glasses") {
    // Round wire glasses sit on the face (drawn with the muzzle, so no ink ring).
    for (const s2 of [1, -1]) b.muzzle.torus(compose(EYE_X * s2, EYE_Y, surf(EYE_X, EYE_Y) + 0.03, 0, Math.PI / 2, 0, 0.13, 0.13, 0.13), "#3b251b", 1, 0.12, 16, 4);
    b.muzzle.box(compose(0, EYE_Y + 0.02, surf(0, EYE_Y) + 0.03, 0, 0, 0, 0.12, 0.02, 0.02), "#3b251b");
  }
  return b;
}

/** A dye colour applied to a worn item, if any. */
function dyeOf(look: Look, slot: "hat" | "scarf" | "backpack"): string | undefined {
  const id = look.dyes?.[slot];
  return id ? CATALOG_BY_ID[id]?.color : undefined;
}

function addTail(m: MeshBuilder, id: string | null, hatch: (x: number, y: number, z: number) => Vec3, fur: Vec3, furDark: Vec3, furLight: Vec3) {
  const shape = id ? CATALOG_BY_ID[id]?.shape : null;
  if (shape === "fluffy") {
    // A big, soft, squirrel-ish plume.
    for (let i = 0; i < 6; i++) m.sphere(compose(0, -0.05 + i * 0.07, -0.25 - i * 0.07, 0, 0.3 - i * 0.12, 0, 0.3 - i * 0.02, 0.2, 0.22), i % 2 ? fur : furLight, 8, 12);
    return;
  }
  if (shape === "striped") {
    m.sphere(compose(0, -0.12, -0.3, 0, 0.12, 0, 0.32, 0.08, 0.4), (_x: number, _y: number, z: number) => (Math.floor((z + 0.6) * 9) % 2 ? furDark : furLight), 12, 22);
    return;
  }
  m.sphere(compose(0, -0.12, -0.3, 0, 0.12, 0, 0.32, 0.08, 0.4), hatch, 12, 22);
  m.box(compose(0, -0.05, -0.3, 0, 0.12, 0, 0.4, 0.022, 0.05), TAIL_B);
  m.box(compose(0, -0.07, -0.42, 0, 0.12, 0, 0.34, 0.022, 0.05), TAIL_B);
  if (shape === "heart") {
    for (const s of [1, -1]) m.sphere(compose(0.06 * s, -0.04, -0.66, 0, 0, 0.5 * s, 0.09, 0.09, 0.05), "#ff6fa5", 6, 8);
    m.cone(compose(0, -0.04, -0.6, 0, -Math.PI / 2, 0, 0.17, 0.14, 0.06), "#ff6fa5", 6);
  }
  if (shape === "star") {
    for (let i = 0; i < 7; i++) m.sphere(compose(Math.sin(i * 2.4) * 0.18, -0.02, -0.18 - (i % 4) * 0.1, i, 0, 0, 0.035), "#ffd14f", 3, 4);
  }
}


/** Front surface of a cheek lobe, for placing freckles. */
function surfMuzzle(x: number, y: number): number {
  const cx = 0.13, cy = 0.25, cz = 0.45;
  const k = 1 - ((x - cx) / 0.2) ** 2 - ((y - cy) / 0.17) ** 2;
  return cz + 0.17 * Math.sqrt(Math.max(0, k));
}

/** Face pieces. Eyes, pupils and brows are built around their own centres so they can blink, look and tilt. */
function faceBuilders(look: Look): Record<FacePart, MeshBuilder> {
  const furDark = mixRgb(hexToRgb(look.fur), dark, 0.55);
  const eyeShape = look.eyes ? CATALOG_BY_ID[look.eyes]?.shape : null;
  const eyeScale = eyeShape === "round" ? 1.28 : 1;
  const f: Record<FacePart, MeshBuilder> = {
    eyes: new MeshBuilder(), pupils: new MeshBuilder(), eyesHappy: new MeshBuilder(), eyesDizzy: new MeshBuilder(),
    browL: new MeshBuilder(), browR: new MeshBuilder(), mouthSmile: new MeshBuilder(), mouthOpen: new MeshBuilder(), star: new MeshBuilder(),
  };
  for (const s of [1, -1]) {
    const x = EYE_X * s, z = surf(EYE_X, EYE_Y);
    // Dark oval eyes (no whites), centred on EYE_Y so blinking squashes toward the middle.
    f.eyes.sphere(compose(x, 0, z - 0.02, 0, 0, 0, 0.08 * eyeScale, 0.095 * eyeScale, 0.05), "#1d110b", 10, 14);
    if (eyeShape === "sparkle") {
      f.eyes.sphere(compose(x, -0.015, z + 0.012, 0, 0, 0, 0.055, 0.06, 0.02), "#4fb6ff", 8, 10);
      f.pupils.sphere(compose(x - 0.02 * s, -0.035, z + 0.03, 0, 0, 0, 0.012, 0.012, 0.008), "#ffffff", 4, 5);
    }
    if (eyeShape === "sleepy") {
      // Heavy lids over the top half.
      f.eyes.sphere(compose(x, 0.035, z - 0.005, 0, 0, 0, 0.092, 0.06, 0.055), furDark, 8, 12);
    }
    if (eyeShape === "lashes") {
      for (let k = 0; k < 3; k++) f.eyes.box(compose(x + (0.05 + k * 0.022) * s, 0.07 - k * 0.02, z + 0.01, 0, 0, (0.5 + k * 0.35) * -s, 0.045, 0.012, 0.012), "#1d110b");
    }
    // One small highlight to keep the eyes alive.
    f.pupils.sphere(compose(x + 0.025 * s * eyeScale, 0.03 * eyeScale, z + 0.028, 0, 0, 0, 0.022 * eyeScale, 0.025 * eyeScale, 0.01), "#ffffff", 5, 6);
    // Happy eyes: upside-down "U" arcs.
    for (let k = 0; k <= 6; k++) {
      const a = Math.PI * (0.12 + (0.76 * k) / 6);
      f.eyesHappy.box(compose(x + Math.cos(a) * 0.07, Math.sin(a) * 0.055 - 0.02, z + 0.012, 0, 0, a - Math.PI / 2, 0.036, 0.026, 0.026), INK);
    }
    // Dizzy eyes: little crosses.
    for (const r of [Math.PI / 4, -Math.PI / 4]) f.eyesDizzy.box(compose(x, 0, z + 0.012, 0, 0, r, 0.13, 0.026, 0.026), INK);
  }
  // Brows are built at their own origin; drawBeaver places, raises and tilts them.
  // Soft rounded brows (flattened capsules), only shown when an expression needs them.
  f.browL.sphere(compose(0, 0, 0, 0, 0, 0, 0.075, 0.018, 0.02), furDark, 5, 8);
  f.browR.sphere(compose(0, 0, 0, 0, 0, 0, 0.075, 0.018, 0.02), furDark, 5, 8);
  // Small smile under the nose.
  // A short, gently curved mouth line under the nose.
  for (let k = 0; k <= 5; k++) {
    const a = Math.PI * (1.3 + (0.4 * k) / 5);
    f.mouthSmile.box(compose(Math.cos(a) * 0.11, 0.33 + Math.sin(a) * 0.1, 0.63 + MZ, 0, 0, a + Math.PI / 2, 0.026, 0.014, 0.014), INK);
  }
  // Open mouth (behind the teeth) with a pink tongue.
  f.mouthOpen.sphere(compose(0, 0.12, 0.575 + MZ, 0, 0, 0, 0.12, 0.1, 0.04), "#3b1410", 8, 12);
  f.mouthOpen.sphere(compose(0, 0.07, 0.6 + MZ, 0, 0, 0, 0.07, 0.04, 0.02), "#ff7f8a", 6, 8);
  // Dizzy star.
  f.star.sphere(compose(0, 0, 0, 0, 0, 0, 0.07), "#ffd84a", 2, 4);
  return f;
}

function addHat(m: MeshBuilder, id: string | null, dye?: string) {
  const item = id ? CATALOG_BY_ID[id] : null;
  if (!item) return;
  const c = hexToRgb(dye ?? item.color);
  const cDark = mixRgb(c, dark, 0.25);
  // Hats sit on the crown of the (big) head and are sized up to match it.
  const k = 1.18;
  const top = HEAD_C[1] + HEAD_R[1] - 0.12;
  const at = (x: number, y: number, z: number, ry = 0, rx = 0, rz = 0, sx = 1, sy = sx, sz = sx) =>
    compose(x * k, top + y * k, z * k + 0.02, ry, rx, rz, sx * k, sy * k, sz * k);
  switch (item.shape) {
    case "toque":
      m.cylinder(at(0, -0.02, 0, 0, -0.08, 0, 1.0, 0.16, 1.0), cDark, 14, 0.5, 0.52);
      m.cylinder(at(0, 0.17, -0.02, 0, -0.12, 0, 1.0, 0.36, 1.0), c, 14, 0.28, 0.48);
      m.sphere(at(0, 0.42, -0.06, 0, 0, 0, 0.15), "#fff6ee", 6, 10);
      break;
    case "ranger":
      m.cylinder(at(0, 0, 0, 0, -0.06, 0, 1.6, 0.05, 1.6), c, 16);
      m.cylinder(at(0, 0.16, 0, 0, -0.06, 0, 0.72, 0.3, 0.72), c, 12, 0.4, 0.5);
      m.cylinder(at(0, 0.07, 0, 0, -0.06, 0, 0.76, 0.07, 0.76), "#4a2f1d", 12);
      break;
    case "antlers":
      for (const s of [1, -1]) {
        m.box(at(0.32 * s, 0.12, 0, 0, 0, -0.5 * s, 0.07, 0.4, 0.07), c);
        m.box(at(0.55 * s, 0.33, 0, 0, 0, -0.2 * s, 0.32, 0.08, 0.18), c);
        for (let i = 0; i < 3; i++) m.cone(at((0.42 + i * 0.1) * s, 0.48, 0, 0, 0, 0, 0.07, 0.22, 0.07), c, 5);
      }
      break;
    case "flowers": {
      const cols = ["#ff7eb3", "#ffd93b", "#a77bff", "#ffffff", "#7fd6ff"];
      m.torus(at(0, 0.02, 0, 0, -0.08, 0, 0.36), "#4f8a3a", 1, 0.12, 16, 5);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        m.sphere(at(Math.cos(a) * 0.36, 0.05, Math.sin(a) * 0.36, 0, 0, 0, 0.09, 0.07, 0.09), cols[i % cols.length], 4, 6);
        m.sphere(at(Math.cos(a) * 0.36, 0.1, Math.sin(a) * 0.36, 0, 0, 0, 0.035), "#ffd93b", 3, 4);
      }
      break;
    }
    case "sunhat":
      m.cylinder(at(0, 0, 0, 0, -0.06, 0, 1.9, 0.04, 1.9), c, 20);
      m.cylinder(at(0, 0.15, 0, 0, -0.06, 0, 0.75, 0.3, 0.75), c, 14, 0.42, 0.5);
      m.cylinder(at(0, 0.06, 0, 0, -0.06, 0, 0.78, 0.08, 0.78), "#ff7eb3", 14);
      m.sphere(at(0.36, 0.1, 0.12, 0, 0, 0, 0.08), "#ffd93b", 4, 6);
      break;
    case "pumpkin":
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        m.sphere(at(Math.cos(a) * 0.14, 0.14, Math.sin(a) * 0.14, -a, 0, 0, 0.26, 0.24, 0.17), i % 2 ? c : cDark, 6, 10);
      }
      m.cylinder(at(0, 0.4, 0, 0, 0, 0.2, 0.07, 0.16, 0.07), "#4f6b2a", 6);
      m.sphere(at(0.12, 0.38, 0.05, 0, 0, 0.6, 0.12, 0.03, 0.07), "#5f8a3a", 4, 6);
      break;
    case "holiday":
      m.cylinder(at(0, 0.02, 0, 0, -0.08, 0, 1.0, 0.14, 1.0), "#fffaf0", 14, 0.52, 0.52);
      m.cone(at(0, 0.36, -0.04, 0, -0.5, 0, 0.92, 0.66, 0.92), c, 12);
      m.sphere(at(0, 0.52, -0.42, 0, 0, 0, 0.14), "#fffaf0", 6, 10);
      break;
    case "earmuffs":
      m.torus(at(0, 0.05, 0, 0, 0, Math.PI / 2, 0.42, 0.42, 0.42), "#8a8a96", 1, 0.08, 16, 4);
      for (const s of [1, -1]) m.sphere(at(0.44 * s, -0.22, 0, 0, 0, 0, 0.17, 0.2, 0.2), c, 6, 10);
      break;
    case "propeller":
      m.cylinder(at(0, 0.06, 0, 0, -0.08, 0, 0.98, 0.24, 0.98), c, 14, 0.42, 0.5);
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        m.cylinder(at(Math.cos(a) * 0.24, 0.2, Math.sin(a) * 0.24, -a, 0, 0, 0.5, 0.2, 0.3), ["#e2483d", "#ffd93b", "#3fbf7f", "#ffffff"][i], 4, 0.3, 0.5);
      }
      m.cylinder(at(0, 0.36, 0, 0, 0, 0, 0.05, 0.14, 0.05), "#3a3a45", 5);
      m.box(at(0, 0.44, 0, 0.6, 0, 0, 0.7, 0.03, 0.1), "#e2483d");
      m.box(at(0, 0.445, 0, 0.6 + Math.PI / 2, 0, 0, 0.7, 0.03, 0.1), "#ffd93b");
      break;
    case "party":
      m.cone(at(0, 0.3, 0, 0, -0.05, 0.12, 0.5, 0.62, 0.5), (_x, y) => (Math.floor(y * 14) % 2 ? c : hexToRgb("#ff6fb5")), 12);
      m.sphere(at(0.04, 0.63, 0, 0, 0, 0, 0.1), "#7ff3f0", 4, 6);
      break;
    case "baker":
      m.cylinder(at(0, 0.02, 0, 0, -0.08, 0, 0.92, 0.16, 0.92), c, 14);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        m.sphere(at(Math.cos(a) * 0.2, 0.34, Math.sin(a) * 0.2 - 0.02, 0, 0, 0, 0.26, 0.24, 0.26), c, 6, 10);
      }
      m.sphere(at(0, 0.48, -0.02, 0, 0, 0, 0.26), c, 6, 10);
      break;
    case "bucket":
      m.cylinder(at(0, 0.0, 0, 0, -0.08, 0, 1.3, 0.1, 1.3), c, 16, 0.5, 0.55);
      m.cylinder(at(0, 0.18, 0, 0, -0.08, 0, 0.82, 0.32, 0.82), c, 14, 0.44, 0.5);
      m.box(at(0.32, 0.12, 0.2, 0.5, 0, 0, 0.18, 0.08, 0.02), "#ffd93b");
      break;
    case "scholar":
      m.cylinder(at(0, 0.06, 0, 0, -0.08, 0, 0.8, 0.22, 0.8), c, 12);
      m.box(at(0, 0.2, 0, Math.PI / 4, -0.08, 0, 0.95, 0.05, 0.95), c);
      m.box(at(0.3, 0.05, 0.3, 0, 0, 0, 0.03, 0.3, 0.03), "#f2c230");
      m.sphere(at(0, 0.24, 0, 0, 0, 0, 0.05), "#f2c230", 3, 5);
      break;
    case "crown":
      m.cylinder(at(0, 0.06, 0, 0, -0.08, 0, 0.78, 0.2, 0.78), c, 12);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        m.cone(at(Math.cos(a) * 0.33, 0.27, Math.sin(a) * 0.33, 0, 0, 0, 0.13, 0.24, 0.13), c, 5);
        m.sphere(at(Math.cos(a) * 0.33, 0.16, Math.sin(a) * 0.33, 0, 0, 0, 0.05), "#7a4b2c", 3, 5);
      }
      break;
  }
}

function addScarf(m: MeshBuilder, id: string | null, dye?: string) {
  const item = id ? CATALOG_BY_ID[id] : null;
  if (!item) return;
  const c = hexToRgb(dye ?? item.color);
  if (item.shape === "sash") {
    m.torus(compose(0, 0.9, 0.02, 0, 0.1, 0.75, 0.6, 0.62, 0.5), c, 1, 0.12, 18, 4);
    m.sphere(compose(-0.24, 0.72, 0.5, 0, 0, 0, 0.09, 0.09, 0.03), "#f2c230", 5, 8);
    return;
  }
  const stripe = mixRgb(c, [1, 1, 1], 0.6);
  if (item.shape === "candy") {
    m.torus(compose(0, 1.14, 0.0, 0, 0.1, 0, 0.47, 0.9, 0.45), c, 1, 0.24, 16, 6);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      m.box(compose(Math.cos(a) * 0.47, 1.14 + Math.sin(a) * 0.04, Math.sin(a) * 0.45, -a, 0.1, 0.4, 0.06, 0.24, 0.24), "#fffaf0");
    }
    for (const y of [0.9, 0.78]) m.box(compose(0.2, y, 0.45, 0.1, 0.15, 0.15, 0.18, 0.07, 0.08), "#fffaf0");
    m.box(compose(0.2, 0.84, 0.44, 0.1, 0.15, 0.15, 0.17, 0.4, 0.07), c);
    return;
  }
  m.torus(compose(0, 1.14, 0.0, 0, 0.1, 0, 0.47, 0.9, 0.45), c, 1, 0.24, 16, 6);
  m.box(compose(0.2, 0.9, 0.44, 0.1, 0.15, 0.15, 0.17, 0.4, 0.07), c);
  m.box(compose(0.2, 0.84, 0.455, 0.1, 0.15, 0.15, 0.18, 0.05, 0.08), stripe);
  m.box(compose(0.2, 0.75, 0.47, 0.1, 0.15, 0.15, 0.19, 0.05, 0.08), stripe);
}

function addBackpack(m: MeshBuilder, id: string | null, dye?: string) {
  const item = id ? CATALOG_BY_ID[id] : null;
  if (!item) return;
  const c = hexToRgb(dye ?? item.color);
  if (item.shape === "maproll") {
    m.cylinder(compose(0, 0.95, -0.55, 0, 0, 0.5, 0.2, 0.95, 0.2), c, 10);
    for (const y of [0.7, 1.2]) m.cylinder(compose(0.02 + (y - 0.95) * 0.48, y, -0.55, 0, 0, 0.5, 0.22, 0.05, 0.22), "#c8473a", 10);
    return;
  }
  if (item.shape === "beachball") {
    m.sphere(compose(0, 0.95, -0.66, 0, 0, 0, 0.36), (x: number, _y: number, z: number) => [hexToRgb("#e2483d"), hexToRgb("#fffaf0"), hexToRgb("#4fb6ff"), hexToRgb("#ffd93b")][Math.floor(((Math.atan2(z + 0.66, x) + Math.PI) / (Math.PI * 2)) * 6) % 4], 8, 12);
    return;
  }
  if (item.shape === "canoe") {
    m.sphere(compose(0, 0.95, -0.54, 0, 0, 0, 0.24, 0.85, 0.16), c, 6, 12);
    m.box(compose(0, 0.95, -0.44, 0, 0, 0, 0.42, 0.06, 0.05), "#7a4b2c");
  } else if (item.shape === "basket") {
    m.box(compose(0, 0.82, -0.58, 0, 0, 0, 0.62, 0.42, 0.36), c);
    for (let i = 0; i < 4; i++) m.box(compose(0, 0.66 + i * 0.1, -0.77, 0, 0, 0, 0.64, 0.03, 0.02), mixRgb(c, dark, 0.3));
    for (let i = 0; i < 4; i++) m.box(compose(-0.24 + i * 0.16, 1.05, -0.58, 0, 0, 0, 0.16, 0.05, 0.38), i % 2 ? "#e2483d" : "#fffaf0");
    m.torus(compose(0, 1.08, -0.58, 0, 0, Math.PI / 2, 0.24, 0.24, 0.24), mixRgb(c, dark, 0.3), 1, 0.08, 12, 4);
  } else if (item.shape === "firewood") {
    for (let i = 0; i < 5; i++) {
      m.cylinder(compose(-0.16 + (i % 3) * 0.16, 0.75 + Math.floor(i / 3) * 0.16, -0.6, 0, 0, Math.PI / 2, 0.15, 0.7, 0.15), c, 7);
      m.cylinder(compose(-0.16 + (i % 3) * 0.16 + 0.36, 0.75 + Math.floor(i / 3) * 0.16, -0.6, 0, 0, Math.PI / 2, 0.12, 0.02, 0.12), "#d9b77a", 7);
    }
    m.box(compose(0, 0.82, -0.6, 0, 0, 0, 0.08, 0.42, 0.24), "#3a3a45");
  } else if (item.shape === "guitar") {
    m.sphere(compose(0.05, 0.72, -0.56, 0, 0, 0.3, 0.26, 0.24, 0.08), c, 6, 10);
    m.sphere(compose(0.0, 0.96, -0.56, 0, 0, 0.3, 0.2, 0.18, 0.075), c, 6, 10);
    m.box(compose(-0.18, 1.35, -0.56, 0, 0, 0.3, 0.08, 0.7, 0.05), "#5b3a24");
    m.cylinder(compose(0.03, 0.82, -0.48, 0, Math.PI / 2, 0, 0.1, 0.02, 0.1), "#3a2218", 8);
  } else if (item.shape === "board") {
    m.box(compose(0, 0.95, -0.56, 0, 0, 0.12, 0.42, 1.5, 0.06), c);
    for (const y of [0.55, 1.35]) m.sphere(compose(0, y, -0.56, 0, 0, 0, 0.21, 0.06, 0.03), c, 4, 8);
    for (const y of [0.75, 1.15]) m.box(compose(0, y, -0.52, 0, 0, 0.12, 0.36, 0.12, 0.06), "#3a3a45");
  } else {
    m.box(compose(0, 0.88, -0.52, 0, 0, 0, 0.56, 0.6, 0.3), c);
    m.box(compose(0, 1.12, -0.5, 0.25, 0, 0, 0.58, 0.18, 0.32), mixRgb(c, dark, 0.25));
    m.cylinder(compose(0, 0.62, -0.6, 0, 0, Math.PI / 2, 0.14, 0.62, 0.14), "#c94f3a", 8);
  }
}

const meshCache = new Map<string, BeaverMeshes>();

export function lookKey(look: Look): string {
  return [look.fur, look.hat, look.scarf, look.backpack, look.tail, look.eyes, look.dyes?.hat, look.dyes?.scarf, look.dyes?.backpack].join("|");
}

export function getBeaverMeshes(r: Renderer, look: Look): BeaverMeshes {
  const key = lookKey(look);
  let m = meshCache.get(key);
  if (!m) {
    const up = <K extends string>(b: Record<K, MeshBuilder>) =>
      Object.fromEntries(Object.entries(b).map(([k, v]) => [k, r.upload((v as MeshBuilder).build())])) as Record<K, GpuMesh>;
    m = { parts: up(partBuilders(look)), face: up(faceBuilders(look)) };
    meshDetail.k = 0.4;
    try { m.low = { parts: up(partBuilders(look)), face: m.face }; } finally { meshDetail.k = 1; }
    meshCache.set(key, m);
  }
  return m;
}

/** Bakes a beaver into an existing static mesh (used for the plaza statue). */
export function bakeBeaver(into: MeshBuilder, look: Look, m: Mat4, material?: (x: number, y: number, z: number) => Vec3) {
  const carved = material ?? ((x: number, y: number, z: number): Vec3 => {
    // A deliberate carved-cedar monument, not a desaturated copy of a player.
    const s = 0.52 + 0.12 * Math.sin(x * 3 + y * 2 + z);
    return [s * 0.72, s * 0.43, s * 0.2];
  });
  const bake = (builder: MeshBuilder, offset: Vec3) => {
    const d = builder.build();
    const tris: number[][] = [];
    for (let i = 0; i < d.count; i += 3) {
      tris.push(Array.from(d.positions.slice(i * 3, i * 3 + 9)).map((v, k) => v + offset[k % 3]));
    }
    into.addTris(tris, m, carved);
  };
  for (const [name, builder] of Object.entries(partBuilders(look)) as [PartName, MeshBuilder][]) bake(builder, PIVOTS[name]);
  // Carved happy eyes and smile on the statue.
  const face = faceBuilders(look);
  const [hx, hy, hz] = PIVOTS.head;
  bake(face.eyesHappy, [hx, hy + EYE_Y, hz]);
  bake(face.mouthSmile, [hx, hy, hz]);
}

export interface BeaverPose {
  walk: number; // walk cycle phase
  moving: number; // 0..1 blend
  swim: number; // 0..1 blend
  jump: number; // 0..1 emote hop
  wave: number; // 0..1 arm wave
  sled: number; // 0..1 seated pose
  time: number;
  /** Facial expression (defaults to neutral, or happy while swimming). */
  expr?: Expression;
  /** Both arms up, celebrating (0..1). */
  cheer?: number;
  /** Mouth flapping while chatting (0..1). */
  talk?: number;
  /** Per-beaver offset so blinks and idle looks don't happen in unison. */
  seed?: number;
  /** Both paws held forward at the chest, e.g. cradling a mug (0..1). */
  hold?: number;
  /** Lifts the held thing to the mouth and tips the head back (0..1). */
  sip?: number;
}

/** Draws an animated beaver at a world transform. */
export function drawBeaver(r: Renderer, meshes: BeaverMeshes, root: Mat4, pose: BeaverPose, tint?: [number, number, number, number]) {
  const t = pose.time;
  const w = pose.walk;
  const mv = pose.moving;
  const seed = pose.seed ?? 0;
  // Holding something (a mug) takes priority over waving or cheering arms.
  const cheer = (pose.cheer ?? 0) * (1 - (pose.hold ?? 0));
  const expr: Expression = pose.expr ?? (pose.swim > 0.5 ? "happy" : "neutral");

  // Squash & stretch: stretch while rising, squash on take-off/landing.
  const jumpH = pose.jump;
  const stretch = 1 + jumpH * 0.14 - (jumpH > 0 && jumpH < 0.25 ? (0.25 - jumpH) * 0.5 : 0);
  const breathe = Math.sin(t * 2.2 + seed) * 0.012;
  const bob = Math.abs(Math.sin(w)) * 0.12 * mv + breathe + jumpH * 0.9 + Math.sin(t * 9) * 0.04 * cheer;
  const sway = Math.sin(w) * 0.11 * mv;
  const lean = 0.09 * mv - 0.05 * cheer;
  const swimDrop = -0.85 * pose.swim;
  const sledDrop = -0.25 * pose.sled;
  const sy = stretch * (1 + breathe);
  const sxz = 1 / Math.sqrt(Math.max(0.5, sy));
  const base = multiply(root, compose(0, bob + swimDrop + sledDrop, 0, 0, lean, sway, sxz, sy, sxz));
  // Level of detail: far-away beavers skip the ink outline and the small face details.
  const cam = r.camPos;
  const camDist = Math.hypot(root[12] - cam[0], root[13] - cam[1], root[14] - cam[2]);
  // Past the view distance the whole beaver is skipped at once, not part by part.
  if (camDist > r.drawDistance * r.autoDist + 2) return;
  const near = camDist < 32;
  if (camDist > 16 && meshes.low) meshes = meshes.low;
  // A lighter outline keeps the individual animated pieces from reading as stacked blocks.
  // Only nearby beavers cast sun shadows: far away the shadow is a few pixels nobody sees.
  const opts = { outline: near ? 0.028 : 0, tint, noCast: camDist > 24 };
  const at = (name: PartName, rx: number, ry: number, rz: number) => {
    const [px, py, pz] = PIVOTS[name];
    return multiply(base, compose(px, py, pz, ry, rx, rz));
  };

  r.draw(meshes.parts.body, at("body", 0, 0, 0), opts);

  // Head: idle look-around, nod while walking, wobble when dizzy.
  const idleLook = (Math.sin(t * 0.45 + seed * 3.1) + Math.sin(t * 0.23 + seed)) * 0.5;
  const dizzy = expr === "dizzy" ? 1 : 0;
  const headYaw = idleLook * 0.35 * (1 - mv) * (1 - pose.sled * 0.6) + Math.sin(t * 7) * 0.25 * dizzy;
  const hold = pose.hold ?? 0, sip = pose.sip ?? 0;
  const headPitch = -0.16 * sip - 0.05 * mv + Math.sin(w * 2) * 0.04 * mv + Math.sin(t * 1.3 + seed) * 0.03 - pose.sled * 0.05 - 0.12 * cheer;
  const headRoll = Math.sin(t * 5) * 0.15 * dizzy + Math.sin(t * 0.8 + seed) * 0.04 * (1 - mv);
  const head = at("head", headPitch, headYaw, headRoll);
  r.draw(meshes.parts.head, head, opts);
  // Face details sit on top without their own ink rings, so only the silhouette is outlined.
  r.draw(meshes.parts.muzzle, head, { tint });
  if (camDist < 55) drawFace(r, meshes, head, expr, t, seed, pose.talk ?? 0, idleLook, tint);

  // Arms: swing when walking, paddle when swimming, wave or cheer.
  const armSwing = Math.sin(w) * 0.7 * mv;
  const swimStroke = Math.sin(t * 6) * 1.1 * pose.swim;
  const waveL = pose.wave * (1 - hold) * (2.4 + Math.sin(t * 14) * 0.35);
  const cheerA = cheer * (2.05 + Math.sin(t * 12) * 0.22);
  // Cheering lifts both arms forward-and-out into a "V" so they clear the big head.
  // Holding: both paws come forward and wrap around the sides of a mug in front of the chest.
  const holdX = -hold * (1.3 + sip * 0.45), holdZ = hold * 0.95;
  r.draw(meshes.parts.armL, at("armL", armSwing * (1 - hold) + swimStroke - pose.sled * 0.9 - cheer * 0.5 + holdX, 0, Math.max(waveL, cheerA) - holdZ), opts);
  r.draw(meshes.parts.armR, at("armR", -armSwing * (1 - hold) - swimStroke - pose.sled * 0.9 - cheer * 0.5 + holdX, 0, -cheerA + holdZ), opts);
  r.draw(meshes.parts.footL, at("footL", -Math.sin(w) * 0.8 * mv - pose.sled * 1.2, 0, 0), opts);
  r.draw(meshes.parts.footR, at("footR", Math.sin(w) * 0.8 * mv - pose.sled * 1.2, 0, 0), opts);
  // Tail stays connected to the body: a gentle sway, a little livelier when happy.
  const wagAmt = cheer > 0 || expr === "happy" || expr === "excited" ? 0.12 : 0.06;
  r.draw(meshes.parts.tail, at("tail", -0.06 + pose.swim * 0.15, Math.sin(t * (mv > 0.1 ? 7 : 2.5) + seed) * wagAmt, 0), opts);

  // Little stars circling a dizzy head.
  if (dizzy) {
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i / 3) * Math.PI * 2;
      r.draw(meshes.face.star, multiply(head, compose(Math.cos(a) * 0.55, 1.15, Math.sin(a) * 0.45, a * 2)), { unlit: true });
    }
  }
}

function drawFace(
  r: Renderer, m: BeaverMeshes, head: Mat4, expr: Expression,
  t: number, seed: number, talk: number, _look: number, tint?: [number, number, number, number],
) {
  const flat = { tint };
  // Blink every few seconds (sometimes twice), never in sync with other beavers.
  const phase = ((t + seed * 7.31) % 3.9) / 3.9;
  const blink = phase < 0.035 || (seed % 2 > 1 && phase > 0.06 && phase < 0.085) ? 0.12 : 1;

  const eyesAt = (scaleY: number, scale = 1) => multiply(head, compose(0, EYE_Y, 0, 0, 0, 0, scale, scaleY * scale, 1));
  if (expr === "happy" || expr === "excited") {
    r.draw(m.face.eyesHappy, eyesAt(1), flat);
  } else if (expr === "dizzy") {
    r.draw(m.face.eyesDizzy, eyesAt(1), flat);
  } else {
    const big = expr === "surprised" ? 1.15 : 1;
    const squint = expr === "determined" ? 0.72 : 1;
    r.draw(m.face.eyes, eyesAt(blink * squint, big), flat);
    if (blink > 0.5) r.draw(m.face.pupils, eyesAt(squint, big), flat);
  }

  // Brows: raise, lower and tilt per expression.
  const browPose: Record<Expression, [number, number]> = {
    neutral: [-0.015, 0.06],
    happy: [0.02, -0.05],
    excited: [0.04, -0.08],
    surprised: [0.085, 0],
    dizzy: [0.02, -0.32],
    determined: [-0.03, 0.35],
  };
  const [raise, tilt] = browPose[expr];
  const showBrows = true;
  for (const [part, s] of showBrows ? ([["browL", 1], ["browR", -1]] as const) : []) {
    const x = EYE_X * s;
    const y = EYE_Y + 0.12 + raise;
    r.draw(m.face[part], multiply(head, compose(x, y, surf(EYE_X, EYE_Y + 0.12) + 0.004, 0, -0.25, tilt * s)), flat);
  }

  // Mouth: open when excited/surprised/dizzy or while talking, otherwise a little smile.
  const talking = talk > 0 && Math.sin(t * 18) > 0;
  const open = expr === "excited" || expr === "surprised" || talking ? 1 : expr === "dizzy" ? 0.6 : 0;
  if (open > 0) {
    const o = (expr === "surprised" ? 0.85 : open) * 0.8;
    r.draw(m.face.mouthOpen, multiply(head, compose(0, 0.13, 0, 0, 0, 0, o, o, 1)), flat);
  } else {
    r.draw(m.face.mouthSmile, multiply(head, compose(0, 0, 0)), flat);
  }
}

/** Emote index (see shared EMOTES) → expression and body action. */
export function emoteReaction(i: number): { expr: Expression; wave?: boolean; cheer?: boolean; hop?: boolean } {
  switch (i) {
    case 0: return { expr: "happy", wave: true };
    case 1: return { expr: "happy", hop: true };
    case 2: return { expr: "happy" };
    case 3: return { expr: "excited", cheer: true, hop: true };
    case 4: return { expr: "surprised", hop: true };
    case 5: return { expr: "happy", hop: true };
    case 6: return { expr: "neutral", hop: true };
    case 7: return { expr: "excited" };
    default: return { expr: "happy" };
  }
}
