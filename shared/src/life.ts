import { HUB_PLACES, riverDistance, TOWN_PLACES } from "./constants";
import { FURNITURE_BY_ID } from "./cabin";
import { CATALOG_BY_ID } from "./cosmetics";
import { isNight, seasonAt, weatherAt, type Season } from "./world";

/**
 * Village life: fishing, bug spotting, Banff facts, the collection journal, gardening, your bag of
 * items, and the townsfolk's quest chains. Pure rules shared by the game server and solo mode.
 */

// ------------------------------------------------------------------ Items

export interface ItemDef { id: string; name: string; icon: string; price: number }

export interface FishDef extends ItemDef {
  where: "lake" | "river" | "both";
  weight: number;
  night?: boolean;
  day?: boolean;
  seasons?: Season[];
  rainOnly?: boolean;
  junk?: boolean;
  /** Typical length in cm (the catch varies around it). */
  size: number;
}

export const FISH: FishDef[] = [
  { id: "trout", name: "Rainbow Trout", icon: "🐟", price: 12, where: "both", weight: 30, size: 38 },
  { id: "brook", name: "Brook Trout", icon: "🐟", price: 10, where: "river", weight: 26, size: 30 },
  { id: "whitefish", name: "Mountain Whitefish", icon: "🐟", price: 10, where: "lake", weight: 22, size: 34 },
  { id: "bulltrout", name: "Bull Trout", icon: "🐠", price: 25, where: "river", weight: 9, size: 55 },
  { id: "laketrout", name: "Lake Trout", icon: "🐠", price: 22, where: "lake", weight: 11, night: true, size: 60 },
  { id: "cutthroat", name: "Cutthroat Trout", icon: "🐠", price: 20, where: "river", weight: 11, seasons: ["spring", "summer"], size: 40 },
  { id: "grayling", name: "Arctic Grayling", icon: "🐠", price: 26, where: "lake", weight: 8, seasons: ["autumn", "winter"], size: 36 },
  { id: "pike", name: "Northern Pike", icon: "🦈", price: 30, where: "lake", weight: 6, day: true, size: 75 },
  { id: "burbot", name: "Burbot", icon: "🐡", price: 40, where: "lake", weight: 4, night: true, size: 50 },
  { id: "goldtrout", name: "Golden Trout", icon: "✨", price: 80, where: "both", weight: 3, rainOnly: true, size: 32 },
  { id: "boot", name: "Old Boot", icon: "🥾", price: 1, where: "both", weight: 12, junk: true, size: 28 },
  { id: "bottle", name: "Message in a Bottle", icon: "🍾", price: 5, where: "lake", weight: 4, junk: true, size: 22 },
];
export const FISH_BY_ID: Record<string, FishDef> = Object.fromEntries(FISH.map((f) => [f.id, f]));

export interface BugDef { id: string; name: string; icon: string; seasons?: Season[]; night?: boolean; day?: boolean }
export const BUGS: BugDef[] = [
  { id: "monarch", name: "Monarch Butterfly", icon: "🦋", seasons: ["summer", "autumn"], day: true },
  { id: "swallowtail", name: "Western Swallowtail", icon: "🦋", seasons: ["spring", "summer"], day: true },
  { id: "blue", name: "Silvery Blue", icon: "🦋", seasons: ["spring", "summer"], day: true },
  { id: "painted", name: "Painted Lady", icon: "🦋", day: true },
  { id: "cloak", name: "Mourning Cloak", icon: "🦋", seasons: ["autumn", "winter", "spring"], day: true },
  { id: "firefly", name: "Firefly", icon: "✨", night: true },
  { id: "dragonfly", name: "Dragonfly", icon: "🪰", seasons: ["summer", "autumn", "spring"], day: true },
  { id: "ladybug", name: "Ladybug", icon: "🐞", day: true },
];
export const BUG_BY_ID: Record<string, BugDef> = Object.fromEntries(BUGS.map((b) => [b.id, b]));

export const SEEDS = {
  lupine: { name: "Lupine", icon: "💜", minutes: 2, yields: "lupine", count: 2 },
  sunflower: { name: "Sunflower", icon: "🌻", minutes: 3, yields: "sunflower", count: 2 },
  carrot: { name: "Carrot", icon: "🥕", minutes: 3, yields: "carrot", count: 3 },
  blueberry: { name: "Blueberry bush", icon: "🫐", minutes: 4, yields: "berries", count: 3 },
  pumpkin: { name: "Pumpkin", icon: "🎃", minutes: 6, yields: "pumpkin", count: 1 },
} as const;
export type SeedId = keyof typeof SEEDS;
export const SEED_PRICE = 5;
export const GARDEN_PLOTS = 4;

