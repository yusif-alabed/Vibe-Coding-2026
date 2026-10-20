import { TRACK, trackCenterX, type RaceGame, type TrackLayout } from "@beaver/shared";
import { compose, hash2, mixRgb, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { P, rgb } from "./palette";
import { pine, rock, snowyPine } from "./props";
import { canoe as canoeModel } from "./village/architecture";

/** Which minigame the course is themed for: a snowy toboggan run or a forest river for canoes. */
let theme: RaceGame = "toboggan";
export function setRaceTheme(g: RaceGame) {
  theme = g;
}
const slope = () => (theme === "canoe" ? 0.045 : TRACK.slope);

/** Converts track coordinates (lateral x, distance z) into world space. */
export function trackToWorld(x: number, z: number): Vec3 {
  return [trackCenterX(z) + x, -z * slope() + bankHeight(x), -z];
}

/** Height of the river surface at distance z (canoe course). */
export function waterY(z: number): number {
  return -z * slope() + 0.05;
}

/** Slope angle of the course (for tilting sleds and canoes). */
export function courseTilt(): number {
  return Math.atan(slope());
}

function bankHeight(x: number): number {
  const a = Math.abs(x);
  const hw = TRACK.halfWidth;
  if (theme === "canoe") {
    // A riverbed under the water, then grassy banks.
    if (a < hw) return -0.9 + Math.pow(a / hw, 6) * 0.4;
    if (a < hw + 2.5) return -0.5 + ((a - hw) / 2.5) * 1.3;
    return 0.8 + Math.min(1, (a - hw - 2.5) / 6) * 0.9;
  }
  if (a < hw) return Math.pow(a / hw, 4) * 0.5;
  if (a < hw + 2) return 0.5 + ((a - hw) / 2) * 1.6;
  return 2.1 - Math.min(1, (a - hw - 2) / 6) * 0.6;
}

export interface RaceWorld {
  ground: GpuMesh;
  props: GpuMesh;
  water: GpuMesh | null;
  paddle: GpuMesh;
  glow: GpuMesh;
  gate: GpuMesh;
  sled: GpuMesh;
  puff: GpuMesh;
}

export function buildRaceWorld(r: Renderer, layout: TrackLayout, seed: number): RaceWorld {
  const g = new MeshBuilder();
  const p = new MeshBuilder();
  const glow = new MeshBuilder();
  const step = 4;
  const lat = [-40, -24, -16, -12, -10.5, -9, -8, -6, -3, 0, 3, 6, 8, 9, 10.5, 12, 16, 24, 40];
  const canoe = theme === "canoe";
  const riverCol = (z: number, x: number): Vec3 => {
    const a = Math.abs(x);
    const n = hash2(Math.floor(x), Math.floor(z / 4)) * 0.1;
    if (a < TRACK.halfWidth) return mixRgb(rgb("#3b6b68"), rgb("#2a5a5c"), n * 4);
    if (a < TRACK.halfWidth + 2.8) return mixRgb(rgb("#d8c18c"), rgb("#bba47c"), n * 3);
    return mixRgb(rgb("#7aa34a"), rgb("#5f8a3c"), n * 4 + (Math.floor(z / 9) % 2) * 0.1);
  };
  const snowCol = (z: number, x: number): Vec3 => {
    if (canoe) return riverCol(z, x);
    const onTrack = Math.abs(x) < TRACK.halfWidth;
    const stripe = onTrack && Math.floor(z / 6) % 2 === 0 ? 0.04 : 0;
    const n = hash2(Math.floor(x), Math.floor(z / 4)) * 0.08;
    return onTrack ? mixRgb(rgb("#eef6ff"), rgb("#cfe2f5"), stripe * 6 + n) : mixRgb(rgb(P.snow), rgb(P.snowShade), n * 3);
  };
  for (let z = -40; z < TRACK.length + 80; z += step) {
    for (let i = 0; i < lat.length - 1; i++) {
      const a = trackToWorld(lat[i], z), b = trackToWorld(lat[i + 1], z);
      const c = trackToWorld(lat[i + 1], z + step), d = trackToWorld(lat[i], z + step);
      const mid = (lat[i] + lat[i + 1]) / 2;
      g.tri(a, b, c, snowCol(z, mid));
      g.tri(a, c, d, snowCol(z + 2, mid));
    }
  }
  // Forest lining the run.
  for (let z = -30; z < TRACK.length + 70; z += 5) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        if (hash2(z * 0.7 + k, side * 13 + seed % 97) < 0.35) continue;
        const x = side * (13 + k * 8 + hash2(z, k) * 6);
        const [wx, wy, wz] = trackToWorld(x, z + hash2(k, z) * 4);
        if (canoe) pine(p, wx, wy - 0.3, wz, 1 + hash2(x, z) * 0.6, k + z);
        else snowyPine(p, wx, wy - 0.3, wz, 1 + hash2(x, z) * 0.6, k + z);
      }
    }
  }
  // Obstacles.
  if (canoe) {
    // Reeds and lily pads along the banks.
    for (let z = -20; z < TRACK.length + 60; z += 2.5) {
      for (const side of [-1, 1]) {
        if (hash2(z, side * 7) < 0.45) continue;
        const [x, , wz] = trackToWorld(side * (TRACK.halfWidth + 0.4 + hash2(side, z) * 1.6), z);
        const wy = waterY(z);
        for (let k = 0; k < 4; k++) p.cylinder(compose(x + (hash2(k, z) - 0.5) * 0.6, wy + 0.5, wz + (hash2(z, k) - 0.5) * 0.6, 0, (hash2(k, side) - 0.5) * 0.3, 0, 0.06, 1.2, 0.06), "#6f8f3a", 4);
        p.cylinder(compose(x, wy + 1.1, wz, 0, 0, 0, 0.12, 0.3, 0.12), "#7a4b2c", 5);
        if (hash2(z * 3, side) < 0.4) p.cylinder(compose(x - side * 1.2, wy + 0.02, wz + 0.5, z, 0, 0, 0.9, 0.03, 0.9), "#4f8f4a", 8);
      }
    }
  }
  for (const o of layout.obstacles) {
    const [x, y0, z] = trackToWorld(o.x, o.z);
    const y = canoe ? waterY(o.z) - 0.2 : y0;
    if (canoe) {
      if (o.kind === "rock") rock(p, x, y - 0.3, z, 1.2);
      else if (o.kind === "pine") {
        // A floating log.
        p.cylinder(compose(x, y + 0.25, z, 0.4 + o.id, 0, Math.PI / 2, 0.75, 2.6, 0.75), "#7a4b2c", 8);
        for (const s of [-1, 1]) p.cylinder(compose(x + Math.cos(0.4 + o.id) * s * 1.3, y + 0.25, z - Math.sin(0.4 + o.id) * s * 1.3, 0.4 + o.id, 0, Math.PI / 2, 0.66, 0.04, 0.66), "#d9b77a", 8);
      } else {
        // A red and white buoy.
        p.sphere(compose(x, y + 0.35, z, 0, 0, 0, 0.6, 0.6, 0.6), (_x, yy) => (yy > y + 0.45 ? rgb("#ffffff") : rgb("#e2483d")), 6, 10);
        p.cylinder(compose(x, y + 1.2, z, 0, 0, 0, 0.12, 0.9, 0.12), "#3a3a45", 6);
        glow.sphere(compose(x, y + 1.7, z, 0, 0, 0, 0.16), "#ffd166", 3, 5);
      }
      continue;
    }
    if (o.kind === "rock") rock(p, x, y - 0.2, z, 1.1);
    else if (o.kind === "pine") snowyPine(p, x, y - 0.2, z, 0.75, o.id);
    else {
      p.sphere(compose(x, y + 0.55, z, 0, 0, 0, 0.75), P.snow, 5, 8);
      p.sphere(compose(x, y + 1.45, z, 0, 0, 0, 0.55), P.snow, 5, 8);
      p.sphere(compose(x, y + 2.15, z, 0, 0, 0, 0.4), P.snow, 5, 8);
      p.cone(compose(x, y + 2.15, z + 0.5, 0, Math.PI / 2, 0, 0.12, 0.45, 0.12), "#ff8a3d", 5);
      for (const s of [-1, 1]) p.sphere(compose(x + s * 0.14, y + 2.28, z + 0.34, 0, 0, 0, 0.06), P.ink, 3, 4);
      p.cylinder(compose(x, y + 2.55, z, 0, 0, 0, 0.6, 0.12, 0.6), "#2b2b38", 8);
      p.cylinder(compose(x, y + 2.75, z, 0, 0, 0, 0.42, 0.4, 0.42), "#2b2b38", 8);
      p.torus(compose(x, y + 1.85, z, 0, 0, 0, 0.45, 0.9, 0.45), "#e2483d", 1, 0.25, 12, 5);
    }
  }
  // Start and finish arches.
  for (const [z, col] of [[-2, P.roofTeal], [TRACK.length, P.roofRed]] as const) {
    for (const s of [-1, 1]) {
      const [x, y, wz] = trackToWorld(s * (TRACK.halfWidth + 1.5), z);
      p.cylinder(compose(x, y + 4.5, wz, 0, 0, 0, 0.6, 9, 0.6), P.timberDark, 7);
    }
    const [cx, cy, cz] = trackToWorld(0, z);
    p.box(compose(cx, cy + 9.2, cz, 0, 0, 0, TRACK.halfWidth * 2 + 4, 1.4, 0.5), col);
    if (z > 0) {
      for (let i = 0; i < 16; i++) {
        glow.box(compose(cx - 8 + i + 0.5, cy + 9.2, cz + 0.3, 0, 0, 0, 0.95, 0.65, 0.05), i % 2 ? "#ffffff" : "#222222");
      }
    }
  }
  // Snow mountains around the run.
  const mtn = new MeshBuilder();
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    const z = (i / 18) * (TRACK.length + 300) - 100;
    const [x, y, wz] = trackToWorld(side * (130 + hash2(i, 4) * 80), z);
    const h = 90 + hash2(i, 5) * 80;
    mtn.cone(compose(x, y + h / 2 - 20, wz, i, 0, 0, 90, h, 70), (_x, yy) => (yy > y + h * 0.25 ? rgb(P.snow) : rgb(P.rock)), 6, 0.12);
  }
  p.merge(mtn);

  const gate = new MeshBuilder().torus(compose(0, 0, 0, 0, Math.PI / 2, 0), P.gold, TRACK.gateRadius, 0.22, 22, 6);
  // Snowflake spokes inside the ring.
  for (let i = 0; i < 3; i++) gate.box(compose(0, 0, 0, 0, 0, (i / 3) * Math.PI, 0.1, TRACK.gateRadius * 1.8, 0.1), "#bff7ff");

  const sled = new MeshBuilder();
  sled.box(compose(0, 0.12, 0, 0, 0, 0, 1.2, 0.12, 2.3), P.timberLight);
  for (let i = 0; i < 4; i++) sled.box(compose(0, 0.2, -0.9 + i * 0.6, 0, 0, 0, 1.25, 0.05, 0.12), P.timberDark);
  sled.cylinder(compose(0, 0.45, 1.15, 0, 0, Math.PI / 2, 0.5, 1.2, 0.5), P.roofRed, 10, 0.5, 0.5);
  for (const s of [-1, 1]) sled.box(compose(s * 0.55, 0.05, 0, 0, 0, 0, 0.1, 0.1, 2.4), "#3a3a45");

  const puff = new MeshBuilder().sphere(compose(0, 0, 0), "#ffffff", 3, 5);
  const boat = new MeshBuilder();
  canoeModel(boat, 0, 0.2, 0, 0, rgb("#c8473a"));
  const paddle = new MeshBuilder();
  paddle.cylinder(compose(0, 0, 0, 0, 0, 0, 0.06, 1.6, 0.06), "#b9804c", 5);
  paddle.box(compose(0, -0.95, 0, 0, 0, 0, 0.26, 0.5, 0.05), "#9b6338");
  let water: GpuMesh | null = null;
  if (canoe) {
    const w = new MeshBuilder();
    const up: Vec3 = [0, 1, 0];
    const hw = TRACK.halfWidth + 1.6;
    for (let z = -40; z < TRACK.length + 80; z += 3) {
      const a = trackToWorld(-hw, z), b = trackToWorld(hw, z), c = trackToWorld(hw, z + 3), d = trackToWorld(-hw, z + 3);
      a[1] = b[1] = waterY(z);
      c[1] = d[1] = waterY(z + 3);
      const col = rgb("#3fa3b0");
      w.vertex(a, up, col).vertex(b, up, col).vertex(c, up, col);
      w.vertex(a, up, col).vertex(c, up, col).vertex(d, up, col);
    }
    water = r.upload(w.build());
  }

  return {
    ground: r.upload(g.build()),
    props: r.upload(p.build()),
    glow: r.upload(glow.build()),
    gate: r.upload(gate.build()),
    sled: r.upload((canoe ? boat : sled).build()),
    water,
    paddle: r.upload(paddle.build()),
    puff: r.upload(puff.build()),
  };
}
