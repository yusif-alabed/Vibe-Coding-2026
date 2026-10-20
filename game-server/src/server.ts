import { randomBytes, randomInt } from "node:crypto";
import type { Server as HttpServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  buyFurniture,
  collectPinecone,
  FURNITURE_BY_ID,
  pineconesWire,
  questEvent,
  questsWire,
  validateLayout,
  visitedPlace,
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
} from "@beaver/shared";
import { Client } from "./client";
import { HubRoom } from "./rooms/HubRoom";
import { RaceRoom } from "./rooms/RaceRoom";
import { PlayerStore } from "./store";

interface Queue {
  hubId: string;
  players: Client[];
  timer: NodeJS.Timeout;
  startsAt: number;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export class GameServer {
  readonly store = new PlayerStore();
  readonly hubs = new Map<string, HubRoom>();
  readonly races = new Map<string, RaceRoom>();
  private queues = new Map<string, Queue>();
  private clients = new Map<WebSocket, Client>();
  private wss: WebSocketServer;
  private publicCount = 0;

  constructor(server: HttpServer) {
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
      if (c) this.handle(c, msg);
    });
    ws.on("close", () => this.onClose(ws));
    ws.on("error", () => ws.close());
  }

  private handleJoin(ws: WebSocket, msg: Extract<ClientMsg, { t: "join" }>): boolean {
    const name = String(msg.name ?? "").replace(/[^\p{L}\p{N} _-]/gu, "").trim().slice(0, NAME_MAX) || "Beaver";
    const record = this.store.getOrCreate(msg.token, name, { ...DEFAULT_LOOK, ...(msg.look ?? {}) });
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
        if (place && place !== c.lastVisit) this.progress(c, { kind: "visit", place });
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
        const place = visitedPlace(c.x, c.z);
        if (a === "stop" || (a === "cocoa" && place === "lodge") || (a === "soak" && place === "hotSpring")) hub.act(c, a);
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
        if (hub) this.enqueue(c, hub);
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
      case "buyFurniture": {
        const id = String(msg.item);
        const r = buyFurniture(c.record.coins, c.record.furniture, id);
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
        break;
      }
      case "photo":
        this.progress(c, { kind: "photo" });
        break;
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
        c.send({ t: "cabin", owner: owner.id, ownerName: owner.name, items: owner.record.cabin, editable: owner === c, look: owner.record.look });
        break;
      }
      case "saveCabin": {
        if (c.cabinOf !== c.id) break;
        const r = validateLayout(msg.items, c.record.furniture);
        if (!r.ok) {
          c.send({ t: "error", text: r.reason });
          c.send({ t: "cabin", owner: c.id, ownerName: c.name, items: c.record.cabin, editable: true, look: c.record.look });
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

  /** Puts a player in a village and sends their quests, pinecones and furniture. */
  private joinHub(c: Client, hub: HubRoom, spawn?: { x: number; z: number }): void {
    hub.add(c, spawn);
    c.lastVisit = visitedPlace(c.x, c.z);
    c.send(questsWire(c.record, c.record.token));
    c.send(pineconesWire(c.record));
    c.send({ t: "furniture", counts: c.record.furniture });
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

  private enqueue(c: Client, hub: HubRoom): void {
    if (c.queued || c.raceId) return;
    const portal = HUB_PLACES.trailhead;
    if (Math.hypot(c.x - portal.x, c.z - portal.z) > PORTAL_RADIUS + 2) {
      c.send({ t: "error", text: "Walk to the trailhead portal to join the race!" });
      return;
    }
    let q = this.queues.get(hub.info.id);
    if (!q) {
      const startsAt = Date.now() + RACE.queueWaitMs;
      q = { hubId: hub.info.id, players: [], startsAt, timer: setTimeout(() => this.startRace(hub.info.id), RACE.queueWaitMs) };
      this.queues.set(hub.info.id, q);
    }
    q.players.push(c);
    c.queued = true;
    this.announceQueue(q);
    if (q.players.length >= RACE.size) this.startRace(hub.info.id);
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
          this.queues.delete(q.hubId);
        } else this.announceQueue(q);
      }
    }
  }

  private announceQueue(q: Queue): void {
    for (const p of q.players) p.send({ t: "queue", count: q.players.length, size: RACE.size, startsInMs: Math.max(0, q.startsAt - Date.now()) });
  }

  private startRace(hubId: string): void {
    const q = this.queues.get(hubId);
    if (!q) return;
    clearTimeout(q.timer);
    this.queues.delete(hubId);
    const players = q.players.splice(0, RACE.size);
    if (players.length === 0) return;
    const hub = this.hubs.get(hubId);
    for (const p of players) {
      p.queued = false;
      hub?.remove(p);
    }
    const id = `race-${randomBytes(4).toString("hex")}`;
    const room = new RaceRoom(id, players, randomInt(1, 2 ** 31), (r) => this.endRace(r, hubId));
    this.races.set(id, room);
  }

  private endRace(room: RaceRoom, hubId: string): void {
    this.races.delete(room.id);
    room.dispose();
    for (const c of room.players) {
      const mine = room.results.find((r) => r.id === c.id);
      if (!mine?.finished) continue;
      this.progress(c, { kind: "race" });
      if (mine.place <= 2) this.progress(c, { kind: "podium" });
    }
    // Give players a few seconds on the results screen, then return them to the village by the trailhead.
    setTimeout(() => {
      const hub = this.hubs.get(hubId) ?? this.publicHub();
      for (const c of room.players) {
        if (!this.isConnected(c)) continue;
        const t = HUB_PLACES.trailhead;
        this.joinHub(c, hub, { x: t.x + (Math.random() - 0.5) * 6, z: t.z + 8 + Math.random() * 3 });
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
  }

  close(): void {
    for (const h of this.hubs.values()) h.dispose();
    for (const r of this.races.values()) r.dispose();
    for (const q of this.queues.values()) clearTimeout(q.timer);
    this.wss.close();
  }
}
