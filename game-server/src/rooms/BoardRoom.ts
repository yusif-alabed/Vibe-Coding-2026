import { BOARD_INFO, BOT_NAMES, BoardMatch, type BoardAction, type BoardGame } from "@beaver/shared";
import type { Client } from "../client";

/**
 * One table at the Board Game Estate. Same shape as `WordRoom`: the rules all live in `BoardMatch`
 * in shared/, this just feeds it actions and a clock. Seats are the real players who sat down; a
 * beaver who started on their own plays the computer. If someone leaves mid-game their seat resigns
 * (in three- or four-player games a bot quietly finishes their turns). Every seat gets only its own `view()`.
 */
export class BoardRoom {
  readonly match: BoardMatch;
  private timer: NodeJS.Timeout;
  private ended = false;
  private seatOf = new Map<string, number>();

  constructor(
    readonly id: string,
    readonly players: Client[],
    readonly game: BoardGame,
    seed: number,
    private readonly onDone: (room: BoardRoom) => void,
  ) {
    // Real players first. Only someone who chose to start on their own gets computer opponents.
    const [min, max] = BOARD_INFO[game].seats;
    const humans = players.slice(0, max);
    const bots = humans.length >= 2 ? 0 : Math.max(min, game === "mystery" || game === "tycoon" ? 3 : 2) - humans.length;
    const seats = [
      ...humans.map((c) => ({ id: c.id, name: c.name, isBot: false })),
      ...Array.from({ length: bots }, (_, i) => ({ id: `bbot-${id}-${i}`, name: BOT_NAMES[(seed + i * 5) % BOT_NAMES.length], isBot: true })),
    ];
    humans.forEach((c, i) => { this.seatOf.set(c.id, i); c.boardId = id; });
    this.match = new BoardMatch(game, seed, seats, Date.now());
    this.broadcast();
    this.timer = setInterval(() => this.tick(), 250);
  }

  act(c: Client, a: BoardAction): void {
    const seat = this.seatOf.get(c.id);
    if (this.ended || seat === undefined) return;
    const r = this.match.act(seat, a, Date.now());
    if (r.ok) this.broadcast();
    else if (r.note) c.send({ t: "error", text: r.note });
    if (this.match.over) this.end();
  }

  /** Leaving the table counts as resigning; the bots play on if others are still there. */
  quit(c: Client): void {
    const seat = this.seatOf.get(c.id);
    if (seat === undefined) return;
    if (!this.match.over) {
      this.match.act(seat, { kind: "resign" }, Date.now());
      // Their chair is taken over by a bot so a multi-player game keeps going.
      this.match.seats[seat].isBot = true;
    }
    c.send({ t: "boardEnd", v: this.match.view(seat), coins: 0 });
    this.seatOf.delete(c.id);
    c.boardId = null;
    const i = this.players.indexOf(c);
    if (i >= 0) this.players.splice(i, 1);
    if (this.players.length === 0 || this.match.over) this.end();
    else this.broadcast();
  }

  private tick(): void {
    if (this.ended) return;
    if (this.match.botTurns(Date.now())) this.broadcast();
    if (this.match.over) this.end();
  }

  private broadcast(): void {
    for (const c of this.players) {
      const seat = this.seatOf.get(c.id);
      if (seat !== undefined) c.send({ t: "board", v: this.match.view(seat) });
    }
  }

  private end(): void {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.timer);
    const pay = this.match.payouts();
    for (const c of this.players) {
      const seat = this.seatOf.get(c.id);
      if (seat === undefined) continue;
      const coins = this.match.over ? pay[seat] : 0;
      c.record.coins += coins;
      c.send({ t: "boardEnd", v: this.match.view(seat), coins });
      c.send({ t: "wallet", coins: c.record.coins, owned: c.record.owned });
      c.boardId = null;
    }
    this.onDone(this);
  }

  dispose(): void {
    this.ended = true;
    clearInterval(this.timer);
  }
}