export const ITEMS: Record<string, ItemDef> = {
  ...Object.fromEntries(FISH.map((f) => [f.id, f])),
  lupine: { id: "lupine", name: "Lupine Bouquet", icon: "💐", price: 6 },
  sunflower: { id: "sunflower", name: "Sunflower", icon: "🌻", price: 8 },
  carrot: { id: "carrot", name: "Carrot", icon: "🥕", price: 4 },
  berries: { id: "berries", name: "Blueberries", icon: "🫐", price: 5 },
  pumpkin: { id: "pumpkin", name: "Pumpkin", icon: "🎃", price: 22 },
  croissant: { id: "croissant", name: "Maple Croissant", icon: "🥐", price: 4 },
  pinecone: { id: "pinecone", name: "Golden Pinecone", icon: "🌰", price: 3 },
};

export const BANFF_FACTS = [
  "Banff is Canada's oldest national park, founded in 1885.",
  "Lake Louise's turquoise colour comes from glacial 'rock flour' floating in the water.",
  "The Banff Upper Hot Springs bubble up at about 38 °C.",
  "Beavers can hold their breath for up to 15 minutes!",
  "A beaver's front teeth never stop growing — that's why they chew so much.",
  "Moraine Lake once appeared on the back of the Canadian twenty-dollar bill.",
  "Grizzly bears, elk, bighorn sheep and pikas all live around Banff.",
  "The Icefields Parkway is one of the most beautiful drives in the world.",
  "Beavers build dams so their lodge entrances stay safely underwater.",
  "The Bow River flows from the Bow Glacier all the way to Hudson Bay.",
  "Mount Rundle's tilted rock layers were pushed up when the Rockies formed.",
  "Banff's golf course was laid out along the Bow River in the 1920s.",
];

/** Every place the journal counts (the same names daily quests use). */
export const JOURNAL_PLACES = ["lodge", "hotSpring", "dock", "trailhead", "outfitter", "arcade", ...Object.keys(TOWN_PLACES), "summit"];

export const JOURNAL_PAGES = {
  fish: { name: "Fish", icon: "🎣", ids: FISH.filter((f) => !f.junk).map((f) => f.id), reward: { coins: 200, item: "hat_fisher", furniture: "fish_trophy" }, badge: "🏆 Master Angler" },
  bugs: { name: "Bugs", icon: "🦋", ids: BUGS.map((b) => b.id), reward: { coins: 150, item: "trail_butterfly" }, badge: "🦋 Bug Buddy" },
  places: { name: "Places", icon: "🗺️", ids: JOURNAL_PLACES, reward: { coins: 150, item: "pack_map" }, badge: "🧭 Explorer" },
  facts: { name: "Banff facts", icon: "📚", ids: BANFF_FACTS.map((_, i) => String(i)), reward: { coins: 120, item: "hat_scholar" }, badge: "🎓 Banff Scholar" },
} as const;
export type PageId = keyof typeof JOURNAL_PAGES;

// ------------------------------------------------------------------ Townsfolk

export interface NpcDef { id: string; name: string; role: string; x: number; z: number; ry: number; fur: string; hat: string | null; scarf: string | null }

export const NPCS: NpcDef[] = [
  { id: "bea", name: "Bea", role: "Baker", x: -36.5, z: -2.6, ry: Math.PI, fur: "#c48a52", hat: "hat_baker", scarf: null },
  { id: "maple", name: "Mayor Maple", role: "Mayor", x: -88.4, z: 3.2, ry: Math.PI / 2, fur: "#6b4428", hat: "hat_crown", scarf: "scarf_mayor" },
  { id: "rowan", name: "Ranger Rowan", role: "Park Ranger", x: -2.4, z: 76.5, ry: Math.PI / 2, fur: "#8a5a3b", hat: "hat_ranger", scarf: "scarf_plaid" },
  { id: "gus", name: "Keeper Gus", role: "Lighthouse Keeper", x: -57.6, z: 25.4, ry: Math.PI / 2, fur: "#4e3324", hat: "hat_toque_teal", scarf: "scarf_sky" },
];
export const NPC_BY_ID: Record<string, NpcDef> = Object.fromEntries(NPCS.map((n) => [n.id, n]));
export const NPC_TALK_RANGE = 4;

