import { CATALOG_BY_ID } from "@beaver/shared";
import { compose, hexToRgb, lerp, lerpAngle, mixRgb, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";

/**
 * Little companions that trot after your beaver: chipmunk, snowshoe bunny, owl (flies), moose calf,
 * fox kit and duckling. Built from the same chunky primitives as everything else. Each mesh faces +z.
 */

const C = hexToRgb;
const INK = C("#1d110b");

function eyes(m: MeshBuilder, x: number, y: number, z: number, r = 0.05) {
  for (const s of [1, -1]) {
    m.sphere(compose(x * s, y, z, 0, 0, 0, r, r * 1.15, r * 0.6), INK, 5, 6);
    m.sphere(compose(x * s + 0.012 * s, y + 0.015, z + r * 0.4, 0, 0, 0, r * 0.3), "#ffffff", 3, 4);
  }
}

function build(shape: string, color: string): MeshBuilder {
  const m = new MeshBuilder();
  const c = C(color), light = mixRgb(c, [1, 0.97, 0.9], 0.55), dark = mixRgb(c, [0.1, 0.06, 0.04], 0.35);
  switch (shape) {
    case "chipmunk":
      m.sphere(compose(0, 0.22, 0, 0, 0, 0, 0.2, 0.18, 0.26), c, 7, 10);
      m.sphere(compose(0, 0.4, 0.18, 0, 0, 0, 0.16, 0.15, 0.15), c, 7, 10);
      m.sphere(compose(0, 0.36, 0.3, 0, 0, 0, 0.08, 0.07, 0.06), light, 5, 6);
      for (const s of [1, -1]) m.box(compose(0.07 * s, 0.24, 0, 0, 0, 0, 0.03, 0.12, 0.42), dark);
      m.sphere(compose(0, 0.42, -0.3, 0, -0.9, 0, 0.1, 0.32, 0.1), dark, 6, 8);
      for (const s of [1, -1]) m.sphere(compose(0.1 * s, 0.53, 0.14, 0, 0, 0, 0.05, 0.05, 0.03), dark, 4, 5);
      eyes(m, 0.07, 0.44, 0.3, 0.035);
      break;
    case "bunny":
      m.sphere(compose(0, 0.22, 0, 0, 0, 0, 0.22, 0.2, 0.26), c, 7, 10);
      m.sphere(compose(0, 0.42, 0.17, 0, 0, 0, 0.17, 0.16, 0.16), c, 7, 10);
      for (const s of [1, -1]) m.sphere(compose(0.06 * s, 0.68, 0.12, 0, -0.2, 0.15 * s, 0.05, 0.2, 0.04), c, 5, 6);
      for (const s of [1, -1]) m.sphere(compose(0.06 * s, 0.68, 0.14, 0, -0.2, 0.15 * s, 0.03, 0.15, 0.02), "#ffc4d4", 4, 5);
      m.sphere(compose(0, 0.25, -0.26, 0, 0, 0, 0.08), "#ffffff", 4, 6);
      m.sphere(compose(0, 0.4, 0.32, 0, 0, 0, 0.03), "#ff8fa8", 3, 4);
      eyes(m, 0.075, 0.46, 0.29, 0.035);
      break;
    case "owl":
      m.sphere(compose(0, 0.3, 0, 0, 0, 0, 0.24, 0.3, 0.22), c, 8, 10);
      m.sphere(compose(0, 0.28, 0.12, 0, 0, 0, 0.17, 0.22, 0.12), light, 6, 8);
      for (const s of [1, -1]) {
        m.sphere(compose(0.09 * s, 0.42, 0.17, 0, 0, 0, 0.08, 0.08, 0.04), "#fffaf0", 5, 6);
        m.cone(compose(0.14 * s, 0.6, 0.02, 0, 0, -0.3 * s, 0.07, 0.12, 0.05), dark, 4);
        m.sphere(compose(0.22 * s, 0.28, -0.02, 0, 0, 0.25 * s, 0.07, 0.2, 0.16), dark, 5, 6);
      }
      m.cone(compose(0, 0.36, 0.22, 0, Math.PI / 2 + 0.3, 0, 0.05, 0.08, 0.05), "#e8b84a", 4);
      eyes(m, 0.09, 0.42, 0.2, 0.04);
      break;
    case "moose":
      m.box(compose(0, 0.62, 0, 0, 0, 0, 0.34, 0.32, 0.6), c);
      for (const sx of [1, -1]) for (const sz of [1, -1]) m.box(compose(0.12 * sx, 0.24, 0.2 * sz, 0, 0, 0, 0.09, 0.48, 0.09), dark);
      m.box(compose(0, 0.82, 0.38, 0, -0.5, 0, 0.18, 0.18, 0.3), c);
      m.box(compose(0, 0.88, 0.56, 0, 0.2, 0, 0.22, 0.22, 0.3), c);
      m.sphere(compose(0, 0.82, 0.72, 0, 0, 0, 0.12, 0.1, 0.1), dark, 5, 6);
      for (const s of [1, -1]) {
        m.sphere(compose(0.14 * s, 1.03, 0.5, 0, 0, 0.6 * s, 0.05, 0.1, 0.04), c, 4, 5);
        m.box(compose(0.12 * s, 1.08, 0.45, 0, 0, -0.5 * s, 0.04, 0.12, 0.04), C("#d9b47a"));
      }
      eyes(m, 0.1, 0.96, 0.62, 0.03);
      break;
    case "fox":
      m.sphere(compose(0, 0.28, 0, 0, 0, 0, 0.18, 0.18, 0.3), c, 7, 10);
      m.sphere(compose(0, 0.46, 0.24, 0, 0, 0, 0.17, 0.15, 0.15), c, 7, 10);
      m.cone(compose(0, 0.42, 0.42, 0, Math.PI / 2, 0, 0.12, 0.18, 0.1), light, 6);
      m.sphere(compose(0, 0.42, 0.51, 0, 0, 0, 0.03), INK, 3, 4);
      for (const s of [1, -1]) m.cone(compose(0.1 * s, 0.64, 0.22, 0, 0, -0.2 * s, 0.09, 0.16, 0.05), c, 4);
      m.sphere(compose(0, 0.36, -0.36, 0, -0.6, 0, 0.12, 0.3, 0.12), c, 6, 8);
      m.sphere(compose(0, 0.48, -0.56, 0, -0.6, 0, 0.08, 0.1, 0.08), "#fffaf0", 5, 6);
      for (const sx of [1, -1]) for (const sz of [1, -1]) m.box(compose(0.09 * sx, 0.1, 0.14 * sz, 0, 0, 0, 0.06, 0.2, 0.06), INK);
      eyes(m, 0.07, 0.5, 0.36, 0.03);
      break;
    case "duck":
      m.sphere(compose(0, 0.2, 0, 0, 0, 0, 0.18, 0.16, 0.22), c, 7, 10);
      m.sphere(compose(0, 0.4, 0.12, 0, 0, 0, 0.13), c, 6, 8);
      m.box(compose(0, 0.37, 0.27, 0, 0, 0, 0.12, 0.04, 0.12), C("#ff9a3c"));
      m.cone(compose(0, 0.24, -0.22, 0, -Math.PI / 2 - 0.4, 0, 0.1, 0.1, 0.06), c, 4);
      for (const s of [1, -1]) m.box(compose(0.07 * s, 0.03, 0.04, 0, 0, 0, 0.08, 0.03, 0.1), C("#ff9a3c"));
      eyes(m, 0.06, 0.44, 0.22, 0.028);
      break;
  }
  return m;
}

const cache = new WeakMap<Renderer, Map<string, GpuMesh>>();
export function petMesh(r: Renderer, id: string): GpuMesh | null {
  const item = CATALOG_BY_ID[id];
  if (!item || item.slot !== "pet") return null;
  let map = cache.get(r);
  if (!map) cache.set(r, (map = new Map()));
  let g = map.get(id);
  if (!g) map.set(id, (g = r.upload(build(item.shape, item.color).build())));
  return g;
}

/** A pet trailing behind its owner, hopping when it moves. */
export class PetFollower {
  x: number; z: number; ry = 0; moving = 0; t = Math.random() * 10;
  constructor(x: number, z: number) { this.x = x; this.z = z; }

  update(dt: number, ownerX: number, ownerZ: number, ownerRy: number) {
    this.t += dt;
    // Aim for a spot just behind and to the side of the owner.
    const tx = ownerX - Math.sin(ownerRy) * 1.3 + Math.cos(ownerRy) * 0.8;
    const tz = ownerZ - Math.cos(ownerRy) * 1.3 - Math.sin(ownerRy) * 0.8;
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    if (d > 12) { this.x = tx; this.z = tz; }
    else if (d > 0.4) {
      const sp = Math.min(d, (2 + d * 2.2) * dt);
      this.x += (dx / d) * sp;
      this.z += (dz / d) * sp;
      this.ry = lerpAngle(this.ry, Math.atan2(dx, dz), Math.min(1, dt * 8));
    } else this.ry = lerpAngle(this.ry, ownerRy, Math.min(1, dt * 2));
    this.moving = lerp(this.moving, d > 0.5 ? 1 : 0, Math.min(1, dt * 6));
  }

  draw(r: Renderer, mesh: GpuMesh, groundY: number, flying: boolean) {
    const hop = Math.abs(Math.sin(this.t * 9)) * 0.18 * this.moving;
    const fly = flying ? 1.6 + Math.sin(this.t * 2) * 0.2 : 0;
    r.draw(mesh, compose(this.x, groundY + hop + fly, this.z, this.ry, flying ? Math.sin(this.t * 14) * 0.05 : 0, 0, 1.25), { outline: 0.02, cut: true });
  }
}

export const isFlyingPet = (id: string | null | undefined) => !!id && CATALOG_BY_ID[id]?.shape === "owl";
export type { Vec3 };
