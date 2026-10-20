import { DEFAULT_LOOK, LODGE, type Look } from "@beaver/shared";
import { compose, hash2, hexToRgb, mixRgb, type Mat4, type Vec3 } from "../../engine/math";
import type { MeshBuilder } from "../../engine/mesh";
import { bakeBeaver } from "../beaver";
import { boulder, stoneBlock } from "./nature";

/**
 * Hand-modelled village architecture in a warm Rocky-Mountain lodge style:
 * stone plinths and chimneys, stacked log walls, slate roofs with exposed timber gables,
 * glowing windows, balconies and flower boxes.
 */

const C = (h: string) => hexToRgb(h);
const STONE = C("#a0978a");
const STONE_LIGHT = C("#c2b8a6");
const STONE_DARK = C("#736c64");
const LOG = C("#9b6338");
const LOG_LIGHT = C("#b9804c");
const LOG_DARK = C("#6f4426");
const BOARD = C("#b8834f");
const TRIM = C("#4f3220");
const SLATE = C("#4b505b");
const SLATE_LIGHT = C("#5d6370");
const GLASS_WARM = C("#ffd08a");
const GLASS_DEEP = C("#f0a650");
const IRON = C("#2e2b2a");

const vary = (c: Vec3, seed: number, amt = 0.12): Vec3 => {
  const k = 1 - amt + hash2(seed, 0.77) * amt * 2;
  return [c[0] * k, c[1] * k, c[2] * k];
};

/** A local coordinate frame: x across, y up, z forward (toward the plaza). */
export class Frame {
  readonly c: number;
  readonly s: number;
  constructor(readonly x: number, readonly y: number, readonly z: number, readonly ry: number) {
    this.c = Math.cos(ry);
    this.s = Math.sin(ry);
  }
  p(lx: number, ly: number, lz: number): Vec3 {
    return [this.x + lx * this.c + lz * this.s, this.y + ly, this.z - lx * this.s + lz * this.c];
  }
  dir(lx: number, ly: number, lz: number): Vec3 {
    return [lx * this.c + lz * this.s, ly, -lx * this.s + lz * this.c];
  }
  m(lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0): Mat4 {
    const [wx, wy, wz] = this.p(lx, ly, lz);
    return compose(wx, wy, wz, this.ry + ry, rx, rz, sx, sy, sz);
  }
}

export function box(m: MeshBuilder, f: Frame, lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, col: Vec3 | string, ry = 0, rx = 0, rz = 0) {
  m.box(f.m(lx, ly, lz, sx, sy, sz, ry, rx, rz), col);
}

/** Horizontal log along local x (axis "x") or local z (axis "z"). */
function log(m: MeshBuilder, f: Frame, lx: number, ly: number, lz: number, len: number, r: number, axis: "x" | "z", col: Vec3) {
  if (axis === "x") m.cylinder(f.m(lx, ly, lz, r * 2, len, r * 2, 0, 0, Math.PI / 2), col, 7);
  else m.cylinder(f.m(lx, ly, lz, r * 2, len, r * 2, 0, Math.PI / 2, 0), col, 7);
}

/** Flat polygon (triangle fan) with an explicit normal, in local coordinates. */
function panel(m: MeshBuilder, f: Frame, pts: [number, number, number][], normal: Vec3, col: Vec3) {
  const n = f.dir(...normal);
  const w = pts.map((p) => f.p(...p));
  for (let i = 1; i < w.length - 1; i++) m.vertex(w[0], n, col).vertex(w[i], n, col).vertex(w[i + 1], n, col);
}

/** A glowing window with a timber frame and mullions, on a wall facing local +z (or rotated by ry). */
function windowPane(m: MeshBuilder, glow: MeshBuilder, f: Frame, lx: number, ly: number, lz: number, w: number, h: number, ry = 0, arched = false) {
  const fr = new Frame(...f.p(lx, ly, lz), f.ry + ry);
  box(m, fr, 0, 0, 0.02, w + 0.24, h + 0.24, 0.14, TRIM);
  glow.box(fr.m(0, 0, 0.1, w, h, 0.04), mixRgb(GLASS_WARM, GLASS_DEEP, 0.35));
  box(m, fr, 0, 0, 0.14, 0.07, h, 0.06, TRIM);
  box(m, fr, 0, h * 0.12, 0.14, w, 0.07, 0.06, TRIM);
  box(m, fr, 0, -h / 2 - 0.16, 0.12, w + 0.4, 0.1, 0.26, LOG_DARK); // sill
  if (arched) glow.cylinder(fr.m(0, h / 2, 0.1, w, 0.04, w * 0.5, 0, Math.PI / 2, 0), GLASS_WARM, 12, 0.5, 0.5);
}

const FLOWERS = ["#e2483d", "#ff7eb3", "#a77bff", "#ffffff", "#ffb03b"].map(C);

function flowerBox(m: MeshBuilder, f: Frame, lx: number, ly: number, lz: number, w: number, seed: number) {
  box(m, f, lx, ly, lz, w, 0.28, 0.32, LOG_DARK);
  const n = Math.max(3, Math.round(w / 0.22));
  for (let i = 0; i < n; i++) {
    const x = lx - w / 2 + 0.11 + (i * (w - 0.22)) / (n - 1);
    m.sphere(f.m(x, ly + 0.2, lz + (hash2(i, seed) - 0.5) * 0.1, 0.2, 0.16, 0.2), C("#3f6b32"), 3, 5);
    m.sphere(f.m(x + 0.03, ly + 0.3 + hash2(seed, i) * 0.06, lz + 0.06, 0.11, 0.1, 0.11), FLOWERS[Math.floor(hash2(i * 3, seed) * FLOWERS.length)], 3, 5);
  }
}

