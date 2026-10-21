/**
 * Monopoly City: the classic property-trading board game, played on a giant board laid out like a
 * little city whose streets are named after the town. Roll two dice, buy the streets you land on,
 * collect rent, build houses on full colour sets, and try not to end up in the Beaver Jail.
 * Bankrupt beavers drop out; the round ends when one is left or the clock runs out (richest wins).
 */

export type SpaceKind = "go" | "street" | "rail" | "chance" | "chest" | "jail" | "free" | "gotojail" | "tax";
export interface Space { name: string; kind: SpaceKind; group?: string; price?: number; color?: string }

export const TY_GROUPS: Record<string, { color: string; house: number }> = {
  brown: { color: "#8a5a34", house: 50 }, sky: { color: "#7fd6ff", house: 50 }, pink: { color: "#ff7eb3", house: 100 },
  orange: { color: "#ff9a3c", house: 100 }, red: { color: "#e2483d", house: 150 }, yellow: { color: "#f5c242", house: 150 },
  green: { color: "#3f8a5a", house: 200 }, blue: { color: "#2f5ab0", house: 200 },
};

export const TY_BOARD: Space[] = [
  { name: "GO", kind: "go" },
  { name: "Cottage Lane", kind: "street", group: "brown", price: 60 },
  { name: "Community Chest", kind: "chest" },
  { name: "Campground Road", kind: "street", group: "brown", price: 80 },
  { name: "Valley Railway", kind: "rail", price: 200 },
  { name: "Lake Dock", kind: "street", group: "sky", price: 100 },
  { name: "Chance", kind: "chance" },
  { name: "Lighthouse Point", kind: "street", group: "sky", price: 120 },
  { name: "Beaver Jail", kind: "jail" },
  { name: "Bakery Row", kind: "street", group: "pink", price: 140 },
  { name: "Ice Cream Corner", kind: "street", group: "pink", price: 160 },
  { name: "Gondola Line", kind: "rail", price: 200 },
  { name: "Free Parking", kind: "free" },
  { name: "Fairground Way", kind: "street", group: "orange", price: 180 },
  { name: "Chance", kind: "chance" },
  { name: "Ferris Wheel Plaza", kind: "street", group: "orange", price: 200 },
  { name: "Main Street", kind: "street", group: "red", price: 220 },
  { name: "Town Hall Square", kind: "street", group: "red", price: 240 },
  { name: "Go to Jail", kind: "gotojail" },
  { name: "Observatory Hill", kind: "street", group: "yellow", price: 260 },
  { name: "Community Chest", kind: "chest" },
  { name: "Hot Springs Drive", kind: "street", group: "yellow", price: 280 },
  { name: "Summit Heights", kind: "street", group: "blue", price: 350 },
  { name: "Lucky Lodge Boardwalk", kind: "street", group: "blue", price: 400 },
];
export const TY_JAIL = 8;
export const TY = { start: 1500, go: 200, jailFine: 50, maxRounds: 30, maxHouses: 4 } as const;

const CARDS: { text: string; money?: number; move?: number; jail?: boolean; to?: number }[] = [
  { text: "Your jam won first prize at the fair! Collect 🪙100.", money: 100 },
  { text: "Beaver dam repairs. Pay 🪙50.", money: -50 },
  { text: "Advance to GO.", to: 0 },
  { text: "Take a ride on the Valley Railway.", to: 4 },
  { text: "You found a golden pinecone! Collect 🪙50.", money: 50 },
  { text: "Hot cocoa for everyone at the lodge. Pay 🪙40.", money: -40 },
  { text: "Go back 3 spaces.", move: -3 },
  { text: "Caught swimming in the fountain! Go to Beaver Jail.", jail: true },
  { text: "Bank error in your favour. Collect 🪙150.", money: 150 },
  { text: "Visit Summit Heights.", to: 22 },
];

export interface TyPlayer { money: number; pos: number; jail: number; out: boolean; doubles: number }
export interface TycoonState {
  players: TyPlayer[];
  owner: (number | null)[];
  houses: number[];
  turn: number;
  phase: "roll" | "buy" | "end";
  dice: [number, number];
  rolledDouble: boolean;
  round: number;
  log: { seat: number; text: string }[];
  result: null | number;
  card?: string;
}

export function tycoonStart(seats: number): TycoonState {
  return {
    players: Array.from({ length: seats }, () => ({ money: TY.start, pos: 0, jail: 0, out: false, doubles: 0 })),
    owner: TY_BOARD.map(() => null), houses: TY_BOARD.map(() => 0), turn: 0, phase: "roll", dice: [1, 1], rolledDouble: false, round: 1, log: [], result: null,
  };
}

