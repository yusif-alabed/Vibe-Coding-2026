import { BOT_NAMES, coinsForRace, RACE, TobogganRace, type ServerMsg } from "@beaver/shared";
import type { Client } from "../client";

/**
 * A dedicated room for one Toboggan Rush race, isolated from the hub.
 * Empty seats are filled with bot beavers so a race can always start.
 * The server runs the simulation and decides results and coin rewards.
 */
export class RaceRoom {
  readonly race: TobogganRace;
  private timer: NodeJS.Timeout | null = null;
  private startTimer: NodeJS.Timeout;
  private finished = false;

  constructor(
    readonly id: string,
    readonly players: Client[],
    seed: number,
    private readonly onDone: (room: RaceRoom) => void,
  ) {
    const bots = Math.max(0, RACE.size - players.length);
    const entrants = [
      ...players.map((c) => ({ id: c.id, name: c.name, isBot: false })),
      ...Array.from({ length: bots }, (_, i) => ({ id: `bot-${id}-${i}`, name: BOT_NAMES[(seed + i) % BOT_NAMES.length], isBot: true })),
    ];
    this.race = new TobogganRace(seed, entrants);
    for (const c of players) {
      c.raceId = id;
      c.steer = 0;
    }
    this.broadcast({
      t: "raceStart",
      seed,
      countdownMs: RACE.countdownMs,
      racers: entrants.map((e) => ({
        id: e.id,
        name: e.name,
        isBot: e.isBot,
        look: players.find((p) => p.id === e.id)?.record.look ?? null,
      })),
    });
    this.startTimer = setTimeout(() => this.run(), RACE.countdownMs);
  }

  steer(c: Client, v: number): void {
    c.steer = Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
  }

  private run(): void {
    const dt = 1 / RACE.tickRate;
    this.timer = setInterval(() => {
      const inputs: Record<string, number> = {};
      for (const c of this.players) inputs[c.id] = c.steer;
      this.race.step(dt, inputs);
      this.broadcast({ t: "race", time: Math.round(this.race.t * 100) / 100, r: this.race.snapshot() });
      if (this.race.isOver()) this.finish();
    }, 1000 / RACE.tickRate);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.timer) clearInterval(this.timer);
    const racers = this.race.racers.length;
    const results = this.race.results().map((r) => ({
      ...r,
      coins: r.isBot ? 0 : coinsForRace({ place: r.place, finished: r.finished, racers }),
    }));
    for (const c of this.players) {
      const mine = results.find((r) => r.id === c.id);
      if (mine) c.record.coins += mine.coins;
      c.send({ t: "raceEnd", results });
      c.send({ t: "wallet", coins: c.record.coins, owned: c.record.owned });
      c.raceId = null;
    }
    this.onDone(this);
  }

  /** A player disconnected: their sled stops steering but stays in the standings. */
  drop(c: Client): void {
    c.steer = 0;
    const i = this.players.indexOf(c);
    if (i >= 0) this.players.splice(i, 1);
  }

  private broadcast(msg: ServerMsg): void {
    for (const c of this.players) c.send(msg);
  }

  dispose(): void {
    clearTimeout(this.startTimer);
    if (this.timer) clearInterval(this.timer);
  }
}