/** Stacked stone chimney from y0 to y1 at local (lx, lz). */
function chimney(m: MeshBuilder, f: Frame, lx: number, lz: number, y0: number, y1: number, w: number, seed: number) {
  box(m, f, lx, (y0 + y1) / 2, lz, w, y1 - y0, w, STONE_DARK);
  const rows = Math.floor((y1 - y0) / 0.48);
  for (let r = 0; r < rows; r++) {
    const y = y0 + 0.24 + r * 0.48;
    for (const side of [0, 1, 2, 3]) {
      const n = 2;
      for (let k = 0; k < n; k++) {
        const off = -w / 2 + w * ((k + 0.5 + (r % 2 ? 0.25 : -0.25)) / n);
        const sx = w / n - 0.06, sd = 0.16;
        const col = vary(mixRgb(STONE, STONE_LIGHT, hash2(r * 7 + k, seed + side)), r * 13 + k + side * 3, 0.14);
        if (side === 0) box(m, f, lx + off, y, lz + w / 2 + 0.04, sx, 0.42, sd, col);
        if (side === 1) box(m, f, lx + off, y, lz - w / 2 - 0.04, sx, 0.42, sd, col);
        if (side === 2) box(m, f, lx + w / 2 + 0.04, y, lz + off, sd, 0.42, sx, col);
        if (side === 3) box(m, f, lx - w / 2 - 0.04, y, lz + off, sd, 0.42, sx, col);
      }
    }
  }
  box(m, f, lx, y1 + 0.12, lz, w + 0.45, 0.24, w + 0.45, STONE_LIGHT);
  box(m, f, lx, y1 + 0.45, lz, w * 0.55, 0.45, w * 0.55, STONE_DARK);
}

/** Pitched roof along local x: two slabs plus shingle courses. */
function gableRoofX(m: MeshBuilder, f: Frame, cx: number, eaveY: number, halfDepth: number, len: number, pitch: number, overhang: number) {
  const run = halfDepth + overhang;
  const t = Math.tan(pitch);
  const ridgeY = eaveY + halfDepth * t;
  const slab = run / Math.cos(pitch);
  for (const side of [1, -1]) {
    const mz = (side * run) / 2;
    const my = ridgeY - (run / 2) * t;
    box(m, f, cx, my + 0.12, mz, len, 0.3, slab + 0.15, SLATE, 0, side * pitch, 0);
    const courses = Math.floor(slab / 0.5);
    for (let i = 0; i < courses; i++) {
      const u = (i + 0.5) / courses;
      const z = side * run * u;
      const y = ridgeY - run * u * t + 0.3;
      const col = vary(i % 2 ? SLATE : SLATE_LIGHT, i * 11 + side, 0.08);
      box(m, f, cx, y, z, len + 0.05, 0.07, 0.52, col, 0, side * pitch, 0);
    }
  }
  box(m, f, cx, ridgeY + 0.36, 0, len + 0.2, 0.22, 0.38, TRIM);
  return ridgeY;
}

/** Pitched roof along local z (gable facing +z). */
function gableRoofZ(m: MeshBuilder, f: Frame, cx: number, z0: number, z1: number, eaveY: number, halfWidth: number, pitch: number, overhang: number) {
  const run = halfWidth + overhang;
  const t = Math.tan(pitch);
  const ridgeY = eaveY + halfWidth * t;
  const slab = run / Math.cos(pitch);
  const len = z1 - z0, zc = (z0 + z1) / 2;
  for (const side of [1, -1]) {
    const mx = cx + (side * run) / 2;
    const my = ridgeY - (run / 2) * t;
    box(m, f, mx, my + 0.12, zc, slab + 0.15, 0.3, len, SLATE, 0, 0, -side * pitch);
    const courses = Math.floor(slab / 0.5);
    for (let i = 0; i < courses; i++) {
      const u = (i + 0.5) / courses;
      const x = cx + side * run * u;
      const y = ridgeY - run * u * t + 0.3;
      box(m, f, x, y, zc, 0.52, 0.07, len + 0.05, vary(i % 2 ? SLATE : SLATE_LIGHT, i * 5 + side * 2, 0.08), 0, 0, -side * pitch);
    }
  }
  box(m, f, cx, ridgeY + 0.36, zc, 0.38, 0.22, len + 0.2, TRIM);
  return ridgeY;
}

