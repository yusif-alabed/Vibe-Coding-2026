import {
  ARCADE_INFO,
  BANFF_FACTS,
  BUGS,
  CATALOG_BY_ID,
  FISH,
  FURNITURE_BY_ID,
  GARDEN_PLOTS,
  GOLF_HOLES,
  ITEMS,
  JOURNAL_PAGES,
  JOURNAL_PLACES,
  SEED_PRICE,
  SEEDS,
  type LeaderRow,
  type LifeWire,
  type MiniGame,
  type PageId,
  type SeedId,
} from "@beaver/shared";
import type { Ctx } from "../game/scene";
import { h, toast } from "./dom";

/**
 * Village-life panels: 📖 collections journal & badges, 🧺 bag (sell / gift), 🥕 garden plots,
 * townsfolk dialogue, 🎣 the fishing bite minigame, 🏅 clubs, 🏡 Cottage Lane neighbours,
 * 🏆 weekly leaderboards and ⛳ the golf tee-off screen.
 */

export interface Panel { el: HTMLElement; refresh: () => void }

function overlay(root: HTMLElement, title: string, body: HTMLElement, onClose?: () => void): HTMLElement {
  const close = () => { el.remove(); onClose?.(); };
  const el = h("div.overlay.pe", { onclick: (e: Event) => { if (e.target === el) close(); } }, h("div.card.panel.settings", {}, [
    h("header", {}, [h("h2", {}, title), h("button.btn.cream.small", { onclick: close }, "✕")]),
    body,
  ]));
  root.append(el);
  return el;
}

export const PLACE_TITLES: Record<string, string> = {
  lodge: "☕ Lodge Café", hotSpring: "♨️ Hot Springs", dock: "🛶 Lake Dock", trailhead: "🛷 Trailhead", outfitter: "🎒 Outfitter", arcade: "🕹️ Arcade",
  bakery: "🥐 Bakery", post: "📮 Post Office", library: "📚 Library", icecream: "🍦 Ice Cream", townHall: "🏛️ Town Hall", bandstand: "🎺 Bandstand",
  windmill: "🌾 Windmill", rink: "⛸️ Skating Pond", lighthouse: "🗼 Lighthouse", watermill: "⚙️ Watermill", lookout: "🔥 Fire Lookout",
  observatory: "🔭 Observatory", ferris: "🎡 Ferris Wheel", ranger: "🌲 Ranger Station", camp: "🏕️ Campground", maple: "🍁 Maple Shop",
  greenhouse: "🌻 Greenhouse", clubhouse: "⛳ Golf Clubhouse", station: "🚂 Valley Station", balloons: "🎈 Balloon Meadow", gondola: "🚡 Gondola",
  garden: "🥕 Garden", dyeshop: "🎨 Dye Shop", summit: "🏔️ Summit",
};

// ------------------------------------------------------------------ Journal