export function ownsSet(s: TycoonState, seat: number, group: string) {
  return TY_BOARD.every((sp, i) => sp.group !== group || s.owner[i] === seat);
}

export function rentFor(s: TycoonState, i: number, diceTotal: number): number {
  const sp = TY_BOARD[i], o = s.owner[i];
  if (o === null) return 0;
  if (sp.kind === "rail") return 25 * TY_BOARD.filter((x, k) => x.kind === "rail" && s.owner[k] === o).length * (diceTotal > 0 ? 1 : 1);
  const base = Math.round(sp.price! / 10);
  const h = s.houses[i];
  if (h > 0) return base * [1, 5, 15, 40, 60][h];
  return ownsSet(s, o, sp.group!) ? base * 2 : base;
}

export function netWorth(s: TycoonState, seat: number) {
  let v = s.players[seat].money;
  TY_BOARD.forEach((sp, i) => { if (s.owner[i] === seat) v += (sp.price ?? 0) + s.houses[i] * (TY_GROUPS[sp.group ?? ""]?.house ?? 0); });
  return v;
}

export type TycoonAction = { kind: "roll" } | { kind: "buy" } | { kind: "pass" } | { kind: "build"; space: number } | { kind: "end" } | { kind: "bail" };

function nextSeat(s: TycoonState) {
  const n = s.players.length;
  for (let k = 1; k <= n; k++) { const t = (s.turn + k) % n; if (!s.players[t].out) { if (t <= s.turn) s.round++; return t; } }
  return s.turn;
}

function pay(s: TycoonState, seat: number, amount: number, to: number | null) {
  const p = s.players[seat];
  p.money -= amount;
  if (to !== null) s.players[to].money += amount;
  if (p.money < 0) {
    // Sell houses back at half price before going bust.
    for (let i = 0; i < TY_BOARD.length && p.money < 0; i++) {
      while (s.owner[i] === seat && s.houses[i] > 0 && p.money < 0) { s.houses[i]--; p.money += TY_GROUPS[TY_BOARD[i].group!].house / 2; }
    }
    // Then sell streets back to the bank at half price.
    for (let i = 0; i < TY_BOARD.length && p.money < 0; i++) if (s.owner[i] === seat) { s.owner[i] = null; p.money += Math.floor((TY_BOARD[i].price ?? 0) / 2); }
    if (p.money < 0) {
      p.out = true;
      s.log.push({ seat, text: "went bankrupt!" });
      const alive = s.players.map((q, i) => (q.out ? -1 : i)).filter((i) => i >= 0);
      if (alive.length === 1) s.result = alive[0];
    }
  }
}

function land(s: TycoonState, seat: number, total: number, rand: () => number) {
  const p = s.players[seat];
  const sp = TY_BOARD[p.pos];
  s.card = undefined;
  if ((sp.kind === "street" || sp.kind === "rail")) {
    const o = s.owner[p.pos];
    if (o === null) { s.phase = "buy"; return; }
    if (o !== seat && !s.players[o].out) {
      const rent = rentFor(s, p.pos, total);
      pay(s, seat, rent, o);
      s.log.push({ seat, text: `paid 🪙${rent} rent for ${sp.name}` });
    }
  } else if (sp.kind === "gotojail") {
    p.pos = TY_JAIL; p.jail = 3;
    s.log.push({ seat, text: "went to Beaver Jail!" });
  } else if (sp.kind === "tax") pay(s, seat, 100, null);
  else if (sp.kind === "chance" || sp.kind === "chest") {
    const c = CARDS[Math.floor(rand() * CARDS.length)];
    s.card = c.text;
    s.log.push({ seat, text: c.text });
    if (c.money) { if (c.money > 0) p.money += c.money; else pay(s, seat, -c.money, null); }
    if (c.jail) { p.pos = TY_JAIL; p.jail = 3; }
    if (c.to !== undefined) { if (c.to < p.pos) p.money += TY.go; p.pos = c.to; land(s, seat, total, rand); return; }
    if (c.move) { p.pos = (p.pos + c.move + TY_BOARD.length) % TY_BOARD.length; land(s, seat, total, rand); return; }
  }
  s.phase = "end";
}

