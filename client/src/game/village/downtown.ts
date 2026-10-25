import type { TownBuilding } from "@beaver/shared";
import { compose, hash2, hexToRgb, mixRgb, type Vec3 } from "../../engine/math";
import type { MeshBuilder } from "../../engine/mesh";
import { bench, box, chimney, flowerBox, Frame, gableRoofX, gableRoofZ, lanternPost, log, panel, windowPane } from "./architecture";
import { stoneBlock } from "./nature";
import { door, hangingSign, plinth, timberFrame, type TownMeshes } from "./town";

/**
 * Downtown's buildings, in the same storybook mountain-town style as Main Street: stone plinths,
 * board-and-batten and log walls, slate roofs with deep eaves, timber porches, glowing windows,
 * flower boxes and lanterns. Each one still says what it is from across the plaza.
 *
 * Every building faces local +z; footprints match TOWN_BUILDINGS so collisions don't change.
 */

const C = (h: string) => hexToRgb(h);
const STONE = C("#a0978a"), STONE_LIGHT = C("#c2b8a6"), STONE_DARK = C("#736c64");
const TIMBER = C("#5b3a24"), TIMBER_LIGHT = C("#8a5a34"), LOG = C("#9b6338"), LOG_LIGHT = C("#b9804c");
const WHITE = C("#fbf7ee"), IRON = C("#2e2b2a"), GOLD = C("#e8b84a");
const GLASS = C("#ffd08a");

const vary = (c: Vec3, seed: number, amt = 0.1): Vec3 => {
  const k = 1 - amt + hash2(seed, 0.77) * amt * 2;
  return [c[0] * k, c[1] * k, c[2] * k];
};

/** Vertical board-and-batten siding on a wall face at local z, from x0..x1 and y0..y1. */
function battens(m: MeshBuilder, f: Frame, x0: number, x1: number, y0: number, y1: number, z: number, col: Vec3, step = 0.55) {
  for (let x = x0 + step / 2; x < x1; x += step) box(m, f, x, (y0 + y1) / 2, z, 0.08, y1 - y0, 0.06, mixRgb(col, TIMBER, 0.25));
}

/** Same along a side wall (face at local x, running along z). */
function battensZ(m: MeshBuilder, f: Frame, z0: number, z1: number, y0: number, y1: number, x: number, col: Vec3, step = 0.55) {
  for (let z = z0 + step / 2; z < z1; z += step) box(m, f, x, (y0 + y1) / 2, z, 0.06, y1 - y0, 0.08, mixRgb(col, TIMBER, 0.25));
}

/** A heavy timber post on a dressed stone base. */
function post(m: MeshBuilder, f: Frame, x: number, z: number, y0: number, h: number, col = TIMBER) {
  stoneBlock(m, f.m(x, y0 + 0.25, z, 0.42, 0.5, 0.42), Math.round(x * 13 + z * 7));
  box(m, f, x, y0 + 0.5 + (h - 0.5) / 2, z, 0.3, h - 0.5, 0.3, col);
  box(m, f, x, y0 + h - 0.08, z, 0.5, 0.16, 0.5, col);
}

/** A pennant banner hanging from a short pole on a wall (local +z face). */
function banner(m: MeshBuilder, f: Frame, x: number, y: number, z: number, a: Vec3, b: Vec3) {
  box(m, f, x, y + 0.05, z + 0.35, 0.06, 0.06, 0.8, IRON);
  box(m, f, x, y - 0.9, z + 0.72, 0.9, 1.8, 0.05, a);
  box(m, f, x, y - 0.9, z + 0.75, 0.5, 1.5, 0.03, b);
  m.cone(f.m(x, y - 2.0, z + 0.72, 0.9, 0.4, 0.05, 0, 0, Math.PI), a, 3);
}

/** A plain flat gable-end infill (boards), for a gable facing +z at z. */
function gableInfill(m: MeshBuilder, f: Frame, hw: number, eave: number, ridge: number, z: number, col: Vec3) {
  panel(m, f, [[-hw, eave, z], [hw, eave, z], [0, ridge, z]], [0, 0, 1], col);
}

// ------------------------------------------------------------------ Sports Centre

/**
 * A big timber field house: stone base, cream board-and-batten walls with a blue band, a tall
 * front gable with a scoreboard clock, a timber portico with pennants, clerestory windows down the
 * sides and a cupola with a basketball weather vane.
 */
