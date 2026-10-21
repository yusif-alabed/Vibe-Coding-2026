/**
 * The shapes the four Word Lodge games share.
 *
 * Two rules hold everything together:
 *
 *  1. A puzzle is built from a seed and nothing else, so the server and every client derive the
 *     identical board without the answers ever crossing the wire.
 *  2. What you can see about yourself (`WordSelfWire`) and what a rival can see about you
 *     (`WordRivalWire`) are different types. A rival gets colours, counts and scores — never
 *     your letters. That split is what lets the same code run a solo game against bots and a
 *     four-player race unchanged.
 */

export type WordGame = "wordle" | "connections" | "crossword" | "bee";

export interface WordEntrant {
  id: string;
  name: string;
  isBot: boolean;
}

/** Every move in every one of the four games. */
export type WordAction =
  /** Wordle: a guess. Spelling Bee: a word you've spotted. */
  | { kind: "guess"; word: string }
  /** Connections: four card indices you think belong together. */
  | { kind: "pick"; cards: number[] }
  /** Crossword: put a letter in a square (an empty string clears it). */
  | { kind: "fill"; cell: number; letter: string };

/** One clue in the Mini Crossword. */
export interface CrossClue {
  /** The number printed in the square. */
  n: number;
  dir: "a" | "d";
  /** Index of the first square, row-major. */
  cell: number;
  len: number;
  text: string;
}

/** A solved Connections group. */
export interface FoundGroup {
  cards: number[];
  theme: string;
  /** 0 is the easiest group, 3 the trickiest — it picks the colour. */
  rank: number;
}

/**
 * The board, as everyone may see it. Deliberately holds no answers: the Wordle word, the
 * Connections grouping and the crossword fill all stay on the authority until the game ends.
 */
export interface WordSetup {
  game: WordGame;
  /** How long the round runs, in seconds. */
  seconds: number;
  /** Wordle: letters per word and rows on the board. */
  length: number;
  tries: number;
  /** Connections: the sixteen cards, shuffled. */
  cards: string[];
  /** Crossword: grid width, which squares are blocked, and the clues. */
  size: number;
  blocks: boolean[];
  clues: CrossClue[];
  /** Spelling Bee: the centre letter every word must use, and the six around it. */
  centre: string;
  outer: string[];
  /** Spelling Bee: the score a perfect round would reach, for the progress bar. */
  best: number;
}

/** Your own board, with your letters on it. Only ever sent to you. */
export interface WordSelfWire {
  /** Wordle: the guesses you've made, and a colour per letter — `g`reen, `y`ellow, `b`lank. */
  rows: string[];
  marks: string[];
  /** Connections: the groups you've worked out. */
  found: FoundGroup[];
  /** Crossword: one letter per square, blank where empty. */
  cells: string[];
  /** Spelling Bee: the words you've spotted. */
  words: string[];
  mistakes: number;
  score: number;
  done: boolean;
  solved: boolean;
  /** A line about what just happened ("Not a word the Lodge knows"). */
  note: string;
}

/**
 * A rival's board, as you're allowed to see it. Enough to feel them closing in, never enough to
 * ride on their work: Wordle sends colour patterns with the letters stripped out, and the other
 * three send counts.
 */
export interface WordRivalWire {
  id: string;
  name: string;
  isBot: boolean;
  score: number;
  done: boolean;
  solved: boolean;
  /** How far through, 0 to 1 — what the little progress bars over their heads show. */
  progress: number;
  /** Wordle: a colour string per completed row. No letters. */
  marks: string[];
  mistakes: number;
}

/** Where a player has got to. One shape for all four games; unused fields stay empty. */
export interface WordPlayerState {
  id: string;
  name: string;
  isBot: boolean;
  rows: string[];
  marks: string[];
  found: FoundGroup[];
  cells: string[];
  words: string[];
  mistakes: number;
  score: number;
  done: boolean;
  solved: boolean;
  note: string;
  /** When the player finished, in seconds from the start. Breaks ties. */
  finishedAt: number | null;
  /** Bots only: 0 (muddles through) to 1 (sharp). */
  skill: number;
  /** Bots only: when this one acts next, in ms on the match clock. */
  nextAt: number;
  /** Bots only: scratch space the puzzle's bot logic can keep notes in. */
  memo: string[];
}

/** What a move did. */
export interface ActResult {
  /** False when the move was turned away (a non-word, a square already filled, a repeat). */
  ok: boolean;
  note?: string;
  /** The player finished the puzzle with this move. */
  finished?: boolean;
  solved?: boolean;
}

/** One of the four games, generated from a seed. */
export interface WordPuzzle {
  readonly setup: WordSetup;
  /** Sets up a player's blank board. */
  start(p: WordPlayerState): void;
  /** Applies a move. */
  act(p: WordPlayerState, a: WordAction): ActResult;
  /** What a bot would do next, or null when it has nothing to do. */
  bot(p: WordPlayerState, rand: () => number): WordAction | null;
  /** How long a bot waits before its next move, in seconds. Human pace, not machine pace. */
  botDelay(p: WordPlayerState, rand: () => number): number;
  /** How far through this player is, 0 to 1. */
  progress(p: WordPlayerState): number;
  /** The answer, shown on the end screen once there's nothing left to spoil. */
  reveal(): string;
}

/** The result of a round, per player. */
export interface WordResult {
  id: string;
  name: string;
  isBot: boolean;
  place: number;
  score: number;
  solved: boolean;
  /** Seconds taken, when they finished. */
  time: number | null;
  coins: number;
}

export const WORD_INFO: Record<WordGame, { name: string; icon: string; how: string; scoreLabel: string; seconds: number }> = {
  wordle: {
    name: "Five Letters", icon: "🟩", scoreLabel: "pts", seconds: 300,
    how: "Guess the five-letter word. Green is right, amber is in there somewhere. Your rivals' boards show colours only — watch them close in.",
  },
  connections: {
    name: "Four of a Kind", icon: "🟪", scoreLabel: "pts", seconds: 240,
    how: "Sixteen cards hide four groups of four. Pick four that belong together. Four mistakes and you're out.",
  },
  crossword: {
    name: "Mini Crossword", icon: "⬛", scoreLabel: "pts", seconds: 300,
    how: "Fill the grid from the clues. Walk the squares, type a letter. Fastest clean grid wins.",
  },
  bee: {
    name: "Honey Letters", icon: "🍯", scoreLabel: "pts", seconds: 240,
    how: "Make words of four letters or more. Every word must use the middle letter. Use all seven for a bonus.",
  },
};
