/**
 * The Mansion Mystery: a whodunnit in the style of the classic detective board game, made gentle
 * for all ages. Someone has hidden the Golden Acorn: find out WHO, in WHICH ROOM and WITH WHAT.
 *
 * The three answer cards go in the envelope; the rest are dealt out. On your turn roll and walk to a
 * room, then suggest a suspect and an item in that room: the next player round the table who holds
 * one of those cards must show you one (only you see it). Accuse when you're sure: right and you win,
 * wrong and you're out of the running (you still show cards).
 */

export const MY_SUSPECTS = ["Captain Cedar", "Duchess Fern", "Professor Pebble", "Madame Maple", "Chef Juniper", "Ranger Aspen"];
export const MY_ITEMS = ["Fishing Net", "Rolling Pin", "Toboggan", "Umbrella", "Syrup Jar", "Magnifying Glass"];
/** The nine rooms, laid out 3×3 in the mansion. The four corners have secret passages to the opposite corner. */
export const MY_ROOMS = ["Boot Room", "Great Hall", "Sunroom", "Library", "Games Room", "Dining Room", "Study", "Trophy Hall", "Kitchen"];
export const MY_COLORS = ["#c8323a", "#3f8a5a", "#7a52c7", "#e8b84a", "#ffffff", "#2f6fb0"];

/** A card: 0-5 suspects, 6-11 items, 12-20 rooms. */
export const cardName = (c: number) => (c < 6 ? MY_SUSPECTS[c] : c < 12 ? MY_ITEMS[c - 6] : MY_ROOMS[c - 12]);
export const cardKind = (c: number) => (c < 6 ? "suspect" : c < 12 ? "item" : "room");

/** Steps between two rooms (adjacent rooms are 1 apart; corner passages cost 1). */
export function roomDistance(a: number, b: number) {
  const corners: Record<number, number> = { 0: 8, 8: 0, 2: 6, 6: 2 };
  if (corners[a] === b) return 1;
  return Math.abs((a % 3) - (b % 3)) + Math.abs(Math.floor(a / 3) - Math.floor(b / 3));
}

export interface MysteryState {
  answer: [number, number, number]; // suspect, item, room card ids
  hands: number[][];
  room: number[]; // which room each seat is in
  turn: number;
  phase: "roll" | "move" | "suggest" | "end";
  roll: number;
  out: boolean[];
  /** What each seat has been shown (card → who showed it). */
  seen: Record<number, number>[];
  log: { seat: number; text: string; card?: number; to?: number }[];
  result: null | number;
  suggestedThisTurn: boolean;
}

export function mysteryStart(rand: () => number, seats: number): MysteryState {
  const pick = (n: number, base: number) => base + Math.floor(rand() * n);
  const answer: [number, number, number] = [pick(6, 0), pick(6, 6), pick(9, 12)];
  const deck = Array.from({ length: 21 }, (_, i) => i).filter((c) => !answer.includes(c));
  for (let i = deck.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [deck[i], deck[j]] = [deck[j], deck[i]]; }
  const hands: number[][] = Array.from({ length: seats }, () => []);
  deck.forEach((c, i) => hands[i % seats].push(c));
  return {
    answer, hands, room: Array.from({ length: seats }, (_, i) => [1, 3, 5, 7][i % 4]), turn: 0, phase: "roll", roll: 0,
    out: Array(seats).fill(false), seen: Array.from({ length: seats }, () => ({})), log: [], result: null, suggestedThisTurn: false,
  };
}

export type MysteryAction =
  | { kind: "roll" }
  | { kind: "move"; room: number }
  | { kind: "suggest"; suspect: number; item: number }
  | { kind: "accuse"; suspect: number; item: number; room: number }
  | { kind: "end" };

function nextSeat(s: MysteryState) {
  const n = s.hands.length;
  for (let k = 1; k <= n; k++) {
    const t = (s.turn + k) % n;
    if (!s.out[t]) return t;
  }
  return s.turn;
}

