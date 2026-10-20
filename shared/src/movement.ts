import { HUB, HUB_COLLIDERS } from "./constants";

export interface Pos {
  x: number;
  z: number;
}

/**
 * Server-side movement check for the hub. Accepts the client's proposed position but:
 *  - caps the distance travelled to what max speed allows in the elapsed time,
 *  - keeps the player inside the world circle,
 *  - pushes the player out of solid buildings.
 */
export function validateMove(prev: Pos, proposed: Pos, dtMs: number): Pos {
  if (!Number.isFinite(proposed.x) || !Number.isFinite(proposed.z)) return { ...prev };
  const dt = Math.max(0, Math.min(dtMs, 1000)) / 1000;
  const maxDist = HUB.maxSpeed * HUB.speedTolerance * dt + 0.05;
  let dx = proposed.x - prev.x;
  let dz = proposed.z - prev.z;
  const d = Math.hypot(dx, dz);
  if (d > maxDist) {
    dx = (dx / d) * maxDist;
    dz = (dz / d) * maxDist;
  }
  let x = prev.x + dx;
  let z = prev.z + dz;
  // World boundary.
  const r = Math.hypot(x, z);
  if (r > HUB.radius) {
    x = (x / r) * HUB.radius;
    z = (z / r) * HUB.radius;
  }
  // Buildings.
  for (const c of HUB_COLLIDERS) {
    const cx = x - c.x;
    const cz = z - c.z;
    const cd = Math.hypot(cx, cz);
    if (cd < c.r) {
      const k = cd < 1e-6 ? 1 : c.r / cd;
      x = c.x + (cd < 1e-6 ? c.r : cx * k);
      z = c.z + (cd < 1e-6 ? 0 : cz * k);
    }
  }
  // A scenery push near the edge must never nudge a player beyond the playable
  // world boundary. Apply the boundary one final time after all solid resolves.
  const finalRadius = Math.hypot(x, z);
  if (finalRadius > HUB.radius) {
    x = (x / finalRadius) * HUB.radius;
    z = (z / finalRadius) * HUB.radius;
  }
  return { x, z };
}

export function randomSpawn(rand: () => number = Math.random): Pos {
  // Arrive on the south side of the plaza, looking north over the fountain to the peaks.
  const a = Math.PI / 2 + (rand() - 0.5) * 1.4;
  const r = 8.5 + rand() * 3; // just outside the fountain basin
  return { x: Math.cos(a) * r, z: Math.sin(a) * r };
}
