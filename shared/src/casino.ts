import { dayKey } from "./quests";

/**
 * The Lucky Lodge: slots, roulette and blackjack played with in-game coins only (coins can't be
 * bought, and nothing here can be cashed out). All outcomes are decided on the server (solo mode runs
 * the same code), bets are small, and a daily limit stops anyone losing more than a little a day.
 */

export type CasinoGame = "slots" | "roulette" | "blackjack";
export const CASINO = { minBet: 1, maxBet: 25, dailyLoss: 150, dailyPlays: 200 } as const;

export interface CasinoRecord {
  coins: number;
  casino?: { day: string; net: number; plays: number };
  blackjack?: BlackjackState | null;
}

export const SLOT_SYMBOLS = [
  { s: "🌰", w: 30, triple: 3 }, { s: "🍁", w: 22, triple: 5 }, { s: "🐟", w: 18, triple: 8 },
  { s: "🦫", w: 14, triple: 15 }, { s: "⭐", w: 10, triple: 25 }, { s: "💎", w: 6, triple: 50 },
] as const;
const SLOT_TOTAL = SLOT_SYMBOLS.reduce((s, x) => s + x.w, 0);
/** Any pair (two of the three reels match) pays this multiple of the bet. */
export const SLOT_PAIR = 1.5;

export const ROULETTE_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export type RouletteBet = "red" | "black" | "odd" | "even" | "low" | "high" | number;

export interface Card { r: number; s: number } // rank 1..13, suit 0..3
export interface BlackjackState { bet: number; player: Card[]; dealer: Card[]; deck: Card[]; done: boolean; outcome?: "win" | "lose" | "push" | "blackjack"; payout?: number }

export interface CasinoOut { ok: boolean; note?: string; game: CasinoGame; data?: unknown; delta?: number }

function limits(rec: CasinoRecord, bet: number, now: number): string | null {
  const day = dayKey(now);
  if (!rec.casino || rec.casino.day !== day) rec.casino = { day, net: 0, plays: 0 };
  if (!Number.isInteger(bet) || bet < CASINO.minBet || bet > CASINO.maxBet) return `Bets are 🪙${CASINO.minBet}–${CASINO.maxBet}.`;
  if (rec.coins < bet) return "Not enough coins for that bet.";
  if (rec.casino.net - bet < -CASINO.dailyLoss) return "That's enough luck for today! The Lucky Lodge limits losses to 🪙150 a day. Come back tomorrow. 🍀";
  if (rec.casino.plays >= CASINO.dailyPlays) return "The Lucky Lodge is closed to you for today. Come back tomorrow!";
  return null;
}

function settle(rec: CasinoRecord, bet: number, win: number) {
  rec.coins += win - bet;
  rec.casino!.net += win - bet;
  rec.casino!.plays += 1;
}

export function spinSlots(rec: CasinoRecord, bet: number, rand: () => number, now = Date.now()): CasinoOut {
  const no = limits(rec, bet, now);
  if (no) return { ok: false, note: no, game: "slots" };
  const reel = () => {
    let r = rand() * SLOT_TOTAL;
    for (const x of SLOT_SYMBOLS) { r -= x.w; if (r <= 0) return x; }
    return SLOT_SYMBOLS[0];
  };
  const reels = [reel(), reel(), reel()];
  let win = 0;
  if (reels[0] === reels[1] && reels[1] === reels[2]) win = bet * reels[0].triple;
  else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) win = Math.floor(bet * SLOT_PAIR);
  settle(rec, bet, win);
  return { ok: true, game: "slots", data: { reels: reels.map((x) => x.s), win }, delta: win - bet };
}

export function spinRoulette(rec: CasinoRecord, bet: number, choice: RouletteBet, rand: () => number, now = Date.now()): CasinoOut {
  const valid = typeof choice === "number" ? Number.isInteger(choice) && choice >= 0 && choice <= 36 : ["red", "black", "odd", "even", "low", "high"].includes(choice);
  if (!valid) return { ok: false, note: "Pick a bet first.", game: "roulette" };
  const no = limits(rec, bet, now);
  if (no) return { ok: false, note: no, game: "roulette" };
  const n = Math.floor(rand() * 37); // a European wheel: 0..36
  let hit: boolean;
  if (typeof choice === "number") hit = n === choice;
  else if (n === 0) hit = false;
  else hit = choice === "red" ? ROULETTE_RED.has(n) : choice === "black" ? !ROULETTE_RED.has(n) : choice === "odd" ? n % 2 === 1 : choice === "even" ? n % 2 === 0 : choice === "low" ? n <= 18 : n >= 19;
  const win = hit ? (typeof choice === "number" ? bet * 36 : bet * 2) : 0;
  settle(rec, bet, win);
  return { ok: true, game: "roulette", data: { n, red: ROULETTE_RED.has(n), win }, delta: win - bet };
}