export type LifeEvent =
  | { kind: "catch"; fish: string }
  | { kind: "spot"; bug: string }
  | { kind: "race"; game: string }
  | { kind: "photo" }
  | { kind: "friend" }
  | { kind: "pinecone" }
  | { kind: "act"; a: string }
  | { kind: "visit"; place: string }
  | { kind: "harvest"; item: string };

type Step =
  | { text: string; done: string; kind: "bring"; item: string; count: number }
  | { text: string; done: string; kind: "talk"; npc: string }
  | { text: string; done: string; kind: "event"; ev: LifeEvent["kind"]; match?: string; count: number; distinct?: boolean }
  | { text: string; done: string; kind: "visitAll"; places: string[] };

export interface Chain { greet: string; steps: Step[]; finale: string; idle: string[]; reward: { coins: number; item?: string; furniture?: string } }

export const CHAINS: Record<string, Chain> = {
  bea: {
    greet: "Oh, hello! I'm Bea. My oven's warm but my pantry's bare… could you help a baker out?",
    steps: [
      { kind: "bring", item: "berries", count: 3, text: "I need 3 blueberries for my famous pies. The community garden by the greenhouse grows lovely ones!", done: "Perfect berries! The pies will be purple and perfect." },
      { kind: "talk", npc: "rowan", text: "Could you take this warm croissant to Ranger Rowan at the ranger station? He works so hard.", done: "Rowan sends his thanks? Ha, he always does." },
      { kind: "bring", item: "trout", count: 1, text: "Last thing: catch me a Rainbow Trout for Friday's fish pie. Try the lake or the river!", done: "What a beauty! Fish pie for the whole town." },
    ],
    finale: "You're a star. Here, take my spare baker's hat, you've earned it!",
    idle: ["Fresh croissants every morning! 🥐", "Have you tried maple taffy? Divine.", "The secret ingredient is love. And butter."],
    reward: { coins: 120, item: "hat_baker" },
  },
  maple: {
    greet: "Welcome, citizen! I'm Mayor Maple. Our town is growing so fast, I could use a helper.",
    steps: [
      { kind: "visitAll", places: ["lighthouse", "windmill", "observatory"], text: "Please check on the lighthouse, the windmill and the observatory for me.", done: "All in order? Splendid!" },
      { kind: "event", ev: "photo", count: 1, text: "Snap a photo of our lovely town for the newsletter (📷 Photo mode).", done: "Front page material!" },
      { kind: "event", ev: "friend", count: 2, text: "A town is its people. Make 2 new friends!", done: "Friendship: the best civic infrastructure." },
    ],
    finale: "On behalf of the town, I present you this sash of honour!",
    idle: ["The town bell rings on the hour. Well, whenever someone rings it.", "Vote for more festoon lights!", "Have you seen the new Ferris wheel?"],
    reward: { coins: 150, item: "scarf_mayor" },
  },
  rowan: {
    greet: "Howdy! Ranger Rowan. Keeping the park wild and wonderful. Want to help with some field work?",
    steps: [
      { kind: "event", ev: "spot", count: 3, distinct: true, text: "Spot 3 different kinds of bugs or butterflies. Tap them when they flutter close!", done: "Great field notes!" },
      { kind: "event", ev: "pinecone", count: 5, text: "Golden pinecones help me count the trees. Collect 5!", done: "That's a healthy forest." },
      { kind: "event", ev: "act", match: "climb", count: 1, text: "Climb the fire lookout in the east quarter and keep watch for a bit.", done: "No smoke? Good news!" },
    ],
    finale: "This little fox kit has been following me around. I think she'd rather follow you!",
    idle: ["Leave no trace! 🌲", "Never feed the wildlife.", "Bears love berries. So do I."],
    reward: { coins: 140, item: "pet_fox" },
  },
  gus: {
    greet: "Ahoy! Keeper Gus. The lamp keeps canoes safe at night. Fancy some lake work?",
    steps: [
      { kind: "event", ev: "catch", count: 3, text: "Catch 3 fish, any kind. Stand by the lake or river and press 🎣.", done: "Fine fishing, matey!" },
      { kind: "event", ev: "race", match: "canoe", count: 1, text: "Paddle a Canoe Dash from the Lake Dock. Show me those arms!", done: "Strong strokes!" },
      { kind: "bring", item: "bottle", count: 1, text: "Folk say bottles with messages wash up in the lake. Fish me one up?", done: "'Wish you were here.' Ha! Lovely." },
    ],
    finale: "Here, this duckling hatched under the dock. She's yours now!",
    idle: ["The lamp turns every night.", "Red sky at night, beaver's delight.", "I've seen a golden trout in the rain once…"],
    reward: { coins: 160, item: "pet_duckling" },
  },
};

