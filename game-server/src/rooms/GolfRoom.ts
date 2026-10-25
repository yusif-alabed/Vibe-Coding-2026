import { GOLF_HOLES, GolfMatch, golfCoins, type Club, type GolfPlayerWire, type ServerMsg } from "@beaver/shared";
import type { Client } from "../client";

/**
 * One round of golf at the Bow Valley course. Everybody plays their own ball on the same hole at the
 * same time; the group moves on when everyone has holed out. Players can quit whenever they like.
 * Only real players tee off online; a beaver who chose to play alone plays alone.
 */
export class GolfRoom {
  readonly match: GolfMatch;
  private timer: NodeJS.Timeout;
  private ended = false;
  hubId = "";
  /** Called the first time each player finishes a hole. */
  onHole: (id: string) => void = () => {};
  private holedOnce = new Set<string>();

  constructor(
    readonly id: string,
    readonly players: Client[],
    holes: number,
    seed: number,
    private readonly onDone: (room: GolfRoom, totals: ReturnType<GolfMatch["totals"]>) => void,
  ) {
    const entrants = players.map((c) => ({ id: c.id, name: c.name, isBot: false }));
    this.match = new GolfMatch(holes, entrants, seed);
    for (const c of players) c.golfId = id;
    this.broadcast({ t: "golfStart", holes: this.match.holes, players: this.wire() });
    this.timer = setInterval(() => this.tick(), 250);
  }

  wire(): GolfPlayerWire[] {
    return this.match.players.map((p) => ({
      id: p.id, name: p.name, isBot: p.isBot, ball: p.ball, strokes: [...p.strokes], done: p.done, quit: p.quit,
      look: this.players.find((c) => c.id === p.id)?.record.look ?? null,
    }));
  }

  shot(c: Client, aim: number, power: number, club: Club): void {
    const now = Date.now();
    const r = this.match.shoot(c.id, Number(aim), Number(power), club, now);
    if (!r) return;
    const p = this.match.players.find((x) => x.id === c.id)!;
    if (p.done && !this.holedOnce.has(c.id)) { this.holedOnce.add(c.id); this.onHole(c.id); }
    this.broadcast({ t: "golfShot", id: c.id, club, path: r.path, holed: r.holed, penalty: r.penalty, lie: r.lie, strokes: this.match.strokes(p) });
  }

  aim(c: Client, aim: number, club: Club): void {
    if (!Number.isFinite(aim)) return;
    for (const o of this.players) if (o !== c) o.send({ t: "golfAim", id: c.id, aim, club });
  }

  quit(c: Client): void {
    this.match.quit(c.id, Date.now());
    // You keep the coins for the holes you finished.
    const totals = this.match.totals().map((t) => ({ ...t, coins: t.isBot ? 0 : golfCoins(t.holes, t.toPar, t.quit) }));
    const mine = totals.find((t) => t.id === c.id);
    if (mine) c.record.coins += mine.coins;
    c.send({ t: "golfEnd", totals });
    c.send({ t: "wallet", coins: c.record.coins, owned: c.record.owned });
    this.quitters.push(c.id);
    const i = this.players.indexOf(c);
    if (i >= 0) this.players.splice(i, 1);
    c.golfId = null;
    this.broadcast({ t: "golfState", idx: this.match.idx, players: this.wire(), nextAt: this.match.nextAt });
    if (this.players.length === 0) this.end();
  }

  private tick(): void {
    const now = Date.now();
    const waiting = this.match.nextAt;
    if (this.match.advance(now)) {
      if (this.match.over) this.end();
      else this.broadcast({ t: "golfState", idx: this.match.idx, players: this.wire(), nextAt: 0 });
    } else if (waiting && !this.sentWait) {
      this.sentWait = true;
      this.broadcast({ t: "golfState", idx: this.match.idx, players: this.wire(), nextAt: waiting });
    }
    if (!this.match.nextAt) this.sentWait = false;
  }
  private sentWait = false;
  readonly quitters: string[] = [];

  private end(): void {
    if (this.ended) return;
    this.ended = true;
    clearInterval(this.timer);
    const totals = this.match.totals().map((t) => ({ ...t, coins: t.isBot ? 0 : golfCoins(t.holes, t.toPar, t.quit) }));
    for (const c of this.players) {
      const mine = totals.find((t) => t.id === c.id);
      if (mine) c.record.coins += mine.coins;
      c.send({ t: "golfEnd", totals });
      c.send({ t: "wallet", coins: c.record.coins, owned: c.record.owned });
      c.golfId = null;
    }
    this.onDone(this, this.match.totals());
  }

  private broadcast(msg: ServerMsg): void {
    const json = JSON.stringify(msg);
    for (const c of this.players) c.sendRaw(json);
  }

  dispose(): void {
    clearInterval(this.timer);
  }

  static holeCount() {
    return GOLF_HOLES.length;
  }
}
