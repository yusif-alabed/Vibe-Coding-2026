import { STARTER_FURNITURE, STARTER_LAYOUT, type PlacedItem } from "./cabin";
import { applyQuestEvent, dayKey, ensureDay, PINECONE_COINS, PINECONE_REACH, pineconeSpots, QUEST_BY_ID, type DailyQuests, type QuestDef, type QuestEvent } from "./quests";

/**
 * Per-player progress shared by the game server and solo mode: daily quests, golden pinecones,
 * furniture and the cabin layout. All functions here are the single source of truth for the rules.
 */

export interface ProgressRecord {
  coins: number;
  furniture: Record<string, number>;
  cabin: PlacedItem[];
  quests?: DailyQuests;
  pinecones?: { day: string; got: number[] };
}

export function newProgress(): Pick<ProgressRecord, "furniture" | "cabin"> {
  return { furniture: { ...STARTER_FURNITURE }, cabin: STARTER_LAYOUT.map((i) => ({ ...i })) };
}

export interface QuestView {
  id: string;
  label: string;
  icon: string;
  goal: number;
  progress: number;
  done: boolean;
  reward: number;
}
export interface QuestsWire {
  t: "quests";
  day: string;
  list: QuestView[];
  bonus: boolean;
  justCompleted?: string[];
  bonusNow?: boolean;
}

export function questsWire(rec: ProgressRecord, playerKey: string, now = Date.now(), outcome?: { completed: QuestDef[]; bonus: boolean }): QuestsWire {
  const q = (rec.quests = ensureDay(rec.quests, playerKey, now));
  return {
    t: "quests",
    day: q.day,
    bonus: q.bonus,
    list: q.list.map((s) => {
      const d = QUEST_BY_ID[s.id];
      return { id: s.id, label: d.label, icon: d.icon, goal: d.goal, progress: s.progress, done: s.done, reward: d.reward };
    }),
    justCompleted: outcome?.completed.map((c) => c.label),
    bonusNow: outcome?.bonus || undefined,
  };
}

/** Records a quest event and pays out any coins. Returns the update to send, or null if nothing changed. */
export function questEvent(rec: ProgressRecord, playerKey: string, ev: QuestEvent, now = Date.now()): QuestsWire | null {
  rec.quests = ensureDay(rec.quests, playerKey, now);
  const out = applyQuestEvent(rec.quests, ev);
  if (!out.changed) return null;
  rec.coins += out.coins;
  return questsWire(rec, playerKey, now, out);
}

export function pineconesWire(rec: ProgressRecord, now = Date.now()) {
  const day = dayKey(now);
  if (!rec.pinecones || rec.pinecones.day !== day) rec.pinecones = { day, got: [] };
  return { t: "pinecones" as const, day, spots: pineconeSpots(day), collected: [...rec.pinecones.got] };
}

export type CollectResult = { ok: true; coins: number; quests: QuestsWire | null } | { ok: false; reason: "unknown" | "too_far" | "already" };

/** Picks up a golden pinecone if the player is standing next to it. */
export function collectPinecone(rec: ProgressRecord, playerKey: string, id: number, x: number, z: number, now = Date.now()): CollectResult {
  const day = dayKey(now);
  if (!rec.pinecones || rec.pinecones.day !== day) rec.pinecones = { day, got: [] };
  const spot = pineconeSpots(day).find((s) => s.id === id);
  if (!spot) return { ok: false, reason: "unknown" };
  if (rec.pinecones.got.includes(id)) return { ok: false, reason: "already" };
  if (Math.hypot(spot.x - x, spot.z - z) > PINECONE_REACH) return { ok: false, reason: "too_far" };
  rec.pinecones.got.push(id);
  rec.coins += PINECONE_COINS;
  return { ok: true, coins: PINECONE_COINS, quests: questEvent(rec, playerKey, { kind: "pinecone" }, now) };
}
