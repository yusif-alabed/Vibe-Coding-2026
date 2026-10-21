import { TOWN_AREAS, TOWN_BUILDINGS, type TownBuilding } from "@beaver/shared";
import { compose, hash2, hexToRgb, mixRgb, type Vec3 } from "../../engine/math";
import { MeshBuilder } from "../../engine/mesh";
import { box, chimney, flowerBox, Frame, gableRoofX, gableRoofZ, log, panel, windowPane } from "./architecture";
import { stoneBlock } from "./nature";

/**
 * The town around the village: shops on Main Street, a clock-tower town hall, cottages, and a few
 * one-of-a-kind landmarks (windmill, watermill, lighthouse, fire lookout, observatory, greenhouse,
 * Ferris wheel). Same chunky storybook style as the lodge: stone plinths, timber, slate and glowing
 * windows, with pastel painted walls so the street reads as a cheerful little town.
 *
 * Moving parts (windmill sails, mill wheel, lighthouse beam, Ferris wheel) are returned as separate
 * meshes with a pivot, so the scene can spin them every frame.
 */

const C = (h: string) => hexToRgb(h);
const STONE = C("#a0978a"), STONE_LIGHT = C("#c2b8a6"), STONE_DARK = C("#736c64");
const TIMBER = C("#5b3a24"), TIMBER_LIGHT = C("#8a5a34"), LOG = C("#9b6338"), LOG_LIGHT = C("#b9804c");
const CREAM = C("#f6ead2"), WHITE = C("#fbf7ee"), IRON = C("#2e2b2a"), GOLD = C("#e8b84a");
const GLASS = C("#ffd08a");

export interface SpinPart {
  mesh: MeshBuilder;
  /** Pivot in world space. */
  x: number; y: number; z: number;
  /** Yaw of the part's frame. */
  ry: number;
  /** Radians per second around the frame's local z axis (wheels) or y axis ("y"). */
  speed: number;
  axis: "z" | "y";
  /** lit = normal shading, glow = unlit lights, beam = unlit and see-through. */
  mode: "lit" | "glow" | "beam";
}

export interface FerrisInfo { x: number; y: number; z: number; ry: number; radius: number; seats: number; speed: number }

export interface TownMeshes {
  body: MeshBuilder;
  glow: MeshBuilder;
  glass: MeshBuilder;
  ice: MeshBuilder;
  spins: SpinPart[];
  gondola: MeshBuilder;
  ferris: FerrisInfo | null;
  /** Spots where little bonfires burn (campground, square braziers). */
  fires: Vec3[];
  /** Chimney tops, for smoke. */
  chimneys: Vec3[];
}

const vary = (c: Vec3, seed: number, amt = 0.1): Vec3 => {
  const k = 1 - amt + hash2(seed, 0.77) * amt * 2;
  return [c[0] * k, c[1] * k, c[2] * k];
};

/** Stone plinth with a row of dressed stones on the front. */
function plinth(m: MeshBuilder, f: Frame, w: number, d: number, h: number, seed: number) {
  box(m, f, 0, h / 2 - 0.5, 0, w + 0.4, h + 1, d + 0.4, STONE_DARK);
  const n = Math.ceil(w / 0.7);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.35 + i * (w / n);
    box(m, f, x, h / 2, d / 2 + 0.22, w / n - 0.06, h - 0.08, 0.1, vary(mixRgb(STONE, STONE_LIGHT, hash2(i, seed)), i + seed, 0.1));
  }
}

/** Timber-frame wall with diagonal braces on a face at local z (front = +). */
function timberFrame(m: MeshBuilder, f: Frame, w: number, y0: number, y1: number, z: number, seed: number) {
  const n = Math.max(2, Math.round(w / 1.8));
  for (let i = 0; i <= n; i++) box(m, f, -w / 2 + (w * i) / n, (y0 + y1) / 2, z, 0.18, y1 - y0, 0.1, TIMBER);
  box(m, f, 0, y0 + 0.05, z, w + 0.1, 0.18, 0.12, TIMBER);
  box(m, f, 0, y1 - 0.05, z, w + 0.1, 0.18, 0.12, TIMBER);
  for (let i = 0; i < n; i++) {
    if (hash2(i, seed) < 0.5) continue;
    const x0 = -w / 2 + (w * i) / n, x1 = -w / 2 + (w * (i + 1)) / n;
    const len = Math.hypot(x1 - x0, y1 - y0);
    box(m, f, (x0 + x1) / 2, (y0 + y1) / 2, z, len, 0.14, 0.08, TIMBER, 0, 0, Math.atan2(y1 - y0, x1 - x0) * (i % 2 ? 1 : -1));
  }
}

/** A striped fabric awning over the shop window. */
function awning(m: MeshBuilder, f: Frame, w: number, y: number, z: number, a: Vec3, b: Vec3) {
  const stripes = Math.max(4, Math.round(w / 0.45));
  for (let i = 0; i < stripes; i++) {
    const x = -w / 2 + (w * (i + 0.5)) / stripes;
    box(m, f, x, y - 0.35, z + 0.7, w / stripes + 0.01, 0.06, 1.55, i % 2 ? a : b, 0, 0.5, 0);
    // Scalloped valance.
    m.sphere(f.m(x, y - 0.75, z + 1.38, w / stripes / 2, 0.16, 0.05), i % 2 ? a : b, 3, 6);
  }
  for (const s of [-1, 1]) box(m, f, s * (w / 2 - 0.05), y - 0.4, z + 0.75, 0.05, 0.05, 1.5, IRON, 0, 0.5, 0);
}

/** Hanging sign on an iron bracket, with a little 3D icon on top. */
function hangingSign(m: MeshBuilder, f: Frame, x: number, y: number, z: number, board: Vec3, icon: (fr: Frame) => void) {
  box(m, f, x, y + 0.75, z + 0.55, 0.06, 0.06, 1.1, IRON);
  box(m, f, x, y + 0.45, z + 0.95, 0.04, 0.55, 0.04, IRON);
  box(m, f, x, y - 0.05, z + 0.95, 0.08, 0.75, 1.05, board);
  box(m, f, x, y - 0.05, z + 0.95, 0.1, 0.6, 0.9, mixRgb(board, WHITE, 0.55));
  const p = f.p(x, y - 0.05, z + 0.95);
  icon(new Frame(p[0], p[1], p[2], f.ry + Math.PI / 2));
}

/** Shopfront window: a big glowing pane split by mullions, with a timber surround. */
function shopWindow(m: MeshBuilder, glow: MeshBuilder, f: Frame, x: number, y: number, z: number, w: number, h: number) {
  box(m, f, x, y, z, w + 0.3, h + 0.3, 0.16, TIMBER);
  glow.box(f.m(x, y, z + 0.09, w, h, 0.04), mixRgb(GLASS, C("#fff1cf"), 0.35));
  for (let i = 1; i < 3; i++) box(m, f, x - w / 2 + (w * i) / 3, y, z + 0.13, 0.06, h, 0.05, TIMBER);
  box(m, f, x, y + h * 0.22, z + 0.13, w, 0.06, 0.05, TIMBER);
  box(m, f, x, y - h / 2 - 0.2, z + 0.2, w + 0.5, 0.12, 0.4, TIMBER_LIGHT);
}

function door(m: MeshBuilder, glow: MeshBuilder, f: Frame, x: number, y: number, z: number, col: Vec3) {
  box(m, f, x, y + 1.1, z, 1.4, 2.35, 0.16, TIMBER);
  box(m, f, x, y + 1.05, z + 0.06, 1.1, 2.1, 0.1, col);
  glow.box(f.m(x, y + 1.65, z + 0.12, 0.6, 0.5, 0.03), GLASS);
  m.sphere(f.m(x + 0.38, y + 1.0, z + 0.15, 0.06, 0.06, 0.06), GOLD, 3, 5);
  box(m, f, x, y - 0.02, z + 0.45, 1.6, 0.14, 0.7, STONE_LIGHT);
}

interface ShopOpts {
  wall: Vec3;
  upper?: Vec3;
  awning?: [Vec3, Vec3];
  roof?: Vec3;
  sign: Vec3;
  icon: (m: MeshBuilder, fr: Frame) => void;
  storeys: 1 | 2;
  doorCol: Vec3;
}