export function sportsCentre(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const w = b.w, d = b.d, base = 0.6, eave = 6.2;
  const WALL = C("#efe6d2"), BLUE = C("#2f63b8"), ORANGE = C("#e8742a");
  plinth(m, f, w, d, base, b.seed);
  box(m, f, 0, (base + eave) / 2, 0, w, eave - base, d, WALL);
  battens(m, f, -w / 2, w / 2, base, eave, d / 2 + 0.03, WALL);
  for (const s of [-1, 1]) battensZ(m, f, -d / 2, d / 2, base, eave, s * (w / 2 + 0.03), WALL);
  // Blue band and corner boards.
  box(m, f, 0, base + 2.9, 0, w + 0.14, 0.32, d + 0.14, BLUE);
  box(m, f, 0, eave - 0.1, 0, w + 0.18, 0.24, d + 0.18, TIMBER);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(m, f, sx * (w / 2 - 0.08), (base + eave) / 2, sz * (d / 2 - 0.08), 0.36, eave - base, 0.36, TIMBER);
  // Clerestory windows down both sides and tall windows either side of the porch.
  for (const s of [-1, 1]) {
    for (const z of [-2.8, 0, 2.8]) {
      windowPane(m, glow, f, s * (w / 2 + 0.02), base + 4.3, z, 1.6, 1.4, (s * Math.PI) / 2);
      windowPane(m, glow, f, s * (w / 2 + 0.02), base + 1.6, z, 1.2, 1.5, (s * Math.PI) / 2);
      flowerBox(m, new Frame(...f.p(s * (w / 2 + 0.3), 0, z), f.ry + (s * Math.PI) / 2), 0, base + 0.68, 0, 1.4, b.seed + z * 3 + s);
    }
    windowPane(m, glow, f, s * 4.1, base + 1.8, d / 2 + 0.02, 1.4, 2.2, 0, true);
    windowPane(m, glow, f, s * 4.1, base + 4.4, d / 2 + 0.02, 1.4, 1.2);
  }
  // Front gable (the roof ridge runs front-to-back) with a scoreboard clock and a big arched window.
  const ridge = gableRoofZ(m, f, 0, -d / 2 - 0.5, d / 2 + 0.6, eave, w / 2, 0.5, 0.7);
  gableInfill(m, f, w / 2, eave, ridge - 0.2, d / 2 + 0.02, mixRgb(WALL, TIMBER_LIGHT, 0.25));
  gableInfill(m, f, w / 2, eave, ridge - 0.2, -d / 2 - 0.02, mixRgb(WALL, TIMBER_LIGHT, 0.25));
  // Exposed king-post truss on the gable.
  box(m, f, 0, (eave + ridge) / 2, d / 2 + 0.1, 0.28, ridge - eave, 0.2, TIMBER);
  for (const s of [-1, 1]) {
    const len = Math.hypot(w / 2, ridge - eave);
    box(m, f, (s * w) / 4, (eave + ridge) / 2 - 0.1, d / 2 + 0.12, len, 0.3, 0.22, TIMBER, 0, 0, -s * Math.atan2(ridge - eave, w / 2));
  }
  // The neon SPORTS sits low on the gable; the scoreboard above it.
  box(m, f, 0, eave + 1.95, d / 2 + 0.22, 3.6, 1.1, 0.16, C("#1d1d24"));
  for (let i = 0; i < 4; i++) glow.box(f.m(-1.2 + i * 0.8, eave + 1.95, d / 2 + 0.32, 0.5, 0.7, 0.03), i < 2 ? C("#ff8a3d") : C("#fff6d8"));
  // Portico: a gabled porch on four timber posts, double doors, wide steps.
  const pz = d / 2 + 1.6;
  for (const x of [-2.2, -0.9, 0.9, 2.2]) post(m, f, x, pz + 1.1, base, 3.3);
  const porchRidge = gableRoofZ(m, f, 0, d / 2, pz + 1.6, base + 3.4, 2.7, 0.5, 0.25);
  gableInfill(m, f, 2.7, base + 3.4, porchRidge - 0.15, pz + 1.62, BLUE);
  for (let i = 0; i < 3; i++) box(m, f, 0, base - 0.15 - i * 0.18, pz + 1.0 + i * 0.4, 5.6 + i * 0.4, 0.2, 2.6, STONE_LIGHT);
  door(m, glow, f, -0.75, base, d / 2 + 0.02, BLUE);
  door(m, glow, f, 0.75, base, d / 2 + 0.02, BLUE);
  // Pennants on the front and lanterns by the steps.
  banner(m, f, -w / 2 + 0.7, eave - 0.5, d / 2, BLUE, WHITE);
  banner(m, f, w / 2 - 0.7, eave - 0.5, d / 2, ORANGE, WHITE);
  for (const s of [-1, 1]) {
    const p = f.p(s * 3.4, 0, pz + 2.6);
    lanternPost(m, glow, p[0], f.y, p[2], f.ry + (s < 0 ? Math.PI : 0), 2.6);
  }
  // Cupola on the ridge with a basketball weather vane.
  const cy = ridge + 0.3;
  box(m, f, 0, cy + 0.6, -0.8, 1.4, 1.2, 1.4, WALL);
  for (const s of [-1, 1]) glow.box(f.m(s * 0.71, cy + 0.65, -0.8, 0.03, 0.6, 0.8), GLASS);
  glow.box(f.m(0, cy + 0.65, -0.09, 0.8, 0.6, 0.03), GLASS);
  m.cone(f.m(0, cy + 1.6, -0.8, 2.0, 0.9, 2.0, Math.PI / 4), C("#4a5868"), 4);
  box(m, f, 0, cy + 2.4, -0.8, 0.06, 0.9, 0.06, IRON);
  m.sphere(f.m(0, cy + 2.9, -0.8, 0.28, 0.28, 0.28), ORANGE, 5, 8);
  box(m, f, 0, cy + 2.9, -0.8, 0.6, 0.04, 0.04, IRON);
  // Side yard: a ball cage, a bike rack and a bench.
  const yard = new Frame(...f.p(-w / 2 - 1.4, 0, d / 2 - 1.2), f.ry);
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) box(m, yard, x, 0.6, z, 0.06, 1.2, 0.06, IRON);
  box(m, yard, 0, 1.2, 0, 1.3, 0.05, 1.3, IRON);
  for (let i = 0; i < 6; i++) m.sphere(yard.m(-0.3 + (i % 3) * 0.3, 0.25 + Math.floor(i / 3) * 0.3, (hash2(i, 3) - 0.5) * 0.6, 0.15, 0.15, 0.15), i % 2 ? ORANGE : WHITE, 4, 6);
  const rack = new Frame(...f.p(w / 2 + 1.0, 0, d / 2 - 0.6), f.ry + Math.PI / 2);
  for (let i = 0; i < 4; i++) m.torus(rack.m(-0.9 + i * 0.6, 0.45, 0, 0.45, 0.45, 0.45, Math.PI / 2), IRON, 1, 0.06, 10, 4);
  const seat = f.p(w / 2 + 1.1, 0, -1.6);
  bench(m, seat[0], f.y, seat[2], f.ry - Math.PI / 2, b.seed + 5);
}

// ------------------------------------------------------------------ Club Beaver

/**
 * A log dance hall with a tall western false front: plum boards edged with marquee bulbs, round
 * porthole windows, a bulb-lit entrance canopy with a red carpet and velvet ropes, speaker stacks,
 * and a disco ball turning above the false front.
 */