/** Exposed heavy-timber truss on a gable face at local z, spanning half-width hw from eave y0 to apex. */
function truss(m: MeshBuilder, glow: MeshBuilder, f: Frame, cx: number, z: number, y0: number, hw: number, apexY: number) {
  // Big triangular window behind the timbers.
  panel(glow, f, [[cx - hw + 0.3, y0 + 0.1, z - 0.15], [cx + hw - 0.3, y0 + 0.1, z - 0.15], [cx, apexY - 0.4, z - 0.15]], [0, 0, 1], mixRgb(GLASS_WARM, GLASS_DEEP, 0.3));
  const beam = (x0: number, yy0: number, x1: number, yy1: number, thick = 0.3) => {
    const len = Math.hypot(x1 - x0, yy1 - yy0);
    const ang = Math.atan2(yy1 - yy0, x1 - x0);
    box(m, f, (x0 + x1) / 2, (yy0 + yy1) / 2, z, len, thick, 0.32, TRIM, 0, 0, ang);
  };
  beam(cx - hw - 0.3, y0 - 0.25, cx, apexY + 0.1, 0.36);
  beam(cx + hw + 0.3, y0 - 0.25, cx, apexY + 0.1, 0.36);
  const tieY = y0 + (apexY - y0) * 0.38;
  const tieHalf = hw * (1 - 0.38);
  beam(cx - tieHalf, tieY, cx + tieHalf, tieY);
  beam(cx, tieY, cx, apexY);
  beam(cx, tieY + 0.2, cx - tieHalf * 0.55, tieY + (apexY - tieY) * 0.45, 0.22);
  beam(cx, tieY + 0.2, cx + tieHalf * 0.55, tieY + (apexY - tieY) * 0.45, 0.22);
  beam(cx - hw, y0, cx + hw, y0, 0.32);
}

/** Railing along local x at height y. */
function railingX(m: MeshBuilder, f: Frame, x0: number, x1: number, y: number, z: number, h = 1.0, skip?: [number, number]) {
  const n = Math.max(1, Math.round((x1 - x0) / 1.4));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    if (skip && x > skip[0] && x < skip[1]) continue;
    box(m, f, x, y + h / 2, z, 0.16, h, 0.16, LOG_DARK);
  }
  const nb = Math.round((x1 - x0) / 0.32);
  for (let i = 0; i < nb; i++) {
    const x = x0 + ((x1 - x0) * (i + 0.5)) / nb;
    if (skip && x > skip[0] && x < skip[1]) continue;
    box(m, f, x, y + h * 0.48, z, 0.06, h * 0.82, 0.06, LOG);
  }
  const segs: [number, number][] = skip ? [[x0, skip[0]], [skip[1], x1]] : [[x0, x1]];
  for (const [a, b] of segs) {
    if (b - a < 0.2) continue;
    box(m, f, (a + b) / 2, y + h, z, b - a + 0.1, 0.12, 0.2, LOG_LIGHT);
    box(m, f, (a + b) / 2, y + 0.12, z, b - a, 0.08, 0.12, LOG);
  }
}

function umbrellaTable(m: MeshBuilder, f: Frame, lx: number, ly: number, lz: number, seed: number) {
  box(m, f, lx, ly + 0.4, lz, 0.12, 0.8, 0.12, LOG_DARK);
  m.cylinder(f.m(lx, ly + 0.82, lz, 1.1, 0.08, 1.1), LOG_LIGHT, 10);
  for (const a of [0, 2.1, 4.2]) m.cylinder(f.m(lx + Math.cos(a + seed) * 0.95, ly + 0.25, lz + Math.sin(a + seed) * 0.95, 0.42, 0.5, 0.42), LOG, 8);
  box(m, f, lx, ly + 1.55, lz, 0.06, 1.5, 0.06, C("#e9e1cf"));
  const stripe = seed % 2 ? C("#d14b3c") : C("#2f6f8a");
  const [wx, wy, wz] = f.p(lx, ly + 2.35, lz);
  m.cone(compose(wx, wy, wz, seed, 0, 0, 2.4, 0.55, 2.4), (x, _y, z) => {
    const a = Math.atan2(z - wz, x - wx);
    return Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 2 ? stripe : C("#f3ead6");
  }, 16);
}

