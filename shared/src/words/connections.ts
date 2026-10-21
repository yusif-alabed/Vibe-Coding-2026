import { mulberry32 } from "../rng";
import { GROUPS } from "./vocab";
import type { ActResult, WordPuzzle, WordAction, WordPlayerState, WordSetup } from "./types";
import { WORD_INFO } from "./types";

/**
 * Four of a Kind — sixteen cards on the lodge table hide four groups of four.
 *
 * Everyone works the same sixteen cards. Mistakes are public, so a rival's wrong guess is your
 * opening, which is what makes it a race rather than four people doing a crossword in silence.
 */

const GROUP_SIZE = 4;
const GROUP_COUNT = 4;
const MAX_MISTAKES = 4;

interface Answer {
  theme: string;
  /** Card indices in the shuffled layout. */
  cards: number[];
  rank: number;
}

export class ConnectionsPuzzle implements WordPuzzle {
  readonly setup: WordSetup;
  private readonly answers: Answer[];

  constructor(seed: number) {
    const rand = mulberry32(seed);
    // Four distinct themes, four words from each.
    const pool = [...GROUPS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const chosen: { theme: string; words: string[] }[] = [];
    const used = new Set<string>();
    for (const g of pool) {
      if (chosen.length === GROUP_COUNT) break;
      // A word appearing in two groups would make the puzzle unfair, so skip any that collides.
      const free = g.words.filter((w) => !used.has(w));
      if (free.length < GROUP_SIZE) continue;
      const take: string[] = [];
      const bag = [...free];
      for (let k = 0; k < GROUP_SIZE; k++) take.push(...bag.splice(Math.floor(rand() * bag.length), 1));
      for (const w of take) used.add(w);
      chosen.push({ theme: g.theme, words: take });
    }

    const cards = chosen.flatMap((g) => g.words);
    const order = cards.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    const laidOut = order.map((i) => cards[i]);
    // Where each original card ended up, so the answers can be stated in layout indices.
    const place = new Map<number, number>();
    order.forEach((original, slot) => place.set(original, slot));

    this.answers = chosen.map((g, gi) => ({
      theme: g.theme,
      rank: gi,
      cards: g.words.map((_, wi) => place.get(gi * GROUP_SIZE + wi)!).sort((a, b) => a - b),
    }));

    this.setup = {
      game: "connections",
      seconds: WORD_INFO.connections.seconds,
      length: 0,
      tries: MAX_MISTAKES,
      cards: laidOut,
      size: 0,
      blocks: [],
      clues: [],
      centre: "",
      outer: [],
      best: 0,
    };
  }

  start(p: WordPlayerState): void {
    p.found = [];
    p.mistakes = 0;
  }

  act(p: WordPlayerState, a: WordAction): ActResult {
    if (a.kind !== "pick" || p.done) return { ok: false };
    const picked = [...new Set(a.cards)].filter((i) => Number.isInteger(i) && i >= 0 && i < 16).sort((x, y) => x - y);
    if (picked.length !== GROUP_SIZE) return { ok: false, note: "Pick four cards." };
    const taken = new Set(p.found.flatMap((f) => f.cards));
    if (picked.some((i) => taken.has(i))) return { ok: false, note: "Those are already grouped." };

    const hit = this.answers.find((g) => g.cards.every((c, i) => c === picked[i]));
    if (hit) {
      p.found.push({ cards: hit.cards, theme: hit.theme, rank: hit.rank });
      p.score += 60;
      if (p.found.length === GROUP_COUNT) {
        p.solved = true;
        p.done = true;
        p.score += 80 + (MAX_MISTAKES - p.mistakes) * 30;
        return { ok: true, finished: true, solved: true, note: "All four! 🎉" };
      }
      return { ok: true, note: hit.theme };
    }

    p.mistakes += 1;
    // "One away" is the kindness that makes the game feel fair rather than cruel.
    const near = this.answers.some((g) => picked.filter((c) => g.cards.includes(c)).length === GROUP_SIZE - 1);
    if (p.mistakes >= MAX_MISTAKES) {
      p.done = true;
      return { ok: true, finished: true, note: "That's four mistakes — out of guesses!" };
    }
    return { ok: true, note: near ? "So close — one away!" : `Not a group. ${MAX_MISTAKES - p.mistakes} mistakes left.` };
  }

  bot(p: WordPlayerState, rand: () => number): WordAction | null {
    if (p.done) return null;
    const taken = new Set(p.found.flatMap((f) => f.cards));
    const left = this.answers.filter((g) => !p.found.some((f) => f.theme === g.theme));
    if (!left.length) return null;
    const target = left[Math.floor(rand() * left.length)];
    // A sharp bot plays the group it has worked out. A weaker one has three of the four and
    // reaches for the wrong fourth card, which is exactly how people lose this game.
    const sure = rand() < p.skill * 0.75 + 0.15;
    if (sure) return { kind: "pick", cards: target.cards };
    const spare = [...Array(16).keys()].filter((i) => !taken.has(i) && !target.cards.includes(i));
    if (!spare.length) return { kind: "pick", cards: target.cards };
    const swapOut = target.cards[Math.floor(rand() * target.cards.length)];
    const swapIn = spare[Math.floor(rand() * spare.length)];
    return { kind: "pick", cards: target.cards.map((c) => (c === swapOut ? swapIn : c)).sort((a, b) => a - b) };
  }

  botDelay(p: WordPlayerState, rand: () => number): number {
    return (9 + rand() * 14) * (1.4 - p.skill * 0.6);
  }

  progress(p: WordPlayerState): number {
    return p.found.length / GROUP_COUNT;
  }

  reveal(): string {
    return this.answers
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((g) => `${g.theme}: ${g.cards.map((c) => this.setup.cards[c].toUpperCase()).join(", ")}`)
      .join(" · ");
  }
}