export function clubBeaver(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const w = b.w, d = b.d, base = 0.5, eave = 4.6, front = 7.2;
  const PLUM = C("#3a2650"), PLUM_LIGHT = C("#55396f"), PINK = C("#ff4fa3"), TEAL = C("#3ff0e0");
  plinth(m, f, w, d, base, b.seed);
  // Stacked log walls with notched corners (like the cabins, but longer).
  for (let i = 0; i < 11; i++) {
    const y = base + 0.2 + i * 0.4, col = vary(i % 2 ? LOG : LOG_LIGHT, i + b.seed, 0.06);
    log(m, f, 0, y, -d / 2, w + 0.5, 0.21, "x", col);
    for (const s of [-1, 1]) log(m, f, s * (w / 2), y + 0.2, 0, d + 0.5, 0.21, "z", col);
  }
  box(m, f, 0, (base + eave) / 2, 0, w - 0.3, eave - base, d - 0.3, C("#3a2a20"));
  gableRoofZ(m, f, 0, -d / 2 - 0.5, d / 2 - 0.2, eave, w / 2, 0.42, 0.6);
  // The false front: a tall flat facade with a stepped top.
  box(m, f, 0, (base + front) / 2, d / 2 + 0.15, w + 0.2, front - base, 0.3, PLUM);
  box(m, f, 0, front + 0.5, d / 2 + 0.15, w * 0.55, 1.0, 0.3, PLUM);
  box(m, f, 0, front + 1.1, d / 2 + 0.15, w * 0.55 + 0.3, 0.2, 0.4, GOLD);
  box(m, f, 0, front + 0.05, d / 2 + 0.15, w + 0.5, 0.2, 0.42, GOLD);
  for (let i = 0; i < 9; i++) box(m, f, -w / 2 + 0.6 + i * ((w - 1.2) / 8), (base + front) / 2, d / 2 + 0.31, 0.1, front - base - 0.4, 0.04, PLUM_LIGHT);
  // Marquee bulbs round the facade edge.
  for (let i = 0; i <= 22; i++) {
    const x = -w / 2 + (w * i) / 22;
    glow.sphere(f.m(x, front - 0.2, d / 2 + 0.34, 0.09, 0.09, 0.09), i % 2 ? C("#ffe2a0") : PINK, 3, 4);
  }
  for (let i = 0; i <= 12; i++) for (const s of [-1, 1]) glow.sphere(f.m(s * (w / 2 - 0.05), base + 0.4 + (i * (front - base - 0.8)) / 12, d / 2 + 0.34, 0.09, 0.09, 0.09), i % 2 ? TEAL : C("#ffe2a0"), 3, 4);
  // Porthole windows with timber rings.
  for (const x of [-3.6, 3.6]) {
    m.torus(f.m(x, base + 2.6, d / 2 + 0.34, 1, 1, 1, 0, Math.PI / 2), TIMBER, 0.62, 0.13, 16, 5);
    glow.cylinder(f.m(x, base + 2.6, d / 2 + 0.3, 1.2, 0.06, 1.2, 0, Math.PI / 2, 0), TEAL, 14);
    flowerBox(m, f, x, base + 1.65, d / 2 + 0.5, 1.5, b.seed + x);
  }
  // Entrance: double doors glowing pink, a bulb-lit canopy on brass poles, red carpet and ropes.
  box(m, f, 0, base + 1.4, d / 2 + 0.34, 2.8, 2.8, 0.1, C("#1a1626"));
  glow.box(f.m(0, base + 1.35, d / 2 + 0.42, 2.3, 2.5, 0.03), PINK);
  box(m, f, 0, base + 1.35, d / 2 + 0.46, 0.08, 2.5, 0.04, GOLD);
  const cz = d / 2 + 1.1;
  box(m, f, 0, base + 3.1, cz, 4.4, 0.25, 1.8, PLUM_LIGHT);
  box(m, f, 0, base + 3.25, cz, 4.6, 0.08, 2.0, GOLD);
  for (let i = 0; i < 12; i++) glow.sphere(f.m(-2.1 + (i * 4.2) / 11, base + 2.95, cz + 0.9, 0.09, 0.09, 0.09), C("#ffe2a0"), 3, 4);
  for (const s of [-1, 1]) m.cylinder(f.m(s * 2.05, base + 1.5, cz + 0.75, 0.12, 3.0, 0.12), GOLD, 6);
  // Speaker stacks either side of the door.
  for (const s of [-1, 1]) {
    const sp = new Frame(...f.p(s * (w / 2 + 0.75), base, d / 2 - 0.3), f.ry);
    for (let k = 0; k < 2; k++) {
      box(m, sp, 0, 0.55 + k * 1.05, 0, 1.0, 1.0, 0.9, C("#1d1d24"));
      m.cylinder(sp.m(0, 0.55 + k * 1.05, 0.46, 0.65, 0.06, 0.65, 0, Math.PI / 2, 0), C("#3a3a42"), 12);
      m.cylinder(sp.m(0, 0.55 + k * 1.05, 0.48, 0.22, 0.06, 0.22, 0, Math.PI / 2, 0), C("#55555f"), 8);
    }
  }
  // A disco ball on a gantry over the false front, with two spotlights.
  const top = f.p(0, front + 2.5, d / 2 + 0.1);
  box(m, f, 0, front + 1.6, d / 2 + 0.15, 0.12, 1.2, 0.12, IRON);
  glow.sphere(compose(top[0], top[1], top[2], 0, 0, 0, 0.75), (x, y, z) => (Math.floor(x * 9 + y * 7 + z * 5) % 2 ? C("#e6f0fa") : C("#8fa3b8")), 6, 10);
  for (const s of [-1, 1]) {
    box(m, f, s * (w / 2 - 0.4), front + 0.5, d / 2 + 0.3, 0.4, 0.4, 0.5, IRON, 0, -0.5, 0);
    glow.cylinder(f.m(s * (w / 2 - 0.4), front + 0.58, d / 2 + 0.55, 0.3, 0.04, 0.3, 0, Math.PI / 2 - 0.5, 0), C("#fff6d8"), 8);
  }
  // Chimney at the back for the bar's stove.
  chimney(m, f, -w / 2 + 1.2, -d / 2 + 1.2, eave - 1.0, eave + 2.6, 0.8, b.seed);
  t.chimneys.push(f.p(-w / 2 + 1.2, eave + 3.1, -d / 2 + 1.2));
}

// ------------------------------------------------------------------ The Lucky Lodge

/**
 * A grand mountain hall: a dressed-stone ground floor, an oxblood timber-framed upper storey,
 * twin turrets with gold finials, a bulb-lit marquee, a four-leaf-clover crest in the gable and a
 * giant fan of playing cards on the roof.
 */
