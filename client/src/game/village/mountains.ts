import { hash2, hexToRgb, mixRgb, noise2, ridged2, type Vec3 } from "../../engine/math";
import { MeshBuilder } from "../../engine/mesh";

/**
 * The Rockies backdrop: a ring of craggy, snow-capped peaks built as one polar height field.
 * Heights blend from the village terrain at the inner edge into huge ridged peaks further out.
 * The tallest massif sits to the north, behind the fountain, like a postcard of Banff.
 */

const FOREST = hexToRgb("#26432f");
const FOREST_LIGHT = hexToRgb("#3a5f3a");
const ROCK = hexToRgb("#857d74");
const ROCK_WARM = hexToRgb("#a39486");
const ROCK_DARK = hexToRgb("#5f5a56");
const SNOW = hexToRgb("#f3f6fa");
const SNOW_SHADE = hexToRgb("#cfdcea");

const angDiff = (a: number, b: number) => {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
};

export interface MountainOpts {
  inner: number;
  outer: number;
  /** Height of the village terrain (used to blend at the inner edge). */
  baseHeight: (x: number, z: number) => number;
  /** Direction (radians, atan2(z, x)) of the hero massif. */
  heroAngle: number;
  center?: [number, number];
  seed?: number;
}

export function mountainHeight(x: number, z: number, o: MountainOpts): number {
  const [cx, cz] = o.center ?? [0, 0];
  const dx = x - cx, dz = z - cz;
  const rho = Math.hypot(dx, dz);
  const th = Math.atan2(dz, dx);
  const seed = o.seed ?? 0;
  const hero = 0.75 + 0.85 * Math.exp(-((angDiff(th, o.heroAngle) / 0.42) ** 2)) + 0.45 * Math.exp(-((angDiff(th, o.heroAngle + 0.95) / 0.35) ** 2));
  const ramp = Math.min(1, Math.max(0, (rho - o.inner - 15) / 140));
  const fade = 1 - Math.min(1, Math.max(0, (rho - o.outer * 0.8) / (o.outer * 0.2))) * 0.55;
  const r = ridged2(x * 0.0055 + seed, z * 0.0055 - seed, 5) * 0.8 + ridged2(x * 0.016 - seed, z * 0.016 + seed, 3) * 0.28;
  const broad = noise2(x * 0.0025 + 7, z * 0.0025 - 3);
  const peaks = (20 + 165 * r * (0.55 + broad * 0.7)) * hero * ramp * fade;
  const foothill = 22 + (rho - o.inner) * 0.2;
  const inner = o.baseHeight(x, z);
  const blend = Math.min(1, Math.max(0, (rho - o.inner) / 22));
  return inner * (1 - blend) + (foothill + peaks) * blend - (1 - blend) * 0.6;
}

export function buildMountainMesh(o: MountainOpts): MeshBuilder {
  const m = new MeshBuilder();
  const [cx, cz] = o.center ?? [0, 0];
  const A = 256, R = 44;
  const ring = (i: number) => o.inner * Math.pow(o.outer / o.inner, i / R);
  const pts: Vec3[][] = [];
  for (let i = 0; i <= R; i++) {
    const row: Vec3[] = [];
    const rho = ring(i);
    for (let j = 0; j < A; j++) {
      const a = (j / A) * Math.PI * 2;
      const x = cx + Math.cos(a) * rho, z = cz + Math.sin(a) * rho;
      row.push([x, mountainHeight(x, z, o), z]);
    }
    pts.push(row);
  }
  const normalAt = (i: number, j: number): Vec3 => {
    const p = pts[i][j];
    const pa = pts[i][(j + 1) % A], pb = pts[i][(j - 1 + A) % A];
    const pc = pts[Math.min(R, i + 1)][j], pd = pts[Math.max(0, i - 1)][j];
    const t1: Vec3 = [pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]];
    const t2: Vec3 = [pc[0] - pd[0], pc[1] - pd[1], pc[2] - pd[2]];
    let n: Vec3 = [t1[1] * t2[2] - t1[2] * t2[1], t1[2] * t2[0] - t1[0] * t2[2], t1[0] * t2[1] - t1[1] * t2[0]];
    if (n[1] < 0) n = [-n[0], -n[1], -n[2]];
    const l = Math.hypot(n[0], n[1], n[2]) || 1;
    void p;
    return [n[0] / l, n[1] / l, n[2] / l];
  };
  const normals = pts.map((row, i) => row.map((_, j) => normalAt(i, j)));
  const color = (p: Vec3, n: Vec3): Vec3 => {
    const y = p[1];
    const nz = noise2(p[0] * 0.05, p[2] * 0.05);
    const streak = noise2(p[0] * 0.02, p[1] * 0.12);
    const snowLine = 92 + nz * 30 - (n[1] - 0.6) * 50;
    const steep = 1 - n[1];
    if (y > snowLine && steep < 0.62 + nz * 0.15) return mixRgb(SNOW, SNOW_SHADE, Math.min(1, steep * 1.4 + streak * 0.3));
    if (y > snowLine - 25 && hash2(Math.floor(p[0] / 4), Math.floor(p[2] / 4)) > 0.55 && steep < 0.5) return SNOW_SHADE;
    const forestTop = 52 + nz * 25;
    if (y < forestTop && steep < 0.45) return mixRgb(FOREST, FOREST_LIGHT, nz * 0.8 + (n[1] - 0.6) * 0.5);
    return mixRgb(mixRgb(ROCK_DARK, ROCK, streak), ROCK_WARM, Math.max(0, n[1] - 0.5) * 0.8 * nz);
  };
  for (let i = 0; i < R; i++) {
    for (let j = 0; j < A; j++) {
      const j1 = (j + 1) % A;
      const q = [[i, j], [i + 1, j], [i + 1, j1], [i, j1]] as const;
      const P = q.map(([a, b]) => pts[a][b]);
      const N = q.map(([a, b]) => normals[a][b]);
      const Cc = P.map((p, k) => color(p, N[k]));
      for (const k of [0, 1, 2, 0, 2, 3]) m.vertex(P[k], N[k], Cc[k]);
    }
  }
  return m;
}
