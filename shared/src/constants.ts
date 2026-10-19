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
  { x: HUB_PLACES.hotSpring.x, z: HUB_PLACES.hotSpring.z, r: 4.4 },
  { x: -12, z: -9, r: 1.65 }, // lodge campfire
  { x: 4, z: -12, r: 0.75 }, // village sign
  { x: HUB_PLACES.outfitter.x - 6.5, z: HUB_PLACES.outfitter.z + 2, r: 1.7 }, // canoe rack
];

// Plaza furniture is generated from this same layout on the client. Keeping its
// collision circles here makes every connected player receive identical movement rules.
for (let i = 0; i < 6; i++) {
  const a = (i / 6) * Math.PI * 2 + 0.5;
  HUB_COLLIDERS.push(
    { x: Math.cos(a) * 11.5, z: Math.sin(a) * 11.5, r: 0.58 }, // lantern
    { x: Math.cos(a + 0.5) * 8.6, z: Math.sin(a + 0.5) * 8.6, r: 1.45 }, // bench
  );
}

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