export function casino(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const w = b.w, d = b.d, base = 0.6, g1 = 3.4, eave = 6.4;
  const OX = C("#7a2230"), OX_LIGHT = C("#9a3a46"), GREEN = C("#3f9a5a");
  plinth(m, f, w, d, base, b.seed);
  // Ground floor in dressed stone courses.
  box(m, f, 0, (base + g1) / 2, 0, w, g1 - base, d, STONE);
  for (let r = 0; r < 5; r++) {
    const y = base + 0.28 + r * 0.56;
    const n = 9;
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w * (i + (r % 2 ? 0.5 : 0) + 0.5)) / n;
      if (x > w / 2 - 0.2) continue;
      box(m, f, x, y, d / 2 + 0.04, w / n - 0.06, 0.5, 0.08, vary(mixRgb(STONE, STONE_LIGHT, hash2(i, r)), i * 7 + r, 0.08));
    }
  }
  // Upper storey, jettied out a little, with timber framing.
  box(m, f, 0, (g1 + eave) / 2 + 0.05, 0.1, w + 0.2, eave - g1, d + 0.2, OX);
  timberFrame(m, f, w + 0.2, g1 + 0.05, eave + 0.05, d / 2 + 0.21, b.seed);
  box(m, f, 0, g1 + 0.05, d / 2 + 0.25, w + 0.4, 0.28, 0.3, GOLD);
  for (const x of [-3.4, -1.1, 1.1, 3.4]) windowPane(m, glow, f, x, g1 + 1.5, d / 2 + 0.22, 1.0, 1.5, 0, true);
  for (const x of [-3.4, 3.4]) windowPane(m, glow, f, x, base + 1.5, d / 2 + 0.08, 1.6, 1.6, 0, true);
  for (const s of [-1, 1]) for (const z of [-1.8, 1.8]) {
    windowPane(m, glow, f, s * (w / 2 + 0.12), g1 + 1.5, z, 1.0, 1.4, (s * Math.PI) / 2, true);
    windowPane(m, glow, f, s * (w / 2 + 0.02), base + 1.5, z, 1.2, 1.4, (s * Math.PI) / 2);
  }
  // Roof along the frontage with a gold ridge, a front cross-gable with the clover crest.
  const ridge = gableRoofX(m, f, 0, eave, d / 2 + 0.2, w + 0.9, 0.55, 0.6);
  box(m, f, 0, ridge + 0.5, 0, w + 0.3, 0.12, 0.44, GOLD);
  const cg = gableRoofZ(m, f, 0, 0, d / 2 + 0.9, eave, 2.4, 0.6, 0.35);
  panel(m, f, [[-2.4, eave, d / 2 + 0.88], [2.4, eave, d / 2 + 0.88], [0, cg - 0.15, d / 2 + 0.88]], [0, 0, 1], OX_LIGHT);
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    m.sphere(f.m(Math.cos(a) * 0.32, eave + 1.0 + Math.sin(a) * 0.32, d / 2 + 0.95, 0.34, 0.34, 0.08), GREEN, 5, 8);
  }
  box(m, f, 0.1, eave + 0.55, d / 2 + 0.95, 0.08, 0.5, 0.06, GREEN, 0, 0, -0.3);
  // Turrets at the two front corners.
  for (const s of [-1, 1]) {
    const tx = s * (w / 2 + 0.2), tz = d / 2 - 0.2;
    m.cylinder(f.m(tx, (base + eave + 1.2) / 2, tz, 2.0, eave + 1.2 - base, 2.0), STONE_LIGHT, 12);
    box(m, f, tx, eave + 1.2, tz, 2.3, 0.2, 2.3, GOLD);
    m.cone(f.m(tx, eave + 2.6, tz, 2.5, 2.6, 2.5), C("#4a5868"), 12);
    m.sphere(f.m(tx, eave + 4.0, tz, 0.22, 0.22, 0.22), GOLD, 4, 6);
    box(m, f, tx, eave + 4.4, tz, 0.05, 0.6, 0.05, GOLD);
    for (const y of [base + 1.8, g1 + 1.6]) windowPane(m, glow, new Frame(...f.p(tx, 0, tz), f.ry), 0, y, 1.0, 0.6, 1.0, 0, true);
  }
  // Marquee canopy with chasing bulbs over the double doors.
  door(m, glow, f, -0.75, base, d / 2 + 0.06, C("#3a0f16"));
  door(m, glow, f, 0.75, base, d / 2 + 0.06, C("#3a0f16"));
  const mz = d / 2 + 1.3;
  box(m, f, 0, g1 - 0.1, mz, 5.4, 0.35, 2.4, C("#1a1626"));
  box(m, f, 0, g1 + 0.12, mz, 5.6, 0.1, 2.6, GOLD);
  for (let i = 0; i < 18; i++) glow.sphere(f.m(-2.6 + (i * 5.2) / 17, g1 - 0.32, mz + 1.2, 0.1, 0.1, 0.1), C("#ffe2a0"), 3, 4);
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) glow.sphere(f.m(s * 2.7, g1 - 0.32, mz - 1.0 + i * 0.44, 0.1, 0.1, 0.1), C("#ffe2a0"), 3, 4);
  for (const s of [-1, 1]) m.cylinder(f.m(s * 2.55, (base + g1) / 2, mz + 1.05, 0.14, g1 - base, 0.14), GOLD, 6);
  box(m, f, 0, base + 0.03, mz + 1.0, 2.2, 0.04, 3.6, C("#2f5a3a"));
  // Topiary in planters by the steps.
  for (const s of [-1, 1]) {
    const p = new Frame(...f.p(s * 3.6, base, mz + 1.4), f.ry);
    box(m, p, 0, 0.35, 0, 0.8, 0.7, 0.8, STONE_LIGHT);
    m.sphere(p.m(0, 1.1, 0, 0.5, 0.5, 0.5), C("#3f7a3a"), 5, 8);
    m.sphere(p.m(0, 1.75, 0, 0.32, 0.32, 0.32), C("#4a8a42"), 5, 8);
  }
  // A fan of giant playing cards and a pair of dice on the roof.
  const cards = f.p(0, ridge + 1.6, -0.6);
  for (let i = 0; i < 4; i++) {
    const fr = new Frame(cards[0], cards[1], cards[2], f.ry);
    const a = (i - 1.5) * 0.28;
    box(m, fr, Math.sin(a) * 1.0, -Math.cos(a) * 0.2, i * 0.05, 1.4, 2.0, 0.08, WHITE, 0, 0, -a);
    const sym = [C("#d33b2c"), IRON, C("#d33b2c"), IRON][i];
    box(m, fr, Math.sin(a) * 1.25, 0.2 - Math.cos(a) * 0.2, i * 0.05 + 0.06, 0.4, 0.4, 0.03, sym, 0, 0, -a + Math.PI / 4);
  }
  for (const [dx, dr] of [[w / 2 - 1.6, 0.3], [w / 2 - 2.6, 1.1]] as const) {
    const dp = f.p(dx, eave + 0.55, d / 2 - 0.3);
    m.box(compose(dp[0], dp[1], dp[2], f.ry + dr, 0.2, 0.1, 0.7, 0.7, 0.7), WHITE);
  }
}

// ------------------------------------------------------------------ Boxing Gym

/**
 * An old red-brick gym: brick courses on the front, a stone base, a north-light sawtooth roof with
 * glowing skylights, a tall arched factory window with iron mullions, a painted wall sign, a water
 * tank on the roof and a pair of giant gloves over the door.
 */