/** The Grand Lodge: a two-storey timber lodge with twin timber gables, chimneys, a balcony and a sunny terrace. */
export function grandLodge(m: MeshBuilder, glow: MeshBuilder, groundY: number) {
  const W = LODGE.width, D = LODGE.depth, T = LODGE.terrace;
  const f = new Frame(LODGE.x, groundY, LODGE.z, LODGE.ry);
  const base = 1.0, g1 = 4.3, g2 = 7.2;
  const front = D / 2;

  // Stone plinth with a veneer of dressed stones on the visible faces.
  box(m, f, 0, base / 2 - 0.5, 0, W + 0.6, base + 1, D + 0.6, STONE_DARK);
  const veneer = (z: number, x0: number, x1: number, rows: number, y0: number, seed: number, faceX = false) => {
    for (let r = 0; r < rows; r++) {
      let x = x0 + (r % 2 ? 0.45 : 0);
      let k = 0;
      while (x < x1 - 0.2) {
        const w = Math.min(x1 - x, 0.65 + hash2(k + r * 31, seed) * 0.6);
        const col = vary(mixRgb(STONE, STONE_LIGHT, hash2(k * 3 + r, seed)), k * 7 + r * 13 + seed, 0.12);
        if (faceX) box(m, f, z, y0 + 0.24 + r * 0.46, x + w / 2, 0.14, 0.42, w - 0.06, col);
        else box(m, f, x + w / 2, y0 + 0.24 + r * 0.46, z, w - 0.06, 0.42, 0.14, col);
        x += w;
        k++;
      }
    }
  };
  // Terrace in front, then the plinth faces.
  box(m, f, 0, base / 2 - 0.5, front + T / 2, W - 0.4, base + 1, T, STONE_DARK);
  veneer(front + T + 0.05, -W / 2 + 0.2, LODGE.stairsX - 1.3, 2, 0, 3);
  veneer(front + T + 0.05, LODGE.stairsX + 1.3, W / 2 - 0.2, 2, 0, 4);
  veneer(-W / 2 - 0.36, -D / 2, front + T, 2, 0, 5, true);
  veneer(W / 2 + 0.36, -D / 2, front + T, 2, 0, 6, true);
  // Terrace paving.
  for (let i = 0; i < 12; i++) {
    for (let j = 0; j < 3; j++) {
      const x = -W / 2 + 0.6 + i * ((W - 1.2) / 11), z = front + 0.5 + j * 1.05;
      box(m, f, x, base + 0.03, z, 1.32, 0.06, 0.98, vary(STONE_LIGHT, i * 5 + j, 0.1));
    }
  }
  railingX(m, f, -W / 2 + 0.3, W / 2 - 0.3, base, front + T - 0.15, 0.95, [LODGE.stairsX - 1.25, LODGE.stairsX + 1.25]);
  // Stairs down toward the plaza.
  for (let i = 0; i < 5; i++) {
    const top = base - i * 0.2;
    box(m, f, LODGE.stairsX, top / 2 - 0.25, front + T + 0.18 + i * 0.36, 2.4, top + 0.5, 0.36, vary(STONE_LIGHT, i, 0.08));
  }
  for (const s of [-1.3, 1.3]) box(m, f, LODGE.stairsX + s, 0.55, front + T + 0.9, 0.3, 1.1, 1.9, STONE);

  // Ground floor: stacked logs with crossed corners.
  const logs = Math.floor((g1 - base) / 0.33);
  for (let i = 0; i < logs; i++) {
    const y = base + 0.17 + i * 0.33;
    const col = vary(i % 2 ? LOG : LOG_LIGHT, i, 0.06);
    log(m, f, 0, y, front - 0.17, W + 0.7, 0.18, "x", col);
    log(m, f, 0, y, -front + 0.17, W + 0.7, 0.18, "x", col);
    log(m, f, -W / 2 + 0.17, y + 0.16, 0, D + 0.7, 0.18, "z", col);
    log(m, f, W / 2 - 0.17, y + 0.16, 0, D + 0.7, 0.18, "z", col);
  }
  box(m, f, 0, (base + g1) / 2, 0, W - 0.6, g1 - base, D - 0.6, LOG_DARK);
  // Ground-floor windows and the entrance.
  for (const x of [-6.6, -3.5, -0.4, 2.7]) windowPane(m, glow, f, x, base + 1.55, front + 0.02, 1.7, 1.5);
  const door = LODGE.stairsX;
  box(m, f, door, base + 1.25, front + 0.04, 2.0, 2.6, 0.16, TRIM);
  glow.box(f.m(door, base + 1.2, front + 0.13, 1.6, 2.3, 0.04), GLASS_DEEP);
  box(m, f, door, base + 1.2, front + 0.18, 0.08, 2.3, 0.06, TRIM);
  for (const s of [-1.35, 1.35]) {
    box(m, f, door + s, base + 2.45, front + 0.35, 0.06, 0.3, 0.06, IRON);
    box(m, f, door + s, base + 2.15, front + 0.35, 0.26, 0.34, 0.26, IRON);
    glow.box(f.m(door + s, base + 2.15, front + 0.35, 0.2, 0.28, 0.2), GLASS_WARM);
  }
  // Side windows.
  for (const z of [-2.2, 1.8]) {
    windowPane(m, glow, f, -W / 2 - 0.02, base + 1.55, z, 1.4, 1.3, -Math.PI / 2);
    windowPane(m, glow, f, W / 2 + 0.02, base + 1.55, z, 1.4, 1.3, Math.PI / 2);
  }

  // Upper floor: board-and-batten.
  box(m, f, 0, (g1 + g2) / 2, 0, W - 0.2, g2 - g1, D - 0.2, BOARD);
  for (let i = 0; i < 28; i++) {
    const x = -W / 2 + 0.4 + i * ((W - 0.8) / 27);
    box(m, f, x, (g1 + g2) / 2, front - 0.06, 0.1, g2 - g1, 0.06, vary(LOG_DARK, i, 0.1));
  }
  box(m, f, 0, g1 + 0.05, front + 0.0, W + 0.2, 0.22, 0.2, TRIM);
  for (const x of [-7.1, -1.6, 4.0, 6.9]) {
    windowPane(m, glow, f, x, g1 + 1.45, front, 1.2, 1.35);
    flowerBox(m, f, x, g1 + 0.55, front + 0.28, 1.5, x * 10);
  }
  // Balcony over the terrace.
  box(m, f, 0, g1 - 0.1, front + 0.85, W - 0.6, 0.22, 1.7, LOG_LIGHT);
  for (let i = 0; i <= 5; i++) {
    const x = -W / 2 + 0.6 + i * ((W - 1.2) / 5);
    box(m, f, x, (base + g1) / 2, front + 1.6, 0.3, g1 - base, 0.3, LOG_DARK);
    box(m, f, x, g1 - 0.45, front + 1.25, 0.16, 0.16, 0.9, TRIM, 0, -0.6, 0);
  }
  railingX(m, f, -W / 2 + 0.4, W / 2 - 0.4, g1, front + 1.62, 1.0);
  for (let i = 0; i < 6; i++) flowerBox(m, f, -W / 2 + 1.5 + i * 2.8, g1 + 1.0, front + 1.82, 1.1, i * 17);

  // Main roof (ridge along x) and gable ends.
  const pitch = 0.78;
  const ridgeY = gableRoofX(m, f, 0, g2, D / 2, W + 1.8, pitch, 1.0);
  for (const s of [-1, 1]) {
    const x = s * (W / 2 - 0.1);
    panel(m, f, [[x, g2, -D / 2], [x, g2, D / 2], [x, ridgeY, 0]], [s, 0, 0], BOARD);
    windowPane(m, glow, f, x + s * 0.02, g2 + 1.3, 0, 1.2, 1.4, (s * Math.PI) / 2);
  }
  // Twin timber gables projecting over the balcony.
  for (const [cx, hw] of [[-4.4, 2.7], [2.6, 2.4]] as [number, number][]) {
    const zf = front + 2.1;
    const apex = gableRoofZ(m, f, cx, -0.5, zf + 0.6, g2, hw, 0.9, 0.7);
    panel(m, f, [[cx - hw, g2, front + 0.02], [cx + hw, g2, front + 0.02], [cx, apex, front + 0.02]], [0, 0, 1], BOARD);
    truss(m, glow, f, cx, zf, g2, hw, apex - 0.1);
    for (const s of [-1, 1]) {
      box(m, f, cx + s * hw, (g1 + g2) / 2, zf, 0.34, g2 - g1 + 0.4, 0.34, TRIM);
      box(m, f, cx + s * hw, (base + g1) / 2, zf, 0.34, g1 - base, 0.34, LOG_DARK);
    }
  }
  // Chimneys.
  chimney(m, f, -W / 2 + 1.3, -1.2, base, ridgeY + 1.6, 1.5, 1);
  chimney(m, f, W / 2 - 1.6, -2.4, base, ridgeY + 2.2, 1.7, 2);

  // Terrace furniture.
  for (const [i, x] of [-6.2, -2.4, 1.6].entries()) umbrellaTable(m, f, x, base + 0.06, front + 2.35, i + 1);
  for (const x of [-W / 2 + 0.7, W / 2 - 0.7]) {
    m.cylinder(f.m(x, base + 0.35, front + T - 0.5, 0.8, 0.7, 0.8), STONE, 10, 0.55, 0.45);
    for (let k = 0; k < 7; k++) m.sphere(f.m(x + (hash2(k, x) - 0.5) * 0.5, base + 0.8 + hash2(x, k) * 0.15, front + T - 0.5 + (hash2(k + 4, x) - 0.5) * 0.5, 0.24, 0.2, 0.24), FLOWERS[k % FLOWERS.length], 3, 5);
  }
}

