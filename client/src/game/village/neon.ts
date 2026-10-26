import { LODGE, lodgeToWorld, TOWN_AREAS, TOWN_BUILDINGS, type TownBuilding } from "@beaver/shared";
import { compose, hexToRgb, type Vec3 } from "../../engine/math";
import { MeshBuilder } from "../../engine/mesh";
import { Frame } from "./architecture";

/**
 * Colourful night lights in a cosy mountain-town style: hand-bent neon shop signs (a croissant over
 * the bakery, an ice-cream cone, a maple leaf…), strings of festoon bulbs zig-zagging across Main
 * Street, a maypole of lights over the plaza fountain, uplights in the fountain, bulbs along the
 * lodge terrace and bridges, and a fairground arch. Everything is drawn twice: a bright core and a
 * soft halo that only shows after dark.
 */

export const NEON = {
  pink: hexToRgb("#ff4fa3"), teal: hexToRgb("#3ff0e0"), gold: hexToRgb("#ffcf3f"), violet: hexToRgb("#b07bff"),
  lime: hexToRgb("#9bff5a"), orange: hexToRgb("#ff8a3d"), sky: hexToRgb("#4fb6ff"), red: hexToRgb("#ff4a4a"), warm: hexToRgb("#ffe2a0"),
};
const FESTOON = [NEON.pink, NEON.gold, NEON.teal, NEON.violet, NEON.lime, NEON.orange];

export interface NeonMeshes { core: MeshBuilder; halo: MeshBuilder }

export class NeonKit {
  core = new MeshBuilder();
  halo = new MeshBuilder();

  /** A glass tube between two world points. */
  tube(a: Vec3, b: Vec3, col: Vec3, r = 0.045) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return;
    const ry = Math.atan2(dx, dz), rx = -Math.atan2(dy, Math.hypot(dx, dz));
    const mid: Vec3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    this.core.box(compose(mid[0], mid[1], mid[2], ry, rx, 0, r * 2, r * 2, len + r), col);
    this.halo.box(compose(mid[0], mid[1], mid[2], ry, rx, 0, r * 4, r * 4, len + r * 3), col);
  }

  /** A bent tube following a path in a frame's local space (x across, y up, z out of the wall). */
  path(f: Frame, pts: [number, number][], z: number, col: Vec3, closed = false) {
    const w = pts.map(([x, y]) => f.p(x, y, z));
    for (let i = 0; i < w.length - 1; i++) this.tube(w[i], w[i + 1], col);
    if (closed && w.length > 2) this.tube(w[w.length - 1], w[0], col);
  }

  /** A circle (or arc) of tube in a frame's wall plane. */
  arc(f: Frame, cx: number, cy: number, z: number, r: number, col: Vec3, a0 = 0, a1 = Math.PI * 2, segs = 18) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= segs; i++) {
      const a = a0 + ((a1 - a0) * i) / segs;
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    this.path(f, pts, z, col);
  }

  bulb(p: Vec3, col: Vec3, r = 0.09) {
    this.core.sphere(compose(p[0], p[1], p[2], 0, 0, 0, r), col, 3, 5);
    this.halo.sphere(compose(p[0], p[1], p[2], 0, 0, 0, r * 2.6), col, 5, 8);
  }

  /** A sagging string of coloured bulbs between two points, with a dark wire. */
  festoon(a: Vec3, b: Vec3, n: number, sag: number, wire: MeshBuilder, offset = 0) {
    const at = (t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t];
    const segs = 10;
    for (let i = 0; i < segs; i++) {
      const p0 = at(i / segs), p1 = at((i + 1) / segs);
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2], len = Math.hypot(dx, dy, dz);
      wire.box(compose((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2, Math.atan2(dx, dz), -Math.atan2(dy, Math.hypot(dx, dz)), 0, 0.03, 0.03, len), [0.18, 0.13, 0.1]);
    }
    for (let i = 1; i < n; i++) {
      const p = at(i / n);
      this.bulb([p[0], p[1] - 0.12, p[2]], FESTOON[(((i + offset) % FESTOON.length) + FESTOON.length) % FESTOON.length], 0.1);
    }
  }
}

