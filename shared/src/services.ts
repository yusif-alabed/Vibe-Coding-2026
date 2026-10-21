import { ACT_PLACES, type ClientMsg, type HubAct, type LeaderRow, type ServerMsg } from "./protocol";
import { fish, fishingSpot, harvest, lifeEvent, lifeWire, plant, readFact, sell, spotBug, talk, visitPlace, water, type LifeEvent, type LifeOut, type LifeRecord } from "./life";
import { questEvent, type ProgressRecord } from "./progress";
import { visitedPlace, type QuestEvent, type VisitPlace } from "./quests";
import { TOWN_PLACES } from "./constants";
import { weekKey, type LeaderGame, type MiniGame, ARCADE_INFO } from "./minigames";
import { WORD_INFO, type WordGame } from "./words/types";

/**
 * Per-player rules shared by the game server and solo mode, so both behave exactly the same:
 * village life (fishing, bugs, facts, garden, bag, townsfolk), activity checks, and the bookkeeping
 * that turns an event into daily-quest and townsfolk progress. Each function returns the messages
 * to send back to that player.
 */

export interface PlayerRecordLike extends ProgressRecord, LifeRecord {
  coins: number;
  owned: string[];
  /** Weekly personal bests per game ("hunt", "golf", …). */
  bests?: Record<string, { week: string; score: number }>;
}

/** Sends the result of a life action (dialogue/toast, updated bag & journal, coins). */
function lifeReply(rec: PlayerRecordLike, key: string, out: LifeOut, now: number): ServerMsg[] {
  const msgs: ServerMsg[] = [];
  if (!out.ok && !out.say) return msgs;
  if (out.say) msgs.push({ t: "lifeSay", text: out.say, npc: out.npc, coins: out.coins, gifts: out.gifts, catch: out.catch, pages: out.pages });
  if (out.ok) {
    for (const ev of out.events ?? []) msgs.push(...questFor(rec, key, ev, now));
    msgs.push(lifeWire(rec));
    msgs.push({ t: "wallet", coins: rec.coins, owned: rec.owned });
    if (out.gifts?.length) msgs.push({ t: "furniture", counts: rec.furniture });
  }
  return msgs;
}

/** Which daily-quest event (if any) a life event counts as. */
function questFor(rec: PlayerRecordLike, key: string, ev: LifeEvent, now: number): ServerMsg[] {
  const q: QuestEvent | null = ev.kind === "catch" ? { kind: "fish" } : ev.kind === "harvest" ? { kind: "harvest" } : null;
  if (!q) return [];
  const w = questEvent(rec, key, q, now);
  return w ? [w] : [];
}

/** Handles a village-life message. Returns null if the message isn't one of these. */
export function handleLife(rec: PlayerRecordLike, key: string, msg: ClientMsg, x: number, z: number, now = Date.now(), rand: () => number = Math.random): ServerMsg[] | null {
  let out: LifeOut;
  const extra: ServerMsg[] = [];
  switch (msg.t) {
    case "fish": out = fish(rec, x, z, now, rand); break;
    case "spot": out = spotBug(rec, String(msg.bug), now); break;
    case "read":
      if (Math.hypot(x - TOWN_PLACES.library.x, z - TOWN_PLACES.library.z) > 9) return [];
      out = readFact(rec, now);
      break;
    case "plant": out = plant(rec, Number(msg.plot), String(msg.seed), x, z, now); break;
    case "water": out = water(rec, Number(msg.plot), x, z); break;
    case "harvest": out = harvest(rec, Number(msg.plot), x, z, now); break;
    case "sell": out = sell(rec, String(msg.item), Number(msg.n)); break;
    case "talk":
      out = talk(rec, String(msg.npc), x, z);
      if (out.ok) { const w = questEvent(rec, key, { kind: "talk" }, now); if (w) extra.push(w); }
      break;
    default: return null;
  }
  return [...lifeReply(rec, key, out, now), ...extra];
}

/** Counts something that happened toward daily quests and townsfolk quests together. */
export function recordEvent(rec: PlayerRecordLike, key: string, q: QuestEvent | null, life: LifeEvent | null, now = Date.now()): ServerMsg[] {
  const msgs: ServerMsg[] = [];
  if (q) {
    const w = questEvent(rec, key, q, now);
    if (w) {
      msgs.push(w);
      if (w.justCompleted?.length || w.bonusNow) msgs.push({ t: "wallet", coins: rec.coins, owned: rec.owned });
    }
  }
  if (life) {
    const out = lifeEvent(rec, life);
    if (out.say) {
      msgs.push({ t: "lifeSay", text: out.say, npc: out.npc, coins: out.coins, gifts: out.gifts });
      msgs.push(lifeWire(rec), { t: "wallet", coins: rec.coins, owned: rec.owned });
      if (out.gifts?.length) msgs.push({ t: "furniture", counts: rec.furniture });
    }
  }
  return msgs;
}