/** Smaller timber cabin (outfitter, arcade, distant chalets) with a front gable and porch. */
export function timberCabin(m: MeshBuilder, glow: MeshBuilder, x: number, y: number, z: number, ry: number, w: number, d: number, roofAccent: Vec3 | null, seed: number, porch = true) {
  const f = new Frame(x, y, z, ry);
  const base = 0.7, eave = 3.6;
  box(m, f, 0, base / 2 - 0.4, 0, w + 0.5, base + 0.8, d + 0.5, STONE_DARK);
  for (let i = 0; i < Math.ceil(w / 0.7); i++) {
    const xx = -w / 2 + 0.35 + i * 0.7;
    box(m, f, xx, base / 2, d / 2 + 0.28, 0.64, base - 0.1, 0.12, vary(mixRgb(STONE, STONE_LIGHT, hash2(i, seed)), i + seed, 0.1));
  }
  const logs = Math.floor((eave - base) / 0.33);
  for (let i = 0; i < logs; i++) {
    const yy = base + 0.17 + i * 0.33;
    const col = vary(i % 2 ? LOG : LOG_LIGHT, i + seed, 0.06);
    log(m, f, 0, yy, d / 2 - 0.17, w + 0.6, 0.18, "x", col);
    log(m, f, 0, yy, -d / 2 + 0.17, w + 0.6, 0.18, "x", col);
    log(m, f, -w / 2 + 0.17, yy + 0.16, 0, d + 0.6, 0.18, "z", col);
    log(m, f, w / 2 - 0.17, yy + 0.16, 0, d + 0.6, 0.18, "z", col);
  }
  box(m, f, 0, (base + eave) / 2, 0, w - 0.5, eave - base, d - 0.5, LOG_DARK);
  const apex = gableRoofZ(m, f, 0, -d / 2 - 0.2, d / 2 + (porch ? 2.0 : 0.6), eave, w / 2, 0.82, 0.6);
  panel(m, f, [[-w / 2, eave, d / 2 - 0.02], [w / 2, eave, d / 2 - 0.02], [0, apex, d / 2 - 0.02]], [0, 0, 1], BOARD);
  panel(m, f, [[-w / 2, eave, -d / 2 + 0.02], [w / 2, eave, -d / 2 + 0.02], [0, apex, -d / 2 + 0.02]], [0, 0, -1], BOARD);
  windowPane(m, glow, f, 0, eave + 1.0, d / 2 + 0.02, 1.2, 1.1);
  if (roofAccent) box(m, f, 0, eave + 0.05, d / 2 + 0.12, w + 0.2, 0.3, 0.16, roofAccent);
  // Door and windows.
  box(m, f, 0, base + 1.1, d / 2 + 0.03, 1.4, 2.2, 0.14, TRIM);
  glow.box(f.m(0, base + 1.05, d / 2 + 0.11, 1.05, 1.95, 0.04), GLASS_DEEP);
  for (const s of [-1, 1]) {
    windowPane(m, glow, f, s * w * 0.3, base + 1.5, d / 2 + 0.02, 1.15, 1.1);
    flowerBox(m, f, s * w * 0.3, base + 0.72, d / 2 + 0.28, 1.4, seed + s);
    windowPane(m, glow, f, s * (w / 2 + 0.02), base + 1.5, 0, 1.1, 1.0, (s * Math.PI) / 2);
  }
  if (porch) {
    box(m, f, 0, base - 0.05, d / 2 + 1.0, w - 0.4, 0.14, 2.0, LOG_LIGHT);
    for (const s of [-1, 1]) box(m, f, s * (w / 2 - 0.4), (base + eave) / 2, d / 2 + 1.85, 0.26, eave - base, 0.26, LOG_DARK);
  }
  chimney(m, f, w / 2 - 0.9, -d / 4, base, apex + 1.0, 1.0, seed);
}

