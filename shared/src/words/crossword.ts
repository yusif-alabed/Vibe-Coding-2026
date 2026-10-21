import { mulberry32 } from "../rng";
import { CLUES, GROUP_CLUES, commonWords } from "./vocab";
import type { ActResult, CrossClue, WordPuzzle, WordAction, WordPlayerState, WordSetup } from "./types";
import { WORD_INFO } from "./types";

/**
 * The Mini Crossword — a 5×5 grid laid into the lodge floor that you walk onto.
 *
 * The grid is built by backtracking from the seed, so every player gets the same one without
 * the answers crossing the wire. The shape is a staircase, blocked at two opposite corners:
 *
 *     . . . # #     1a r0 c0-2 (3)    1d c0 r0-2 (3)
 *     . . . . #     4a r1 c0-3 (4)    2d c1 r0-3 (4)
 *     . . . . .     6a r2 c0-4 (5)    3d c2 r0-4 (5)
 *     # . . . .     8a r3 c1-4 (4)    5d c3 r1-4 (4)
 *     # # . . .     9a r4 c2-4 (3)    7d c4 r2-4 (3)
 *
 * The shape matters more than it looks. A grid blocked only at the four corners needs six
 * interlocking five-letter entries, and the Lodge can only write proper clues for about 120
 * five-letter words — nowhere near enough, so most entries ended up with letter-pattern
 * clues. The staircase needs just two fives, four fours and four threes, which the clued
 * vocabulary covers comfortably.
 */

const SIZE = 5;
/** The two blocked corners: top-right and bottom-left. */
const BLOCKED = new Set([3, 4, 9, 15, 20, 21]);

const idx = (r: number, c: number) => r * SIZE + c;

/**
 * Every prefix of every word of a given length, for pruning the search early.
 *
 * There are two of these per length. The wide one covers the whole dictionary; the `cluable`
 * one covers only words the Lodge can write a clue for. Searching the narrow one is what keeps
 * the *down* entries clued — they fall out of the column letters rather than being chosen, so
 * without this they end up as arbitrary dictionary words and get letter-pattern clues.
 */
const prefixCache = new Map<number, Set<string>>();
function prefixes(len: number): Set<string> {
  const key = len;
  let set = prefixCache.get(key);
  if (set) return set;
  set = new Set<string>();
  for (const w of fillWords(len)) {
    for (let i = 1; i <= len; i++) set.add(w.slice(0, i));
  }
  prefixCache.set(key, set);
  return set;
}

/**
 * Recognisable words grouped by their sorted letters, so an anagram clue can be found without
 * needing a definition for the answer.
 */
const anagramCache = new Map<number, Map<string, string[]>>();
function anagrams(len: number): Map<string, string[]> {
  let map = anagramCache.get(len);
  if (map) return map;
  map = new Map();
  for (const w of commonWords(len)) {
    const k = [...w].sort().join("");
    const list = map.get(k);
    if (list) list.push(w);
    else map.set(k, [w]);
  }
  anagramCache.set(len, map);
  return map;
}

/** Recognisable words sharing a word's ending, for rhyme clues. */
const rhymeCache = new Map<number, Map<string, string[]>>();
function rhymeTail(word: string): string {
  return word.slice(word.length >= 4 ? -3 : -2);
}
function rhymes(len: number): Map<string, string[]> {
  let map = rhymeCache.get(len);
  if (map) return map;
  map = new Map();
  for (const w of commonWords(len)) {
    const k = rhymeTail(w);
    const list = map.get(k);
    if (list) list.push(w);
    else map.set(k, [w]);
  }
  rhymeCache.set(len, map);
  return map;
}

/**
 * A clue for a word, in descending order of how good it is.
 *
 * Hand-written definitions are best but there are only a couple of hundred, nowhere near
 * enough to fill a grid — the clued pool on its own yields exactly one 5×5, and it's a word
 * square. So three generated kinds carry the rest, and none of them needs a definition: a
 * theme the word belongs to, an anagram of a word the player knows, or a rhyme with one.
 *
 * Returns null when the word can't be clued fairly, which is how `cluable` below decides what
 * the grid may be built from. Nothing falls back to a bare letter pattern.
 */
