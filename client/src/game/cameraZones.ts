import { STREETS } from "@beaver/shared";

/**
 * Street walking helper. The camera is a plain follow camera, but on the town's streets
 * "forward" snaps to run straight along the road (whichever way along it is closest to where the
 * camera faces), so you don't drift diagonally into the shop fronts when the camera is at an angle.
 */

const MAIN = STREETS[0]; // plaza → town hall
const LANE = STREETS[1]; // cottage lane
const EAST = STREETS[5]; // east road

const RAILS: { seg: readonly [number, number, number, number]; halfWidth: number; trimStart: number }[] = [
  { seg: MAIN, halfWidth: 6, trimStart: 15 },
  { seg: LANE, halfWidth: 5, trimStart: 6 },
  { seg: EAST, halfWidth: 5, trimStart: 2 },
];

/** Max angle between the camera's forward and the street for the snap to kick in (about 50°). */
const SNAP = 0.9;

/** The controls yaw to use at (x, z), or null when you're not on a street (or facing across it). */
export function streetYaw(x: number, z: number, camYaw: number): number | null {
  const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw);
  for (const r of RAILS) {
    const [ax, az, bx, bz] = r.seg;
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const t = (x - ax) * ux + (z - az) * uz;
    const side = Math.abs((x - ax) * -uz + (z - az) * ux);
    if (t < r.trimStart || t > len || side > r.halfWidth) continue;
    const dot = fx * ux + fz * uz;
    if (Math.abs(dot) < Math.cos(SNAP)) return null;
    const s = dot >= 0 ? 1 : -1;
    return Math.atan2(-ux * s, -uz * s);
  }
  return null;
}
