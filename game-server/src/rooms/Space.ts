import {
  EMOTES,
  filterChat,
  HUB,
  QUICK_CHAT,
  type PlayerInfo,
  type Pos,
  type ServerMsg,
} from "@beaver/shared";
import type { Client } from "../client";
import type { PlayerStore } from "../store";

/**
 * Somewhere beavers can see each other: the village, the summit, a cabin. Tracks who's here,
 * validates their movement, relays chat and emotes, and broadcasts positions at HUB.tickRate.
 * What a beaver sees on arrival is up to the caller (the village sends a `welcome`, the summit
 * a `summit`, a cabin its layout).
 */
export class Space {
  readonly clients = new Map<string, Client>();
  private timer: NodeJS.Timeout;
  private dirty = false;

  constructor(
    readonly id: string,
    protected readonly store: PlayerStore,
    /** Turns a proposed move into an allowed one. */
    private readonly validate: (prev: Pos, next: Pos, dtMs: number) => Pos,
  ) {
    this.timer = setInterval(() => this.tick(), 1000 / HUB.tickRate);
  }

  playerInfo(c: Client): PlayerInfo {
    const club = c.record.club ? { tag: c.record.club.tag, color: c.record.club.color } : null;
    return { id: c.id, name: c.name, look: c.record.look, x: c.x, z: c.z, ry: c.ry, pid: c.record.pid, club };
  }

  /** Everyone here apart from `c`. */
  others(c: Client): PlayerInfo[] {
    return [...this.clients.values()].filter((o) => o !== c).map((o) => this.playerInfo(o));
  }

  /** Puts `c` in this space at `at` and tells everyone else. */
  enter(c: Client, at: { x: number; z: number; ry?: number }): void {
    c.x = at.x;
    c.z = at.z;
    c.ry = at.ry ?? 0;
    c.lastMoveAt = Date.now();
    this.clients.set(c.id, c);
    this.broadcast({ t: "joined", p: this.playerInfo(c) }, c.id);
  }

  /** Returns false if they weren't here. */
  leave(c: Client): boolean {
    if (!this.clients.delete(c.id)) return false;
    c.act = null;
    this.broadcast({ t: "left", id: c.id });
    return true;
  }

  move(c: Client, x: number, z: number, ry: number): void {
    const now = Date.now();
    const next = this.validate({ x: c.x, z: c.z }, { x, z }, now - c.lastMoveAt);
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
