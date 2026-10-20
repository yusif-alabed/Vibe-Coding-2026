import { compose, hash2, hexToRgb, mixRgb, noise2, type Mat4, type Vec3 } from "../../engine/math";
import { MeshBuilder } from "../../engine/mesh";

/**
 * Natural scenery for Beaver Banff, modelled to read like a warm storybook render:
 * layered spruces, mossy boulders, swaying grass and alpine wildflowers.
 * Everything is generated from simple shapes with hand-tuned colours, so it stays light to download.
 */

const C = (h: string) => hexToRgb(h);
const norm = (v: Vec3): Vec3 => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const scale = (c: Vec3, k: number): Vec3 => [c[0] * k, c[1] * k, c[2] * k];

// ---------------------------------------------------------------- Spruce

const SPRUCE_DARK = C("#173d2c");
const SPRUCE_MID = C("#25573a");
const SPRUCE_TIP = C("#4d8048");
const SPRUCE_SUN = C("#7f9c4a");
const TRUNK = C("#5a3a24");
const SNOW = C("#f4f8ff");

export interface SpruceOpts {
  /** Fewer tiers for distant trees. */
  lod?: "near" | "far";
  snow?: boolean;
}

/**
 * A tall spruce with drooping, ragged branch tiers — the dark spires of the Rockies.
 * `s` is roughly height / 9 m.
 */
