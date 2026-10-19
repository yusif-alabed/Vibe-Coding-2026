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
} from "@beaver/shared";
import type { Net } from "./net";

/**
 * Solo mode: runs the same shared game rules as the real server, right in the browser,
 * with friendly bot beavers wandering the village. Used for the playable preview and
 * when no game server is reachable.
 */

const SAVE_KEY = "beaver-banff-solo";

interface Save {
  coins: number;
  owned: string[];
  look: Look;
}

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
  private race: TobogganRace | null = null;
  private steer = 0;
  private inHub = false;
  private queued = false;

  constructor() {
    this.save = load() ?? { coins: ECONOMY.startingCoins, owned: [...STARTER_ITEMS], look: DEFAULT_LOOK };
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
        }
        break;
      }
      case "emote":
        if (EMOTES[msg.i]) this.emit({ t: "emote", id: this.me.id, i: msg.i });
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
        } else {
          this.emit({ t: "error", text: r.reason === "not_enough_coins" ? "Not enough coins yet — try a toboggan race!" : "You can't buy that." });
        }
        break;
      }
      case "queueRace": {
        const t = HUB_PLACES.trailhead;
        if (Math.hypot(this.me.x - t.x, this.me.z - t.z) > PORTAL_RADIUS + 2) {
          this.emit({ t: "error", text: "Walk to the trailhead portal to join the race!" });
          return;
        }
        if (this.queued || this.race) return;
        this.queued = true;
        this.emit({ t: "queue", count: 1, size: RACE.size, startsInMs: 2500 });
        window.setTimeout(() => {
          if (this.queued) this.startRace();
        }, 2500);
        break;
      }
      case "leaveQueue":
        this.queued = false;
        break;
      case "steer":
        this.steer = Math.max(-1, Math.min(1, Number(msg.v) || 0));
        break;
      case "block":
      case "report":
        this.emit({ t: "system", text: msg.t === "report" ? "Thanks — a moderator will take a look." : "Blocked." });
        break;
    }
  }

  private startRace() {
    this.queued = false;
    this.inHub = false;
    const botNames = BOT_NAMES.filter(() => true).sort(() => Math.random() - 0.5).slice(0, RACE.size - 1);
    const entrants = [
      { id: this.me.id, name: this.me.name, isBot: false },
      ...botNames.map((n, i) => ({ id: `rbot-${i}`, name: n, isBot: true })),
    ];
    const seed = Math.floor(Math.random() * 2 ** 31);
    this.race = new TobogganRace(seed, entrants);
    this.steer = 0;
    const botLooks = this.bots;
    this.emit({
      t: "raceStart",
      seed,
      countdownMs: RACE.countdownMs,
      racers: entrants.map((e, i) => ({ ...e, look: e.isBot ? botLooks[i % botLooks.length]?.look ?? null : this.me.look })),
    });
    window.setTimeout(() => {
      const dt = 1 / RACE.tickRate;
      const id = window.setInterval(() => {
        const race = this.race;
        if (!race) return clearInterval(id);
        race.step(dt, { [this.me.id]: this.steer });
        this.emit({ t: "race", time: race.t, r: race.snapshot() });
        if (race.isOver()) {
          clearInterval(id);
          this.finishRace(race);
        }
      }, 1000 / RACE.tickRate);
      this.timers.push(id);
    }, RACE.countdownMs);
  }

  private finishRace(race: TobogganRace) {
    const n = race.racers.length;
    const results = race.results().map((r) => ({ ...r, coins: r.isBot ? 0 : coinsForRace({ place: r.place, finished: r.finished, racers: n }) }));
    const mine = results.find((r) => r.id === this.me.id);
    this.save.coins += mine?.coins ?? 0;
    store(this.save);
    this.race = null;
    this.emit({ t: "raceEnd", results });
    this.emit({ t: "wallet", coins: this.save.coins, owned: this.save.owned });
    window.setTimeout(() => {
      const t = HUB_PLACES.trailhead;
      this.me.x = t.x + rand(-3, 3);
      this.me.z = t.z + 9;
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
