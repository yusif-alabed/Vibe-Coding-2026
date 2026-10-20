import { compose, hexToRgb, mixRgb, type Vec3 } from "../../engine/math";
import { MeshBuilder } from "../../engine/mesh";

/**
 * Cabin furniture models. Each model is centred on its grid footprint (rotation 0),
 * sits on y = 0 and faces +z (towards the camera / front of the cabin).
 * Glowing parts (lamp light, embers) go into a separate mesh that is drawn unlit.
 */

export const CELL = 1.2;

const C = (h: string): Vec3 => hexToRgb(h);
const WOOD = C("#b9773f");
const WOOD_DK = C("#7b4527");
const WOOD_LT = C("#dca06a");
const LOG = C("#9a5f35");
const BARK = C("#6b4126");
const FABRIC_RED = C("#d9534a");
const FABRIC_CREAM = C("#f4e6c8");
const FABRIC_TEAL = C("#2fa7a2");
const FABRIC_MUSTARD = C("#e7b13d");
const IRON = C("#3b3a40");
const BRASS = C("#d8a940");

export interface FurnitureMesh { body: MeshBuilder; glow: MeshBuilder | null }

function legs(m: MeshBuilder, w: number, d: number, h: number, inset: number, col: Vec3, r = 0.06) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.cylinder(compose(sx * (w / 2 - inset), h / 2, sz * (d / 2 - inset), 0, 0, 0, r * 2, h, r * 2), col, 8);
}

/** A soft cushion: a box with rounded (sphere) edges. */
function cushion(m: MeshBuilder, x: number, y: number, z: number, w: number, hgt: number, d: number, col: Vec3, rx = 0) {
  m.box(compose(x, y, z, 0, rx, 0, w - hgt * 0.5, hgt, d - hgt * 0.5), col, 0.04);
  m.sphere(compose(x, y, z, 0, rx, 0, w / 2, hgt / 2, d / 2), col, 6, 12);
}