/** A Main Street shop: stone plinth, painted ground floor with a big window, timber-framed upper floor. */
function shop(t: TownMeshes, f: Frame, b: TownBuilding, o: ShopOpts) {
  const { body: m, glow } = t;
  const w = b.w, d = b.d, base = 0.5, g1 = 3.3, g2 = o.storeys === 2 ? 6.0 : g1;
  plinth(m, f, w, d, base, b.seed);
  box(m, f, 0, (base + g1) / 2, 0, w, g1 - base, d, o.wall);
  for (const s of [-1, 1]) box(m, f, s * (w / 2 - 0.1), (base + g1) / 2, d / 2 - 0.1, 0.32, g1 - base, 0.32, TIMBER);
  shopWindow(m, glow, f, -w * 0.18, base + 1.45, d / 2 + 0.02, w * 0.42, 1.6);
  door(m, glow, f, w * 0.27, base, d / 2 + 0.02, o.doorCol);
  box(m, f, 0, g1 + 0.05, d / 2 + 0.1, w + 0.2, 0.25, 0.3, TIMBER);
  if (o.storeys === 2) {
    // Jettied upper storey.
    box(m, f, 0, (g1 + g2) / 2 + 0.1, 0.15, w + 0.2, g2 - g1, d + 0.3, o.upper ?? mixRgb(o.wall, WHITE, 0.4));
    timberFrame(m, f, w + 0.2, g1 + 0.1, g2 + 0.1, d / 2 + 0.31, b.seed);
    for (const s of [-1, 1]) {
      windowPane(m, glow, f, s * w * 0.26, g1 + 1.4, d / 2 + 0.32, 0.9, 1.1);
      flowerBox(m, f, s * w * 0.26, g1 + 0.62, d / 2 + 0.55, 1.2, b.seed + s);
      windowPane(m, glow, f, s * (w / 2 + 0.12), g1 + 1.4, 0, 0.9, 1.0, (s * Math.PI) / 2);
    }
  }
  for (const s of [-1, 1]) windowPane(m, glow, f, s * (w / 2 + 0.02), base + 1.5, -d * 0.1, 0.9, 1.0, (s * Math.PI) / 2);
  if (o.awning) awning(m, f, w * 0.55, g1 - 0.25, d / 2 - 0.02, o.awning[0], o.awning[1]);
  // Roof: ridge runs along the street.
  const eave = g2 + 0.15;
  const ridge = gableRoofX(m, f, 0, eave, d / 2 + 0.15, w + 0.9, 0.62, 0.55);
  // Gable ends filled with boards.
  for (const s of [-1, 1]) {
    const x = s * (w / 2 + 0.11);
    panel(m, f, [[x, eave, -d / 2 - 0.1], [x, eave, d / 2 + 0.4], [x, ridge, 0.15]], [s, 0, 0], mixRgb(o.wall, TIMBER_LIGHT, 0.5));
  }
  // Little dormer window in the roof.
  {
    const dz = d / 4 + 0.2, dy = eave + (ridge - eave) * 0.35;
    box(m, f, 0, dy + 0.4, dz, 1.4, 1.2, 1.3, mixRgb(o.wall, WHITE, 0.3));
    windowPane(m, glow, f, 0, dy + 0.45, dz + 0.66, 0.7, 0.7);
    gableRoofZ(m, f, 0, dz - 0.7, dz + 0.85, dy + 1.0, 0.75, 0.75, 0.2);
  }
  const cx = -w / 2 + 1.0, cz = -d / 4;
  chimney(m, f, cx, cz, base, ridge + 0.8, 0.8, b.seed);
  t.chimneys.push(f.p(cx, ridge + 1.4, cz));
  hangingSign(m, f, w / 2 + 0.1, g1 - 0.55, d / 2 - 0.15, o.sign, (fr) => o.icon(m, fr));
  // A bench or barrels out front.
  const bf = new Frame(...f.p(-w * 0.18, base, d / 2 + 1.25), f.ry);
  box(m, bf, 0, 0.45, 0, 1.8, 0.1, 0.5, LOG_LIGHT);
  for (const s of [-0.7, 0.7]) box(m, bf, s, 0.22, 0, 0.12, 0.44, 0.44, TIMBER);
}

// ------------------------------------------------------------------ Shop icons (on the signs)

const icons = {
  bread(m: MeshBuilder, fr: Frame) {
    m.sphere(fr.m(0, 0.55, 0, 0.42, 0.2, 0.22), C("#d9934a"), 5, 8);
    for (const x of [-0.18, 0, 0.18]) box(m, fr, x, 0.7, 0, 0.05, 0.03, 0.2, C("#f3d29a"), 0, 0, 0.4);
  },
  envelope(m: MeshBuilder, fr: Frame) {
    box(m, fr, 0, 0.6, 0, 0.7, 0.45, 0.06, WHITE);
    m.cone(fr.m(0, 0.72, 0.04, 0.7, 0.32, 0.02, 0, 0, Math.PI), C("#d14b3c"), 3);
  },
  apple(m: MeshBuilder, fr: Frame) {
    m.sphere(fr.m(0, 0.6, 0, 0.26, 0.26, 0.26), C("#d9483b"), 5, 8);
    box(m, fr, 0.05, 0.9, 0, 0.12, 0.05, 0.05, C("#4f8a3a"), 0, 0, 0.5);
  },
  flower(m: MeshBuilder, fr: Frame) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      m.sphere(fr.m(Math.cos(a) * 0.17, 0.62 + Math.sin(a) * 0.17, 0, 0.12, 0.12, 0.05), C("#ff7eb3"), 3, 6);
    }
    m.sphere(fr.m(0, 0.62, 0.03, 0.1, 0.1, 0.05), C("#ffd93b"), 3, 6);
  },
  cone(m: MeshBuilder, fr: Frame) {
    m.cone(fr.m(0, 0.5, 0, 0.3, 0.5, 0.3, 0, 0, Math.PI), C("#d9a25a"), 8);
    m.sphere(fr.m(0, 0.83, 0, 0.2, 0.2, 0.2), C("#ffb3c7"), 5, 8);
  },
  toy(m: MeshBuilder, fr: Frame) {
    m.cone(fr.m(0, 0.55, 0, 0.5, 0.3, 0.5, 0, 0, Math.PI), C("#3a8fd6"), 8);
    m.cone(fr.m(0, 0.78, 0, 0.5, 0.18, 0.5), C("#f5c242"), 8);
    box(m, fr, 0, 0.95, 0, 0.05, 0.2, 0.05, C("#e2483d"));
  },
  book(m: MeshBuilder, fr: Frame) {
    box(m, fr, -0.18, 0.62, 0, 0.36, 0.48, 0.06, C("#2f6f8a"), 0, 0, 0.12);
    box(m, fr, 0.18, 0.62, 0, 0.36, 0.48, 0.06, C("#2f6f8a"), 0, 0, -0.12);
    box(m, fr, 0, 0.62, 0.04, 0.62, 0.4, 0.04, WHITE);
  },
  leaf(m: MeshBuilder, fr: Frame) {
    m.cone(fr.m(0, 0.72, 0, 0.55, 0.36, 0.04), C("#d33b2c"), 3);
    m.cone(fr.m(-0.2, 0.62, 0, 0.36, 0.3, 0.04, 0, 0, 0.9), C("#d33b2c"), 3);
    m.cone(fr.m(0.2, 0.62, 0, 0.36, 0.3, 0.04, 0, 0, -0.9), C("#d33b2c"), 3);
    box(m, fr, 0, 0.42, 0, 0.04, 0.22, 0.04, C("#8a2a20"));
  },
};

// ------------------------------------------------------------------ Unique buildings

