import { mulberry32 } from "../rng";
import { chessBot, chessStart, inCheck, legalChess, playChess, type ChessMove, type ChessState } from "./chess";
import { checkersBot, checkersStart, legalCheckers, playCheckers, type CheckersMove, type CheckersState } from "./checkers";
import { guessWhoAct, guessWhoBot, guessWhoStart, type GuessWhoState, type GwAction } from "./guesswho";
import { mysteryAct, mysteryBot, mysteryStart, type MysteryAction, type MysteryState } from "./mystery";
import { netWorth, tycoonAct, tycoonBot, tycoonStart, type TycoonAction, type TycoonState } from "./tycoon";

/**
 * One table at the Board Game Estate. Like the Word Lodge, all the rules live here in shared/, driven
 * only by actions and a clock, so the server and solo mode run identical code and a bot seat can be
 * swapped for a real player by flipping a flag. `view(seat)` is the only thing that leaves the table,
 * and it never shows a seat the cards (or secret beaver) it shouldn't see.
 */

export type BoardGame = "chess" | "checkers" | "guesswho" | "mystery" | "tycoon";

export const BOARD_INFO: Record<BoardGame, { name: string; icon: string; seats: [number, number]; how: string; win: number; draw: number; play: number }> = {
  chess: { name: "Giant Chess", icon: "♟️", seats: [2, 2], how: "Click a piece, then a square. Checkmate the other king!", win: 60, draw: 25, play: 10 },
  checkers: { name: "Giant Checkers", icon: "🔴", seats: [2, 2], how: "Click a piece, then a square. Jumps are compulsory; reach the far row to crown a king.", win: 40, draw: 15, play: 8 },
  guesswho: { name: "Who's That Beaver?", icon: "🕵️", seats: [2, 2], how: "Giant guess-who: ask yes/no questions to flip down faces, then name their secret beaver. Guess wrong and you lose!", win: 35, draw: 0, play: 8 },
  mystery: { name: "Mansion Mystery", icon: "🔍", seats: [3, 4], how: "Who hid the Golden Acorn, where, and with what? Roll, walk to a room, suggest, and accuse when you're sure.", win: 70, draw: 0, play: 12 },
  tycoon: { name: "Tycoon City", icon: "🏙️", seats: [2, 4], how: "A property-trading board game: roll, buy streets, collect rent and build houses on full colour sets. Last beaver standing (or richest at the end) wins.", win: 80, draw: 0, play: 15 },
};

export type BoardAction =
  | { kind: "chess"; from: number; to: number; promo?: "q" | "r" | "b" | "n" }
  | { kind: "checkers"; from: number; to: number }
  | ({ g: "guesswho" } & GwAction)
  | ({ g: "mystery" } & MysteryAction)
  | ({ g: "tycoon" } & TycoonAction)
  | { kind: "resign" };

export interface BoardSeat { id: string; name: string; isBot: boolean; resigned?: boolean }

type AnyState = ChessState | CheckersState | GuessWhoState | MysteryState | TycoonState;

export class BoardMatch {
  state: AnyState;
  private rand: () => number;
  nextBotAt = 0;
  readonly startedAt: number;
  log: string[] = [];
  winner: number | null | "draw" = null;
  /** Bumps on every change so clients can tell views apart. */
  rev = 0;

  constructor(readonly game: BoardGame, seed: number, readonly seats: BoardSeat[], now: number) {
    this.rand = mulberry32(seed);
    this.startedAt = now;
    this.state =
      game === "chess" ? chessStart() : game === "checkers" ? checkersStart() : game === "guesswho" ? guessWhoStart(this.rand, 2)
        : game === "mystery" ? mysteryStart(this.rand, seats.length) : tycoonStart(seats.length);
    this.nextBotAt = now + 1200;
  }

  /** Whose turn it is (seat index). */
  get turn(): number {
    const s = this.state as { turn: unknown };
    if (this.game === "chess") return (s.turn === "w" ? 0 : 1);
    if (this.game === "checkers") return (s.turn === "r" ? 0 : 1);
    return s.turn as number;
  }