/** Wooden bench: thick slab seat on dressed stone supports, with a log backrest. */
export function bench(m: MeshBuilder, x: number, y: number, z: number, ry: number, seed: number) {
  const f = new Frame(x, y, z, ry);
  for (const s of [-0.9, 0.9]) stoneBlock(m, f.m(s, 0.24, 0, 0.32, 0.3, 0.32), seed + s);
  box(m, f, 0, 0.56, 0, 2.5, 0.16, 0.62, vary(LOG_LIGHT, seed, 0.08));
  box(m, f, 0, 0.47, 0.27, 2.5, 0.08, 0.1, LOG_DARK);
  for (const s of [-1.05, 1.05]) box(m, f, s, 0.85, -0.26, 0.12, 0.6, 0.1, LOG_DARK);
  log(m, f, 0, 1.05, -0.28, 2.4, 0.09, "x", LOG);
}

/** Rustic post lantern: timber post with an iron lantern hanging from a bracket. */
export function lanternPost(m: MeshBuilder, glow: MeshBuilder, x: number, y: number, z: number, ry: number, h = 2.8) {
  const f = new Frame(x, y, z, ry);
  stoneBlock(m, f.m(0, 0.12, 0, 0.36, 0.2, 0.36), x * 7 + z);
  box(m, f, 0, h / 2, 0, 0.2, h, 0.2, LOG_DARK);
  box(m, f, 0.32, h - 0.1, 0, 0.7, 0.1, 0.1, LOG_DARK);
  box(m, f, 0.12, h - 0.35, 0, 0.08, 0.45, 0.08, LOG_DARK, 0, 0, -0.8);
  box(m, f, 0.55, h - 0.32, 0, 0.04, 0.35, 0.04, IRON);
  box(m, f, 0.55, h - 0.68, 0, 0.32, 0.06, 0.32, IRON);
  box(m, f, 0.55, h - 1.05, 0, 0.28, 0.06, 0.28, IRON);
  m.cone(f.m(0.55, h - 0.56, 0, 0.42, 0.2, 0.42), IRON, 4);
  glow.box(f.m(0.55, h - 0.87, 0, 0.22, 0.32, 0.22), GLASS_WARM);
}

/** Split-rail fence between two posts, plus the post itself (with an optional lantern). */
export function fencePost(m: MeshBuilder, glow: MeshBuilder, x: number, y: number, z: number, seed: number, lantern: boolean) {
  m.cylinder(compose(x, y + 0.6, z, hash2(seed, 1) * 3, 0, 0, 0.24, 1.3, 0.24), vary(LOG, seed, 0.12), 6, 0.45, 0.5);
  m.cone(compose(x, y + 1.3, z, 0, 0, 0, 0.26, 0.12, 0.26), LOG_DARK, 6);
  if (lantern) {
    box(m, new Frame(x, y, z, 0), 0, 1.42, 0, 0.3, 0.06, 0.3, IRON);
    glow.box(compose(x, y + 1.6, z, 0, 0, 0, 0.22, 0.3, 0.22), GLASS_WARM);
    m.cone(compose(x, y + 1.85, z, Math.PI / 4, 0, 0, 0.4, 0.2, 0.4), IRON, 4);
  }
}

export function fenceRails(m: MeshBuilder, a: Vec3, b: Vec3, seed: number) {
  const dx = b[0] - a[0], dz = b[2] - a[2];
  const len = Math.hypot(dx, dz);
  const ry = Math.atan2(dx, dz);
  for (const [h, k] of [[0.55, 0], [1.0, 1]]) {
    const y0 = a[1] + h, y1 = b[1] + h;
    const tilt = Math.atan2(y1 - y0, len);
    m.cylinder(compose((a[0] + b[0]) / 2, (y0 + y1) / 2 + (hash2(seed, k) - 0.5) * 0.06, (a[2] + b[2]) / 2, ry, Math.PI / 2 - tilt, 0, 0.13, len + 0.2, 0.11), vary(LOG_LIGHT, seed + k, 0.12), 5);
  }
}

const STATUE = (x: number, y: number, z: number): Vec3 => {
  const n = hash2(Math.floor(x * 6), Math.floor(y * 6 + z * 6));
  const s = 0.8 + 0.05 * Math.sin(x * 5 + y * 3 + z * 4) + n * 0.05;
  return [s * 0.98, s * 0.93, s * 0.83];
};