function townHall(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const w = b.w, d = b.d, base = 0.9, g1 = 4.2, g2 = 7.6;
  plinth(m, f, w, d, base, b.seed);
  // Wide front steps.
  for (let i = 0; i < 3; i++) box(m, f, 0, base - 0.2 - i * 0.3, d / 2 + 0.6 + i * 0.45, w * 0.5 + i * 0.6, 0.3, 0.5, STONE_LIGHT);
  // Dressed stone walls.
  box(m, f, 0, (base + g2) / 2, 0, w, g2 - base, d, C("#d8cdb8"));
  for (let r = 0; r < 14; r++) {
    const y = base + 0.25 + r * 0.48;
    if (y > g2 - 0.2) break;
    for (const s of [-1, 1]) box(m, f, s * (w / 2 + 0.03), y, d / 2 - 0.4, 0.12, 0.42, 0.8 + (r % 2) * 0.3, STONE_LIGHT);
  }
  box(m, f, 0, g1, d / 2 + 0.08, w + 0.2, 0.25, 0.25, STONE_LIGHT);
  // Columns and arched windows.
  for (let i = 0; i < 4; i++) {
    const x = -w / 2 + 1.4 + i * ((w - 2.8) / 3);
    m.cylinder(f.m(x, (base + g1) / 2, d / 2 + 0.6, 0.55, g1 - base, 0.55), WHITE, 10);
    box(m, f, x, g1 - 0.1, d / 2 + 0.6, 0.8, 0.2, 0.8, STONE_LIGHT);
  }
  box(m, f, 0, g1 + 0.2, d / 2 + 0.55, w * 0.8, 0.35, 1.3, STONE_LIGHT);
  for (const x of [-w * 0.33, w * 0.33]) windowPane(m, glow, f, x, base + 1.8, d / 2 + 0.02, 1.1, 1.6, 0, true);
  door(m, glow, f, 0, base, d / 2 + 0.02, C("#2f5a7a"));
  for (const x of [-w * 0.33, 0, w * 0.33]) windowPane(m, glow, f, x, g1 + 1.6, d / 2 + 0.02, 1.0, 1.4, 0, true);
  for (const s of [-1, 1]) for (const z of [-d * 0.25, d * 0.15]) windowPane(m, glow, f, s * (w / 2 + 0.02), base + 1.8, z, 1.0, 1.4, (s * Math.PI) / 2, true);
  // Flag banners hanging between the columns.
  for (const s of [-1, 1]) {
    box(m, f, s * w * 0.18, g1 - 1.3, d / 2 + 0.75, 0.9, 2.0, 0.05, C("#c8473a"));
    m.cone(f.m(s * w * 0.18, g1 - 2.45, d / 2 + 0.75, 0.9, 0.4, 0.05, 0, 0, Math.PI), C("#c8473a"), 3);
    m.sphere(f.m(s * w * 0.18, g1 - 1.0, d / 2 + 0.8, 0.18, 0.18, 0.04), GOLD, 4, 6);
  }
  const ridge = gableRoofX(m, f, 0, g2 + 0.1, d / 2 + 0.1, w + 0.8, 0.5, 0.5);
  // Clock tower.
  const tw = 3.2, tTop = ridge + 5.5;
  box(m, f, 0, (g2 + tTop) / 2, 0.4, tw, tTop - g2, tw, C("#d8cdb8"));
  for (const y of [ridge + 0.3, tTop - 0.15]) box(m, f, 0, y, 0.4, tw + 0.3, 0.3, tw + 0.3, STONE_LIGHT);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const cf = new Frame(...f.p(Math.sin(a) * (tw / 2 + 0.05), 0, 0.4 + Math.cos(a) * (tw / 2 + 0.05)), f.ry + a);
    const cy = ridge + 2.4;
    m.cylinder(cf.m(0, cy, 0.02, 2.3, 0.12, 2.3, 0, Math.PI / 2, 0), GOLD, 20);
    glow.cylinder(cf.m(0, cy, 0.08, 2.0, 0.06, 2.0, 0, Math.PI / 2, 0), C("#fff8e6"), 20);
    for (let h = 0; h < 12; h++) {
      const ha = (h / 12) * Math.PI * 2;
      box(m, cf, Math.sin(ha) * 0.82, cy + Math.cos(ha) * 0.82, 0.13, 0.08, 0.16, 0.03, IRON, 0, 0, -ha);
    }
    // Hands at ten past ten.
    box(m, cf, -0.22, cy + 0.12, 0.15, 0.06, 0.5, 0.03, IRON, 0, 0, 1.05);
    box(m, cf, 0.18, cy + 0.3, 0.16, 0.05, 0.72, 0.03, IRON, 0, 0, -0.55);
    // Belfry arches.
    glow.box(cf.m(0, tTop + 1.0, 0.0, 1.2, 1.4, 0.04), C("#ffe2a0"));
  }
  box(m, f, 0, tTop + 1.0, 0.4, tw - 0.4, 2.0, tw - 0.4, C("#d8cdb8"));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(m, f, sx * (tw / 2 - 0.2), tTop + 1.0, 0.4 + sz * (tw / 2 - 0.2), 0.4, 2.0, 0.4, STONE_LIGHT);
  m.cone(f.m(0, tTop + 3.6, 0.4, tw * 1.35, 3.2, tw * 1.35, Math.PI / 4), C("#3f6b5a"), 4);
  box(m, f, 0, tTop + 5.8, 0.4, 0.08, 1.6, 0.08, IRON);
  box(m, f, 0.45, tTop + 6.3, 0.4, 0.8, 0.5, 0.04, C("#c8473a"));
  m.sphere(f.m(0, tTop + 6.65, 0.4, 0.12, 0.12, 0.12), GOLD, 3, 5);
}

function library(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const w = b.w, d = b.d, base = 0.8, g1 = 5.6;
  plinth(m, f, w, d, base, b.seed);
  for (let i = 0; i < 3; i++) box(m, f, 0, base - 0.2 - i * 0.28, d / 2 + 0.5 + i * 0.42, w * 0.45 + i * 0.5, 0.28, 0.46, STONE_LIGHT);
  box(m, f, 0, (base + g1) / 2, 0, w, g1 - base, d, C("#c9b79b"));
  // Portico: columns and a triangular pediment.
  for (let i = 0; i < 4; i++) {
    const x = -2.4 + i * 1.6;
    m.cylinder(f.m(x, (base + g1) / 2, d / 2 + 1.3, 0.5, g1 - base, 0.5), WHITE, 10);
  }
  box(m, f, 0, g1 + 0.15, d / 2 + 0.9, 6.0, 0.35, 2.2, STONE_LIGHT);
  panel(m, f, [[-3.2, g1 + 0.32, d / 2 + 2.0], [3.2, g1 + 0.32, d / 2 + 2.0], [0, g1 + 2.0, d / 2 + 2.0]], [0, 0, 1], WHITE);
  m.cylinder(f.m(0, g1 + 1.0, d / 2 + 2.02, 0.7, 0.05, 0.7, 0, Math.PI / 2, 0), GOLD, 12);
  for (const s of [-1, 1]) windowPane(m, glow, f, s * (w * 0.38), base + 2.2, d / 2 + 0.02, 1.2, 2.4, 0, true);
  door(m, glow, f, 0, base, d / 2 + 0.02, C("#7a2f2a"));
  for (const s of [-1, 1]) for (const z of [-2.2, 1.2]) windowPane(m, glow, f, s * (w / 2 + 0.02), base + 2.2, z, 1.1, 2.4, (s * Math.PI) / 2, true);
  // Low hipped roof with a small reading-room dome.
  const ridge = gableRoofX(m, f, 0, g1 + 0.1, d / 2 + 0.05, w + 0.6, 0.38, 0.45);
  m.cylinder(f.m(0, ridge + 0.6, 0, 3.2, 1.2, 3.2), C("#c9b79b"), 16);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    glow.box(f.m(Math.sin(a) * 1.6, ridge + 0.65, Math.cos(a) * 1.6, 0.5, 0.6, 0.05, a), GLASS);
  }
  m.sphere(f.m(0, ridge + 1.2, 0, 1.7, 1.3, 1.7), C("#5b8f86"), 8, 16);
  m.sphere(f.m(0, ridge + 2.6, 0, 0.2, 0.2, 0.2), GOLD, 4, 6);
  // Stack of books by the door.
  for (let i = 0; i < 4; i++) box(m, f, 2.0, base + 0.12 + i * 0.16, d / 2 + 0.6, 0.7 - i * 0.05, 0.14, 0.5, [C("#2f6f8a"), C("#c8473a"), C("#e7b13d"), C("#6aa84f")][i], i * 0.2);
}

