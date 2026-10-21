import {
  BOT_NAMES,
  CATALOG,
  ChatRateLimiter,
  coinsForRace,
  DEFAULT_LOOK,
  ECONOMY,
  EMOTES,
  filterChat,
  FUR_COLORS,
  HUB_PLACES,
  PORTAL_RADIUS,
  purchase,
  QUICK_CHAT,
  RACE,
  randomSpawn,
  sanitizeLook,
  STARTER_ITEMS,
  TobogganRace,
  validateMove,
  type ClientMsg,
  type Look,
  type PlayerInfo,
  type ServerMsg,
  buyFurniture,
  collectPinecone,
  FURNITURE_BY_ID,
  newProgress,
  pineconesWire,
  questEvent,
  questsWire,
  validateLayout,
  visitedPlace,
  seasonAt,
  type RaceGame,
  ACT_PLACES,
  ACT_QUEST,
  type PlacedItem,
  type QuestEvent,
  actAllowed,
  ARCADE_INFO,
  coinsForGame,
  GAME_SPOTS,
  GOLF_HOLES,
  GolfMatch,
  golfCoins,
  GROUP_ACTS,
  handleLife,
  ITEMS,
  leaderRows,
  lifeWire,
  makeSim,
  recordBest,
  recordEvent,
  recordVisit,
  takeItem,
  TOWN_PLACES,
  weekKey,
  hashString,
  mulberry32,
  type CabinSocial,
  type GameSim,
  type LifeEvent,
  type MiniGame,
  type PlayerInput,
  type PlayerRecordLike,
  type RaceSnapshot,
} from "@beaver/shared";
import type { Net } from "./net";

/**
 * Solo mode: runs the same shared game rules as the real server, right in the browser,
 * with friendly bot beavers wandering the village. Used for the playable preview and
 * when no game server is reachable.
 */

const SAVE_KEY = "beaver-banff-solo";

interface Save extends PlayerRecordLike {
  coins: number;
  owned: string[];
  look: Look;
  /** Bot beavers you've made friends with (by name). */
  botFriends?: string[];
  club?: { code: string; name: string; tag: string; color: string } | null;
  guestbook?: { name: string; stamp: number; at: number }[];
  cabinLikes?: { week: string; pids: string[] };
}

/** Furnished cabins for the bot beavers, so you can visit them in solo mode. */
const BOT_CABINS: PlacedItem[][] = [
  [{ id: "rug_plaid", x: 3, z: 3, rot: 0 }, { id: "sofa", x: 3, z: 5, rot: 0 }, { id: "coffee_table", x: 4, z: 3, rot: 0 }, { id: "bookshelf", x: 0, z: 1, rot: 1 }, { id: "plant", x: 9, z: 0, rot: 0 }, { id: "lamp", x: 2, z: 5, rot: 0 }, { id: "bed", x: 8, z: 5, rot: 0 }],
  [{ id: "rug_round", x: 1, z: 2, rot: 0 }, { id: "dining_table", x: 1, z: 2, rot: 0 }, { id: "chair", x: 1, z: 1, rot: 2 }, { id: "chair", x: 2, z: 3, rot: 0 }, { id: "canoe", x: 7, z: 7, rot: 0 }, { id: "telescope", x: 9, z: 3, rot: 0 }, { id: "plush", x: 6, z: 1, rot: 0 }],
  [{ id: "rug_round", x: 4, z: 4, rot: 0 }, { id: "armchair", x: 3, z: 4, rot: 1 }, { id: "armchair", x: 6, z: 4, rot: 3 }, { id: "sled", x: 0, z: 7, rot: 0 }, { id: "plant", x: 0, z: 0, rot: 0 }, { id: "lamp", x: 9, z: 7, rot: 0 }, { id: "bookshelf", x: 7, z: 0, rot: 0 }],
];

function load(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function store(s: Save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* storage may be unavailable; progress just won't persist */
  }
}

interface Bot extends PlayerInfo {
  target: { x: number; z: number };
  wait: number;
  speed: number;
}

const PLACES = Object.values(HUB_PLACES);
const rand = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

export class OfflineNet implements Net {
  readonly mode = "offline" as const;
  private listeners: ((m: ServerMsg) => void)[] = [];
  private me: PlayerInfo = { id: "you", name: "You", look: DEFAULT_LOOK, x: 0, z: 0, ry: 0 };
  private save: Save;
  private bots: Bot[] = [];
  private lastMove = performance.now();
  private limiter = new ChatRateLimiter();
  private timers: number[] = [];
  private sim: GameSim | null = null;
  private steer = 0;
  private inp: PlayerInput = { steer: 0, fwd: 0, press: false };
  private golf: GolfMatch | null = null;
  private golfTimer = 0;
  private summit = false;
  private myAct: string | null = null;
  private inHub = false;
  private queued = false;
  private lastVisit: string | null = null;
  private inCabin = false;
  private returnPos: { x: number; z: number } | null = null;

