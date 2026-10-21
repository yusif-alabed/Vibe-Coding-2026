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
  | "lighthouse" | "bandstand" | "stall" | "ferris" | "tent"
  | "clubhouse" | "station" | "gondola" | "dyeshop" | "wordlodge"
  | "sports" | "club" | "casino" | "gym" | "fort" | "estategate";

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
  [-13, 66, -21, 73], // to the golf clubhouse
  [68, -8, 86, 26], // to the train station
  [30, -34, 48, -46], // past the hot springs to the balloon meadow
  [10, -40, 16, -48], // to the summit gondola
  [52, -8, 56, 6], // to the community garden
  [47, -8, 49, 40], // Downtown Avenue
  [49, 40, 53, 44], // into the Downtown plaza
  [42, 30, 48, 30], // to the Board Game Estate gate
  [52, 54, 40, 70], // Downtown to the fairground
  [40, 70, 24, 70],
  [-86, -8.5, -86, -26], // Library Lane, north from the library to the Word Lodge
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
  // Golf clubhouse on the flat meadow past the campground, facing the path.
  { kind: "clubhouse", x: -21, z: 80, ry: S, w: 11, d: 7, seed: 60 },
  // Valley railway station on the east edge (the line runs round the valley just outside town).
  { kind: "station", x: 90, z: 31, ry: Math.atan2(-90, -31), w: 10, d: 5, seed: 61 },
  // Summit gondola base station on the snowy hill beside the trailhead.
  { kind: "gondola", x: 18, z: -53, ry: Math.atan2(-18, 53), w: 7, d: 6, seed: 62 },
  // A little dye shop on Main Street, next to the flower shop.
  { kind: "dyeshop", x: -66, z: 7.5, ry: S, w: 6, d: 6, seed: 63 },
  // The Word Lodge, up Library Lane behind the library. Its front faces back down the lane.
  { kind: "wordlodge", x: -86, z: -30, ry: N, w: 12, d: 10, seed: 64 },
  // Downtown: a fun district across the east road, round a plaza at (58, 48).
  { kind: "sports", x: 74, z: 48, ry: W, w: 12, d: 10, seed: 70 },
  { kind: "club", x: 40, z: 46, ry: E, w: 11, d: 9, seed: 71 },
  { kind: "casino", x: 58, z: 32, ry: N, w: 11, d: 8, seed: 72 },
  { kind: "gym", x: 58, z: 64, ry: S, w: 9, d: 8, seed: 73 },
  { kind: "fort", x: 70, z: 33, ry: Math.atan2(-12, 15), w: 8, d: 8, seed: 74 },
  // The carriage gate to the Board Game Estate (a separate zone).
  { kind: "estategate", x: 41, z: 30, ry: E, w: 6, d: 2, seed: 75 },
];

/** Open areas kept clear of trees and long grass (paved, frozen or trampled). */
export const TOWN_AREAS: { kind: "square" | "rink" | "camp" | "fair" | "garden" | "balloons" | "golf" | "downtown" | "dance" | "courts" | "spleef"; x: number; z: number; r: number; clear?: number }[] = [
  { kind: "downtown", x: 58, z: 48, r: 7.5 },
  { kind: "dance", x: 48, z: 46, r: 3.6 },
  { kind: "courts", x: 68, z: 62, r: 5 },
  { kind: "spleef", x: 45, z: 62, r: 5 },
  { kind: "garden", x: 56, z: 11, r: 6.5 },
  { kind: "balloons", x: 52, z: -52, r: 9 },
  { kind: "golf", x: -21, z: 90, r: 5 },
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
  clubhouse: { x: -21, z: 74 },
  station: { x: 86, z: 27 },
  balloons: { x: 52, z: -52 },
  gondola: { x: 15.5, z: -48.5 },
  garden: { x: 56, z: 11 },
  dyeshop: { x: -66, z: 3 },
  cottageLane: { x: -43.5, z: -12 },
  wordlodge: { x: -86, z: -23.5 },
  downtown: { x: 58, z: 48 },
  club: { x: 47.5, z: 46 },
  casino: { x: 58, z: 38.5 },
  sports: { x: 66.5, z: 48 },
  gym: { x: 58, z: 57.5 },
  fort: { x: 65.5, z: 38.5 },
  spleef: { x: 50.5, z: 58.5 },
  estategate: { x: 45, z: 30 },
} as const;

/** Collision circles that cover a building's footprint. */
export function buildingColliders(b: TownBuilding): { x: number; z: number; r: number }[] {
  const round: BuildingKind[] = ["bandstand", "observatory", "lighthouse", "windmill", "tent"];
  if (b.kind === "station") {
    // Just the station building (the platform and the line itself are walkable / outside town).
    const c = Math.cos(b.ry), s = Math.sin(b.ry);
    return [-2.5, 2.5].map((lx) => ({ x: b.x + lx * c, z: b.z - lx * s, r: 2.7 }));
  }
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

/**
 * The valley railway: a little steam train circling the valley just outside town on a fixed
 * timetable (everyone sees the same train), stopping by the station on the east edge.
 */
export const TRAIN = { r: 102.5, speed: 10, cars: 4, carLen: 3.6, stationAngle: Math.atan2(31, 90), trains: 2 } as const;
/** Seconds for one trip round the valley. */
export const TRAIN_LOOP_S = (2 * Math.PI * TRAIN.r) / TRAIN.speed;
/** Position of train `which` around the loop (radians, x = cos·r, z = sin·r) at a time in ms. */
export function trainAngle(now = Date.now(), which = 0): number {
  return (((now / 1000) * TRAIN.speed) / TRAIN.r + (which * Math.PI * 2) / TRAIN.trains) % (Math.PI * 2);
}

/** The summit gondola: base station in town, top station high on the mountain. */
export const GONDOLA = { base: { x: 18, z: -53 }, top: { x: 52, z: -168, y: 82 }, cabins: 6, speed: 0.025 } as const;