export function spruce(m: MeshBuilder, x: number, y: number, z: number, s: number, seed: number, opts: SpruceOpts = {}) {
  const start = m.vertexCount;
  const H = 9 * s;
  const tint = 0.85 + hash2(seed, 3.1) * 0.3;
  const lean = (hash2(seed, 7.7) - 0.5) * 0.04;
  m.cylinder(compose(x, y + 0.9 * s, z, 0, lean, 0, 0.42 * s, 1.9 * s, 0.42 * s), scale(TRUNK, tint), 6, 0.35, 0.55);

  const far = opts.lod === "far";
  const N = far ? 4 : 7;
  const K = far ? 7 : 11;
  const rot = hash2(seed, 1.3) * Math.PI * 2;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const tierH = H * (0.3 - t * 0.09);
    const bottom = y + s * 1.1 + t * (H - s * 1.1 - tierH * 0.75);
    const top = bottom + tierH;
    const R = (1 - t * 0.82) * 2.5 * s * (0.9 + hash2(seed, i) * 0.2);
    const apex: Vec3 = [x + lean * (top - y), top, z];
    const shade = 0.8 + t * 0.26;
    const rim: Vec3[] = [], mid: Vec3[] = [];
    for (let k = 0; k < K; k++) {
      const a = rot + i * 0.7 + (k / K) * Math.PI * 2;
      const tip = k % 2 === 0;
      const r = R * (tip ? 1 : 0.74) * (0.88 + hash2(seed + i, k) * 0.24);
      // Branch tips droop below the tier; the inner ring bulges up for a soft, layered silhouette.
      rim.push([x + Math.cos(a) * r, bottom + (tip ? -0.1 : 0.12) * tierH, z + Math.sin(a) * r]);
      const rm = r * 0.55;
      mid.push([x + Math.cos(a) * rm, bottom + tierH * (far ? 0.42 : 0.5), z + Math.sin(a) * rm]);
    }
    const colAt = (p: Vec3, band: number): Vec3 => {
      const dx = p[0] - x, dz = p[2] - z;
      const sunny = Math.max(0, (dx * 0.86 + dz * 0.22) / (R + 1e-3));
      const tipCol = mixRgb(SPRUCE_TIP, SPRUCE_SUN, sunny * 0.45);
      const c = band === 0 ? mixRgb(SPRUCE_DARK, SPRUCE_MID, 0.55) : band === 1 ? mixRgb(SPRUCE_MID, tipCol, 0.25) : mixRgb(SPRUCE_MID, tipCol, 0.6 + hash2(p[0], p[2]) * 0.3);
      return scale(c, tint * shade);
    };
    const nrm = (p: Vec3, up: number): Vec3 => norm([p[0] - x, R * up, p[2] - z]);
    for (let k = 0; k < K; k++) {
      const k1 = (k + 1) % K;
      if (far) {
        m.vertex(apex, [0, 1, 0], colAt(apex, 0)).vertex(rim[k], nrm(rim[k], 0.75), colAt(rim[k], 2)).vertex(rim[k1], nrm(rim[k1], 0.75), colAt(rim[k1], 2));
      } else {
        m.vertex(apex, [0, 1, 0], colAt(apex, 0)).vertex(mid[k], nrm(mid[k], 1.1), colAt(mid[k], 1)).vertex(mid[k1], nrm(mid[k1], 1.1), colAt(mid[k1], 1));
        m.vertex(mid[k], nrm(mid[k], 1.1), colAt(mid[k], 1)).vertex(rim[k], nrm(rim[k], 0.6), colAt(rim[k], 2)).vertex(rim[k1], nrm(rim[k1], 0.6), colAt(rim[k1], 2));
        m.vertex(mid[k], nrm(mid[k], 1.1), colAt(mid[k], 1)).vertex(rim[k1], nrm(rim[k1], 0.6), colAt(rim[k1], 2)).vertex(mid[k1], nrm(mid[k1], 1.1), colAt(mid[k1], 1));
      }
      if (i === 0) {
        // Underside of the lowest tier, so the tree looks solid from the low camera.
        const c: Vec3 = [x, bottom + 0.3 * tierH, z];
        m.vertex(c, [0, -1, 0], scale(SPRUCE_DARK, tint * 0.7));
        m.vertex(rim[k1], [0, -1, 0], scale(SPRUCE_DARK, tint * 0.8));
        m.vertex(rim[k], [0, -1, 0], scale(SPRUCE_DARK, tint * 0.8));
      }
    }
    if (opts.snow) {
      // A crisp snow cap sitting on top of each tier.
      const sr = R * 0.62;
      const sb = top - tierH * 0.55;
      for (let k = 0; k < K; k++) {
        const a0 = rot + i * 0.7 + (k / K) * Math.PI * 2, a1 = rot + i * 0.7 + ((k + 1) / K) * Math.PI * 2;
        const p0: Vec3 = [x + Math.cos(a0) * sr, sb, z + Math.sin(a0) * sr];
        const p1: Vec3 = [x + Math.cos(a1) * sr, sb, z + Math.sin(a1) * sr];
        m.vertex([x, top + 0.04, z], [0, 1, 0], SNOW);
        m.vertex(p0, norm([Math.cos(a0), 1, Math.sin(a0)]), SNOW);
        m.vertex(p1, norm([Math.cos(a1), 1, Math.sin(a1)]), SNOW);
      }
    }
  }
  m.setSway(start, (_x, yy) => Math.max(0, (yy - y - 1.5) / H) ** 1.5);
}

// ---------------------------------------------------------------- Boulders

const boulderCache = new Map<number, number[][]>();

/** Unit-radius lumpy rock shape, cached by variant. */
function boulderShape(variant: number): number[][] {
  let tris = boulderCache.get(variant);
  if (tris) return tris;
  const lat = 5, lon = 8;
  const pt = (i: number, j: number): Vec3 => {
    const th = (i / lat) * Math.PI, ph = ((j % lon) / lon) * Math.PI * 2;
    let r = 1 + (hash2(i * 13 + variant, (j % lon) * 7) - 0.5) * 0.36;
    if (i === 0 || i === lat) r = 1;
    const y = Math.cos(th) * r;
    return [Math.sin(th) * Math.cos(ph) * r, y < 0 ? y * 0.6 : y, Math.sin(th) * Math.sin(ph) * r];
  };
  tris = [];
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      if (i !== 0) tris.push([...a, ...d, ...c]);
      if (i !== lat - 1) tris.push([...a, ...c, ...b]);
    }
  }
  boulderCache.set(variant, tris);
  return tris;
}

