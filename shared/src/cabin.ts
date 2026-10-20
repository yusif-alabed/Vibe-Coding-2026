/**
 * Cabin decorating: every player has a cosy cabin with a 10 × 8 floor grid.
 * Furniture is bought with coins and placed on the grid. Rugs lie on the floor layer,
 * so chairs and tables can stand on them; everything else may not overlap.
 */

export interface FurnitureDef {
  id: string;
  name: string;
  price: number;
  /** Footprint in grid cells before rotation. */
  w: number;
  d: number;
  /** 0 = floor covering (rugs), 1 = furniture. */
  layer: 0 | 1;
  icon: string;
}

export const FURNITURE: FurnitureDef[] = [
  { id: "rug_round", name: "Woven Rug", price: 30, w: 2, d: 2, layer: 0, icon: "🟤" },
  { id: "rug_plaid", name: "Plaid Runner", price: 45, w: 3, d: 2, layer: 0, icon: "🟥" },
  { id: "armchair", name: "Cozy Armchair", price: 40, w: 1, d: 1, layer: 1, icon: "🪑" },
  { id: "sofa", name: "Log Sofa", price: 90, w: 2, d: 1, layer: 1, icon: "🛋️" },
  { id: "coffee_table", name: "Stump Table", price: 30, w: 1, d: 1, layer: 1, icon: "🪵" },
  { id: "dining_table", name: "Cabin Table", price: 70, w: 2, d: 1, layer: 1, icon: "🍽️" },
  { id: "chair", name: "Wooden Chair", price: 20, w: 1, d: 1, layer: 1, icon: "🪑" },
  { id: "bookshelf", name: "Bookshelf", price: 80, w: 2, d: 1, layer: 1, icon: "📚" },
  { id: "bed", name: "Quilted Bed", price: 120, w: 2, d: 2, layer: 1, icon: "🛏️" },
  { id: "plant", name: "Potted Fern", price: 25, w: 1, d: 1, layer: 1, icon: "🪴" },
  { id: "lamp", name: "Lantern Lamp", price: 45, w: 1, d: 1, layer: 1, icon: "🏮" },
  { id: "plush", name: "Beaver Plush", price: 35, w: 1, d: 1, layer: 1, icon: "🧸" },
  { id: "sled", name: "Toy Toboggan", price: 60, w: 2, d: 1, layer: 1, icon: "🛷" },
  { id: "canoe", name: "Canoe Display", price: 110, w: 3, d: 1, layer: 1, icon: "🛶" },
  { id: "telescope", name: "Stargazing Telescope", price: 95, w: 1, d: 1, layer: 1, icon: "🔭" },
];
export const FURNITURE_BY_ID: Record<string, FurnitureDef> = Object.fromEntries(FURNITURE.map((f) => [f.id, f]));

export const CABIN_W = 10;
export const CABIN_D = 8;
export const CABIN_MAX_ITEMS = 40;
/** Cells taken by the stone fireplace on the back wall (furniture can't go there). */
export const FIREPLACE_CELLS: [number, number][] = [[4, 0], [5, 0]];

export interface PlacedItem {
  id: string;
  /** Grid cell of the footprint's corner nearest the back-left. */
  x: number;
  z: number;
  /** Quarter turns, 0–3. */
  rot: number;
}

export const STARTER_FURNITURE: Record<string, number> = { rug_round: 1, armchair: 1, coffee_table: 1 };
export const STARTER_LAYOUT: PlacedItem[] = [
  { id: "rug_round", x: 4, z: 3, rot: 0 },
  { id: "armchair", x: 3, z: 3, rot: 1 },
  { id: "coffee_table", x: 4, z: 3, rot: 0 },
];

export function footprint(def: FurnitureDef, rot: number): [number, number] {
  return rot % 2 === 0 ? [def.w, def.d] : [def.d, def.w];
}

export type LayoutResult = { ok: true; items: PlacedItem[] } | { ok: false; reason: string };

/** Checks a layout against the grid, the fireplace, overlaps and how many of each item you own. */
export function validateLayout(input: unknown, counts: Record<string, number>): LayoutResult {
  if (!Array.isArray(input)) return { ok: false, reason: "That layout couldn't be read." };
  if (input.length > CABIN_MAX_ITEMS) return { ok: false, reason: `A cabin holds up to ${CABIN_MAX_ITEMS} things.` };
  const used: Record<string, number> = {};
  const occ = [new Set<string>(), new Set<string>()];
  for (const [fx, fz] of FIREPLACE_CELLS) occ[1].add(`${fx},${fz}`);
  const items: PlacedItem[] = [];
  for (const raw of input) {
    const it = raw as Partial<PlacedItem>;
    const def = typeof it?.id === "string" ? FURNITURE_BY_ID[it.id] : undefined;
    if (!def) return { ok: false, reason: "Unknown furniture." };
    const x = Number(it.x), z = Number(it.z), rot = Number(it.rot);
    if (![x, z, rot].every(Number.isInteger) || rot < 0 || rot > 3) return { ok: false, reason: "Furniture must sit on the grid." };
    const [w, d] = footprint(def, rot);
    if (x < 0 || z < 0 || x + w > CABIN_W || z + d > CABIN_D) return { ok: false, reason: "That doesn't fit inside the cabin." };
    used[def.id] = (used[def.id] ?? 0) + 1;
    if (used[def.id] > (counts[def.id] ?? 0)) return { ok: false, reason: `You only have ${counts[def.id] ?? 0} × ${def.name}.` };
    for (let i = x; i < x + w; i++) {
      for (let j = z; j < z + d; j++) {
        const k = `${i},${j}`;
        if (occ[def.layer].has(k)) return { ok: false, reason: "Two things can't share a spot." };
        occ[def.layer].add(k);
      }
    }
    items.push({ id: def.id, x, z, rot });
  }
  return { ok: true, items };
}

export type FurniturePurchase = { ok: true; coins: number; counts: Record<string, number> } | { ok: false; reason: "unknown_item" | "not_enough_coins" | "too_many" };

/** Furniture can be bought more than once (up to 6 of each). */
export function buyFurniture(coins: number, counts: Record<string, number>, id: string): FurniturePurchase {
  const def = FURNITURE_BY_ID[id];
  if (!def) return { ok: false, reason: "unknown_item" };
  if ((counts[id] ?? 0) >= 6) return { ok: false, reason: "too_many" };
  if (coins < def.price) return { ok: false, reason: "not_enough_coins" };
  return { ok: true, coins: coins - def.price, counts: { ...counts, [id]: (counts[id] ?? 0) + 1 } };
}