function cottage(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const w = b.w, d = b.d, base = 0.5, eave = 3.2;
  const walls = [C("#f3e3c3"), C("#a9c3a0"), C("#f2d27a"), C("#a8c8e0"), C("#e7b0a4"), C("#b8e0cf")];
  const roofs = [C("#4b505b"), C("#8a3b2e"), C("#3f6b5a"), C("#5b4a6b")];
  const wall = walls[b.seed % walls.length];
  plinth(m, f, w, d, base, b.seed);
  box(m, f, 0, (base + eave) / 2, 0, w, eave - base, d, wall);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(m, f, sx * (w / 2 - 0.08), (base + eave) / 2, sz * (d / 2 - 0.08), 0.26, eave - base, 0.26, TIMBER);
  door(m, glow, f, 0, base, d / 2 + 0.02, roofs[(b.seed + 1) % roofs.length]);
  for (const s of [-1, 1]) {
    windowPane(m, glow, f, s * w * 0.3, base + 1.5, d / 2 + 0.02, 1.0, 1.0);
    flowerBox(m, f, s * w * 0.3, base + 0.75, d / 2 + 0.28, 1.25, b.seed + s);
    windowPane(m, glow, f, s * (w / 2 + 0.02), base + 1.5, 0, 0.9, 0.9, (s * Math.PI) / 2);
    // Shutters.
    for (const k of [-1, 1]) box(m, f, s * w * 0.3 + k * 0.72, base + 1.5, d / 2 + 0.1, 0.36, 1.15, 0.06, mixRgb(roofs[b.seed % roofs.length], WHITE, 0.25));
  }
  // Steep gable roof facing the lane, with coloured slate.
  const z0 = -d / 2 - 0.5, z1 = d / 2 + 0.7;
  const ridge = gableRoofZ(m, f, 0, z0, z1, eave, w / 2, 0.78, 0.5);
  panel(m, f, [[-w / 2, eave, d / 2 + 0.01], [w / 2, eave, d / 2 + 0.01], [0, ridge, d / 2 + 0.01]], [0, 0, 1], mixRgb(wall, WHITE, 0.3));
  panel(m, f, [[-w / 2, eave, -d / 2 - 0.01], [w / 2, eave, -d / 2 - 0.01], [0, ridge, -d / 2 - 0.01]], [0, 0, -1], mixRgb(wall, WHITE, 0.3));
  windowPane(m, glow, f, 0, eave + 1.0, d / 2 + 0.02, 0.8, 0.8, 0, true);
  // Tint the roof slates by repainting a thin cap over them.
  box(m, f, 0, ridge + 0.38, (z0 + z1) / 2, 0.42, 0.24, z1 - z0 + 0.2, roofs[b.seed % roofs.length]);
  const cx = w / 2 - 1.0, cz = -d / 4;
  chimney(m, f, cx, cz, base, ridge + 0.6, 0.75, b.seed);
  t.chimneys.push(f.p(cx, ridge + 1.2, cz));
  // Front garden: picket fence, a path and a mailbox.
  const gz = d / 2 + 2.6;
  for (let i = 0; i <= 14; i++) {
    const x = -w / 2 - 0.2 + (i * (w + 0.4)) / 14;
    if (Math.abs(x) < 0.8) continue;
    box(m, f, x, 0.42, gz, 0.12, 0.84, 0.06, WHITE);
    m.cone(f.m(x, 0.92, gz, 0.12, 0.16, 0.06, 0, 0, 0), WHITE, 4);
  }
  for (const y of [0.3, 0.65]) for (const s of [-1, 1]) box(m, f, s * (w / 4 + 0.4), y, gz - 0.05, w / 2 - 0.4, 0.07, 0.04, WHITE);
  box(m, f, 0, 0.03, d / 2 + 1.5, 1.0, 0.06, 2.4, STONE_LIGHT);
  box(m, f, w / 2 - 0.6, 0.6, gz + 0.5, 0.08, 1.2, 0.08, TIMBER);
  box(m, f, w / 2 - 0.6, 1.25, gz + 0.5, 0.36, 0.3, 0.55, roofs[(b.seed + 2) % roofs.length]);
  box(m, f, w / 2 - 0.4, 1.4, gz + 0.6, 0.04, 0.24, 0.12, C("#e2483d"));
  for (let k = 0; k < 6; k++) {
    const x = -w / 2 + 0.6 + hash2(k, b.seed) * (w * 0.35), z = d / 2 + 0.8 + hash2(b.seed, k) * 1.4;
    m.sphere(f.m(x, 0.3, z, 0.35, 0.3, 0.35), C("#4f7f3a"), 4, 6);
    m.sphere(f.m(x, 0.55, z + 0.1, 0.1, 0.1, 0.1), [C("#ff7eb3"), C("#ffd93b"), C("#a77bff")][k % 3], 3, 5);
  }
}

function bandstand(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const r = b.w / 2;
  m.cylinder(f.m(0, 0.35, 0, r * 2, 0.7, r * 2), STONE_LIGHT, 8);
  m.cylinder(f.m(0, 0.74, 0, r * 2 - 0.2, 0.1, r * 2 - 0.2), LOG_LIGHT, 8);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.cos(a) * (r - 0.35), z = Math.sin(a) * (r - 0.35);
    m.cylinder(f.m(x, 2.2, z, 0.26, 3.0, 0.26), WHITE, 8);
    // Railing between posts (open toward the street).
    if (i % 4 !== 0) {
      const a1 = ((i + 1) / 8) * Math.PI * 2 + Math.PI / 8;
      const x1 = Math.cos(a1) * (r - 0.35), z1 = Math.sin(a1) * (r - 0.35);
      const len = Math.hypot(x1 - x, z1 - z);
      const p = f.p((x + x1) / 2, 0, (z + z1) / 2);
      m.box(compose(p[0], f.y + 1.6, p[2], f.ry + Math.atan2(x1 - x, z1 - z), 0, 0, 0.1, 0.1, len), WHITE);
      for (let k = 1; k < 5; k++) {
        const q = f.p(x + ((x1 - x) * k) / 5, 0, z + ((z1 - z) * k) / 5);
        m.box(compose(q[0], f.y + 1.2, q[2], 0, 0, 0, 0.06, 0.8, 0.06), WHITE);
      }
    }
  }
  // Striped conical roof with a weathervane.
  const [rx, ry, rz] = f.p(0, 3.85, 0);
  m.cone(compose(rx, ry + 0.9, rz, f.ry + Math.PI / 8, 0, 0, r * 2 + 0.9, 1.9, r * 2 + 0.9), (x, _y, z) => {
    const a = Math.atan2(z - rz, x - rx);
    return Math.floor(((a + Math.PI) / (Math.PI * 2)) * 16) % 2 ? C("#c8473a") : WHITE;
  }, 16);
  m.cylinder(compose(rx, ry - 0.05, rz, 0, 0, 0, r * 2 + 0.5, 0.2, r * 2 + 0.5), C("#c8473a"), 16);
  box(m, f, 0, 6.0, 0, 0.06, 0.9, 0.06, IRON);
  m.cone(f.m(0.2, 6.35, 0, 0.5, 0.2, 0.25, 0, 0, Math.PI / 2), GOLD, 4);
  // Bunting and string lights around the rim.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const x = Math.cos(a) * (r + 0.3), z = Math.sin(a) * (r + 0.3);
    glow.sphere(f.m(x, 3.65 - Math.abs(Math.sin(i * 1.3)) * 0.05, z, 0.1, 0.1, 0.1), [C("#ffd166"), C("#ff6fb5"), C("#7ff3f0"), C("#b6ff8a")][i % 4], 3, 4);
  }
  // Music stands and a big drum.
  m.cylinder(f.m(0, 1.2, -0.8, 0.9, 0.7, 0.9, 0, Math.PI / 2, 0), C("#c8473a"), 12);
  m.cylinder(f.m(0, 1.2, -0.8, 0.8, 0.72, 0.8, 0, Math.PI / 2, 0), WHITE, 12);
  for (const s of [-1.2, 1.2]) {
    box(m, f, s, 1.35, 0.6, 0.05, 1.2, 0.05, IRON);
    box(m, f, s, 1.95, 0.62, 0.5, 0.35, 0.04, IRON, 0, -0.3, 0);
  }
}