export function boxingGym(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const w = b.w, d = b.d, base = 0.5, eave = 4.8;
  const BRICK = C("#a34a32"), BRICK_D = C("#8a3a26"), BRICK_L = C("#b65a3e"), MORTAR = C("#d8c8b0");
  plinth(m, f, w, d, base, b.seed);
  box(m, f, 0, (base + eave) / 2, 0, w, eave - base, d, MORTAR);
  // Brick courses on all four faces (each brick a small box, staggered).
  const bh = 0.28, bw = 0.62;
  for (let r = 0; r < Math.floor((eave - base) / bh); r++) {
    const y = base + bh / 2 + r * bh;
    const off = r % 2 ? bw / 2 : 0;
    for (let x = -w / 2 + off; x < w / 2 - 0.05; x += bw) {
      const bx = Math.min(x + bw / 2, w / 2 - bw / 2);
      const col = [BRICK, BRICK_D, BRICK_L][Math.floor(hash2(r, x * 3) * 3)];
      box(m, f, bx, y, d / 2 + 0.03, bw - 0.05, bh - 0.05, 0.06, col);
    }
    if (r % 2 === 0) for (const s of [-1, 1]) box(m, f, s * (w / 2 + 0.03), y, 0, 0.06, bh - 0.05, d - 0.1, r % 4 ? BRICK : BRICK_D);
  }
  // Stone quoins at the corners and a band at the eaves.
  for (const sx of [-1, 1]) for (let r = 0; r < 8; r++) box(m, f, sx * (w / 2 - 0.15), base + 0.25 + r * 0.55, d / 2 + 0.06, r % 2 ? 0.6 : 0.4, 0.5, 0.12, STONE_LIGHT);
  box(m, f, 0, eave + 0.05, 0, w + 0.3, 0.3, d + 0.3, STONE_LIGHT);
  // A tall arched factory window with iron mullions, and the door with a transom.
  const wx = -1.3, ww = 3.6, wh = 2.6;
  box(m, f, wx, base + 2.0, d / 2 + 0.05, ww + 0.3, wh + 0.3, 0.12, STONE_LIGHT);
  glow.box(f.m(wx, base + 2.0, d / 2 + 0.1, ww, wh, 0.04), GLASS);
  glow.cylinder(f.m(wx, base + 2.0 + wh / 2, d / 2 + 0.1, ww, 0.04, ww * 0.55, 0, Math.PI / 2, 0), GLASS, 14, 0.5, 0.5);
  for (let i = 1; i < 6; i++) box(m, f, wx - ww / 2 + (ww * i) / 6, base + 2.0, d / 2 + 0.14, 0.05, wh, 0.04, IRON);
  for (let k = 1; k < 4; k++) box(m, f, wx, base + 2.0 - wh / 2 + (wh * k) / 4, d / 2 + 0.14, ww, 0.05, 0.04, IRON);
  door(m, glow, f, 2.6, base, d / 2 + 0.05, C("#2a2a30"));
  glow.box(f.m(2.6, base + 2.6, d / 2 + 0.1, 1.1, 0.4, 0.03), GLASS);
  // Painted wall sign band above the window (the neon BOXING sits on it).
  box(m, f, 0, eave - 0.6, d / 2 + 0.07, w - 0.6, 0.9, 0.04, C("#efe2c8"));
  // Sawtooth roof: three teeth, steep glazed face toward the back.
  const n = 3, tw = d / n;
  for (let i = 0; i < n; i++) {
    const z0 = d / 2 - i * tw, z1 = z0 - tw;
    const hy = 1.6;
    const slope = Math.hypot(tw, hy);
    box(m, f, 0, eave + 0.2 + hy / 2, (z0 + z1) / 2, w + 0.3, 0.2, slope, C("#4a5868"), 0, Math.atan2(hy, tw), 0);
    glow.box(f.m(0, eave + 0.2 + hy / 2, z1 + 0.05, w - 0.6, hy - 0.2, 0.05), C("#cfe8ff"));
    box(m, f, 0, eave + 0.2 + hy / 2, z1, w + 0.3, hy, 0.12, IRON);
  }
  // A water tank on stilts and a brick chimney.
  const tank = new Frame(...f.p(w / 2 - 1.6, eave + 1.9, -d / 2 + 1.8), f.ry);
  for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) box(m, tank, x, 0.6, z, 0.1, 1.2, 0.1, TIMBER);
  m.cylinder(tank.m(0, 1.8, 0, 1.8, 1.4, 1.8), TIMBER_LIGHT, 12);
  for (const y of [1.3, 2.3]) m.cylinder(tank.m(0, y, 0, 1.86, 0.08, 1.86), IRON, 12);
  m.cone(tank.m(0, 2.85, 0, 2.0, 0.7, 2.0), C("#4a5868"), 12);
  chimney(m, f, -w / 2 + 1.0, -d / 2 + 1.0, eave - 0.5, eave + 3.0, 0.8, b.seed);
  t.chimneys.push(f.p(-w / 2 + 1.0, eave + 3.5, -d / 2 + 1.0));
  // Giant gloves hanging over the door and a punching-bag sign.
  // (off to the side of the painted sign band, so the neon BOXING stays readable)
  for (const s of [-1, 1]) {
    m.sphere(f.m(3.55 + s * 0.42, base + 2.9, d / 2 + 0.45, 0.38, 0.44, 0.33), C("#d33b2c"), 6, 8);
    m.sphere(f.m(3.55 + s * 0.58, base + 3.05, d / 2 + 0.55, 0.15, 0.18, 0.13), C("#d33b2c"), 4, 6);
    box(m, f, 3.55 + s * 0.42, base + 2.5, d / 2 + 0.4, 0.28, 0.18, 0.28, WHITE);
  }
  box(m, f, 3.55, base + 3.4, d / 2 + 0.3, 0.9, 0.04, 0.04, C("#f2efe8"));
  hangingSign(m, f, -w / 2 + 0.5, base + 3.3, d / 2 - 0.1, C("#d33b2c"), (fr) => {
    m.cylinder(fr.m(0, 0.6, 0, 0.35, 0.7, 0.35), C("#c8323a"), 8);
    m.cylinder(fr.m(0, 1.05, 0, 0.04, 0.3, 0.04), IRON, 4);
  });
  // Crates and a jump rope by the door.
  for (let i = 0; i < 3; i++) box(m, f, w / 2 + 0.7, 0.35 + Math.floor(i / 2) * 0.7, d / 2 - 0.6 - (i % 2) * 0.8, 0.7, 0.7, 0.7, vary(TIMBER_LIGHT, i, 0.1), (i * 0.3) % 1);
}

