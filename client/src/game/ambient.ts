import { HUB_PLACES } from "@beaver/shared";
import { compose, hash2, hexToRgb, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { heightAt, riverDist, WATER_Y, type HubWorld } from "./hubWorld";

/**
 * Little bits of life around the village: butterflies over the meadows by day, fireflies at night,
 * fish leaping in the lake and river, a flock of birds wheeling overhead and smoke curling from
 * every chimney in town. Purely cosmetic and local to each player.
 */

const PL = HUB_PLACES;

interface Butterfly { x: number; z: number; y: number; hx: number; hz: number; phase: number; speed: number; color: [number, number, number, number] }
interface Firefly { x: number; z: number; y: number; phase: number }
interface Jump { x: number; z: number; ry: number; t: number; dur: number; h: number; splashed: boolean }
interface Puff { x: number; y: number; z: number; vx: number; vy: number; life: number; max: number; size: number }

const meshes = new WeakMap<Renderer, { wing: GpuMesh; fish: GpuMesh; bird: GpuMesh; ring: GpuMesh }>();
function getMeshes(r: Renderer) {
  let m = meshes.get(r);
  if (m) return m;
  const wing = new MeshBuilder();
  wing.box(compose(0.09, 0, 0, 0, 0, 0, 0.18, 0.01, 0.16), [1, 1, 1]);
  const fish = new MeshBuilder();
  fish.sphere(compose(0, 0, 0, 0, 0, 0, 0.12, 0.13, 0.36), hexToRgb("#d98a5a"), 5, 8);
  fish.sphere(compose(0, 0.02, 0.05, 0, 0, 0, 0.1, 0.1, 0.28), hexToRgb("#e9b48a"), 4, 6);
  fish.cone(compose(0, 0, -0.42, 0, Math.PI / 2, 0, 0.3, 0.2, 0.06), hexToRgb("#c46e45"), 4);
  const bird = new MeshBuilder();
  for (const s of [-1, 1]) bird.box(compose(s * 0.35, 0, 0, 0, 0, s * 0.25, 0.7, 0.04, 0.22), hexToRgb("#3b3a48"));
  bird.sphere(compose(0, 0, 0.05, 0, 0, 0, 0.1, 0.08, 0.22), hexToRgb("#2e2d38"), 4, 6);
  const ring = new MeshBuilder();
  ring.torus(compose(0, 0, 0), "#ffffff", 1, 0.08, 18, 4);
  m = { wing: r.upload(wing.build()), fish: r.upload(fish.build()), bird: r.upload(bird.build()), ring: r.upload(ring.build()) };
  meshes.set(r, m);
  return m;
}

const BUTTERFLY_COLORS: [number, number, number, number][] = [
  [1, 0.62, 0.2, 1], [0.98, 0.9, 0.35, 1], [0.6, 0.75, 1, 1], [1, 0.55, 0.75, 1], [1, 1, 1, 1], [0.7, 0.55, 1, 1],
];

export class Ambient {
  private butterflies: Butterfly[] = [];
  private fireflies: Firefly[] = [];
  private jumps: Jump[] = [];
  private puffs: Puff[] = [];
  private jumpTimer = 2;
  private puffAcc = 0;

  constructor(private world: HubWorld) {
    for (let i = 0; i < 28; i++) {
      const a = hash2(i, 1) * Math.PI * 2, d = 16 + hash2(i, 2) * 50;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      this.butterflies.push({ x, z, y: 0.8, hx: x, hz: z, phase: hash2(i, 3) * 10, speed: 0.8 + hash2(i, 4) * 0.8, color: BUTTERFLY_COLORS[i % BUTTERFLY_COLORS.length] });
    }
    for (let i = 0; i < 80; i++) {
      const a = hash2(i, 11) * Math.PI * 2, d = 15 + hash2(i, 12) * 75;
      this.fireflies.push({ x: Math.cos(a) * d, z: Math.sin(a) * d, y: 0.6 + hash2(i, 13) * 1.6, phase: hash2(i, 14) * 20 });
    }
  }

  update(dt: number, time: number, night: number) {
    // Butterflies flutter around a home spot, drifting with smooth noise.
    for (const b of this.butterflies) {
      const t = time * b.speed + b.phase;
      const tx = b.hx + Math.sin(t * 0.31) * 4 + Math.sin(t * 0.83) * 1.5;
      const tz = b.hz + Math.cos(t * 0.27) * 4 + Math.sin(t * 0.71) * 1.5;
      b.x += (tx - b.x) * Math.min(1, dt * 1.5);
      b.z += (tz - b.z) * Math.min(1, dt * 1.5);
      b.y = heightAt(b.x, b.z) + 0.9 + Math.sin(t * 2.3) * 0.35;
    }
    // Fish leap from the lake and the river every few seconds.
    this.jumpTimer -= dt;
    if (this.jumpTimer <= 0) {
      this.jumpTimer = 2 + Math.random() * 4;
      let x: number, z: number;
      if (Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2, d = Math.random() * 13;
        x = PL.lake.x + Math.cos(a) * d; z = PL.lake.z + Math.sin(a) * d;
      } else {
        const pts: [number, number][] = [[34, 2], [32, 22], [18, 40], [-6, 44], [36, -8]];
        const p = pts[Math.floor(Math.random() * pts.length)];
        x = p[0] + (Math.random() - 0.5) * 3; z = p[1] + (Math.random() - 0.5) * 3;
      }
      if (heightAt(x, z) < WATER_Y - 0.2) this.jumps.push({ x, z, ry: Math.random() * Math.PI * 2, t: 0, dur: 0.9 + Math.random() * 0.4, h: 0.8 + Math.random() * 0.7, splashed: false });
    }
    for (const j of this.jumps) j.t += dt;
    this.jumps = this.jumps.filter((j) => j.t < j.dur + 0.8);
    // Chimney smoke from every house in town (lighter in the daytime).
    this.puffAcc += dt;
    const every = 0.35;
    while (this.puffAcc > every) {
      this.puffAcc -= every;
      const c = this.world.chimneys[Math.floor(Math.random() * this.world.chimneys.length)];
      if (c) this.puffs.push({ x: c[0], y: c[1], z: c[2], vx: 0.35 + Math.random() * 0.2, vy: 0.9 + Math.random() * 0.3, life: 0, max: 3.5, size: 0.45 });
      for (const f of this.world.fires) if (Math.random() < 0.6) this.puffs.push({ x: f[0] + (Math.random() - 0.5) * 0.4, y: f[1] + 0.9, z: f[2], vx: 0.15, vy: 1.1, life: 0, max: 2.2, size: 0.3 });
    }
    for (const p of this.puffs) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    this.puffs = this.puffs.filter((p) => p.life < p.max);
    void night;
  }

  draw(r: Renderer, time: number, night: number) {
    const m = getMeshes(r);
    const day = 1 - night;
    if (day > 0.2) {
      for (const b of this.butterflies) {
        const flap = Math.sin(time * 18 + b.phase) * 1.1;
        const ry = time * 0.7 + b.phase;
        for (const s of [-1, 1]) r.draw(m.wing, compose(b.x, b.y, b.z, ry + (s < 0 ? Math.PI : 0), 0, flap), { unlit: true, tint: b.color, emissive: 0.1, noCast: true });
      }
    }
    if (night > 0.3) {
      for (const f of this.fireflies) {
        const t = time + f.phase;
        const on = Math.max(0, Math.sin(t * 1.7)) ** 3;
        if (on < 0.05) continue;
        const x = f.x + Math.sin(t * 0.4) * 1.2, z = f.z + Math.cos(t * 0.33) * 1.2;
        const y = heightAt(x, z) + f.y + Math.sin(t * 0.9) * 0.3;
        r.draw(this.world.steam, compose(x, y, z, 0, 0, 0, 0.07), { unlit: true, emissive: 1.5, tint: [0.85, 1, 0.45, 1], alpha: on * night, noFog: true });
      }
    }
    // A flock of birds circling over the village (by day).
    if (day > 0.3) {
      for (let i = 0; i < 7; i++) {
        const a = time * 0.12 + i * 0.22;
        const rr = 46 + Math.sin(i * 1.7) * 6;
        const x = Math.cos(a) * rr + Math.sin(i) * 3, z = Math.sin(a) * rr - 10, y = 34 + Math.sin(time * 0.5 + i) * 2 + (i % 3) * 1.5;
        const flap = Math.sin(time * 8 + i) * 0.5;
        r.draw(m.bird, compose(x, y, z, -a, 0, flap * 0.3, 1.4), { noCast: true });
      }
    }
    for (const j of this.jumps) {
      if (j.t < j.dur) {
        const u = j.t / j.dur;
        const y = WATER_Y + Math.sin(u * Math.PI) * j.h;
        const fwd = (u - 0.5) * 1.6;
        r.draw(m.fish, compose(j.x + Math.sin(j.ry) * fwd, y, j.z + Math.cos(j.ry) * fwd, j.ry, (u - 0.5) * 2.2, 0), { noCast: true });
      }
      // Ripple rings where it went in and came out.
      for (const at of [0, j.dur]) {
        const k = (j.t - at) / 0.8;
        if (k < 0 || k > 1) continue;
        const off = at === 0 ? -0.8 : 0.8;
        r.draw(m.ring, compose(j.x + Math.sin(j.ry) * off, WATER_Y + 0.05, j.z + Math.cos(j.ry) * off, 0, 0, 0, 0.3 + k * 1.1, 1, 0.3 + k * 1.1), { unlit: true, alpha: 0.5 * (1 - k), noCast: true });
      }
    }
    for (const p of this.puffs) {
      const k = p.life / p.max;
      r.draw(this.world.steam, compose(p.x, p.y, p.z, 0, 0, 0, p.size * (0.6 + k * 1.6)), { unlit: true, tint: night > 0.5 ? [0.55, 0.58, 0.68, 1] : [0.96, 0.96, 0.98, 1], alpha: 0.42 * (1 - k) });
    }
  }

  /** How close the player is to running water / a crackling fire (0..1), for the ambience mix. */
  static proximity(x: number, z: number, fires: Vec3[]): { water: number; fire: number } {
    const lake = Math.hypot(x - PL.lake.x, z - PL.lake.z) - 16;
    const fountain = Math.hypot(x, z) - 6;
    const water = Math.max(0, Math.min(1, 1 - Math.min(riverDist(x, z) - 2, lake, fountain + 4) / 22));
    let fd = Math.hypot(x + 12, z + 9);
    for (const f of fires) fd = Math.min(fd, Math.hypot(x - f[0], z - f[2]));
    return { water, fire: Math.max(0, Math.min(1, 1 - fd / 12)) };
  }
}
