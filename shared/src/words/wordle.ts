import { mulberry32 } from "../rng";
import { ANSWERS, known, wordsOfLength } from "./vocab";
import type { ActResult, WordPuzzle, WordAction, WordPlayerState, WordSetup } from "./types";
import { WORD_INFO } from "./types";

/**
 * Five Letters — guess the word in six tries.
 *
 * The race is the point: your rivals' boards hang on the side walls showing their colour
 * patterns with the letters stripped out, so you can see someone is one row from solving it
 * without being handed their work.
 */

const LENGTH = 5;
const TRIES = 6;

/**
 * Colours a guess against the answer. Green for the right letter in the right place, amber for
 * a letter that's in the word somewhere else, blank otherwise.
 *
 * The fiddly part is repeated letters: greens are claimed first, and only the answer's
 * *remaining* copies of a letter can turn a later position amber. Guessing SPEED against ERASE
 * must give one amber E, not two.
 */
export function markGuess(guess: string, answer: string): string {
  const out = new Array<string>(guess.length).fill("b");
  const spare = new Map<string, number>();
  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) out[i] = "g";
    else spare.set(answer[i], (spare.get(answer[i]) ?? 0) + 1);
  }
  for (let i = 0; i < guess.length; i++) {
    if (out[i] === "g") continue;
    const left = spare.get(guess[i]) ?? 0;
    if (left > 0) {
      out[i] = "y";
      spare.set(guess[i], left - 1);
    }
  }
  return out.join("");
}

/** Words still consistent with every guess made so far. The bot narrows down with this. */
export function stillPossible(candidates: readonly string[], rows: readonly string[], marks: readonly string[]): string[] {
  return candidates.filter((w) => rows.every((g, i) => markGuess(g, w) === marks[i]));
}

export class WordlePuzzle implements WordPuzzle {
  readonly setup: WordSetup;
  private readonly answer: string;

  constructor(seed: number) {
    const rand = mulberry32(seed);
    this.answer = ANSWERS[Math.floor(rand() * ANSWERS.length)];
    this.setup = {
      game: "wordle",
      seconds: WORD_INFO.wordle.seconds,
      length: LENGTH,
      tries: TRIES,
      cards: [],
      size: 0,
      blocks: [],
      clues: [],
      centre: "",
      outer: [],
      best: 0,
    };
  }

  start(p: WordPlayerState): void {
    p.rows = [];
    p.marks = [];
  }

  act(p: WordPlayerState, a: WordAction): ActResult {
    if (a.kind !== "guess" || p.done) return { ok: false };
    const word = a.word.toLowerCase().trim();
    if (word.length !== LENGTH) return { ok: false, note: `${LENGTH} letters, please!` };
    // A word the Lodge doesn't know costs you nothing — being turned away for a real word is
    // the worst moment a word game has, and a wasted row would make it worse.
    if (!known(word)) return { ok: false, note: `Hmm, "${word.toUpperCase()}" isn't in the Lodge dictionary.` };
    if (p.rows.includes(word)) return { ok: false, note: "You've already tried that one." };

    const mark = markGuess(word, this.answer);
    p.rows.push(word);
    p.marks.push(mark);
    const solved = mark === "g".repeat(LENGTH);
    if (solved) {
      p.solved = true;
      p.done = true;
      // Solving in fewer rows is worth more; the clock decides ties.
      p.score = 100 + (TRIES - p.rows.length) * 40;
      return { ok: true, finished: true, solved: true, note: ["Brilliant!", "Superb!", "Lovely!", "Nicely done!", "Phew!", "Just in time!"][p.rows.length - 1] };
    }
    if (p.rows.length >= TRIES) {
      p.done = true;
      p.score = 20;
      return { ok: true, finished: true, note: "Out of rows!" };
    }
    p.score = p.rows.length * 5;
    return { ok: true };
  }

  bot(p: WordPlayerState): WordAction | null {
    if (p.done) return null;
    // The bot plays the way a person does: it keeps only the words still consistent with the
    // colours it has seen, then picks one. A weak bot picks carelessly from that list and so
    // wastes rows; a strong one prefers words with many distinct common letters, which is what
    // a good player's opening guesses are really doing.
    const pool = stillPossible(ANSWERS, p.rows, p.marks);
    if (!pool.length) return { kind: "guess", word: ANSWERS[0] };
    const rand = mulberry32((p.rows.length + 1) * 9176 + p.id.length * 31 + Math.floor(p.skill * 1000));
    if (p.skill < 0.5 || pool.length <= 2) {
      return { kind: "guess", word: pool[Math.floor(rand() * pool.length)] };
    }
    const seen = new Set(p.rows.join(""));
    let best = pool[0];
    let bestScore = -1;
    const sample = pool.length > 160 ? pool.filter((_, i) => i % Math.ceil(pool.length / 160) === 0) : pool;
    for (const w of sample) {
      const letters = new Set(w);
      let s = letters.size;
      for (const c of letters) if (!seen.has(c)) s += 0.6;
      s += rand() * (1 - p.skill) * 3;
      if (s > bestScore) { bestScore = s; best = w; }
    }
    return { kind: "guess", word: best };
  }

  botDelay(p: WordPlayerState, rand: () => number): number {
    // Thinking time, not reaction time: a bot that answers in 200 ms isn't an opponent, it's a
    // clock. Later rows come quicker, the way they do for a person closing in.
    const easing = Math.max(0.45, 1 - p.rows.length * 0.12);
    return (5 + rand() * 9) * easing * (1.5 - p.skill * 0.7);
  }

  progress(p: WordPlayerState): number {
    if (p.solved) return 1;
    const greens = p.marks.length ? Math.max(...p.marks.map((m) => [...m].filter((c) => c === "g").length)) : 0;
    return Math.min(0.95, greens / LENGTH);
  }

  reveal(): string {
    return this.answer.toUpperCase();
  }
}

/** Every five-letter word the Lodge will accept, for the client's own instant check. */
export function acceptedFives(): readonly string[] {
  return wordsOfLength(LENGTH);
}
