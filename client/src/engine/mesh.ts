import { compose, hexToRgb, type Mat4, type Vec3 } from "./math";

const IDENTITY = compose(0, 0, 0);

/**
 * Builds flat-shaded, vertex-coloured low-poly geometry from simple primitives.
 * Each vertex also stores a "smooth" direction used to inflate the ink outline
 * (inverted hull) without cracks at hard edges.
 */

type Tri = number[]; // 9 numbers: three xyz points

function unitBox(): Tri[] {
  const p = [
    [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5],
    [-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
  ];
  const quads = [
    [4, 5, 6, 7], [1, 0, 3, 2], [5, 1, 2, 6], [0, 4, 7, 3], [7, 6, 2, 3], [0, 1, 5, 4],
  ];
  const tris: Tri[] = [];
  for (const [a, b, c, d] of quads) {
    tris.push([...p[a], ...p[b], ...p[c]], [...p[a], ...p[c], ...p[d]]);
  }
  return tris;
}

/** Cylinder/cone/frustum of height 1 centred at origin. */
function unitCylinder(seg: number, rTop: number, rBot: number, caps = true): Tri[] {
  const tris: Tri[] = [];
  for (let i = 0; i < seg; i++) {
    const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
    const b0 = [c0 * rBot, -0.5, s0 * rBot], b1 = [c1 * rBot, -0.5, s1 * rBot];
    const t0 = [c0 * rTop, 0.5, s0 * rTop], t1 = [c1 * rTop, 0.5, s1 * rTop];
    if (rTop > 0) tris.push([...b0, ...t1, ...b1], [...b0, ...t0, ...t1]);
    else tris.push([...b0, 0, 0.5, 0, ...b1]);
    if (caps) {
      tris.push([0, -0.5, 0, ...b0, ...b1]);
      if (rTop > 0) tris.push([0, 0.5, 0, ...t1, ...t0]);
    }
  }
  return tris;
}

function unitSphere(lat: number, lon: number): Tri[] {
  const tris: Tri[] = [];
  const pt = (i: number, j: number) => {
    const th = (i / lat) * Math.PI, ph = (j / lon) * Math.PI * 2;
    return [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)];
  };
  for (let i = 0; i < lat; i++) {
    for (let j = 0; j < lon; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      if (i !== 0) tris.push([...a, ...d, ...c]);
      if (i !== lat - 1) tris.push([...a, ...c, ...b]);
    }
  }
  return tris;
}

function unitTorus(R: number, r: number, seg: number, side: number): Tri[] {
  const tris: Tri[] = [];
  const pt = (i: number, j: number) => {
    const u = (i / seg) * Math.PI * 2, v = (j / side) * Math.PI * 2;
    return [(R + r * Math.cos(v)) * Math.cos(u), r * Math.sin(v), (R + r * Math.cos(v)) * Math.sin(u)];
  };
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < side; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i + 1, j + 1), d = pt(i, j + 1);
      tris.push([...a, ...c, ...b], [...a, ...d, ...c]);
    }
  }
  return tris;
}

const cache = new Map<string, Tri[]>();
function prim(key: string, make: () => Tri[]): Tri[] {
  let t = cache.get(key);
  if (!t) cache.set(key, (t = make()));
  return t;
}

export type ColorLike = string | Vec3;
export type ColorFn = (x: number, y: number, z: number) => Vec3;

export interface MeshData {
  positions: Float32Array;
  normals: Float32Array;
  colors: Float32Array;
  smooth: Float32Array;
  count: number;
}

export class MeshBuilder {
  private pos: number[] = [];
  private nrm: number[] = [];
  private col: number[] = [];
  private smo: number[] = [];

  get vertexCount() {
    return this.pos.length / 3;
  }