function stall(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m } = t;
  const canopies: [Vec3, Vec3][] = [[C("#c8473a"), WHITE], [C("#2f7fb0"), WHITE], [C("#3f8a5a"), C("#f5e6c0")], [C("#e7b13d"), WHITE]];
  const [ca, cb] = canopies[b.seed % canopies.length];
  const w = b.w, d = b.d;
  box(m, f, 0, 0.5, 0, w, 1.0, d * 0.6, LOG_LIGHT);
  box(m, f, 0, 1.03, 0.1, w + 0.1, 0.08, d * 0.75, LOG);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(m, f, sx * (w / 2 - 0.05), 1.2, sz * (d / 2 - 0.1), 0.1, 2.4, 0.1, TIMBER);
  const n = 6;
  for (let i = 0; i < n; i++) box(m, f, -w / 2 + (w * (i + 0.5)) / n, 2.45, 0.1, w / n + 0.01, 0.06, d + 0.6, i % 2 ? ca : cb, 0, 0.25, 0);
  // Produce: pumpkins, apples, jars, loaves.
  const goods = [C("#e7792c"), C("#d9483b"), C("#f5c242"), C("#7fb069"), C("#c98a4a")];
  for (let i = 0; i < 7; i++) {
    const x = -w / 2 + 0.3 + i * ((w - 0.6) / 6);
    m.sphere(f.m(x, 1.18, 0.15 + (i % 2) * 0.2, 0.15, 0.13, 0.15), goods[(i + b.seed) % goods.length], 4, 6);
  }
  for (let i = 0; i < 3; i++) box(m, f, -w / 2 + 0.5 + i * 0.8, 0.25, d / 2 + 0.35, 0.6, 0.5, 0.5, TIMBER_LIGHT);
  box(m, f, 0, 2.8, d / 2 + 0.25, 1.2, 0.35, 0.05, WHITE);
}

function windmill(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const h = 9.5;
  m.cylinder(f.m(0, h / 2, 0, 6.2, h, 6.2), C("#e9dfcc"), 12, 0.36, 0.5);
  for (let r = 0; r < 12; r++) {
    const y = 0.4 + r * 0.8;
    m.cylinder(f.m(0, y, 0, 6.3 - r * 0.2, 0.08, 6.3 - r * 0.2), C("#cfc3ad"), 12);
  }
  door(m, glow, f, 0, 0, 2.95, C("#3f6b5a"));
  windowPane(m, glow, f, 0, 4.5, 2.62, 0.8, 1.0, 0, true);
  windowPane(m, glow, f, 0, 7.2, 2.35, 0.7, 0.9, 0, true);
  // Balcony and cap.
  m.cylinder(f.m(0, h - 0.6, 0, 5.4, 0.18, 5.4), TIMBER_LIGHT, 12);
  m.cone(f.m(0, h + 1.2, 0, 5.0, 3.2, 5.0), C("#8a3b2e"), 12);
  m.sphere(f.m(0, h + 2.9, 0, 0.25, 0.25, 0.25), GOLD, 4, 6);
  // Sails (spinning part).
  const sails = new MeshBuilder();
  const SC = C("#f3ead6"), FR = C("#7a4b2c");
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    sails.box(compose(ca * 2.6, sa * 2.6, 0, 0, 0, a, 5.2, 0.22, 0.18), FR);
    for (let j = 0; j < 5; j++) {
      const rr = 1.2 + j * 0.85;
      sails.box(compose(ca * rr - sa * 0.55, sa * rr + ca * 0.55, 0.02, 0, 0, a, 0.8, 1.0, 0.05), SC);
      sails.box(compose(ca * rr - sa * 0.55, sa * rr + ca * 0.55, 0.06, 0, 0, a + Math.PI / 2, 0.06, 1.0, 0.06), FR);
    }
  }
  sails.cylinder(compose(0, 0, -0.3, 0, Math.PI / 2, 0, 0.7, 0.8, 0.7), FR, 8);
  const hub = f.p(0, h + 0.4, 2.7);
  t.spins.push({ mesh: sails, x: hub[0], y: hub[1], z: hub[2], ry: f.ry, speed: 0.5, axis: "z", mode: "lit" });
}

function watermill(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const w = b.w, d = b.d, base = 0.6, eave = 4.2;
  // Local +z faces the river: the wheel turns on that side.
  plinth(m, f, w, d, base, b.seed);
  const logs = Math.floor((eave - base) / 0.33);
  for (let i = 0; i < logs; i++) {
    const yy = base + 0.17 + i * 0.33;
    const col = vary(i % 2 ? LOG : LOG_LIGHT, i + b.seed, 0.06);
    log(m, f, 0, yy, d / 2 - 0.17, w + 0.6, 0.18, "x", col);
    log(m, f, 0, yy, -d / 2 + 0.17, w + 0.6, 0.18, "x", col);
    log(m, f, -w / 2 + 0.17, yy + 0.16, 0, d + 0.6, 0.18, "z", col);
    log(m, f, w / 2 - 0.17, yy + 0.16, 0, d + 0.6, 0.18, "z", col);
  }
  box(m, f, 0, (base + eave) / 2, 0, w - 0.4, eave - base, d - 0.4, TIMBER);
  const ridge = gableRoofX(m, f, 0, eave, d / 2, w + 0.9, 0.7, 0.5);
  for (const s of [-1, 1]) windowPane(m, glow, f, s * 1.6, base + 2.0, -d / 2 - 0.02, 1.0, 1.0, Math.PI);
  door(m, glow, f, 0, base, -d / 2 - 0.02, C("#3f6b5a"));
  // Door is on the street side (local -z), so turn it around.
  windowPane(m, glow, f, 0, base + 2.2, d / 2 + 0.02, 1.0, 1.0);
  chimney(m, f, -w / 2 + 1.0, 0, base, ridge + 0.8, 0.8, b.seed);
  t.chimneys.push(f.p(-w / 2 + 1.0, ridge + 1.4, 0));
  // Wheel (spinning part) on the river-side wall: rim, spokes and paddles, axle into the wall.
  const wheel = new MeshBuilder();
  const R = 2.7;
  for (const side of [-0.45, 0.45]) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2;
      wheel.box(compose(Math.cos((a + a1) / 2) * R, Math.sin((a + a1) / 2) * R, side, 0, 0, (a + a1) / 2 + Math.PI / 2, R * (a1 - a) + 0.05, 0.22, 0.14), TIMBER_LIGHT);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      wheel.box(compose((Math.cos(a) * R) / 2, (Math.sin(a) * R) / 2, side, 0, 0, a, R, 0.14, 0.12), TIMBER);
    }
  }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    wheel.box(compose(Math.cos(a) * (R - 0.15), Math.sin(a) * (R - 0.15), 0, 0, 0, a, 0.55, 0.1, 1.1), LOG);
  }
  wheel.cylinder(compose(0, 0, -0.3, 0, Math.PI / 2, 0, 0.5, 1.8, 0.5), IRON, 8);
  const hub = f.p(0, 2.6, d / 2 + 0.9);
  t.spins.push({ mesh: wheel, x: hub[0], y: hub[1], z: hub[2], ry: f.ry, speed: -0.9, axis: "z", mode: "lit" });
}

function lighthouse(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const H = 11;
  for (let i = 0; i < 6; i++) {
    const y0 = (i * H) / 6, y1 = ((i + 1) * H) / 6;
    const r0 = 2.3 - (i / 6) * 0.8, r1 = 2.3 - ((i + 1) / 6) * 0.8;
    m.cylinder(f.m(0, (y0 + y1) / 2, 0, 2, y1 - y0, 2), i % 2 ? C("#d33b2c") : WHITE, 14, r1 / 2, r0 / 2);
  }
  m.cylinder(f.m(0, 0.4, 0, 6, 0.8, 6), STONE, 12);
  door(m, glow, f, 0, 0.8, 2.15, C("#2f5a7a"));
  windowPane(m, glow, f, 0, 5.0, 1.85, 0.5, 0.8, 0, true);
  m.cylinder(f.m(0, H + 0.1, 0, 3.6, 0.25, 3.6), IRON, 14);
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    box(m, f, Math.cos(a) * 1.7, H + 0.6, Math.sin(a) * 1.7, 0.06, 0.8, 0.06, IRON);
  }
  m.torus(f.m(0, H + 1.0, 0, 1.7, 1.7, 1.7), IRON, 1, 0.03, 20, 4);
  glow.cylinder(f.m(0, H + 1.05, 0, 2.0, 1.6, 2.0), C("#fff3b0"), 12);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    box(m, f, Math.cos(a) * 1.0, H + 1.05, Math.sin(a) * 1.0, 0.1, 1.6, 0.1, IRON);
  }
  m.cone(f.m(0, H + 2.4, 0, 2.6, 1.2, 2.6), C("#d33b2c"), 14);
  m.sphere(f.m(0, H + 3.1, 0, 0.22, 0.22, 0.22), GOLD, 4, 6);
  // Rotating light beam.
  const beam = new MeshBuilder();
  for (const s of [-1, 1]) beam.cone(compose(s * 7, 0, 0, 0, 0, (s * Math.PI) / 2, 2.4, 14, 2.4), C("#fff6c9"), 10);
  const c = f.p(0, H + 1.05, 0);
  t.spins.push({ mesh: beam, x: c[0], y: c[1], z: c[2], ry: 0, speed: 0.7, axis: "y", mode: "beam" });
}

