import { GONDOLA, TRAIN, trainAngle } from "@beaver/shared";
import { compose, hexToRgb, type Vec3 } from "../../engine/math";
import { MeshBuilder } from "../../engine/mesh";
import { box, Frame } from "./architecture";
import { stoneBlock } from "./nature";

/**
 * Getting around the valley: the little steam train that circles just outside town (through a tunnel
 * under the waterfall cliff), the summit gondola on its cable, and the hot-air balloons on the meadow.
 */

const C = hexToRgb;
const IRON = C("#2e2b2a"), TIMBER = C("#5b3a24"), GOLD = C("#e8b84a"), STONE = C("#9a9184"), WHITE = C("#fbf7ee");

/** Height of the rails (a steady grade around the loop; bridges and a tunnel take care of the rest). */
export const RAIL_Y = 0.42;

export function railPoint(a: number, offset = 0): Vec3 {
  const r = TRAIN.r + offset;
  return [Math.cos(a) * r, RAIL_Y, Math.sin(a) * r];
}

/** The rails, sleepers, trestles over low ground, and stone tunnel portals where the loop meets the cliff. */
export function buildRailway(heightAt: (x: number, z: number) => number): { body: MeshBuilder; glow: MeshBuilder } {
  const body = new MeshBuilder(), glow = new MeshBuilder();
  const N = 900;
  let inTunnel = false;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2, a1 = ((i + 1) / N) * Math.PI * 2;
    const p = railPoint(a), q = railPoint(a1);
    const g = heightAt(p[0], p[2]);
    const tunnel = g > RAIL_Y + 3.4;
    if (tunnel !== inTunnel) {
      // Arched stone portal at the tunnel mouth.
      const f = new Frame(p[0], RAIL_Y, p[2], -a);
      for (let k = 0; k <= 10; k++) {
        const t = (k / 10) * Math.PI;
        stoneBlock(body, f.m(Math.cos(t) * 2.3, 0.2 + Math.sin(t) * 3.3, 0, 0.9, 0.55, 1.4, 0, 0, t), i * 31 + k, STONE);
      }
      for (const s of [-1, 1]) stoneBlock(body, f.m(s * 2.5, 1.2, 0, 0.8, 2.6, 1.5), i * 7 + s, STONE);
      inTunnel = tunnel;
    }
    if (tunnel) continue;
    const yaw = Math.atan2(q[0] - p[0], q[2] - p[2]);
    const len = Math.hypot(q[0] - p[0], q[2] - p[2]) + 0.02;
    for (const s of [-0.55, 0.55]) {
      const rp = railPoint((a + a1) / 2, s);
      body.box(compose(rp[0], RAIL_Y + 0.14, rp[2], yaw, 0, 0, 0.1, 0.1, len), C("#8a8f96"));
    }
    if (i % 2 === 0) {
      const sp = railPoint(a);
      body.box(compose(sp[0], RAIL_Y, sp[2], yaw, 0, 0, 1.7, 0.12, 0.28), TIMBER);
    }
    // Ballast bed on the ground, or a timber trestle where the ground dips (over the river).
    if (g > RAIL_Y - 0.6) {
      if (i % 2 === 0) body.box(compose(p[0], (RAIL_Y + g) / 2 - 0.1, p[2], yaw, 0, 0, 2.3, Math.max(0.12, RAIL_Y - g + 0.1), len * 2), C("#8c8274"));
    } else if (i % 6 === 0) {
      const hgt = RAIL_Y - g + 0.4;
      for (const s of [-0.8, 0.8]) {
        const tp = railPoint(a, s);
        body.box(compose(tp[0], g + hgt / 2 - 0.4, tp[2], yaw, 0, 0, 0.22, hgt, 0.22), TIMBER);
      }
      body.box(compose(p[0], RAIL_Y - 0.15, p[2], yaw, 0, 0, 2.2, 0.2, 0.3), TIMBER);
      body.box(compose(p[0], (RAIL_Y + g) / 2 - 0.2, p[2], yaw, 0, Math.PI / 2 - 0.6, 0.14, 0.14, 2.2), TIMBER);
    }
    // Signal lamps every so often.
    if (i % 75 === 0 && g > RAIL_Y - 0.6) {
      const lp = railPoint(a, -1.6);
      body.cylinder(compose(lp[0], RAIL_Y + 1.1, lp[2], 0, 0, 0, 0.1, 2.2, 0.1), IRON, 5);
      glow.sphere(compose(lp[0], RAIL_Y + 2.25, lp[2], 0, 0, 0, 0.16), i % 150 ? C("#7dff8a") : C("#ffd166"), 3, 5);
    }
  }
  return { body, glow };
}

