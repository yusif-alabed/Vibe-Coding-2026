import { compose, hexToRgb } from "../../engine/math";
import type { MeshBuilder } from "../../engine/mesh";

/**
 * An indoor sports hall: a maple floor with black and blue court lines, cream walls with blue
 * crash pads, a blue running-track mezzanine with steel railings round three sides, ceiling-hung
 * glass backboards at each end of the court, wall-mounted practice hoops, benches and rows of
 * light panels. Built in local coordinates centred on (cx, cz); the front wall (+z) has a door.
 */
export interface GymHallOpts {
  cx?: number; cz?: number;
  w: number; d: number; h: number;
  /** x positions of wall-mounted practice hoops on the back wall (rim 3.05 m up, 0.85 m off the wall). */
  practiceHoops?: number[];
  /** Ceiling-hung hoops at both ends of the main court. */
  courtHoops?: boolean;
  /** Leave the front wall open (for a camera standing in front of it). */
  openFront?: boolean;
}

const MAPLE_A = hexToRgb("#d6a466"), MAPLE_B = hexToRgb("#cc9a5c"), MAPLE_C = hexToRgb("#dcae72");
const BLUE = "#2f63b8", NAVY = "#1f2f6b", CREAM = "#efe8d8", STEEL = "#48546a", BLACK = "#22201f";

/** A thin painted line on the floor from (x1,z1) to (x2,z2). */
function line(m: MeshBuilder, x1: number, z1: number, x2: number, z2: number, col: string, w = 0.08) {
  const l = Math.hypot(x2 - x1, z2 - z1);
  m.box(compose((x1 + x2) / 2, 0.012, (z1 + z2) / 2, Math.atan2(x2 - x1, z2 - z1), 0, 0, w, 0.012, l + w * 0.5), col);
}

/** A painted arc (centre cx,cz, radius r, from angle a0 to a1; angle 0 = +z). */
function arc(m: MeshBuilder, cx: number, cz: number, r: number, a0: number, a1: number, col: string, w = 0.08) {
  const n = Math.max(6, Math.ceil(Math.abs(a1 - a0) * r * 2.2));
  for (let i = 0; i < n; i++) {
    const t0 = a0 + ((a1 - a0) * i) / n, t1 = a0 + ((a1 - a0) * (i + 1)) / n;
    line(m, cx + Math.sin(t0) * r, cz + Math.cos(t0) * r, cx + Math.sin(t1) * r, cz + Math.cos(t1) * r, col, w);
  }
}

/** A backboard, rim and net. (x,z) is the rim centre; the board faces direction `ry` (toward the court). */
export function hoop(m: MeshBuilder, x: number, z: number, ry: number, rimY = 3.05) {
  const fx = Math.sin(ry), fz = Math.cos(ry);
  const bx = x - fx * 0.45, bz = z - fz * 0.45;
  // Clear-ish white board with a black edge and the orange shooter's square.
  m.box(compose(bx, rimY + 0.75, bz, ry, 0, 0, 1.8, 1.05, 0.05), "#eef3f7");
  const at = (u: number, v: number, du: number, dv: number, col: string, off = 0.035) =>
    m.box(compose(bx + fz * u + fx * off, rimY + 0.75 + v, bz - fx * u + fz * off, ry, 0, 0, du, dv, 0.012), col);
  at(0, 0.5, 1.8, 0.05, BLACK); at(0, -0.5, 1.8, 0.05, BLACK); at(-0.88, 0, 0.05, 1.05, BLACK); at(0.88, 0, 0.05, 1.05, BLACK);
  at(0, -0.1, 0.6, 0.04, "#e8642c"); at(0, -0.5, 0.6, 0.04, "#e8642c"); at(-0.28, -0.3, 0.04, 0.44, "#e8642c"); at(0.28, -0.3, 0.04, 0.44, "#e8642c");
  m.torus(compose(x, rimY, z, 0, 0, 0, 1), "#ff6a1a", 0.23, 0.025, 16, 4);
  m.box(compose(x - fx * 0.3, rimY - 0.02, z - fz * 0.3, ry, 0, 0, 0.1, 0.05, 0.25), "#ff6a1a");
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    m.box(compose(x + Math.cos(a) * 0.19, rimY - 0.22, z + Math.sin(a) * 0.19, -a, 0, 0.12, 0.015, 0.42, 0.015), "#f4f4f4");
  }
}

