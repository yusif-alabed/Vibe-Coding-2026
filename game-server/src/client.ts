import type { WebSocket } from "ws";
import { ChatRateLimiter, type HubAct, type PlayerInput, type ServerMsg } from "@beaver/shared";
import type { PlayerRecord } from "./store";

/** One connected browser. */
export class Client {
  x = 0;
  z = 0;
  ry = 0;
  lastMoveAt = Date.now();
  steer = 0;
  input: PlayerInput = { steer: 0, fwd: 0, press: false };
  /** Golf round this player is in, if any. */
  golfId: string | null = null;
  /** Word Lodge round this player is in, if any. */
  wordId: string | null = null;
  /** Up the gondola at the summit. */
  summit = false;
  /** What they're doing right now (dance, sing, skate…) and since when. */
  act: HubAct | null = null;
  groupAt = 0;
  readonly chatLimiter = new ChatRateLimiter();
  /** Where this client currently is. */
  hubId: string | null = null;
  raceId: string | null = null;
  queued = false;
  /** Whose cabin this player is in (their own id, or a friend's), if any. */
  cabinOf: string | null = null;
  returnHubId: string | null = null;
  returnPos: { x: number; z: number } | null = null;
  /** Last landmark counted for a "visit" quest, so standing still doesn't count twice. */
  lastVisit: string | null = null;

  constructor(
    readonly id: string,
    private readonly ws: WebSocket,
    readonly record: PlayerRecord,
  ) {}

  get name() {
    return this.record.name;
  }

  send(msg: ServerMsg): void {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.ws.close();
  }
}