// ------------------------------------------------------------------ Record

export interface LifeRecord {
  coins: number;
  owned: string[];
  furniture: Record<string, number>;
  journal?: { fish: Record<string, number>; bugs: Record<string, number>; facts: number[]; places: string[]; badges: string[]; biggest?: Record<string, number> };
  bag?: Record<string, number>;
  garden?: ({ seed: SeedId; plantedAt: number; watered: boolean } | null)[];
  npcs?: Record<string, { step: number; progress: number; seen?: string[]; done?: boolean }>;
  lifeCd?: Record<string, number>;
}

export function journalOf(rec: LifeRecord) {
  rec.journal ??= { fish: {}, bugs: {}, facts: [], places: [], badges: [] };
  rec.journal.biggest ??= {};
  return rec.journal;
}
const bagOf = (rec: LifeRecord) => (rec.bag ??= {});
const gardenOf = (rec: LifeRecord) => {
  rec.garden ??= Array(GARDEN_PLOTS).fill(null);
  while (rec.garden.length < GARDEN_PLOTS) rec.garden.push(null);
  return rec.garden;
};

export interface LifeWire {
  t: "life";
  bag: Record<string, number>;
  journal: { fish: Record<string, number>; bugs: Record<string, number>; facts: number[]; places: string[]; badges: string[]; biggest: Record<string, number> };
  garden: ({ seed: SeedId; readyAt: number; watered: boolean } | null)[];
  npcs: Record<string, { step: number; progress: number; done: boolean; text: string; total: number }>;
}

export function growMs(seed: SeedId, watered: boolean) {
  return SEEDS[seed].minutes * 60_000 * (watered ? 0.6 : 1);
}

export function lifeWire(rec: LifeRecord): LifeWire {
  const j = journalOf(rec);
  const npcs: LifeWire["npcs"] = {};
  for (const id of Object.keys(CHAINS)) {
    const s = rec.npcs?.[id];
    const ch = CHAINS[id];
    const step = s?.step ?? -1;
    npcs[id] = { step, progress: s?.progress ?? 0, done: !!s?.done, total: ch.steps.length, text: s?.done ? ch.idle[0] : step >= 0 ? ch.steps[step]?.text ?? "" : ch.greet };
  }
  return {
    t: "life",
    bag: { ...bagOf(rec) },
    journal: { fish: { ...j.fish }, bugs: { ...j.bugs }, facts: [...j.facts], places: [...j.places], badges: [...j.badges], biggest: { ...(j.biggest ?? {}) } },
    garden: gardenOf(rec).map((p) => (p ? { seed: p.seed, readyAt: p.plantedAt + growMs(p.seed, p.watered), watered: p.watered } : null)),
    npcs,
  };
}

/** What a player-facing life action produces. */
export interface LifeOut {
  ok: boolean;
  /** Toast / dialogue text for the player. */
  say?: string;
  /** Speaker for `say` (an NPC name) when it's dialogue. */
  npc?: string;
  coins?: number;
  catch?: { fish: string; size: number; record: boolean };
  /** Journal pages completed by this action. */
  pages?: PageId[];
  /** Cosmetics or furniture granted. */
  gifts?: string[];
  /** Other things this counts for (daily quests, other NPCs). */
  events?: LifeEvent[];
}

const cooldown = (rec: LifeRecord, key: string, ms: number, now: number) => {
  rec.lifeCd ??= {};
  if ((rec.lifeCd[key] ?? 0) > now) return false;
  rec.lifeCd[key] = now + ms;
  return true;
};