const ROCK_A = C("#8e8a82");
const ROCK_B = C("#a9a398");
const ROCK_DARK = C("#6c6a66");
const MOSS = C("#6d8a3c");

/** Faceted granite boulder with moss on top. */
export function boulder(m: MeshBuilder, x: number, y: number, z: number, sx: number, sy: number, sz: number, seed: number, moss = 0.6) {
  const tris = boulderShape(Math.floor(hash2(seed, 2.2) * 8));
  const ry = hash2(seed, 4.4) * Math.PI * 2;
  const tone = 0.88 + hash2(seed, 5.5) * 0.22;
  m.addTris(tris, compose(x, y, z, ry, 0, 0, sx, sy, sz), (px, py, pz) => {
    const up = (py - y) / sy;
    const n = noise2(px * 2.1, pz * 2.1);
    let c = mixRgb(ROCK_DARK, mixRgb(ROCK_A, ROCK_B, n), Math.min(1, 0.4 + up * 0.8));
    if (up > 0.45 - moss * 0.3 + n * 0.25) c = mixRgb(c, MOSS, Math.min(1, moss * (0.6 + n * 0.5)));
    return scale(c, tone);
  });
}

/** Cut stone block with slightly rounded look (used for walls, steps and statues' plinths). */
export function stoneBlock(m: MeshBuilder, mat: Mat4, seed: number, color?: Vec3) {
  const tone = 0.86 + hash2(seed, 9.1) * 0.24;
  const base = color ?? mixRgb(C("#a99f90"), C("#c4baa8"), hash2(seed, 3.3));
  m.addTris(boulderShape(Math.floor(hash2(seed, 6.6) * 8)).map((t) => t.map((v, i) => (i % 3 === 1 ? Math.max(-0.75, Math.min(0.75, v)) : Math.max(-0.92, Math.min(0.92, v))))), mat, scale(base, tone));
}

// ---------------------------------------------------------------- Grass & flowers

const GRASS_ROOT = C("#3d5e26");
const GRASS_MID = C("#6f9a3a");
const GRASS_TIP = C("#b5c45a");
const GRASS_DRY = C("#c4b46a");

/** A tuft of swaying blades. `lush` 0..1 picks between short meadow grass and tall clumps. */
export function grassTuft(m: MeshBuilder, x: number, y: number, z: number, seed: number, lush = 0.5, dry = 0) {
  const blades = 4 + (lush > 0.6 ? 2 : 0);
  const tint = 0.9 + hash2(seed, 1.7) * 0.2;
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + hash2(seed, i) * 1.2;
    const off = 0.04 + hash2(i, seed) * 0.1;
    const bx = x + Math.cos(a) * off, bz = z + Math.sin(a) * off;
    const h = (0.28 + hash2(seed + i, 2.9) * 0.3) * (0.7 + lush * 0.9);
    const w = 0.045 + hash2(i, seed + 4) * 0.03;
    const lean = 0.25 + hash2(seed, i + 9) * 0.35;
    const px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    const tip: Vec3 = [bx + Math.cos(a) * h * lean, y + h, bz + Math.sin(a) * h * lean];
    const n = norm([Math.cos(a) * 0.35, 1, Math.sin(a) * 0.35]);
    const tipCol = scale(mixRgb(mixRgb(GRASS_MID, GRASS_TIP, hash2(seed, i + 3)), GRASS_DRY, dry), tint);
    m.vertex([bx - px, y, bz - pz], n, scale(GRASS_ROOT, tint), 0);
    m.vertex([bx + px, y, bz + pz], n, scale(GRASS_ROOT, tint), 0);
    m.vertex(tip, n, tipCol, 1);
  }
}

