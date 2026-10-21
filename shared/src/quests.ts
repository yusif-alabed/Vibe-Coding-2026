import { HUB_COLLIDERS, HUB_PLACES, riverDistance, TOWN_PLACES } from "./constants";
import { mulberry32 } from "./rng";
import "./village";

/**
 * Daily quests: every player gets three quests a day (picked from a pool, different for each
 * player and each day), plus a bonus for finishing all three. Progress is counted by the server
 * from things it can see for itself (where you walk, races, purchases, pinecones you pick up).
 */

export type QuestKind = "visit" | "race" | "podium" | "pinecone" | "emote" | "quickchat" | "buy" | "decorate" | "photo" | "ride" | "skate" | "treat" | "music" | "friend" | "canoe" | "fish" | "harvest" | "arcade" | "golf" | "talk" | "gift" | "group";
export type VisitPlace = "lodge" | "hotSpring" | "dock" | "trailhead" | "outfitter" | "arcade" | keyof typeof TOWN_PLACES;

export interface QuestDef {
  id: string;
  kind: QuestKind;
  target?: VisitPlace;
  goal: number;
  reward: number;
  label: string;
  icon: string;
}

export const QUEST_POOL: QuestDef[] = [
  { id: "visit_lodge", kind: "visit", target: "lodge", goal: 1, reward: 15, label: "Stop by the Lodge Café", icon: "☕" },
  { id: "visit_spring", kind: "visit", target: "hotSpring", goal: 1, reward: 15, label: "Soak at the Hot Springs", icon: "♨️" },
  { id: "visit_dock", kind: "visit", target: "dock", goal: 1, reward: 15, label: "Walk out onto the Lake Dock", icon: "🛶" },
  { id: "visit_arcade", kind: "visit", target: "arcade", goal: 1, reward: 15, label: "Peek into the Riverside Arcade", icon: "🕹️" },
  { id: "race_1", kind: "race", goal: 1, reward: 25, label: "Finish a Toboggan Rush", icon: "🛷" },
  { id: "race_3", kind: "race", goal: 3, reward: 45, label: "Finish 3 Toboggan Rushes", icon: "🛷" },
  { id: "podium", kind: "podium", goal: 1, reward: 40, label: "Finish 1st or 2nd in a race", icon: "🏆" },
  { id: "pinecones_5", kind: "pinecone", goal: 5, reward: 30, label: "Collect 5 golden pinecones", icon: "🌰" },
  { id: "pinecones_10", kind: "pinecone", goal: 10, reward: 50, label: "Collect 10 golden pinecones", icon: "🌰" },
  { id: "emote_3", kind: "emote", goal: 3, reward: 15, label: "Use 3 emotes", icon: "😀" },
  { id: "quick_2", kind: "quickchat", goal: 2, reward: 15, label: "Send 2 quick-chat messages", icon: "💬" },
  { id: "buy_1", kind: "buy", goal: 1, reward: 25, label: "Buy an outfit or furniture", icon: "🛍️" },
  { id: "decorate", kind: "decorate", goal: 1, reward: 30, label: "Decorate your cabin", icon: "🏡" },
  { id: "photo", kind: "photo", goal: 1, reward: 20, label: "Take a photo in Photo Mode", icon: "📷" },
  { id: "visit_townhall", kind: "visit", target: "townHall", goal: 1, reward: 15, label: "Walk Main Street to the Town Hall", icon: "🏛️" },
  { id: "visit_lighthouse", kind: "visit", target: "lighthouse", goal: 1, reward: 15, label: "Visit the lighthouse by the lake", icon: "🗼" },
  { id: "visit_windmill", kind: "visit", target: "windmill", goal: 1, reward: 15, label: "Find the windmill up Cottage Lane", icon: "🌾" },
  { id: "visit_observatory", kind: "visit", target: "observatory", goal: 1, reward: 15, label: "Visit the observatory", icon: "🔭" },
  { id: "ride_ferris", kind: "ride", goal: 1, reward: 25, label: "Ride the Ferris wheel", icon: "🎡" },
  { id: "skate", kind: "skate", goal: 1, reward: 20, label: "Go skating on the pond", icon: "⛸️" },
  { id: "treat_2", kind: "treat", goal: 2, reward: 20, label: "Enjoy 2 treats in town", icon: "🥐" },
  { id: "music", kind: "music", goal: 1, reward: 15, label: "Play guitar at the bandstand", icon: "🎸" },
  { id: "friend", kind: "friend", goal: 1, reward: 20, label: "Add a friend (or invite one to a party)", icon: "🤝" },
  { id: "fish_2", kind: "fish", goal: 2, reward: 25, label: "Catch 2 fish at the lake or river", icon: "🎣" },
  { id: "harvest_1", kind: "harvest", goal: 1, reward: 25, label: "Harvest something from the garden", icon: "🥕" },
  { id: "arcade_1", kind: "arcade", goal: 1, reward: 25, label: "Play a village minigame", icon: "🎮" },
  { id: "golf_1", kind: "golf", goal: 1, reward: 30, label: "Play a hole of golf", icon: "⛳" },
  { id: "talk_2", kind: "talk", goal: 2, reward: 15, label: "Chat with 2 townsfolk", icon: "🗨️" },
  { id: "gift_1", kind: "gift", goal: 1, reward: 20, label: "Give someone a gift", icon: "🎁" },
  { id: "group_1", kind: "group", goal: 1, reward: 25, label: "Dance, sing or skate with others", icon: "💃" },
  { id: "canoe_1", kind: "canoe", goal: 1, reward: 30, label: "Finish a Canoe Dash on the lake", icon: "🛶" },
];
export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUEST_POOL.map((q) => [q.id, q]));
export const QUESTS_PER_DAY = 3;
export const DAILY_BONUS = 50;

