import { compose, hash2, hexToRgb, mixRgb, type Vec3 } from "../engine/math";
import type { MeshBuilder } from "../engine/mesh";
import { P } from "./palette";

/** Reusable low-poly props in the Beaver Banff style. All take world position + optional rotation. */

export function pine(m: MeshBuilder, x: number, y: number, z: number, s = 1, seed = 0) {
  const tint = 0.9 + hash2(x, z) * 0.2;
  const g = (h: string): Vec3 => hexToRgb(h).map((c) => c * tint) as Vec3;
  m.cylinder(compose(x, y + 0.6 * s, z, 0, 0, 0, 0.35 * s, 1.2 * s, 0.35 * s), P.trunk, 8);
  const layers = 3 + (seed % 2);
  for (let i = 0; i < layers; i++) {
    const k = 1 - i / (layers + 0.5);
    const col = i === layers - 1 ? g(P.pineLight) : i % 2 ? g(P.pine) : g(P.pineDark);
    m.cone(compose(x, y + (1.5 + i * 1.25) * s, z, seed + i, 0, 0, 3.2 * k * s, 2.4 * s, 3.2 * k * s), col, 8, 0.08);
  }
}

export function snowyPine(m: MeshBuilder, x: number, y: number, z: number, s = 1, seed = 0) {
  pine(m, x, y, z, s, seed);
  m.cone(compose(x, y + 5.0 * s, z, seed, 0, 0, 1.1 * s, 1.0 * s, 1.1 * s), P.snow, 10);
}

export function rock(m: MeshBuilder, x: number, y: number, z: number, s = 1) {
  const r = hash2(x, z);
  m.sphere(compose(x, y + 0.3 * s, z, r * 6, r * 0.3, 0, 1.2 * s, 0.75 * s, 1.0 * s), P.rock, 4, 6, 0.15);
}

export function flowers(m: MeshBuilder, x: number, z: number) {
  const cols = [P.flowerPink, P.flowerYellow, P.flowerPurple, P.white];
  for (let i = 0; i < 5; i++) {
    const a = hash2(x + i, z) * Math.PI * 2, d = hash2(z, x + i) * 1.2;
    const fx = x + Math.cos(a) * d, fz = z + Math.sin(a) * d;
    m.cylinder(compose(fx, 0.18, fz, 0, 0, 0, 0.05, 0.36, 0.05), P.meadowDark, 4);
    m.sphere(compose(fx, 0.4, fz, 0, 0, 0, 0.14), cols[(((i + Math.floor(x)) % cols.length) + cols.length) % cols.length], 3, 5);
  }
}

export function lamp(m: MeshBuilder, glow: MeshBuilder, x: number, z: number) {
  m.cylinder(compose(x, 1.5, z, 0, 0, 0, 0.16, 3, 0.16), "#3b3a40", 6);
  m.cylinder(compose(x, 3.15, z, 0, 0, 0, 0.6, 0.12, 0.6), "#3b3a40", 6);
  m.cone(compose(x, 3.75, z, 0, 0, 0, 0.75, 0.4, 0.75), "#3b3a40", 6);
  glow.box(compose(x, 3.45, z, Math.PI / 4, 0, 0, 0.42, 0.5, 0.42), P.lampGlow);
}

export function bench(m: MeshBuilder, x: number, z: number, ry: number) {
  const t = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number, c: string) => {
    const cx = Math.cos(ry), sn = Math.sin(ry);
    m.box(compose(x + lx * cx + lz * sn, ly, z - lx * sn + lz * cx, ry, 0, 0, sx, sy, sz), c);
  };
  t(0, 0.55, 0, 2.4, 0.12, 0.7, P.timber);
  t(0, 0.9, -0.32, 2.4, 0.42, 0.1, P.timberLight);
  for (const s of [-1, 1]) t(s * 1.0, 0.27, 0, 0.12, 0.55, 0.6, P.timberDark);
}

export function sign(m: MeshBuilder, x: number, z: number, ry: number, color: string = P.timber) {
  m.cylinder(compose(x, 0.8, z, 0, 0, 0, 0.14, 1.6, 0.14), P.timberDark, 6);
  m.box(compose(x, 1.75, z, ry, 0, 0, 1.8, 0.75, 0.14), color);
}

