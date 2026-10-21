/**
 * Layout of the town that grew around the original village: Main Street with its shops and town
 * square, a cottage lane up to the windmill, the east quarter across the river (watermill,
 * greenhouse, fire lookout, observatory), and the fairground and campground south of the river.
 *
 * Pure data (no imports) so constants.ts can use the streets and building footprints while it
 * places trees and collision. The client builds every model from these same numbers.
 */

export type BuildingKind =
  | "bakery" | "post" | "store" | "flowers" | "icecream" | "toys" | "library" | "maple" | "townhall"
  | "cottage" | "windmill" | "watermill" | "lookout" | "observatory" | "greenhouse" | "ranger"
  | "lighthouse" | "bandstand" | "stall" | "ferris" | "tent";

export interface TownBuilding {
  kind: BuildingKind;
  x: number;
  z: number;
  /** Facing: the building's front points along (sin ry, cos ry). */
  ry: number;
  /** Width across the front and depth front-to-back (metres). Round things use w as the diameter. */
  w: number;
  d: number;
  seed: number;
}

const N = 0, S = Math.PI, E = Math.PI / 2, W = -Math.PI / 2;

/** Streets and lanes (straight segments), added to the trail network. */
export const STREETS: [number, number, number, number][] = [
  [0, 0, -94, 0], // Main Street, west from the plaza to the town hall
  [-46, -3, -46, -62], // Cottage Lane, north to the windmill
  [-46, -44, -30, -50], // to the skating pond
  [-70, 6, -61, 25], // down to the lighthouse
  [0, 0, 29.4, -7.9], // to the east bridge
  [42, -8, 90, -8], // East Road
  [68, -9, 68, -17], // up to the fire lookout
  [6.3, 47.2, 8, 86], // South Road past the fairground
  [7.5, 66, 20, 66], // to the Ferris wheel
  [-4, 80, 7.8, 80], // to the ranger station
  [6.8, 60, -12, 62], // to the campground
];

export const TOWN_BUILDINGS: TownBuilding[] = [
  // Main Street, north side (fronts face the street, +z).
  { kind: "bakery", x: -39, z: -7.5, ry: N, w: 8, d: 7, seed: 1 },
  { kind: "post", x: -53, z: -7.5, ry: N, w: 8, d: 7, seed: 2 },
  { kind: "store", x: -62.5, z: -8, ry: N, w: 8.5, d: 8, seed: 3 },
  { kind: "library", x: -86, z: -8.5, ry: N, w: 10, d: 9, seed: 4 },
  // Main Street, south side.
  { kind: "flowers", x: -40, z: 7, ry: S, w: 7, d: 6, seed: 5 },
  { kind: "icecream", x: -48.5, z: 7, ry: S, w: 7, d: 6, seed: 6 },
  { kind: "toys", x: -57, z: 7.5, ry: S, w: 8, d: 7, seed: 7 },
  { kind: "maple", x: -86, z: 7.5, ry: S, w: 8, d: 7, seed: 8 },
  // Town hall closes the end of Main Street.
  { kind: "townhall", x: -96, z: 0, ry: E, w: 12, d: 8, seed: 9 },
  // Town square: bandstand and market stalls.
  { kind: "bandstand", x: -74, z: 0, ry: E, w: 7, d: 7, seed: 10 },
  { kind: "stall", x: -69, z: -6, ry: S + 0.6, w: 2.6, d: 1.8, seed: 11 },
  { kind: "stall", x: -79, z: -6, ry: S - 0.6, w: 2.6, d: 1.8, seed: 12 },
  { kind: "stall", x: -69, z: 6, ry: N - 0.6, w: 2.6, d: 1.8, seed: 13 },
  { kind: "stall", x: -79, z: 6, ry: N + 0.6, w: 2.6, d: 1.8, seed: 14 },
  // Cottage Lane.
  { kind: "cottage", x: -53, z: -20, ry: E, w: 7, d: 6, seed: 20 },
  { kind: "cottage", x: -53, z: -33, ry: E, w: 7, d: 6, seed: 21 },
  { kind: "cottage", x: -53, z: -46, ry: E, w: 7, d: 6, seed: 22 },
  { kind: "cottage", x: -39, z: -24, ry: W, w: 7, d: 6, seed: 23 },
  { kind: "cottage", x: -39, z: -37, ry: W, w: 7, d: 6, seed: 24 },
  { kind: "windmill", x: -46, z: -69, ry: N, w: 7, d: 7, seed: 25 },
  // Lake shore.
  { kind: "lighthouse", x: -61, z: 29, ry: Math.atan2(-38 - -61, 36 - 29), w: 5, d: 5, seed: 30 },
  // East quarter.
  { kind: "watermill", x: 41, z: 7, ry: W, w: 7, d: 7, seed: 40 },
  { kind: "greenhouse", x: 56, z: -1, ry: S, w: 9, d: 6, seed: 41 },
  { kind: "observatory", x: 76, z: 0, ry: S, w: 10, d: 10, seed: 42 },
  { kind: "cottage", x: 66, z: -1, ry: S, w: 6, d: 6, seed: 43 },
  { kind: "cottage", x: 52, z: -15.5, ry: N, w: 7, d: 7, seed: 44 },
  { kind: "cottage", x: 82, z: -15.5, ry: N, w: 7, d: 7, seed: 45 },
  { kind: "lookout", x: 68, z: -22, ry: N, w: 5, d: 5, seed: 46 },
  // South of the river.
  { kind: "ferris", x: 27, z: 66, ry: W, w: 14, d: 5, seed: 50 },
  { kind: "stall", x: 15, z: 58, ry: W, w: 2.6, d: 1.8, seed: 51 },
  { kind: "stall", x: 15, z: 73, ry: W, w: 2.6, d: 1.8, seed: 52 },
  { kind: "ranger", x: -8, z: 80, ry: E, w: 8, d: 7, seed: 53 },
  { kind: "tent", x: -20, z: 56, ry: 0.4, w: 3, d: 3, seed: 54 },
  { kind: "tent", x: -25, z: 63, ry: 1.4, w: 3, d: 3, seed: 55 },
  { kind: "tent", x: -18, z: 69, ry: 2.6, w: 3, d: 3, seed: 56 },
];

