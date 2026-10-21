import { ACT_PLACES, type ClientMsg, type HubAct, type LeaderRow, type ServerMsg } from "./protocol";
import { fish, fishingSpot, harvest, lifeEvent, lifeWire, plant, readFact, sell, spotBug, talk, visitPlace, water, type LifeEvent, type LifeOut, type LifeRecord } from "./life";
import { questEvent, type ProgressRecord } from "./progress";
import { visitedPlace, type QuestEvent, type VisitPlace } from "./quests";
import { TOWN_PLACES } from "./constants";
import { weekKey, type LeaderGame, type MiniGame, ARCADE_INFO } from "./minigames";
import { WORD_INFO, isWordGame, type WordGame } from "./words/types";
import { blackjackView, casinoPlay, type BlackjackState, type CasinoGame, type RouletteBet } from "./casino";
import type { BoardAction, BoardGame } from "./board/match";

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
  /** Lucky Lodge daily limits and the blackjack hand in progress. */
  casino?: { day: string; net: number; plays: number };
  blackjack?: BlackjackState | null;
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
  // `in` would also accept "toString" and every other name on Object.prototype.
  if (game.startsWith("word:")) return isWordGame(game.slice(5));
  return Object.hasOwn(ARCADE_INFO, game);
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


// ------------------------------------------------------------------ The Lucky Lodge

/** A spin, a wheel or a hand at the Lucky Lodge. Only works standing inside it. */
export function handleCasino(rec: PlayerRecordLike, msg: Extract<ClientMsg, { t: "casino" }>, x: number, z: number, rand: () => number, now = Date.now()): ServerMsg[] {
  const game = String(msg.game) as CasinoGame;
  if (game !== "slots" && game !== "roulette" && game !== "blackjack") return [];
  if (Math.hypot(x - TOWN_PLACES.casino.x, z - TOWN_PLACES.casino.z) > 9) return [{ t: "casino", game, ok: false, note: "Step inside the Lucky Lodge to play!" }];
  const choice = typeof msg.choice === "number" ? Math.floor(msg.choice) : (String(msg.choice) as RouletteBet);
  const action = (["deal", "hit", "stand", "double"] as const).find((a) => a === msg.action) ?? "deal";
  const out = casinoPlay(rec as Parameters<typeof casinoPlay>[0], game, Number(msg.bet), { choice, action }, rand, now);
  const data = game === "blackjack" ? (rec.blackjack ? blackjackView(rec.blackjack) : null) : out.data;
  return [{ t: "casino", game, ok: out.ok, note: out.note, data, delta: out.delta }, { t: "wallet", coins: rec.coins, owned: rec.owned }];
}

// ------------------------------------------------------------------ The Board Game Estate

const int = (v: unknown, lo: number, hi: number) => (typeof v === "number" && Number.isInteger(v) && v >= lo && v <= hi ? v : null);

/** Turns whatever came off the wire into a well-formed board action for this game, or null. */
export function parseBoardAction(a: unknown, game: BoardGame): BoardAction | null {
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>;
  if (o.kind === "resign") return { kind: "resign" };
  if (game === "chess" || game === "checkers") {
    const from = int(o.from, 0, 63), to = int(o.to, 0, 63);
    if (from === null || to === null) return null;
    if (game === "checkers") return { kind: "checkers", from, to };
    const promo = (["q", "r", "b", "n"] as const).find((p) => p === o.promo);
    return { kind: "chess", from, to, promo };
  }
  if (game === "guesswho") {
    if (o.kind === "ask" && typeof o.q === "string") return { g: "guesswho", kind: "ask", q: o.q.slice(0, 20) };
    const id = int(o.id, 0, 23);
    if (o.kind === "guess" && id !== null) return { g: "guesswho", kind: "guess", id };
    return null;
  }
  if (game === "mystery") {
    if (o.kind === "roll" || o.kind === "end") return { g: "mystery", kind: o.kind };
    if (o.kind === "move") { const room = int(o.room, 0, 8); return room === null ? null : { g: "mystery", kind: "move", room }; }
    const suspect = int(o.suspect, 0, 5), item = int(o.item, 6, 11);
    if (suspect === null || item === null) return null;
    if (o.kind === "suggest") return { g: "mystery", kind: "suggest", suspect, item };
    const room = int(o.room, 12, 20);
    if (o.kind === "accuse" && room !== null) return { g: "mystery", kind: "accuse", suspect, item, room };
    return null;
  }
  if (o.kind === "roll" || o.kind === "buy" || o.kind === "pass" || o.kind === "end" || o.kind === "bail") return { g: "tycoon", kind: o.kind };
  if (o.kind === "build") { const space = int(o.space, 0, 23); return space === null ? null : { g: "tycoon", kind: "build", space }; }
  return null;
}

export type { BlackjackState };
