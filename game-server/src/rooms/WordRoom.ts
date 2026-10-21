import { BOT_NAMES, WordMatch, type RaceResultWire, type WordAction, type WordGame } from "@beaver/shared";
import type { Client } from "../client";

/**
 * One round in the Word Lodge.
 *
 * Built the same way as `GolfRoom`: the rules all live in `WordMatch` in `shared/`, and this
 * only feeds it actions and a clock, then fans the results out. Bot beavers fill the empty
 * lecterns, and they are ordinary players as far as the match is concerned — when real players
 * fill those seats instead, nothing here changes.
 *
 * The one thing this room must get right is who sees what. Each player gets their own board
 * through `self()`, and everybody's `rivals()` view, which carries colours, counts and scores
 * but never another player's letters.
 */
export class WordRoom {
  readonly match: WordMatch;
  private timer: NodeJS.Timeout;
  private ended = false;
  hubId = "";
  /** Called the first time each player finishes, for daily quests. */
  onSolve: (id: string) => void = () => {};
  private solvedOnce = new Set<string>();

  constructor(
    readonly id: string,
    readonly players: Client[],
    game: WordGame,
    seed: number,
    private readonly onDone: (room: WordRoom, results: ReturnType<WordMatch["results"]>) => void,
  ) {
    // Always at least two at the lecterns: a word game you play alone is a different game.
    const bots = Math.max(1, 3 - players.length);
    const entrants = [
      ...players.map((c) => ({ id: c.id, name: c.name, isBot: false })),
      ...Array.from({ length: bots }, (_, i) => ({ id: `wbot-${id}-${i}`, name: BOT_NAMES[(seed + i * 7) % BOT_NAMES.length], isBot: true })),
    ];
    const now = Date.now();
    this.match = new WordMatch(game, seed, entrants, now);
    for (const c of players) c.wordId = id;
    const endsAt = now + this.match.setup.seconds * 1000;
    for (const c of players) {
      c.send({ t: "wordStart", game, setup: this.match.setup, you: this.match.self(c.id)!, rivals: this.match.rivals(), endsAt });
    }
    this.timer = setInterval(() => this.tick(), 500);
  }

  /** A player made a move. Only they see their own board change; everyone sees the rivals view. */
  act(c: Client, action: WordAction): void {
    if (this.ended) return;
    const r = this.match.act(c.id, action, Date.now());
    if (r.finished && r.solved && !this.solvedOnce.has(c.id)) {
      this.solvedOnce.add(c.id);
      this.onSolve(c.id);
    }
    if (!r.ok && !r.note) return;
    this.broadcastState();
  }

  quit(c: Client): void {
    // They still get their standings and the coins they earned.
    this.leave(c, true);
  }

  /** A player disconnected: no point sending them anything. */
  drop(c: Client): void {
    this.leave(c, false);
  }

  private leave(c: Client, tell: boolean): void {
    this.match.quit(c.id, Date.now());
    c.wordId = null;
    const i = this.players.indexOf(c);
    if (i >= 0) this.players.splice(i, 1);
    this.quitters.push(c.id);
    if (tell) this.sendEndTo([c]);
    // An empty room must stop its clock, or the interval outlives everyone in it.
    if (this.players.length === 0) this.end();
    else this.broadcastState();
  }

  readonly quitters: string[] = [];

  private broadcastState(): void {
    const rivals = this.match.rivals();
    for (const c of this.players) c.send({ t: "wordState", you: this.match.self(c.id), rivals });
  }

  private tick(): void {
    if (this.ended) return;
    const now = Date.now();
    const moved = this.match.botTurns(now).length > 0;
    for (const b of this.match.players) {
      if (b.isBot && b.solved && !this.solvedOnce.has(b.id)) this.solvedOnce.add(b.id);
    }
    if (this.match.advance(now)) { this.end(); return; }
    if (moved) this.broadcastState();
  }

  private sendEndTo(targets: Client[]): void {
    const results = this.wireResults();
    const answer = this.match.reveal();
    for (const c of targets) {
      const mine = results.find((r) => r.id === c.id);
      if (mine && !this.paid.has(c.id)) {
        this.paid.add(c.id);
        c.record.coins += mine.coins;
      }
      c.send({ t: "wordEnd", game: this.match.game, results, answer });
      c.send({ t: "wallet", coins: c.record.coins, owned: c.record.owned });
    }
  }

  private paid = new Set<string>();

  private wireResults(): RaceResultWire[] {
    return this.match.results().map((r) => ({
      id: r.id, name: r.name, isBot: r.isBot, place: r.place,
      finished: r.solved, time: r.time, coins: r.coins, score: r.score, solved: r.solved,
    }));
  }

  private end(): void {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.timer);
    this.match.advance(Date.now() + this.match.setup.seconds * 1000);
    this.sendEndTo(this.players);
    for (const c of this.players) c.wordId = null;
    this.onDone(this, this.match.results());
  }

  /** Shut the room down without paying anyone: the server is going away. */
  dispose(): void {
    this.ended = true;
    clearInterval(this.timer);
  }
}