function lookout(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const H = 12, s = 2.2;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    m.cylinder(f.m(sx * s, H / 2, sz * s, 0.32, H, 0.32, 0, sz * 0.03, -sx * 0.03), TIMBER, 6);
    stoneBlock(m, f.m(sx * s, 0.2, sz * s, 0.6, 0.4, 0.6), sx * 3 + sz);
  }
  // Cross braces on each face.
  for (let lvl = 0; lvl < 3; lvl++) {
    const y0 = 1 + lvl * 3.6, y1 = y0 + 3.6;
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const fr = new Frame(...f.p(Math.sin(a) * s, 0, Math.cos(a) * s), f.ry + a);
      const len = Math.hypot(2 * s, y1 - y0);
      const ang = Math.atan2(y1 - y0, 2 * s);
      box(m, fr, 0, (y0 + y1) / 2, 0, len, 0.14, 0.12, TIMBER_LIGHT, 0, 0, ang);
      box(m, fr, 0, (y0 + y1) / 2, 0, len, 0.14, 0.12, TIMBER_LIGHT, 0, 0, -ang);
      box(m, fr, 0, y1, 0, 2 * s + 0.3, 0.16, 0.14, TIMBER);
    }
  }
  // Zig-zag stairs up one side.
  for (let i = 0; i < 18; i++) {
    const y = 0.4 + i * 0.62;
    const side = Math.floor(i / 6) % 2 ? -1 : 1;
    const x = side * (-s + 0.3 + (i % 6) * 0.72);
    box(m, f, x, y, s + 0.7, 0.62, 0.1, 0.9, LOG_LIGHT);
  }
  // Cab with windows all round and a pyramid roof.
  // Wide deck with a railing all round, so beavers can stand outside the cab and enjoy the view.
  box(m, f, 0, H + 0.1, 0, 2 * s + 3.0, 0.3, 2 * s + 3.0, TIMBER);
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const fr = new Frame(...f.p(Math.sin(a) * (s + 1.45), 0, Math.cos(a) * (s + 1.45)), f.ry + a);
    box(m, fr, 0, H + 1.15, 0, 2 * s + 3.0, 0.12, 0.12, TIMBER_LIGHT);
    for (let i = 0; i <= 6; i++) box(m, fr, -s - 1.45 + (i * (2 * s + 2.9)) / 6, H + 0.7, 0, 0.1, 0.9, 0.1, TIMBER);
  }
  box(m, f, 0, H + 0.7, 0, 2 * s + 0.6, 1.0, 2 * s + 0.6, C("#6f8f6a"));
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2;
    const fr = new Frame(...f.p(Math.sin(a) * (s + 0.32), 0, Math.cos(a) * (s + 0.32)), f.ry + a);
    box(t.glass, fr, 0, H + 1.9, 0, 2 * s - 0.2, 1.3, 0.04, C("#dff3ff"));
    for (const x of [-s + 0.1, 0, s - 0.1]) box(m, fr, x, H + 1.9, 0.04, 0.12, 1.4, 0.08, TIMBER);
  }
  m.cone(f.m(0, H + 3.4, 0, 2 * s + 2.6, 1.8, 2 * s + 2.6, Math.PI / 4), C("#8a3b2e"), 4);
  box(m, f, 0, H + 4.5, 0, 0.06, 1.2, 0.06, IRON);
  box(m, f, 0.4, H + 4.85, 0, 0.7, 0.45, 0.03, C("#e2483d"));
}

function observatory(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const r = b.w / 2;
  m.cylinder(f.m(0, 2.2, 0, r * 2, 4.4, r * 2), C("#d8cdb8"), 18);
  for (let i = 0; i < 9; i++) m.cylinder(f.m(0, 0.3 + i * 0.48, 0, r * 2 + 0.06, 0.06, r * 2 + 0.06), STONE_LIGHT, 18);
  door(m, glow, f, 0, 0, r - 0.05, C("#2f3f6a"));
  for (const a of [-0.9, 0.9, 2.2, -2.2]) windowPane(m, glow, f, Math.sin(a) * (r + 0.02), 2.6, Math.cos(a) * (r + 0.02), 0.8, 1.0, a, true);
  m.cylinder(f.m(0, 4.5, 0, r * 2 + 0.4, 0.3, r * 2 + 0.4), STONE_LIGHT, 18);
  // White dome with a dark observing slit and a telescope poking out.
  m.sphere(f.m(0, 4.6, 0, r - 0.2, r - 0.6, r - 0.2), C("#f4f6f8"), 10, 20);
  box(m, f, 0, 5.8, 1.4, 1.1, 2.4, 3.0, C("#232a3a"), 0, -0.55, 0);
  m.cylinder(f.m(0, 6.4, 2.4, 0.9, 3.2, 0.9, 0, 0.85, 0), C("#4a5a8a"), 10);
  m.cylinder(f.m(0, 7.5, 3.5, 1.1, 0.4, 1.1, 0, 0.85, 0), GOLD, 10);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI;
    box(m, f, Math.cos(a) * (r - 0.25), 4.6 + Math.sin(a) * (r - 0.65), 0, 0.1, 0.1, 0.1, STONE_LIGHT);
  }
}

function greenhouse(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glass } = t;
  const w = b.w, d = b.d, h = 2.8;
  box(m, f, 0, 0.3, 0, w + 0.2, 0.6, d + 0.2, STONE_LIGHT);
  const ribs = Math.round(w / 1.2);
  for (let i = 0; i <= ribs; i++) {
    const x = -w / 2 + (w * i) / ribs;
    for (const s of [-1, 1]) box(m, f, x, 0.6 + h / 2, s * d / 2, 0.1, h, 0.1, WHITE);
    for (const s of [-1, 1]) box(m, f, x, h + 0.6 + 0.9, s * d / 4, 0.1, 0.1, Math.hypot(d / 2, 1.8), WHITE, 0, s * Math.atan2(1.8, d / 2), 0);
  }
  box(m, f, 0, h + 2.45, 0, w + 0.2, 0.14, 0.14, WHITE);
  for (const s of [-1, 1]) box(m, f, 0, h + 0.6, s * d / 2, w + 0.2, 0.12, 0.12, WHITE);
  const pane = C("#cfeef0");
  box(glass, f, 0, 0.6 + h / 2, d / 2, w, h, 0.04, pane);
  box(glass, f, 0, 0.6 + h / 2, -d / 2, w, h, 0.04, pane);
  for (const s of [-1, 1]) {
    box(glass, f, s * w / 2, 0.6 + h / 2, 0, 0.04, h, d, pane);
    box(glass, f, 0, h + 0.6 + 0.9, s * d / 4, w, 0.04, Math.hypot(d / 2, 1.8), pane, 0, s * Math.atan2(1.8, d / 2), 0);
    panel(glass, f, [[s * w / 2, h + 0.6, -d / 2], [s * w / 2, h + 0.6, d / 2], [s * w / 2, h + 2.4, 0]], [s, 0, 0], pane);
  }
  // Plants inside: tomato vines, sunflowers and pots.
  for (let i = 0; i < 10; i++) {
    const x = -w / 2 + 0.6 + (i % 5) * ((w - 1.2) / 4), z = i < 5 ? -d / 4 : d / 4;
    box(m, f, x, 0.85, z, 0.8, 0.5, 0.8, C("#7a4b2c"));
    m.sphere(f.m(x, 1.5, z, 0.45, 0.6, 0.45), C("#4f8a3a"), 4, 6);
    if (i % 3 === 0) {
      m.cylinder(f.m(x, 2.2, z, 0.06, 1.8, 0.06), C("#4f8a3a"), 4);
      m.cylinder(f.m(x, 3.1, z + 0.1, 0.6, 0.08, 0.6, 0, Math.PI / 2 - 0.3, 0), C("#ffd93b"), 10);
      m.cylinder(f.m(x, 3.1, z + 0.14, 0.26, 0.09, 0.26, 0, Math.PI / 2 - 0.3, 0), C("#6b4126"), 8);
    } else for (let k = 0; k < 3; k++) m.sphere(f.m(x + (k - 1) * 0.2, 1.6 + k * 0.15, z + 0.4, 0.09, 0.09, 0.09), C("#e2483d"), 3, 5);
  }
  door(m, t.glow, f, 0, 0.55, d / 2 + 0.05, C("#3f8a5a"));
}

