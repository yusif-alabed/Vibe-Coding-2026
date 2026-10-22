import { randomBytes, randomInt } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  actAllowed,
  ARCADE_INFO,
  GAME_SPOTS,
  GROUP_ACTS,
  handleLife,
  ITEMS,
  leaderRows,
  lifeWire,
  recordBest,
  isLeaderGame,
  isWordGame,
  parseWordAction,
  recordEvent,
  recordVisit,
  takeItem,
  giveItem,
  TOWN_PLACES,
  weekKey,
  type LifeEvent,
  type LeaderGame,
  type MiniGame,
  type WordGame,
  type Club,
  type CabinSocial,
  buyFurniture,
  collectPinecone,
  FURNITURE_BY_ID,
  pineconesWire,
  questEvent,
  questsWire,
  validateLayout,
  visitedPlace,
  seasonAt,
  ACT_QUEST,
  type QuestEvent,
  CATALOG_BY_ID,
  DEFAULT_LOOK,
  HUB_PLACES,
  NAME_MAX,
  PORTAL_RADIUS,
  purchase,
  LOBBY,
  minPlayers,
  sanitizeLook,
  validateMoveIn,
  WORD_INFO,
  type ClientMsg,
  type LobbyWire,
  type RaceGame,
  handleCasino,
  isBoardGame,
  parseBoardAction,
  BOARD_INFO,
  type BoardGame,
} from "@beaver/shared";
import { Client } from "./client";
import { HubRoom } from "./rooms/HubRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { GolfRoom } from "./rooms/GolfRoom";
import { WordRoom } from "./rooms/WordRoom";
import { Space } from "./rooms/Space";
import { BoardRoom } from "./rooms/BoardRoom";
import { PlayerStore, type PlayerRecord } from "./store";

const CLUB_COLORS = ["#e2483d", "#2fa7a2", "#f5c242", "#a77bff", "#ff7eb3", "#4c8cff", "#6fbf4a", "#ff9a3c"];
/** Where you step off the gondola at the summit, and how far the plateau reaches. */
const SUMMIT_ARRIVAL = { x: -15, z: 16, ry: Math.PI };
const SUMMIT_RADIUS = 34;
/** Cabins are small: anything further than this from the middle is outside the walls. */
const CABIN_RADIUS = 12;
const CABIN_DOOR = { x: 0, z: 4.6 };
/** Just inside the Board Game Estate's gates, and how far its lawn reaches (matches the client's estate scene). */
const ESTATE_ARRIVAL = { x: 0, z: 32, ry: Math.PI };
const ESTATE_RADIUS = 44;

/**
 * Real players waiting for a round. There are no bots online, so a lobby waits for company:
 * the countdown starts when a second beaver joins, and a full lobby starts straight away.
 * Anyone in it can start early (or play alone, where the game allows it).
 */
type Lobby = {
  key: string;
  hubId: string;
  players: Client[];
  size: number;
  min: number;
  timer: NodeJS.Timeout | null;
  startsAt: number | null;
} & ({ kind: "mini"; game: MiniGame } | { kind: "golf"; holes: number } | { kind: "word"; game: WordGame } | { kind: "board"; game: BoardGame });

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

interface Party {
  id: string;
  leader: string;
  members: string[];
}

export class GameServer {
  readonly store: PlayerStore;
  private parties = new Map<string, Party>();
  /** Pending friend and party invites: target pid → set of sender pids. */
  private pendingFriend = new Map<string, Set<string>>();
  private pendingParty = new Map<string, Set<string>>();
  readonly hubs = new Map<string, HubRoom>();
  readonly races = new Map<string, RaceRoom>();
  readonly golfs = new Map<string, GolfRoom>();
  readonly words = new Map<string, WordRoom>();
  readonly lobbies = new Map<string, Lobby>();
  /** The summits and the cabins with someone in them. */
  readonly spaces = new Map<string, Space>();
  readonly boards = new Map<string, BoardRoom>();
  private clients = new Map<WebSocket, Client>();
  private wss: WebSocketServer;
  private publicCount = 0;

  constructor(server: HttpServer, opts: { dataFile?: string | null } = {}) {
    this.store = new PlayerStore(opts.dataFile ?? null);
    this.wss = new WebSocketServer({ server, maxPayload: 4096 });
    this.wss.on("connection", (ws) => this.onConnection(ws));
  }

  stats() {
    return {
      hubs: [...this.hubs.values()].map((h) => ({ id: h.info.id, private: h.info.isPrivate, players: h.clients.size })),
      races: this.races.size,
      connections: this.clients.size,
    };
  }

  private onConnection(ws: WebSocket): void {
    let joined = false;
    ws.on("message", (data) => {
      let msg: ClientMsg;
      try {
        msg = JSON.parse(String(data));
      } catch {
        return;
      }
      if (!msg || typeof msg !== "object" || typeof msg.t !== "string") return;
      if (!joined) {
        if (msg.t !== "join") return;
        joined = this.handleJoin(ws, msg);
        return;
      }
      const c = this.clients.get(ws);
      if (c) {
        this.handle(c, msg);
        if (msg.t !== "move" && msg.t !== "steer" && msg.t !== "input" && msg.t !== "ping" && msg.t !== "golfAim") this.store.markDirty();
      }
    });
    ws.on("close", () => this.onClose(ws));
    ws.on("error", () => ws.close());
  }

  private handleJoin(ws: WebSocket, msg: Extract<ClientMsg, { t: "join" }>): boolean {
    const name = String(msg.name ?? "").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, NAME_MAX) || "Beaver";
    const record = this.store.getOrCreate(msg.token, name, { ...DEFAULT_LOOK, ...(msg.look ?? {}) }, msg.recovery);
    // Only one connection per player: a newer one (e.g. another device) replaces the old.
    for (const [oldWs, other] of this.clients) if (other.record === record) { other.send({ t: "system", text: "You signed in somewhere else." }); oldWs.close(); }
    record.look = sanitizeLook(msg.look, record.owned, record.look.fur);
    const c = new Client(randomBytes(6).toString("hex"), ws, record);
    this.clients.set(ws, c);

