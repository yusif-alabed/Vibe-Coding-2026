/** Cosmetic catalog. Cosmetics are purely visual and never change gameplay. */

export type Slot = "hat" | "scarf" | "backpack" | "trail";

export interface CosmeticItem {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  color: string;
  /** Model variant the client draws for this item. */
  shape: string;
}

export const CATALOG: CosmeticItem[] = [
  { id: "hat_toque_red", name: "Red Toque", slot: "hat", price: 0, color: "#e2483d", shape: "toque" },
  { id: "hat_toque_teal", name: "Glacier Toque", slot: "hat", price: 60, color: "#21b8b0", shape: "toque" },
  { id: "hat_ranger", name: "Park Ranger Hat", slot: "hat", price: 120, color: "#8a6a3a", shape: "ranger" },
  { id: "hat_antlers", name: "Moose Antlers", slot: "hat", price: 200, color: "#d9b47a", shape: "antlers" },
  { id: "hat_crown", name: "Pinecone Crown", slot: "hat", price: 350, color: "#f2c230", shape: "crown" },
  { id: "scarf_plaid", name: "Lumber Plaid Scarf", slot: "scarf", price: 0, color: "#c8323a", shape: "scarf" },
  { id: "scarf_sky", name: "Sky Scarf", slot: "scarf", price: 50, color: "#5aa9e6", shape: "scarf" },
  { id: "scarf_sunset", name: "Sunset Scarf", slot: "scarf", price: 90, color: "#ff8a3d", shape: "scarf" },
  { id: "pack_hiker", name: "Hiker Pack", slot: "backpack", price: 80, color: "#3f7d4e", shape: "pack" },
  { id: "pack_canoe", name: "Mini Canoe", slot: "backpack", price: 220, color: "#d4572a", shape: "canoe" },
  { id: "trail_snow", name: "Snowflake Trail", slot: "trail", price: 150, color: "#ffffff", shape: "snow" },
  { id: "trail_leaf", name: "Maple Leaf Trail", slot: "trail", price: 150, color: "#e8582a", shape: "leaf" },
  // Seasonal and fun extras.
  { id: "hat_flowers", name: "Spring Flower Crown", slot: "hat", price: 90, color: "#ff7eb3", shape: "flowers" },
  { id: "hat_sun", name: "Summer Sun Hat", slot: "hat", price: 110, color: "#e9cf8a", shape: "sunhat" },
  { id: "hat_pumpkin", name: "Pumpkin Hat", slot: "hat", price: 140, color: "#e7792c", shape: "pumpkin" },
  { id: "hat_holiday", name: "Holiday Pom Hat", slot: "hat", price: 160, color: "#d33b2c", shape: "holiday" },
  { id: "hat_earmuffs", name: "Cozy Earmuffs", slot: "hat", price: 80, color: "#a77bff", shape: "earmuffs" },
  { id: "hat_propeller", name: "Propeller Beanie", slot: "hat", price: 180, color: "#3a8fd6", shape: "propeller" },
  { id: "hat_party", name: "Party Hat", slot: "hat", price: 70, color: "#ffd166", shape: "party" },
  { id: "scarf_mint", name: "Spring Mint Scarf", slot: "scarf", price: 60, color: "#7fd6b5", shape: "scarf" },
  { id: "scarf_rust", name: "Autumn Rust Scarf", slot: "scarf", price: 70, color: "#b5562a", shape: "scarf" },
  { id: "scarf_candy", name: "Candy Stripe Scarf", slot: "scarf", price: 120, color: "#e2483d", shape: "candy" },
  { id: "pack_basket", name: "Picnic Basket", slot: "backpack", price: 120, color: "#c9a062", shape: "basket" },
  { id: "pack_firewood", name: "Firewood Bundle", slot: "backpack", price: 100, color: "#7a4b2c", shape: "firewood" },
  { id: "pack_guitar", name: "Travel Guitar", slot: "backpack", price: 240, color: "#c47a35", shape: "guitar" },
  { id: "pack_board", name: "Snowboard", slot: "backpack", price: 260, color: "#7ff3f0", shape: "board" },
  { id: "trail_bubbles", name: "Bubble Trail", slot: "trail", price: 140, color: "#a8e6ff", shape: "bubbles" },
  { id: "trail_hearts", name: "Heart Trail", slot: "trail", price: 180, color: "#ff6fa5", shape: "hearts" },
  { id: "trail_sparkle", name: "Golden Sparkle Trail", slot: "trail", price: 300, color: "#ffd14f", shape: "sparkle" },
];

export const CATALOG_BY_ID: Record<string, CosmeticItem> = Object.fromEntries(CATALOG.map((i) => [i.id, i]));

/** Items every new beaver owns. */
export const STARTER_ITEMS = CATALOG.filter((i) => i.price === 0).map((i) => i.id);

/** What a beaver looks like. Every equipped id must be an owned item in the right slot (server checks). */
export interface Look {
  fur: string;
  hat: string | null;
  scarf: string | null;
  backpack: string | null;
  trail: string | null;
}

export const DEFAULT_LOOK: Look = {
  fur: "#8a5a3b",
  hat: "hat_toque_red",
  scarf: null,
  backpack: null,
  trail: null,
};