function grant(rec: LifeRecord, reward: { coins: number; item?: string; furniture?: string }, out: LifeOut) {
  rec.coins += reward.coins;
  out.coins = (out.coins ?? 0) + reward.coins;
  out.gifts ??= [];
  if (reward.item && CATALOG_BY_ID[reward.item] && !rec.owned.includes(reward.item)) {
    rec.owned.push(reward.item);
    out.gifts.push(reward.item);
  }
  if (reward.furniture && FURNITURE_BY_ID[reward.furniture]) {
    rec.furniture[reward.furniture] = (rec.furniture[reward.furniture] ?? 0) + 1;
    out.gifts.push(reward.furniture);
  }
}

/** Checks every journal page; awards badges for newly completed ones. */
function checkPages(rec: LifeRecord, out: LifeOut) {
  const j = journalOf(rec);
  for (const id of Object.keys(JOURNAL_PAGES) as PageId[]) {
    const page = JOURNAL_PAGES[id];
    if (j.badges.includes(page.badge)) continue;
    const have = id === "fish" ? Object.keys(j.fish) : id === "bugs" ? Object.keys(j.bugs) : id === "places" ? j.places : j.facts.map(String);
    if (page.ids.every((x) => have.includes(x))) {
      j.badges.push(page.badge);
      grant(rec, page.reward, out);
      (out.pages ??= []).push(id);
    }
  }
}

// ------------------------------------------------------------------ Fishing

/** Where you can fish from (stand at the water's edge). */
export function fishingSpot(x: number, z: number): "lake" | "river" | null {
  const lake = Math.hypot(x - HUB_PLACES.lake.x, z - HUB_PLACES.lake.z);
  if (lake < 23.5) return "lake";
  if (riverDistance(x, z) < 7.5) return "river";
  return null;
}

/** Reel in: picks a fish for this spot, season, time of day and weather. */
export function fish(rec: LifeRecord, x: number, z: number, now: number, rand: () => number = Math.random): LifeOut {
  const spot = fishingSpot(x, z);
  if (!spot) return { ok: false, say: "Stand at the edge of the lake or the river to fish." };
  if (!cooldown(rec, "fish", 2500, now)) return { ok: false };
  const season = seasonAt(now), night = isNight(now), rain = weatherAt(now, season).kind === "rain";
  const pool = FISH.filter((f) => (f.where === "both" || f.where === spot) && (!f.seasons || f.seasons.includes(season)) && (!f.night || night) && (!f.day || !night) && (!f.rainOnly || rain));
  const total = pool.reduce((s, f) => s + f.weight, 0);
  let r = rand() * total;
  let got = pool[0];
  for (const f of pool) { r -= f.weight; if (r <= 0) { got = f; break; } }
  const size = Math.round(got.size * (0.7 + rand() * 0.6));
  const j = journalOf(rec);
  const first = !j.fish[got.id];
  j.fish[got.id] = (j.fish[got.id] ?? 0) + 1;
  const record = !got.junk && size > (j.biggest![got.id] ?? 0);
  if (!got.junk) j.biggest![got.id] = Math.max(size, j.biggest![got.id] ?? 0);
  const bag = bagOf(rec);
  bag[got.id] = (bag[got.id] ?? 0) + 1;
  const out: LifeOut = {
    ok: true,
    catch: { fish: got.id, size, record },
    say: got.junk ? `You fished up… ${got.icon} ${got.name}!` : `You caught a ${got.name}! ${size} cm${first ? " · New in your journal!" : record ? " · Personal best!" : ""}`,
    events: [{ kind: "catch", fish: got.id }],
  };
  if (got.id === "bottle") {
    // A message in a bottle teaches you a Banff fact you haven't read yet.
    const next = BANFF_FACTS.findIndex((_, i) => !j.facts.includes(i));
    if (next >= 0) { j.facts.push(next); out.say += ` It says: "${BANFF_FACTS[next]}"`; }
  }
  checkPages(rec, out);
  return out;
}

/** You spotted a bug (the client offers the species it showed; the server checks it could be out now). */
export function spotBug(rec: LifeRecord, bug: string, now: number): LifeOut {
  const b = BUG_BY_ID[bug];
  if (!b) return { ok: false };
  const season = seasonAt(now), night = isNight(now);
  if ((b.seasons && !b.seasons.includes(season)) || (b.night && !night) || (b.day && night)) return { ok: false };
  if (!cooldown(rec, "spot", 3000, now)) return { ok: false };
  const j = journalOf(rec);
  const first = !j.bugs[bug];
  j.bugs[bug] = (j.bugs[bug] ?? 0) + 1;
  const out: LifeOut = { ok: true, say: `${b.icon} You spotted a ${b.name}!${first ? " New in your journal!" : ""}`, events: [{ kind: "spot", bug }] };
  checkPages(rec, out);
  return out;
}