/** Simple gabled cabin. `roof` colour sets its personality. */
export function cabin(
  m: MeshBuilder, glow: MeshBuilder,
  x: number, z: number, ry: number,
  w: number, d: number, h: number, roof: string,
) {
  const cx = Math.cos(ry), sn = Math.sin(ry);
  const at = (lx: number, lz: number): [number, number] => [x + lx * cx + lz * sn, z - lx * sn + lz * cx];
  // Stone foundation, log walls with stripes.
  let [px, pz] = at(0, 0);
  m.box(compose(px, 0.25, pz, ry, 0, 0, w + 0.4, 0.5, d + 0.4), P.stone, 0.1);
  m.box(compose(px, 0.5 + h / 2, pz, ry, 0, 0, w, h, d), P.timber);
  for (let i = 0; i < Math.floor(h / 0.55); i++) {
    m.box(compose(px, 0.75 + i * 0.55, pz, ry, 0, 0, w + 0.12, 0.12, d + 0.12), P.timberDark);
  }
  // Corner posts.
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const [qx, qz] = at((sx * w) / 2, (sz * d) / 2);
    m.box(compose(qx, 0.5 + h / 2, qz, ry, 0, 0, 0.4, h + 0.1, 0.4), P.timberLight);
  }
  // Gable roof: two tilted slabs + gable triangles.
  const pitch = 0.62;
  const half = w / 2 + 0.7;
  const slab = half / Math.cos(pitch);
  const rise = Math.tan(pitch) * (w / 2);
  for (const s of [-1, 1]) {
    [px, pz] = at((s * half) / 2 - s * 0.15, 0);
    m.box(compose(px, 0.5 + h + rise / 2 + 0.15, pz, ry, 0, s * -pitch, slab + 0.2, 0.32, d + 1.4), roof, 0.06);
  }
  [px, pz] = at(0, 0);
  for (const s of [-1, 1]) {
    const [gx, gz] = at(0, (s * d) / 2);
    const top: Vec3 = [gx, 0.5 + h + rise, gz];
    const l = at(-w / 2, (s * d) / 2), r = at(w / 2, (s * d) / 2);
    m.tri([l[0], 0.5 + h, l[1]], [r[0], 0.5 + h, r[1]], top, P.timberLight);
  }
  // Chimney.
  [px, pz] = at(w * 0.25, -d * 0.2);
  m.box(compose(px, 0.5 + h + rise * 0.9, pz, ry, 0, 0, 0.8, rise * 1.4 + 1, 0.8), P.stoneDark, 0.1);
  // Door + glowing windows on the front (+z local).
  [px, pz] = at(0, d / 2 + 0.05);
  m.box(compose(px, 1.5, pz, ry, 0, 0, 1.3, 2.0, 0.12), "#6b3b22");
  const [kx, kz] = at(0.4, d / 2 + 0.15);
  m.sphere(compose(kx, 1.5, kz, 0, 0, 0, 0.09), P.gold, 3, 4);
  for (const s of [-1, 1]) {
    const [wx, wz] = at(s * w * 0.3, d / 2 + 0.06);
    glow.box(compose(wx, 0.5 + h * 0.55, wz, ry, 0, 0, 1.1, 1.0, 0.1), P.window);
    m.box(compose(wx, 0.5 + h * 0.55, wz + 0.0, ry, 0, 0, 1.3, 0.12, 0.16), P.timberDark);
  }
}

export function canoe(m: MeshBuilder, x: number, y: number, z: number, ry: number, color: string = P.roofRed) {
  m.sphere(compose(x, y, z, ry, 0, 0, 0.7, 0.32, 2.4), color, 4, 10);
  m.sphere(compose(x, y + 0.12, z, ry, 0, 0, 0.55, 0.22, 2.1), mixRgb(hexToRgb(color), [0.2, 0.1, 0.05], 0.5), 4, 10);
}

export function campfire(m: MeshBuilder, x: number, z: number) {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    m.sphere(compose(x + Math.cos(a) * 1.0, 0.15, z + Math.sin(a) * 1.0, a, 0, 0, 0.3, 0.22, 0.26), P.stone, 3, 5);
  }
  m.cylinder(compose(x, 0.2, z, 0.5, 0, Math.PI / 2 - 0.3, 0.18, 1.3, 0.18), P.trunk, 6);
  m.cylinder(compose(x, 0.2, z, 2.1, 0, Math.PI / 2 - 0.3, 0.18, 1.3, 0.18), P.trunk, 6);
  for (const s of [-1, 1]) m.box(compose(x + s * 2.2, 0.35, z, Math.PI / 2, 0, 0, 2.2, 0.5, 0.6), P.timberDark);
}