// ------------------------------------------------------------------ Fort Timber

/** A proper log stockade: sharpened palisade, roofed corner towers, a wall walk, a gate with doors, torches and banners. */
export function fort(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const half = b.w / 2;
  for (const [sx, sz, along] of [[0, -1, "x"], [0, 1, "x"], [-1, 0, "z"], [1, 0, "z"]] as const) {
    for (let i = -half; i <= half; i += 0.5) {
      const lx = along === "x" ? i : sx * half, lz = along === "x" ? sz * half : i;
      if (sz === 1 && Math.abs(i) < 1.3) continue; // the gate
      const hh = 3.0 + hash2(i, sz + sx * 3) * 0.6;
      m.cylinder(f.m(lx, hh / 2, lz, 0.48, hh, 0.48), vary(LOG, Math.round(i * 10) + sx * 3 + sz, 0.12), 6);
      m.cone(f.m(lx, hh + 0.25, lz, 0.48, 0.5, 0.48), LOG_LIGHT, 6);
    }
    // Horizontal binding logs on the outside.
    const len = b.w;
    if (along === "x") for (const y of [0.9, 2.2]) {
      if (sz === 1) for (const s of [-1, 1]) log(m, f, s * (half + 1.3) / 2, y, sz * (half + 0.25), half - 1.3, 0.12, "x", TIMBER);
      else log(m, f, 0, y, sz * (half + 0.25), len, 0.12, "x", TIMBER);
    } else for (const y of [0.9, 2.2]) log(m, f, sx * (half + 0.25), y, 0, len, 0.12, "z", TIMBER);
  }
  // Wall walk inside, on posts.
  for (const [sx, sz] of [[0, -1], [-1, 0], [1, 0]] as const) {
    const lx = sx * (half - 0.9), lz = sz * (half - 0.9);
    if (sx === 0) box(m, f, 0, 2.2, lz, b.w - 1.2, 0.15, 1.2, TIMBER_LIGHT);
    else box(m, f, lx, 2.2, 0, 1.2, 0.15, b.w - 1.2, TIMBER_LIGHT);
  }
  // Corner towers with shingled roofs, windows and torches.
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const tx = sx * half, tz = sz * half;
    m.cylinder(f.m(tx, 2.4, tz, 1.8, 4.8, 1.8), LOG, 8);
    for (const y of [1.2, 2.6, 4.0]) m.cylinder(f.m(tx, y, tz, 1.88, 0.14, 1.88), TIMBER, 8);
    box(m, f, tx, 4.9, tz, 2.6, 0.2, 2.6, TIMBER_LIGHT);
    for (const [px, pz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) box(m, f, tx + px * 1.1, 5.6, tz + pz * 1.1, 0.16, 1.4, 0.16, TIMBER);
    m.cone(f.m(tx, 7.0, tz, 3.4, 1.6, 3.4, Math.PI / 4), C("#2f6b3a"), 4);
    m.cone(f.m(tx, 7.3, tz, 3.0, 1.3, 3.0, Math.PI / 4), C("#3a7a44"), 4);
    box(m, f, tx, 8.1, tz, 0.06, 0.8, 0.06, IRON);
    box(m, f, tx + 0.35, 8.3, tz, 0.7, 0.4, 0.03, sx * sz > 0 ? C("#e2483d") : C("#f5c242"));
    glow.box(f.m(tx + sx * 0.92, 3.3, tz, 0.04, 0.5, 0.35), GLASS);
    glow.box(f.m(tx, 3.3, tz + sz * 0.92, 0.35, 0.5, 0.04), GLASS);
  }
  // The gatehouse: a beam lintel, open plank doors, a banner and two torches.
  box(m, f, 0, 3.4, half, 3.4, 0.5, 0.6, TIMBER);
  for (const s of [-1, 1]) {
    box(m, f, s * 1.2, 1.5, half + 0.9, 1.1, 2.8, 0.12, TIMBER_LIGHT, s * 1.2);
    m.cylinder(f.m(s * 1.55, 1.8, half + 0.45, 0.14, 1.0, 0.14), TIMBER, 6);
    glow.cone(f.m(s * 1.55, 2.5, half + 0.45, 0.3, 0.5, 0.3), C("#ffb04a"), 6);
  }
  for (const s of [-1, 1]) banner(m, f, s * (half - 1.4), 4.0, half - 0.6, C("#2f6b3a"), C("#f5c242"));
  // Inside: a pinecone launcher, a stack of cones and barrels.
  const yard = new Frame(...f.p(0, 0, -0.6), f.ry);
  box(m, yard, 0, 0.35, 0, 1.4, 0.3, 1.0, TIMBER);
  box(m, yard, 0, 1.0, 0, 0.15, 0.15, 1.6, TIMBER_LIGHT, 0, -0.6, 0);
  for (let i = 0; i < 6; i++) m.sphere(yard.m(1.2 + (i % 3) * 0.3, 0.2 + Math.floor(i / 3) * 0.28, 0.6, 0.16, 0.22, 0.16), C("#c47a2c"), 4, 6);
  for (let i = 0; i < 2; i++) m.cylinder(yard.m(-1.4, 0.45, -0.6 + i * 0.9, 0.7, 0.9, 0.7), LOG, 10);
}

// ------------------------------------------------------------------ The Estate Gate