function ranger(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const w = b.w, d = b.d, base = 0.7, eave = 3.6;
  plinth(m, f, w, d, base, b.seed);
  const logs = Math.floor((eave - base) / 0.33);
  for (let i = 0; i < logs; i++) {
    const yy = base + 0.17 + i * 0.33;
    const col = vary(i % 2 ? LOG : LOG_LIGHT, i + b.seed, 0.06);
    log(m, f, 0, yy, d / 2 - 0.17, w + 0.6, 0.18, "x", col);
    log(m, f, 0, yy, -d / 2 + 0.17, w + 0.6, 0.18, "x", col);
    log(m, f, -w / 2 + 0.17, yy + 0.16, 0, d + 0.6, 0.18, "z", col);
    log(m, f, w / 2 - 0.17, yy + 0.16, 0, d + 0.6, 0.18, "z", col);
  }
  box(m, f, 0, (base + eave) / 2, 0, w - 0.4, eave - base, d - 0.4, TIMBER);
  door(m, glow, f, 0, base, d / 2 + 0.02, C("#3f6b3a"));
  for (const s of [-1, 1]) windowPane(m, glow, f, s * w * 0.3, base + 1.5, d / 2 + 0.02, 1.1, 1.0);
  box(m, f, 0, base - 0.05, d / 2 + 1.2, w, 0.14, 2.3, LOG_LIGHT);
  for (const s of [-1, 1]) box(m, f, s * (w / 2 - 0.3), (base + eave) / 2 + 0.2, d / 2 + 2.2, 0.26, eave - base + 0.4, 0.26, TIMBER);
  const ridge = gableRoofX(m, f, 0, eave + 0.2, d / 2 + 0.4, w + 1.0, 0.55, 1.6);
  box(m, f, 0, ridge + 0.36, 0, w + 1.1, 0.24, 0.42, C("#3f6b3a"));
  chimney(m, f, w / 2 - 1.0, -d / 4, base, ridge + 0.8, 0.9, b.seed);
  t.chimneys.push(f.p(w / 2 - 1.0, ridge + 1.4, -d / 4));
  // Sign board and a flag pole.
  box(m, f, 0, eave + 0.55, d / 2 + 0.55, 3.6, 0.7, 0.12, C("#3f6b3a"));
  box(m, f, 0, eave + 0.55, d / 2 + 0.62, 3.3, 0.45, 0.04, C("#f2e6c8"));
  const pole = f.p(w / 2 + 2.2, 0, d / 2 + 2.5);
  m.cylinder(compose(pole[0], f.y + 4, pole[2], 0, 0, 0, 0.16, 8, 0.16), WHITE, 8);
  box(m, new Frame(pole[0], f.y, pole[2], f.ry), 0.75, 7.3, 0, 1.4, 0.9, 0.04, C("#d33b2c"));
  box(m, new Frame(pole[0], f.y, pole[2], f.ry), 0.75, 7.3, 0, 0.5, 0.9, 0.06, WHITE);
}

function tent(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m } = t;
  const cols = [C("#e7792c"), C("#3f8a5a"), C("#2f7fb0"), C("#e7b13d")];
  const col = cols[b.seed % cols.length];
  for (const s of [-1, 1]) box(m, f, s * 0.75, 0.85, 0, 0.08, 2.1, 2.8, col, 0, 0, s * 0.62);
  panel(m, f, [[-1.35, 0.02, -1.4], [1.35, 0.02, -1.4], [0, 1.75, -1.4]], [0, 0, -1], mixRgb(col, [0, 0, 0], 0.15));
  panel(m, f, [[-1.35, 0.02, 1.4], [-0.1, 0.02, 1.4], [0, 1.75, 1.4]], [0, 0, 1], mixRgb(col, [0, 0, 0], 0.15));
  panel(m, f, [[0.5, 0.02, 1.55], [1.35, 0.02, 1.4], [0, 1.75, 1.4]], [0, 0, 1], mixRgb(col, WHITE, 0.2));
  box(m, f, 0, 1.8, 0, 0.06, 0.06, 3.1, TIMBER);
  box(m, f, 0, 0.02, 1.9, 1.4, 0.04, 0.9, C("#c9b48a"));
}

function ferrisWheel(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const R = 6.2, hubY = R + 1.6;
  // A-frame supports in front of and behind the wheel (it turns facing the road).
  for (const side of [-1, 1]) {
    for (const s of [-1, 1]) {
      const len = Math.hypot(3.2, hubY);
      box(m, f, s * 1.6, hubY / 2, side * 1.1, 0.3, len, 0.3, C("#e8e2d6"), 0, 0, s * Math.atan2(3.2, hubY));
    }
    box(m, f, 0, hubY * 0.4, side * 1.1, 3.0, 0.2, 0.2, C("#e8e2d6"));
  }
  m.cylinder(f.m(0, hubY, 0, 0.5, 2.6, 0.5, 0, Math.PI / 2, 0), IRON, 8);
  box(m, f, 0, 0.15, 0, 4.6, 0.3, 3.2, STONE_LIGHT);
  // Ticket booth.
  const tb = new Frame(...f.p(0, 0, 4.6), f.ry);
  box(m, tb, 0, 1.1, 0, 1.6, 2.2, 1.4, C("#ff6fb5"));
  glow.box(tb.m(0, 1.4, 0.72, 1.0, 0.7, 0.04), GLASS);
  m.cone(tb.m(0, 2.6, 0, 2.3, 0.8, 2.0, Math.PI / 4), WHITE, 4);
  // The turning wheel.
  const wheel = new MeshBuilder();
  const RIM = C("#e8e2d6");
  for (const side of [-0.7, 0.7]) {
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2, a1 = ((i + 1) / 36) * Math.PI * 2;
      wheel.box(compose(Math.cos((a + a1) / 2) * R, Math.sin((a + a1) / 2) * R, side, 0, 0, (a + a1) / 2 + Math.PI / 2, R * (a1 - a) + 0.05, 0.2, 0.2), RIM);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      wheel.box(compose(Math.cos(a) * R / 2, Math.sin(a) * R / 2, side, 0, 0, a, R, 0.1, 0.1), RIM);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    wheel.box(compose(Math.cos(a) * R, Math.sin(a) * R, 0, 0, 0, a, 0.12, 0.12, 1.5), RIM);
  }
  const tw = new MeshBuilder();
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2;
    tw.sphere(compose(Math.cos(a) * (R + 0.15), Math.sin(a) * (R + 0.15), 0.75, 0, 0, 0, 0.1), [C("#ffd166"), C("#ff6fb5"), C("#7ff3f0")][i % 3], 3, 4);
  }
  const hub = f.p(0, hubY, 0);
  t.spins.push({ mesh: wheel, x: hub[0], y: hub[1], z: hub[2], ry: f.ry, speed: 0.18, axis: "z", mode: "lit" });
  t.spins.push({ mesh: tw, x: hub[0], y: hub[1], z: hub[2], ry: f.ry, speed: 0.18, axis: "z", mode: "glow" });
  t.ferris = { x: hub[0], y: hub[1], z: hub[2], ry: f.ry, radius: R, seats: 8, speed: 0.18 };
}

function gondolaMesh(): MeshBuilder {
  const g = new MeshBuilder();
  g.box(compose(0, -0.9, 0, 0, 0, 0, 1.3, 0.12, 1.0), C("#3f8a5a"));
  for (const s of [-1, 1]) g.box(compose(s * 0.62, -0.62, 0, 0, 0, 0, 0.06, 0.55, 1.0), C("#3f8a5a"));
  g.box(compose(0, -0.62, 0.47, 0, 0, 0, 1.3, 0.55, 0.06), C("#ffd166"));
  g.box(compose(0, -0.62, -0.47, 0, 0, 0, 1.3, 0.55, 0.06), C("#ffd166"));
  g.cone(compose(0, 0.25, 0, Math.PI / 4, 0, 0, 1.9, 0.5, 1.5), C("#e2483d"), 4);
  g.box(compose(0, -0.15, 0, 0, 0, 0, 0.06, 0.9, 0.06), IRON);
  return g;
}

