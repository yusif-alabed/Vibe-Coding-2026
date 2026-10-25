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
/** Most walking time a beaver can bank (so a network hiccup never costs them ground). */
const MOVE_CREDIT_MS = 1500;

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
    // Moves arrive in bursts on real networks (two packets 5 ms apart after a 150 ms hiccup).
    // Judging each one against the gap since the last would clamp the burst, leave the server
    // behind the player and rubber-band them. Instead each beaver earns walking time as the clock
    // runs (up to a cap) and spends it on distance, so a burst is fine but speed-hacking isn't.
    c.moveCredit = Math.min(MOVE_CREDIT_MS, c.moveCredit + Math.max(0, now - c.lastMoveAt));
    c.lastMoveAt = now;
    const next = this.validate({ x: c.x, z: c.z }, { x, z }, c.moveCredit);
    const walked = Math.hypot(next.x - c.x, next.z - c.z);
    c.moveCredit = Math.max(0, c.moveCredit - (walked / (HUB.maxSpeed * HUB.speedTolerance)) * 1000);
    const corrected = Math.hypot(next.x - x, next.z - z) > 0.75;
    const ryOk = Number.isFinite(ry) ? ry : c.ry;
    if (walked < 0.005 && Math.abs(ryOk - c.ry) < 0.01) return; // nothing changed: nothing to send
    c.x = next.x;
    c.z = next.z;
    c.ry = ryOk;
    c.moved = true;
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
      if (o.record.blocked.has(c.record.pid)) continue;
      o.send(msg);
    }
  }

  broadcast(msg: ServerMsg, exceptId?: string): void {
    const json = JSON.stringify(msg);
    for (const o of this.clients.values()) if (o.id !== exceptId) o.sendRaw(json);
  }

  private ticks = 0;

  private tick(): void {
    this.ticks++;
    // Once a second everyone gets the full list (heals anything a dropped packet missed);
    // in between only the beavers who actually moved are sent, which keeps busy villages light.
    const full = this.ticks % HUB.tickRate === 0;
    if (!this.dirty && !full) return;
    this.dirty = false;
    const p: [string, number, number, number][] = [];
    for (const c of this.clients.values()) {
      if (!full && !c.moved) continue;
      c.moved = false;
      p.push([c.id, Math.round(c.x * 100) / 100, Math.round(c.z * 100) / 100, Math.round(c.ry * 100) / 100]);
    }
    if (p.length) this.broadcast({ t: "state", p, ts: Date.now() });
  }

  dispose(): void {
    clearInterval(this.timer);
  }
}
