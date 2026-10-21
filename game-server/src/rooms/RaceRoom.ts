import { ARCADE_INFO, BOT_NAMES, coinsForGame, coinsForRace, makeSim, RACE, type GameSim, type MiniGame, type PlayerInput, type RaceSnapshot, type ScoreResult, type ServerMsg } from "@beaver/shared";
import type { Client } from "../client";

/**
 * A dedicated room for one minigame round (Toboggan Rush, Canoe Dash, Pinecone Hunt, Log Rolling,
 * Snowball Fight or Dam Builder), isolated from the hub. Empty seats are filled with bot beavers so
 * a round can always start. The server runs the simulation and decides results and coin rewards.
 */
export class RaceRoom {
  readonly sim: GameSim;
  private timer: NodeJS.Timeout | null = null;
  private startTimer: NodeJS.Timeout;
  private finished = false;
  /** Final standings, kept so the server can count daily-quest progress. */
  results: (ScoreResult & { coins: number })[] = [];

  constructor(
    readonly id: string,
    readonly players: Client[],
    seed: number,
    private readonly onDone: (room: RaceRoom) => void,
    readonly game: MiniGame = "toboggan",
  ) {
    const size = game === "dam" ? Math.max(2, players.length) : game === "snowball" ? 4 : RACE.size;
    const bots = Math.max(0, size - players.length);
    const entrants = [
      ...players.map((c) => ({ id: c.id, name: c.name, isBot: false })),
      ...Array.from({ length: bots }, (_, i) => ({ id: `bot-${id}-${i}`, name: BOT_NAMES[(seed + i) % BOT_NAMES.length], isBot: true })),
    ];
    this.sim = makeSim(game, seed, entrants);
    for (const c of players) {
      c.raceId = id;
      c.steer = 0;
      c.input = { steer: 0, fwd: 0, press: false };
    }
    const looks = entrants.map((e) => ({ id: e.id, name: e.name, isBot: e.isBot, look: players.find((p) => p.id === e.id)?.record.look ?? null }));
    if (this.isRace) this.broadcast({ t: "raceStart", game: game as "toboggan" | "canoe", seed, countdownMs: RACE.countdownMs, racers: looks });
    else this.broadcast({ t: "gameStart", game, seed, countdownMs: RACE.countdownMs, players: looks });
    this.startTimer = setTimeout(() => this.run(), RACE.countdownMs);
  }

  get isRace() {
    return this.game === "toboggan" || this.game === "canoe";
  }

  steer(c: Client, v: number): void {
    c.steer = Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0;
    c.input.steer = c.steer;
  }

  input(c: Client, steer: number, fwd: number, press: boolean): void {
    const k = (v: number) => (Number.isFinite(v) ? Math.max(-1, Math.min(1, v)) : 0);
    c.input = { steer: k(steer), fwd: k(fwd), press: c.input.press || !!press };
    c.steer = c.input.steer;
  }

  private run(): void {
    const dt = 1 / RACE.tickRate;
    this.timer = setInterval(() => {
      const inputs: Record<string, PlayerInput> = {};
      for (const c of this.players) {
        inputs[c.id] = { ...c.input };
        c.input.press = false; // a press counts once
      }
      this.sim.step(dt, inputs);
      const time = Math.round(this.sim.t * 100) / 100;
      if (this.isRace) this.broadcast({ t: "race", time, r: this.sim.snapshot() as RaceSnapshot });
      else this.broadcast({ t: "game", time, s: this.sim.snapshot() });
      if (this.sim.isOver()) this.finish();
    }, 1000 / RACE.tickRate);
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.timer) clearInterval(this.timer);
    const n = this.sim.results().length;
    const results = this.sim.results().map((r) => ({
      ...r,
      coins: r.isBot ? 0 : this.isRace ? coinsForRace({ place: r.place, finished: r.finished, racers: n }) : coinsForGame(this.game, r, this.players.length),
    }));
    this.results = results;
    for (const c of this.players) {
      const mine = results.find((r) => r.id === c.id);
      if (mine) c.record.coins += mine.coins;
      if (this.isRace) c.send({ t: "raceEnd", results });
      else c.send({ t: "gameEnd", game: this.game, results });
      c.send({ t: "wallet", coins: c.record.coins, owned: c.record.owned });
      c.raceId = null;
    }
    this.onDone(this);
  }

  /** A player disconnected: they stop moving but stay in the standings. */
  drop(c: Client): void {
    c.steer = 0;
    c.input = { steer: 0, fwd: 0, press: false };
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

  static info(game: MiniGame) {
    return ARCADE_INFO[game];
  }
}