/** Neon sign shapes, about 1.6 m across, drawn on a wall frame centred at (0, y). */
const SIGNS: Partial<Record<TownBuilding["kind"], (k: NeonKit, f: Frame, y: number, z: number) => void>> = {
  bakery(k, f, y, z) {
    k.arc(f, 0, y - 0.15, z, 0.55, NEON.gold, 0.15, Math.PI - 0.15, 14);
    k.arc(f, 0, y - 0.15, z, 0.3, NEON.orange, 0.3, Math.PI - 0.3, 10);
    for (const x of [-0.25, 0.05, 0.35]) k.path(f, [[x, y + 0.5], [x + 0.1, y + 0.65], [x, y + 0.8]], z, NEON.pink);
  },
  post(k, f, y, z) {
    k.path(f, [[-0.6, y - 0.35], [0.6, y - 0.35], [0.6, y + 0.35], [-0.6, y + 0.35]], z, NEON.sky, true);
    k.path(f, [[-0.6, y + 0.35], [0, y - 0.05], [0.6, y + 0.35]], z, NEON.pink);
  },
  store(k, f, y, z) {
    k.arc(f, 0, y - 0.05, z, 0.42, NEON.red);
    k.path(f, [[0, y + 0.37], [0.05, y + 0.6]], z, NEON.orange);
    k.path(f, [[0.05, y + 0.55], [0.35, y + 0.68], [0.12, y + 0.48]], z, NEON.lime);
  },
  flowers(k, f, y, z) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + Math.PI / 2;
      k.arc(f, Math.cos(a) * 0.32, y + Math.sin(a) * 0.32, z, 0.18, NEON.pink, 0, Math.PI * 2, 10);
    }
    k.arc(f, 0, y, z, 0.12, NEON.gold, 0, Math.PI * 2, 8);
  },
  icecream(k, f, y, z) {
    k.path(f, [[-0.35, y + 0.05], [0, y - 0.65], [0.35, y + 0.05]], z, NEON.orange, true);
    k.arc(f, 0, y + 0.3, z, 0.33, NEON.pink, -0.25, Math.PI + 0.25, 14);
    k.arc(f, 0.05, y + 0.72, z, 0.16, NEON.teal, 0, Math.PI * 2, 10);
  },
  toys(k, f, y, z) {
    const pts: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 0.25 : 0.6;
      pts.push([Math.cos(a) * r, y + Math.sin(a) * r]);
    }
    k.path(f, pts, z, NEON.gold, true);
  },
  maple(k, f, y, z) {
    const s = 0.65;
    const leaf: [number, number][] = [[0, 1], [0.15, 0.6], [0.45, 0.75], [0.35, 0.4], [0.7, 0.35], [0.4, 0.1], [0.5, -0.15], [0.1, -0.05], [0.05, -0.45], [-0.05, -0.45], [-0.1, -0.05], [-0.5, -0.15], [-0.4, 0.1], [-0.7, 0.35], [-0.35, 0.4], [-0.45, 0.75], [-0.15, 0.6]];
    k.path(f, leaf.map(([x, yy]) => [x * s, y + yy * s - 0.1]), z, NEON.red, true);
    k.path(f, [[0, y - 0.4], [0, y - 0.7]], z, NEON.orange);
  },
  library(k, f, y, z) {
    k.path(f, [[0, y - 0.35], [-0.65, y - 0.25], [-0.65, y + 0.4], [0, y + 0.3]], z, NEON.teal, true);
    k.path(f, [[0, y - 0.35], [0.65, y - 0.25], [0.65, y + 0.4], [0, y + 0.3]], z, NEON.teal, true);
    for (const yy of [0.12, -0.05]) for (const s of [-1, 1]) k.path(f, [[s * 0.15, y + yy], [s * 0.5, y + yy + 0.03]], z, NEON.warm);
  },
};

