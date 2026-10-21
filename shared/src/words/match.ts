import { mulberry32 } from "../rng";
import { BeePuzzle } from "./bee";
import { ConnectionsPuzzle } from "./connections";
import { CrosswordPuzzle } from "./crossword";
import { WordlePuzzle } from "./wordle";
import type {
  ActResult, WordPuzzle, WordAction, WordEntrant, WordGame, WordPlayerState, WordResult, WordRivalWire, WordSelfWire, WordSetup,
} from "./types";
import { WORD_INFO } from "./types";

/**
 * One round in the Word Lodge.
 *
 * Shaped after `GolfMatch`: the rules live here, the room (or solo mode) only feeds it actions
 * and a clock. Bots are ordinary players whose moves come from `botTurns(now)`, so putting a
 * real person in a bot's seat changes nothing but a flag.
 */

export function makePuzzle(game: WordGame, seed: number): WordPuzzle {
  switch (game) {
    case "wordle": return new WordlePuzzle(seed);
    case "connections": return new ConnectionsPuzzle(seed);
    case "crossword": return new CrosswordPuzzle(seed);
    case "bee": return new BeePuzzle(seed);
  }
}

export class WordMatch {
  readonly puzzle: WordPuzzle;
  readonly players: WordPlayerState[];
  /** Seconds since the round began. */
  t = 0;
  private startedAt: number;
  private rand: () => number;
  private endedAt: number | null = null;

  constructor(readonly game: WordGame, readonly seed: number, entrants: WordEntrant[], now = Date.now()) {
    this.puzzle = makePuzzle(game, seed);
    this.rand = mulberry32(seed ^ 0x6c8e9cf5);
    this.startedAt = now;
    this.players = entrants.map((e, i) => {
      const p: WordPlayerState = {
        id: e.id, name: e.name, isBot: e.isBot,
        rows: [], marks: [], found: [], cells: [], words: [],
        mistakes: 0, score: 0, done: false, solved: false, note: "",
        finishedAt: null,
        // Bots vary: some are a genuine threat, some are beatable. A table of identical
        // opponents would make every round feel the same.
        skill: 0.35 + this.rand() * 0.6,
        nextAt: 0,
        memo: [],
      };
      this.puzzle.start(p);
      p.nextAt = now + (2 + this.rand() * 6 + i) * 1000;
      return p;
    });
  }

  get setup(): WordSetup {
    return this.puzzle.setup;
  }

  get over(): boolean {
    return this.endedAt !== null;
  }

  player(id: string): WordPlayerState | undefined {
    return this.players.find((p) => p.id === id);
  }

  /** Applies a human player's move. */
  act(id: string, action: WordAction, now = Date.now()): ActResult {
    const p = this.player(id);
    if (!p || p.isBot || this.over || p.done) return { ok: false };
    this.t = (now - this.startedAt) / 1000;
    const r = this.puzzle.act(p, action);
    p.note = r.note ?? "";
    if (r.finished) p.finishedAt = Math.round(this.t * 10) / 10;
    return r;
  }

  /**
   * Runs any bots that are due. Returns what they did, so a room can tell everyone — a rival's
   * board moving is the whole point of playing in the same room.
   */
  botTurns(now = Date.now()): { id: string; result: ActResult }[] {
    if (this.over) return [];
    this.t = (now - this.startedAt) / 1000;
    const out: { id: string; result: ActResult }[] = [];
    for (const p of this.players) {
      if (!p.isBot || p.done || now < p.nextAt) continue;
      const action = this.puzzle.bot(p, this.rand);
      if (!action) {
        // Nothing to do (the Bee bot has exhausted its reach): check back later.
        p.nextAt = now + 4000;
        continue;
      }
      const result = this.puzzle.act(p, action);
      p.note = result.note ?? "";
      if (result.finished) p.finishedAt = Math.round(this.t * 10) / 10;
      p.nextAt = now + Math.max(600, this.puzzle.botDelay(p, this.rand) * 1000);
      out.push({ id: p.id, result });
    }
    return out;
  }

  /** True when the round has just finished — everyone is done, or the clock ran out. */
  advance(now = Date.now()): boolean {
    if (this.over) return false;
    this.t = (now - this.startedAt) / 1000;
    const everyoneDone = this.players.every((p) => p.done);
    if (everyoneDone || this.t >= this.setup.seconds) {
      this.endedAt = now;
      for (const p of this.players) p.done = true;
      return true;
    }
    return false;
  }

  /** Milliseconds left on the clock. */
  remainingMs(now = Date.now()): number {
    return Math.max(0, this.startedAt + this.setup.seconds * 1000 - now);
  }

  /** A player gives up and leaves; their score stands. */
  quit(id: string, now = Date.now()): void {
    const p = this.player(id);
    if (!p || p.done) return;
    p.done = true;
    p.finishedAt = Math.round(((now - this.startedAt) / 1000) * 10) / 10;
  }

  /** Your own board — only ever sent to you. */
  self(id: string): WordSelfWire | null {
    const p = this.player(id);
    if (!p) return null;
    return {
      rows: [...p.rows], marks: [...p.marks], found: p.found.map((f) => ({ ...f, cards: [...f.cards] })),
      cells: [...p.cells], words: [...p.words],
      mistakes: p.mistakes, score: p.score, done: p.done, solved: p.solved, note: p.note,
    };
  }

  /**
   * Everyone's board as a rival may see it: colours, counts and scores, never letters. This is
   * the line that makes the same code safe for a solo game against bots and a public race.
   */
  rivals(): WordRivalWire[] {
    return this.players.map((p) => ({
      id: p.id, name: p.name, isBot: p.isBot,
      score: p.score, done: p.done, solved: p.solved,
      progress: Math.max(0, Math.min(1, this.puzzle.progress(p))),
      // The colour pattern of each row, with the letters dropped.
      marks: this.game === "wordle" ? [...p.marks] : [],
      mistakes: p.mistakes,
    }));
  }

  /** Final standings. Solving beats not solving; then score; then who got there first. */
  results(): WordResult[] {
    return [...this.players]
      .sort((a, b) =>
        Number(b.solved) - Number(a.solved) ||
        b.score - a.score ||
        (a.finishedAt ?? Infinity) - (b.finishedAt ?? Infinity))
      .map((p, i) => ({
        id: p.id, name: p.name, isBot: p.isBot,
        place: i + 1,
        score: p.score,
        solved: p.solved,
        time: p.finishedAt,
        coins: p.isBot ? 0 : wordCoins(this.game, i + 1, p.solved, p.score, this.players.length),
      }));
  }

  /** The answer, once the round is over and there's nothing left to spoil. */
  reveal(): string {
    return this.puzzle.reveal();
  }
}

/** Coins for a round, on the same scale as the races and the arcade games. */
export function wordCoins(game: WordGame, place: number, solved: boolean, score: number, players: number): number {
  const podium = players > 1 ? [25, 15, 10, 8][place - 1] ?? 5 : 0;
  const effort = Math.min(45, Math.round(score / (game === "bee" ? 3 : 6)));
  return (solved ? 30 : 8) + effort + podium;
}

export { WORD_INFO };