    let hub: HubRoom | undefined;
    const want = msg.room ?? "public";
    if (want === "private-new") {
      hub = this.createHub(true);
    } else if (want !== "public") {
      hub = [...this.hubs.values()].find((h) => h.info.code === String(want).toUpperCase());
      if (!hub) c.send({ t: "system", text: `No room with code ${String(want).toUpperCase()} — sending you to the public village.` });
    }
    if (!hub || hub.full) hub = this.publicHub();
    this.joinHub(c, hub);
    c.send({ t: "account", pid: record.pid, friendCode: record.friendCode, recoveryCode: record.recoveryCode });
    this.sendFriends(c);
    this.notifyFriends(c);
    const party = this.partyOf(record.pid);
    if (party) this.sendParty(party);
    if (hub.info.isPrivate) c.send({ t: "system", text: `Private room code: ${hub.info.code}. Share it with friends!` });
    return true;
  }

  private handle(c: Client, msg: ClientMsg): void {
    const hub = c.hubId ? this.hubs.get(c.hubId) : undefined;
    const race = c.raceId ? this.races.get(c.raceId) : undefined;
    /** Wherever beavers can see each other: the village, the summit, a cabin. */
    const here: Space | undefined = hub ?? (c.spaceId ? this.spaces.get(c.spaceId) : undefined);
    switch (msg.t) {
      case "move": {
        if (!hub) {
          here?.move(c, Number(msg.x), Number(msg.z), Number(msg.ry));
          break;
        }
        hub.move(c, Number(msg.x), Number(msg.z), Number(msg.ry));
        const place = visitedPlace(c.x, c.z);
        if (place && place !== c.lastVisit) this.sendAll(c, recordVisit(c.record, c.record.token, place));
        c.lastVisit = place;
        break;
      }
      case "chat":
        here?.chat(c, msg.text);
        break;
      case "quick":
        if (!here) break;
        here.quick(c, Number(msg.i));
        this.progress(c, { kind: "quickchat" });
        break;
      case "emote":
        if (!here) break;
        here.emote(c, Number(msg.i));
        this.progress(c, { kind: "emote" });
        break;
      case "act": {
        if (!hub) break;
        const a = msg.a;
        if (!actAllowed(a, c.x, c.z)) break;
        hub.act(c, a);
        if (a === "stop") break;
        const kind = ACT_QUEST[a];
        if (kind) this.progress(c, { kind });
        this.life(c, { kind: "act", a });
        this.checkGroup(c, hub);
        break;
      }
      case "look":
        c.record.look = sanitizeLook(msg.look, c.record.owned, c.record.look.fur);
        here?.updateLook(c);
        break;
      case "buy": {
        const item = CATALOG_BY_ID[String(msg.item)];
        const r = purchase({ coins: c.record.coins, owned: c.record.owned }, String(msg.item));
        if (r.ok) {
          c.record.coins = r.wallet.coins;
          c.record.owned = r.wallet.owned;
          c.send({ t: "wallet", coins: c.record.coins, owned: c.record.owned });
          c.send({ t: "system", text: `You bought the ${item.name}! 🎉` });
          this.progress(c, { kind: "buy" });
        } else {
          const why = r.reason === "not_enough_coins" ? "Not enough coins yet — try a toboggan race!" : "You can't buy that.";
          c.send({ t: "error", text: why });
        }
        break;
      }
      case "queueRace":
        if (hub) this.queueMini(c, hub, msg.game === "canoe" ? "canoe" : "toboggan");
        break;
      case "queueGame":
        if (hub && Object.hasOwn(ARCADE_INFO, String(msg.game))) this.queueMini(c, hub, msg.game);
        break;
      case "lobbyStart":
        this.startLobbyNow(c);
        break;
      case "lobbyJoin": {
        if (hub) { this.joinOpenLobby(c, hub, String(msg.key)); break; }
        // On the estate lawn: sit down at a table someone else is waiting at.
        const l = this.lobbies.get(String(msg.key));
        if (c.estate && l?.kind === "board" && l.hubId === c.spaceId) this.queueBoard(c, l.game);
        break;
      }
      case "lobbyLeave":
        this.leaveLobby(c);
        break;
      case "input":
        race?.input(c, Number(msg.steer), Number(msg.fwd), !!msg.press);
        break;
      case "leaderboard":
        this.sendLeaderboard(c, msg.game);
        break;
      case "golfQueue":
        if (hub) this.queueGolf(c, hub, Number(msg.holes));
        break;
      case "queueWord":
        if (hub && isWordGame(msg.game)) this.queueWord(c, hub, msg.game);
        break;
      case "wordAct": {
        const w = c.wordId ? this.words.get(c.wordId) : undefined;
        // Never hand the rules a shape they weren't promised: the puzzles read
        // `a.word.toLowerCase()` and spread `a.cards`, so a malformed action would take the
        // whole process down, not just this player's round.
        const action = parseWordAction(msg.a);
        if (w && action) w.act(c, action);
        break;
      }
      case "wordQuit": {
        const w = c.wordId ? this.words.get(c.wordId) : undefined;
        if (w) w.quit(c);
        else this.leaveLobby(c);
        break;
      }
      case "estate":
        this.estate(c, !!msg.enter);
        break;
      case "boardQueue":
        if (c.estate && isBoardGame(msg.game)) this.queueBoard(c, msg.game);
        break;
      case "boardAct": {
        const b = c.boardId ? this.boards.get(c.boardId) : undefined;
        const a = b ? parseBoardAction(msg.a, b.game) : null;
        if (b && a) b.act(c, a);
        break;
      }
      case "boardQuit": {
        const b = c.boardId ? this.boards.get(c.boardId) : undefined;
        if (b) b.quit(c);
        else this.leaveLobby(c);
        break;
      }
      case "casino":
        if (hub) this.sendAll(c, handleCasino(c.record, msg, c.x, c.z, Math.random));
        break;
      case "golfShot": {
        const g = c.golfId ? this.golfs.get(c.golfId) : undefined;
        g?.shot(c, Number(msg.aim), Number(msg.power), msg.club as Club);
        break;
      }
      case "golfAim": {
        const g = c.golfId ? this.golfs.get(c.golfId) : undefined;
        g?.aim(c, Number(msg.aim), msg.club as Club);
        break;
      }
      case "golfQuit": {
        const g = c.golfId ? this.golfs.get(c.golfId) : undefined;
        if (g) { g.quit(c); this.later(() => this.backToVillage(c, g.hubId), 2500); }
        else this.leaveLobby(c);
        break;
      }
      case "fish": case "spot": case "read": case "plant": case "water": case "harvest": case "sell": case "talk": {
        if (!hub) break;
        const out = handleLife(c.record, c.record.token, msg, c.x, c.z);
        if (out) this.sendAll(c, out);
        break;
      }
      case "gift":
        this.gift(c, String(msg.pid), String(msg.item));
        break;
      case "likeCabin":
      case "signGuestbook":
        this.cabinSocial(c, msg);
        break;
      case "neighbours":
        this.sendNeighbours(c);
        break;
      case "clubCreate":
      case "clubJoin":
      case "clubLeave":
        this.club(c, msg);
        break;
      case "gondola":
        this.gondola(c, !!msg.up);
        break;
      case "leaveQueue":
        this.leaveLobby(c);
        break;
      case "steer":
        race?.steer(c, Number(msg.v));
        break;
      case "block":
        c.record.blocked.add(String(msg.id));
        this.store.log({ type: "block", actor: c.id, target: String(msg.id) });
        break;
      case "report":
        this.store.log({ type: "report", actor: c.id, target: String(msg.id), detail: String(msg.reason ?? "").slice(0, 200) });
        c.send({ t: "system", text: "Thanks — a moderator will take a look." });
        break;
      case "ping":
        c.send({ t: "pong" });
        break;
      case "friendRequest":
        this.friendRequest(c, msg);
        break;
      case "friendRespond":
        this.friendRespond(c, String(msg.from), !!msg.accept);
        break;
      case "friendRemove": {
        const pid = String(msg.pid);
        c.record.friends = c.record.friends.filter((f) => f !== pid);
        const other = this.store.byPlayerId(pid);
        if (other) other.friends = other.friends.filter((f) => f !== c.record.pid);
        this.store.markDirty();
        this.sendFriends(c);
        const oc = this.clientByPid(pid);
        if (oc) this.sendFriends(oc);
        break;
      }
      case "joinFriend":
        this.joinFriend(c, String(msg.pid));
        break;
      case "partyInvite":
        this.partyInvite(c, String(msg.pid));
        break;
      case "partyRespond":
        this.partyRespond(c, String(msg.from), !!msg.accept);
        break;
      case "partyLeave":
        this.leaveParty(c.record.pid);
        break;
      case "buyFurniture": {
        const id = String(msg.item);
        const r = buyFurniture(c.record.coins, c.record.furniture, id, seasonAt());
        if (!r.ok) {
          c.send({ t: "error", text: r.reason === "not_enough_coins" ? "Not enough coins yet — try a race or a daily quest!" : r.reason === "too_many" ? "Your cabin has room for 6 of those." : "You can't buy that." });
          break;
        }
        c.record.coins = r.coins;
        c.record.furniture = r.counts;
        c.send({ t: "furniture", counts: c.record.furniture });
        c.send({ t: "wallet", coins: c.record.coins, owned: c.record.owned });
        c.send({ t: "system", text: `You bought a ${FURNITURE_BY_ID[id].name}! 🏡` });
        this.progress(c, { kind: "buy" });
        break;
      }
      case "collect": {
        if (!hub) break;
        const r = collectPinecone(c.record, c.record.token, Number(msg.id), c.x, c.z);
        if (!r.ok) break;
        c.send(pineconesWire(c.record));
        c.send({ t: "wallet", coins: c.record.coins, owned: c.record.owned });
        if (r.quests) c.send(r.quests);
        this.life(c, { kind: "pinecone" });
        break;
      }
      case "photo": {
        this.progress(c, { kind: "photo" });
        this.life(c, { kind: "photo" });
        // A group photo: two or more other beavers close by.
        const near = hub ? [...hub.clients.values()].filter((o) => o !== c && Math.hypot(o.x - c.x, o.z - c.z) < 10).length : 0;
        if (near >= 2 && Date.now() - c.groupAt > 60_000) {
          c.groupAt = Date.now();
          this.progress(c, { kind: "group" });
          c.send({ t: "lifeSay", text: `📸 Group photo with ${near + 1} beavers! Say cheese!` });
        }
        break;
      }
      case "enterCabin":
      case "visitCabin": {
        if (!hub) break;
        const owner = msg.t === "enterCabin" ? c : [...this.clients.values()].find((o) => o.id === String(msg.id));
        if (!owner) {
          c.send({ t: "error", text: "That beaver isn't online right now." });
          break;
        }
        this.leaveLobby(c);
        c.returnHubId = hub.info.id;
        c.returnPos = { x: c.x, z: c.z };
        hub.remove(c);
        c.cabinOf = owner.id;
        // Cabins are shared: everyone inside sees everyone else walking about.
        const cabin = this.space(`cabin:${owner.id}`, CABIN_RADIUS);
        cabin.enter(c, CABIN_DOOR);
        c.spaceId = cabin.id;
        c.send({ t: "furniture", counts: c.record.furniture });
        c.send({ t: "cabin", owner: owner.id, ownerName: owner.name, items: owner.record.cabin, editable: owner === c, look: owner.record.look, social: this.socialOf(owner.record, c), players: cabin.others(c) });
        break;
      }
      case "saveCabin": {
        if (c.cabinOf !== c.id) break;
        const r = validateLayout(msg.items, c.record.furniture);
        if (!r.ok) {
          c.send({ t: "error", text: r.reason });
          c.send({ t: "cabin", owner: c.id, ownerName: c.name, items: c.record.cabin, editable: true, look: c.record.look, social: this.socialOf(c.record, c) });
          break;
        }
        c.record.cabin = r.items;
        if (r.items.length > 0) this.progress(c, { kind: "decorate" });
        // Visitors watch the room change as you decorate.
        const cabin = this.spaces.get(`cabin:${c.id}`);
        for (const o of cabin?.clients.values() ?? []) {
          if (o !== c) o.send({ t: "cabin", owner: c.id, ownerName: c.name, items: r.items, editable: false, look: c.record.look, social: this.socialOf(c.record, o) });
        }
        break;
      }
      case "leaveCabin": {
        if (!c.cabinOf) break;
        this.leaveSpace(c);
        const back = (c.returnHubId && this.hubs.get(c.returnHubId)) || this.publicHub();
        this.joinHub(c, back.full ? this.publicHub() : back, c.returnPos ?? undefined);
        break;
      }
    }
  }

  // ------------------------------------------------------------------ Friends & parties

  private clientByPid(pid: string): Client | undefined {
    for (const c of this.clients.values()) if (c.record.pid === pid) return c;
    return undefined;
  }

  private whereIs(c: Client): { where: string; joinable: boolean } {
    if (c.raceId) return { where: "Playing a minigame 🎮", joinable: false };
    if (c.golfId) return { where: "Playing golf ⛳", joinable: false };
    if (c.summit) return { where: "At the summit 🏔️", joinable: false };
    if (c.boardId) return { where: "Playing a board game 🎲", joinable: false };
    if (c.estate) return { where: "At the Board Game Estate 🎲", joinable: false };
    if (c.cabinOf) return { where: "In a cabin 🏡", joinable: false };
    const hub = c.hubId ? this.hubs.get(c.hubId) : undefined;
    if (!hub) return { where: "Online", joinable: false };
    return { where: hub.info.isPrivate ? `Private room ${hub.info.code}` : `Village ${hub.info.id.split("-")[1] ?? ""}`, joinable: !hub.full };
  }

  private sendFriends(c: Client): void {
    const list = c.record.friends.map((pid) => {
      const rec = this.store.byPlayerId(pid);
      const oc = this.clientByPid(pid);
      const w = oc ? this.whereIs(oc) : null;
      return { pid, name: rec?.name ?? "Beaver", online: !!oc, where: w?.where ?? null, joinable: !!w?.joinable, look: rec?.look ?? null };
    });
    c.send({ t: "friends", list });
  }

  /** Lets your friends know you came online, moved rooms or left. */
  private notifyFriends(c: Client): void {
    for (const pid of c.record.friends) {
      const oc = this.clientByPid(pid);
      if (oc) this.sendFriends(oc);
    }
  }

  private friendRequest(c: Client, msg: { id?: string; code?: string }): void {
    let target: Client | undefined;
    if (msg.id) target = [...this.clients.values()].find((o) => o.id === String(msg.id));
    else if (msg.code) {
      const rec = this.store.byCode(String(msg.code));
      if (!rec) { c.send({ t: "error", text: "No beaver has that friend code." }); return; }
      target = this.clientByPid(rec.pid);
      if (!target) { c.send({ t: "error", text: `${rec.name} needs to be online to accept.` }); return; }
    }
    if (!target || target === c) return;
    if (c.record.friends.includes(target.record.pid)) { c.send({ t: "system", text: `You're already friends with ${target.name}! 🤝` }); return; }
    if (target.record.blocked.has(c.id)) return;
    // If they already asked us, this counts as accepting.
    if (this.pendingFriend.get(c.record.pid)?.has(target.record.pid)) { this.friendRespond(c, target.record.pid, true); return; }
    let set = this.pendingFriend.get(target.record.pid);
    if (!set) this.pendingFriend.set(target.record.pid, (set = new Set()));
    set.add(c.record.pid);
    target.send({ t: "friendRequest", from: c.record.pid, name: c.name });
    c.send({ t: "system", text: `Friend request sent to ${target.name}.` });
  }

  private friendRespond(c: Client, from: string, accept: boolean): void {
    const set = this.pendingFriend.get(c.record.pid);
    if (!set?.has(from)) return;
    set.delete(from);
    const other = this.store.byPlayerId(from);
    if (!other || !accept) return;
    if (!c.record.friends.includes(from)) c.record.friends.push(from);
    if (!other.friends.includes(c.record.pid)) other.friends.push(c.record.pid);
    c.record.friends = c.record.friends.slice(-100);
    this.store.markDirty();
    this.sendFriends(c);
    this.progress(c, { kind: "friend" });
    this.life(c, { kind: "friend" });
    const oc = this.clientByPid(from);
    if (oc) {
      this.sendFriends(oc);
      oc.send({ t: "system", text: `${c.name} is now your friend! 🤝` });
      this.progress(oc, { kind: "friend" });
      this.life(oc, { kind: "friend" });
    }
    c.send({ t: "system", text: `${other.name} is now your friend! 🤝` });
  }

  private joinFriend(c: Client, pid: string): void {
    if (!c.record.friends.includes(pid) && !this.partyOf(c.record.pid)?.members.includes(pid)) return;
    const oc = this.clientByPid(pid);
    const hub = oc?.hubId ? this.hubs.get(oc.hubId) : undefined;
    if (!oc || !hub) { c.send({ t: "error", text: "You can't join them right now." }); return; }
    if (hub.full) { c.send({ t: "error", text: "That village is full." }); return; }
    if (c.raceId || c.golfId || c.wordId) return;
    this.leaveLobby(c);
    if (c.boardId) this.boards.get(c.boardId)?.quit(c);
    this.leaveSpace(c);
    const cur = c.hubId ? this.hubs.get(c.hubId) : undefined;
    if (cur === hub) return;
    cur?.remove(c);
    this.joinHub(c, hub, { x: oc.x + 1.5, z: oc.z + 1.5 });
    this.notifyFriends(c);
  }

  private partyOf(pid: string): Party | undefined {
    for (const p of this.parties.values()) if (p.members.includes(pid)) return p;
    return undefined;
  }

  /** Online party members other than you. */
  private partyMates(c: Client): Client[] {
    const p = this.partyOf(c.record.pid);
    if (!p || p.leader !== c.record.pid) return [];
    return p.members.filter((m) => m !== c.record.pid).map((m) => this.clientByPid(m)).filter((x): x is Client => !!x);
  }

  private sendParty(p: Party): void {
    const members = p.members.map((pid) => ({ pid, name: this.store.byPlayerId(pid)?.name ?? "Beaver", online: !!this.clientByPid(pid) }));
    for (const pid of p.members) this.clientByPid(pid)?.send({ t: "party", leader: p.leader, members });
  }

  private partyInvite(c: Client, pid: string): void {
    if (!c.record.friends.includes(pid)) return;
    const oc = this.clientByPid(pid);
    if (!oc) { c.send({ t: "error", text: "They're offline right now." }); return; }
    const mine = this.partyOf(c.record.pid);
    if (mine && mine.members.length >= 4) { c.send({ t: "error", text: "Parties hold up to 4 beavers." }); return; }
    if (mine?.members.includes(pid)) return;
    let set = this.pendingParty.get(pid);
    if (!set) this.pendingParty.set(pid, (set = new Set()));
    set.add(c.record.pid);
    oc.send({ t: "partyInvite", from: c.record.pid, name: c.name });
    c.send({ t: "system", text: `Party invite sent to ${oc.name}.` });
  }

  private partyRespond(c: Client, from: string, accept: boolean): void {
    const set = this.pendingParty.get(c.record.pid);
    if (!set?.has(from)) return;
    set.delete(from);
    if (!accept) return;
    this.leaveParty(c.record.pid);
    let p = this.partyOf(from);
    if (!p) {
      p = { id: randomBytes(4).toString("hex"), leader: from, members: [from] };
      this.parties.set(p.id, p);
    }
    if (p.members.length >= 4) { c.send({ t: "error", text: "That party is full." }); return; }
    p.members.push(c.record.pid);
    this.sendParty(p);
    this.progress(c, { kind: "friend" });
    // Hop into the leader's village so you're together.
    const leader = this.clientByPid(p.leader);
    if (leader?.hubId && leader.hubId !== c.hubId) this.joinFriend(c, p.leader);
  }

  private leaveParty(pid: string): void {
    const p = this.partyOf(pid);
    if (!p) return;
    p.members = p.members.filter((m) => m !== pid);
    this.clientByPid(pid)?.send({ t: "party", leader: null, members: [] });
    if (p.members.length <= 1) {
      for (const m of p.members) this.clientByPid(m)?.send({ t: "party", leader: null, members: [] });
      this.parties.delete(p.id);
      return;
    }
    if (p.leader === pid) p.leader = p.members[0];
    this.sendParty(p);
  }

  /** Puts a player in a village and sends their quests, pinecones and furniture. */
  private joinHub(c: Client, hub: HubRoom, spawn?: { x: number; z: number }): void {
    hub.add(c, spawn);
    c.lastVisit = visitedPlace(c.x, c.z);
    c.send(questsWire(c.record, c.record.token));
    c.send(pineconesWire(c.record));
    c.send({ t: "furniture", counts: c.record.furniture });
    c.send(lifeWire(c.record));
    c.send({ t: "club", club: this.clubWire(c.record) });
    c.send({ t: "lobbies", list: this.lobbiesIn(hub.info.id) });
  }

  private sendAll(c: Client, msgs: import("@beaver/shared").ServerMsg[]): void {
    for (const m of msgs) c.send(m);
  }

  /** Counts an event toward townsfolk quests. */
  private life(c: Client, ev: LifeEvent): void {
    this.sendAll(c, recordEvent(c.record, c.record.token, null, ev));
  }

  /** Dancing, singing, strumming or skating near others doing the same counts as a group activity. */
  private checkGroup(c: Client, hub: HubRoom): void {
    if (!c.act || !GROUP_ACTS.includes(c.act)) return;
    const near = [...hub.clients.values()].filter((o) => o !== c && o.act && GROUP_ACTS.includes(o.act) && Math.hypot(o.x - c.x, o.z - c.z) < 12);
    if (near.length === 0) return;
    const now = Date.now();
    for (const m of [c, ...near]) {
      if (now - m.groupAt < 60_000) continue;
      m.groupAt = now;
      this.progress(m, { kind: "group" });
      m.record.coins += 5;
      m.send({ t: "lifeSay", text: `🎶 Group fun with ${near.length + 1} beavers! +🪙5`, coins: 5 });
      m.send({ t: "wallet", coins: m.record.coins, owned: m.record.owned });
    }
  }

  // ------------------------------------------------------------------ Gifts, cabins, clubs, summit

  private gift(c: Client, pid: string, item: string): void {
    const to = this.store.byPlayerId(pid);
    if (!to || !c.record.friends.includes(pid)) { c.send({ t: "error", text: "You can only send gifts to friends." }); return; }
    if (!ITEMS[item] || !takeItem(c.record, item, 1)) { c.send({ t: "error", text: "You don't have that in your bag." }); return; }
    giveItem(to, item, 1);
    this.store.markDirty();
    c.send(lifeWire(c.record));
    c.send({ t: "lifeSay", text: `🎁 You sent ${to.name} a ${ITEMS[item].icon} ${ITEMS[item].name}!` });
    this.progress(c, { kind: "gift" });
    const oc = this.clientByPid(pid);
    if (oc) {
      oc.send({ t: "gift", from: c.record.pid, name: c.name, item });
      oc.send(lifeWire(oc.record));
    }
  }

  private socialOf(owner: PlayerRecord, viewer: Client): CabinSocial {
    const week = weekKey();
    if (owner.cabinLikes?.week !== week) owner.cabinLikes = { week, pids: [] };
    return { likes: owner.cabinLikes.pids.length, liked: owner.cabinLikes.pids.includes(viewer.record.pid), guestbook: (owner.guestbook ?? []).slice(-24) };
  }

  private cabinSocial(c: Client, msg: { t: "likeCabin" } | { t: "signGuestbook"; stamp: number }): void {
    if (!c.cabinOf || c.cabinOf === c.id) return;
    const owner = [...this.clients.values()].find((o) => o.id === c.cabinOf);
    if (!owner) return;
    const rec = owner.record;
    this.socialOf(rec, c);
    if (msg.t === "likeCabin") {
      if (rec.cabinLikes!.pids.includes(c.record.pid)) return;
      rec.cabinLikes!.pids.push(c.record.pid);
      owner.send({ t: "system", text: `❤️ ${c.name} loves your cabin!` });
    } else {
      const stamp = Math.max(0, Math.min(11, Math.floor(Number(msg.stamp)) || 0));
      rec.guestbook = [...(rec.guestbook ?? []), { name: c.name, stamp, at: Date.now() }].slice(-30);
      owner.send({ t: "system", text: `📖 ${c.name} signed your guestbook!` });
    }
    this.store.markDirty();
    for (const o of this.clients.values()) if (o.cabinOf === owner.id) o.send({ t: "cabinSocial", social: this.socialOf(rec, o) });
  }

  private sendNeighbours(c: Client): void {
    const hub = c.hubId ? this.hubs.get(c.hubId) : undefined;
    const week = weekKey();
    const likes = (r: PlayerRecord) => (r.cabinLikes?.week === week ? r.cabinLikes.pids.length : 0);
    const list = hub ? [...hub.clients.values()].map((o) => ({ id: o.id, name: o.name, likes: likes(o.record), online: true, you: o === c || undefined })) : [];
    const coziest = [...this.store.all()].map((r) => ({ name: r.name, likes: likes(r) })).filter((r) => r.likes > 0).sort((a, b) => b.likes - a.likes).slice(0, 5);
    c.send({ t: "neighbours", list, coziest });
  }

  private clubWire(rec: PlayerRecord) {
    if (!rec.club) return null;
    const code = rec.club.code;
    const members = [...this.store.all()].filter((r) => r.club?.code === code).map((r) => r.name).slice(0, 40);
    return { ...rec.club, members };
  }

  private club(c: Client, msg: { t: "clubCreate"; name: string; color: string } | { t: "clubJoin"; code: string } | { t: "clubLeave" }): void {
    const rec = c.record;
    if (msg.t === "clubLeave") rec.club = null;
    else if (msg.t === "clubCreate") {
      const name = String(msg.name ?? "").replace(/[^\p{L}\p{N} '&-]/gu, "").trim().slice(0, 20);
      if (name.length < 3) { c.send({ t: "error", text: "Club names need at least 3 letters." }); return; }
      const tag = name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 4).toUpperCase() || "CLUB";
      let code: string;
      do code = Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
      while ([...this.store.all()].some((r) => r.club?.code === code));
      rec.club = { code, name, tag, color: CLUB_COLORS.includes(msg.color) ? msg.color : CLUB_COLORS[0] };
      c.send({ t: "system", text: `🎉 Club "${name}" created! Share the code ${code} so friends can join.` });
    } else {
      const want = String(msg.code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      const other = [...this.store.all()].find((r) => r.club?.code === want);
      if (!other?.club) { c.send({ t: "error", text: "No club has that code." }); return; }
      rec.club = { ...other.club };
      c.send({ t: "system", text: `You joined ${other.club.name}! 🎉` });
    }
    this.store.markDirty();
    c.send({ t: "club", club: this.clubWire(rec) });
    const hub = c.hubId ? this.hubs.get(c.hubId) : undefined;
    hub?.broadcast({ t: "playerClub", id: c.id, club: rec.club ? { tag: rec.club.tag, color: rec.club.color } : null });
  }

  private gondola(c: Client, up: boolean): void {
    if (up) {
      const hub = c.hubId ? this.hubs.get(c.hubId) : undefined;
      if (!hub || Math.hypot(c.x - TOWN_PLACES.gondola.x, c.z - TOWN_PLACES.gondola.z) > 9) return;
      c.returnHubId = hub.info.id;
      this.leaveLobby(c);
      hub.remove(c);
      c.summit = true;
      // One summit per village, so the beavers you rode up with are there too.
      const top = this.space(`summit:${hub.info.id}`, SUMMIT_RADIUS);
      top.enter(c, SUMMIT_ARRIVAL);
      c.spaceId = top.id;
      c.send({ t: "summit", players: top.others(c) });
      this.sendAll(c, recordVisit(c.record, c.record.token, "summit"));
      this.notifyFriends(c);
    } else if (c.summit) {
      this.leaveSpace(c);
      const back = (c.returnHubId && this.hubs.get(c.returnHubId)) || this.publicHub();
      this.joinHub(c, back.full ? this.publicHub() : back, { x: TOWN_PLACES.gondola.x + 2, z: TOWN_PLACES.gondola.z + 3 });
      this.notifyFriends(c);
    }
  }

  // ------------------------------------------------------------------ The Board Game Estate

  /**
   * Walk through the gates into the estate grounds: a shared space like the summit (one per village,
   * so you meet the beavers you came with), or back out to Downtown.
   */
  private estate(c: Client, enter: boolean): void {
    if (enter) {
      const hub = c.hubId ? this.hubs.get(c.hubId) : undefined;
      const g = TOWN_PLACES.estategate;
      if (!hub || Math.hypot(c.x - g.x, c.z - g.z) > 9) return;
      c.returnHubId = hub.info.id;
      this.leaveLobby(c);
      hub.remove(c);
      const grounds = this.space(`estate:${hub.info.id}`, ESTATE_RADIUS);
      grounds.enter(c, ESTATE_ARRIVAL);
      c.spaceId = grounds.id;
      c.estate = true;
      c.send({ t: "estate", players: grounds.others(c) });
      c.send({ t: "lobbies", list: this.lobbiesIn(grounds.id) });
      this.sendAll(c, recordVisit(c.record, c.record.token, "estategate"));
      this.notifyFriends(c);
    } else if (c.estate) {
      this.leaveLobby(c);
      if (c.boardId) this.boards.get(c.boardId)?.quit(c);
      this.leaveSpace(c);
      const back = (c.returnHubId && this.hubs.get(c.returnHubId)) || this.publicHub();
      const g = TOWN_PLACES.estategate;
      this.joinHub(c, back.full ? this.publicHub() : back, { x: g.x + 2, z: g.z + (Math.random() - 0.5) * 3 });
      this.notifyFriends(c);
    }
  }

  /**
   * Sit down at a table: opens (or joins) the estate's lobby for that game. Everyone on the lawn
   * can see it and sit down too; the countdown starts when a second beaver does. If you're on your
   * own you can start anyway and play the computer.
   */
  private queueBoard(c: Client, game: BoardGame): void {
    const grounds = c.estate && c.spaceId ? this.spaces.get(c.spaceId) : undefined;
    if (!grounds || c.boardId) return;
    const key = `${grounds.id}:board:${game}`;
    if (c.lobbyKey === key) return;
    this.leaveLobby(c);
    let l = this.lobbies.get(key);
    if (!l) {
      l = { kind: "board", game, key, hubId: grounds.id, players: [], size: BOARD_INFO[game].seats[1], min: 1, timer: null, startsAt: null };
      this.lobbies.set(key, l);
    }
    if (l.players.length >= l.size) { c.send({ t: "error", text: "That table is full — the next one opens as soon as it starts." }); return; }
    l.players.push(c);
    c.lobbyKey = key;
    this.lobbyChanged(l);
  }

  private startBoard(players: Client[], game: BoardGame, seed: number): void {
    const id = `board-${randomBytes(4).toString("hex")}`;
    const room = new BoardRoom(id, players, game, seed, (r) => {
      this.boards.delete(r.id);
      for (const p of players) if (r.match.over && r.match.winner !== null) this.progress(p, { kind: "arcade" });
    });
    this.boards.set(id, room);
  }

  // ------------------------------------------------------------------ Leaderboards & golf

  private sendLeaderboard(c: Client, game: LeaderGame): void {
    if (!isLeaderGame(game)) return;
    const rows = leaderRows([...this.store.all()].map((r) => ({ name: r.name, best: r.bests?.[game], me: r === c.record })), game);
    c.send({ t: "leaderboard", game, week: weekKey(), rows });
  }

  // ------------------------------------------------------------------ Lobbies
  //
  // Every round online is real players only. Walking up to a game opens (or joins) a lobby for
  // it in your village; everyone else in the village can see who's waiting and hop in from
  // anywhere. Party leaders bring their party along.

  /** Toboggan Rush, Canoe Dash and the four arcade games. */
  private queueMini(c: Client, hub: HubRoom, game: MiniGame): void {
    const spotName = GAME_SPOTS[game];
    const spot = (HUB_PLACES as Record<string, { x: number; z: number }>)[spotName] ?? (TOWN_PLACES as Record<string, { x: number; z: number }>)[spotName];
    const reach = game === "toboggan" ? PORTAL_RADIUS + 2 : game === "canoe" ? 7 : 11;
    const key = `${hub.info.id}:${game}`;
    if (!this.lobbies.has(key) && (!spot || Math.hypot(c.x - spot.x, c.z - spot.z) > reach)) {
      c.send({ t: "error", text: game === "canoe" ? "Walk to the Lake Dock to join the Canoe Dash!" : game === "toboggan" ? "Walk to the trailhead portal to join the race!" : `Walk over to play ${ARCADE_INFO[game].name}!` });
      return;
    }
    this.joinLobby(c, hub, key, () => ({ kind: "mini", game, min: minPlayers(game) }));
  }

  private queueGolf(c: Client, hub: HubRoom, holes: number): void {
    const n = Math.max(1, Math.min(9, Math.floor(holes) || 9));
    const key = `${hub.info.id}:golf:${n}`;
    if (!this.lobbies.has(key) && Math.hypot(c.x - TOWN_PLACES.clubhouse.x, c.z - TOWN_PLACES.clubhouse.z) > 10) {
      c.send({ t: "error", text: "Walk to the golf clubhouse to tee off!" });
      return;
    }
    this.joinLobby(c, hub, key, () => ({ kind: "golf", holes: n, min: 1 }));
  }

  private queueWord(c: Client, hub: HubRoom, game: WordGame): void {
    if (!isWordGame(game)) return;
    const key = `${hub.info.id}:word:${game}`;
    if (!this.lobbies.has(key) && Math.hypot(c.x - TOWN_PLACES.wordlodge.x, c.z - TOWN_PLACES.wordlodge.z) > 9) {
      c.send({ t: "error", text: "Walk up Library Lane to the Word Lodge first!" });
      return;
    }
    this.joinLobby(c, hub, key, () => ({ kind: "word", game, min: 1 }));
  }

  /** Hop into a lobby someone else opened, from anywhere in the village. */
  private joinOpenLobby(c: Client, hub: HubRoom, key: string): void {
    const l = this.lobbies.get(key);
    if (!l || l.hubId !== hub.info.id || l.kind === "board") { c.send({ t: "error", text: "That game has already started." }); return; }
    this.joinLobby(c, hub, key, () => l);
  }

  private joinLobby(c: Client, hub: HubRoom, key: string, make: () => Pick<Lobby, "min"> & ({ kind: "mini"; game: MiniGame } | { kind: "golf"; holes: number } | { kind: "word"; game: WordGame })): void {
    if (c.raceId || c.golfId || c.wordId) return;
    if (c.lobbyKey === key) return;
    this.leaveLobby(c);
    let l = this.lobbies.get(key);
    if (!l) {
      l = { ...make(), key, hubId: hub.info.id, players: [], size: LOBBY.size, timer: null, startsAt: null } as Lobby;
      this.lobbies.set(key, l);
    }
    if (l.players.length >= l.size) { c.send({ t: "error", text: "That game is full — the next one opens as soon as it starts." }); return; }
    const free = (m: Client) => m.hubId === hub.info.id && !m.queued && !m.raceId && !m.golfId && !m.wordId;
    for (const m of [c, ...this.partyMates(c).filter(free)]) {
      if (l.players.length >= l.size) break;
      l.players.push(m);
      m.lobbyKey = key;
    }
    this.lobbyChanged(l);
  }

  private leaveLobby(c: Client): void {
    const l = c.lobbyKey ? this.lobbies.get(c.lobbyKey) : undefined;
    c.lobbyKey = null;
    if (!l) return;
    l.players = l.players.filter((p) => p !== c);
    c.send({ t: "queue", lobby: null });
    this.lobbyChanged(l);
  }

  /** "Start now", or "Play alone" when you're the only one there. */
  private startLobbyNow(c: Client): void {
    const l = c.lobbyKey ? this.lobbies.get(c.lobbyKey) : undefined;
    if (!l) return;
    if (l.players.length < l.min) { c.send({ t: "error", text: "This one needs at least two beavers — hang on for someone to join!" }); return; }
    this.launch(l);
  }

  /** Starts, schedules or cancels the countdown, and tells everyone who's waiting. */
  private lobbyChanged(l: Lobby): void {
    if (l.players.length === 0) {
      if (l.timer) clearTimeout(l.timer);
      this.lobbies.delete(l.key);
      this.announceLobbies(l.hubId);
      return;
    }
    if (l.players.length >= l.size) { this.launch(l); return; }
    if (l.players.length >= Math.max(2, l.min)) {
      if (!l.timer) {
        l.startsAt = Date.now() + LOBBY.countdownMs;
        l.timer = setTimeout(() => this.launch(l), LOBBY.countdownMs);
      }
    } else if (l.timer) {
      // The only other beaver left: wait for company again.
      clearTimeout(l.timer);
      l.timer = null;
      l.startsAt = null;
    }
    const wire = this.lobbyWire(l);
    for (const p of l.players) p.send({ t: "queue", lobby: wire });
    this.announceLobbies(l.hubId);
  }

  private lobbyWire(l: Lobby): LobbyWire {
    const info = l.kind === "mini" ? ARCADE_INFO[l.game] : l.kind === "word" ? WORD_INFO[l.game] : l.kind === "board" ? BOARD_INFO[l.game] : null;
    return {
      key: l.key,
      kind: l.kind,
      game: l.kind === "golf" ? "golf" : l.game,
      title: l.kind === "golf" ? `Golf · ${l.holes} hole${l.holes > 1 ? "s" : ""}` : info!.name,
      icon: info ? info.icon : "⛳",
      count: l.players.length,
      size: l.size,
      min: l.min,
      names: l.players.map((p) => p.name),
      startsInMs: l.startsAt === null ? null : Math.max(0, l.startsAt - Date.now()),
    };
  }

  private lobbiesIn(hubId: string): LobbyWire[] {
    return [...this.lobbies.values()].filter((l) => l.hubId === hubId).map((l) => this.lobbyWire(l));
  }

  private announceLobbies(hubId: string): void {
    // A lobby lives in a village, or on the estate lawn (a shared space).
    (this.hubs.get(hubId) ?? this.spaces.get(hubId))?.broadcast({ t: "lobbies", list: this.lobbiesIn(hubId) });
  }

  /** Moves everyone in the lobby out of the village and into their round. */
  private launch(l: Lobby): void {
    if (this.lobbies.get(l.key) !== l) return;
    if (l.timer) clearTimeout(l.timer);
    this.lobbies.delete(l.key);
    const here = (p: Client) => (l.kind === "board" ? p.spaceId === l.hubId && !p.boardId : p.hubId === l.hubId);
    const players = l.players.filter((p) => this.isConnected(p) && here(p));
    for (const p of l.players) p.lobbyKey = null;
    if (l.kind === "board") {
      // Board games are played right there on the lawn: nobody leaves the estate.
      this.announceLobbies(l.hubId);
      for (const p of players) p.send({ t: "queue", lobby: null });
      // Nobody else came and you pressed start: you play the computer.
      if (players.length >= 1) this.startBoard(players, l.game, randomInt(1, 2 ** 31));
      return;
    }
    const hub = this.hubs.get(l.hubId);
    for (const p of players) hub?.remove(p);
    this.announceLobbies(l.hubId);
    if (players.length === 0) return;
    const seed = randomInt(1, 2 ** 31);
    if (l.kind === "mini") this.startRace(players, l.hubId, l.game, seed);
    else if (l.kind === "golf") this.startGolf(players, l.hubId, l.holes, seed);
    else this.startWord(players, l.hubId, l.game, seed);
  }

  private startRace(players: Client[], hubId: string, game: MiniGame, seed: number): void {
    const id = `race-${randomBytes(4).toString("hex")}`;
    const room = new RaceRoom(id, players, seed, (r) => this.endRace(r, hubId), game);
    this.races.set(id, room);
  }

  private startGolf(players: Client[], hubId: string, holes: number, seed: number): void {
    const id = `golf-${randomBytes(4).toString("hex")}`;
    const room = new GolfRoom(id, players, holes, seed, (r, totals) => {
      this.golfs.delete(r.id);
      for (const t of totals) {
        const cl = r.players.find((p) => p.id === t.id) ?? [...this.clients.values()].find((p) => p.id === t.id);
        if (!cl || t.isBot || t.holes === 0) continue;
        if (t.holes === r.match.holes.length && !t.quit) recordBest(cl.record, "golf", t.toPar);
      }
      for (const p of r.players) this.later(() => this.backToVillage(p, hubId), 6000);
    });
    room.hubId = hubId;
    this.golfs.set(id, room);
    // Count a golf quest as soon as you finish your first hole.
    room.onHole = (pid) => { const cl = players.find((p) => p.id === pid); if (cl) this.progress(cl, { kind: "golf" }); };
  }

  private startWord(players: Client[], hubId: string, game: WordGame, seed: number): void {
    const id = `word-${randomBytes(4).toString("hex")}`;
    const room = new WordRoom(id, [...players], game, seed, (r, results) => {
      this.words.delete(r.id);
      for (const res of results) {
        if (res.isBot) continue;
        const cl = [...this.clients.values()].find((p) => p.id === res.id);
        if (cl) recordBest(cl.record, `word:${game}`, res.score);
      }
      for (const p of players) this.later(() => this.backToLodge(p, hubId), 7000);
    });
    room.hubId = hubId;
    this.words.set(id, room);
    room.onSolve = (pid) => { const cl = players.find((p) => p.id === pid); if (cl) this.progress(cl, { kind: "arcade" }); };
  }

  // ------------------------------------------------------------------ Shared spaces

  /** The summit or cabin space with this id, made on first use. */
  private space(id: string, radius: number): Space {
    let s = this.spaces.get(id);
    if (!s) {
      s = new Space(id, this.store, (prev, next, dtMs) => validateMoveIn(prev, next, dtMs, radius));
      this.spaces.set(id, s);
    }
    return s;
  }

  /** Steps out of the summit or a cabin; an empty space is put away. */
  private leaveSpace(c: Client): void {
    c.summit = false;
    c.estate = false;
    c.cabinOf = null;
    const s = c.spaceId ? this.spaces.get(c.spaceId) : undefined;
    c.spaceId = null;
    if (!s) return;
    s.leave(c);
    if (s.clients.size === 0) {
      s.dispose();
      this.spaces.delete(s.id);
    }
  }

  // ---------------------------------------------------------------- The Word Lodge

  private backToLodge(c: Client, hubId: string): void {
    if (!this.isConnected(c) || c.hubId || c.raceId || c.golfId || c.wordId) return;
    const hub = this.hubs.get(hubId) ?? this.publicHub();
    this.joinHub(c, hub.full ? this.publicHub() : hub, { x: TOWN_PLACES.wordlodge.x + (Math.random() - 0.5) * 3, z: TOWN_PLACES.wordlodge.z + 2 });
  }

  private backToVillage(c: Client, hubId: string): void {
    if (!this.isConnected(c) || c.hubId || c.raceId || c.golfId) return;
    const hub = this.hubs.get(hubId) ?? this.publicHub();
    this.joinHub(c, hub.full ? this.publicHub() : hub, { x: TOWN_PLACES.clubhouse.x + (Math.random() - 0.5) * 4, z: TOWN_PLACES.clubhouse.z - 1.5 });
  }

  /** Counts a daily-quest event and pays out any reward. */
  private progress(c: Client, ev: QuestEvent): void {
    const update = questEvent(c.record, c.record.token, ev);
    if (!update) return;
    c.send(update);
    if (update.justCompleted?.length || update.bonusNow) c.send({ t: "wallet", coins: c.record.coins, owned: c.record.owned });
  }

  private publicHub(): HubRoom {
    for (const h of this.hubs.values()) if (!h.info.isPrivate && !h.full) return h;
    return this.createHub(false);
  }

  private createHub(isPrivate: boolean): HubRoom {
    let id: string;
    let code: string | undefined;
    if (isPrivate) {
      do {
        code = Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
      } while ([...this.hubs.values()].some((h) => h.info.code === code));
      id = `cabin-${code}`;
    } else {
      id = `village-${++this.publicCount}`;
    }
    const hub = new HubRoom({ id, kind: "hub", isPrivate, code }, this.store);
    this.hubs.set(id, hub);
    return hub;
  }

  private endRace(room: RaceRoom, hubId: string): void {
    this.races.delete(room.id);
    room.dispose();
    for (const c of room.players) {
      const mine = room.results.find((r) => r.id === c.id);
      if (!mine) continue;
      if (!room.isRace) {
        this.progress(c, { kind: "arcade" });
        const best = recordBest(c.record, room.game, mine.score);
        if (best) c.send({ t: "system", text: `⭐ New weekly best in ${ARCADE_INFO[room.game].name}: ${mine.score}!` });
        this.life(c, { kind: "race", game: room.game });
        continue;
      }
      if (mine.finished && mine.time !== null) recordBest(c.record, room.game, mine.time);
      this.life(c, { kind: "race", game: room.game });
      if (!mine.finished) continue;
      this.progress(c, { kind: room.game === "canoe" ? "canoe" : "race" });
      if (mine.place <= 2) this.progress(c, { kind: "podium" });
    }
    // Give players a few seconds on the results screen, then return them to the village by the trailhead.
    this.later(() => {
      const hub = this.hubs.get(hubId) ?? this.publicHub();
      for (const c of room.players) {
        if (!this.isConnected(c)) continue;
        const sp = (TOWN_PLACES as Record<string, { x: number; z: number }>)[GAME_SPOTS[room.game]];
        const t = room.game === "canoe" ? { x: HUB_PLACES.dock.x + 3, z: HUB_PLACES.dock.z - 6 } : room.isRace || !sp ? { x: HUB_PLACES.trailhead.x, z: HUB_PLACES.trailhead.z + 8 } : { x: sp.x + 3, z: sp.z + 3 };
        this.joinHub(c, hub, { x: t.x + (Math.random() - 0.5) * 6, z: t.z + Math.random() * 3 });
      }
    }, 5000);
  }

  private isConnected(c: Client): boolean {
    for (const v of this.clients.values()) if (v === c) return true;
    return false;
  }

  private onClose(ws: WebSocket): void {
    const c = this.clients.get(ws);
    if (!c) return;
    this.clients.delete(ws);
    this.leaveLobby(c);
    this.leaveSpace(c);
    if (c.hubId) {
      const hub = this.hubs.get(c.hubId);
      hub?.remove(c);
      // Empty private rooms are cleaned up; the first public village always stays.
      if (hub && hub.clients.size === 0 && hub.info.id !== "village-1") {
        hub.dispose();
        this.hubs.delete(hub.info.id);
      }
    }
    if (c.raceId) this.races.get(c.raceId)?.drop(c);
    if (c.golfId) this.golfs.get(c.golfId)?.quit(c);
    if (c.wordId) this.words.get(c.wordId)?.drop(c);
    if (c.boardId) this.boards.get(c.boardId)?.quit(c);
    this.notifyFriends(c);
    const party = this.partyOf(c.record.pid);
    if (party) this.sendParty(party);
    this.store.markDirty();
  }

  private timers = new Set<NodeJS.Timeout>();
  private closed = false;
  /** A one-off timer that's cancelled if the server shuts down. */
  private later(fn: () => void, ms: number): void {
    const t = setTimeout(() => { this.timers.delete(t); if (!this.closed) fn(); }, ms);
    this.timers.add(t);
  }

  close(): void {
    this.closed = true;
    for (const t of this.timers) clearTimeout(t);
    this.store.flush();
    for (const h of this.hubs.values()) h.dispose();
    for (const r of this.races.values()) r.dispose();
    for (const g of this.golfs.values()) g.dispose();
    for (const w of this.words.values()) w.dispose();
    for (const s of this.spaces.values()) s.dispose();
    for (const b of this.boards.values()) b.dispose();
    for (const l of this.lobbies.values()) if (l.timer) clearTimeout(l.timer);
    this.wss.close();
  }
}