export function mysteryAct(s: MysteryState, seat: number, a: MysteryAction, rand: () => number): { ok: boolean; note?: string } {
  if (s.result !== null || s.turn !== seat || s.out[seat]) return { ok: false };
  if (a.kind === "roll" && s.phase === "roll") {
    s.roll = 1 + Math.floor(rand() * 6);
    s.phase = "move";
    s.log.push({ seat, text: `rolled a ${s.roll}` });
    return { ok: true };
  }
  if (a.kind === "move" && s.phase === "move") {
    if (!(a.room >= 0 && a.room < 9) || (a.room !== s.room[seat] && roomDistance(s.room[seat], a.room) > Math.ceil(s.roll / 2))) return { ok: false, note: "Too far for that roll." };
    s.room[seat] = a.room;
    s.phase = "suggest";
    s.log.push({ seat, text: `went to the ${MY_ROOMS[a.room]}` });
    return { ok: true };
  }
  if (a.kind === "suggest" && s.phase === "suggest") {
    if (!(a.suspect >= 0 && a.suspect < 6 && a.item >= 6 && a.item < 12)) return { ok: false };
    const room = 12 + s.room[seat];
    const asked = [a.suspect, a.item, room];
    s.suggestedThisTurn = true;
    s.phase = "end";
    // The suspect is called to the room.
    const n = s.hands.length;
    for (let k = 1; k < n; k++) {
      const t = (seat + k) % n;
      const has = s.hands[t].filter((c) => asked.includes(c));
      if (has.length) {
        // Show a card they haven't shown this player before, if they can.
        const card = has.find((c) => s.seen[seat][c] === undefined) ?? has[Math.floor(rand() * has.length)];
        s.seen[seat][card] = t;
        s.log.push({ seat, text: `suggested ${MY_SUSPECTS[a.suspect]} in the ${MY_ROOMS[s.room[seat]]} with the ${MY_ITEMS[a.item - 6]}`, card, to: t });
        return { ok: true };
      }
    }
    s.log.push({ seat, text: `suggested ${MY_SUSPECTS[a.suspect]} in the ${MY_ROOMS[s.room[seat]]} with the ${MY_ITEMS[a.item - 6]}. Nobody could show a card!` });
    return { ok: true };
  }
  if (a.kind === "accuse") {
    const right = a.suspect === s.answer[0] && a.item === s.answer[1] && a.room === s.answer[2];
    s.log.push({ seat, text: `accused ${cardName(a.suspect)} in the ${cardName(a.room)} with the ${cardName(a.item)}… ${right ? "and solved it!" : "and was wrong!"}` });
    if (right) { s.result = seat; return { ok: true }; }
    s.out[seat] = true;
    const left = s.out.map((o, i) => (o ? -1 : i)).filter((i) => i >= 0);
    if (left.length === 1) { s.result = left[0]; return { ok: true }; }
    s.turn = nextSeat(s);
    s.phase = "roll";
    return { ok: true };
  }
  if (a.kind === "end" && (s.phase === "end" || s.phase === "suggest")) {
    s.turn = nextSeat(s);
    s.phase = "roll";
    s.suggestedThisTurn = false;
    return { ok: true };
  }
  return { ok: false };
}

/** What a seat knows for sure isn't the answer. */
export function mysteryKnown(s: MysteryState, seat: number): Set<number> {
  return new Set([...s.hands[seat], ...Object.keys(s.seen[seat]).map(Number)]);
}

/** Bot detective: suggest unknowns, head for unknown rooms, accuse when only one of each remains. */
export function mysteryBot(s: MysteryState, seat: number, rand: () => number): MysteryAction {
  const known = mysteryKnown(s, seat);
  const unknown = (from: number, n: number) => Array.from({ length: n }, (_, i) => from + i).filter((c) => !known.has(c));
  const sus = unknown(0, 6), items = unknown(6, 6), rooms = unknown(12, 9);
  if (sus.length === 1 && items.length === 1 && rooms.length === 1) return { kind: "accuse", suspect: sus[0], item: items[0], room: rooms[0] };
  if (s.phase === "roll") return { kind: "roll" };
  if (s.phase === "move") {
    const reach = Array.from({ length: 9 }, (_, r) => r).filter((r) => r === s.room[seat] || roomDistance(s.room[seat], r) <= Math.ceil(s.roll / 2));
    const want = reach.filter((r) => rooms.includes(12 + r));
    const pool = want.length ? want : reach;
    return { kind: "move", room: pool[Math.floor(rand() * pool.length)] };
  }
  if (s.phase === "suggest") {
    const pickFrom = (list: number[], from: number, n: number) => (list.length ? list[Math.floor(rand() * list.length)] : from + Math.floor(rand() * n));
    return { kind: "suggest", suspect: pickFrom(sus, 0, 6), item: pickFrom(items, 6, 6) };
  }
  return { kind: "end" };
}