  constructor() {
    this.save = { coins: ECONOMY.startingCoins, owned: [...STARTER_ITEMS], look: DEFAULT_LOOK, ...newProgress(), ...(load() ?? {}) };
  }

  private emit(m: ServerMsg) {
    setTimeout(() => this.listeners.forEach((l) => l(m)), 0);
  }
  onMessage(cb: (m: ServerMsg) => void) {
    this.listeners.push(cb);
  }
  onClose() {}
  close() {
    this.timers.forEach((t) => clearInterval(t));
    this.timers = [];
  }

  private every(ms: number, fn: () => void) {
    this.timers.push(window.setInterval(fn, ms));
  }

  private spawnBots() {
    const used = new Set<string>();
    for (let i = 0; i < 6; i++) {
      let name = pick(BOT_NAMES);
      while (used.has(name)) name = pick(BOT_NAMES);
      used.add(name);
      const s = randomSpawn();
      const hats = CATALOG.filter((c) => c.slot === "hat");
      const look: Look = {
        fur: pick(FUR_COLORS),
        hat: Math.random() < 0.85 ? pick(hats).id : null,
        scarf: Math.random() < 0.5 ? pick(CATALOG.filter((c) => c.slot === "scarf")).id : null,
        backpack: Math.random() < 0.35 ? pick(CATALOG.filter((c) => c.slot === "backpack")).id : null,
        trail: null,
      };
      this.bots.push({ id: `bot-${i}`, name, look, x: s.x * 2, z: s.z * 2, ry: 0, target: { x: s.x, z: s.z }, wait: rand(0, 3), speed: rand(2.5, 4.5) });
    }
  }

  private welcome() {
    this.inHub = true;
    this.emit({
      t: "welcome",
      you: this.me.id,
      token: "solo",
      room: { id: "solo-village", kind: "hub", isPrivate: true, code: "SOLO" },
      players: [this.me, ...this.bots],
      coins: this.save.coins,
      owned: this.save.owned,
      look: this.me.look,
    });
    this.lastVisit = visitedPlace(this.me.x, this.me.z);
    this.emit(questsWire(this.save, "solo"));
    this.emit(pineconesWire(this.save));
    this.emit({ t: "furniture", counts: this.save.furniture });
    this.emit(lifeWire(this.save));
    this.emit({ t: "club", club: this.save.club ? { ...this.save.club, members: [this.me.name, ...(this.save.botFriends ?? []).slice(0, 3)] } : null });
    this.emitFriends();
    this.emit({ t: "party", leader: this.party.length ? "you" : null, members: this.partyMembers() });
    store(this.save);
  }

  private party: string[] = [];

  private emitFriends() {
    const list = (this.save.botFriends ?? []).map((name) => {
      const b = this.bots.find((x) => x.name === name);
      return { pid: `bot:${name}`, name, online: !!b, where: b ? "Solo village" : null, joinable: false, look: b?.look ?? null };
    });
    this.emit({ t: "friends", list });
  }

  private partyMembers() {
    return this.party.length ? [{ pid: "you", name: this.me.name, online: true }, ...this.party.map((n) => ({ pid: `bot:${n}`, name: n, online: true }))] : [];
  }

  private out(msgs: ServerMsg[] | null) {
    if (!msgs) return;
    store(this.save);
    for (const m of msgs) this.emit(m);
  }

  private life(ev: LifeEvent) {
    this.out(recordEvent(this.save, "solo", null, ev));
  }

  private progress(ev: QuestEvent) {
    const w = questEvent(this.save, "solo", ev);
    if (!w) return;
    store(this.save);
    this.emit(w);
    if (w.justCompleted?.length || w.bonusNow) this.emit({ t: "wallet", coins: this.save.coins, owned: this.save.owned });
  }

  private cabinOwner = "";
  private botLikes: Record<string, boolean> = {};
  private botBooks: Record<string, { name: string; stamp: number; at: number }[]> = {};
  private golfHoled = false;

  private sendCabin(owner: { id: string; name: string; look: Look }, items: PlacedItem[], editable: boolean) {
    this.cabinOwner = owner.id;
    this.emit({ t: "furniture", counts: this.save.furniture });
    this.emit({ t: "cabin", owner: owner.id, ownerName: owner.name, items, editable, look: owner.look, social: this.socialFor(owner.id) });
  }

  /** Your cabin gets the odd like and guestbook stamp from the bot beavers next door. */
  private myLikes() {
    const week = weekKey();
    if (this.save.cabinLikes?.week !== week) this.save.cabinLikes = { week, pids: [] };
    return this.save.cabinLikes.pids.length;
  }