/** Grand gate piers topped with chess pieces, lamps, an iron arch, and a run of railings and hedge either side. */
export function estateGate(t: TownMeshes, f: Frame, b: TownBuilding) {
  const { body: m, glow } = t;
  const hw = b.w / 2;
  for (const s of [-1, 1]) {
    const x = s * hw;
    plinth(m, new Frame(...f.p(x, 0, 0), f.ry), 1.1, 1.1, 0.4, b.seed + s);
    box(m, f, x, 2.1, 0, 1.2, 3.4, 1.2, STONE_LIGHT);
    for (let r = 0; r < 6; r++) box(m, f, x, 0.7 + r * 0.55, 0.62, r % 2 ? 1.0 : 1.2, 0.5, 0.06, vary(STONE_LIGHT, r + s * 7, 0.06));
    box(m, f, x, 3.85, 0, 1.45, 0.25, 1.45, STONE);
    // Lamps on brackets.
    box(m, f, x - s * 0.62, 3.1, 0.5, 0.06, 0.06, 0.5, IRON);
    box(m, f, x - s * 0.62, 2.85, 0.75, 0.3, 0.04, 0.3, IRON);
    glow.box(f.m(x - s * 0.62, 2.62, 0.75, 0.22, 0.4, 0.22), GLASS);
    m.cone(f.m(x - s * 0.62, 3.0, 0.75, 0.4, 0.22, 0.4, Math.PI / 4), IRON, 4);
    if (s < 0) {
      m.cylinder(f.m(x, 4.5, 0, 0.8, 1.1, 0.8), WHITE, 10);
      for (let k = 0; k < 4; k++) box(m, f, x + Math.cos((k * Math.PI) / 2) * 0.32, 5.15, Math.sin((k * Math.PI) / 2) * 0.32, 0.25, 0.25, 0.25, WHITE);
    } else {
      m.cylinder(f.m(x, 4.3, 0, 0.8, 0.6, 0.8), C("#2a2a30"), 10);
      box(m, f, x, 5.0, 0.1, 0.45, 1.0, 0.6, C("#2a2a30"), 0, -0.3, 0);
      box(m, f, x, 5.35, 0.45, 0.4, 0.35, 0.6, C("#2a2a30"));
    }
  }
  // Iron arch with scrolls.
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    m.sphere(f.m(Math.cos(a) * (hw - 0.3), 3.6 + Math.sin(a) * 1.5, 0, 0.12, 0.12, 0.12), IRON, 3, 4);
  }
  for (let i = 0; i < 8; i++) box(m, f, -0.7 + (i % 4) * 0.47, 4.65 + Math.floor(i / 4) * 0.47, 0.1, 0.47, 0.47, 0.06, (i + Math.floor(i / 4)) % 2 ? C("#d33b2c") : WHITE);
  // Railings and a clipped hedge running out from each pier.
  for (const s of [-1, 1]) {
    for (let i = 0; i < 14; i++) {
      const x = s * (hw + 0.8 + i * 0.4);
      box(m, f, x, 0.9, 0, 0.06, 1.8, 0.06, IRON);
      m.cone(f.m(x, 1.88, 0, 0.12, 0.18, 0.12), GOLD, 4);
    }
    for (const y of [0.4, 1.6]) box(m, f, s * (hw + 3.4), y, 0, 5.6, 0.06, 0.06, IRON);
    box(m, f, s * (hw + 3.4), 0.55, -0.7, 5.8, 1.1, 0.9, C("#3f7a3a"));
    for (let i = 0; i < 6; i++) m.sphere(f.m(s * (hw + 1.0 + i), 1.15, -0.7, 0.55, 0.35, 0.5), C("#4a8a42"), 4, 6);
  }
}

// ------------------------------------------------------------------ Outdoor areas

/** The Downtown plaza: a fountain with a bronze beaver holding a trophy, planters, benches, lanterns and a signpost. */
export function plaza(t: TownMeshes, x: number, y: number, z: number, r: number) {
  const { body: m, glow, ice } = t;
  const f = new Frame(x, y, z, 0);
  // Fountain: stepped stone basin, water, a pedestal and the statue.
  m.cylinder(f.m(0, 0.25, 0, 5.0, 0.5, 5.0), STONE_LIGHT, 24);
  m.cylinder(f.m(0, 0.55, 0, 5.2, 0.12, 5.2), STONE, 24);
  ice.cylinder(f.m(0, 0.48, 0, 4.4, 0.06, 4.4), C("#7fd0e0"), 24);
  m.cylinder(f.m(0, 1.0, 0, 1.3, 1.6, 1.3), STONE, 10);
  m.cylinder(f.m(0, 1.85, 0, 1.6, 0.14, 1.6), STONE_LIGHT, 10);
  const BRONZE = C("#9a6a3a"), k = 1.7, by = 1.92;
  const S = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, ry = 0, rx = 0, rz = 0) => f.m(lx * k, by + (ly - by) * k, lz * k, sx * k, sy * k, sz * k, ry, rx, rz);
  m.sphere(S(0, 2.6, 0, 0.5, 0.65, 0.42), BRONZE, 6, 8); // body
  m.sphere(S(0, 2.65, 0.32, 0.32, 0.42, 0.14), C("#b88a52"), 5, 8); // tummy
  m.sphere(S(0, 3.4, 0.05, 0.38, 0.36, 0.36), BRONZE, 6, 8); // head
  m.sphere(S(0, 3.32, 0.36, 0.17, 0.13, 0.13), C("#b88a52"), 4, 6); // muzzle
  m.box(S(0, 3.2, 0.44, 0.12, 0.1, 0.04), C("#f2efe8")); // teeth
  for (const s of [-1, 1]) m.sphere(S(s * 0.24, 3.7, 0, 0.1, 0.1, 0.08), BRONZE, 3, 4);
  m.box(S(0, 2.2, -0.45, 0.5, 0.12, 0.7, 0, 0.5, 0), BRONZE); // tail
  m.box(S(0.3, 3.35, 0, 0.14, 0.7, 0.14, 0, 0, -0.5), BRONZE); // raised arm
  m.cylinder(S(0.55, 3.9, 0, 0.36, 0.4, 0.36), GOLD, 10, 0.5, 0.3); // trophy cup
  m.cylinder(S(0.55, 3.62, 0, 0.12, 0.2, 0.12), GOLD, 6);
  // Water spouts round the pedestal (glowing pale blue arcs).
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    for (let k = 0; k < 4; k++) {
      const u = (k + 1) / 5;
      glow.sphere(f.m(Math.cos(a) * (0.7 + u * 1.2), 1.4 + Math.sin(u * Math.PI) * 0.6, Math.sin(a) * (0.7 + u * 1.2), 0.08, 0.08, 0.08), C("#cfefff"), 3, 4);
    }
  }
  // Four benches facing the fountain, flower planters between them, lanterns at the rim.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    bench(m, x + Math.cos(a) * 4.4, y, z + Math.sin(a) * 4.4, -a - Math.PI / 2, 300 + i);
    const pa = a + Math.PI / 4;
    const pf = new Frame(x + Math.cos(pa) * 4.6, y, z + Math.sin(pa) * 4.6, -pa);
    box(m, pf, 0, 0.35, 0, 1.4, 0.7, 0.7, STONE_LIGHT);
    for (let k = 0; k < 5; k++) m.sphere(pf.m(-0.5 + k * 0.25, 0.8, (hash2(k, i) - 0.5) * 0.3, 0.18, 0.16, 0.18), ["#e2483d", "#ff7eb3", "#ffd93b", "#a77bff", "#ffffff"].map(C)[(k + i) % 5], 3, 5);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    if (i % 2) continue;
    lanternPost(m, glow, x + Math.cos(a) * (r + 0.3), y, z + Math.sin(a) * (r + 0.3), -a, 3.0);
  }
  // A signpost with arrows to everything in Downtown.
  const sp = new Frame(x + r - 1.2, y, z + r - 1.2, 0);
  box(m, sp, 0, 1.6, 0, 0.18, 3.2, 0.18, TIMBER);
  const arrows: [number, string][] = [[Math.PI, "#ff4fa3"], [0, "#2f63b8"], [-Math.PI / 2, "#7a2230"], [Math.PI / 2, "#a34a32"], [2.4, "#7a52c7"]];
  arrows.forEach(([a, col], i) => {
    const fr = new Frame(...sp.p(0, 2.9 - i * 0.38, 0), a);
    box(m, fr, 0.55, 0, 0, 1.1, 0.26, 0.06, C(col));
    m.cone(fr.m(1.18, 0, 0, 0.3, 0.26, 0.06, 0, 0, -Math.PI / 2), C(col), 3);
  });
}

