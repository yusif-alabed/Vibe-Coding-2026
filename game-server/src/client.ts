import type { WebSocket } from "ws";
import { ChatRateLimiter, type HubAct, type PlayerInput, type ServerMsg } from "@beaver/shared";
import type { PlayerRecord } from "./store";

/** One connected browser. */
export class Client {
  x = 0;
  z = 0;
  ry = 0;
  lastMoveAt = Date.now();
  /** Walking time banked since the last move (see Space.move). */
  moveCredit = 0;
  /** Number of the last move the client sent that we processed (echoed so it can reconcile). */
  moveSeq = 0;
  /** Moved since the last position broadcast. */
  moved = false;
  steer = 0;
  input: PlayerInput = { steer: 0, fwd: 0, press: false };
  /** Golf round this player is in, if any. */
  golfId: string | null = null;
  /** Word Lodge round this player is in, if any. */
  wordId: string | null = null;
  /** Board Game Estate table this player is sitting at, if any. */
  boardId: string | null = null;
  /** Through the gate at the Board Game Estate. */
  estate = false;
  /** Up the gondola at the summit. */
  summit = false;
  /** What they're doing right now (dance, sing, skate…) and since when. */
  act: HubAct | null = null;
  groupAt = 0;
  readonly chatLimiter = new ChatRateLimiter();
  /** Where this client currently is. */
  hubId: string | null = null;
  raceId: string | null = null;
  /** Waiting in a lobby (its key), if any. */
  lobbyKey: string | null = null;
  /** The summit or a cabin this player is in, if any (the village is `hubId`). */
  spaceId: string | null = null;
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

  get queued() {
    return this.lobbyKey !== null;
  }

  get name() {
    return this.record.name;
  }

  send(msg: ServerMsg): void {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Sends an already-encoded message (broadcasts encode once for everyone). */
  sendRaw(json: string): void {
    // A player on a slow connection with a backlog skips position updates rather than
    // queueing them up forever (the next one supersedes them anyway).
    if (this.ws.readyState !== this.ws.OPEN) return;
    if (json.startsWith('{"t":"state"') && this.ws.bufferedAmount > 64 * 1024) return;
    this.ws.send(json);
  }

  close(): void {
    this.ws.close();
  }
}
