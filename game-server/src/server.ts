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
  RACE,
  sanitizeLook,
  type ClientMsg,
  type RaceGame,
} from "@beaver/shared";
import { Client } from "./client";
import { HubRoom } from "./rooms/HubRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { GolfRoom } from "./rooms/GolfRoom";
import { WordRoom } from "./rooms/WordRoom";
import { PlayerStore, type PlayerRecord } from "./store";

const CLUB_COLORS = ["#e2483d", "#2fa7a2", "#f5c242", "#a77bff", "#ff7eb3", "#4c8cff", "#6fbf4a", "#ff9a3c"];
const GOLF_WAIT_MS = 8000;
/** How long players at the Lodge door wait for each other before the bots fill in. */
const WORD_WAIT_MS = 6000;

interface GolfQueue { key: string; hubId: string; holes: number; players: Client[]; timer: NodeJS.Timeout; startsAt: number }

interface WordQueue { key: string; hubId: string; game: WordGame; players: Client[]; timer: NodeJS.Timeout; startsAt: number }

interface Queue {
  hubId: string;
  key: string;
  game: MiniGame;
  players: Client[];
  timer: NodeJS.Timeout;
  startsAt: number;
}

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
  private golfQueues = new Map<string, GolfQueue>();
  readonly words = new Map<string, WordRoom>();
  private wordQueues = new Map<string, WordQueue>();
  private queues = new Map<string, Queue>();
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
    switch (msg.t) {
      case "move": {
        if (!hub) break;
        hub.move(c, Number(msg.x), Number(msg.z), Number(msg.ry));
        const place = visitedPlace(c.x, c.z);
        if (place && place !== c.lastVisit) this.sendAll(c, recordVisit(c.record, c.record.token, place));
        c.lastVisit = place;
        break;
      }
      case "chat":
        hub?.chat(c, msg.text);
        break;
      case "quick":
        if (!hub) break;
        hub.quick(c, Number(msg.i));
        this.progress(c, { kind: "quickchat" });
        break;
      case "emote":
        if (!hub) break;
        hub.emote(c, Number(msg.i));
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
        hub?.updateLook(c);
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
        if (hub) this.enqueue(c, hub, msg.game === "canoe" ? "canoe" : "toboggan");
        break;
      case "queueGame":
        if (hub && String(msg.game) in ARCADE_INFO) this.enqueue(c, hub, msg.game);
        break;
      case "input":
        race?.input(c, Number(msg.steer), Number(msg.fwd), !!msg.press);
        break;
      case "leaderboard":
        this.sendLeaderboard(c, msg.game);
        break;
      case "golfQueue":
        if (hub) this.golfQueue(c, hub, Number(msg.holes));
        break;
      case "queueWord":
        if (hub && isWordGame(msg.game)) this.wordQueue(c, hub, msg.game);
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
        else this.dequeueWord(c);
        break;
      }
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
        if (g) { g.quit(c); setTimeout(() => this.backToVillage(c, g.hubId), 2500); }
        else this.dequeueGolf(c);
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
        this.dequeue(c);
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
        if (!hub || c.queued) break;
        const owner = msg.t === "enterCabin" ? c : [...this.clients.values()].find((o) => o.id === String(msg.id));
        if (!owner) {
          c.send({ t: "error", text: "That beaver isn't online right now." });
          break;
        }
        c.returnHubId = hub.info.id;
        c.returnPos = { x: c.x, z: c.z };
        hub.remove(c);
        c.cabinOf = owner.id;
        c.send({ t: "furniture", counts: c.record.furniture });
        c.send({ t: "cabin", owner: owner.id, ownerName: owner.name, items: owner.record.cabin, editable: owner === c, look: owner.record.look, social: this.socialOf(owner.record, c) });
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
        break;
      }
      case "leaveCabin": {
        if (!c.cabinOf) break;
        c.cabinOf = null;
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
    if (c.raceId || c.golfId) return;
    this.dequeue(c);
    this.dequeueGolf(c);
    if (c.cabinOf) c.cabinOf = null;
    c.summit = false;
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
      if (!hub || c.queued || Math.hypot(c.x - TOWN_PLACES.gondola.x, c.z - TOWN_PLACES.gondola.z) > 9) return;
      c.returnHubId = hub.info.id;
      hub.remove(c);
      c.summit = true;
      c.send({ t: "summit", players: [] });
      this.sendAll(c, recordVisit(c.record, c.record.token, "summit"));
      this.notifyFriends(c);
    } else if (c.summit) {
      c.summit = false;
      const back = (c.returnHubId && this.hubs.get(c.returnHubId)) || this.publicHub();
      this.joinHub(c, back.full ? this.publicHub() : back, { x: TOWN_PLACES.gondola.x + 2, z: TOWN_PLACES.gondola.z + 3 });
      this.notifyFriends(c);
    }
  }

  // ------------------------------------------------------------------ Leaderboards & golf

  private sendLeaderboard(c: Client, game: LeaderGame): void {
    if (!isLeaderGame(game)) return;
    const rows = leaderRows([...this.store.all()].map((r) => ({ name: r.name, best: r.bests?.[game], me: r === c.record })), game);
    c.send({ t: "leaderboard", game, week: weekKey(), rows });
  }

  private golfQueue(c: Client, hub: HubRoom, holes: number): void {
    if (c.queued || c.raceId || c.golfId) return;
    if (Math.hypot(c.x - TOWN_PLACES.clubhouse.x, c.z - TOWN_PLACES.clubhouse.z) > 10) {
      c.send({ t: "error", text: "Walk to the golf clubhouse to tee off!" });
      return;
    }
    const n = Math.max(1, Math.min(9, Math.floor(holes) || 9));
    const key = `${hub.info.id}:golf:${n}`;
    let q = this.golfQueues.get(key);
    if (!q) {
      q = { key, hubId: hub.info.id, holes: n, players: [], startsAt: Date.now() + GOLF_WAIT_MS, timer: setTimeout(() => this.startGolf(key), GOLF_WAIT_MS) };
      this.golfQueues.set(key, q);
    }
    const group = [c, ...this.partyMates(c).filter((m) => m.hubId === hub.info.id && !m.queued && !m.raceId && !m.golfId)];
    for (const m of group) {
      if (q.players.length >= 4) break;
      q.players.push(m);
      m.queued = true;
    }
    for (const p of q.players) p.send({ t: "queue", count: q.players.length, size: 4, startsInMs: Math.max(0, q.startsAt - Date.now()) });
    if (q.players.length >= 4) this.startGolf(key);
  }

  private dequeueGolf(c: Client): void {
    for (const q of this.golfQueues.values()) {
      const i = q.players.indexOf(c);
      if (i < 0) continue;
      q.players.splice(i, 1);
      c.queued = false;
      if (q.players.length === 0) { clearTimeout(q.timer); this.golfQueues.delete(q.key); }
    }
  }

  private startGolf(key: string): void {
    const q = this.golfQueues.get(key);
    if (!q) return;
    clearTimeout(q.timer);
    this.golfQueues.delete(key);
    if (q.players.length === 0) return;
    const hub = this.hubs.get(q.hubId);
    for (const p of q.players) { p.queued = false; hub?.remove(p); }
    const id = `golf-${randomBytes(4).toString("hex")}`;
    const room = new GolfRoom(id, q.players, q.holes, randomInt(1, 2 ** 31), (r, totals) => {
      this.golfs.delete(r.id);
      for (const t of totals) {
        const cl = r.players.find((p) => p.id === t.id) ?? [...this.clients.values()].find((p) => p.id === t.id);
        if (!cl || t.isBot || t.holes === 0) continue;
        if (t.holes === r.match.holes.length && !t.quit) recordBest(cl.record, "golf", t.toPar);
      }
      for (const p of r.players) setTimeout(() => this.backToVillage(p, q.hubId), 6000);
    });
    room.hubId = q.hubId;
    this.golfs.set(id, room);
    // Count a golf quest as soon as you finish your first hole.
    room.onHole = (pid) => { const cl = q.players.find((p) => p.id === pid); if (cl) this.progress(cl, { kind: "golf" }); };
  }


  // ---------------------------------------------------------------- The Word Lodge

  /**
   * Queues for a round at the Lodge. Players who ask for the same game in the same village
   * wait together for a few seconds, so friends standing at the door end up in one room; the
   * round then fills the remaining lecterns with bots.
   */
  private wordQueue(c: Client, hub: HubRoom, game: WordGame): void {
    if (c.queued || c.raceId || c.golfId || c.wordId) return;
    if (!isWordGame(game)) return;
    if (Math.hypot(c.x - TOWN_PLACES.wordlodge.x, c.z - TOWN_PLACES.wordlodge.z) > 9) {
      c.send({ t: "error", text: "Walk up Library Lane to the Word Lodge first!" });
      return;
    }
    const key = `${hub.info.id}:word:${game}`;
    let q = this.wordQueues.get(key);
    if (!q) {
      q = { key, hubId: hub.info.id, game, players: [], startsAt: Date.now() + WORD_WAIT_MS, timer: setTimeout(() => this.startWord(key), WORD_WAIT_MS) };
      this.wordQueues.set(key, q);
    }
    const group = [c, ...this.partyMates(c).filter((m) => m.hubId === hub.info.id && !m.queued && !m.raceId && !m.golfId && !m.wordId)];
    for (const m of group) {
      if (q.players.length >= 4) break;
      q.players.push(m);
      m.queued = true;
    }
    for (const p of q.players) p.send({ t: "queue", count: q.players.length, size: 4, startsInMs: Math.max(0, q.startsAt - Date.now()) });
    if (q.players.length >= 4) this.startWord(key);
  }

  private dequeueWord(c: Client): void {
    for (const q of this.wordQueues.values()) {
      const i = q.players.indexOf(c);
      if (i < 0) continue;
      q.players.splice(i, 1);
      c.queued = false;
      if (q.players.length === 0) { clearTimeout(q.timer); this.wordQueues.delete(q.key); }
    }
  }

  private startWord(key: string): void {
    const q = this.wordQueues.get(key);
    if (!q) return;
    clearTimeout(q.timer);
    this.wordQueues.delete(key);
    if (q.players.length === 0) return;
    const hub = this.hubs.get(q.hubId);
    for (const p of q.players) { p.queued = false; hub?.remove(p); }
    const id = `word-${randomBytes(4).toString("hex")}`;
    const room = new WordRoom(id, [...q.players], q.game, randomInt(1, 2 ** 31), (r, results) => {
      this.words.delete(r.id);
      for (const res of results) {
        if (res.isBot) continue;
        const cl = [...this.clients.values()].find((p) => p.id === res.id);
        if (cl) recordBest(cl.record, `word:${q.game}`, res.score);
      }
      for (const p of q.players) setTimeout(() => this.backToLodge(p, q.hubId), 7000);
    });
    room.hubId = q.hubId;
    this.words.set(id, room);
    room.onSolve = (pid) => { const cl = q.players.find((p) => p.id === pid); if (cl) this.progress(cl, { kind: "arcade" }); };
  }

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

  private enqueue(c: Client, hub: HubRoom, game: MiniGame): void {
    if (c.queued || c.raceId || c.golfId) return;
    const spotName = GAME_SPOTS[game];
    const spot = (HUB_PLACES as Record<string, { x: number; z: number }>)[spotName] ?? (TOWN_PLACES as Record<string, { x: number; z: number }>)[spotName];
    const reach = game === "toboggan" ? PORTAL_RADIUS + 2 : game === "canoe" ? 7 : 11;
    if (!spot || Math.hypot(c.x - spot.x, c.z - spot.z) > reach) {
      c.send({ t: "error", text: game === "canoe" ? "Walk to the Lake Dock to join the Canoe Dash!" : game === "toboggan" ? "Walk to the trailhead portal to join the race!" : `Walk over to play ${ARCADE_INFO[game].name}!` });
      return;
    }
    // Party members queue together: the leader brings everyone in the same village along.
    const group = [c, ...this.partyMates(c).filter((m) => m.hubId === hub.info.id && !m.queued && !m.raceId)];
    const key = `${hub.info.id}:${game}`;
    let q = this.queues.get(key);
    if (!q) {
      const startsAt = Date.now() + RACE.queueWaitMs;
      q = { hubId: hub.info.id, key, game, players: [], startsAt, timer: setTimeout(() => this.startRace(key), RACE.queueWaitMs) };
      this.queues.set(key, q);
    }
    for (const m of group) {
      if (q.players.length >= RACE.size) break;
      q.players.push(m);
      m.queued = true;
    }
    this.announceQueue(q);
    if (q.players.length >= RACE.size) this.startRace(key);
  }

  private dequeue(c: Client): void {
    if (!c.queued) return;
    c.queued = false;
    for (const q of this.queues.values()) {
      const i = q.players.indexOf(c);
      if (i >= 0) {
        q.players.splice(i, 1);
        if (q.players.length === 0) {
          clearTimeout(q.timer);
          this.queues.delete(q.key);
        } else this.announceQueue(q);
      }
    }
  }

  private announceQueue(q: Queue): void {
    for (const p of q.players) p.send({ t: "queue", count: q.players.length, size: RACE.size, startsInMs: Math.max(0, q.startsAt - Date.now()) });
  }

  private startRace(key: string): void {
    const q = this.queues.get(key);
    if (!q) return;
    clearTimeout(q.timer);
    this.queues.delete(key);
    const hubId = q.hubId;
    const players = q.players.splice(0, RACE.size);
    if (players.length === 0) return;
    const hub = this.hubs.get(hubId);
    for (const p of players) {
      p.queued = false;
      hub?.remove(p);
    }
    const id = `race-${randomBytes(4).toString("hex")}`;
    const room = new RaceRoom(id, players, randomInt(1, 2 ** 31), (r) => this.endRace(r, hubId), q.game);
    this.races.set(id, room);
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
    setTimeout(() => {
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
    this.dequeue(c);
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
    this.dequeueGolf(c);
    if (c.golfId) this.golfs.get(c.golfId)?.quit(c);
    this.dequeueWord(c);
    if (c.wordId) this.words.get(c.wordId)?.drop(c);
    this.notifyFriends(c);
    const party = this.partyOf(c.record.pid);
    if (party) this.sendParty(party);
    this.store.markDirty();
  }

  close(): void {
    this.store.flush();
    for (const h of this.hubs.values()) h.dispose();
    for (const r of this.races.values()) r.dispose();
    for (const g of this.golfs.values()) g.dispose();
    for (const w of this.words.values()) w.dispose();
    for (const q of this.golfQueues.values()) clearTimeout(q.timer);
    for (const q of this.wordQueues.values()) clearTimeout(q.timer);
    for (const q of this.queues.values()) clearTimeout(q.timer);
    this.wss.close();
  }
}