/** A tiny stroke font for neon lettering (each letter 0.6 wide, 1 tall, strokes as polylines). */
const FONT: Record<string, [number, number][][]> = {
  A: [[[0, 0], [0.3, 1], [0.6, 0]], [[0.12, 0.4], [0.48, 0.4]]],
  B: [[[0, 0], [0, 1], [0.45, 1], [0.55, 0.85], [0.45, 0.52], [0, 0.52]], [[0.45, 0.52], [0.6, 0.35], [0.5, 0], [0, 0]]],
  C: [[[0.6, 0.9], [0.45, 1], [0.15, 1], [0, 0.8], [0, 0.2], [0.15, 0], [0.45, 0], [0.6, 0.1]]],
  D: [[[0, 0], [0, 1], [0.35, 1], [0.6, 0.75], [0.6, 0.25], [0.35, 0], [0, 0]]],
  E: [[[0.6, 1], [0, 1], [0, 0], [0.6, 0]], [[0, 0.5], [0.45, 0.5]]],
  F: [[[0.6, 1], [0, 1], [0, 0]], [[0, 0.5], [0.45, 0.5]]],
  G: [[[0.6, 0.9], [0.45, 1], [0.15, 1], [0, 0.8], [0, 0.2], [0.15, 0], [0.45, 0], [0.6, 0.2], [0.6, 0.45], [0.35, 0.45]]],
  H: [[[0, 0], [0, 1]], [[0.6, 0], [0.6, 1]], [[0, 0.5], [0.6, 0.5]]],
  I: [[[0.3, 0], [0.3, 1]], [[0.1, 1], [0.5, 1]], [[0.1, 0], [0.5, 0]]],
  J: [[[0.6, 1], [0.6, 0.2], [0.45, 0], [0.15, 0], [0, 0.2]]],
  K: [[[0, 0], [0, 1]], [[0.6, 1], [0, 0.45], [0.6, 0]]],
  L: [[[0, 1], [0, 0], [0.55, 0]]],
  M: [[[0, 0], [0, 1], [0.3, 0.5], [0.6, 1], [0.6, 0]]],
  N: [[[0, 0], [0, 1], [0.6, 0], [0.6, 1]]],
  O: [[[0.15, 0], [0, 0.2], [0, 0.8], [0.15, 1], [0.45, 1], [0.6, 0.8], [0.6, 0.2], [0.45, 0], [0.15, 0]]],
  P: [[[0, 0], [0, 1], [0.45, 1], [0.6, 0.85], [0.6, 0.6], [0.45, 0.45], [0, 0.45]]],
  R: [[[0, 0], [0, 1], [0.45, 1], [0.6, 0.85], [0.6, 0.6], [0.45, 0.45], [0, 0.45]], [[0.25, 0.45], [0.6, 0]]],
  S: [[[0.6, 0.85], [0.45, 1], [0.15, 1], [0, 0.82], [0.12, 0.55], [0.48, 0.45], [0.6, 0.2], [0.45, 0], [0.15, 0], [0, 0.15]]],
  T: [[[0, 1], [0.6, 1]], [[0.3, 1], [0.3, 0]]],
  U: [[[0, 1], [0, 0.2], [0.15, 0], [0.45, 0], [0.6, 0.2], [0.6, 1]]],
  V: [[[0, 1], [0.3, 0], [0.6, 1]]],
  W: [[[0, 1], [0.12, 0], [0.3, 0.6], [0.48, 0], [0.6, 1]]],
  Y: [[[0, 1], [0.3, 0.5], [0.6, 1]], [[0.3, 0.5], [0.3, 0]]],
  "!": [[[0.3, 1], [0.3, 0.3]], [[0.3, 0.12], [0.3, 0.02]]],
};