/** Read the next Banff fact at the library. */
export function readFact(rec: LifeRecord, now: number): LifeOut {
  if (!cooldown(rec, "read", 1500, now)) return { ok: false };
  const j = journalOf(rec);
  const next = BANFF_FACTS.findIndex((_, i) => !j.facts.includes(i));
  const i = next >= 0 ? next : Math.floor((now / 1000) % BANFF_FACTS.length);
  if (next >= 0) j.facts.push(next);
  const out: LifeOut = { ok: true, say: `📚 ${BANFF_FACTS[i]}${next >= 0 ? " (New fact!)" : ""}` };
  checkPages(rec, out);
  return out;
}

export function visitPlace(rec: LifeRecord, place: string): LifeOut {
  const j = journalOf(rec);
  const out: LifeOut = { ok: true, events: [{ kind: "visit", place }] };
  if (JOURNAL_PLACES.includes(place) && !j.places.includes(place)) j.places.push(place);
  checkPages(rec, out);
  advanceNpcs(rec, { kind: "visit", place }, out);
  return out;
}

// ------------------------------------------------------------------ Garden

export function inGarden(x: number, z: number) {
  return Math.hypot(x - TOWN_PLACES.garden.x, z - TOWN_PLACES.garden.z) < 9;
}

export function plant(rec: LifeRecord, plot: number, seed: string, x: number, z: number, now: number): LifeOut {
  if (!inGarden(x, z)) return { ok: false, say: "Walk to the community garden to plant." };
  const g = gardenOf(rec);
  if (!(plot >= 0 && plot < GARDEN_PLOTS) || g[plot]) return { ok: false };
  if (!(seed in SEEDS)) return { ok: false };
  if (rec.coins < SEED_PRICE) return { ok: false, say: "Seeds cost 🪙5." };
  rec.coins -= SEED_PRICE;
  g[plot] = { seed: seed as SeedId, plantedAt: now, watered: false };
  return { ok: true, say: `🌱 Planted ${SEEDS[seed as SeedId].name}. Ready in ${SEEDS[seed as SeedId].minutes} min — water it to speed it up!`, coins: -SEED_PRICE };
}

export function water(rec: LifeRecord, plot: number, x: number, z: number): LifeOut {
  if (!inGarden(x, z)) return { ok: false };
  const p = gardenOf(rec)[plot];
  if (!p || p.watered) return { ok: false };
  p.watered = true;
  return { ok: true, say: "💧 Watered! It'll grow faster now." };
}

export function harvest(rec: LifeRecord, plot: number, x: number, z: number, now: number): LifeOut {
  if (!inGarden(x, z)) return { ok: false };
  const g = gardenOf(rec);
  const p = g[plot];
  if (!p) return { ok: false };
  if (now < p.plantedAt + growMs(p.seed, p.watered)) return { ok: false, say: "Not ready yet — give it a little longer." };
  const s = SEEDS[p.seed];
  g[plot] = null;
  const bag = bagOf(rec);
  bag[s.yields] = (bag[s.yields] ?? 0) + s.count;
  const out: LifeOut = { ok: true, say: `🧺 Harvested ${s.count} × ${ITEMS[s.yields].name}!`, events: [{ kind: "harvest", item: s.yields }] };
  advanceNpcs(rec, { kind: "harvest", item: s.yields }, out);
  return out;
}

// ------------------------------------------------------------------ Bag

export function sell(rec: LifeRecord, item: string, n: number): LifeOut {
  const bag = bagOf(rec);
  const have = bag[item] ?? 0;
  const k = Math.max(1, Math.min(have, Math.floor(n) || 1));
  const def = ITEMS[item];
  if (!def || have <= 0) return { ok: false };
  bag[item] = have - k;
  if (bag[item] <= 0) delete bag[item];
  rec.coins += def.price * k;
  return { ok: true, say: `Sold ${k} × ${def.icon} ${def.name} for 🪙${def.price * k}.`, coins: def.price * k };
}

export function takeItem(rec: LifeRecord, item: string, n = 1): boolean {
  const bag = bagOf(rec);
  if ((bag[item] ?? 0) < n) return false;
  bag[item] -= n;
  if (bag[item] <= 0) delete bag[item];
  return true;
}

