import { mulberry32 } from "../rng";
import { WORDS, wordsOfLength } from "./vocab";
import type { ActResult, WordPuzzle, WordAction, WordPlayerState, WordSetup } from "./types";
import { WORD_INFO } from "./types";

/**
 * Honey Letters — a honeycomb of seven letters on a plinth, the centre one glowing.
 *
 * Make words of four letters or more; every one must use the centre letter, and letters may be
 * reused. Unlike the other three this has no single answer to race toward, so the race is the
 * scoreboard: it moves while you type, and you can see exactly how far ahead someone is.
 */

const MIN_LENGTH = 4;
const MAX_LENGTH = 9;

/** Words whose letters are all different, used as the seed of a hive. */
function pangramCandidates(): readonly string[] {
  if (pangramCache) return pangramCache;
  const out: string[] = [];
  for (let n = 7; n <= MAX_LENGTH; n++) {
    for (const w of wordsOfLength(n)) {
      if (new Set(w).size === 7) out.push(w);
    }
  }
  pangramCache = out;
  return out;
}
let pangramCache: string[] | null = null;

/** Every word in the Lodge that can be made from `letters` and uses `centre`. */
export function hiveWords(letters: string, centre: string): string[] {
  const allowed = new Set(letters);
  const out: string[] = [];
  for (let n = MIN_LENGTH; n <= MAX_LENGTH; n++) {
    for (const w of WORDS.get(n) ?? []) {
      if (!w.includes(centre)) continue;
      let ok = true;
      for (const ch of w) if (!allowed.has(ch)) { ok = false; break; }
      if (ok) out.push(w);
    }
  }
  return out.sort();
}

/** 1 point for a four-letter word, its length beyond that, and 7 more for using every letter. */
export function scoreWord(word: string, letters: string): number {
  const base = word.length === MIN_LENGTH ? 1 : word.length;
  return base + (new Set(word).size === 7 && letters.split("").every((c) => word.includes(c)) ? 7 : 0);
}

export class BeePuzzle implements WordPuzzle {
  readonly setup: WordSetup;
  private readonly letters: string;
  private readonly centre: string;
  private readonly valid: Set<string>;
  /** Ordered best-first, so a strong bot finds the good words sooner. */
  private readonly byValue: string[];

  constructor(seed: number) {
    const rand = mulberry32(seed ^ 0x27d4eb2f);
    const seeds = pangramCandidates();

    // Start from a word with exactly seven different letters: that guarantees the hive has at
    // least one pangram, and gives a set of letters that demonstrably combine.
    let letters = "";
    let centre = "";
    let valid: string[] = [];
    for (let attempt = 0; attempt < 60; attempt++) {
      const base = seeds[Math.floor(rand() * seeds.length)];
      const set = [...new Set(base)].sort().join("");
      // The centre letter decides how rich the hive is, so try each and keep a generous one.
      const order = [...set].sort(() => rand() - 0.5);
      for (const c of order) {
        const found = hiveWords(set, c);
        if (found.length >= 18) { letters = set; centre = c; valid = found; break; }
      }
      if (letters) break;
    }
    if (!letters) {
      // Never leave a player staring at an empty hive.
      letters = "aelprst";
      centre = "e";
      valid = hiveWords(letters, centre);
    }

    this.letters = letters;
    this.centre = centre;
    this.valid = new Set(valid);
    this.byValue = [...valid].sort((a, b) => scoreWord(b, letters) - scoreWord(a, letters) || a.localeCompare(b));

    const outer = [...letters].filter((c) => c !== centre);
    for (let i = outer.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [outer[i], outer[j]] = [outer[j], outer[i]];
    }

    this.setup = {
      game: "bee",
      seconds: WORD_INFO.bee.seconds,
      length: 0,
      tries: 0,
      cards: [],
      size: 0,
      blocks: [],
      clues: [],
      centre,
      outer,
      best: valid.reduce((s, w) => s + scoreWord(w, letters), 0),
    };
  }

  start(p: WordPlayerState): void {
    p.words = [];
  }

  act(p: WordPlayerState, a: WordAction): ActResult {
    if (a.kind !== "guess" || p.done) return { ok: false };
    const word = a.word.toLowerCase().trim();
    if (word.length < MIN_LENGTH) return { ok: false, note: "Four letters or more." };
    if (!word.includes(this.centre)) return { ok: false, note: `Every word needs the ${this.centre.toUpperCase()}.` };
    for (const ch of word) if (!this.letters.includes(ch)) return { ok: false, note: `No ${ch.toUpperCase()} in the hive.` };
    if (p.words.includes(word)) return { ok: false, note: "Already found!" };
    if (!this.valid.has(word)) return { ok: false, note: "Not a word the Lodge knows." };

    p.words.push(word);
    const gained = scoreWord(word, this.letters);
    p.score += gained;
    const pangram = gained > word.length;
    if (p.words.length === this.valid.size) {
      p.solved = true;
      p.done = true;
      return { ok: true, finished: true, solved: true, note: "Every word in the hive! 🍯" };
    }
    return { ok: true, note: pangram ? `Pangram! +${gained} 🍯` : gained >= 6 ? `Lovely! +${gained}` : `+${gained}` };
  }

  bot(p: WordPlayerState): WordAction | null {
    if (p.done) return null;
    // A bot works down from the juicy words, but a weak one keeps missing them. It never
    // simply knows the whole list — that would make it a stopwatch rather than an opponent.
    const have = new Set(p.words);
    const reach = Math.max(6, Math.floor(this.byValue.length * (0.25 + p.skill * 0.6)));
    for (let i = 0; i < reach; i++) {
      const w = this.byValue[i];
      if (w && !have.has(w)) return { kind: "guess", word: w };
    }
    return null;
  }

  botDelay(p: WordPlayerState, rand: () => number): number {
    return (3.5 + rand() * 7) * (1.5 - p.skill * 0.8);
  }

  progress(p: WordPlayerState): number {
    return this.setup.best > 0 ? Math.min(1, p.score / this.setup.best) : 0;
  }

  reveal(): string {
    const top = this.byValue.slice(0, 8).map((w) => w.toUpperCase());
    return `${this.valid.size} words were in there — best of them: ${top.join(", ")}`;
  }

  /** Every word in the hive, for the end screen. */
  allWords(): readonly string[] {
    return this.byValue;
  }
}