/** Steam engine, coal tender and open carriages (each mesh faces +z, wheels on y = 0). */
export function buildTrain(): { engine: MeshBuilder; car: MeshBuilder; lamp: MeshBuilder } {
  const engine = new MeshBuilder();
  const red = C("#c8473a"), green = C("#2f6b3a"), black = C("#2a2624");
  engine.box(compose(0, 0.55, 0, 0, 0, 0, 1.7, 0.3, 3.6), black);
  engine.cylinder(compose(0, 1.25, 0.55, 0, Math.PI / 2, 0, 1.1, 2.3, 1.1), green, 12);
  for (const z of [0.1, 0.9]) engine.cylinder(compose(0, 1.25, z, 0, Math.PI / 2, 0, 1.16, 0.1, 1.16), GOLD, 12);
  engine.cylinder(compose(0, 2.15, 1.35, 0, 0, 0, 0.36, 0.8, 0.36), black, 8, 0.6, 0.4);
  engine.cylinder(compose(0, 2.6, 1.35, 0, 0, 0, 0.6, 0.2, 0.6), black, 8);
  engine.sphere(compose(0, 1.95, 0.4, 0, 0, 0, 0.26), GOLD, 4, 6);
  engine.box(compose(0, 1.55, -0.95, 0, 0, 0, 1.6, 1.8, 1.3), red);
  engine.box(compose(0, 2.55, -0.95, 0, 0, 0, 1.9, 0.14, 1.6), black);
  for (const s of [-1, 1]) engine.box(compose(s * 0.81, 1.7, -0.85, 0, 0, 0, 0.04, 0.6, 0.7), C("#ffd08a"));
  engine.cone(compose(0, 0.5, 1.95, 0, Math.PI / 2, 0, 1.4, 0.6, 0.9), red, 4);
  for (const s of [-1, 1]) for (const z of [-1.1, 0, 1.1]) {
    engine.cylinder(compose(s * 0.82, 0.38, z, 0, 0, Math.PI / 2, z === 0 ? 0.8 : 0.62, 0.12, z === 0 ? 0.8 : 0.62), red, 10);
    engine.cylinder(compose(s * 0.89, 0.38, z, 0, 0, Math.PI / 2, 0.2, 0.06, 0.2), GOLD, 6);
  }
  for (const s of [-1, 1]) engine.box(compose(s * 0.9, 0.42, 0, 0, 0, 0, 0.05, 0.08, 2.3), C("#c0c0c0"));
  const lamp = new MeshBuilder();
  lamp.sphere(compose(0, 1.3, 1.82, 0, 0, 0, 0.22), C("#fff1b8"), 4, 6);

  const car = new MeshBuilder();
  car.box(compose(0, 0.55, 0, 0, 0, 0, 1.7, 0.25, 3.2), black);
  car.box(compose(0, 0.85, 0, 0, 0, 0, 1.7, 0.4, 3.2), C("#8a5a34"));
  for (const s of [-1, 1]) car.box(compose(s * 0.8, 1.15, 0, 0, 0, 0, 0.1, 0.35, 3.2), C("#c8473a"));
  for (const z of [-1.55, 1.55]) car.box(compose(0, 1.15, z, 0, 0, 0, 1.7, 0.35, 0.1), C("#c8473a"));
  // Bench seats facing outward in the middle, and a little roof on posts.
  car.box(compose(0, 1.15, 0, 0, 0, 0, 0.5, 0.25, 2.9), C("#6b4126"));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) car.box(compose(sx * 0.78, 1.9, sz * 1.45, 0, 0, 0, 0.08, 1.6, 0.08), GOLD);
  car.box(compose(0, 2.72, 0, 0, 0, 0, 1.95, 0.1, 3.4), C("#2f6b3a"));
  car.box(compose(0, 2.8, 0, 0, 0, 0, 1.6, 0.08, 3.2), WHITE);
  for (const s of [-1, 1]) for (const z of [-1.0, 1.0]) car.cylinder(compose(s * 0.82, 0.36, z, 0, 0, Math.PI / 2, 0.55, 0.1, 0.55), black, 8);
  return { engine, car, lamp };
}

