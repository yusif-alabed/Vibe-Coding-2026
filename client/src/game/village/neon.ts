import { LODGE, lodgeToWorld, TOWN_BUILDINGS, type TownBuilding } from "@beaver/shared";
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

const SHOPS = new Set(["bakery", "post", "store", "flowers", "icecream", "toys", "maple", "library"]);

/** Builds all the night lights. `heightAt` places things on the ground; `bridges` gives rail points. */
export function buildNeon(heightAt: (x: number, z: number) => number, wire: MeshBuilder, extras: { bridgeRails: Vec3[][]; fountainY: number }): NeonMeshes {
  const k = new NeonKit();
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
  // Festoon lights zig-zagging across Main Street.
  for (let x = -18, i = 0; x > -90; x -= 7, i++) {
    if (x < -64 && x > -84) continue; // the town square has its own lights
    const side = i % 2 ? 1 : -1;
    const a: Vec3 = [x, heightAt(x, side * 5.4) + 4.7, side * 5.4];
    const b: Vec3 = [x - 3.5, heightAt(x - 3.5, -side * 5.4) + 4.7, -side * 5.4];
    k.festoon(a, b, 9, 0.6, wire, i);
  }
  // Town square: strings from the bandstand roof out to four posts.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    const px = -74 + Math.cos(a) * 9.5, pz = Math.sin(a) * 9.5, py = heightAt(px, pz);
    wire.cylinder(compose(px, py + 2.3, pz, 0, 0, 0, 0.14, 4.6, 0.14), [0.3, 0.2, 0.14], 6);
    k.festoon([px, py + 4.5, pz], [-74, heightAt(-74, 0) + 6.0, 0], 8, 0.5, wire, i);
  }
  // Plaza: a maypole of lights from the lantern posts up to the fountain's top tier.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.5;
    const lx = Math.cos(a) * 11.5, lz = Math.sin(a) * 11.5;
    k.festoon([lx, heightAt(lx, lz) + 3.1, lz], [0, extras.fountainY + 6.2, 0], 10, 0.9, wire, i * 2);
  }
  // Coloured uplights in the fountain basin.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    k.bulb([Math.cos(a) * 4.6, extras.fountainY + 0.95, Math.sin(a) * 4.6], FESTOON[i % FESTOON.length], 0.14);
  }
  // Lodge terrace: a string of bulbs along the front rail.
  const L = (lx: number): Vec3 => {
    const p = lodgeToWorld(lx, LODGE.depth / 2 + LODGE.terrace - 0.1);
    return [p.x, heightAt(p.x, p.z) + 3.0, p.z];
  };
  for (let x = -LODGE.width / 2; x < LODGE.width / 2 - 0.1; x += LODGE.width / 4) k.festoon(L(x), L(x + LODGE.width / 4), 6, 0.35, wire, Math.round(x));
  // Bridges: bulbs along both handrails.
  for (const rail of extras.bridgeRails) rail.forEach((p, i) => { if (i % 2 === 0) k.bulb([p[0], p[1] + 0.15, p[2]], FESTOON[i % FESTOON.length], 0.09); });
  // Fairground entrance arch.
  {
    const gx = 12, gz = 66, gy = heightAt(gx, gz);
    for (const s of [-1, 1]) wire.cylinder(compose(gx, gy + 2.4, gz + s * 3, 0, 0, 0, 0.22, 4.8, 0.22), [0.9, 0.88, 0.84], 8);
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      k.bulb([gx, gy + 4.8 + Math.sin(a) * 1.6, gz - Math.cos(a) * 3], FESTOON[i % FESTOON.length], 0.12);
    }
    const f = new Frame(gx, gy, gz, -Math.PI / 2);
    k.path(f, [[-1.6, 5.6], [1.6, 5.6], [1.6, 6.3], [-1.6, 6.3]], 0, NEON.pink, true);
    k.arc(f, -0.9, 5.95, 0.05, 0.22, NEON.gold);
    k.arc(f, 0, 5.95, 0.05, 0.22, NEON.teal);
    k.arc(f, 0.9, 5.95, 0.05, 0.22, NEON.violet);
  }
  return { core: k.core, halo: k.halo };
}