const builders: Record<string, (m: MeshBuilder, g: MeshBuilder) => void> = {
  rug_round(m) {
    const rings: Vec3[] = [C("#a8643a"), C("#e9c98f"), C("#c0503f"), C("#e9c98f"), C("#3f8f86"), C("#e9c98f")];
    rings.forEach((c, i) => {
      const r = 1.12 - i * 0.17;
      m.cylinder(compose(0, 0.012 + i * 0.004, 0, 0, 0, 0, r * 2, 0.02, r * 2), c, 28);
    });
  },
  rug_plaid(m) {
    const w = 3 * CELL - 0.25, d = 2 * CELL - 0.25;
    m.box(compose(0, 0.012, 0, 0, 0, 0, w, 0.02, d), C("#c4433b"));
    for (let i = -3; i <= 3; i++) {
      m.box(compose((i * w) / 8, 0.024, 0, 0, 0, 0, 0.12, 0.012, d - 0.02), i % 2 ? C("#7a2421") : C("#2c2522"));
    }
    for (let j = -2; j <= 2; j++) m.box(compose(0, 0.026, (j * d) / 6, 0, 0, 0, w - 0.02, 0.012, 0.1), j % 2 ? C("#7a2421") : C("#f2c14e"));
    for (const s of [-1, 1]) for (let k = 0; k < 14; k++) m.box(compose(s * (w / 2 + 0.06), 0.014, -d / 2 + 0.1 + (k * (d - 0.2)) / 13, 0, 0, 0, 0.14, 0.012, 0.03), C("#f4e6c8"));
  },
  armchair(m) {
    const w = 0.98, d = 0.95;
    legs(m, w, d, 0.16, 0.1, WOOD_DK);
    cushion(m, 0, 0.3, 0.02, w, 0.28, d * 0.92, FABRIC_TEAL);
    cushion(m, 0, 0.52, 0.06, w * 0.7, 0.18, d * 0.7, mixRgb(FABRIC_TEAL, [1, 1, 1], 0.15));
    cushion(m, 0, 0.82, -d / 2 + 0.12, w, 0.8, 0.24, FABRIC_TEAL, -0.12);
    for (const s of [-1, 1]) cushion(m, s * (w / 2 - 0.08), 0.56, 0.02, 0.2, 0.36, d * 0.92, mixRgb(FABRIC_TEAL, [0, 0, 0], 0.12));
    m.box(compose(0, 1.02, -d / 2 + 0.06, 0, -0.12, 0, 0.5, 0.42, 0.04), FABRIC_CREAM); // knitted throw
  },
  sofa(m) {
    const w = 2 * CELL - 0.2, d = 0.98;
    legs(m, w, d, 0.14, 0.12, WOOD_DK);
    m.box(compose(0, 0.24, 0, 0, 0, 0, w, 0.18, d), LOG);
    for (const s of [-1, 1]) cushion(m, s * (w / 4 - 0.06), 0.42, 0.06, w / 2 - 0.16, 0.2, d * 0.78, FABRIC_RED);
    cushion(m, 0, 0.78, -d / 2 + 0.15, w - 0.1, 0.72, 0.26, mixRgb(FABRIC_RED, [0, 0, 0], 0.1), -0.1);
    for (const s of [-1, 1]) {
      m.cylinder(compose(s * (w / 2 - 0.1), 0.52, 0, 0, Math.PI / 2, 0, 0.26, d, 0.26), LOG, 10);
      m.cylinder(compose(s * (w / 2 - 0.1), 0.52, d / 2 + 0.001, 0, Math.PI / 2, 0, 0.2, 0.02, 0.2), WOOD_LT, 10);
    }
    m.box(compose(-0.55, 0.72, 0.0, 0.3, -0.3, 0, 0.36, 0.3, 0.12), FABRIC_MUSTARD);
    m.box(compose(0.6, 0.72, 0.0, -0.25, -0.3, 0, 0.36, 0.3, 0.12), FABRIC_CREAM);
  },
  coffee_table(m) {
    m.cylinder(compose(0, 0.25, 0, 0, 0, 0, 0.82, 0.5, 0.82), BARK, 12, 0.5, 0.56);
    m.cylinder(compose(0, 0.51, 0, 0, 0, 0, 0.84, 0.04, 0.84), WOOD_LT, 16);
    m.torus(compose(0, 0.535, 0, 0, 0, 0, 0.26, 0.4, 0.26), WOOD, 1, 0.1, 16, 4);
    m.cylinder(compose(0.12, 0.6, 0.05, 0, 0, 0, 0.14, 0.16, 0.14), FABRIC_RED, 10); // mug
    m.cylinder(compose(0.12, 0.69, 0.05, 0, 0, 0, 0.11, 0.02, 0.11), C("#5b3420"), 10);
    m.box(compose(-0.16, 0.56, -0.1, 0.4, 0, 0, 0.24, 0.05, 0.18), FABRIC_TEAL); // book
  },
  dining_table(m) {
    const w = 2 * CELL - 0.2, d = 0.95;
    legs(m, w, d, 0.72, 0.12, WOOD_DK, 0.07);
    m.box(compose(0, 0.76, 0, 0, 0, 0, w, 0.08, d), WOOD, 0.05);
    m.box(compose(0, 0.808, 0, 0, 0, 0, w * 0.5, 0.012, d + 0.02), FABRIC_RED); // runner
    m.cylinder(compose(0, 0.9, 0, 0, 0, 0, 0.3, 0.18, 0.3), C("#e7dfcf"), 12, 0.5, 0.35); // bowl
    for (let i = 0; i < 4; i++) m.sphere(compose(-0.06 + (i % 2) * 0.12, 0.98 + Math.floor(i / 2) * 0.05, -0.03 + (i % 2) * 0.05, 0, 0, 0, 0.07), i % 2 ? C("#e2483d") : C("#f5c242"), 4, 6);
    for (const s of [-1, 1]) m.cylinder(compose(s * 0.65, 0.88, 0.1, 0, 0, 0, 0.1, 0.16, 0.1), C("#fffaf0"), 8);
  },
  chair(m) {
    const w = 0.62, d = 0.6;
    legs(m, w, d, 0.44, 0.06, WOOD_DK, 0.045);
    m.box(compose(0, 0.47, 0, 0, 0, 0, w, 0.06, d), WOOD, 0.05);
    cushion(m, 0, 0.53, 0.02, w * 0.85, 0.07, d * 0.8, FABRIC_RED);
    for (const s of [-1, 1]) m.cylinder(compose(s * (w / 2 - 0.06), 0.82, -d / 2 + 0.06, 0, 0, 0, 0.08, 0.72, 0.08), WOOD_DK, 8);
    for (let k = 0; k < 3; k++) m.box(compose(0, 0.72 + k * 0.17, -d / 2 + 0.06, 0, 0, 0, w - 0.1, 0.07, 0.05), WOOD);
  },
  bookshelf(m) {
    const w = 2 * CELL - 0.25, d = 0.48, hgt = 2.1;
    const z0 = -CELL / 2 + d / 2 + 0.02;
    for (const s of [-1, 1]) m.box(compose(s * (w / 2 - 0.05), hgt / 2, z0, 0, 0, 0, 0.1, hgt, d), WOOD_DK);
    m.box(compose(0, hgt / 2, z0 - d / 2 + 0.03, 0, 0, 0, w, hgt, 0.06), WOOD);
    m.box(compose(0, hgt + 0.04, z0, 0, 0, 0, w + 0.12, 0.08, d + 0.08), WOOD_DK);
    const shelves = [0.06, 0.6, 1.12, 1.62];
    const bookCols = ["#d9534a", "#2fa7a2", "#e7b13d", "#5b7bd5", "#6aa84f", "#f4e6c8", "#a35bb5", "#e07b39"].map(C);
    shelves.forEach((y, si) => {
      m.box(compose(0, y, z0, 0, 0, 0, w - 0.1, 0.06, d), WOOD);
      if (si === shelves.length) return;
      let x = -w / 2 + 0.14, k = si * 3;
      while (x < w / 2 - 0.2) {
        const bw = 0.07 + ((k * 37) % 5) * 0.015, bh = 0.32 + ((k * 13) % 4) * 0.04;
        if ((k * 7) % 11 === 3) {
          m.sphere(compose(x + 0.1, y + 0.13, z0 + 0.02, 0, 0, 0, 0.1, 0.1, 0.1), C("#7fb069"), 4, 6); // little plant
          m.cylinder(compose(x + 0.1, y + 0.08, z0 + 0.02, 0, 0, 0, 0.14, 0.12, 0.14), C("#c0603d"), 8);
          x += 0.24;
        } else {
          m.box(compose(x + bw / 2, y + 0.03 + bh / 2, z0 + 0.02, 0, 0, (k % 6 === 5) ? 0.25 : 0, bw, bh, d * 0.75), bookCols[k % bookCols.length]);
          x += bw + 0.01;
        }
        k++;
      }
    });
  },
  bed(m) {
    const w = 2 * CELL - 0.2, d = 2 * CELL - 0.15;
    legs(m, w, d, 0.2, 0.1, WOOD_DK, 0.08);
    m.box(compose(0, 0.28, 0, 0, 0, 0, w, 0.16, d), WOOD);
    cushion(m, 0, 0.46, 0.02, w - 0.12, 0.22, d - 0.12, FABRIC_CREAM);
    // Patchwork quilt over the front two thirds.
    const qd = d * 0.66, cols = [FABRIC_RED, FABRIC_TEAL, FABRIC_MUSTARD, C("#f0e2c0"), C("#7a9e5c")];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
      m.box(compose(-w / 2 + 0.06 + (i + 0.5) * ((w - 0.12) / 4), 0.585, d / 2 - 0.06 - (j + 0.5) * (qd / 3), 0, 0, 0, (w - 0.12) / 4, 0.04, qd / 3), cols[(i + j * 2) % cols.length], 0.03);
    }
    for (const s of [-1, 1]) m.box(compose(s * (w / 2 - 0.02), 0.45, d / 2 - 0.06 - qd / 2, 0, 0, 0, 0.04, 0.26, qd), FABRIC_RED);
    for (const s of [-1, 1]) cushion(m, s * 0.48, 0.66, -d / 2 + 0.38, 0.78, 0.2, 0.42, C("#ffffff"));
    // Log headboard.
    for (const s of [-1, 1]) m.cylinder(compose(s * (w / 2 - 0.06), 0.7, -d / 2 + 0.05, 0, 0, 0, 0.18, 1.4, 0.18), LOG, 10);
    for (let k = 0; k < 3; k++) m.cylinder(compose(0, 0.62 + k * 0.24, -d / 2 + 0.05, 0, 0, Math.PI / 2, 0.16, w - 0.1, 0.16), k % 2 ? LOG : mixRgb(LOG, WOOD_LT, 0.3), 10);
  },
  plant(m) {
    m.cylinder(compose(0, 0.22, 0, 0, 0, 0, 0.5, 0.44, 0.5), C("#c0603d"), 12, 0.5, 0.38);
    m.cylinder(compose(0, 0.45, 0, 0, 0, 0, 0.54, 0.06, 0.54), C("#d97a52"), 12);
    m.cylinder(compose(0, 0.47, 0, 0, 0, 0, 0.44, 0.02, 0.44), C("#5b3a24"), 12);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2, tilt = 0.5 + (i % 3) * 0.18;
      m.cone(compose(Math.cos(a) * 0.12, 0.85, Math.sin(a) * 0.12, -a + Math.PI / 2, tilt, 0, 0.16, 0.85, 0.05), i % 2 ? C("#3f9a5c") : C("#5bb874"), 5);
    }
  },
  lamp(m, g) {
    m.cylinder(compose(0, 0.04, 0, 0, 0, 0, 0.5, 0.08, 0.5), IRON, 12);
    m.cylinder(compose(0, 0.8, 0, 0, 0, 0, 0.07, 1.5, 0.07), IRON, 8);
    m.box(compose(0, 1.62, 0, Math.PI / 4, 0, 0, 0.38, 0.06, 0.38), IRON);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) m.box(compose(sx * 0.15, 1.82, sz * 0.15, 0, 0, 0, 0.04, 0.38, 0.04), IRON);
    m.cone(compose(0, 2.12, 0, Math.PI / 4, 0, 0, 0.5, 0.26, 0.5), IRON, 4);
    m.torus(compose(0, 2.3, 0, 0, Math.PI / 2, 0, 0.06, 0.06, 0.06), BRASS, 1, 0.3, 10, 4);
    g.box(compose(0, 1.82, 0, Math.PI / 4, 0, 0, 0.26, 0.34, 0.26), C("#ffd88a"));
  },
  plush(m) {
    const fur = C("#8a5a3b"), light = C("#d7b08a");
    m.sphere(compose(0, 0.3, 0, 0, 0, 0, 0.26, 0.28, 0.24), fur, 8, 12);
    m.sphere(compose(0, 0.29, 0.08, 0, 0, 0, 0.18, 0.2, 0.18), light, 6, 10);
    m.sphere(compose(0, 0.66, 0.02, 0, 0, 0, 0.21, 0.19, 0.2), fur, 8, 12);
    m.sphere(compose(0, 0.62, 0.18, 0, 0, 0, 0.1, 0.08, 0.08), light, 5, 8);
    m.sphere(compose(0, 0.66, 0.26, 0, 0, 0, 0.04, 0.03, 0.03), C("#2b1a12"), 4, 6);
    for (const s of [-1, 1]) {
      m.sphere(compose(s * 0.08, 0.72, 0.18, 0, 0, 0, 0.03, 0.035, 0.02), C("#1d110b"), 4, 6);
      m.sphere(compose(s * 0.16, 0.83, -0.01, 0, 0, 0, 0.06, 0.06, 0.04), C("#5b3a28"), 4, 6);
      m.sphere(compose(s * 0.2, 0.14, 0.14, 0, 0, 0, 0.09, 0.07, 0.11), fur, 4, 6);
      m.sphere(compose(s * 0.22, 0.38, 0.1, 0, 0, s * 0.6, 0.06, 0.13, 0.06), fur, 4, 6);
    }
    m.box(compose(0, 0.05, -0.3, 0, -0.2, 0, 0.26, 0.05, 0.34), C("#4a3226"));
    m.box(compose(0, 0.5, 0.1, 0, 0, 0, 0.36, 0.08, 0.2), FABRIC_RED); // tiny scarf
  },
  sled(m) {
    const w = 2 * CELL - 0.3, d = 0.62;
    for (let k = 0; k < 4; k++) m.box(compose(-0.1, 0.06, -d / 2 + 0.08 + k * ((d - 0.16) / 3), 0, 0, 0, w - 0.4, 0.05, 0.13), k % 2 ? WOOD_LT : WOOD);
    // Curled front.
    for (let i = 0; i < 6; i++) {
      const a = (i / 5) * Math.PI * 0.95;
      m.box(compose(w / 2 - 0.3 + Math.sin(a) * 0.22, 0.28 - Math.cos(a) * 0.22, 0, 0, 0, a, 0.06, 0.1, d), i % 2 ? WOOD_LT : WOOD);
    }
    for (const s of [-1, 1]) m.box(compose(0, 0.13, s * (d / 2 - 0.02), 0, 0, 0, w - 0.5, 0.04, 0.04), FABRIC_RED);
    m.torus(compose(w / 2 - 0.25, 0.42, 0, 0, Math.PI / 2, 0, 0.18, 0.18, 0.18), FABRIC_RED, 1, 0.12, 10, 4);
    cushion(m, -0.45, 0.16, 0, 0.6, 0.1, d * 0.8, FABRIC_TEAL);
  },
  canoe(m) {
    const w = 3 * CELL - 0.3;
    for (const s of [-1, 1]) {
      m.box(compose(s * 0.9, 0.22, 0, 0, 0, 0, 0.08, 0.44, 0.5), WOOD_DK);
      m.box(compose(s * 0.9, 0.42, 0, 0, 0, 0, 0.1, 0.06, 0.62), WOOD);
    }
    m.sphere(compose(0, 0.66, 0, 0, 0, 0, w / 2, 0.26, 0.4), C("#d9573f"), 8, 18);
    m.box(compose(0, 0.82, 0, 0, 0, 0, w * 0.86, 0.06, 0.62), C("#7a3a24"));
    m.sphere(compose(0, 0.76, 0, 0, 0, 0, w / 2 - 0.08, 0.1, 0.33), WOOD_LT, 6, 16);
    for (const x of [-0.6, 0, 0.6]) m.box(compose(x, 0.86, 0, 0, 0, 0, 0.08, 0.04, 0.64), WOOD);
    m.box(compose(0, 0.62, 0.38, 0, 0, 0, w * 0.5, 0.06, 0.02), C("#f4e6c8")); // stripe
    // Crossed paddles leaning on the stand.
    for (const s of [-1, 1]) {
      m.cylinder(compose(s * 0.3, 0.55, 0.42, 0, 0, s * 0.9, 0.05, 1.3, 0.05), WOOD_LT, 6);
      m.box(compose(s * 0.3 + s * 0.52, 0.55 + 0.45, 0.42, 0, 0, s * 0.9, 0.18, 0.4, 0.03), WOOD);
    }
  },
  telescope(m) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      m.cylinder(compose(Math.sin(a) * 0.2, 0.55, Math.cos(a) * 0.2, a, 0.32, 0, 0.05, 1.15, 0.05), WOOD_DK, 6);
    }
    m.sphere(compose(0, 1.1, 0, 0, 0, 0, 0.08), BRASS, 4, 6);
    m.cylinder(compose(0, 1.3, -0.05, 0, -0.95, 0, 0.18, 0.95, 0.18), C("#2a5b8f"), 12);
    m.cylinder(compose(0, 1.62, -0.42, 0, -0.95, 0, 0.24, 0.16, 0.24), BRASS, 12);
    m.cylinder(compose(0, 1.04, 0.28, 0, -0.95, 0, 0.1, 0.22, 0.1), BRASS, 8);
  },
};

const cache = new Map<string, FurnitureMesh>();

export function furnitureMesh(id: string): FurnitureMesh {
  let f = cache.get(id);
  if (!f) {
    const body = new MeshBuilder(), glow = new MeshBuilder();
    builders[id]?.(body, glow);
    f = { body, glow: glow.vertexCount ? glow : null };
    cache.set(id, f);
  }
  return f;
}
