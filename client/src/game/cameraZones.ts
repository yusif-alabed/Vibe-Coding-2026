import { STREETS, TOWN_PLACES } from "@beaver/shared";
import type { Vec3 } from "../engine/math";
import { heightAt } from "./hubWorld";

/**
 * Fixed camera zones for tight spots, in the spirit of a big-city street in a cosy RPG: once you walk
 * onto Main Street, Cottage Lane or the East Road, the camera glides up onto a rail high above the
 * street and looks down it at a fixed angle, following you along. At the skating pond it settles on
 * a fixed grandstand view. Outside the zones the free follow camera comes back smoothly.
 *
 * In a zone, the camera can't be dragged around, so it never swings into a wall or a roof.
 */

export interface CamZone {
  name: string;
  /** How much this zone applies at (x, z): 0 outside, 1 fully inside (soft edges). */
  weight(x: number, z: number): number;
  /** Camera eye and look-at target for a beaver standing at focus. */
  camera(focus: Vec3): { eye: Vec3; target: Vec3 };
  /** Camera yaw the view settles to. */
  yaw(focus: Vec3): number;
  /**
   * Yaw used for walking controls: on a street "forward" goes straight up the road, even though the
   * camera looks at it from an angle.
   */
  moveYaw(focus: Vec3): number;
}

const smooth = (a: number, b: number, v: number) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A camera rail along a street: high, angled, always looking down the street. */
function rail(name: string, seg: readonly [number, number, number, number], halfWidth: number, yaw: number, dist: number, height: number, trimStart = 0, trimEnd = 0): CamZone {
  const [ax, az, bx, bz] = seg;
  const len = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / len, uz = (bz - az) / len;
  const sx = Math.sin(yaw), sz = Math.cos(yaw);
  return {
    name,
    weight(x, z) {
      const t = (x - ax) * ux + (z - az) * uz;
      const side = Math.abs((x - ax) * -uz + (z - az) * ux);
      const across = 1 - smooth(halfWidth, halfWidth + 4, side);
      const along = smooth(trimStart, trimStart + 6, t) * (1 - smooth(len - trimEnd - 6, len - trimEnd, t));
      return across * along;
    },
    camera(f) {
      const eye: Vec3 = [f[0] + sx * dist, f[1] + height, f[2] + sz * dist];
      eye[1] = Math.max(eye[1], heightAt(eye[0], eye[2]) + height * 0.8);
      // Look slightly ahead of the beaver, down the street.
      return { eye, target: [f[0] - sx * 2, f[1] + 1.0, f[2] - sz * 2] };
    },
    yaw: () => yaw,
    // Forward = along the street, in whichever direction the camera is looking.
    moveYaw: () => {
      const s = ux * -sx + uz * -sz >= 0 ? 1 : -1;
      return Math.atan2(-ux * s, -uz * s);
    },
  };
}

/** A fixed grandstand camera looking over an area (it turns to follow you but doesn't move). */
function stand(name: string, cx: number, cz: number, radius: number, eyeOff: Vec3): CamZone {
  const eye: Vec3 = [cx + eyeOff[0], heightAt(cx, cz) + eyeOff[1], cz + eyeOff[2]];
  return {
    name,
    weight: (x, z) => 1 - smooth(radius, radius + 4, Math.hypot(x - cx, z - cz)),
    camera(f) {
      return { eye, target: [cx + (f[0] - cx) * 0.6, f[1] + 0.8, cz + (f[2] - cz) * 0.6] };
    },
    yaw: (f) => Math.atan2(eye[0] - f[0], eye[2] - f[2]),
    moveYaw: (f) => Math.atan2(eye[0] - f[0], eye[2] - f[2]),
  };
}

const MAIN = STREETS[0]; // plaza → town hall (west)
const LANE = STREETS[1]; // cottage lane (north)
const EAST = STREETS[5]; // east road

export const CAMERA_ZONES: CamZone[] = [
  // Main Street: looking west down the street from high above the south-side roofs.
  rail("Main Street", MAIN, 8.5, Math.PI / 2 - 0.32, 14, 12.5, 16, 0),
  // Cottage Lane: looking north toward the windmill.
  rail("Cottage Lane", LANE, 7.5, 0.1, 13, 12, 4, 4),
  // East Road: looking east past the greenhouse and observatory.
  rail("East Road", EAST, 7.5, -(Math.PI / 2 - 0.32), 14, 12.5, 2, 0),
  // Skating pond: a fixed view from the south bank.
  stand("Skating Pond", TOWN_PLACES.rink.x, TOWN_PLACES.rink.z, 10, [3, 9, 17]),
];

/** The zone that applies most at (x, z), and how strongly. */
export function cameraZoneAt(x: number, z: number): { zone: CamZone | null; weight: number } {
  let best: CamZone | null = null, bw = 0;
  for (const zn of CAMERA_ZONES) {
    const w = zn.weight(x, z);
    if (w > bw) { bw = w; best = zn; }
  }
  return { zone: best, weight: bw };
}