  private socialFor(owner: string): CabinSocial {
    if (owner === this.me.id) {
      this.myLikes();
      if (this.save.cabin.length > 4 && this.save.cabinLikes!.pids.length < this.bots.length && Math.random() < 0.5) {
        const b = this.bots[this.save.cabinLikes!.pids.length];
        this.save.cabinLikes!.pids.push(b.name);
        this.save.guestbook = [...(this.save.guestbook ?? []), { name: b.name, stamp: Math.floor(Math.random() * 12), at: Date.now() }].slice(-30);
        store(this.save);
      }
      return { likes: this.myLikes(), liked: false, guestbook: (this.save.guestbook ?? []).slice(-24) };
    }
    const i = this.bots.findIndex((b) => b.id === owner);
    const base = 2 + ((hashString(weekKey() + (this.bots[i]?.name ?? "")) + i) % 9);
    const rand = mulberry32(hashString(owner + weekKey()));
    const book = [0, 1, 2].map((k) => ({ name: BOT_NAMES[(i + k + 1) % BOT_NAMES.length], stamp: Math.floor(rand() * 12), at: Date.now() - (k + 1) * 3600_000 }));
    return { likes: base + (this.botLikes[owner] ? 1 : 0), liked: !!this.botLikes[owner], guestbook: [...book, ...(this.botBooks[owner] ?? [])] };
  }

  private emitClub() {
    store(this.save);
    this.emit({ t: "club", club: this.save.club ? { ...this.save.club, members: [this.me.name] } : null });
    this.emit({ t: "playerClub", id: this.me.id, club: this.save.club ? { tag: this.save.club.tag, color: this.save.club.color } : null });
  }

  /** Nearby bots join in when you dance, sing or skate, which counts as a group activity. */
  private botsJoinIn(a: string) {
    const near = this.bots.filter((b) => Math.hypot(b.x - this.me.x, b.z - this.me.z) < 14).slice(0, 2);
    const helpers = near.length ? near : this.bots.slice(0, 1);
    for (const b of helpers) {
      if (!near.includes(b)) { b.x = this.me.x + 2; b.z = this.me.z + 1.5; }
      b.wait = 12;
      b.target = { x: b.x, z: b.z };
      const act = a === "guitar" || a === "skate" ? "dance" : a;
      window.setTimeout(() => this.emit({ t: "act", id: b.id, a: act as "dance" }), 600);
      window.setTimeout(() => this.emit({ t: "act", id: b.id, a: "stop" }), 11000);
    }
    this.progress({ kind: "group" });
    this.save.coins += 5;
    this.emit({ t: "lifeSay", text: `🎶 Group fun with ${helpers.length + 1} beavers! +🪙5`, coins: 5 });
    this.emit({ t: "wallet", coins: this.save.coins, owned: this.save.owned });
  }

  /** Bot beavers post scores too, so the weekly board isn't lonely. */
  private leaderboard(game: MiniGame | "golf") {
    const week = weekKey();
    const rand = mulberry32(hashString(`${week}|${game}`));
    const info = game === "golf" ? null : ARCADE_INFO[game];
    const fake = (): number => {
      if (game === "golf") return Math.round(rand() * 14 - 2);
      if (info?.lowerIsBetter) return Math.round((44 + rand() * 18) * 10) / 10;
      if (game === "hunt") return Math.round(10 + rand() * 18);
      if (game === "logroll") return Math.round((15 + rand() * 45) * 10) / 10;
      if (game === "snowball") return Math.round(3 + rand() * 9);
      return Math.round(4 + rand() * 10);
    };
    const entries = BOT_NAMES.slice(0, 6).map((name) => ({ name, best: { week, score: fake() } }));
    entries.push({ name: this.me.name, best: this.save.bests?.[game] as { week: string; score: number }, me: true } as never);
    this.emit({ t: "leaderboard", game, week, rows: leaderRows(entries, game) });
  }