export function handValue(cards: Card[]): number {
  let v = 0, aces = 0;
  for (const c of cards) { v += c.r === 1 ? 11 : Math.min(10, c.r); if (c.r === 1) aces++; }
  while (v > 21 && aces > 0) { v -= 10; aces--; }
  return v;
}

function freshDeck(rand: () => number): Card[] {
  const d: Card[] = [];
  for (let k = 0; k < 2; k++) for (let s = 0; s < 4; s++) for (let r = 1; r <= 13; r++) d.push({ r, s });
  for (let i = d.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [d[i], d[j]] = [d[j], d[i]]; }
  return d;
}

/** What the player may see: the dealer's hole card stays hidden until the hand is over. */
export function blackjackView(st: BlackjackState) {
  return {
    bet: st.bet, player: st.player, dealer: st.done ? st.dealer : [st.dealer[0], { r: 0, s: 0 }], done: st.done,
    outcome: st.outcome, payout: st.payout, pv: handValue(st.player), dv: st.done ? handValue(st.dealer) : null,
  };
}

export function blackjack(rec: CasinoRecord, action: "deal" | "hit" | "stand" | "double", bet: number, rand: () => number, now = Date.now()): CasinoOut {
  const st = rec.blackjack;
  if (action === "deal") {
    if (st && !st.done) return { ok: false, note: "Finish this hand first.", game: "blackjack", data: blackjackView(st) };
    const no = limits(rec, bet, now);
    if (no) return { ok: false, note: no, game: "blackjack" };
    rec.coins -= bet; // taken now, paid out when the hand ends
    const deck = freshDeck(rand);
    const s: BlackjackState = { bet, deck, player: [deck.pop()!, deck.pop()!], dealer: [deck.pop()!, deck.pop()!], done: false };
    rec.blackjack = s;
    if (handValue(s.player) === 21) finishHand(rec, s);
    return { ok: true, game: "blackjack", data: blackjackView(s), delta: s.done ? (s.payout ?? 0) - bet : -bet };
  }
  if (!st || st.done) return { ok: false, note: "Deal a new hand.", game: "blackjack" };
  if (action === "hit") {
    st.player.push(st.deck.pop()!);
    if (handValue(st.player) >= 21) finishHand(rec, st);
  } else if (action === "double") {
    const net = rec.casino?.net ?? 0;
    if (st.player.length !== 2 || rec.coins < st.bet || net - st.bet * 2 < -CASINO.dailyLoss) return { ok: false, note: "You can only double on your first two cards.", game: "blackjack", data: blackjackView(st) };
    rec.coins -= st.bet;
    st.bet *= 2;
    st.player.push(st.deck.pop()!);
    finishHand(rec, st);
  } else finishHand(rec, st);
  return { ok: true, game: "blackjack", data: blackjackView(st), delta: st.done ? st.payout! - st.bet : 0 };
}

function finishHand(rec: CasinoRecord, st: BlackjackState) {
  const pv = handValue(st.player);
  const natural = pv === 21 && st.player.length === 2;
  if (pv <= 21 && !natural) while (handValue(st.dealer) < 17) st.dealer.push(st.deck.pop()!);
  const dv = handValue(st.dealer);
  const dealerNatural = dv === 21 && st.dealer.length === 2;
  let payout = 0;
  if (pv > 21) st.outcome = "lose";
  else if (natural && !dealerNatural) { st.outcome = "blackjack"; payout = Math.floor(st.bet * 2.5); }
  else if (dv > 21 || pv > dv) { st.outcome = "win"; payout = st.bet * 2; }
  else if (pv === dv) { st.outcome = "push"; payout = st.bet; }
  else st.outcome = "lose";
  st.done = true;
  st.payout = payout;
  st.deck = []; // nothing left to draw; don't keep 100 cards in the save
  rec.coins += payout;
  rec.casino ??= { day: "", net: 0, plays: 0 };
  rec.casino.net += payout - st.bet;
  rec.casino.plays += 1;
}

/** Handles a Lucky Lodge request. */
export function casinoPlay(rec: CasinoRecord, game: CasinoGame, bet: number, opts: { choice?: RouletteBet; action?: "deal" | "hit" | "stand" | "double" }, rand: () => number, now = Date.now()): CasinoOut {
  bet = Math.floor(Number(bet));
  if (game === "slots") return spinSlots(rec, bet, rand, now);
  if (game === "roulette") return spinRoulette(rec, bet, opts.choice as RouletteBet, rand, now);
  if (game === "blackjack") return blackjack(rec, opts.action ?? "deal", bet, rand, now);
  return { ok: false, game, note: "Unknown game." };
}