/** The outdoor dance floor's stage: a lighting truss with coloured lamps, speaker towers and a DJ desk. */
export function danceStage(t: TownMeshes, x: number, y: number, z: number, r: number) {
  const { body: m, glow } = t;
  const f = new Frame(x, y, z, 0);
  const h = 3.6;
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const px = sx * (r + 0.4), pz = sz * (r + 0.4);
    box(m, f, px, h / 2, pz, 0.24, h, 0.24, IRON);
    for (let k = 0; k < 5; k++) box(m, f, px, 0.4 + k * 0.7, pz, 0.32, 0.04, 0.04, C("#55555f"), 0, 0, 0.6);
  }
  for (const s of [-1, 1]) {
    box(m, f, 0, h, s * (r + 0.4), 2 * r + 1.0, 0.24, 0.24, IRON);
    box(m, f, s * (r + 0.4), h, 0, 0.24, 0.24, 2 * r + 1.0, IRON);
  }
  const cols = ["#ff4fa3", "#3ff0e0", "#ffcf3f", "#b07bff"].map(C);
  for (let i = 0; i < 8; i++) {
    const u = (i + 0.5) / 8;
    const lx = -r + u * 2 * r;
    for (const s of [-1, 1]) {
      box(m, f, lx, h - 0.25, s * (r + 0.4), 0.26, 0.3, 0.3, IRON);
      glow.cylinder(f.m(lx, h - 0.42, s * (r + 0.4), 0.2, 0.04, 0.2), cols[(i + (s > 0 ? 1 : 0)) % 4], 8);
    }
  }
  for (const s of [-1, 1]) {
    const sp = new Frame(x + s * (r + 1.4), y, z - r + 0.4, 0);
    for (let k = 0; k < 3; k++) {
      box(m, sp, 0, 0.5 + k * 0.95, 0, 0.9, 0.9, 0.8, C("#1d1d24"));
      m.cylinder(sp.m(0, 0.5 + k * 0.95, 0.41, 0.6, 0.06, 0.6, 0, Math.PI / 2, 0), C("#3a3a42"), 12);
    }
  }
}

/** Fencing and bleachers round the outdoor courts. */
export function courtsDressing(t: TownMeshes, x: number, y: number, z: number, r: number) {
  const { body: m } = t;
  const f = new Frame(x, y, z, 0);
  const R = r + 0.6;
  for (let i = -R; i <= R + 0.01; i += 1.25) {
    for (const s of [-1, 1]) {
      box(m, f, i, 1.3, s * R, 0.08, 2.6, 0.08, IRON);
      if (Math.abs(i) > 1.2 || s < 0) box(m, f, s * R, 1.3, i, 0.08, 2.6, 0.08, IRON);
    }
  }
  for (const s of [-1, 1]) {
    for (const yy of [0.2, 1.3, 2.55]) {
      box(m, f, 0, yy, s * R, 2 * R, 0.05, 0.05, IRON);
      box(m, f, s * R, yy, 0, 0.05, 0.05, 2 * R, IRON);
    }
    // Chain-link infill (a faint mesh panel).
    box(m, f, 0, 1.3, s * R, 2 * R, 2.4, 0.02, C("#9aa3a8"));
  }
  // Three-tier bleachers along the outside of one side.
  const bl = new Frame(x, y, z - R - 1.6, 0);
  for (let k = 0; k < 3; k++) {
    box(m, bl, 0, 0.35 + k * 0.4, -k * 0.6, 2 * R - 1, 0.12, 0.5, C("#c8a26a"));
    box(m, bl, 0, (0.35 + k * 0.4) / 2, -k * 0.6, 2 * R - 1.2, 0.35 + k * 0.4, 0.08, IRON);
  }
}

/** The spleef stage: an icy rim, banners, and a couple of snow beavers watching. */
export function spleefDressing(t: TownMeshes, x: number, y: number, z: number, r: number) {
  const { body: m, ice } = t;
  const f = new Frame(x, y, z, 0);
  ice.cylinder(f.m(0, 0.05, 0, (r + 1.6) * 2, 0.08, (r + 1.6) * 2), C("#cfeaf5"), 24);
  for (const [a, s] of [[0.8, 0.9], [2.4, 1.0]] as const) {
    const px = Math.cos(a) * (r + 2.6), pz = Math.sin(a) * (r + 2.6);
    m.sphere(f.m(px, 0.55, pz, 0.6 * s, 0.55 * s, 0.6 * s), WHITE, 6, 8);
    m.sphere(f.m(px, 1.35 * s, pz, 0.42 * s, 0.4 * s, 0.42 * s), WHITE, 6, 8);
    m.sphere(f.m(px, 1.95 * s, pz, 0.3 * s, 0.3 * s, 0.3 * s), WHITE, 6, 8);
    for (const e of [-1, 1]) m.sphere(f.m(px + e * 0.18, 2.1 * s, pz, 0.08, 0.08, 0.08), WHITE, 3, 4);
    m.cone(f.m(px, 1.95 * s, pz + 0.3, 0.08, 0.3, 0.08, 0, Math.PI / 2, 0), C("#e8742a"), 5);
    box(m, f, px, 1.6 * s, pz, 0.9, 0.14, 0.1, C("#2fa7a2"), -a);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const px = Math.cos(a) * (r + 1.2), pz = Math.sin(a) * (r + 1.2);
    box(m, f, px, 1.5, pz, 0.08, 3.0, 0.08, IRON);
    box(m, f, px + 0.35, 2.7, pz, 0.7, 0.5, 0.03, i % 2 ? C("#2fa7a2") : C("#ffffff"), -a);
  }
}

