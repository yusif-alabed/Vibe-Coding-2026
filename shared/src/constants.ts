/** Tuning values shared by client and server. Server-side checks always use these, never client-sent values. */

export const HUB = {
  /** Players are kept inside this circle (world units ≈ metres). */
  radius: 62,
  /** Max walking speed in units/second. */
  maxSpeed: 9,
  /** Allowance for network jitter when validating movement. */
  speedTolerance: 1.35,
  /** How often the server broadcasts positions (Hz). */
  tickRate: 12,
  capacity: 50,
} as const;

/** Places in the village. Used for scenery on the client and collision/validation on the server. */
export const HUB_PLACES = {
  plaza: { x: 0, z: 0, r: 0 },
  lodge: { x: -20, z: -16, r: 7.5 },
  outfitter: { x: 19, z: -15, r: 6 },
  arcade: { x: 26, z: 14, r: 5.5 },
  dock: { x: -26, z: 22, r: 0 },
  lake: { x: -38, z: 36, r: 15 },
  trailhead: { x: 0, z: -40, r: 0 },
  hotSpring: { x: 30, z: -34, r: 0 },
} as const;

/** Solid things you can't walk through (circles). */
export const HUB_COLLIDERS: { x: number; z: number; r: number }[] = [
  { x: HUB_PLACES.lodge.x, z: HUB_PLACES.lodge.z, r: HUB_PLACES.lodge.r },
  { x: HUB_PLACES.outfitter.x, z: HUB_PLACES.outfitter.z, r: HUB_PLACES.outfitter.r },
  { x: HUB_PLACES.arcade.x, z: HUB_PLACES.arcade.z, r: HUB_PLACES.arcade.r },
  { x: 0, z: 0, r: 7.15 }, // full plaza fountain basin, not just the pedestal
];

/** Standing inside this radius of the trailhead portal offers the toboggan race. */
export const PORTAL_RADIUS = 4;

export const CHAT = {
  maxLength: 120,
  /** Token bucket: burst of 5 messages, then one every 1.5 s. */
  burst: 5,
  refillMs: 1500,
  /** Identical message repeated within this window is treated as spam. */
  duplicateWindowMs: 8000,
} as const;

export const ECONOMY = {
  startingCoins: 100,
} as const;

export const RACE = {
  size: 4,
  queueWaitMs: 8000,
  countdownMs: 3000,
  tickRate: 20,
  timeLimitS: 70,
} as const;

export const FUR_COLORS = ["#8a5a3b", "#a8703f", "#6b4428", "#c48a52", "#4e3324", "#b5835a"] as const;
export const NAME_MAX = 16;
