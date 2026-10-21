import { randomBytes, randomInt } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { DEFAULT_LOOK, ECONOMY, newProgress, STARTER_ITEMS, type Look, type PlayerRecordLike } from "@beaver/shared";

/**
 * Player records held by the game server.
 *
 * Records are keyed by a random session token kept in the browser, so a refresh keeps your coins,
 * outfit, cabin and quests. They are also saved to a JSON file (DATA_FILE, default
 * ./data/players.json) so a server restart doesn't lose anyone's progress, and each player gets a
 * secret recovery code to move their beaver to another device, plus a public friend code.
 * (The API service + PostgreSQL in /api can replace this file store behind the same interface.)
 */
export interface ClubInfo { code: string; name: string; tag: string; color: string }

export interface PlayerRecord extends PlayerRecordLike {
  token: string;
  /** Stable public id used for friends and parties (never the token). */
  pid: string;
  /** Short code you can give someone so they can add you as a friend. */
  friendCode: string;
  /** Secret code to sign in on another device. */
  recoveryCode: string;
  name: string;
  look: Look;
  coins: number;
  owned: string[];
  friends: string[];
  blocked: Set<string>; // player ids (session-scoped)
  club?: ClubInfo | null;
  /** Who liked your cabin this week. */
  cabinLikes?: { week: string; pids: string[] };
  guestbook?: { name: string; stamp: number; at: number }[];
}

export interface ModerationEvent {
  at: string;
  type: "report" | "block" | "chat_blocked" | "chat_rate_limited" | "move_rejected";
  actor: string;
  target?: string;
  detail?: string;
}

const CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const code = (n: number) => Array.from({ length: n }, () => CODE[randomInt(CODE.length)]).join("");

export class PlayerStore {
  private byToken = new Map<string, PlayerRecord>();
  private byPid = new Map<string, PlayerRecord>();
  private byFriendCode = new Map<string, PlayerRecord>();
  private byRecovery = new Map<string, PlayerRecord>();
  readonly moderationLog: ModerationEvent[] = [];
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private readonly file: string | null = null) {
    this.load();
  }

  getOrCreate(token: string | undefined, name: string, look: Look, recovery?: string): PlayerRecord {
    const recovered = recovery ? this.byRecovery.get(String(recovery).toUpperCase().replace(/[^A-Z0-9]/g, "")) : undefined;
    const existing = recovered ?? (token ? this.byToken.get(token) : undefined);
    if (existing) {
      existing.name = name;
      this.markDirty();
      return existing;
    }
    const rec: PlayerRecord = {
      token: randomBytes(16).toString("hex"),
      pid: randomBytes(6).toString("hex"),
      friendCode: this.unique(this.byFriendCode, 6),
      recoveryCode: this.unique(this.byRecovery, 10),
      name,
      look: { ...DEFAULT_LOOK, fur: look.fur },
      coins: ECONOMY.startingCoins,
      owned: [...STARTER_ITEMS],
      friends: [],
      blocked: new Set(),
      ...newProgress(),
    };
    this.index(rec);
    this.markDirty();
    return rec;
  }

  all(): IterableIterator<PlayerRecord> {
    return this.byToken.values();
  }

  byPlayerId(pid: string): PlayerRecord | undefined {
    return this.byPid.get(pid);
  }

  byCode(friendCode: string): PlayerRecord | undefined {
    return this.byFriendCode.get(String(friendCode).toUpperCase().replace(/[^A-Z0-9]/g, ""));
  }

  private unique(map: Map<string, PlayerRecord>, n: number): string {
    let c: string;
    do c = code(n); while (map.has(c));
    return c;
  }

  private index(rec: PlayerRecord) {
    this.byToken.set(rec.token, rec);
    this.byPid.set(rec.pid, rec);
    this.byFriendCode.set(rec.friendCode, rec);
    this.byRecovery.set(rec.recoveryCode, rec);
  }

  /** Call after changing a record; saves are batched. */
  markDirty(): void {
    if (!this.file || this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      this.save();
    }, 5000);
  }

  save(): void {
    if (!this.file) return;
    try {
      mkdirSync(dirname(this.file), { recursive: true });
      const data = [...this.byToken.values()].map((r) => ({ ...r, blocked: [...r.blocked] }));
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(data));
      renameSync(tmp, this.file);
    } catch (e) {
      console.error("Could not save players:", e);
    }
  }

  private load(): void {
    if (!this.file) return;
    let raw: string;
    try {
      raw = readFileSync(this.file, "utf8");
    } catch {
      return; // first run
    }
    try {
      const list = JSON.parse(raw) as (Omit<PlayerRecord, "blocked"> & { blocked?: string[] })[];
      for (const r of list) {
        const rec: PlayerRecord = {
          ...newProgress(),
          ...r,
          friends: r.friends ?? [],
          pid: r.pid ?? randomBytes(6).toString("hex"),
          friendCode: r.friendCode ?? this.unique(this.byFriendCode, 6),
          recoveryCode: r.recoveryCode ?? this.unique(this.byRecovery, 10),
          blocked: new Set(r.blocked ?? []),
        };
        this.index(rec);
      }
      console.log(`Loaded ${list.length} players from ${this.file}`);
    } catch (e) {
      console.error("Could not read players file:", e);
    }
  }

  flush(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    this.save();
  }

  log(e: Omit<ModerationEvent, "at">): void {
    const event = { at: new Date().toISOString(), ...e };
    this.moderationLog.push(event);
    if (this.moderationLog.length > 5000) this.moderationLog.shift();
    if (e.type === "report") console.log(JSON.stringify({ moderation: event }));
  }
}
