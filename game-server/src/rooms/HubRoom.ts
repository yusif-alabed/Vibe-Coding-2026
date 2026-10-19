import {
  EMOTES,
  filterChat,
  HUB,
  QUICK_CHAT,
  randomSpawn,
  validateMove,
  type PlayerInfo,
  type RoomInfo,
  type ServerMsg,
} from "@beaver/shared";
import type { Client } from "../client";
import type { PlayerStore } from "../store";

/**
 * The social village. Holds up to HUB.capacity beavers, relays chat/emotes,
 * and broadcasts validated positions at HUB.tickRate.
 */
export class HubRoom {
  readonly clients = new Map<string, Client>();
  private timer: NodeJS.Timeout;
  private dirty = false;

  constructor(
    readonly info: RoomInfo,
    private readonly store: PlayerStore,
  ) {
    this.timer = setInterval(() => this.tick(), 1000 / HUB.tickRate);
  }

  get full() {
    return this.clients.size >= HUB.capacity;
  }

  playerInfo(c: Client): PlayerInfo {
    return { id: c.id, name: c.name, look: c.record.look, x: c.x, z: c.z, ry: c.ry };
  }

  add(c: Client, spawn?: { x: number; z: number }): void {
    const s = spawn ?? randomSpawn();
    c.x = s.x;
    c.z = s.z;
    c.ry = 0;
    c.lastMoveAt = Date.now();
    c.hubId = this.info.id;
    this.clients.set(c.id, c);
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
    this.broadcast({ t: "joined", p: this.playerInfo(c) }, c.id);
  }

  remove(c: Client): void {
    if (!this.clients.delete(c.id)) return;
    c.hubId = null;
    this.broadcast({ t: "left", id: c.id });
  }

  move(c: Client, x: number, z: number, ry: number): void {
    const now = Date.now();
    const next = validateMove({ x: c.x, z: c.z }, { x, z }, now - c.lastMoveAt);
    const corrected = Math.hypot(next.x - x, next.z - z) > 0.75;
    c.x = next.x;
    c.z = next.z;
    c.ry = Number.isFinite(ry) ? ry : c.ry;
    c.lastMoveAt = now;
    this.dirty = true;
    if (corrected) this.store.log({ type: "move_rejected", actor: c.id });
  }

  chat(c: Client, text: string): void {
    const r = filterChat(String(text ?? ""));
    if (!r.ok) {
      if (r.reason === "personal_info") {
        c.send({ t: "system", text: "For safety, don't share emails, phone numbers or links." });
        this.store.log({ type: "chat_blocked", actor: c.id, detail: r.reason });
      }
      return;
    }
    if (!c.chatLimiter.allow(r.text)) {
      c.send({ t: "system", text: "Slow down a little! 🦫" });
      this.store.log({ type: "chat_rate_limited", actor: c.id });
      return;
    }
    this.sayAs(c, r.text);
  }

  quick(c: Client, i: number): void {
    const text = QUICK_CHAT[i];
    if (!text || !c.chatLimiter.allow(text)) return;
    this.sayAs(c, text);
  }

  emote(c: Client, i: number): void {
    if (!EMOTES[i]) return;
    this.broadcast({ t: "emote", id: c.id, i });
  }

  updateLook(c: Client): void {
    this.broadcast({ t: "look", id: c.id, look: c.record.look });
  }

  private sayAs(c: Client, text: string): void {
    const msg: ServerMsg = { t: "chat", id: c.id, name: c.name, text };
    for (const o of this.clients.values()) {
      // Blocked players' messages never reach the person who blocked them.
      if (o.record.blocked.has(c.id)) continue;
      o.send(msg);
    }
  }

  broadcast(msg: ServerMsg, exceptId?: string): void {
    for (const o of this.clients.values()) if (o.id !== exceptId) o.send(msg);
  }

  private tick(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const p = [...this.clients.values()].map(
      (c) => [c.id, Math.round(c.x * 100) / 100, Math.round(c.z * 100) / 100, Math.round(c.ry * 100) / 100] as [string, number, number, number],
    );
    this.broadcast({ t: "state", p });
  }

  dispose(): void {
    clearInterval(this.timer);
  }
}