/**
 * The plaza fountain: three dressed-stone steps, a stone basin, a craggy rock tower with two
 * spilling pools, and three carved beaver statues. Returns the cascade sheets as a separate mesh.
 */
export function fountain(m: MeshBuilder, falls: MeshBuilder, foam: MeshBuilder, y0: number) {
  // Steps.
  const steps = [[7.1, 0.22], [6.5, 0.44], [5.95, 0.66]];
  steps.forEach(([r, top], si) => {
    const n = Math.round((Math.PI * 2 * r) / 1.05);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + si * 0.3;
      const x = Math.cos(a) * (r - 0.32), z = Math.sin(a) * (r - 0.32);
      m.box(compose(x, y0 + top / 2 - 0.15, z, -a + Math.PI / 2, 0, 0, (Math.PI * 2 * r) / n - 0.05, top + 0.3, 0.68), vary(mixRgb(STONE, STONE_LIGHT, hash2(i, si)), i * 3 + si, 0.1));
    }
  });
  // Basin wall of rough blocks with a flat cap.
  const wallTop = y0 + 1.45;
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * Math.PI * 2;
    const x = Math.cos(a) * 5.55, z = Math.sin(a) * 5.55;
    stoneBlock(m, compose(x, y0 + 1.05, z, -a, 0, 0, 0.62, 0.46, 0.4), i + 50);
    m.box(compose(Math.cos(a + 0.1) * 5.55, wallTop, Math.sin(a + 0.1) * 5.55, -a - 0.1 + Math.PI / 2, 0, 0, 1.22, 0.18, 0.78), vary(STONE_LIGHT, i, 0.08));
  }
  m.cylinder(compose(0, y0 + 0.9, 0, 0, 0, 0, 10.4, 0.5, 10.4), C("#3f5b5c"), 32);
  // Craggy rock tower, two tiers with shallow pools.
  const tier = (r: number, top: number, count: number, seed: number) => {
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + seed;
      const rr = r * (0.8 + hash2(i, seed) * 0.25);
      const h = top - y0 - 0.5;
      boulder(m, Math.cos(a) * rr, y0 + 0.6 + h * 0.45, Math.sin(a) * rr, 0.95 + hash2(seed, i) * 0.4, h * 0.6, 0.9, i * 13 + seed, 0.35);
    }
    m.cylinder(compose(0, top - 0.15, 0, 0, 0, 0, r * 2 + 0.4, 0.3, r * 2 + 0.4), STONE, 18);
    m.torus(compose(0, top, 0, 0, 0, 0, r + 0.2, 1.4, r + 0.2), STONE_LIGHT, 1, 0.14, 22, 6);
  };
  const t1 = y0 + 3.0, t2 = y0 + 4.7;
  tier(2.4, t1, 9, 1.1);
  m.cylinder(compose(0, (t1 + t2) / 2, 0, 0, 0, 0, 2.6, t2 - t1, 2.6), STONE_DARK, 12);
  tier(1.35, t2, 6, 2.3);
  boulder(m, 0, t2 + 0.25, 0, 0.8, 0.6, 0.8, 99, 0.2);

  // Statues: one proud beaver on top, two lower on the first tier.
  const statue = (x: number, y: number, z: number, ry: number, s: number, look: Look) => bakeBeaver(m, look, compose(x, y, z, ry, 0, 0, s), STATUE);
  statue(0, t2 + 0.65, 0, 0.15, 1.4, { ...DEFAULT_LOOK, hat: null });
  statue(Math.cos(2.4) * 1.9, t1 + 0.02, Math.sin(2.4) * 1.9, Math.PI / 2 - 2.4, 1.1, { ...DEFAULT_LOOK, hat: null });
  statue(Math.cos(0.75) * 1.9, t1 + 0.02, Math.sin(0.75) * 1.9, Math.PI / 2 - 0.75, 1.1, { ...DEFAULT_LOOK, hat: null });

  // Water sheets spilling over each pool edge (curved arcs that fall and flare outward).
  const sheet = (r0: number, yTop: number, yBot: number, a0: number, a1: number, flare: number) => {
    const segs = 10, rows = 6;
    for (let i = 0; i < segs; i++) {
      for (let j = 0; j < rows; j++) {
        const A = (k: number, t: number): Vec3 => {
          const a = a0 + ((a1 - a0) * k) / segs;
          const r = r0 + flare * Math.sqrt(t);
          return [Math.cos(a) * r, yTop - (yTop - yBot) * t, Math.sin(a) * r];
        };
        const t0 = j / rows, t1v = (j + 1) / rows;
        const p00 = A(i, t0), p10 = A(i + 1, t0), p01 = A(i, t1v), p11 = A(i + 1, t1v);
        const am = a0 + ((a1 - a0) * (i + 0.5)) / segs;
        const n: Vec3 = [Math.cos(am), 0.2, Math.sin(am)];
        const col = C("#9fd3df");
        falls.vertex(p00, n, col).vertex(p10, n, col).vertex(p11, n, col);
        falls.vertex(p00, n, col).vertex(p11, n, col).vertex(p01, n, col);
      }
    }
    // Foam where it lands.
    for (let k = 0; k < 5; k++) {
      const a = a0 + ((a1 - a0) * (k + 0.5)) / 5;
      const r = r0 + flare + 0.15;
      foam.sphere(compose(Math.cos(a) * r, yBot + 0.05, Math.sin(a) * r, a, 0, 0, 0.55, 0.22, 0.4), C("#ffffff"), 4, 6);
    }
  };
  for (let k = 0; k < 4; k++) sheet(1.5, t2 - 0.05, t1 + 0.02, k * 1.57 + 0.2, k * 1.57 + 1.05, 0.35);
  for (let k = 0; k < 5; k++) sheet(2.65, t1 - 0.05, y0 + 1.3, k * 1.257 + 0.5, k * 1.257 + 1.15, 0.7);
  return { poolY: y0 + 1.3, pools: [[2.45, t1 - 0.12], [1.4, t2 - 0.12]] as [number, number][] };
}