  private startGolf(holes: number) {
    if (this.golf || this.queued || this.sim) return;
    if (Math.hypot(this.me.x - TOWN_PLACES.clubhouse.x, this.me.z - TOWN_PLACES.clubhouse.z) > 10) {
      this.emit({ t: "error", text: "Walk to the golf clubhouse to tee off!" });
      return;
    }
    const others = this.party.length ? this.party.slice(0, 3) : [pick(BOT_NAMES)];
    const entrants = [{ id: this.me.id, name: this.me.name, isBot: false }, ...others.map((n, i) => ({ id: `gbot-${i}`, name: n, isBot: true }))];
    const g = (this.golf = new GolfMatch(holes, entrants, Math.floor(Math.random() * 2 ** 31)));
    this.golfHoled = false;
    this.inHub = false;
    const wire = () => g.players.map((p) => ({ id: p.id, name: p.name, isBot: p.isBot, ball: p.ball, strokes: [...p.strokes], done: p.done, quit: p.quit, look: p.isBot ? this.bots.find((b) => b.name === p.name)?.look ?? null : this.me.look }));
    this.emit({ t: "golfStart", holes: g.holes, players: wire() });
    let sentWait = false;
    this.golfTimer = window.setInterval(() => {
      const now = Date.now();
      for (const b of g.botTurns(now)) {
        this.emit({ t: "golfShot", id: b.id, club: b.club, path: b.result.path, holed: b.result.holed, penalty: b.result.penalty, lie: b.result.lie, strokes: g.strokes(g.players.find((p) => p.id === b.id)!) });
      }
      const waiting = g.nextAt;
      if (g.advance(now)) {
        sentWait = false;
        if (g.over) this.endGolf(false);
        else this.emit({ t: "golfState", idx: g.idx, players: wire(), nextAt: 0 });
      } else if (waiting && !sentWait) {
        sentWait = true;
        this.emit({ t: "golfState", idx: g.idx, players: wire(), nextAt: waiting });
      }
    }, 250);
    this.timers.push(this.golfTimer);
  }

  private endGolf(quit: boolean) {
    const g = this.golf;
    if (!g) return;
    clearInterval(this.golfTimer);
    if (quit) g.quit(this.me.id, Date.now());
    const totals = g.totals().map((t) => ({ ...t, coins: t.isBot ? 0 : golfCoins(t.holes, t.toPar, t.quit) }));
    const mine = totals.find((t) => t.id === this.me.id);
    if (mine) {
      this.save.coins += mine.coins;
      if (!quit && mine.holes === g.holes.length) recordBest(this.save, "golf", mine.toPar);
    }
    store(this.save);
    this.golf = null;
    this.emit({ t: "golfEnd", totals });
    this.emit({ t: "wallet", coins: this.save.coins, owned: this.save.owned });
    window.setTimeout(() => {
      this.me.x = TOWN_PLACES.clubhouse.x + rand(-2, 2);
      this.me.z = TOWN_PLACES.clubhouse.z - 4;
      this.welcome();
    }, quit ? 2500 : 6000);
  }

