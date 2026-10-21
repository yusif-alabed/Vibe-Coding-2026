/** Cosmetic catalog. Cosmetics are purely visual and never change gameplay. */

export type Slot = "hat" | "scarf" | "backpack" | "trail" | "tail" | "eyes" | "pet" | "dye";
/** Slots you can wear something in (dyes are applied, not worn). */
export const WEAR_SLOTS = ["hat", "scarf", "backpack", "trail", "tail", "eyes", "pet"] as const;
export type WearSlot = (typeof WEAR_SLOTS)[number];

export interface CosmeticItem {
  id: string;
  name: string;
  slot: Slot;
  price: number;
  color: string;
  /** Model variant the client draws for this item. */
  shape: string;
  /** Earned (quests, journal pages), never sold in the shop. */
  reward?: boolean;
  /** Only sold during this season. */
  season?: "spring" | "summer" | "autumn" | "winter";
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
  { id: "hat_flowers", name: "Spring Flower Crown", slot: "hat", price: 90, color: "#ff7eb3", shape: "flowers", season: "spring" },
  { id: "hat_sun", name: "Summer Sun Hat", slot: "hat", price: 110, color: "#e9cf8a", shape: "sunhat", season: "summer" },
  { id: "hat_pumpkin", name: "Pumpkin Hat", slot: "hat", price: 140, color: "#e7792c", shape: "pumpkin", season: "autumn" },
  { id: "hat_holiday", name: "Holiday Pom Hat", slot: "hat", price: 160, color: "#d33b2c", shape: "holiday", season: "winter" },
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
  // More seasonal extras.
  { id: "scarf_blossom", name: "Cherry Blossom Scarf", slot: "scarf", price: 80, color: "#ffc4dc", shape: "scarf", season: "spring" },
  { id: "pack_beach", name: "Beach Ball", slot: "backpack", price: 90, color: "#4fb6ff", shape: "beachball", season: "summer" },
  { id: "trail_leaves", name: "Falling Leaves Trail", slot: "trail", price: 140, color: "#e2722b", shape: "leaf", season: "autumn" },
  { id: "scarf_snowflake", name: "Snowflake Knit Scarf", slot: "scarf", price: 100, color: "#2f6fb0", shape: "candy", season: "winter" },
  // Tails.
  { id: "tail_fluffy", name: "Fluffy Tail", slot: "tail", price: 60, color: "#8a5a3b", shape: "fluffy" },
  { id: "tail_striped", name: "Striped Tail", slot: "tail", price: 70, color: "#5b3a24", shape: "striped" },
  { id: "tail_heart", name: "Heart-tip Tail", slot: "tail", price: 90, color: "#ff6fa5", shape: "heart" },
  { id: "tail_star", name: "Starry Tail", slot: "tail", price: 150, color: "#ffd14f", shape: "star" },
  // Eyes.
  { id: "eyes_round", name: "Big Round Eyes", slot: "eyes", price: 50, color: "#1d110b", shape: "round" },
  { id: "eyes_sleepy", name: "Sleepy Eyes", slot: "eyes", price: 40, color: "#1d110b", shape: "sleepy" },
  { id: "eyes_lashes", name: "Fluttery Lashes", slot: "eyes", price: 60, color: "#1d110b", shape: "lashes" },
  { id: "eyes_sparkle", name: "Sparkly Eyes", slot: "eyes", price: 80, color: "#4fb6ff", shape: "sparkle" },
  { id: "eyes_glasses", name: "Round Glasses", slot: "eyes", price: 70, color: "#3b251b", shape: "glasses" },
  // Pets that follow you around.
  { id: "pet_chipmunk", name: "Chipmunk", slot: "pet", price: 150, color: "#b5835a", shape: "chipmunk" },
  { id: "pet_bunny", name: "Snowshoe Bunny", slot: "pet", price: 180, color: "#f4f1ea", shape: "bunny" },
  { id: "pet_owl", name: "Little Owl", slot: "pet", price: 220, color: "#8a6a4a", shape: "owl" },
  { id: "pet_moose", name: "Moose Calf", slot: "pet", price: 320, color: "#6b4428", shape: "moose" },
  { id: "pet_fox", name: "Fox Kit", slot: "pet", price: 0, color: "#e7792c", shape: "fox", reward: true },
  { id: "pet_duckling", name: "Duckling", slot: "pet", price: 0, color: "#ffd93b", shape: "duck", reward: true },
  // Dyes: buy a colour once, then dye any hat, scarf or pack with it.
  { id: "dye_teal", name: "Glacier Teal Dye", slot: "dye", price: 30, color: "#2fb8b0", shape: "dye" },
  { id: "dye_pink", name: "Fireweed Pink Dye", slot: "dye", price: 30, color: "#ff6fa5", shape: "dye" },
  { id: "dye_gold", name: "Larch Gold Dye", slot: "dye", price: 30, color: "#f2c230", shape: "dye" },
  { id: "dye_violet", name: "Lupine Violet Dye", slot: "dye", price: 30, color: "#8a5cf0", shape: "dye" },
  { id: "dye_forest", name: "Spruce Green Dye", slot: "dye", price: 30, color: "#2f7d4f", shape: "dye" },
  { id: "dye_navy", name: "Night Sky Dye", slot: "dye", price: 30, color: "#2b3f7a", shape: "dye" },
  { id: "dye_snow", name: "Snow White Dye", slot: "dye", price: 30, color: "#f4f6f8", shape: "dye" },
  { id: "dye_coal", name: "Charcoal Dye", slot: "dye", price: 30, color: "#3a3a42", shape: "dye" },
  // Rewards from townsfolk and the journal.
  { id: "hat_baker", name: "Baker's Hat", slot: "hat", price: 0, color: "#fffaf0", shape: "baker", reward: true },
  { id: "scarf_mayor", name: "Mayor's Sash", slot: "scarf", price: 0, color: "#c8473a", shape: "sash", reward: true },
  { id: "hat_fisher", name: "Angler's Bucket Hat", slot: "hat", price: 0, color: "#7a8a5a", shape: "bucket", reward: true },
  { id: "hat_scholar", name: "Scholar's Cap", slot: "hat", price: 0, color: "#2b2b38", shape: "scholar", reward: true },
  { id: "pack_map", name: "Explorer's Map Roll", slot: "backpack", price: 0, color: "#e9d7a8", shape: "maproll", reward: true },
  { id: "trail_butterfly", name: "Butterfly Trail", slot: "trail", price: 0, color: "#ffb03b", shape: "butterfly", reward: true },
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
  tail?: string | null;
  eyes?: string | null;
  pet?: string | null;
  /** Dye ids applied to the hat, scarf and backpack. */
  dyes?: { hat?: string; scarf?: string; backpack?: string };
}

export const DEFAULT_LOOK: Look = {
  fur: "#8a5a3b",
  hat: "hat_toque_red",
  scarf: null,
  backpack: null,
  trail: null,
};