  get over() { return this.winner !== null; }

  act(seat: number, a: BoardAction, now: number): { ok: boolean; note?: string } {
    if (this.over || seat < 0 || seat >= this.seats.length) return { ok: false };
    if ("kind" in a && a.kind === "resign") {
      this.seats[seat].resigned = true;
      this.log.push(`${this.seats[seat].name} resigned.`);
      const left = this.seats.map((s, i) => (s.resigned ? -1 : i)).filter((i) => i >= 0);
      if (left.length <= 1) this.winner = left[0] ?? "draw";
      else if (this.game === "mystery") (this.state as MysteryState).out[seat] = true;
      else if (this.game === "tycoon") (this.state as TycoonState).players[seat].out = true;
      this.bump(now);
      return { ok: true };
    }
    if (seat !== this.turn) return { ok: false, note: "Not your turn." };
    let r: { ok: boolean; note?: string } = { ok: false };
    if (this.game === "chess" && "kind" in a && a.kind === "chess") {
      const n = playChess(this.state as ChessState, { from: a.from, to: a.to, promo: a.promo } as ChessMove);
      if (n) { this.state = n; r = { ok: true }; if (n.result) this.winner = n.result === "draw" ? "draw" : n.result === "w" ? 0 : 1; }
    } else if (this.game === "checkers" && "kind" in a && a.kind === "checkers") {
      const n = playCheckers(this.state as CheckersState, { from: a.from, to: a.to } as CheckersMove);
      if (n) { this.state = n; r = { ok: true }; if (n.result) this.winner = n.result === "draw" ? "draw" : n.result === "r" ? 0 : 1; }
    } else if (this.game === "guesswho" && "g" in a && a.g === "guesswho") {
      const s = this.state as GuessWhoState;
      r = guessWhoAct(s, seat, a);
      if (s.result !== null) this.winner = s.result;
    } else if (this.game === "mystery" && "g" in a && a.g === "mystery") {
      const s = this.state as MysteryState;
      r = mysteryAct(s, seat, a, this.rand);
      if (s.result !== null) this.winner = s.result;
    } else if (this.game === "tycoon" && "g" in a && a.g === "tycoon") {
      const s = this.state as TycoonState;
      r = tycoonAct(s, seat, a, this.rand);
      if (s.result !== null) this.winner = s.result;
    }
    if (r.ok) this.bump(now);
    if (r.note) this.log.push(r.note);
    return r;
  }

  private bump(now: number) {
    this.rev++;
    // Bots wait a beat before answering, like a person thinking.
    const think = this.game === "chess" || this.game === "checkers" ? 900 : this.game === "tycoon" ? 650 : 1100;
    this.nextBotAt = now + think + this.rand() * 500;
  }

  /** Lets bots take their turns. Returns true if anything happened. */
  botTurns(now: number): boolean {
    if (this.over || now < this.nextBotAt) return false;
    const seat = this.turn;
    const me = this.seats[seat];
    if (!me?.isBot) return false;
    if (me.resigned) { this.skipResigned(now); return true; }
    let a: BoardAction | null = null;
    if (this.game === "chess") { const m = chessBot(this.state as ChessState, this.rand); if (m) a = { kind: "chess", ...m }; }
    else if (this.game === "checkers") { const m = checkersBot(this.state as CheckersState, this.rand); if (m) a = { kind: "checkers", ...m }; }
    else if (this.game === "guesswho") a = { g: "guesswho", ...guessWhoBot(this.state as GuessWhoState, seat, this.rand) };
    else if (this.game === "mystery") a = { g: "mystery", ...mysteryBot(this.state as MysteryState, seat, this.rand) };
    else a = { g: "tycoon", ...tycoonBot(this.state as TycoonState, seat) };
    if (!a) return false;
    const r = this.act(seat, a, now);
    if (!r.ok) {
      // A bot that somehow can't move ends its turn rather than hanging the table.
      if (this.game === "mystery") this.act(seat, { g: "mystery", kind: "end" }, now);
      if (this.game === "tycoon") this.act(seat, { g: "tycoon", kind: "end" }, now);
      this.nextBotAt = now + 800;
    }
    return true;
  }