/** Writes neon letters centred at (0, y) on a wall frame. size = letter height in metres. */
export function neonText(k: NeonKit, f: Frame, text: string, y: number, z: number, size: number, col: Vec3) {
  const adv = size * 0.82;
  const x0 = -((text.length - 1) * adv) / 2 - size * 0.3;
  [...text].forEach((ch, i) => {
    const strokes = FONT[ch.toUpperCase()];
    if (!strokes) return;
    for (const st of strokes) k.path(f, st.map(([sx, sy]) => [x0 + i * adv + sx * size, y + (sy - 0.5) * size] as [number, number]), z, col);
  });
}

const SHOPS = new Set(["bakery", "post", "store", "flowers", "icecream", "toys", "maple", "library"]);

/** Builds all the night lights. `heightAt` places things on the ground; `bridges` gives rail points. */
export function buildNeon(heightAt: (x: number, z: number) => number, wire: MeshBuilder, extras: { bridgeRails: Vec3[][]; fountainY: number }): NeonMeshes {
  const k = new NeonKit();
  const POLE: Vec3 = [0.3, 0.2, 0.14];
  /**
   * A slim timber pole up to where a string of lights ends, so no string ever ends in thin air.
   * `from` is where it stands (the ground by default; a terrace or a rim otherwise).
   */
  const pole = (x: number, z: number, top: number, from = heightAt(x, z)) => {
    wire.cylinder(compose(x, (from + top) / 2, z, 0, 0, 0, 0.13, top - from + 0.18, 0.13), POLE, 7);
    wire.sphere(compose(x, top + 0.12, z, 0, 0, 0, 0.18), POLE, 4, 6);
  };
  /** A plain wire between two points (used for the crown over the fountain). */
  const strut = (a: Vec3, b: Vec3, w = 0.05) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], len = Math.hypot(dx, dy, dz);
    wire.box(compose((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2, Math.atan2(dx, dz), -Math.atan2(dy, Math.hypot(dx, dz)), 0, w, w, len), [0.18, 0.13, 0.1]);
  };
  // Shop signs on little posts above the shopfront, with a contrasting neon frame.
  for (const b of TOWN_BUILDINGS) {
    if (!SHOPS.has(b.kind)) continue;
    const f = new Frame(b.x, heightAt(b.x, b.z), b.z, b.ry);
    const two = !["flowers", "icecream", "maple"].includes(b.kind);
    const y = b.kind === "library" ? 7.0 : two ? 7.0 : 4.3;
    const z = b.d / 2 + (two ? 0.75 : 0.6);
    for (const s of [-1, 1]) wire.box(f.m(s * 0.85, y - 1.1, z - 0.05, 0.06, 1.2, 0.06), [0.18, 0.13, 0.1]);
    wire.box(f.m(0, y, z - 0.08, 2.0, 1.75, 0.05), [0.12, 0.1, 0.12]);
    SIGNS[b.kind]?.(k, f, y, z);
    const frame: Vec3 = b.seed % 2 ? NEON.teal : NEON.violet;
    k.path(f, [[-0.95, y - 0.82], [0.95, y - 0.82], [0.95, y + 0.82], [-0.95, y + 0.82]], z + 0.01, frame, true);
    // A little "open" pill in the shop window.
    k.path(f, [[-b.w * 0.18 - 0.35, 1.95], [-b.w * 0.18 + 0.35, 1.95], [-b.w * 0.18 + 0.35, 2.2], [-b.w * 0.18 - 0.35, 2.2]], b.d / 2 + 0.14, NEON.lime, true);
  }
  // Festoon lights zig-zagging across Main Street, hung from poles along the pavement in front of the
  // shopfronts (which stand at about 4 m either side of the road's centre line).
  for (let x = -18, i = 0; x > -90; x -= 7, i++) {
    if (x < -64 && x > -84) continue; // the town square has its own lights
    const side = i % 2 ? 1 : -1;
    const za = side * 4.7, zb = -side * 4.7;
    const a: Vec3 = [x, heightAt(x, za) + 4.7, za];
    const b: Vec3 = [x - 3.5, heightAt(x - 3.5, zb) + 4.7, zb];
    pole(a[0], a[2], a[1]);
    pole(b[0], b[2], b[1]);
    k.festoon(a, b, 9, 0.6, wire, i);
  }
  // Town square: strings from the bandstand roof out to four posts.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const px = -74 + Math.cos(a) * 9.5, pz = Math.sin(a) * 9.5, py = heightAt(px, pz);
    wire.cylinder(compose(px, py + 2.3, pz, 0, 0, 0, 0.14, 4.6, 0.14), [0.3, 0.2, 0.14], 6);
    k.festoon([px, py + 4.5, pz], [-74, heightAt(-74, 0) + 6.0, 0], 8, 0.5, wire, i);
  }
  // Plaza: strings from the tops of the lantern posts up to a crown of lights held above the fountain's
  // statue on three slim masts that stand on the top tier's rim.
  {
    const crownY = extras.fountainY + 7.9, crownR = 1.55, rimY = extras.fountainY + 4.65;
    const ring = (a: number): Vec3 => [Math.cos(a) * crownR, crownY, Math.sin(a) * crownR];
    for (let i = 0; i < 12; i++) {
      const a0 = (i / 12) * Math.PI * 2, a1 = ((i + 1) / 12) * Math.PI * 2;
      strut(ring(a0), ring(a1), 0.06);
      k.bulb(ring(a0), FESTOON[i % FESTOON.length], 0.09);
    }
    for (let m = 0; m < 3; m++) {
      const a = 0.5 + Math.PI / 6 + (m * Math.PI * 2) / 3;
      pole(Math.cos(a) * crownR, Math.sin(a) * crownR, crownY, rimY);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.5;
      const lx = Math.cos(a) * 11.5, lz = Math.sin(a) * 11.5;
      k.festoon([lx, heightAt(lx, lz) + 2.85, lz], ring(a), 10, 0.7, wire, i * 2);
    }
  }
  // Coloured uplights in the fountain basin.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.bulb([Math.cos(a) * 4.6, extras.fountainY + 0.95, Math.sin(a) * 4.6], FESTOON[i % FESTOON.length], 0.14);
  }
  // Lodge terrace: strings along the front rail, hung from posts standing on the terrace.
  {
    const groundY = heightAt(LODGE.x, LODGE.z), floorY = groundY + 1.0, topY = groundY + 3.4;
    const edge = LODGE.depth / 2 + LODGE.terrace - 0.15; // the railing's line
    const span = LODGE.width - 0.8;
    const P = (j: number): Vec3 => {
      const p = lodgeToWorld(-LODGE.width / 2 + 0.4 + (span * j) / 4, edge);
      return [p.x, topY, p.z];
    };
    for (let j = 0; j <= 4; j++) { const q = P(j); pole(q[0], q[2], q[1], floorY); }
    for (let j = 0; j < 4; j++) k.festoon(P(j), P(j + 1), 6, 0.35, wire, j * 3);
  }
  // Bridges: bulbs along both handrails.
  for (const rail of extras.bridgeRails) rail.forEach((p, i) => { if (i % 2 === 0) k.bulb([p[0], p[1] + 0.15, p[2]], FESTOON[i % FESTOON.length], 0.09); });
  // Fairground entrance arch.
  {
    const gx = 12, gz = 66, gy = heightAt(gx, gz);
    for (const s of [-1, 1]) wire.cylinder(compose(gx, gy + 2.4, gz + s * 3, 0, 0, 0, 0.22, 4.8, 0.22), [0.9, 0.88, 0.84], 8);
    // A bulb-lit arch: a slim wire arc from one post top to the other, with the bulbs on it.
    const arch = (i: number): Vec3 => { const a = (i / 16) * Math.PI; return [gx, gy + 4.8 + Math.sin(a) * 1.6, gz - Math.cos(a) * 3]; };
    for (let i = 0; i <= 16; i++) {
      k.bulb(arch(i), FESTOON[i % FESTOON.length], 0.12);
      if (i < 16) strut(arch(i), arch(i + 1), 0.07);
    }
    const f = new Frame(gx, gy, gz, -Math.PI / 2);
    k.path(f, [[-1.6, 5.6], [1.6, 5.6], [1.6, 6.3], [-1.6, 6.3]], 0, NEON.pink, true);
    k.arc(f, -0.9, 5.95, 0.05, 0.22, NEON.gold);
    k.arc(f, 0, 5.95, 0.05, 0.22, NEON.teal);
    k.arc(f, 0.9, 5.95, 0.05, 0.22, NEON.violet);
  }
  // Downtown lettering: every venue gets its name in neon.
  const DOWNTOWN: Partial<Record<TownBuilding["kind"], { lines: [string, number, Vec3][]; y: number; z: number }>> = {
    club: { lines: [["CLUB BEAVER", 0.75, NEON.pink], ["HAVE A DAM GOOD TIME!", 0.32, NEON.teal]], y: 6.0, z: 0.8 },
    casino: { lines: [["LUCKY LODGE", 0.5, NEON.gold]], y: 3.95, z: 2.45 },
    sports: { lines: [["SPORTS", 0.7, NEON.sky]], y: 7.0, z: 0.25 },
    gym: { lines: [["BOXING", 0.55, NEON.red]], y: 4.2, z: 0.15 },
    fort: { lines: [["FORT TIMBER", 0.45, NEON.lime]], y: 3.6, z: 0.4 },
    estategate: { lines: [["BOARD GAMES", 0.42, NEON.violet]], y: 6.1, z: 0.2 },
  };
  for (const b of TOWN_BUILDINGS) {
    const sign = DOWNTOWN[b.kind];
    if (!sign) continue;
    const f = new Frame(b.x, heightAt(b.x, b.z), b.z, b.ry);
    let yy = sign.y;
    for (const [text, size, col] of sign.lines) {
      neonText(k, f, text, yy, b.d / 2 + sign.z, size, col);
      yy -= size + 0.3;
    }
  }
  // Club Beaver's dance floor: strings of bulbs from the roof out to poles.
  const club = TOWN_BUILDINGS.find((b) => b.kind === "club");
  if (club) {
    const f = new Frame(club.x, heightAt(club.x, club.z), club.z, club.ry);
    // From the false front out to the far side of the dance floor's lighting truss.
    const floor = TOWN_AREAS.find((a) => a.kind === "dance");
    if (floor) for (const s of [-1, 0, 1]) {
      const ex = floor.x + floor.r + 0.4, ez = floor.z + s * (floor.r + 0.4);
      // These end on the dance floor's lighting truss (its corner posts and top beam, built in danceStage()).
      k.festoon(f.p(s * 2.5, 6.2, club.d / 2 + 0.3), [ex, heightAt(floor.x, floor.z) + 3.6, ez], 9, 0.5, wire, s + 3);
    }
  }
  // Lights around the Downtown plaza, strung between its four lantern posts (see plaza() in downtown.ts:
  // they stand just outside the paving at these angles, 3 m tall).
  {
    const dt = TOWN_AREAS.find((a) => a.kind === "downtown");
    if (dt) {
      const topY = heightAt(dt.x, dt.z) + 3.05;
      const P = (j: number): Vec3 => {
        const a = Math.PI / 8 + (j % 4) * (Math.PI / 2);
        return [dt.x + Math.cos(a) * (dt.r + 0.3), topY, dt.z + Math.sin(a) * (dt.r + 0.3)];
      };
      for (let j = 0; j < 4; j++) k.festoon(P(j), P(j + 1), 8, 0.55, wire, j * 2);
    }
  }
  return { core: k.core, halo: k.halo };
}