export function clueFor(word: string, rand: () => number): string | null {
  const written = CLUES[word] ?? GROUP_CLUES.get(word);
  if (written) return written;

  const pick = (list: string[]) => list[Math.floor(rand() * list.length)].toUpperCase();

  const sorted = [...word].sort().join("");
  const mates = (anagrams(word.length).get(sorted) ?? []).filter((w) => w !== word);
  if (mates.length) return `Anagram of ${pick(mates)}`;

  // A rhyme needs a different opening letter, or the clue hands over most of the answer.
  const rhyme = (rhymes(word.length).get(rhymeTail(word)) ?? []).filter((w) => w !== word && w[0] !== word[0]);
  if (rhyme.length) return `Rhymes with ${pick(rhyme)}`;

  return null;
}

/** Whether a word can be clued fairly — and so whether the grid may use it. */
export function cluable(word: string): boolean {
  if (CLUES[word] || GROUP_CLUES.has(word)) return true;
  const sorted = [...word].sort().join("");
  if ((anagrams(word.length).get(sorted) ?? []).some((w) => w !== word)) return true;
  return (rhymes(word.length).get(rhymeTail(word)) ?? []).some((w) => w !== word && w[0] !== word[0]);
}

/** The fillable vocabulary: words of this length the Lodge can clue. */
const fillCache = new Map<number, string[]>();
export function fillWords(len: number): readonly string[] {
  let cached = fillCache.get(len);
  if (!cached) fillCache.set(len, (cached = commonWords(len).filter(cluable)));
  return cached;
}

interface Entry { n: number; dir: "a" | "d"; cell: number; len: number; cells: number[] }

function layout(): Entry[] {
  const row = (r: number, c0: number, len: number, n: number): Entry =>
    ({ n, dir: "a", cell: idx(r, c0), len, cells: Array.from({ length: len }, (_, i) => idx(r, c0 + i)) });
  const col = (c: number, r0: number, len: number, n: number): Entry =>
    ({ n, dir: "d", cell: idx(r0, c), len, cells: Array.from({ length: len }, (_, i) => idx(r0 + i, c)) });
  return [
    row(0, 0, 3, 1), row(1, 0, 4, 4), row(2, 0, 5, 6), row(3, 1, 4, 8), row(4, 2, 3, 9),
    col(0, 0, 3, 1), col(1, 0, 4, 2), col(2, 0, 5, 3), col(3, 1, 4, 5), col(4, 2, 3, 7),
  ];
}

/**
 * Rows are filled top to bottom; each one is checked against the columns before going deeper.
 *
 * `cluableOnly` restricts the fill to words the Lodge can clue properly. That's a much smaller
 * pool and often has no solution, so the caller tries it first and widens if it comes back
 * empty — a grid of real clues when one exists, a grid of letter patterns rather than no grid.
 */
