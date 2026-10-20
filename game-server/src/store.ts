import { randomBytes } from "node:crypto";
import { DEFAULT_LOOK, ECONOMY, newProgress, STARTER_ITEMS, type Look, type ProgressRecord } from "@beaver/shared";

/**
 * Player records held by the game server.
 *
 * Phase 2 keeps these in memory, keyed by a random session token stored in the browser,
 * so a refresh or reconnect keeps your coins and outfit. Phase 3 moves this to the API
 * service + PostgreSQL (see api/migrations) behind the same interface.
 */
export interface PlayerRecord extends ProgressRecord {
  token: string;
  name: string;
  look: Look;
  coins: number;
  owned: string[];
  blocked: Set<string>; // player ids (session-scoped)
}

export interface ModerationEvent {
  at: string;
  type: "report" | "block" | "chat_blocked" | "chat_rate_limited" | "move_rejected";
  actor: string;
  target?: string;
  detail?: string;
}

export class PlayerStore {
  private byToken = new Map<string, PlayerRecord>();
  readonly moderationLog: ModerationEvent[] = [];

  getOrCreate(token: string | undefined, name: string, look: Look): PlayerRecord {
    if (token) {
      const existing = this.byToken.get(token);
      if (existing) {
        existing.name = name;
        return existing;
      }
    }
    const rec: PlayerRecord = {
      token: randomBytes(16).toString("hex"),
      name,
      look: { ...DEFAULT_LOOK, fur: look.fur },
      coins: ECONOMY.startingCoins,
      owned: [...STARTER_ITEMS],
      blocked: new Set(),
      ...newProgress(),
    };
    this.byToken.set(rec.token, rec);
    return rec;
  }

  log(e: Omit<ModerationEvent, "at">): void {
    const event = { at: new Date().toISOString(), ...e };
    this.moderationLog.push(event);
    if (this.moderationLog.length > 5000) this.moderationLog.shift();
    if (e.type === "report") console.log(JSON.stringify({ moderation: event }));
  }
}