export interface QuestState {
  id: string;
  progress: number;
  done: boolean;
}
export interface DailyQuests {
  day: string;
  list: QuestState[];
  bonus: boolean;
}

export type QuestEvent = { kind: "visit"; place: VisitPlace } | { kind: Exclude<QuestKind, "visit"> };

/** UTC calendar day, e.g. "2026-10-20". Quests reset at midnight UTC. */
export function dayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Three quests of different kinds, the same every time for this player and day. */
export function pickDailyQuests(day: string, playerKey: string): QuestState[] {
  const rand = mulberry32(hashString(`${day}|${playerKey}`));
  const pool = [...QUEST_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const picked: QuestDef[] = [];
  for (const q of pool) {
    if (picked.length >= QUESTS_PER_DAY) break;
    if (picked.some((p) => p.kind === q.kind || (p.kind === "race" && q.kind === "podium") || (p.kind === "podium" && q.kind === "race"))) continue;
    picked.push(q);
  }
  return picked.map((q) => ({ id: q.id, progress: 0, done: false }));
}

/** Returns today's quests, starting fresh when the day has changed. */
export function ensureDay(q: DailyQuests | undefined, playerKey: string, now = Date.now()): DailyQuests {
  const day = dayKey(now);
  if (q && q.day === day) return q;
  return { day, list: pickDailyQuests(day, playerKey), bonus: false };
}

export interface QuestOutcome {
  changed: boolean;
  coins: number;
  completed: QuestDef[];
  bonus: boolean;
}

/** Applies one event. Mutates `q`. Coins earned are returned, not added. */
export function applyQuestEvent(q: DailyQuests, ev: QuestEvent): QuestOutcome {
  const out: QuestOutcome = { changed: false, coins: 0, completed: [], bonus: false };
  for (const s of q.list) {
    const def = QUEST_BY_ID[s.id];
    if (!def || s.done || def.kind !== ev.kind) continue;
    if (def.kind === "visit" && (ev as { place?: VisitPlace }).place !== def.target) continue;
    s.progress = Math.min(def.goal, s.progress + 1);
    out.changed = true;
    if (s.progress >= def.goal) {
      s.done = true;
      out.coins += def.reward;
      out.completed.push(def);
    }
  }
  if (!q.bonus && q.list.length > 0 && q.list.every((s) => s.done)) {
    q.bonus = true;
    out.bonus = true;
    out.coins += DAILY_BONUS;
    out.changed = true;
  }
  return out;
}

/** Which quest landmark (if any) a position counts as visiting. */
export function visitedPlace(x: number, z: number): VisitPlace | null {
  const P = HUB_PLACES;
  const near = (p: { x: number; z: number }, d: number) => Math.hypot(x - p.x, z - p.z) < d;
  if (near(P.lodge, P.lodge.r + 7)) return "lodge";
  if (near(P.hotSpring, 7.5)) return "hotSpring";
  if (near(P.dock, 5)) return "dock";
  if (near(P.trailhead, 7)) return "trailhead";
  if (near(P.outfitter, P.outfitter.r + 3.5)) return "outfitter";
  if (near(P.arcade, P.arcade.r + 3.5)) return "arcade";
  const T = TOWN_PLACES;
  const wide: Partial<Record<keyof typeof T, number>> = { rink: 8.5, camp: 8.5, bandstand: 7, ferris: 7, townHall: 6.5, lighthouse: 6.5, windmill: 7, lookout: 6, observatory: 7 };
  // The closest landmark you're within range of wins (shops sit close together on Main Street).
  let best: keyof typeof T | null = null, bd = Infinity;
  for (const k of Object.keys(T) as (keyof typeof T)[]) {
    const d = Math.hypot(x - T[k].x, z - T[k].z);
    if (d < (wide[k] ?? 4.5) && d < bd) { bd = d; best = k; }
  }
  return best;
}

// ------------------------------------------------------------------ Golden pinecones

export const PINECONES_PER_DAY = 12;
export const PINECONE_REACH = 2.6;
export const PINECONE_COINS = 3;

const spotCache = new Map<string, { id: number; x: number; z: number }[]>();

/** Today's golden pinecone spots around the village (the same for everyone). */
export function pineconeSpots(day: string): { id: number; x: number; z: number }[] {
  const hit = spotCache.get(day);
  if (hit) return hit;
  const rand = mulberry32(hashString(`pinecones|${day}`));
  const spots: { id: number; x: number; z: number }[] = [];
  for (let tries = 0; tries < 600 && spots.length < PINECONES_PER_DAY; tries++) {
    const a = rand() * Math.PI * 2, r = 15 + rand() * 42;
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (HUB_COLLIDERS.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1.4)) continue;
    if (riverDistance(x, z) < 6.5) continue;
    if (Math.hypot(x - HUB_PLACES.lake.x, z - HUB_PLACES.lake.z) < 20.5) continue;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 8)) continue;
    spots.push({ id: spots.length, x: Math.round(x * 100) / 100, z: Math.round(z * 100) / 100 });
  }
  spotCache.set(day, spots);
  if (spotCache.size > 4) spotCache.delete(spotCache.keys().next().value as string);
  return spots;
}