  /** Adds triangles (local coords) transformed by `m`. Colour can vary per vertex (in world space). */
  addTris(tris: Tri[], m: Mat4, color: ColorLike | ColorFn, jitter = 0, orient: "center" | "up" = "center", smoothLighting = false): this {
    const base: Vec3 | null = typeof color === "function" ? null : typeof color === "string" ? hexToRgb(color) : color;
    for (const t of tris) {
      const w: number[] = [];
      const sm: number[] = [];
      for (let k = 0; k < 3; k++) {
        const x = t[k * 3], y = t[k * 3 + 1], z = t[k * 3 + 2];
        w.push(m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]);
        // Smooth direction = local position direction, rotated (not scaled) into world.
        let dx = m[0] * x + m[4] * y + m[8] * z, dy = m[1] * x + m[5] * y + m[9] * z, dz = m[2] * x + m[6] * y + m[10] * z;
        const l = Math.hypot(dx, dy, dz) || 1;
        sm.push(dx / l, dy / l, dz / l);
      }
      const ux = w[3] - w[0], uy = w[4] - w[1], uz = w[5] - w[2];
      const vx = w[6] - w[0], vy = w[7] - w[1], vz = w[8] - w[2];
      let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      const nl = Math.hypot(nx, ny, nz) || 1;
      nx /= nl; ny /= nl; nz /= nl;
      // Make the face normal point outward regardless of triangle winding.
      const ox = orient === "up" ? 0 : sm[0] + sm[3] + sm[6];
      const oy = orient === "up" ? 1 : sm[1] + sm[4] + sm[7];
      const oz = orient === "up" ? 0 : sm[2] + sm[5] + sm[8];
      if (nx * ox + ny * oy + nz * oz < 0) { nx = -nx; ny = -ny; nz = -nz; }
      // Small per-face brightness jitter gives the hand-painted low-poly look.
      const j = jitter ? 1 + (Math.sin(w[0] * 12.9898 + w[2] * 78.233) * 0.5) * jitter : 1;
      for (let k = 0; k < 3; k++) {
        this.pos.push(w[k * 3], w[k * 3 + 1], w[k * 3 + 2]);
        // Rounded assets use interpolated normals, while roofs, terrain and boxes
        // retain their deliberate hand-built edges.
        if (smoothLighting) this.nrm.push(sm[k * 3], sm[k * 3 + 1], sm[k * 3 + 2]);
        else this.nrm.push(nx, ny, nz);
        this.smo.push(sm[k * 3], sm[k * 3 + 1], sm[k * 3 + 2]);
        const c = base ?? (color as ColorFn)(w[k * 3], w[k * 3 + 1], w[k * 3 + 2]);
        this.col.push(c[0] * j, c[1] * j, c[2] * j);
      }
    }
    return this;
  }

  box(m: Mat4, color: ColorLike | ColorFn, jitter = 0) {
    return this.addTris(prim("box", unitBox), m, color, jitter);
  }
  cylinder(m: Mat4, color: ColorLike | ColorFn, seg = 8, rTop = 0.5, rBot = 0.5, jitter = 0) {
    return this.addTris(prim(`cyl${seg}-${rTop}-${rBot}`, () => unitCylinder(seg, rTop, rBot)), m, color, jitter);
  }
  cone(m: Mat4, color: ColorLike | ColorFn, seg = 7, jitter = 0) {
    return this.addTris(prim(`cone${seg}`, () => unitCylinder(seg, 0, 0.5)), m, color, jitter);
  }
  sphere(m: Mat4, color: ColorLike | ColorFn, lat = 6, lon = 8, jitter = 0) {
    return this.addTris(prim(`sph${lat}-${lon}`, () => unitSphere(lat, lon)), m, color, jitter, "center", true);
  }
  torus(m: Mat4, color: ColorLike | ColorFn, R = 1, r = 0.2, seg = 16, side = 6) {
    return this.addTris(prim(`tor${R}-${r}-${seg}-${side}`, () => unitTorus(R, r, seg, side)), m, color);
  }

  /** Raw triangle in world space (used by terrain). */
  tri(a: Vec3, b: Vec3, c: Vec3, color: ColorLike | ColorFn) {
    return this.addTris([[...a, ...b, ...c]], IDENTITY, color, 0, "up");
  }

  /** Terrain/water triangle with explicit vertex normals, so a continuous surface does not show its grid. */
  triSmooth(a: Vec3, b: Vec3, c: Vec3, color: ColorLike | ColorFn, na: Vec3, nb: Vec3, nc: Vec3) {
    const pts = [a, b, c], nrms = [na, nb, nc];
    const base: Vec3 | null = typeof color === "function" ? null : typeof color === "string" ? hexToRgb(color) : color;
    for (let i = 0; i < 3; i++) {
      const p = pts[i], n = nrms[i];
      this.pos.push(p[0], p[1], p[2]);
      this.nrm.push(n[0], n[1], n[2]);
      this.smo.push(n[0], n[1], n[2]);
      const col = base ?? (color as ColorFn)(p[0], p[1], p[2]);
      this.col.push(col[0], col[1], col[2]);
    }
    return this;
  }

  /**
   * Adds one vertex directly (world space). `sway` is the wind weight (0 = rooted, 1 = moves freely);
   * it is stored in the smooth channel, which only outline-drawn meshes use.
   */
  vertex(p: Vec3, n: Vec3, c: Vec3, sway = 0) {
    this.pos.push(p[0], p[1], p[2]);
    this.nrm.push(n[0], n[1], n[2]);
    this.col.push(c[0], c[1], c[2]);
    this.smo.push(sway, 0, 0);
    return this;
  }

  /** Sets the wind weight for every vertex added since `fromVertex`, from its world position. */
  setSway(fromVertex: number, weight: (x: number, y: number, z: number) => number) {
    for (let i = fromVertex; i < this.pos.length / 3; i++) {
      this.smo[i * 3] = weight(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      this.smo[i * 3 + 1] = 0;
      this.smo[i * 3 + 2] = 0;
    }
    return this;
  }

  merge(other: MeshBuilder) {
    // Appended in a loop: spreading a very large mesh would overflow the call stack.
    const add = (into: number[], from: number[]) => { for (let i = 0; i < from.length; i++) into.push(from[i]); };
    add(this.pos, other.pos);
    add(this.nrm, other.nrm);
    add(this.col, other.col);
    add(this.smo, other.smo);
    return this;
  }

  build(): MeshData {
    return {
      positions: new Float32Array(this.pos),
      normals: new Float32Array(this.nrm),
      colors: new Float32Array(this.col),
      smooth: new Float32Array(this.smo),
      count: this.pos.length / 3,
    };
  }
}