/** Open areas kept clear of trees and long grass (paved, frozen or trampled). */
export const TOWN_AREAS: { kind: "square" | "rink" | "camp" | "fair"; x: number; z: number; r: number; clear?: number }[] = [
  { kind: "square", x: -74, z: 0, r: 10 },
  { kind: "rink", x: -24, z: -52, r: 7, clear: 16 },
  { kind: "camp", x: -19, z: 62, r: 9 },
  { kind: "fair", x: 20, z: 66, r: 10 },
];

/** The second timber bridge, over the river to the east quarter. */
export const BRIDGE_EAST = { x: 35.8, z: -8, ry: Math.PI / 2, halfWidth: 2, halfLength: 6.2 } as const;

/** Landmarks you can visit (daily quests) or use (action button). */
export const TOWN_PLACES = {
  bakery: { x: -39, z: -2.5 },
  post: { x: -53, z: -2.5 },
  library: { x: -86, z: -2.5 },
  icecream: { x: -48.5, z: 2.5 },
  townHall: { x: -90, z: 0 },
  bandstand: { x: -74, z: 0 },
  windmill: { x: -46, z: -63 },
  rink: { x: -24, z: -52 },
  lighthouse: { x: -61, z: 29 },
  watermill: { x: 41, z: 0 },
  lookout: { x: 68, z: -22 },
  observatory: { x: 76, z: -7 },
  ferris: { x: 21, z: 66 },
  ranger: { x: -3, z: 80 },
  camp: { x: -19, z: 62 },
  maple: { x: -86, z: 2.5 },
  greenhouse: { x: 56, z: -5 },
} as const;

/** Collision circles that cover a building's footprint. */
export function buildingColliders(b: TownBuilding): { x: number; z: number; r: number }[] {
  const round: BuildingKind[] = ["bandstand", "observatory", "lighthouse", "windmill", "tent"];
  if (round.includes(b.kind)) return [{ x: b.x, z: b.z, r: b.kind === "tent" ? 1.5 : b.w / 2 }];
  if (b.kind === "ferris") return [{ x: b.x, z: b.z, r: 3.2 }];
  if (b.kind === "lookout") {
    // Four stilt legs (you can walk between them? no: keep it simple and solid).
    return [{ x: b.x, z: b.z, r: 2.8 }];
  }
  const out: { x: number; z: number; r: number }[] = [];
  const c = Math.cos(b.ry), s = Math.sin(b.ry);
  const r = Math.min(b.w, b.d) / 2;
  const long = Math.max(b.w, b.d), alongX = b.w >= b.d;
  const n = Math.max(1, Math.ceil(long / (r * 1.4)));
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0 : -long / 2 + r + ((long - 2 * r) * i) / (n - 1);
    const lx = alongX ? t : 0, lz = alongX ? 0 : t;
    out.push({ x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c, r: r + 0.25 });
  }
  if (b.kind === "watermill") {
    // The wheel sits on the river side (local +z is the front, facing the water).
    out.push({ x: b.x + s * 4.4, z: b.z + c * 4.4, r: 1.6 });
  }
  return out;
}

/** True when (x, z) is within `pad` metres of a town building or inside an open town area. */
export function townClear(x: number, z: number, pad: number): boolean {
  for (const b of TOWN_BUILDINGS) {
    if (Math.hypot(x - b.x, z - b.z) < Math.hypot(b.w, b.d) / 2 + pad) return true;
  }
  for (const a of TOWN_AREAS) if (Math.hypot(x - a.x, z - a.z) < (a.clear ?? a.r) + pad) return true;
  return false;
}