export function buildGymHall(m: MeshBuilder, o: GymHallOpts) {
  const cx = o.cx ?? 0, cz = o.cz ?? 0, W = o.w, D = o.d, H = o.h;
  const x0 = cx - W / 2, x1 = cx + W / 2, z0 = cz - D / 2, z1 = cz + D / 2;
  // Maple floor in long boards.
  for (let x = x0; x < x1 - 0.01; x += 1.2) {
    for (let z = z0; z < z1 - 0.01; z += 0.9) {
      const k = Math.floor(x * 7.3 + z * 3.1) % 3;
      m.box(compose(x + 0.6, -0.05, z + 0.45, 0, 0, 0, 1.19, 0.1, 0.89), [MAPLE_A, MAPLE_B, MAPLE_C][(k + 3) % 3]);
    }
  }
  // Court: runs along x. Black boundary and centre markings, blue keys and inner lines like the photo.
  const L = Math.min(W - 3, 28), Wc = Math.min(D - 4, 15);
  const lx0 = cx - L / 2, lx1 = cx + L / 2, lz0 = cz - Wc / 2, lz1 = cz + Wc / 2;
  line(m, lx0, lz0, lx1, lz0, BLACK); line(m, lx0, lz1, lx1, lz1, BLACK);
  line(m, lx0, lz0, lx0, lz1, BLACK); line(m, lx1, lz0, lx1, lz1, BLACK);
  line(m, cx, lz0, cx, lz1, BLACK);
  arc(m, cx, cz, 1.8, 0, Math.PI * 2, BLACK);
  arc(m, cx, cz, 0.6, 0, Math.PI * 2, BLACK);
  // An inner blue court for volleyball, as on multi-sport floors.
  line(m, cx - 9, cz - 4.5, cx + 9, cz - 4.5, BLUE); line(m, cx - 9, cz + 4.5, cx + 9, cz + 4.5, BLUE);
  line(m, cx - 9, cz - 4.5, cx - 9, cz + 4.5, BLUE); line(m, cx + 9, cz - 4.5, cx + 9, cz + 4.5, BLUE);
  for (const s of [-1, 1]) {
    const ex = s < 0 ? lx0 : lx1, hx = ex - s * 1.6;
    // The key (blue) and free-throw circle, the three-point arc (black).
    line(m, ex, cz - 2.45, ex - s * 5.8, cz - 2.45, BLUE); line(m, ex, cz + 2.45, ex - s * 5.8, cz + 2.45, BLUE);
    line(m, ex - s * 5.8, cz - 2.45, ex - s * 5.8, cz + 2.45, BLUE);
    arc(m, ex - s * 5.8, cz, 1.8, s < 0 ? 0 : Math.PI, s < 0 ? Math.PI : Math.PI * 2, BLACK);
    const r3 = Math.min(6.75, Wc / 2 - 0.6);
    arc(m, hx, cz, r3, s < 0 ? 0 : Math.PI, s < 0 ? Math.PI : Math.PI * 2, BLACK);
    line(m, ex, cz - r3, hx, cz - r3, BLACK); line(m, ex, cz + r3, hx, cz + r3, BLACK);
    if (o.courtHoops) {
      hoop(m, hx, cz, s < 0 ? Math.PI / 2 : -Math.PI / 2);
      // Steel lattice up to the ceiling.
      const bx = hx - (s < 0 ? -1 : 1) * 0.5;
      for (const dz of [-0.6, 0.6]) m.box(compose(bx - s * 0.2, (3.6 + H) / 2 + 0.5, cz + dz, 0, 0, 0, 0.08, H - 3.6, 0.08), STEEL);
      for (let k = 0; k < 5; k++) m.box(compose(bx - s * 0.2, 4.6 + k * ((H - 4.8) / 5), cz, 0.7, 0, 0, 0.05, 1.7, 0.05), STEEL);
    }
  }
  // Walls: cream above, blue crash pads below (split into panels), with a door in the front wall.
  const wall = (x: number, z: number, w: number, d: number) => {
    m.box(compose(x, H / 2, z, 0, 0, 0, w, H, d), CREAM);
    const along = w > d ? "x" : "z";
    const len = Math.max(w, d), n = Math.max(1, Math.round(len / 1.5));
    for (let i = 0; i < n; i++) {
      const t = -len / 2 + (i + 0.5) * (len / n);
      const px = along === "x" ? x + t : x + (x < cx ? 0.12 : -0.12), pz = along === "z" ? z + t : z + (z < cz ? 0.12 : -0.12);
      m.box(compose(px, 1.1, pz, 0, 0, 0, along === "x" ? len / n - 0.06 : 0.12, 2.2, along === "z" ? len / n - 0.06 : 0.12), BLUE);
    }
  };
  wall(cx, z0 - 0.15, W + 0.6, 0.3);
  wall(x0 - 0.15, cz, 0.3, D);
  wall(x1 + 0.15, cz, 0.3, D);
  if (!o.openFront) {
    wall(cx - W / 4 - 0.9, z1 + 0.15, W / 2 - 1.8, 0.3);
    wall(cx + W / 4 + 0.9, z1 + 0.15, W / 2 - 1.8, 0.3);
    m.box(compose(cx, (H + 2.8) / 2, z1 + 0.15, 0, 0, 0, 3.6, H - 2.8, 0.3), CREAM);
    for (const s of [-1, 1]) m.box(compose(cx + s * 0.8, 1.35, z1 + 0.05, 0, 0, 0, 1.5, 2.7, 0.08), "#3a6fc4");
    m.box(compose(cx, 2.9, z1 + 0.02, 0, 0, 0, 0.8, 0.25, 0.04), "#3fbf5a"); // exit sign
  }
  // Big navy scoreboard banner on the back wall, and high windows on the left.
  m.box(compose(cx, 2.6, z0 + 0.02, 0, 0, 0, 3.6, 1.5, 0.06), NAVY);
  for (let i = 0; i < 3; i++) m.box(compose(x0 + 0.02, 6.6, z0 + 3 + i * 2.2, 0, 0, 0, 0.06, 1.8, 1.2), "#bfe3ff");
  // The running-track mezzanine round the back and both sides, with blue fascia and steel rails.
  const my = Math.min(5, H - 3.4), md = 2.4;
  const deck = (x: number, z: number, w: number, d: number) => {
    m.box(compose(x, my, z, 0, 0, 0, w, 0.25, d), "#c8a26a");
    m.box(compose(x, my - 0.35, z, 0, 0, 0, w + 0.02, 0.5, d + 0.02), BLUE);
  };
  deck(cx, z0 + md / 2, W, md);
  deck(x0 + md / 2, cz + md / 2, md, D - md);
  deck(x1 - md / 2, cz + md / 2, md, D - md);
  const rail = (ax: number, az: number, bx: number, bz: number) => {
    const l = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az);
    for (const y of [0.55, 1.05]) m.box(compose((ax + bx) / 2, my + y, (az + bz) / 2, ry, 0, 0, 0.06, 0.06, l), STEEL);
    const n = Math.ceil(l / 1.4);
    for (let i = 0; i <= n; i++) {
      const t = i / n, px = ax + (bx - ax) * t, pz = az + (bz - az) * t;
      m.box(compose(px, my + 0.55, pz, 0, 0, 0, 0.07, 1.1, 0.07), BLUE);
      // Little round orange pads on the rail posts, like the photo.
      if (i % 2 === 0) m.cylinder(compose(px, my + 0.7, pz, ry, 0, Math.PI / 2, 0.36, 0.05, 0.36), "#e0874a", 10);
    }
  };
  rail(x0 + md, z0 + md, x1 - md, z0 + md);
  rail(x0 + md, z0 + md, x0 + md, z1);
  rail(x1 - md, z0 + md, x1 - md, z1);
  // Steel columns holding the mezzanine.
  for (const [px, pz] of [[x0 + md, z1 - 3], [x1 - md, z1 - 3], [x0 + md, z0 + md], [x1 - md, z0 + md]]) m.box(compose(px, my / 2, pz, 0, 0, 0, 0.3, my, 0.3), NAVY);
  // Ceiling: beams, ducts and rows of light panels.
  m.box(compose(cx, H + 0.1, cz, 0, 0, 0, W + 0.6, 0.2, D + 0.6), "#f2ece0");
  for (let i = 0; i < 6; i++) m.box(compose(x0 + (i + 0.5) * (W / 6), H - 0.3, cz, 0, 0, 0, 0.25, 0.5, D), "#ddd5c4");
  m.cylinder(compose(cx, H - 0.8, z0 + 4, 0, 0, Math.PI / 2, 0.6, W - 2, 0.6), "#c9c2b4", 10);
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3; k++) m.box(compose(x0 + (i + 0.5) * (W / 4), H - 0.08, z0 + (k + 0.5) * (D / 3), 0, 0, 0, 2.2, 0.06, 0.8), "#fffbea");
  // Wall-mounted practice hoops on the back wall.
  for (const x of o.practiceHoops ?? []) {
    const rz = z0 + 0.85 + 0.45;
    hoop(m, x, rz, 0);
    m.box(compose(x, 3.85, z0 + 0.4, 0, 0, 0, 0.12, 0.12, 0.8), STEEL);
    m.box(compose(x, 4.4, z0 + 0.15, 0, 0, 0, 0.6, 0.12, 0.12), STEEL);
  }
  // Benches along the right wall, a folded net pole on the left.
  for (let i = 0; i < 2; i++) {
    const z = cz + 1 + i * 4;
    m.box(compose(x1 - 1.4, 0.45, z, 0, 0, 0, 0.45, 0.06, 2.6), "#b07a3a");
    for (const dz of [-1.1, 1.1]) m.box(compose(x1 - 1.4, 0.22, z + dz, 0, 0, 0, 0.35, 0.44, 0.06), "#9aa3a8");
  }
  m.cylinder(compose(x0 + 1.2, 1.4, cz - 2, 0, 0, 0, 0.12, 2.8, 0.12), "#9aa3a8", 6);
}
