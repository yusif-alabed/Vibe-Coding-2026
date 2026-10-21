import {
  HUB,
  randomSpawn,
  validateMove,
  type HubAct,
  type RoomInfo,
} from "@beaver/shared";
import type { Client } from "../client";
import type { PlayerStore } from "../store";
import { Space } from "./Space";

/**
 * The social village. Holds up to HUB.capacity beavers, relays chat/emotes,
 * and broadcasts validated positions at HUB.tickRate.
 */
export class HubRoom extends Space {
  constructor(
    readonly info: RoomInfo,
    store: PlayerStore,
  ) {
    super(info.id, store, validateMove);
  }

  get full() {
    return this.clients.size >= HUB.capacity;
  }

  add(c: Client, spawn?: { x: number; z: number }): void {
    const s = spawn ?? randomSpawn();
    c.hubId = this.info.id;
    this.enter(c, s);
    c.send({
      t: "welcome",
      you: c.id,
      token: c.record.token,
      room: this.info,
      players: [...this.clients.values()].map((o) => this.playerInfo(o)),
      coins: c.record.coins,
      owned: c.record.owned,
      look: c.record.look,
    });
  }

  remove(c: Client): void {
    if (!this.leave(c)) return;
    c.hubId = null;
  }

  act(c: Client, a: HubAct): void {
    c.act = a === "stop" ? null : a;
    this.broadcast({ t: "act", id: c.id, a });
  }
}