export function openJournal(ctx: Ctx, root: HTMLElement): Panel {
  let tab: PageId | "badges" = "fish";
  const body = h("div.settings-body");
  const refresh = () => {
    const life = ctx.state.life;
    const j = life?.journal ?? { fish: {}, bugs: {}, facts: [], places: [], badges: [], biggest: {} };
    const count = (id: PageId) => (id === "fish" ? Object.keys(j.fish).filter((k) => JOURNAL_PAGES.fish.ids.includes(k as never)).length : id === "bugs" ? Object.keys(j.bugs).length : id === "places" ? j.places.length : j.facts.length);
    const tabs = h("div.tabs", { style: "padding:0 0 8px" }, [
      ...(Object.keys(JOURNAL_PAGES) as PageId[]).map((id) => h("button.tab" + (tab === id ? ".on" : ""), { onclick: () => { tab = id; refresh(); } }, `${JOURNAL_PAGES[id].icon} ${count(id)}/${JOURNAL_PAGES[id].ids.length}`)),
      h("button.tab" + (tab === "badges" ? ".on" : ""), { onclick: () => { tab = "badges"; refresh(); } }, `🏅 ${j.badges.length}`),
    ]);
    let list: HTMLElement;
    if (tab === "badges") {
      list = h("div", {}, (Object.keys(JOURNAL_PAGES) as PageId[]).map((id) => {
        const p = JOURNAL_PAGES[id];
        const got = j.badges.includes(p.badge);
        const rw = p.reward as { coins: number; item?: string; furniture?: string };
        return h("div.friend", {}, [
          h("span", { style: "font-size:26px" }, got ? p.badge.split(" ")[0] : "🔒"),
          h("div", { style: "flex:1" }, [h("b", {}, p.badge.split(" ").slice(1).join(" ")), h("div.hint", { style: "margin:0" }, `Fill the ${p.name} page · 🪙${rw.coins}${rw.item ? ` + ${CATALOG_BY_ID[rw.item]?.name}` : ""}${rw.furniture ? ` + ${FURNITURE_BY_ID[rw.furniture]?.name}` : ""}`)]),
          h("span", {}, got ? "✅" : `${count(id)}/${p.ids.length}`),
        ]);
      }));
    } else if (tab === "fish") {
      list = h("div.grid", {}, FISH.filter((f) => !f.junk).map((f) => {
        const n = j.fish[f.id] ?? 0;
        const when = [f.where === "both" ? "lake & river" : f.where, f.night ? "at night" : f.day ? "by day" : "", f.rainOnly ? "in the rain" : "", f.seasons ? f.seasons.join("/") : ""].filter(Boolean).join(" · ");
        return h("div.item" + (n ? "" : ".locked"), {}, [
          h("div.ico", { style: { background: n ? "#cfeef0" : "#e8e0d4" } }, n ? f.icon : "❔"),
          h("div.nm", {}, n ? f.name : "???"),
          h("div.price", {}, n ? `×${n} · best ${j.biggest[f.id] ?? 0} cm` : when),
        ]);
      }));
    } else if (tab === "bugs") {
      list = h("div.grid", {}, BUGS.map((b) => {
        const n = j.bugs[b.id] ?? 0;
        const when = [b.night ? "at night" : b.day ? "by day" : "", b.seasons ? b.seasons.join("/") : "all year"].filter(Boolean).join(" · ");
        return h("div.item" + (n ? "" : ".locked"), {}, [
          h("div.ico", { style: { background: n ? "#fdf0c8" : "#e8e0d4" } }, n ? b.icon : "❔"),
          h("div.nm", {}, n ? b.name : "???"),
          h("div.price", {}, n ? `Spotted ×${n}` : when),
        ]);
      }));
    } else if (tab === "places") {
      list = h("div.grid", {}, JOURNAL_PLACES.map((p) => {
        const got = j.places.includes(p);
        return h("div.item" + (got ? "" : ".locked"), {}, [h("div.ico", { style: { background: got ? "#dff3d8" : "#e8e0d4" } }, got ? (PLACE_TITLES[p] ?? "📍").split(" ")[0] : "❔"), h("div.nm", {}, got ? (PLACE_TITLES[p] ?? p).split(" ").slice(1).join(" ") : "Undiscovered")]);
      }));
    } else {
      list = h("div", {}, BANFF_FACTS.map((f, i) => h("div.friend", {}, [h("span", {}, j.facts.includes(i) ? "📗" : "📕"), h("div", { style: "flex:1" }, j.facts.includes(i) ? f : h("span.hint", { style: "margin:0" }, "Read more at the 📚 Library, or find a message in a bottle…"))])));
    }
    const page = tab === "badges" ? null : JOURNAL_PAGES[tab];
    body.replaceChildren(
      tabs,
      page ? h("div.hint", { style: "margin:0 0 8px" }, `Fill this page for the ${page.badge} badge and 🪙${page.reward.coins}!`) : h("div.hint", { style: "margin:0 0 8px" }, "Badges show next to your name in the journal. Collect them all!"),
      list,
    );
  };
  refresh();
  const el = overlay(root, "📖 Banff Journal", body);
  return { el, refresh };
}

// ------------------------------------------------------------------ Bag