export function tycoonAct(s: TycoonState, seat: number, a: TycoonAction, rand: () => number): { ok: boolean; note?: string } {
  if (s.result !== null || s.turn !== seat) return { ok: false };
  const p = s.players[seat];
  if (a.kind === "bail" && s.phase === "roll" && p.jail > 0 && p.money >= TY.jailFine) {
    pay(s, seat, TY.jailFine, null); p.jail = 0;
    s.log.push({ seat, text: "paid bail" });
    return { ok: true };
  }
  if (a.kind === "roll" && s.phase === "roll") {
    const d: [number, number] = [1 + Math.floor(rand() * 6), 1 + Math.floor(rand() * 6)];
    s.dice = d;
    const dbl = d[0] === d[1];
    if (p.jail > 0) {
      if (dbl) p.jail = 0;
      else {
        p.jail--;
        if (p.jail === 0) pay(s, seat, TY.jailFine, null);
        else { s.log.push({ seat, text: `stayed in jail (rolled ${d[0]}+${d[1]})` }); s.phase = "end"; s.rolledDouble = false; return { ok: true }; }
      }
    }
    p.doubles = dbl ? p.doubles + 1 : 0;
    if (p.doubles >= 3) { p.pos = TY_JAIL; p.jail = 3; p.doubles = 0; s.phase = "end"; s.rolledDouble = false; s.log.push({ seat, text: "rolled three doubles and went to jail!" }); return { ok: true }; }
    s.rolledDouble = dbl && p.jail === 0;
    const before = p.pos;
    p.pos = (p.pos + d[0] + d[1]) % TY_BOARD.length;
    if (p.pos < before) { p.money += TY.go; s.log.push({ seat, text: `passed GO, collected 🪙${TY.go}` }); }
    s.log.push({ seat, text: `rolled ${d[0]}+${d[1]} → ${TY_BOARD[p.pos].name}` });
    land(s, seat, d[0] + d[1], rand);
    return { ok: true };
  }
  if (a.kind === "buy" && s.phase === "buy") {
    const sp = TY_BOARD[p.pos];
    if (p.money < sp.price!) return { ok: false, note: "Not enough money." };
    p.money -= sp.price!;
    s.owner[p.pos] = seat;
    s.log.push({ seat, text: `bought ${sp.name} for 🪙${sp.price}` });
    s.phase = "end";
    return { ok: true };
  }
  if (a.kind === "pass" && s.phase === "buy") { s.phase = "end"; return { ok: true }; }
  if (a.kind === "build") {
    const sp = TY_BOARD[a.space];
    if (!sp || sp.kind !== "street" || s.owner[a.space] !== seat || !ownsSet(s, seat, sp.group!)) return { ok: false, note: "Own the whole colour set first." };
    const cost = TY_GROUPS[sp.group!].house;
    if (s.houses[a.space] >= TY.maxHouses || p.money < cost) return { ok: false };
    // Build evenly across the set.
    const set = TY_BOARD.map((x, i) => (x.group === sp.group ? i : -1)).filter((i) => i >= 0);
    if (s.houses[a.space] > Math.min(...set.map((i) => s.houses[i]))) return { ok: false, note: "Build evenly across the set." };
    p.money -= cost;
    s.houses[a.space]++;
    s.log.push({ seat, text: `built a ${s.houses[a.space] === 4 ? "hotel" : "house"} on ${sp.name}` });
    return { ok: true };
  }
  if (a.kind === "end" && s.phase === "end") {
    if (s.rolledDouble && !p.out) { s.phase = "roll"; s.rolledDouble = false; return { ok: true }; }
    s.turn = nextSeat(s);
    s.phase = "roll";
    if (s.round > TY.maxRounds && s.result === null) {
      const alive = s.players.map((_, i) => i).filter((i) => !s.players[i].out);
      s.result = alive.sort((a2, b2) => netWorth(s, b2) - netWorth(s, a2))[0];
    }
    return { ok: true };
  }
  return { ok: false };
}

/** A sensible bot: buys what it can comfortably afford, builds on its sets, pays bail when rich. */
export function tycoonBot(s: TycoonState, seat: number): TycoonAction {
  const p = s.players[seat];
  if (s.phase === "roll") return p.jail > 0 && p.money > 400 ? { kind: "bail" } : { kind: "roll" };
  if (s.phase === "buy") return p.money - TY_BOARD[p.pos].price! >= 120 ? { kind: "buy" } : { kind: "pass" };
  for (let i = 0; i < TY_BOARD.length; i++) {
    const sp = TY_BOARD[i];
    if (sp.kind !== "street" || s.owner[i] !== seat || !ownsSet(s, seat, sp.group!)) continue;
    const set = TY_BOARD.map((x, k) => (x.group === sp.group ? k : -1)).filter((k) => k >= 0);
    if (s.houses[i] < TY.maxHouses && s.houses[i] <= Math.min(...set.map((k) => s.houses[k])) && p.money - TY_GROUPS[sp.group!].house > 250) return { kind: "build", space: i };
  }
  return { kind: "end" };
}