  send(msg: ClientMsg): void {
    switch (msg.t) {
      case "join": {
        this.me.name = String(msg.name || "Beaver").slice(0, 16);
        this.me.look = sanitizeLook(msg.look, this.save.owned, msg.look?.fur ?? DEFAULT_LOOK.fur);
        const s = randomSpawn();
        this.me.x = s.x;
        this.me.z = s.z;
        this.spawnBots();
        this.welcome();
        this.every(1000 / 12, () => this.tickBots(1 / 12));
        this.every(7000, () => this.botChatter());
        this.emit({ t: "system", text: "Solo preview: friendly bot beavers are keeping you company. 🦫" });
        break;
      }
      case "move": {
        const now = performance.now();
        const p = validateMove(this.me, { x: msg.x, z: msg.z }, now - this.lastMove);
        this.lastMove = now;
        this.me.x = p.x;
        this.me.z = p.z;
        this.me.ry = msg.ry;
        const place = visitedPlace(this.me.x, this.me.z);
        if (place && place !== this.lastVisit) this.out(recordVisit(this.save, "solo", place));
        this.lastVisit = place;
        break;
      }
      case "chat": {
        const r = filterChat(msg.text);
        if (!r.ok) {
          if (r.reason === "personal_info") this.emit({ t: "system", text: "For safety, don't share emails, phone numbers or links." });
          return;
        }
        if (!this.limiter.allow(r.text)) return this.emit({ t: "system", text: "Slow down a little! 🦫" });
        this.emit({ t: "chat", id: this.me.id, name: this.me.name, text: r.text });
        this.maybeReply(r.text);
        break;
      }
      case "quick": {
        const text = QUICK_CHAT[msg.i];
        if (text && this.limiter.allow(text)) {
          this.emit({ t: "chat", id: this.me.id, name: this.me.name, text });
          this.maybeReply(text);
          this.progress({ kind: "quickchat" });
        }
        break;
      }
      case "act": {
        if (!actAllowed(msg.a, this.me.x, this.me.z)) break;
        this.emit({ t: "act", id: this.me.id, a: msg.a });
        this.myAct = msg.a === "stop" ? null : msg.a;
        if (msg.a === "stop") break;
        const kind = ACT_QUEST[msg.a];
        if (kind) this.progress({ kind });
        this.life({ kind: "act", a: msg.a });
        if (GROUP_ACTS.includes(msg.a)) this.botsJoinIn(msg.a);
        break;
      }
      case "emote":
        if (EMOTES[msg.i]) {
          this.emit({ t: "emote", id: this.me.id, i: msg.i });
          this.progress({ kind: "emote" });
        }
        break;
      case "look":
        this.me.look = sanitizeLook(msg.look, this.save.owned, this.me.look.fur);
        this.save.look = this.me.look;
        store(this.save);
        this.emit({ t: "look", id: this.me.id, look: this.me.look });
        break;
      case "buy": {
        const r = purchase(this.save, msg.item);
        if (r.ok) {
          this.save = { ...this.save, ...r.wallet };
          store(this.save);
          this.emit({ t: "wallet", coins: this.save.coins, owned: this.save.owned });
          const item = CATALOG.find((c) => c.id === msg.item);
          this.emit({ t: "system", text: `You bought the ${item?.name}! 🎉` });
          this.progress({ kind: "buy" });
        } else {
          this.emit({ t: "error", text: r.reason === "not_enough_coins" ? "Not enough coins yet — try a toboggan race!" : "You can't buy that." });
        }
        break;
      }
      case "queueRace":
      case "queueGame": {
        const game: MiniGame = msg.t === "queueRace" ? (msg.game === "canoe" ? "canoe" : "toboggan") : msg.game;
        if (!(game in ARCADE_INFO)) return;
        const spot = (HUB_PLACES as Record<string, { x: number; z: number }>)[GAME_SPOTS[game]] ?? (TOWN_PLACES as Record<string, { x: number; z: number }>)[GAME_SPOTS[game]];
        const reach = game === "toboggan" ? PORTAL_RADIUS + 2 : game === "canoe" ? 7 : 11;
        if (Math.hypot(this.me.x - spot.x, this.me.z - spot.z) > reach) {
          this.emit({ t: "error", text: game === "canoe" ? "Walk to the Lake Dock to join the Canoe Dash!" : game === "toboggan" ? "Walk to the trailhead portal to join the race!" : `Walk over to play ${ARCADE_INFO[game].name}!` });
          return;
        }
        if (this.queued || this.sim) return;
        this.queued = true;
        this.emit({ t: "queue", count: 1, size: RACE.size, startsInMs: 2500 });
        window.setTimeout(() => {
          if (this.queued) this.startRace(game);
        }, 2500);
        break;
      }
      case "leaveQueue":
        this.queued = false;
        break;
      case "steer":
        this.steer = Math.max(-1, Math.min(1, Number(msg.v) || 0));
        this.inp.steer = this.steer;
        break;
      case "input":
        this.inp = { steer: Math.max(-1, Math.min(1, Number(msg.steer) || 0)), fwd: Math.max(-1, Math.min(1, Number(msg.fwd) || 0)), press: this.inp.press || !!msg.press };
        this.steer = this.inp.steer;
        break;
      case "leaderboard":
        this.leaderboard(msg.game);
        break;
      case "fish": case "spot": case "read": case "plant": case "water": case "harvest": case "sell": case "talk":
        if (!this.inHub) break;
        this.out(handleLife(this.save, "solo", msg, this.me.x, this.me.z));
        break;
      case "gift": {
        const name = String(msg.pid).replace(/^bot:/, "");
        if (!(this.save.botFriends ?? []).includes(name)) { this.emit({ t: "error", text: "You can only send gifts to friends." }); break; }
        if (!ITEMS[msg.item] || !takeItem(this.save, msg.item, 1)) break;
        this.emit({ t: "lifeSay", text: `🎁 You sent ${name} a ${ITEMS[msg.item].icon} ${ITEMS[msg.item].name}!` });
        this.out([lifeWire(this.save)]);
        this.progress({ kind: "gift" });
        const b = this.bots.find((x) => x.name === name);
        window.setTimeout(() => {
          if (b) { this.emit({ t: "chat", id: b.id, name, text: "Thank you!! 💛" }); this.emit({ t: "emote", id: b.id, i: 2 }); }
          // Bots like to return the favour with a fresh croissant.
          if (Math.random() < 0.6) { this.save.bag = { ...(this.save.bag ?? {}), croissant: (this.save.bag?.croissant ?? 0) + 1 }; this.emit({ t: "gift", from: `bot:${name}`, name, item: "croissant" }); this.out([lifeWire(this.save)]); }
        }, 1200);
        break;
      }
      case "likeCabin":
      case "signGuestbook":
        if (!this.inCabin || this.cabinOwner === this.me.id) break;
        if (msg.t === "likeCabin") this.botLikes[this.cabinOwner] = true;
        else (this.botBooks[this.cabinOwner] ??= []).push({ name: this.me.name, stamp: Math.max(0, Math.min(11, Number(msg.stamp) || 0)), at: Date.now() });
        this.emit({ t: "cabinSocial", social: this.socialFor(this.cabinOwner) });
        break;
      case "neighbours": {
        const likes = (b: Bot, i: number) => 2 + ((hashString(weekKey() + b.name) + i) % 9) + (this.botLikes[b.id] ? 1 : 0);
        const list = [{ id: this.me.id, name: this.me.name, likes: this.myLikes(), online: true, you: true }, ...this.bots.map((b, i) => ({ id: b.id, name: b.name, likes: likes(b, i), online: true }))];
        const coziest = [...list].sort((a, b) => b.likes - a.likes).slice(0, 5).map((x) => ({ name: x.name, likes: x.likes }));
        this.emit({ t: "neighbours", list, coziest });
        break;
      }
      case "clubCreate": {
        const name = String(msg.name ?? "").replace(/[^\p{L}\p{N} '&-]/gu, "").trim().slice(0, 20);
        if (name.length < 3) { this.emit({ t: "error", text: "Club names need at least 3 letters." }); break; }
        const tag = name.replace(/[^\p{L}\p{N}]/gu, "").slice(0, 4).toUpperCase() || "CLUB";
        this.save.club = { code: "SOLO" + (hashString(name) % 10), name, tag, color: msg.color || "#e2483d" };
        this.emitClub();
        this.emit({ t: "system", text: `🎉 Club "${name}" created! (Clubs you can share work when you play online.)` });
        break;
      }
      case "clubJoin":
        this.emit({ t: "error", text: "Joining clubs by code works when you play online." });
        break;
      case "clubLeave":
        this.save.club = null;
        this.emitClub();
        break;
      case "gondola":
        if (msg.up) {
          if (!this.inHub || Math.hypot(this.me.x - TOWN_PLACES.gondola.x, this.me.z - TOWN_PLACES.gondola.z) > 9) break;
          this.inHub = false;
          this.summit = true;
          this.emit({ t: "summit", players: [] });
          this.out(recordVisit(this.save, "solo", "summit"));
        } else if (this.summit) {
          this.summit = false;
          this.me.x = TOWN_PLACES.gondola.x + 2;
          this.me.z = TOWN_PLACES.gondola.z + 3;
          this.welcome();
        }
        break;
      case "golfQueue":
        this.startGolf(Number(msg.holes));
        break;
      case "golfShot": {
        const g = this.golf;
        if (!g) break;
        const r = g.shoot(this.me.id, Number(msg.aim), Number(msg.power), msg.club, Date.now());
        if (!r) break;
        const p = g.players.find((x) => x.id === this.me.id)!;
        this.emit({ t: "golfShot", id: this.me.id, club: msg.club, path: r.path, holed: r.holed, penalty: r.penalty, lie: r.lie, strokes: g.strokes(p) });
        if (p.done && !this.golfHoled) { this.golfHoled = true; this.progress({ kind: "golf" }); }
        break;
      }
      case "golfAim":
        break;
      case "golfQuit":
        if (this.golf) this.endGolf(true);
        else this.queued = false;
        break;
      case "buyFurniture": {
        const r = buyFurniture(this.save.coins, this.save.furniture, msg.item, seasonAt());
        if (!r.ok) {
          this.emit({ t: "error", text: r.reason === "not_enough_coins" ? "Not enough coins yet — try a race or a daily quest!" : r.reason === "too_many" ? "Your cabin has room for 6 of those." : "You can't buy that." });
          break;
        }
        this.save.coins = r.coins;
        this.save.furniture = r.counts;
        store(this.save);
        this.emit({ t: "furniture", counts: this.save.furniture });
        this.emit({ t: "wallet", coins: this.save.coins, owned: this.save.owned });
        this.emit({ t: "system", text: `You bought a ${FURNITURE_BY_ID[msg.item].name}! 🏡` });
        this.progress({ kind: "buy" });
        break;
      }
      case "collect": {
        if (!this.inHub) break;
        const r = collectPinecone(this.save, "solo", Number(msg.id), this.me.x, this.me.z);
        if (!r.ok) break;
        store(this.save);
        this.emit(pineconesWire(this.save));
        this.emit({ t: "wallet", coins: this.save.coins, owned: this.save.owned });
        if (r.quests) this.emit(r.quests);
        this.life({ kind: "pinecone" });
        break;
      }
      case "photo": {
        this.progress({ kind: "photo" });
        this.life({ kind: "photo" });
        const near = this.bots.filter((b) => Math.hypot(b.x - this.me.x, b.z - this.me.z) < 10).length;
        if (near >= 2) {
          this.progress({ kind: "group" });
          this.emit({ t: "lifeSay", text: `📸 Group photo with ${near + 1} beavers! Say cheese!` });
        }
        break;
      }
      case "enterCabin":
      case "visitCabin": {
        if (!this.inHub || this.queued) break;
        let owner: { id: string; name: string; look: Look } = this.me;
        let items = this.save.cabin;
        if (msg.t === "visitCabin") {
          const i = this.bots.findIndex((b) => b.id === msg.id);
          if (i < 0) break;
          owner = this.bots[i];
          items = BOT_CABINS[i % BOT_CABINS.length];
        }
        this.inHub = false;
        this.inCabin = true;
        this.returnPos = { x: this.me.x, z: this.me.z };
        this.sendCabin(owner, items, owner === this.me);
        break;
      }
      case "saveCabin": {
        if (!this.inCabin) break;
        const r = validateLayout(msg.items, this.save.furniture);
        if (!r.ok) {
          this.emit({ t: "error", text: r.reason });
          this.sendCabin(this.me, this.save.cabin, true);
          break;
        }
        this.save.cabin = r.items;
        store(this.save);
        if (r.items.length > 0) this.progress({ kind: "decorate" });
        break;
      }
      case "leaveCabin":
        if (!this.inCabin) break;
        this.inCabin = false;
        if (this.returnPos) {
          this.me.x = this.returnPos.x;
          this.me.z = this.returnPos.z;
        }
        this.welcome();
        break;
      case "friendRequest": {
        if (msg.code) { this.emit({ t: "error", text: "Friend codes work when you play online." }); break; }
        const b = this.bots.find((x) => x.id === msg.id);
        if (!b) break;
        const list = (this.save.botFriends ??= []);
        if (list.includes(b.name)) { this.emit({ t: "system", text: `You're already friends with ${b.name}! 🤝` }); break; }
        this.emit({ t: "system", text: `Friend request sent to ${b.name}.` });
        window.setTimeout(() => {
          list.push(b.name);
          store(this.save);
          this.emitFriends();
          this.emit({ t: "system", text: `${b.name} is now your friend! 🤝` });
          this.emit({ t: "chat", id: b.id, name: b.name, text: "Yay, friends! 🦫" });
          this.emit({ t: "emote", id: b.id, i: 3 });
          this.progress({ kind: "friend" });
          this.life({ kind: "friend" });
        }, 1200);
        break;
      }
      case "friendRemove":
        this.save.botFriends = (this.save.botFriends ?? []).filter((n) => `bot:${n}` !== msg.pid);
        this.party = this.party.filter((n) => `bot:${n}` !== msg.pid);
        store(this.save);
        this.emitFriends();
        this.emit({ t: "party", leader: this.party.length ? "you" : null, members: this.partyMembers() });
        break;
      case "partyInvite": {
        const name = String(msg.pid).replace(/^bot:/, "");
        if (this.party.includes(name) || this.party.length >= 3) break;
        window.setTimeout(() => {
          this.party.push(name);
          this.emit({ t: "party", leader: "you", members: this.partyMembers() });
          this.emit({ t: "system", text: `${name} joined your party! 🎉` });
          this.progress({ kind: "friend" });
        }, 900);
        break;
      }
      case "partyLeave":
        this.party = [];
        this.emit({ t: "party", leader: null, members: [] });
        break;
      case "joinFriend":
      case "friendRespond":
      case "partyRespond":
        break;
      case "block":
      case "report":
        this.emit({ t: "system", text: msg.t === "report" ? "Thanks — a moderator will take a look." : "Blocked." });
        break;
    }
  }

  private raceGame: MiniGame = "toboggan";

  private startRace(game: MiniGame) {
    this.raceGame = game;
    this.queued = false;
    this.inHub = false;
    const isRace = game === "toboggan" || game === "canoe";
    // Your party comes along; random bot beavers fill any empty seats.
    const size = game === "dam" ? 2 + Math.min(2, this.party.length) : RACE.size;
    const others = BOT_NAMES.filter((n) => !this.party.includes(n)).sort(() => Math.random() - 0.5);
    const botNames = [...this.party, ...others].slice(0, size - 1);
    const entrants = [
      { id: this.me.id, name: this.me.name, isBot: false },
      ...botNames.map((n, i) => ({ id: `rbot-${i}`, name: n, isBot: true })),
    ];
    const seed = Math.floor(Math.random() * 2 ** 31);
    const sim = (this.sim = makeSim(game, seed, entrants));
    this.steer = 0;
    this.inp = { steer: 0, fwd: 0, press: false };
    const players = entrants.map((e, i) => ({ ...e, look: e.isBot ? this.bots.find((b) => b.name === e.name)?.look ?? this.bots[i % this.bots.length]?.look ?? null : this.me.look }));
    if (isRace) this.emit({ t: "raceStart", game: game as RaceGame, seed, countdownMs: RACE.countdownMs, racers: players });
    else this.emit({ t: "gameStart", game, seed, countdownMs: RACE.countdownMs, players });
    window.setTimeout(() => {
      const dt = 1 / RACE.tickRate;
      const id = window.setInterval(() => {
        if (this.sim !== sim) return clearInterval(id);
        sim.step(dt, { [this.me.id]: { ...this.inp } });
        this.inp.press = false;
        if (isRace) this.emit({ t: "race", time: sim.t, r: sim.snapshot() as RaceSnapshot });
        else this.emit({ t: "game", time: Math.round(sim.t * 100) / 100, s: sim.snapshot() });
        if (sim.isOver()) {
          clearInterval(id);
          this.finishRace(sim, isRace);
        }
      }, 1000 / RACE.tickRate);
      this.timers.push(id);
    }, RACE.countdownMs);
  }

  private finishRace(sim: GameSim, isRace: boolean) {
    const game = this.raceGame;
    const n = sim.results().length;
    const results = sim.results().map((r) => ({ ...r, coins: r.isBot ? 0 : isRace ? coinsForRace({ place: r.place, finished: r.finished, racers: n }) : coinsForGame(game, r, 1) }));
    const mine = results.find((r) => r.id === this.me.id);
    this.save.coins += mine?.coins ?? 0;
    if (mine) {
      if (isRace) {
        if (mine.finished && mine.time !== null) recordBest(this.save, game, mine.time);
        if (mine.finished) {
          this.progress({ kind: game === "canoe" ? "canoe" : "race" });
          if (mine.place <= 2) this.progress({ kind: "podium" });
        }
      } else {
        this.progress({ kind: "arcade" });
        if (recordBest(this.save, game, mine.score)) this.emit({ t: "system", text: `⭐ New weekly best in ${ARCADE_INFO[game].name}: ${mine.score}!` });
      }
      this.life({ kind: "race", game });
    }
    store(this.save);
    this.sim = null;
    if (isRace) this.emit({ t: "raceEnd", results });
    else this.emit({ t: "gameEnd", game, results });
    this.emit({ t: "wallet", coins: this.save.coins, owned: this.save.owned });
    window.setTimeout(() => {
      const spot = (TOWN_PLACES as Record<string, { x: number; z: number }>)[GAME_SPOTS[game]];
      const t = game === "canoe" ? { x: HUB_PLACES.dock.x + 3, z: HUB_PLACES.dock.z - 15 } : isRace || !spot ? { x: HUB_PLACES.trailhead.x, z: HUB_PLACES.trailhead.z } : { x: spot.x, z: spot.z - 6 };
      this.me.x = t.x + rand(-3, 3);
      this.me.z = t.z + (isRace ? 9 : 3);
      this.welcome();
    }, 5000);
  }

  private tickBots(dt: number) {
    if (!this.inHub) return;
    for (const b of this.bots) {
      if (b.wait > 0) {
        b.wait -= dt;
        continue;
      }
      const dx = b.target.x - b.x, dz = b.target.z - b.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.6) {
        b.wait = rand(2, 7);
        const pl = pick(PLACES);
        const a = rand(0, Math.PI * 2), r = rand(3, 7) + (pl.r ?? 0);
        b.target = { x: pl.x + Math.cos(a) * r, z: pl.z + Math.sin(a) * r };
        if (Math.random() < 0.25) this.emit({ t: "emote", id: b.id, i: Math.floor(Math.random() * EMOTES.length) });
        continue;
      }
      const step = Math.min(d, b.speed * dt);
      const next = validateMove(b, { x: b.x + (dx / d) * step, z: b.z + (dz / d) * step }, dt * 1000);
      if (Math.hypot(next.x - b.x, next.z - b.z) < step * 0.3) b.target = { x: b.x + rand(-6, 6), z: b.z + rand(-6, 6) }; // stuck
      b.x = next.x;
      b.z = next.z;
      b.ry = Math.atan2(dx, dz);
    }
    this.emit({ t: "state", p: [this.me, ...this.bots].map((p) => [p.id, p.x, p.z, p.ry]) });
  }

  private botChatter() {
    if (!this.inHub || Math.random() < 0.4) return;
    const b = pick(this.bots);
    this.emit({ t: "chat", id: b.id, name: b.name, text: pick(QUICK_CHAT) });
  }

  private maybeReply(text: string) {
    const nearest = [...this.bots].sort((a, b) => Math.hypot(a.x - this.me.x, a.z - this.me.z) - Math.hypot(b.x - this.me.x, b.z - this.me.z))[0];
    if (!nearest || Math.random() < 0.3) return;
    const lower = text.toLowerCase();
    const reply = /hi|hello|hey/.test(lower)
      ? "Hi there! 👋"
      : /race|toboggan|sled/.test(lower)
        ? "Race you down the hill! 🛷"
        : /friend/.test(lower)
          ? "Yes! Let's be friends 🦫"
          : /hat|nice|cool/.test(lower)
            ? "Nice hat!"
            : pick(QUICK_CHAT);
    window.setTimeout(() => this.emit({ t: "chat", id: nearest.id, name: nearest.name, text: reply }), 900 + Math.random() * 900);
  }
}
