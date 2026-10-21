import type { Look } from "../cosmetics";

/**
 * Giant Guess Who: 24 beavers on the board, each player secretly holds one. On your turn ask a
 * yes/no question about the other player's beaver (the faces it rules out flip down), or name the one
 * you think it is: right and you win, wrong and you lose.
 */

export interface Suspect { id: number; name: string; look: Look; fur: "dark" | "brown" | "golden" | "grey"; hat: string | null; scarf: string | null; pack: boolean; glasses: boolean }

const NAMES = ["Alder", "Bramble", "Clover", "Dusty", "Ember", "Fable", "Ginger", "Hazel", "Indigo", "Jasper", "Kipper", "Lark",
  "Mossy", "Nettle", "Olive", "Pip", "Quill", "Rowan", "Sorrel", "Thistle", "Umber", "Violet", "Wren", "Yarrow"];
const FURS: [Suspect["fur"], string][] = [["dark", "#4e3324"], ["brown", "#8a5a3b"], ["golden", "#c48a52"], ["grey", "#9a8f86"]];
const HATS = [null, "hat_toque_red", "hat_ranger", "hat_crown", "hat_party", "hat_earmuffs"];
const SCARVES = [null, "scarf_plaid", "scarf_sky"];

/** The fixed cast of 24, spread so that every question splits the board usefully. */
export const GW_SUSPECTS: Suspect[] = NAMES.map((name, i) => {
  const [fur, col] = FURS[i % 4];
  const hat = HATS[(i * 5 + Math.floor(i / 4)) % HATS.length];
  const scarf = SCARVES[(i * 7 + 1) % 3];
  const pack = (i * 3) % 5 < 2;
  const glasses = (i * 11) % 4 === 1;
  return {
    id: i, name, fur, hat, scarf, pack, glasses,
    look: { fur: col, hat, scarf, backpack: pack ? "pack_hiker" : null, trail: null, eyes: glasses ? "eyes_glasses" : null },
  };
});

export interface GwQuestion { id: string; text: string; test: (s: Suspect) => boolean }
export const GW_QUESTIONS: GwQuestion[] = [
  { id: "dark", text: "Is their fur dark brown?", test: (s) => s.fur === "dark" },
  { id: "golden", text: "Is their fur golden?", test: (s) => s.fur === "golden" },
  { id: "grey", text: "Is their fur grey?", test: (s) => s.fur === "grey" },
  { id: "hat", text: "Are they wearing a hat?", test: (s) => !!s.hat },
  { id: "toque", text: "A red toque?", test: (s) => s.hat === "hat_toque_red" },
  { id: "ranger", text: "A ranger hat?", test: (s) => s.hat === "hat_ranger" },
  { id: "crown", text: "A pinecone crown?", test: (s) => s.hat === "hat_crown" },
  { id: "party", text: "A party hat?", test: (s) => s.hat === "hat_party" },
  { id: "muffs", text: "Earmuffs?", test: (s) => s.hat === "hat_earmuffs" },
  { id: "scarf", text: "Are they wearing a scarf?", test: (s) => !!s.scarf },
  { id: "plaid", text: "A red plaid scarf?", test: (s) => s.scarf === "scarf_plaid" },
  { id: "sky", text: "A blue scarf?", test: (s) => s.scarf === "scarf_sky" },
  { id: "pack", text: "Carrying a backpack?", test: (s) => s.pack },
  { id: "glasses", text: "Wearing glasses?", test: (s) => s.glasses },
  { id: "am", text: "Does their name start with A–M?", test: (s) => s.name[0] <= "M" },
];

export interface GuessWhoState {
  secret: number[]; // per seat
  up: boolean[][]; // per seat: which faces are still standing on that seat's board
  turn: number;
  log: { seat: number; q?: string; guess?: number; yes?: boolean }[];
  result: null | number; // winning seat
}

export function guessWhoStart(rand: () => number, seats = 2): GuessWhoState {
  const a = Math.floor(rand() * 24);
  let b = Math.floor(rand() * 23);
  if (b >= a) b++;
  return { secret: seats === 2 ? [a, b] : [a], up: Array.from({ length: seats }, () => Array(24).fill(true)), turn: 0, log: [], result: null };
}

export type GwAction = { kind: "ask"; q: string } | { kind: "guess"; id: number };

export function guessWhoAct(s: GuessWhoState, seat: number, a: GwAction): { ok: boolean; note?: string } {
  if (s.result !== null || s.turn !== seat) return { ok: false };
  const other = 1 - seat;
  const target = GW_SUSPECTS[s.secret[other]];
  if (a.kind === "ask") {
    const q = GW_QUESTIONS.find((x) => x.id === a.q);
    if (!q) return { ok: false };
    const yes = q.test(target);
    // Flip down every face the answer rules out.
    s.up[seat] = s.up[seat].map((u, i) => u && q.test(GW_SUSPECTS[i]) === yes);
    s.log.push({ seat, q: q.id, yes });
    s.turn = other;
    return { ok: true, note: `${q.text} ${yes ? "Yes!" : "No."}` };
  }
  const right = a.id === target.id;
  s.log.push({ seat, guess: a.id, yes: right });
  s.result = right ? seat : other;
  return { ok: true, note: right ? `Yes, it's ${target.name}!` : `No, it was ${target.name}!` };
}

/** Bot: guess when only one face is left, otherwise ask the question that splits the rest best. */
export function guessWhoBot(s: GuessWhoState, seat: number, rand: () => number): GwAction {
  const left = s.up[seat].map((u, i) => (u ? i : -1)).filter((i) => i >= 0);
  if (left.length === 1) return { kind: "guess", id: left[0] };
  if (left.length === 2 && rand() < 0.5) return { kind: "guess", id: left[Math.floor(rand() * 2)] };
  let best = GW_QUESTIONS[0], bs = Infinity;
  for (const q of GW_QUESTIONS) {
    const yes = left.filter((i) => q.test(GW_SUSPECTS[i])).length;
    const worst = Math.max(yes, left.length - yes) + rand() * 0.8;
    if (yes > 0 && yes < left.length && worst < bs) { bs = worst; best = q; }
  }
  return { kind: "ask", q: best.id };
}