export function giveItem(rec: LifeRecord, item: string, n = 1) {
  const bag = bagOf(rec);
  bag[item] = (bag[item] ?? 0) + n;
}

// ------------------------------------------------------------------ Townsfolk quests

/** Counts an event toward any townsfolk step waiting for it. */
export function advanceNpcs(rec: LifeRecord, ev: LifeEvent, out: LifeOut) {
  rec.npcs ??= {};
  for (const id of Object.keys(CHAINS)) {
    const s = rec.npcs[id];
    if (!s || s.done || s.step < 0) continue;
    const step = CHAINS[id].steps[s.step];
    if (!step) continue;
    if (step.kind === "visitAll" && ev.kind === "visit" && step.places.includes(ev.place)) {
      s.seen ??= [];
      if (!s.seen.includes(ev.place)) s.seen.push(ev.place);
      s.progress = s.seen.length;
      if (s.progress >= step.places.length) finishStep(rec, id, out);
    }
    if (step.kind === "event" && step.ev === ev.kind) {
      const key = ev.kind === "act" ? ev.a : ev.kind === "race" ? ev.game : ev.kind === "catch" ? ev.fish : ev.kind === "spot" ? ev.bug : "";
      if (step.match && step.match !== key) continue;
      if (step.distinct) {
        s.seen ??= [];
        if (s.seen.includes(key)) continue;
        s.seen.push(key);
      }
      s.progress += 1;
      if (s.progress >= step.count) finishStep(rec, id, out);
    }
  }
}

function finishStep(rec: LifeRecord, id: string, out: LifeOut) {
  const s = rec.npcs![id];
  const ch = CHAINS[id];
  const step = ch.steps[s.step];
  s.step += 1;
  s.progress = 0;
  s.seen = [];
  const npc = NPC_BY_ID[id];
  const lines = [`${npc.name}: ${step.done}`];
  if (s.step >= ch.steps.length) {
    s.done = true;
    lines.push(ch.finale);
    grant(rec, ch.reward, out);
  } else lines.push(`Next: ${ch.steps[s.step].text}`);
  out.say = out.say ? `${out.say} · ${lines.join(" ")}` : lines.join(" ");
  out.npc ??= npc.name;
}

/** Talk to a townsfolk: greet, hand in items, or pass on a message. */
export function talk(rec: LifeRecord, id: string, x: number, z: number): LifeOut {
  const npc = NPC_BY_ID[id];
  if (!npc || Math.hypot(x - npc.x, z - npc.z) > NPC_TALK_RANGE + 1) return { ok: false };
  rec.npcs ??= {};
  const out: LifeOut = { ok: true, npc: npc.name };
  // Messages others asked you to deliver to this NPC.
  for (const other of Object.keys(CHAINS)) {
    const s = rec.npcs[other];
    const step = s && !s.done && s.step >= 0 ? CHAINS[other].steps[s.step] : null;
    if (step?.kind === "talk" && step.npc === id) {
      out.say = `${npc.name}: Oh! A delivery from ${NPC_BY_ID[other].name}? How kind!`;
      finishStep(rec, other, out);
    }
  }
  const ch = CHAINS[id];
  let s = rec.npcs[id];
  if (!s) {
    s = rec.npcs[id] = { step: 0, progress: 0 };
    out.say = `${ch.greet} ${ch.steps[0].text}`;
    return out;
  }
  if (s.done) {
    out.say ??= ch.idle[Math.floor(Math.random() * ch.idle.length)];
    return out;
  }
  const step = ch.steps[s.step];
  if (step.kind === "bring") {
    if (takeItem(rec, step.item, step.count)) finishStep(rec, id, out);
    else out.say ??= `${step.text} (You have ${rec.bag?.[step.item] ?? 0}/${step.count} ${ITEMS[step.item]?.icon ?? ""})`;
  } else if (!out.say) {
    const extra = step.kind === "visitAll" ? ` (${s.seen?.length ?? 0}/${step.places.length})` : step.kind === "event" ? ` (${s.progress}/${step.count})` : "";
    out.say = `${step.text}${extra}`;
  }
  return out;
}

/** Hooks other game events (races, photos, friends, pinecones, activities) into townsfolk quests. */
export function lifeEvent(rec: LifeRecord, ev: LifeEvent): LifeOut {
  const out: LifeOut = { ok: true };
  advanceNpcs(rec, ev, out);
  return out;
}