/** Moored canoe with seats and a paddle. */
export function canoe(m: MeshBuilder, x: number, y: number, z: number, ry: number, color: Vec3) {
  const f = new Frame(x, y, z, ry);
  m.sphere(f.m(0, 0, 0, 0.75, 0.36, 2.6), color, 6, 14);
  m.sphere(f.m(0, 0.06, 0, 0.62, 0.28, 2.45), C("#6b4126"), 6, 14);
  box(m, f, 0, 0.16, 0, 1.36, 0.06, 0.08, C("#e9dcc0"));
  for (const s of [-0.85, 0.85]) box(m, f, 0, 0.12, s, 1.1, 0.06, 0.3, LOG_LIGHT);
  box(m, f, 0.2, 0.2, 0.3, 0.08, 0.04, 1.6, LOG_LIGHT, 0.3);
}

/** A walkable plank dock with posts, rope rails and a lantern at the end. */
export function dock(m: MeshBuilder, glow: MeshBuilder, x: number, z: number, ry: number, deckY: number, length: number) {
  const f = new Frame(x, 0, z, ry);
  const planks = Math.round(length / 0.36);
  for (let i = 0; i < planks; i++) {
    const zz = -0.4 + i * 0.36;
    box(m, f, (hash2(i, 3) - 0.5) * 0.08, deckY - 0.06, zz, 3.2, 0.12, 0.32, vary(i % 3 ? LOG_LIGHT : LOG, i, 0.1));
  }
  for (const s of [-1.2, 0, 1.2]) box(m, f, s, deckY - 0.22, length / 2 - 0.4, 0.2, 0.2, length, LOG_DARK);
  const posts: Vec3[] = [];
  for (const along of [0, 3.6, 7.2, length - 0.5]) {
    for (const s of [-1, 1]) {
      const p = f.p(s * 1.6, 0, along);
      m.cylinder(compose(p[0], deckY - 0.4, p[2], 0, 0, 0, 0.3, 2.6, 0.3), vary(LOG_DARK, along + s, 0.1), 7);
      m.cone(compose(p[0], deckY + 0.95, p[2], 0, 0, 0, 0.32, 0.14, 0.32), LOG_DARK, 7);
      posts.push([p[0], deckY + 0.75, p[2]]);
    }
  }
  // Sagging rope between posts on each side.
  for (const side of [0, 1]) {
    for (let i = 0; i < 3; i++) {
      const a = posts[i * 2 + side], b = posts[(i + 1) * 2 + side];
      for (let k = 0; k < 4; k++) {
        const t0 = k / 4, t1 = (k + 1) / 4;
        const sag = (t: number) => -Math.sin(t * Math.PI) * 0.25;
        const p0: Vec3 = [a[0] + (b[0] - a[0]) * t0, a[1] + sag(t0), a[2] + (b[2] - a[2]) * t0];
        const p1: Vec3 = [a[0] + (b[0] - a[0]) * t1, a[1] + sag(t1), a[2] + (b[2] - a[2]) * t1];
        const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]);
        m.cylinder(compose((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, Math.atan2(p1[0] - p0[0], p1[2] - p0[2]), Math.PI / 2 - Math.atan2(p1[1] - p0[1], Math.hypot(p1[0] - p0[0], p1[2] - p0[2])), 0, 0.06, len + 0.02, 0.06), C("#c9b48a"), 4);
      }
    }
  }
  const end = f.p(1.6, 0, length - 0.5);
  glow.box(compose(end[0], deckY + 1.3, end[2], 0, 0, 0, 0.22, 0.3, 0.22), GLASS_WARM);
  m.cone(compose(end[0], deckY + 1.55, end[2], Math.PI / 4, 0, 0, 0.4, 0.2, 0.4), IRON, 4);
}

/** Craggy rock face (for cliffs behind waterfalls). */
export function cliff(m: MeshBuilder, cx: number, cy: number, cz: number, facing: number, width: number, height: number, seed: number) {
  const f = new Frame(cx, cy, cz, facing);
  const cols = Math.ceil(width / 5), rows = Math.ceil(height / 5);
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const lx = -width / 2 + (i + 0.5) * (width / cols) + (hash2(i, j + seed) - 0.5) * 2;
      const ly = (j + 0.5) * (height / rows);
      const lz = -Math.abs(lx) * 0.25 - (hash2(j, i + seed) * 1.5);
      const p = f.p(lx, ly, lz);
      boulder(m, p[0], p[1], p[2], 3.4 + hash2(i + seed, j) * 1.6, 3.2, 2.8 + hash2(j, i) * 1.2, i * 31 + j * 7 + seed, 0.45);
    }
  }
}