function fill(seed: number, budgetIn: number): string[] | null {
  const rand = mulberry32(seed ^ 0x5bf03635);
  const shuffled = (len: number): string[] => {
    const list = [...fillWords(len)];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    // Words with a hand-written definition are nudged toward the front, but only nudged.
    // Putting all of them first made the generator hand out the same half-dozen grids over
    // and over — half of all seeds repeated a grid. A random key with a bias term keeps the
    // order mostly random while still landing real clues more often than chance.
    const key = new Map<string, number>();
    for (const w of list) key.set(w, rand() - (CLUES[w] || GROUP_CLUES.has(w) ? 0.18 : 0));
    return list.sort((a, b) => key.get(a)! - key.get(b)!);
  };
  const pools: Record<number, string[]> = { 3: shuffled(3), 4: shuffled(4), 5: shuffled(5) };

  // Each row is a shorter or longer slice of the staircase.
  const rowPlan: { len: number; cols: number[] }[] = [
    { len: 3, cols: [0, 1, 2] },
    { len: 4, cols: [0, 1, 2, 3] },
    { len: 5, cols: [0, 1, 2, 3, 4] },
    { len: 4, cols: [1, 2, 3, 4] },
    { len: 3, cols: [2, 3, 4] },
  ];
  /** How long each column's entry is, and the first row it covers. */
  const colSpan = [{ r0: 0, len: 3 }, { r0: 0, len: 4 }, { r0: 0, len: 5 }, { r0: 1, len: 4 }, { r0: 2, len: 3 }];

  const grid: string[] = new Array(SIZE * SIZE).fill("");
  const colText = (c: number, upto: number) => {
    let s = "";
    for (let r = 0; r <= upto; r++) {
      const ch = grid[idx(r, c)];
      if (ch) s += ch;
    }
    return s;
  };

  // The search can blow up on an unlucky seed; the caller reseeds rather than hanging.
  let budget = budgetIn;

  /** The ten entries, once the grid is full. */
  const allEntries = (): string[] => layout().map((e) => e.cells.map((c) => grid[c]).join(""));

  const fits = (row: number): boolean => {
    for (let c = 0; c < SIZE; c++) {
      const span = colSpan[c];
      if (row < span.r0) continue;
      const text = colText(c, Math.min(row, span.r0 + span.len - 1));
      if (!text) continue;
      // A complete column is a word exactly when it is a prefix of itself, so one lookup
      // covers both "still extendable" and "finished and valid".
      if (!prefixes(span.len).has(text)) return false;
    }
    return true;
  };

  const place = (row: number, usedRows: Set<string>): boolean => {
    if (row === SIZE) {
      // A word appearing twice in one little grid reads as a mistake, so the search keeps
      // going rather than accepting it.
      const entries = allEntries();
      return new Set(entries).size === entries.length;
    }
    const plan = rowPlan[row];
    const words = pools[plan.len];
    for (const w of words) {
      if (budget-- <= 0) return false;
      if (usedRows.has(w)) continue;
      plan.cols.forEach((c, i) => { grid[idx(row, c)] = w[i]; });
      if (fits(row)) {
        usedRows.add(w);
        if (place(row + 1, usedRows)) return true;
        usedRows.delete(w);
      }
      plan.cols.forEach((c) => { grid[idx(row, c)] = ""; });
    }
    return false;
  };

  return place(0, new Set()) ? grid : null;
}

export class CrosswordPuzzle implements WordPuzzle {
  readonly setup: WordSetup;
  private readonly solution: string[];
  private readonly entries: Entry[];