/** Pose (position, heading) of train unit k (0 = engine) at a time. */
export function trainUnit(k: number, now = Date.now(), which = 0): { x: number; y: number; z: number; yaw: number; a: number } {
  // The train runs anticlockwise; each unit trails behind the one in front.
  const a = trainAngle(now, which) - (k * TRAIN.carLen) / TRAIN.r;
  const p = railPoint(a);
  // Heading along increasing angle: derivative of (cos a, sin a) is (−sin a, cos a).
  return { x: p[0], y: RAIL_Y + 0.14, z: p[2], yaw: Math.atan2(-Math.sin(a), Math.cos(a)), a };
}

// ------------------------------------------------------------------ Gondola

export function gondolaPoint(t: number): Vec3 {
  // t = 0 at the base wheel, 1 at the top station; the cable sags a little between pylons.
  const b = GONDOLA.base, top = GONDOLA.top;
  const baseY = 6.2;
  const x = b.x + (top.x - b.x) * t, z = b.z + (top.z - b.z) * t;
  const y = baseY + (top.y - baseY) * t - Math.sin(t * Math.PI * 3) ** 2 * 1.5;
  return [x, y, z];
}

export function buildGondolaLine(heightAt: (x: number, z: number) => number): { body: MeshBuilder; cabin: MeshBuilder } {
  const body = new MeshBuilder();
  const N = 120;
  for (const side of [-0.6, 0.6]) {
    for (let i = 0; i < N; i++) {
      const p = gondolaPoint(i / N), q = gondolaPoint((i + 1) / N);
      const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2];
      const len = Math.hypot(dx, dy, dz);
      const yaw = Math.atan2(dx, dz), pitch = -Math.atan2(dy, Math.hypot(dx, dz));
      const perp: [number, number] = [Math.cos(yaw), -Math.sin(yaw)];
      body.box(compose((p[0] + q[0]) / 2 + perp[0] * side, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2 + perp[1] * side, yaw, pitch, 0, 0.05, 0.05, len + 0.05), IRON);
    }
  }
  // Lattice pylons where the cable comes close to the slope.
  for (const t of [1 / 3, 2 / 3]) {
    const p = gondolaPoint(t);
    const g = Math.min(heightAt(p[0], p[2]), p[1] - 4);
    const hgt = p[1] - g + 0.8;
    const yaw = Math.atan2(GONDOLA.top.x - GONDOLA.base.x, GONDOLA.top.z - GONDOLA.base.z);
    const f = new Frame(p[0], g, p[2], yaw);
    for (const sx of [-1, 1]) box(body, f, sx * 0.9, hgt / 2, 0, 0.3, hgt, 0.3, C("#c7c2b8"), 0, 0, -sx * 0.06);
    for (let k = 1; k < 6; k++) box(body, f, 0, (hgt * k) / 6, 0, 1.8 - k * 0.12, 0.14, 0.14, C("#c7c2b8"));
    box(body, f, 0, hgt, 0, 2.6, 0.3, 0.4, C("#c7c2b8"));
  }
  // Top station on a rocky perch.
  const top = GONDOLA.top;
  const tf = new Frame(top.x, top.y - 6.5, top.z, Math.atan2(GONDOLA.base.x - top.x, GONDOLA.base.z - top.z));
  for (let k = 0; k < 14; k++) stoneBlock(body, tf.m((k % 4 - 1.5) * 2.4, -Math.floor(k / 4) * 3, (Math.floor(k / 4) % 2 - 0.5) * 2.2, 3.6 + k * 0.3, 3.2, 3.6 + k * 0.3, k), k + 400, C("#8a8f96"));
  box(body, tf, 0, 4.6, 0, 7, 4.4, 6, C("#d8d0c4"));
  box(body, tf, 0, 7.1, 0, 8, 0.4, 7, C("#c8473a"));
  body.cone(tf.m(0, 8.2, 0, 6.5, 2.2, 5.5, Math.PI / 4), C("#c8473a"), 4);
  body.box(tf.m(0, 0.3, 0, 7.5, 0.6, 6.5), C("#f4f7fb"));
  // The cabin (hangs from its grip; faces +z).
  const cabin = new MeshBuilder();
  cabin.box(compose(0, -2.2, 0, 0, 0, 0, 1.8, 1.7, 1.8), C("#c8473a"));
  for (const s of [-1, 1]) {
    cabin.box(compose(s * 0.91, -2.0, 0, 0, 0, 0, 0.04, 0.9, 1.4), C("#bfe6f2"));
    cabin.box(compose(0, -2.0, s * 0.91, 0, 0, 0, 1.4, 0.9, 0.04), C("#bfe6f2"));
  }
  cabin.box(compose(0, -1.3, 0, 0, 0, 0, 1.95, 0.15, 1.95), WHITE);
  cabin.box(compose(0, -3.08, 0, 0, 0, 0, 1.9, 0.1, 1.9), C("#2a2624"));
  cabin.box(compose(0, -0.65, 0, 0, 0, 0, 0.1, 1.3, 0.1), IRON);
  cabin.box(compose(0, 0, 0, 0, 0, 0, 0.6, 0.25, 0.3), IRON);
  return { body, cabin };
}

