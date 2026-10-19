import type { WebSocket } from "ws";
import { ChatRateLimiter, type ServerMsg } from "@beaver/shared";
import type { PlayerRecord } from "./store";

/** One connected browser. */
export class Client {
  x = 0;
  z = 0;
  ry = 0;
  lastMoveAt = Date.now();
  steer = 0;
  readonly chatLimiter = new ChatRateLimiter();
  /** Where this client currently is. */
  hubId: string | null = null;
  raceId: string | null = null;
  queued = false;

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