  constructor(seed: number) {
    // A few grids are built and the best-clued one kept. The pool ordering already biases
    // toward hand-written definitions, so this only has to break ties — keeping the count low
    // matters, because the client generates a grid while the round is counting in.
    //
    // Walking the seed forward also covers the unlucky seed that runs out of search budget: a
    // round that can't start at all is far worse than one built on the next seed along.
    const entries = layout();
    const written = (g: string[]) =>
      entries.filter((e) => { const w = e.cells.map((c) => g[c]).join(""); return !!(CLUES[w] ?? GROUP_CLUES.get(w)); }).length;

    let grid: string[] | null = null;
    let used = seed;
    let bestScore = -1;
    for (let attempt = 0; attempt < 6; attempt++) {
      const trySeed = (seed + attempt * 0x9e3779b9) >>> 0;
      const candidate = fill(trySeed, 60_000);
      if (candidate) {
        const score = written(candidate);
        if (score > bestScore) { bestScore = score; grid = candidate; used = trySeed; }
        if (bestScore >= 4) break;
      }
    }
    // Some seeds genuinely need a long search. Giving up and throwing would mean a round that
    // can't start, so the fallback trades the time budget away rather than the grid.
    for (let attempt = 0; attempt < 8 && !grid; attempt++) {
      used = (seed + attempt * 0x85ebca6b) >>> 0;
      grid = fill(used, 4_000_000);
    }
    if (!grid) throw new Error("crossword: no grid for seed " + seed);
    this.solution = grid;
    this.entries = layout();

    const rand = mulberry32(used ^ 0x1b873593);
    const blocks = Array.from({ length: SIZE * SIZE }, (_, i) => BLOCKED.has(i));
    // Two entries landing on "Rhymes with FEW" in the same little grid reads as a mistake, so
    // a repeat is re-rolled a few times before being accepted.
    const usedText = new Set<string>();
    const clues: CrossClue[] = this.entries.map((e) => {
      const word = e.cells.map((c) => grid![c]).join("");
      let text = "";
      for (let tries = 0; tries < 6; tries++) {
        // `fill` only uses cluable words, so this never comes back null.
        text = clueFor(word, rand) ?? word.toUpperCase();
        if (!usedText.has(text)) break;
      }
      usedText.add(text);
      return { n: e.n, dir: e.dir, cell: e.cell, len: e.len, text };
    });

    this.setup = {
      game: "crossword",
      seconds: WORD_INFO.crossword.seconds,
      length: 0,
      tries: 0,
      cards: [],
      size: SIZE,
      blocks,
      clues,
      centre: "",
      outer: [],
      best: 0,
    };
  }

  /** How many squares a filled grid has. */
  private get open(): number {
    return SIZE * SIZE - BLOCKED.size;
  }

  start(p: WordPlayerState): void {
    p.cells = new Array(SIZE * SIZE).fill("");
  }

  act(p: WordPlayerState, a: WordAction): ActResult {
    if (a.kind !== "fill" || p.done) return { ok: false };
    const { cell } = a;
    if (!Number.isInteger(cell) || cell < 0 || cell >= SIZE * SIZE || BLOCKED.has(cell)) return { ok: false };
    const letter = (a.letter ?? "").toLowerCase().slice(0, 1);
    if (letter && !/[a-z]/.test(letter)) return { ok: false };
    if (p.cells[cell] === letter) return { ok: false };
    p.cells[cell] = letter;

    const right = this.correct(p);
    p.score = right * 8;
    if (right === this.open) {
      p.solved = true;
      p.done = true;
      p.score += 120;
      return { ok: true, finished: true, solved: true, note: "Grid complete! 🎉" };
    }
    return { ok: true };
  }

  private correct(p: WordPlayerState): number {
    let n = 0;
    for (let i = 0; i < SIZE * SIZE; i++) if (!BLOCKED.has(i) && p.cells[i] && p.cells[i] === this.solution[i]) n++;
    return n;
  }

  bot(p: WordPlayerState, rand: () => number): WordAction | null {
    if (p.done) return null;
    const empty: number[] = [];
    for (let i = 0; i < SIZE * SIZE; i++) if (!BLOCKED.has(i) && p.cells[i] !== this.solution[i]) empty.push(i);
    if (!empty.length) return null;
    const cell = empty[Math.floor(rand() * empty.length)];
    // A weaker bot sometimes writes in the wrong letter and has to come back to it, which is
    // what gives a human room to catch up.
    const wrong = rand() > p.skill * 0.8 + 0.18;
    const letter = wrong ? String.fromCharCode(97 + Math.floor(rand() * 26)) : this.solution[cell];
    return { kind: "fill", cell, letter };
  }

  botDelay(p: WordPlayerState, rand: () => number): number {
    return (1.6 + rand() * 3.4) * (1.5 - p.skill * 0.8);
  }

  progress(p: WordPlayerState): number {
    return this.correct(p) / this.open;
  }

  reveal(): string {
    return this.entries
      .filter((e) => e.dir === "a")
      .map((e) => e.cells.map((c) => this.solution[c]).join("").toUpperCase())
      .join(" / ");
  }

  /** The finished grid, for the end screen. */
  solutionCells(): readonly string[] {
    return this.solution;
  }
}