/** Cabin positions: they loop up one side and down the other (shown as one line of cabins). */
export function gondolaCabins(time: number): { p: Vec3; yaw: number }[] {
  const out: { p: Vec3; yaw: number }[] = [];
  const yaw = Math.atan2(GONDOLA.top.x - GONDOLA.base.x, GONDOLA.top.z - GONDOLA.base.z);
  for (let i = 0; i < GONDOLA.cabins; i++) {
    const u = (time * GONDOLA.speed + i / GONDOLA.cabins) % 1;
    const t = u < 0.5 ? u * 2 : 2 - u * 2; // up, then back down
    const p = gondolaPoint(t);
    out.push({ p: [p[0] + Math.cos(yaw) * (u < 0.5 ? 0.6 : -0.6), p[1], p[2] - Math.sin(yaw) * (u < 0.5 ? 0.6 : -0.6)], yaw });
  }
  return out;
}

// ------------------------------------------------------------------ Hot-air balloons

export const BALLOON_COLORS = [["#e2483d", "#ffd166"], ["#2fa7a2", "#fffaf0"], ["#a77bff", "#ff7eb3"], ["#4c8cff", "#f5c242"]];

export function buildBalloon(a: string, b: string): MeshBuilder {
  const m = new MeshBuilder();
  const ca = C(a), cb = C(b);
  // Envelope: stacked rings with vertical stripes.
  const rows = 9;
  for (let i = 0; i < rows; i++) {
    const t0 = i / rows, t1 = (i + 1) / rows;
    const r0 = Math.sin(Math.min(1, t0 * 1.15) * Math.PI * 0.62 + 0.25) * 3.2 * (1 - t0 * 0.15);
    const r1 = Math.sin(Math.min(1, t1 * 1.15) * Math.PI * 0.62 + 0.25) * 3.2 * (1 - t1 * 0.15);
    const y0 = 3.2 + t0 * 7, y1 = 3.2 + t1 * 7;
    const segs = 12;
    for (let k = 0; k < segs; k++) {
      const p0 = (k / segs) * Math.PI * 2, p1 = ((k + 1) / segs) * Math.PI * 2;
      const col = k % 2 ? ca : cb;
      const v = (r: number, p: number, y: number): Vec3 => [Math.cos(p) * r, y, Math.sin(p) * r];
      m.tri(v(r0, p0, y0), v(r1, p1, y1), v(r0, p1, y0), col);
      m.tri(v(r0, p0, y0), v(r1, p0, y1), v(r1, p1, y1), col);
    }
  }
  m.sphere(compose(0, 10.2, 0, 0, 0, 0, 2.35, 0.9, 2.35), ca, 5, 12);
  // Ropes and the wicker basket.
  for (let k = 0; k < 4; k++) {
    const p = (k / 4) * Math.PI * 2 + Math.PI / 4;
    m.box(compose(Math.cos(p) * 0.85, 2.3, Math.sin(p) * 0.85, -p, 0, 0, 0.04, 2.2, 0.04), C("#5b3a24"));
  }
  m.box(compose(0, 0.6, 0, 0, 0, 0, 1.6, 1.2, 1.6), C("#b88a4a"));
  m.box(compose(0, 1.22, 0, 0, 0, 0, 1.75, 0.12, 1.75), C("#8a5a34"));
  m.cylinder(compose(0, 2.7, 0, 0, 0, 0, 0.4, 0.5, 0.4), C("#2a2624"), 6);
  return m;
}

/** When (ms) the seat on car `car` of the next train reaches the station platform after `from`. */
export function nextBoarding(from: number, car: number): { at: number; which: number } {
  const w = TRAIN.speed / TRAIN.r; // radians per second
  let best = { at: Infinity, which: 0 };
  for (let which = 0; which < TRAIN.trains; which++) {
    const seat = trainAngle(from, which) - (car * TRAIN.carLen) / TRAIN.r;
    let d = (TRAIN.stationAngle - seat) % (Math.PI * 2);
    if (d < 0) d += Math.PI * 2;
    const at = from + (d / w) * 1000;
    if (at < best.at) best = { at, which };
  }
  return best;
}