/** A player walked somewhere new: journal places, quests and townsfolk errands. */
export function recordVisit(rec: PlayerRecordLike, key: string, place: string, now = Date.now()): ServerMsg[] {
  const msgs: ServerMsg[] = [];
  const w = questEvent(rec, key, { kind: "visit", place: place as VisitPlace }, now);
  if (w) msgs.push(w);
  const before = rec.journal?.places.length ?? 0;
  const out = visitPlace(rec, place);
  const after = rec.journal?.places.length ?? 0;
  if (out.say) msgs.push({ t: "lifeSay", text: out.say, npc: out.npc, coins: out.coins, gifts: out.gifts, pages: out.pages });
  if (after !== before || out.say) msgs.push(lifeWire(rec));
  if (w || out.coins) msgs.push({ t: "wallet", coins: rec.coins, owned: rec.owned });
  if (out.gifts?.length) msgs.push({ t: "furniture", counts: rec.furniture });
  return msgs;
}

/** Can this activity be started here? ("*" = anywhere; fishing needs water.) */
export function actAllowed(a: HubAct, x: number, z: number): boolean {
  if (a === "stop") return true;
  const where = ACT_PLACES[a as Exclude<HubAct, "stop">];
  if (!where) return false;
  if (a === "fish") return fishingSpot(x, z) !== null;
  if (where === "*") return true;
  if (a === "train") return Math.hypot(x - TOWN_PLACES.station.x, z - TOWN_PLACES.station.z) < 9;
  if (a === "balloon") return Math.hypot(x - TOWN_PLACES.balloons.x, z - TOWN_PLACES.balloons.z) < 11;
  return visitedPlace(x, z) === where;
}

/** Whether an untrusted string names a board the server keeps. */
export function isLeaderGame(game: unknown): game is LeaderGame {
  if (typeof game !== "string") return false;
  if (game === "golf") return true;
  if (game.startsWith("word:")) return game.slice(5) in WORD_INFO;
  return game in ARCADE_INFO;
}

/** The name, icon and units for anything with a weekly leaderboard. */
export function leaderInfo(game: LeaderGame): { name: string; icon: string; scoreLabel: string } {
  if (game === "golf") return { name: "Golf", icon: "⛳", scoreLabel: "strokes vs par (full rounds)" };
  if (game.startsWith("word:")) {
    const w = WORD_INFO[game.slice(5) as WordGame];
    return { name: w.name, icon: w.icon, scoreLabel: w.scoreLabel };
  }
  const a = ARCADE_INFO[game as MiniGame];
  return { name: a.name, icon: a.icon, scoreLabel: a.scoreLabel };
}

/** Whether a smaller score wins: a race time or a golf round, but never a word score. */
export function lowerIsBetter(game: LeaderGame): boolean {
  if (game === "golf") return true;
  if (game.startsWith("word:")) return false;
  return !!ARCADE_INFO[game as MiniGame]?.lowerIsBetter;
}

/** Remembers a personal best for the week. Returns true if it's a new best. */
export function recordBest(rec: PlayerRecordLike, game: LeaderGame, score: number, now = Date.now()): boolean {
  rec.bests ??= {};
  const week = weekKey(now);
  const cur = rec.bests[game];
  const lower = game === "golf" || !!ARCADE_INFO[game as MiniGame]?.lowerIsBetter;
  if (!cur || cur.week !== week || (lower ? score < cur.score : score > cur.score)) {
    rec.bests[game] = { week, score };
    return true;
  }
  return false;
}

/** Builds a leaderboard from many players' bests. */
export function leaderRows(entries: { name: string; best?: { week: string; score: number }; me?: boolean }[], game: LeaderGame, now = Date.now()): LeaderRow[] {
  const week = weekKey(now);
  const lower = lowerIsBetter(game);
  return entries
    .filter((e) => e.best && e.best.week === week)
    .map((e) => ({ name: e.name, score: e.best!.score, me: e.me || undefined }))
    .sort((a, b) => (lower ? a.score - b.score : b.score - a.score))
    .slice(0, 10);
}