export function openBag(ctx: Ctx, root: HTMLElement): Panel {
  const body = h("div.settings-body");
  let giftItem: string | null = null;
  const refresh = () => {
    const bag = ctx.state.life?.bag ?? {};
    const ids = Object.keys(bag).filter((k) => bag[k] > 0);
    const friends = ctx.state.friends;
    body.replaceChildren(
      ids.length
        ? h("div.grid", {}, ids.map((id) => {
            const it = ITEMS[id];
            if (!it) return null;
            return h("div.item", {}, [
              h("div.ico", { style: { background: "#f7e8c9" } }, it.icon),
              h("div.nm", {}, `${it.name} ×${bag[id]}`),
              h("div.row", { style: "justify-content:center;flex-wrap:wrap;gap:4px" }, [
                h("button.btn.small.gold", { onclick: () => ctx.net.send({ t: "sell", item: id, n: 1 }) }, `Sell 🪙${it.price}`),
                bag[id] > 1 ? h("button.btn.small.cream", { onclick: () => ctx.net.send({ t: "sell", item: id, n: bag[id] }) }, "All") : null,
                h("button.btn.small", { onclick: () => { giftItem = giftItem === id ? null : id; refresh(); } }, "🎁"),
              ]),
            ]);
          }))
        : h("div.hint", {}, "Your bag is empty. Go 🎣 fishing at the lake or river, grow veggies in the 🥕 community garden, or pick up treats in town!"),
      giftItem && ITEMS[giftItem]
        ? h("div", {}, [
            h("h3", {}, `🎁 Send a ${ITEMS[giftItem].icon} ${ITEMS[giftItem].name} to…`),
            friends.length
              ? h("div.row", { style: "flex-wrap:wrap" }, friends.map((f) => h("button.btn.small", { onclick: () => { ctx.net.send({ t: "gift", pid: f.pid, item: giftItem! }); giftItem = null; } }, `${f.online ? "🟢" : "⚪"} ${f.name}`)))
              : h("div.hint", {}, "Add some friends first (tap a beaver → 🤝 Add friend)."),
          ])
        : "",
    );
  };
  refresh();
  const el = overlay(root, "🧺 Your Bag", body);
  return { el, refresh };
}

// ------------------------------------------------------------------ Garden

export function openGarden(ctx: Ctx, root: HTMLElement): Panel {
  const body = h("div.settings-body");
  let picking: number | null = null;
  let timer = 0;
  // Countdown labels are updated in place each second (re-rendering would swallow taps).
  let clocks: { el: HTMLElement; readyAt: number; watered: boolean }[] = [];
  const refresh = () => {
    const g: LifeWire["garden"] = ctx.state.life?.garden ?? Array(GARDEN_PLOTS).fill(null);
    const now = Date.now();
    clocks = [];
    body.replaceChildren(
      h("div.hint", { style: "margin:0 0 8px" }, `Seeds cost 🪙${SEED_PRICE}. Water them to grow 40% faster. Harvests go in your 🧺 bag — sell them, gift them, or bring them to the townsfolk.`),
      h("div.grid", {}, g.map((p, i) => {
        if (!p) return h("div.item", {}, [h("div.ico", { style: { background: "#c9a46a" } }, "🟫"), h("div.nm", {}, `Plot ${i + 1}`), h("button.btn.small.gold", { onclick: () => { picking = i; refresh(); } }, "🌱 Plant")]);
        const s = SEEDS[p.seed];
        const left = Math.max(0, p.readyAt - now);
        const ready = left <= 0;
        const clock = h("div.price", {}, ready ? "Ready!" : `${Math.ceil(left / 1000)}s${p.watered ? " · 💧" : ""}`);
        if (!ready) clocks.push({ el: clock, readyAt: p.readyAt, watered: p.watered });
        return h("div.item", {}, [
          h("div.ico", { style: { background: ready ? "#c7f0b8" : "#d9c39a" } }, ready ? s.icon : left > 60_000 ? "🌱" : "🌿"),
          h("div.nm", {}, s.name),
          clock,
          ready
            ? h("button.btn.small.gold", { onclick: () => ctx.net.send({ t: "harvest", plot: i }) }, "🧺 Harvest")
            : p.watered ? h("span.hint", { style: "margin:0" }, "Growing…") : h("button.btn.small", { onclick: () => ctx.net.send({ t: "water", plot: i }) }, "💧 Water"),
        ]);
      })),
      picking !== null
        ? h("div", {}, [
            h("h3", {}, `Plant in plot ${picking + 1}:`),
            h("div.row", { style: "flex-wrap:wrap" }, (Object.keys(SEEDS) as SeedId[]).map((id) => h("button.btn.small", { onclick: () => { ctx.net.send({ t: "plant", plot: picking!, seed: id }); picking = null; } }, `${SEEDS[id].icon} ${SEEDS[id].name} · ${SEEDS[id].minutes} min`))),
          ])
        : "",
    );
  };
  refresh();
  timer = window.setInterval(() => {
    if (!el.isConnected) { clearInterval(timer); return; }
    const now = Date.now();
    if (clocks.some((c) => c.readyAt <= now)) { refresh(); return; }
    for (const c of clocks) c.el.textContent = `${Math.ceil((c.readyAt - now) / 1000)}s${c.watered ? " · 💧" : ""}`;
  }, 1000);
  const el = overlay(root, "🥕 Community Garden", body, () => clearInterval(timer));
  return { el, refresh };
}