const LUPINE_COLS: Vec3[][] = [
  [C("#4a2f8f"), C("#6f4fc4"), C("#a993e8")],
  [C("#3c3a9c"), C("#5b63d1"), C("#9fb0f0")],
  [C("#7c2f7d"), C("#b0549f"), C("#e19ad0")],
];

/** Alpine lupine: a tall spike of purple blossoms over a rosette of leaves. */
export function lupine(m: MeshBuilder, x: number, y: number, z: number, s: number, seed: number) {
  const start = m.vertexCount;
  const cols = LUPINE_COLS[hash2(seed, 2) < 0.7 ? 0 : hash2(seed, 3) < 0.6 ? 1 : 2];
  const H = (0.75 + hash2(seed, 4) * 0.45) * s;
  const lx = (hash2(seed, 5) - 0.5) * 0.12 * s, lz = (hash2(seed, 6) - 0.5) * 0.12 * s;
  const stemTop: Vec3 = [x + lx * 0.5, y + H * 0.45, z + lz * 0.5];
  const leaf = C("#3e6b33");
  m.vertex([x - 0.02, y, z], [0, 1, 0], leaf).vertex([x + 0.02, y, z], [0, 1, 0], leaf).vertex(stemTop, [0, 1, 0], leaf);
  // Palmate leaves.
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + seed;
    const r = 0.16 * s;
    m.vertex([x, y + 0.1 * s, z], [0, 1, 0], leaf);
    m.vertex([x + Math.cos(a - 0.2) * r, y + 0.06 * s, z + Math.sin(a - 0.2) * r], [0, 1, 0], mixRgb(leaf, C("#6e9a44"), 0.4));
    m.vertex([x + Math.cos(a + 0.2) * r, y + 0.06 * s, z + Math.sin(a + 0.2) * r], [0, 1, 0], mixRgb(leaf, C("#6e9a44"), 0.4));
  }
  // Blossom spike: three stacked jagged rings narrowing to a tip.
  const K = 6;
  const rings: { y: number; r: number; c: Vec3 }[] = [
    { y: H * 0.42, r: 0.075 * s, c: cols[0] },
    { y: H * 0.62, r: 0.07 * s, c: cols[1] },
    { y: H * 0.82, r: 0.05 * s, c: cols[1] },
    { y: H * 1.0, r: 0.0, c: cols[2] },
  ];
  const ringPts = rings.map((rg, ri) => {
    const pts: Vec3[] = [];
    for (let k = 0; k < K; k++) {
      const a = (k / K) * Math.PI * 2 + ri * 0.5;
      const rr = rg.r * (k % 2 ? 0.7 : 1.1);
      const f = rg.y / H;
      pts.push([x + lx * f + Math.cos(a) * rr, y + rg.y, z + lz * f + Math.sin(a) * rr]);
    }
    return pts;
  });
  for (let ri = 0; ri < rings.length - 1; ri++) {
    const A = ringPts[ri], B = ringPts[ri + 1];
    for (let k = 0; k < K; k++) {
      const k1 = (k + 1) % K;
      const out = (p: Vec3) => norm([p[0] - x, 0.4, p[2] - z]);
      const ca = rings[ri].c, cb = rings[ri + 1].c;
      m.vertex(A[k], out(A[k]), ca).vertex(A[k1], out(A[k1]), ca).vertex(B[k1], out(B[k1]), cb);
      m.vertex(A[k], out(A[k]), ca).vertex(B[k1], out(B[k1]), cb).vertex(B[k], out(B[k]), cb);
    }
  }
  m.setSway(start, (_x, yy) => Math.max(0, (yy - y) / H));
}

const PETAL = C("#fbfaf4");
const DAISY_HEART = C("#f2b81f");