/** Shops get their look from their kind. */
const SHOPS: Partial<Record<TownBuilding["kind"], ShopOpts>> = {
  bakery: { wall: C("#f2d9b0"), awning: [C("#c8473a"), WHITE], sign: C("#c8473a"), icon: icons.bread, storeys: 2, doorCol: C("#8a3b2e") },
  post: { wall: C("#a8c8e0"), awning: [C("#2f5a7a"), WHITE], sign: C("#2f5a7a"), icon: icons.envelope, storeys: 2, doorCol: C("#c8473a") },
  store: { wall: C("#b9d4a8"), awning: [C("#3f8a5a"), C("#f5e6c0")], sign: C("#3f8a5a"), icon: icons.apple, storeys: 2, doorCol: C("#3f6b3a") },
  flowers: { wall: C("#f4c6cf"), awning: [C("#ff7eb3"), WHITE], sign: C("#d2577f"), icon: icons.flower, storeys: 1, doorCol: C("#a77bff") },
  icecream: { wall: C("#c7ecdf"), awning: [C("#ffb3c7"), WHITE], sign: C("#e98aa8"), icon: icons.cone, storeys: 1, doorCol: C("#e98aa8") },
  toys: { wall: C("#f2d27a"), awning: [C("#2f7fb0"), C("#f5c242")], sign: C("#2f7fb0"), icon: icons.toy, storeys: 2, doorCol: C("#2f7fb0") },
  maple: { wall: C("#e3b48a"), awning: [C("#8a2a20"), C("#f2e6c8")], sign: C("#8a2a20"), icon: icons.leaf, storeys: 1, doorCol: C("#8a2a20") },
};

/** Builds every town building. `heightAt` places each on the terrain. */
export function buildTown(heightAt: (x: number, z: number) => number): TownMeshes {
  const t: TownMeshes = { body: new MeshBuilder(), glow: new MeshBuilder(), glass: new MeshBuilder(), ice: new MeshBuilder(), spins: [], gondola: gondolaMesh(), ferris: null, fires: [], chimneys: [] };
  for (const b of TOWN_BUILDINGS) {
    const f = new Frame(b.x, heightAt(b.x, b.z), b.z, b.ry);
    const shopOpts = SHOPS[b.kind];
    if (shopOpts) {
      shop(t, f, b, shopOpts);
      if (b.kind === "icecream") {
        // A giant ice-cream cone on the roof.
        const p = f.p(0, 6.6, 0.4);
        t.body.cone(compose(p[0], p[1], p[2], 0, 0, Math.PI, 1.4, 2.2, 1.4), C("#d9a25a"), 10);
        t.body.sphere(compose(p[0], p[1] + 1.4, p[2], 0, 0, 0, 0.85), C("#ffb3c7"), 6, 10);
        t.body.sphere(compose(p[0], p[1] + 2.15, p[2], 0, 0, 0, 0.65), C("#c7ecdf"), 6, 10);
        t.body.sphere(compose(p[0], p[1] + 2.75, p[2], 0, 0, 0, 0.2), C("#e2483d"), 4, 6);
      }
      if (b.kind === "maple") {
        // Syrup barrels out front.
        for (let i = 0; i < 3; i++) {
          const p = f.p(-b.w / 2 + 0.8 + i * 0.95, 0, b.d / 2 + 1.2);
          t.body.cylinder(compose(p[0], f.y + 0.5, p[2], 0, 0, 0, 0.8, 1.0, 0.8), LOG, 10, 0.45, 0.45);
          for (const y of [0.2, 0.8]) t.body.cylinder(compose(p[0], f.y + y, p[2], 0, 0, 0, 0.84, 0.08, 0.84), IRON, 10);
        }
      }
      continue;
    }
    switch (b.kind) {
      case "townhall": townHall(t, f, b); break;
      case "library": library(t, f, b); break;
      case "cottage": cottage(t, f, b); break;
      case "bandstand": bandstand(t, f, b); break;
      case "stall": stall(t, f, b); break;
      case "windmill": windmill(t, f, b); break;
      case "watermill": watermill(t, f, b); break;
      case "lighthouse": lighthouse(t, f, b); break;
      case "lookout": lookout(t, f, b); break;
      case "observatory": observatory(t, f, b); break;
      case "greenhouse": greenhouse(t, f, b); break;
      case "ranger": ranger(t, f, b); break;
      case "tent": tent(t, f, b); break;
      case "ferris": ferrisWheel(t, f, b); break;
    }
  }
  // Open areas: skating pond, campfire circle, fairground lights.
  for (const a of TOWN_AREAS) {
    const y = heightAt(a.x, a.z);
    if (a.kind === "rink") {
      t.ice.cylinder(compose(a.x, y + 0.06, a.z, 0, 0, 0, a.r * 2, 0.1, a.r * 2), C("#d9f2fb"), 32);
      for (let i = 0; i < 40; i++) {
        const ang = (i / 40) * Math.PI * 2;
        t.body.sphere(compose(a.x + Math.cos(ang) * (a.r + 0.4), y + 0.1, a.z + Math.sin(ang) * (a.r + 0.4), 0, 0, 0, 0.9, 0.4, 0.7), C("#f4fbff"), 4, 6);
      }
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2;
        const x = a.x + Math.cos(ang) * (a.r + 3.4), z = a.z + Math.sin(ang) * (a.r + 3.4);
        t.body.cylinder(compose(x, y + 1.3, z, 0, 0, 0, 0.12, 2.6, 0.12), TIMBER, 6);
        t.glow.sphere(compose(x, y + 2.7, z, 0, 0, 0, 0.18), C("#ffe9a8"), 3, 5);
      }
    }
    if (a.kind === "camp") {
      for (let i = 0; i < 9; i++) {
        const ang = (i / 9) * Math.PI * 2;
        stoneBlock(t.body, compose(a.x + Math.cos(ang) * 1.1, y + 0.15, a.z + Math.sin(ang) * 1.1, -ang, 0, 0, 0.3, 0.22, 0.26), i + 900);
      }
      for (const ang of [0.3, 1.9, 3.5]) t.body.cylinder(compose(a.x, y + 0.25, a.z, ang, 0, Math.PI / 2 - 0.35, 0.2, 1.2, 0.2), C("#5a3a24"), 6);
      t.fires.push([a.x, y, a.z]);
      for (let i = 0; i < 4; i++) {
        const ang = (i / 4) * Math.PI * 2 + 0.4;
        const lf = new Frame(a.x + Math.cos(ang) * 3.2, y, a.z + Math.sin(ang) * 3.2, -ang + Math.PI / 2);
        log(t.body, lf, 0, 0.3, 0, 2.2, 0.28, "x", LOG);
      }
    }
    if (a.kind === "fair") {
      const poles: Vec3[] = [];
      for (let i = 0; i < 6; i++) {
        const ang = (i / 6) * Math.PI * 2;
        const x = a.x + Math.cos(ang) * a.r * 0.75, z = a.z + Math.sin(ang) * a.r * 0.75;
        const py = heightAt(x, z);
        t.body.cylinder(compose(x, py + 2, z, 0, 0, 0, 0.14, 4, 0.14), C("#e8e2d6"), 6);
        poles.push([x, py + 3.9, z]);
      }
      for (let i = 0; i < poles.length; i++) {
        const p0 = poles[i], p1 = poles[(i + 1) % poles.length];
        for (let k = 1; k < 8; k++) {
          const u = k / 8;
          t.glow.sphere(compose(p0[0] + (p1[0] - p0[0]) * u, p0[1] + (p1[1] - p0[1]) * u - Math.sin(u * Math.PI) * 0.6, p0[2] + (p1[2] - p0[2]) * u, 0, 0, 0, 0.12), [C("#ffd166"), C("#ff6fb5"), C("#7ff3f0"), C("#b6ff8a")][(i + k) % 4], 3, 4);
        }
      }
    }
  }
  return t;
}