// ------------------------------------------------------------------ Dialogue

export function npcSay(root: HTMLElement, name: string, icon: string, text: string, onTap?: () => void) {
  root.querySelector(".npc-say")?.remove();
  const el = h("div.card.npc-say.pe", { onclick: () => { el.remove(); onTap?.(); } }, [
    h("div.npc-face", {}, icon),
    h("div", {}, [h("b", {}, name), h("div", {}, text), h("div.hint", { style: "margin:4px 0 0" }, "Tap to close")]),
  ]);
  root.append(el);
  setTimeout(() => el.remove(), Math.min(16000, 5000 + text.length * 45));
}

// ------------------------------------------------------------------ Fishing

/** Cast, wait for the bobber to dip, then tap quickly to hook it. The server decides what you caught. */
export class Fishing {
  private el: HTMLElement;
  private state: "wait" | "bite" | "done" = "wait";
  private timer = 0;
  private biteAt = 0;
  constructor(private ctx: Ctx, root: HTMLElement, private onEnd: () => void) {
    this.el = h("div.card.fishing.pe", { onclick: () => this.tap() }, [h("div.fish-bob", {}, "🎣"), h("div.fish-msg", {}, "Waiting for a bite… (tap when the bobber dips!)")]);
    root.append(this.el);
    this.biteAt = performance.now() + 1500 + Math.random() * 3500;
    this.timer = window.setInterval(() => this.tick(), 50);
  }
  get active() { return this.state !== "done"; }
  private msg(t: string) { (this.el.querySelector(".fish-msg") as HTMLElement).textContent = t; }
  private tick() {
    const now = performance.now();
    if (this.state === "wait" && now > this.biteAt) {
      this.state = "bite";
      this.el.classList.add("bite");
      this.msg("❗ A bite! TAP NOW!");
      this.ctx.sound.play("splash");
      buzz(this.ctx, 60);
    } else if (this.state === "bite" && now > this.biteAt + 950) {
      this.msg("It got away… 🐟💨");
      this.finish(900);
    }
  }
  tap() {
    if (this.state === "wait") { this.msg("Too early! Wait for the dip…"); this.biteAt += 900; return; }
    if (this.state !== "bite") return;
    this.ctx.net.send({ t: "fish" });
    this.msg("Reeling in…");
    this.finish(600);
  }
  private finish(ms: number) {
    this.state = "done";
    clearInterval(this.timer);
    setTimeout(() => { this.el.remove(); this.onEnd(); }, ms);
  }
  cancel() {
    if (this.state === "done") return;
    this.state = "done";
    clearInterval(this.timer);
    this.el.remove();
    this.onEnd();
  }
}

/** A short vibration on phones (when the setting is on). */
export function buzz(ctx: Ctx, ms: number | number[]) {
  if (!ctx.prefs.haptics) return;
  try { navigator.vibrate?.(ms); } catch { /* not supported */ }
}

// ------------------------------------------------------------------ Clubs