/** White daisy: seven petals around a golden centre, facing the sky. */
export function daisy(m: MeshBuilder, x: number, y: number, z: number, s: number, seed: number) {
  const start = m.vertexCount;
  const h = (0.22 + hash2(seed, 1) * 0.18) * s;
  const stem = C("#4f7a35");
  m.vertex([x - 0.012, y, z], [0, 1, 0], stem).vertex([x + 0.012, y, z], [0, 1, 0], stem).vertex([x, y + h, z], [0, 1, 0], stem);
  const r = 0.075 * s;
  const tilt: Vec3 = norm([0.25 * Math.cos(seed), 1, 0.25 * Math.sin(seed)]);
  const cy = y + h;
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2 + seed;
    const a0 = a - 0.2, a1 = a + 0.2;
    m.vertex([x, cy, z], tilt, PETAL);
    m.vertex([x + Math.cos(a0) * r, cy - 0.01, z + Math.sin(a0) * r], tilt, PETAL);
    m.vertex([x + Math.cos(a1) * r, cy - 0.01, z + Math.sin(a1) * r], tilt, PETAL);
  }
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    m.vertex([x, cy + 0.015, z], tilt, DAISY_HEART);
    m.vertex([x + Math.cos(a) * r * 0.32, cy + 0.008, z + Math.sin(a) * r * 0.32], tilt, DAISY_HEART);
    m.vertex([x + Math.cos(a + 2.1) * r * 0.32, cy + 0.008, z + Math.sin(a + 2.1) * r * 0.32], tilt, DAISY_HEART);
  }
  m.setSway(start, (_x, yy) => Math.max(0, (yy - y) / (h + 0.01)) * 0.6);
}

/** Tiny yellow buttercup / arnica dots in the meadow. */
export function buttercup(m: MeshBuilder, x: number, y: number, z: number, seed: number) {
  const start = m.vertexCount;
  const h = 0.16 + hash2(seed, 3) * 0.14;
  const col = hash2(seed, 4) < 0.75 ? C("#f6c62a") : C("#f39a2b");
  const r = 0.045;
  m.vertex([x - 0.01, y, z], [0, 1, 0], C("#527c34")).vertex([x + 0.01, y, z], [0, 1, 0], C("#527c34")).vertex([x, y + h, z], [0, 1, 0], C("#527c34"));
  for (let k = 0; k < 2; k++) {
    const a = k * 1.6 + seed;
    m.vertex([x + Math.cos(a) * r, y + h, z + Math.sin(a) * r], [0, 1, 0], col);
    m.vertex([x + Math.cos(a + 2.1) * r, y + h, z + Math.sin(a + 2.1) * r], [0, 1, 0], col);
    m.vertex([x + Math.cos(a + 4.2) * r, y + h + 0.01, z + Math.sin(a + 4.2) * r], [0, 1, 0], col);
  }
  m.setSway(start, (_x, yy) => Math.max(0, (yy - y) / h) * 0.5);
}

/** Feathery fern for shady spots near rocks and trees. */
export function fern(m: MeshBuilder, x: number, y: number, z: number, s: number, seed: number) {
  const start = m.vertexCount;
  const col = C("#4f7f3a"), tip = C("#86a94a");
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + seed;
    const len = (0.45 + hash2(seed, k) * 0.25) * s;
    const ex = x + Math.cos(a) * len, ez = z + Math.sin(a) * len;
    const mid: Vec3 = [x + Math.cos(a) * len * 0.5, y + 0.28 * s, z + Math.sin(a) * len * 0.5];
    const px = -Math.sin(a) * 0.09 * s, pz = Math.cos(a) * 0.09 * s;
    m.vertex([x, y, z], [0, 1, 0], col).vertex([mid[0] + px, mid[1], mid[2] + pz], [0, 1, 0], col).vertex([ex, y + 0.12 * s, ez], [0, 1, 0], tip);
    m.vertex([x, y, z], [0, 1, 0], col).vertex([ex, y + 0.12 * s, ez], [0, 1, 0], tip).vertex([mid[0] - px, mid[1], mid[2] - pz], [0, 1, 0], col);
  }
  m.setSway(start, (px, _y, pz) => Math.min(1, Math.hypot(px - x, pz - z) / (0.6 * s)) * 0.5);
}