  private skipResigned(now: number) {
    if (this.game === "mystery") { const s = this.state as MysteryState; s.phase = "end"; mysteryAct(s, this.turn, { kind: "end" }, this.rand); }
    else if (this.game === "tycoon") { const s = this.state as TycoonState; s.phase = "end"; s.rolledDouble = false; tycoonAct(s, this.turn, { kind: "end" }, this.rand); }
    this.bump(now);
  }

  /** What one seat is allowed to see. */
  view(seat: number): BoardView {
    const base = { game: this.game, rev: this.rev, seats: this.seats.map((s) => ({ name: s.name, isBot: s.isBot, resigned: !!s.resigned })), you: seat, turn: this.turn, winner: this.winner, log: this.log.slice(-6) };
    if (this.game === "chess") {
      const s = this.state as ChessState;
      return { ...base, chess: { board: s.board, last: s.last ?? null, check: inCheck(s), reason: s.reason ?? null, moves: seat === this.turn && !this.over ? legalChess(s).map((m) => [m.from, m.to]) : [] } };
    }
    if (this.game === "checkers") {
      const s = this.state as CheckersState;
      return { ...base, checkers: { board: s.board, last: s.last ?? null, chain: s.chain, moves: seat === this.turn && !this.over ? legalCheckers(s).map((m) => [m.from, m.to]) : [] } };
    }
    if (this.game === "guesswho") {
      const s = this.state as GuessWhoState;
      return { ...base, guesswho: { mine: s.secret[seat] ?? -1, up: s.up[seat] ?? [], theirUpCount: (s.up[1 - seat] ?? []).filter(Boolean).length, log: s.log, reveal: this.over ? s.secret : null } };
    }
    if (this.game === "mystery") {
      const s = this.state as MysteryState;
      return {
        ...base,
        mystery: {
          hand: s.hands[seat] ?? [], seen: s.seen[seat] ?? {}, room: s.room, phase: s.phase, roll: s.roll, out: s.out,
          // Everyone sees who showed whom a card; only the asker sees which one.
          log: s.log.map((l) => ({ seat: l.seat, text: l.text, to: l.to, card: l.seat === seat ? l.card : undefined })),
          answer: this.over ? s.answer : null,
        },
      };
    }
    const s = this.state as TycoonState;
    return { ...base, tycoon: { players: s.players, owner: s.owner, houses: s.houses, phase: s.phase, dice: s.dice, round: s.round, log: s.log.slice(-8), card: s.card ?? null, worth: s.players.map((_, i) => netWorth(s, i)) } };
  }

  /** Coins for each seat when the table finishes. */
  payouts(): number[] {
    const info = BOARD_INFO[this.game];
    return this.seats.map((_, i) => (this.winner === i ? info.win : this.winner === "draw" ? info.draw : info.play));
  }
}

export interface BoardView {
  game: BoardGame; rev: number; seats: { name: string; isBot: boolean; resigned: boolean }[]; you: number; turn: number; winner: number | null | "draw"; log: string[];
  chess?: { board: string[]; last: ChessMove | null; check: boolean; reason: string | null; moves: number[][] };
  checkers?: { board: string[]; last: CheckersMove | null; chain: number; moves: number[][] };
  guesswho?: { mine: number; up: boolean[]; theirUpCount: number; log: GuessWhoState["log"]; reveal: number[] | null };
  mystery?: { hand: number[]; seen: Record<number, number>; room: number[]; phase: MysteryState["phase"]; roll: number; out: boolean[]; log: { seat: number; text: string; to?: number; card?: number }[]; answer: number[] | null };
  tycoon?: { players: TycoonState["players"]; owner: TycoonState["owner"]; houses: number[]; phase: TycoonState["phase"]; dice: [number, number]; round: number; log: TycoonState["log"]; card: string | null; worth: number[] };
}

export const isBoardGame = (g: unknown): g is BoardGame => typeof g === "string" && Object.hasOwn(BOARD_INFO, g);