const CLUB_COLORS = ["#e2483d", "#2fa7a2", "#f5c242", "#a77bff", "#ff7eb3", "#4c8cff", "#6fbf4a", "#ff9a3c"];

export function openClubs(ctx: Ctx, root: HTMLElement): Panel {
  const body = h("div.settings-body");
  let color = CLUB_COLORS[0];
  const name = h("input.field", { placeholder: "Club name (e.g. Pika Pals)", maxLength: 20 }) as HTMLInputElement;
  const code = h("input.field", { placeholder: "Club code", maxLength: 6, style: "text-transform:uppercase" }) as HTMLInputElement;
  for (const i of [name, code]) i.addEventListener("keydown", (e) => e.stopPropagation());
  const refresh = () => {
    const club = ctx.state.club;
    body.replaceChildren(
      club
        ? h("div", {}, [
            h("div.friend", {}, [h("span.clubtag", { style: { background: club.color } }, club.tag), h("b", { style: "flex:1" }, club.name)]),
            h("div.hint", {}, ["Club code: ", h("b", {}, club.code), " — share it so friends can join. Your tag shows on your name."]),
            h("h3", {}, `Members (${club.members.length})`),
            h("div.row", { style: "flex-wrap:wrap" }, club.members.map((m) => h("span.pill", {}, `🦫 ${m}`))),
            h("button.btn.small.cream", { style: "margin-top:12px", onclick: () => ctx.net.send({ t: "clubLeave" }) }, "Leave club"),
          ])
        : h("div", {}, [
            h("div.hint", { style: "margin:0 0 8px" }, "Clubs are groups of beavers with a shared tag on their name — start one with your friends!"),
            h("h3", {}, "Start a club"),
            name,
            h("div.swatches", { style: "margin:8px 0" }, CLUB_COLORS.map((c) => h("div.swatch" + (c === color ? ".on" : ""), { style: { background: c }, onclick: () => { color = c; refresh(); } }))),
            h("button.btn.small.gold", { onclick: () => ctx.net.send({ t: "clubCreate", name: name.value, color }) }, "🎉 Create club"),
            h("h3", {}, "Join with a code"),
            h("div.row", {}, [code, h("button.btn.small", { onclick: () => code.value.trim() && ctx.net.send({ t: "clubJoin", code: code.value.trim() }) }, "Join")]),
          ]),
    );
  };
  refresh();
  const el = overlay(root, "🏅 Clubs", body);
  return { el, refresh };
}

// ------------------------------------------------------------------ Cottage Lane

export function openNeighbours(ctx: Ctx, root: HTMLElement): Panel {
  const body = h("div.settings-body", {}, h("div.hint", {}, "Knocking on doors…"));
  ctx.net.send({ t: "neighbours" });
  const refresh = () => {
    const n = ctx.state.neighbours;
    if (!n) return;
    body.replaceChildren(
      h("div.hint", { style: "margin:0 0 8px" }, "Every beaver in the village has a cabin on Cottage Lane. Drop by, leave a ❤️ and stamp their guestbook!"),
      h("h3", {}, "🏆 Coziest cabins this week"),
      n.coziest.length ? h("div", {}, n.coziest.map((c, i) => h("div.friend", {}, [h("span", {}, ["🥇", "🥈", "🥉", "4.", "5."][i]), h("b", { style: "flex:1" }, c.name), h("span", {}, `❤️ ${c.likes}`)]))) : h("div.hint", {}, "No likes yet this week — be the first to visit!"),
      h("h3", {}, "🏡 Cabins on the lane"),
      h("div", {}, n.list.map((c) => h("div.friend", {}, [
        h("span", {}, "🏡"),
        h("b", { style: "flex:1" }, c.you ? `${c.name} (you)` : c.name),
        h("span", {}, `❤️ ${c.likes}`),
        h("button.btn.small" + (c.you ? ".gold" : ""), { onclick: () => { el.remove(); ctx.net.send(c.you ? { t: "enterCabin" } : { t: "visitCabin", id: c.id }); } }, c.you ? "Go home" : "Visit"),
      ]))),
    );
  };
  const el = overlay(root, "🏡 Cottage Lane", body);
  return { el, refresh };
}

// ------------------------------------------------------------------ Leaderboards

const BOARD_GAMES: (MiniGame | "golf")[] = ["hunt", "logroll", "snowball", "dam", "toboggan", "canoe", "golf"];

export function openLeaderboard(ctx: Ctx, root: HTMLElement, first: MiniGame | "golf"): Panel {
  let game = first;
  const body = h("div.settings-body");
  const ask = () => ctx.net.send({ t: "leaderboard", game });
  const refresh = () => {
    const lb = ctx.state.leaderboard;
    const rows: LeaderRow[] = lb && lb.game === game ? lb.rows : [];
    const label = game === "golf" ? "strokes vs par (full rounds)" : ARCADE_INFO[game].scoreLabel;
    const fmt = (v: number) => (game === "golf" ? (v === 0 ? "E" : v > 0 ? `+${v}` : String(v)) : ARCADE_INFO[game as MiniGame].lowerIsBetter ? `${v.toFixed(1)}s` : String(v));
    body.replaceChildren(
      h("div.tabs", { style: "padding:0 0 8px;flex-wrap:wrap" }, BOARD_GAMES.map((g) => h("button.tab" + (g === game ? ".on" : ""), { onclick: () => { game = g; ask(); refresh(); } }, g === "golf" ? "⛳ Golf" : `${ARCADE_INFO[g].icon} ${ARCADE_INFO[g].name}`))),
      h("div.hint", { style: "margin:0 0 6px" }, `This week's best · ${label} · resets every Monday`),
      rows.length
        ? h("div", {}, rows.map((r, i) => h("div.friend" + (r.me ? ".me" : ""), {}, [h("span", { style: "width:28px" }, ["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`), h("b", { style: "flex:1" }, r.me ? `${r.name} (you)` : r.name), h("span", {}, fmt(r.score))])))
        : h("div.hint", {}, lb && lb.game === game ? "No scores yet this week — set the first one!" : "Loading…"),
    );
  };
  ask();
  refresh();
  const el = overlay(root, "🏆 Weekly Leaderboards", body);
  return { el, refresh };
}

// ------------------------------------------------------------------ Golf tee-off

export function openGolf(ctx: Ctx, root: HTMLElement) {
  let holes = 9;
  const body = h("div.settings-body");
  const draw = () => {
    const par = GOLF_HOLES.slice(0, holes).reduce((s, x) => s + x.par, 0);
    body.replaceChildren(
      h("div.hint", { style: "margin:0 0 8px" }, "Nine holes along the Bow River under Mount Rundle. Play with friends in your party, or with a friendly bot beaver. You can quit any time and keep the coins for the holes you finished."),
      h("h3", {}, "How many holes?"),
      h("div.tabs", { style: "padding:0;flex-wrap:wrap" }, Array.from({ length: 9 }, (_, i) => i + 1).map((n) => h("button.tab" + (n === holes ? ".on" : ""), { onclick: () => { holes = n; draw(); } }, String(n)))),
      h("div", { style: "margin:8px 0" }, GOLF_HOLES.slice(0, holes).map((x) => h("div.friend", {}, [h("b", { style: "width:26px" }, String(x.n)), h("span", { style: "flex:1" }, x.name), h("span.hint", { style: "margin:0" }, `Par ${x.par}`)]))),
      h("div.row", { style: "justify-content:space-between" }, [
        h("b", {}, `${holes} hole${holes > 1 ? "s" : ""} · par ${par}`),
        h("button.btn.orange", { onclick: () => { ctx.net.send({ t: "golfQueue", holes }); el.remove(); } }, "⛳ Tee off!"),
      ]),
      h("button.btn.small.cream", { style: "margin-top:10px", onclick: () => { el.remove(); openLeaderboard(ctx, root, "golf"); } }, "🏆 Weekly golf leaderboard"),
    );
  };
  draw();
  const el = overlay(root, "⛳ Bow Valley Golf", body);
  return el;
}

export function giftToast(root: HTMLElement, name: string, item: string) {
  const it = ITEMS[item];
  toast(root, `🎁 ${name} sent you a ${it?.icon ?? ""} ${it?.name ?? item}!`, 4000);
}

export type { LifeWire };
