import {
  CATALOG,
  CATALOG_BY_ID,
  EMOTES,
  FUR_COLORS,
  HUB_COLLIDERS,
  HUB_PLACES,
  PORTAL_RADIUS,
  QUICK_CHAT,
  validateMove,
  visitedPlace,
  type HubAct,
  type Look,
  type QuestsWire,
  type PlayerInfo,
  type ServerMsg,
  type Slot,
} from "@beaver/shared";
import { compose, hexToRgb, lerp, lerpAngle, lookAt, perspective, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { h, toast } from "../ui/dom";
import { furnitureGrid } from "../ui/furnitureShop";
import { PhotoMode } from "./photo";
import { drawBeaver, emoteReaction, getBeaverMeshes, type Expression } from "./beaver";
import { applyVillageLight, bridgeHeightAt, dockHeightAt, drawHub, heightAt, WATER_Y, type HubWorld } from "./hubWorld";
import type { Ctx, Scene } from "./scene";

const WALK_SPEED = 7.5;
const PL = HUB_PLACES;

interface Avatar {
  info: PlayerInfo;
  x: number; z: number; ry: number;
  tx: number; tz: number; tr: number;
  walk: number; moving: number; swim: number;
  jumpT: number; waveT: number;
  cheerT: number; expr: Expression; exprT: number; talkT: number; seed: number;
  tag: HTMLElement;
  bubble: HTMLElement | null; bubbleUntil: number;
  trailAcc: number;
  /** Cozy activity: sipping cocoa or soaking in the hot spring. */
  act: HubAct | null; actT: number; actX: number; actZ: number;
  /** 0 = standing on land, 1 = settled in the hot spring. */
  soak: number;
}

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: Vec3; size: number; }

const PLACE_NAMES: Record<string, string> = { lodge: "Lodge Café", hotSpring: "Hot Springs", dock: "Lake Dock", trailhead: "Trailhead", outfitter: "Outfitter", arcade: "Riverside Arcade" };

/** A chunky golden pinecone (built once per renderer). */
const coneMeshes = new WeakMap<Renderer, GpuMesh>();
function pineconeMesh(r: Renderer): GpuMesh {
  let g = coneMeshes.get(r);
  if (g) return g;
  const m = new MeshBuilder();
  const gold = hexToRgb("#ffc93c"), deep = hexToRgb("#e09a1f"), tip = hexToRgb("#fff1a8");
  for (let ring = 0; ring < 6; ring++) {
    const y = 0.12 + ring * 0.13, rad = 0.26 * Math.sin(((ring + 0.8) / 6.6) * Math.PI) + 0.05;
    const n = 7 - Math.floor(ring / 2);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.45;
      m.sphere(compose(Math.cos(a) * rad, y, Math.sin(a) * rad, -a, 0.5, 0, 0.12, 0.08, 0.1), ring % 2 ? gold : deep, 4, 6);
    }
  }
  m.sphere(compose(0, 0.45, 0, 0, 0, 0, 0.2, 0.42, 0.2), deep, 6, 10);
  m.cone(compose(0, 0.95, 0, 0, 0, 0, 0.14, 0.18, 0.14), tip, 6);
  m.cylinder(compose(0, 0.02, 0, 0, 0, 0, 0.08, 0.1, 0.08), hexToRgb("#8a5a2b"), 6);
  g = r.upload(m.build());
  coneMeshes.set(r, g);
  return g;
}

/** A steaming mug of maple hot cocoa and a folded spa towel (built once per renderer). */
const cozyMeshes = new WeakMap<Renderer, { mug: GpuMesh; towel: GpuMesh }>();
function cozy(r: Renderer) {
  let c = cozyMeshes.get(r);
  if (c) return c;
  const mug = new MeshBuilder();
  mug.cylinder(compose(0, 0, 0, 0, 0, 0, 0.22, 0.26, 0.22), hexToRgb("#e2483d"), 12);
  mug.cylinder(compose(0, 0.115, 0, 0, 0, 0, 0.18, 0.04, 0.18), hexToRgb("#6b3a22"), 12);
  mug.sphere(compose(0.03, 0.15, 0, 0, 0, 0, 0.07, 0.04, 0.07), hexToRgb("#fffaf0"), 4, 6);
  mug.box(compose(0, 0.02, 0.112, 0, 0, 0, 0.2, 0.05, 0.01), hexToRgb("#fffaf0"));
  mug.torus(compose(0.13, 0, 0, 0, Math.PI / 2, 0, 0.07, 0.07, 0.07), hexToRgb("#e2483d"), 1, 0.28, 10, 4);
  const towel = new MeshBuilder();
  towel.box(compose(0, 0, 0, 0, 0, 0, 0.5, 0.1, 0.32), hexToRgb("#fffaf0"), 0.03);
  towel.box(compose(0, 0.07, 0, 0, 0, 0, 0.42, 0.06, 0.26), hexToRgb("#7fd6cf"), 0.03);
  towel.box(compose(0, 0.11, 0, 0, 0, 0, 0.34, 0.04, 0.2), hexToRgb("#fffaf0"), 0.03);
  c = { mug: r.upload(mug.build()), towel: r.upload(towel.build()) };
  cozyMeshes.set(r, c);
  return c;
}

const SPRING_Y = () => heightAt(PL.hotSpring.x, PL.hotSpring.z) + 0.25;

const ITEM_ICON: Record<string, string> = { toque: "🧶", ranger: "🤠", antlers: "🦌", crown: "👑", scarf: "🧣", pack: "🎒", canoe: "🛶", snow: "❄️", leaf: "🍁" };

export class HubScene implements Scene {
  private avatars = new Map<string, Avatar>();
  private me: Avatar;
  private yaw = 0.3;
  // Vertical cursor aim. This moves the follow-camera focus instead of letting
  // the whole orbit flip over when it is squeezed close to scenery.
  private lookOffset = 0;
  private dist = 13;
  private camDist = 13;
  private camLift = 0;
  private target: { x: number; z: number } | null = null;
  private sendAcc = 0;
  private lastSent = { x: NaN, z: NaN, ry: NaN };
  private time = 0;
  private particles: Particle[] = [];
  private puffAcc = 0;
  private root: HTMLElement;
  private labels: HTMLElement;
  private placeEls: HTMLElement[] = [];
  private chatlog: HTMLElement;
  private actionEl: HTMLElement;
  private coinsEl: HTMLElement;
  private countEl: HTMLElement;
  private menuEl: HTMLElement | null = null;
  private panelEl: HTMLElement | null = null;
  private queueInfo: { count: number; size: number; until: number } | null = null;
  private actionKey = "";
  private blocked = new Set<string>();
  private questsEl: HTMLElement;
  private questsOpen = typeof innerWidth === "number" ? innerWidth > 560 : true;
  private cones: { id: number; x: number; z: number }[] = [];
  private conesGot = new Set<number>();
  private conePending = new Set<number>();
  private photo: PhotoMode;

  constructor(private ctx: Ctx, private world: HubWorld, welcome: Extract<ServerMsg, { t: "welcome" }>) {
    this.root = h("div", { style: "position:absolute;inset:0" });
    this.labels = h("div", { style: "position:absolute;inset:0;overflow:hidden" });
    this.root.append(this.labels);
    ctx.ui.append(this.root);
    ctx.state.coins = welcome.coins;
    ctx.state.owned = welcome.owned;
    ctx.state.look = welcome.look;
    ctx.state.you = welcome.you;

    for (const p of welcome.players) this.addAvatar(p);
    this.me = this.avatars.get(welcome.you)!;
    // On arrival look toward the plaza; back from a race, look up at the trailhead portal.
    this.yaw = this.me.z < PL.trailhead.z + 15 ? 0 : Math.atan2(this.me.x, this.me.z);

    for (const l of world.labels) {
      const el = h("div.place", {}, l.text);
      this.labels.append(el);
      this.placeEls.push(el);
    }

    // --- HUD ---
    const room = welcome.room;
    this.countEl = h("span", {}, String(this.avatars.size));
    this.coinsEl = h("span", {}, String(ctx.state.coins));
    this.root.append(
      h("div.hud-top", {}, [
        h("div.row", {}, [
          h("div.pill", { title: room.id }, [room.isPrivate ? `🏡 ${room.code === "SOLO" ? "Solo village" : `Cabin ${room.code}`}` : `🏔️ ${room.id}`]),
          h("div.pill", { title: "Beavers here" }, ["🦫", this.countEl]),
        ]),
        h("div.row", {}, [
          h("div.pill.coins", { title: "Coins" }, ["🪙", this.coinsEl]),
          h("button.btn.cream.icon.pe", { title: "How to play", onclick: () => this.showHelp() }, "?"),
        ]),
      ]),
    );
    this.chatlog = h("div.chatlog");
    this.root.append(this.chatlog);
    this.actionEl = h("div.action.pe");
    this.root.append(this.actionEl);

    const input = h("input.field.pe", { placeholder: "Say something nice…", maxLength: 120, enterKeyHint: "send" }) as HTMLInputElement;
    const send = () => {
      const text = input.value.trim();
      if (text) ctx.net.send({ t: "chat", text });
      input.value = "";
      input.blur();
    };
    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") send();
      if (e.key === "Escape") input.blur();
    });
    this.root.append(
      h("div.hud-bottom", {}, [
        h("div.chatbar", {}, [input, h("button.btn.pe", { onclick: send }, "Send")]),
        h("button.btn.orange.icon.pe", { title: "Quick chat", onclick: () => this.toggleMenu("quick") }, "💬"),
        h("button.btn.orange.icon.pe", { title: "Emotes", onclick: () => this.toggleMenu("emote") }, "😀"),
        h("button.btn.gold.icon.pe", { title: "Outfitter & wardrobe", onclick: () => this.openShop("hat") }, "🎒"),
      ]),
    );
    this.questsEl = h("div.card.quests.pe", { onclick: () => { this.questsOpen = !this.questsOpen; this.renderQuests(); } });
    this.root.append(this.questsEl);
    this.renderQuests();
    this.root.append(h("div.dock", {}, [
      h("button.btn.cream.icon.pe", { title: "My cabin", onclick: () => this.goHome() }, "🏡"),
      h("button.btn.cream.icon.pe", { title: "Photo mode", onclick: () => this.openPhoto() }, "📷"),
    ]));
    this.photo = new PhotoMode(ctx, this.root, {
      place: () => {
        const p = visitedPlace(this.me.x, this.me.z);
        return p ? `${PLACE_NAMES[p]}, Banff` : "Beaver Banff";
      },
      onShot: () => ctx.net.send({ t: "photo" }),
    });
    window.addEventListener("keydown", this.onKey);
    if (room.isPrivate && room.code !== "SOLO") this.log(null, `Private cabin code: ${room.code} — share it with friends so they can join!`);
  }

  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t?.tagName === "INPUT" || this.photo.active) return;
    if (e.key === "Enter") {
      (this.root.querySelector("input.field") as HTMLInputElement | null)?.focus();
      e.preventDefault();
    }
    if (e.key === " ") this.ctx.net.send({ t: "emote", i: 1 });
    if (e.key.toLowerCase() === "f") this.runAction();
    if (e.key === "Escape") this.closeOverlays();
    if (e.key.toLowerCase() === "p") this.openPhoto();
  };

  private openPhoto() {
    this.closeOverlays();
    this.target = null;
    this.photo.open(this.me.ry, 6.5);
  }

  private goHome() {
    this.closeOverlays();
    if (this.queueInfo) { this.ctx.net.send({ t: "leaveQueue" }); this.queueInfo = null; }
    this.ctx.net.send({ t: "enterCabin" });
  }

  private renderQuests() {
    const q = this.ctx.state.quests;
    if (!q) { this.questsEl.style.display = "none"; return; }
    this.questsEl.style.display = "";
    const done = q.list.filter((x) => x.done).length;
    this.questsEl.classList.toggle("closed", !this.questsOpen);
    this.questsEl.replaceChildren(
      h("header", {}, [h("span", {}, "📜 Daily quests"), h("span.n", {}, `${done}/${q.list.length} ${this.questsOpen ? "▴" : "▾"}`)]),
      h("div.ql", {}, [
        ...q.list.map((x) => h("div.quest" + (x.done ? ".done" : ""), {}, [
          h("span.qi", {}, x.done ? "✅" : x.icon),
          h("span.lbl", {}, `${x.label}${x.goal > 1 ? ` (${x.progress}/${x.goal})` : ""} · 🪙${x.reward}`),
          h("div.bar", {}, h("i", { style: { width: `${(100 * x.progress) / x.goal}%` } })),
        ])),
        h("div.bonus" + (q.bonus ? ".got" : ""), {}, q.bonus ? "🎉 All done today! Bonus collected." : "Finish all three for a 🪙50 bonus · new quests at midnight UTC"),
        this.cones.length ? h("div.bonus", {}, `🌰 Golden pinecones found today: ${this.conesGot.size}/${this.cones.length}`) : null,
      ]),
    );
  }

  private questDone(q: QuestsWire) {
    for (const label of q.justCompleted ?? []) {
      const pop = h("div.card.quest-pop", {}, [h("b", {}, "✅ Quest complete!"), label]);
      this.root.append(pop);
      setTimeout(() => pop.remove(), 2600);
      this.me.cheerT = 1.8;
      this.me.expr = "excited";
      this.me.exprT = 2;
    }
    if (q.bonusNow) {
      setTimeout(() => {
        const pop = h("div.card.quest-pop", {}, [h("b", {}, "🎉 All daily quests done!"), "+50 bonus coins"]);
        this.root.append(pop);
        setTimeout(() => pop.remove(), 3000);
      }, 2700);
    }
  }

  private addAvatar(p: PlayerInfo) {
    const tag = h("div.tag" + (p.id === this.ctx.state.you ? ".me" : ""), {}, p.name);
    this.labels.append(tag);
    const a: Avatar = {
      info: p, x: p.x, z: p.z, ry: p.ry, tx: p.x, tz: p.z, tr: p.ry,
      walk: 0, moving: 0, swim: 0, jumpT: 0, waveT: 0, cheerT: 0, expr: "neutral", exprT: 0, talkT: 0,
      seed: [...p.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000, 7) / 100, tag, bubble: null, bubbleUntil: 0, trailAcc: 0,
      act: null, actT: 0, actX: p.x, actZ: p.z, soak: 0,
    };
    this.avatars.set(p.id, a);
    if (this.countEl) this.countEl.textContent = String(this.avatars.size);
  }

  private removeAvatar(id: string) {
    const a = this.avatars.get(id);
    if (!a) return;
    a.tag.remove();
    a.bubble?.remove();
    this.avatars.delete(id);
    this.countEl.textContent = String(this.avatars.size);
  }

  handle(m: ServerMsg) {
    switch (m.t) {
      case "state":
        for (const [id, x, z, ry] of m.p) {
          const a = this.avatars.get(id);
          if (!a) continue;
          if (a === this.me) {
            // Server correction (e.g. walked into something solid).
            if (Math.hypot(a.x - x, a.z - z) > 3) { a.x = x; a.z = z; }
            continue;
          }
          a.tx = x; a.tz = z; a.tr = ry;
        }
        break;
      case "joined":
        if (!this.avatars.has(m.p.id)) this.addAvatar(m.p);
        break;
      case "left":
        this.removeAvatar(m.id);
        break;
      case "look": {
        const a = this.avatars.get(m.id);
        if (a) a.info.look = m.look;
        if (m.id === this.ctx.state.you) {
          this.ctx.state.look = m.look;
          this.refreshShop();
        }
        break;
      }
      case "chat": {
        if (this.blocked.has(m.id)) return;
        this.log(m.name, m.text);
        const a = this.avatars.get(m.id);
        if (a) {
          a.bubble?.remove();
          a.bubble = h("div.bubble", {}, m.text);
          this.labels.append(a.bubble);
          a.bubbleUntil = this.time + 5;
          a.talkT = Math.min(2.2, 0.6 + m.text.length * 0.05);
        }
        break;
      }
      case "emote": {
        const a = this.avatars.get(m.id);
        if (!a) return;
        const react = emoteReaction(m.i);
        a.expr = react.expr;
        a.exprT = 2.2;
        if (react.hop) a.jumpT = 1;
        if (react.wave) a.waveT = 1.6;
        if (react.cheer) a.cheerT = 1.8;
        const el = h("div.emote", {}, EMOTES[m.i] ?? "");
        this.labels.append(el);
        (el as HTMLElement & { _follow?: Avatar })._follow = a;
        setTimeout(() => el.remove(), 1600);
        break;
      }
      case "act": {
        const a = this.avatars.get(m.id);
        if (!a) break;
        if (m.a === "stop") { a.act = null; break; }
        a.act = m.a;
        a.actT = 0;
        a.actX = a === this.me ? a.x : a.tx;
        a.actZ = a === this.me ? a.z : a.tz;
        a.expr = "happy";
        a.exprT = 1.5;
        const el = h("div.emote", {}, m.a === "cocoa" ? "☕" : "♨️");
        this.labels.append(el);
        (el as HTMLElement & { _follow?: Avatar })._follow = a;
        setTimeout(() => el.remove(), 1600);
        break;
      }
      case "wallet":
        this.ctx.state.coins = m.coins;
        this.ctx.state.owned = m.owned;
        this.coinsEl.textContent = String(m.coins);
        this.refreshShop();
        break;
      case "quests":
        this.ctx.state.quests = m;
        this.questDone(m);
        this.renderQuests();
        break;
      case "pinecones": {
        const fresh = m.collected.filter((id) => !this.conesGot.has(id));
        const first = this.cones.length === 0;
        this.cones = m.spots;
        this.conesGot = new Set(m.collected);
        this.conePending.clear();
        if (!first) for (const id of fresh) this.coneBurst(id);
        this.renderQuests();
        break;
      }
      case "furniture":
        this.ctx.state.furniture = m.counts;
        this.refreshShop();
        break;
      case "queue":
        this.queueInfo = { count: m.count, size: m.size, until: performance.now() + m.startsInMs };
        this.actionKey = "";
        break;
      case "system":
        this.log(null, m.text);
        break;
      case "error":
        toast(this.root, m.text);
        break;
    }
  }

  private log(name: string | null, text: string) {
    const line = h("div.chatline" + (name ? "" : ".sys"), {}, name ? [h("b", {}, name + ": "), text] : text);
    this.chatlog.append(line);
    while (this.chatlog.children.length > 6) this.chatlog.firstElementChild?.remove();
    setTimeout(() => line.remove(), 16000);
  }

  // ---------- Menus & panels ----------

  private toggleMenu(kind: "quick" | "emote") {
    const was = this.menuEl?.dataset.kind;
    this.menuEl?.remove();
    this.menuEl = null;
    if (was === kind) return;
    const close = () => { this.menuEl?.remove(); this.menuEl = null; };
    const menu = kind === "quick"
      ? h("div.card.menu.quick.pe", {}, QUICK_CHAT.map((q, i) => h("button", { onclick: () => { this.ctx.net.send({ t: "quick", i }); close(); } }, q)))
      : h("div.card.menu.emotes.pe", {}, EMOTES.map((e, i) => h("button", { onclick: () => { this.ctx.net.send({ t: "emote", i }); close(); } }, e)));
    menu.dataset.kind = kind;
    this.menuEl = menu;
    this.root.append(menu);
  }

  private closeOverlays() {
    this.menuEl?.remove();
    this.menuEl = null;
    this.panelEl?.remove();
    this.panelEl = null;
  }

  private coneBurst(id: number) {
    const c = this.cones.find((s) => s.id === id);
    if (!c) return;
    const y = heightAt(c.x, c.z) + 0.8;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.particles.push({ x: c.x, y, z: c.z, vx: Math.cos(a) * 2.2, vy: 2 + Math.random() * 2, vz: Math.sin(a) * 2.2, life: 0, max: 0.9, color: [1, 0.84, 0.3], size: 0.14 });
    }
    const el = h("div.cone-pop", {}, "+3 🪙");
    this.labels.append(el);
    const s = this.ctx.r.project(c.x, y + 1.4, c.z);
    if (s) { el.style.left = `${s.x}px`; el.style.top = `${s.y}px`; }
    setTimeout(() => el.remove(), 1400);
  }

  private shopTab: Slot | "fur" | "cabin" = "hat";

  private openShop(tab: Slot | "fur" | "cabin") {
    this.shopTab = tab;
    this.closeOverlays();
    this.panelEl = h("div.overlay.pe", { onclick: (e: Event) => { if (e.target === this.panelEl) this.closeOverlays(); } });
    this.root.append(this.panelEl);
    this.refreshShop();
  }

  private refreshShop() {
    if (!this.panelEl) return;
    const st = this.ctx.state;
    const tabs: [Slot | "fur" | "cabin", string][] = [["hat", "Hats"], ["scarf", "Scarves"], ["backpack", "Packs"], ["trail", "Trails"], ["fur", "Fur"], ["cabin", "🏡 Cabin"]];
    const setLook = (look: Look) => this.ctx.net.send({ t: "look", look });
    let grid: HTMLElement;
    if (this.shopTab === "cabin") {
      grid = furnitureGrid(this.ctx);
    } else if (this.shopTab === "fur") {
      grid = h("div.grid", {}, FUR_COLORS.map((c) =>
        h("div.item", {}, [
          h("div.ico", { style: { background: c } }, "🦫"),
          h("div.nm", {}, c === st.look.fur ? "Your fur" : "Fur colour"),
          h("button.btn.small" + (c === st.look.fur ? ".cream" : ""), { disabled: c === st.look.fur, onclick: () => setLook({ ...st.look, fur: c }) }, c === st.look.fur ? "Wearing" : "Choose"),
        ]),
      ));
    } else {
      const slot = this.shopTab;
      grid = h("div.grid", {}, CATALOG.filter((i) => i.slot === slot).map((item) => {
        const owned = st.owned.includes(item.id);
        const worn = st.look[slot] === item.id;
        const action = owned
          ? h("button.btn.small" + (worn ? ".cream" : ""), { onclick: () => setLook({ ...st.look, [slot]: worn ? null : item.id }) }, worn ? "Take off" : "Wear")
          : h("button.btn.small.gold", { disabled: st.coins < item.price, onclick: () => this.ctx.net.send({ t: "buy", item: item.id }) }, `Buy · 🪙 ${item.price}`);
        return h("div.item", {}, [
          h("div.ico", { style: { background: item.color } }, ITEM_ICON[item.shape] ?? "✨"),
          h("div.nm", {}, item.name),
          h("div.price", {}, owned ? (worn ? "✅ Wearing" : "Owned") : item.price === 0 ? "Free" : `🪙 ${item.price}`),
          action,
        ]);
      }));
    }
    const panel = h("div.card.panel", {}, [
      h("header", {}, [
        h("h2", {}, "🎒 Beaver Outfitter"),
        h("div.row", {}, [h("div.pill.coins", {}, `🪙 ${st.coins}`), h("button.btn.cream.small", { onclick: () => this.closeOverlays() }, "✕")]),
      ]),
      h("div.tabs", {}, tabs.map(([k, label]) => h("button.tab" + (k === this.shopTab ? ".on" : ""), { onclick: () => { this.shopTab = k; this.refreshShop(); } }, label))),
      h("div", { style: "padding:0 16px 6px;font-size:13px;color:var(--muted);font-weight:700" }, this.shopTab === "cabin"
        ? "Furniture for your cabin — tap 🏡 to go home and decorate."
        : "Cosmetics are just for looks — they never change how you play. Earn coins in Toboggan Rush, daily quests and golden pinecones!"),
      grid,
    ]);
    this.panelEl.replaceChildren(panel);
  }

  private showHelp() {
    this.closeOverlays();
    this.panelEl = h("div.overlay.pe", { onclick: () => this.closeOverlays() }, h("div.card.help", {}, [
      h("h2", {}, "How to play"),
      h("div", {}, [h("b", {}, "Walk: "), h("kbd", {}, "W A S D"), " / arrows, or tap the ground"]),
      h("div", {}, [h("b", {}, "Look around: "), "click and drag · ", h("kbd", {}, "Q"), " ", h("kbd", {}, "E"), " · scroll to zoom"]),
      h("div", {}, [h("b", {}, "Chat: "), h("kbd", {}, "Enter"), " · 💬 quick chat · 😀 emotes · ", h("kbd", {}, "Space"), " to hop"]),
      h("div", {}, [h("b", {}, "Do things: "), "walk up to a place and press the big button (or ", h("kbd", {}, "F"), ")"]),
      h("div", { style: "margin-top:8px" }, "🛷 Head north to the trailhead portal for Toboggan Rush. Win coins, then spend them at the 🎒 Outfitter."),
      h("div", { style: "margin-top:8px" }, "📜 Daily quests (top right) earn coins — and look out for ✨ golden pinecones around the village!"),
      h("div", { style: "margin-top:8px" }, ["🏡 Visit your cabin to decorate it with furniture · 📷 Photo mode (", h("kbd", {}, "P"), ") for postcards."]),
      h("div", { style: "margin-top:8px" }, "🛡️ Tap another beaver to wave, visit their cabin, block or report them."),
    ]));
    this.root.append(this.panelEl);
  }

  private openPlayerCard(a: Avatar, sx: number, sy: number) {
    this.closeOverlays();
    const close = () => this.closeOverlays();
    const card = h("div.card.playercard.pe", { style: { left: `${sx}px`, top: `${sy}px` } }, [
      h("h3", {}, a.info.name),
      h("button.btn.small", { onclick: () => { this.ctx.net.send({ t: "emote", i: 0 }); close(); } }, "👋 Wave"),
      h("button.btn.small.gold", { onclick: () => { close(); this.ctx.net.send({ t: "visitCabin", id: a.info.id }); } }, "🏡 Visit cabin"),
      h("button.btn.small.cream", { onclick: () => { this.blocked.add(a.info.id); this.ctx.net.send({ t: "block", id: a.info.id }); toast(this.root, `You won't see chat from ${a.info.name}.`); close(); } }, "🚫 Block"),
      h("button.btn.small.red", { onclick: () => { this.ctx.net.send({ t: "report", id: a.info.id, reason: "Reported from player card" }); close(); } }, "🚩 Report"),
    ]);
    this.panelEl = h("div.pe", { style: "position:absolute;inset:0", onclick: (e: Event) => { if (e.target === this.panelEl) close(); } }, card);
    this.root.append(this.panelEl);
  }

  // ---------- Context action (portal, shop, lodge, arcade) ----------

  private nearby(): string {
    const d = (p: { x: number; z: number }) => Math.hypot(this.me.x - p.x, this.me.z - p.z);
    if (d(PL.trailhead) < PORTAL_RADIUS + 2) return "race";
    if (d(PL.outfitter) < PL.outfitter.r + 4.5) return "shop";
    if (d(PL.lodge) < PL.lodge.r + 5) return "lodge";
    if (d(PL.arcade) < PL.arcade.r + 4.5) return "arcade";
    if (d(PL.hotSpring) < 6) return "spring";
    return "";
  }

  private runAction() {
    const k = this.nearby();
    if (k === "race") this.ctx.net.send(this.queueInfo ? { t: "leaveQueue" } : { t: "queueRace" });
    if (k === "race" && this.queueInfo) this.queueInfo = null;
    if (k === "shop") this.openShop("hat");
    if (k === "lodge") {
      if (this.me.act === "cocoa") this.ctx.net.send({ t: "act", a: "stop" });
      else { this.ctx.net.send({ t: "act", a: "cocoa" }); toast(this.root, "☕ Mmm… maple hot cocoa. Cozy!"); }
    }
    if (k === "arcade") toast(this.root, "🕹️ Coming soon: Log Rolling & Dam Builder!");
    if (k === "spring") {
      if (this.me.act === "soak") this.ctx.net.send({ t: "act", a: "stop" });
      else { this.target = null; this.ctx.net.send({ t: "act", a: "soak" }); toast(this.root, "♨️ Ahh, toasty warm."); }
    }
    this.actionKey = "";
  }

  private updateAction() {
    const k = this.nearby();
    let label = "";
    if (k === "race") {
      if (this.queueInfo) {
        const s = Math.max(0, Math.ceil((this.queueInfo.until - performance.now()) / 1000));
        label = `⏳ Racers ${this.queueInfo.count}/${this.queueInfo.size} · starting in ${s}s · Leave`;
      } else label = "🛷 Ride Toboggan Rush!";
    } else if (this.queueInfo) {
      this.ctx.net.send({ t: "leaveQueue" });
      this.queueInfo = null;
    }
    if (k === "shop") label = "🎒 Open the Outfitter";
    if (k === "lodge") label = this.me.act === "cocoa" ? "☕ Finish your cocoa" : "☕ Grab a hot cocoa";
    if (k === "arcade") label = "🕹️ Peek inside the arcade";
    if (k === "spring") label = this.me.act === "soak" ? "♨️ Hop out" : "♨️ Soak in the hot spring";
    if (label === this.actionKey) return;
    this.actionKey = label;
    this.actionEl.replaceChildren(label ? h("button.btn" + (k === "race" ? ".orange" : ""), { onclick: () => this.runAction(), style: "font-size:19px;padding:12px 20px" }, label) : "");
  }

  // ---------- Frame ----------

  update(dt: number) {
    this.time += dt;
    const inp = this.ctx.input;
    if (this.photo.active) {
      this.photo.update(dt);
      this.me.moving = lerp(this.me.moving, 0, Math.min(1, dt * 10));
      this.animate(dt);
      return;
    }
    this.yaw -= inp.consumeDrag() * 0.006;
    // Drag up to look upward and drag down to look toward the ground. The cap
    // still permits a deliberate skyward look, but prevents a full inversion.
    this.lookOffset = Math.max(-1.55, Math.min(4.0, this.lookOffset - inp.consumeDragY() * 0.012));
    if (inp.down("q")) this.yaw += dt * 1.8;
    if (inp.down("e")) this.yaw -= dt * 1.8;
    this.dist = Math.max(7, Math.min(24, this.dist + inp.consumeZoom() * 1.2));

    // Tap: player card if you tapped a beaver, otherwise walk there.
    const tap = inp.consumeTap();
    if (tap && !this.panelEl) {
      let best: Avatar | null = null, bestD = 40;
      for (const a of this.avatars.values()) {
        if (a === this.me) continue;
        const s = this.ctx.r.project(a.x, heightAt(a.x, a.z) + 1.1, a.z);
        if (!s) continue;
        const d = Math.hypot(s.x - tap.x, s.y - tap.y);
        if (d < bestD) { bestD = d; best = a; }
      }
      if (best) {
        const s = this.ctx.r.project(best.x, heightAt(best.x, best.z) + 2.4, best.z)!;
        this.openPlayerCard(best, s.x, s.y);
      } else {
        const g = this.ctx.r.pickGround(tap.x, tap.y, heightAt(this.me.x, this.me.z));
        if (g) this.target = g;
      }
      this.menuEl?.remove();
      this.menuEl = null;
    }

    // Local movement (predicted; the server validates the same way).
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    let mx = 0, mz = 0;
    if (inp.down("w", "arrowup")) { mx += fx; mz += fz; }
    if (inp.down("s", "arrowdown")) { mx -= fx; mz -= fz; }
    if (inp.down("d", "arrowright")) { mx += -fz; mz += fx; }
    if (inp.down("a", "arrowleft")) { mx -= -fz; mz -= fx; }
    if (mx || mz) this.target = null;
    if (this.target) {
      const dx = this.target.x - this.me.x, dz = this.target.z - this.me.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.4) this.target = null;
      else { mx = dx / d; mz = dz / d; }
    }
    const len = Math.hypot(mx, mz);
    const me = this.me;
    if (len > 0 && me.act) {
      me.act = null;
      this.ctx.net.send({ t: "act", a: "stop" });
    }
    if (len > 0) {
      const swimming = dockHeightAt(me.x, me.z) === null && bridgeHeightAt(me.x, me.z) === null && heightAt(me.x, me.z) < WATER_Y - 0.3;
      const sp = WALK_SPEED * (swimming ? 0.7 : 1);
      const next = validateMove(me, { x: me.x + (mx / len) * sp * dt, z: me.z + (mz / len) * sp * dt }, dt * 1000);
      if (this.target && Math.hypot(next.x - me.x, next.z - me.z) < sp * dt * 0.2) this.target = null; // blocked
      me.x = next.x;
      me.z = next.z;
      me.tr = Math.atan2(mx, mz);
    }
    me.tx = me.x; me.tz = me.z;
    me.moving = lerp(me.moving, len > 0 ? 1 : 0, Math.min(1, dt * 10));

    // Golden pinecones: walk into one to pick it up.
    for (const c of this.cones) {
      if (this.conesGot.has(c.id) || this.conePending.has(c.id)) continue;
      if (Math.hypot(c.x - me.x, c.z - me.z) < 1.6) {
        this.conePending.add(c.id);
        this.ctx.net.send({ t: "collect", id: c.id });
      }
    }

    this.sendAcc += dt;
    if (this.sendAcc > 1 / 12) {
      this.sendAcc = 0;
      if (me.x !== this.lastSent.x || me.z !== this.lastSent.z || me.tr !== this.lastSent.ry) {
        this.ctx.net.send({ t: "move", x: me.x, z: me.z, ry: me.tr });
        this.lastSent = { x: me.x, z: me.z, ry: me.tr };
      }
    }

    this.animate(dt);
    this.updateAction();
  }

  private animate(dt: number) {
    const me = this.me;
    // Animate all avatars.
    for (const a of this.avatars.values()) {
      if (a !== me) {
        const k = Math.min(1, dt * 10);
        const before = { x: a.x, z: a.z };
        a.x = lerp(a.x, a.tx, k);
        a.z = lerp(a.z, a.tz, k);
        const sp = Math.hypot(a.x - before.x, a.z - before.z) / Math.max(dt, 1e-4);
        a.moving = lerp(a.moving, sp > 0.6 ? 1 : 0, Math.min(1, dt * 8));
      }
      if (a.act) {
        a.actT += dt;
        // Someone else wandered off (or the cocoa ran out): end the activity.
        if (a !== me && Math.hypot(a.tx - a.actX, a.tz - a.actZ) > 0.8) a.act = null;
        if (a.act === "cocoa" && a.actT > 14) a.act = null;
      }
      a.soak = Math.max(0, Math.min(1, a.soak + (a.act === "soak" ? dt / 0.7 : -dt / 0.5)));
      if (a.act === "cocoa" && Math.random() < dt * 5) {
        const p = this.mugPos(a);
        this.particles.push({ x: p[0] + (Math.random() - 0.5) * 0.08, y: p[1] + 0.2, z: p[2] + (Math.random() - 0.5) * 0.08, vx: 0.05, vy: 0.45, vz: 0, life: 0, max: 1.1, color: [1, 1, 1], size: 0.09 });
      }
      if (a.soak > 0.9 && Math.random() < dt * 1.5) {
        const d = this.drawPos(a);
        this.particles.push({ x: d.x + (Math.random() - 0.5) * 1.2, y: SPRING_Y() + 0.1, z: d.z + (Math.random() - 0.5) * 1.2, vx: 0, vy: 0.7, vz: 0, life: 0, max: 1.6, color: [1, 1, 1], size: 0.16 });
      }
      a.ry = lerpAngle(a.ry, a.tr, Math.min(1, dt * 12));
      a.walk += dt * 11 * a.moving;
      a.swim = lerp(a.swim, dockHeightAt(a.x, a.z) === null && bridgeHeightAt(a.x, a.z) === null && heightAt(a.x, a.z) < WATER_Y - 0.3 ? 1 : 0, Math.min(1, dt * 5));
      a.jumpT = Math.max(0, a.jumpT - dt * 2.2);
      a.waveT = Math.max(0, a.waveT - dt);
      a.cheerT = Math.max(0, a.cheerT - dt);
      a.exprT = Math.max(0, a.exprT - dt);
      a.talkT = Math.max(0, a.talkT - dt);
      if (a.bubble && this.time > a.bubbleUntil) { a.bubble.remove(); a.bubble = null; }
      // Cosmetic trails.
      const trail = a.info.look.trail ? CATALOG_BY_ID[a.info.look.trail] : null;
      if (trail && a.moving > 0.5) {
        a.trailAcc += dt;
        while (a.trailAcc > 0.06) {
          a.trailAcc -= 0.06;
          this.particles.push({
            x: a.x + (Math.random() - 0.5) * 0.6, y: this.groundY(a) + 0.3, z: a.z + (Math.random() - 0.5) * 0.6,
            vx: (Math.random() - 0.5) * 0.6, vy: 0.8 + Math.random(), vz: (Math.random() - 0.5) * 0.6,
            life: 0, max: 1.1, color: hexToRgb(trail.color), size: 0.16,
          });
        }
      }
    }

    // Chimney smoke + hot-spring steam.
    this.puffAcc += dt;
    while (this.puffAcc > 0.18) {
      this.puffAcc -= 0.18;
      const ry = Math.atan2(-PL.lodge.x, -PL.lodge.z);
      const lx = 11 * 0.25, lz = -8 * 0.2;
      this.particles.push({
        x: PL.lodge.x + lx * Math.cos(ry) + lz * Math.sin(ry), y: 11.8, z: PL.lodge.z - lx * Math.sin(ry) + lz * Math.cos(ry),
        vx: 0.5, vy: 1.4, vz: 0.2, life: 0, max: 3.2, color: [0.95, 0.95, 0.97], size: 0.55,
      });
      this.particles.push({
        x: PL.hotSpring.x + (Math.random() - 0.5) * 5, y: 0, z: PL.hotSpring.z + (Math.random() - 0.5) * 5,
        vx: 0, vy: 1.0, vz: 0, life: 0, max: 2.4, color: [1, 1, 1], size: 0.45,
      });
    }
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
  }

  /** Where an avatar is drawn: normally where it stands, but tucked into the hot spring while soaking. */
  private drawPos(a: Avatar): { x: number; y: number; z: number; ry: number } {
    const y = this.groundY(a);
    if (a.soak <= 0) return { x: a.x, y, z: a.z, ry: a.ry };
    const cx = PL.hotSpring.x, cz = PL.hotSpring.z;
    const ang = Math.atan2(a.actX - cx, a.actZ - cz);
    const sx = cx + Math.sin(ang) * 1.2, sz = cz + Math.cos(ang) * 1.2;
    const k = a.soak, e = k * k * (3 - 2 * k);
    const hop = Math.sin(Math.min(1, k * 1.15) * Math.PI) * 1.3;
    const sunk = SPRING_Y() - 0.42 + Math.sin(this.time * 1.4 + a.seed) * 0.04;
    return {
      x: lerp(a.x, sx, e), z: lerp(a.z, sz, e),
      y: lerp(y, sunk, e) + hop,
      // Face outward, toward the path, so you can see their blissful face.
      ry: lerpAngle(a.ry, ang, e),
    };
  }

  /** The cocoa mug in world space: at the chest, rising to the mouth for a sip every few seconds. */
  private sipAmount(a: Avatar) {
    const c = (a.actT % 3.6) / 3.6;
    return a.actT < 0.6 ? 0 : c > 0.62 && c < 0.92 ? Math.sin(((c - 0.62) / 0.3) * Math.PI) : 0;
  }

  private mugPos(a: Avatar): Vec3 {
    const d = this.drawPos(a);
    const sip = this.sipAmount(a);
    const up = 0.86 + sip * 0.5, fwd = 0.6 + sip * 0.12;
    return [d.x + Math.sin(d.ry) * fwd, d.y + up, d.z + Math.cos(d.ry) * fwd];
  }

  private groundY(a: Avatar) {
    const dock = dockHeightAt(a.x, a.z);
    const bridge = bridgeHeightAt(a.x, a.z);
    return Math.max(heightAt(a.x, a.z), dock ?? -Infinity, bridge ?? -Infinity, a.swim > 0.5 ? WATER_Y : -Infinity);
  }

  render() {
    const { r } = this.ctx;
    const me = this.me;
    r.time = this.time;
    applyVillageLight(r);
    const py = this.groundY(me);
    // A low, cinematic follow camera that keeps the peaks in frame.
    const pitch = 0.12 + (this.dist - 7) * 0.013;
    // Slide the camera in front of any tree canopy or building between it and the player.
    const sx = Math.sin(this.yaw), sz = Math.cos(this.yaw);
    let clearDist = this.dist;
    for (const c of HUB_COLLIDERS) {
      if (c.r < 0.9) continue;
      // Trees: their branches spread well past the trunk. Buildings: just the walls.
      // The fountain only blocks the view at its central statue tower.
      const isFountain = c.x === 0 && c.z === 0;
      const reach = isFountain ? 4.6 : c.r > 2.6 ? c.r + 0.8 : c.r * 2.3;
      const ox = c.x - me.x, oz = c.z - me.z;
      const along = ox * sx + oz * sz;
      if (along < 1.5 || along > this.dist + reach) continue;
      const side = Math.abs(ox * sz - oz * sx);
      if (side > reach) continue;
      const hit = along - Math.sqrt(reach * reach - side * side);
      clearDist = Math.min(clearDist, hit - 0.6);
    }
    // Never zoom right onto the beaver's hat: keep a comfortable distance and rise up
    // over whatever is in the way instead (a higher, steeper view).
    const MIN_DIST = 6.5;
    let lift = clearDist < MIN_DIST ? Math.min(5, (MIN_DIST - clearDist) * 0.75) : 0;
    clearDist = Math.max(Math.min(MIN_DIST, this.dist), clearDist);
    this.camDist += (clearDist - this.camDist) * Math.min(1, (clearDist < this.camDist ? 6 : 2) / 60);
    const cd = this.camDist;
    let cx = me.x + sx * Math.cos(pitch) * cd;
    let cz = me.z + sz * Math.cos(pitch) * cd;
    // The follow camera is a physical point too: push it out of buildings so it never looks through a wall,
    // and gently swing around to the open side so it doesn't stay squeezed against the building.
    for (const solid of [PL.lodge, PL.outfitter, PL.arcade]) {
      const dx = cx - solid.x, dz = cz - solid.z;
      const d = Math.hypot(dx, dz);
      const radius = solid.r + (solid === PL.lodge ? 3.5 : 1.6);
      if (d < radius && !this.photo.active) this.yaw = lerpAngle(this.yaw, Math.atan2(me.x - solid.x, me.z - solid.z), 0.03);
      if (d < radius) {
        const k = d < 0.001 ? 1 : radius / d;
        cx = solid.x + (d < 0.001 ? radius : dx * k);
        cz = solid.z + (d < 0.001 ? 0 : dz * k);
      }
    }
    // Being pushed out of a building can slide the camera in close; lift it instead of hugging the beaver.
    const hd = Math.hypot(cx - me.x, cz - me.z);
    if (hd < MIN_DIST) lift = Math.max(lift, Math.min(5, (MIN_DIST - hd) * 0.9));
    this.camLift += (lift - this.camLift) * Math.min(1, 3 / 60);
    // Keep the eye above the avatar focus even if a wall or tree shortens the
    // follow distance. Previously the shortened camera could end up lower than
    // its target (the beaver's head), which made the game suddenly look skyward.
    const focusY = py + 1.65;
    let cy = py + 2.6 + Math.sin(pitch) * cd + this.camLift;
    cy = Math.max(cy, heightAt(cx, cz) + 1.5, focusY + 1.05);
    let cam: Vec3 = [cx, cy, cz];
    let look: Vec3 = [me.x, focusY + this.lookOffset, me.z];
    if (this.photo.active) {
      const pc = this.photo.camera([me.x, py + 1.2, me.z]);
      pc.eye[1] = Math.max(pc.eye[1], heightAt(pc.eye[0], pc.eye[2]) + 0.4, WATER_Y + 0.3);
      cam = pc.eye;
      look = pc.target;
    }
    r.resize();
    const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
    r.shadowFocus = [me.x, py, me.z];
    r.begin(lookAt(cam, look), perspective(aspect < 0.8 ? 1.05 : 0.86, aspect, 0.4, 2400), cam);

    drawHub(r, this.world, this.time);

    const coneMesh = pineconeMesh(r);
    for (const c of this.cones) {
      if (this.conesGot.has(c.id)) continue;
      const d = Math.hypot(c.x - me.x, c.z - me.z);
      if (d > 120) continue;
      const y = heightAt(c.x, c.z) + 0.45 + Math.sin(this.time * 2.2 + c.id) * 0.15;
      r.draw(coneMesh, compose(c.x, y, c.z, this.time * 1.6 + c.id, 0, 0, 1.15), { unlit: true, emissive: 0.08 });
      // Little sparkles circling it so it catches your eye from across the meadow.
      for (let k = 0; k < 3; k++) {
        const a = this.time * 2.4 + (k * Math.PI * 2) / 3 + c.id;
        const tw = 0.5 + 0.5 * Math.sin(this.time * 6 + k * 2 + c.id);
        r.draw(this.world.steam, compose(c.x + Math.cos(a) * 0.62, y + 0.55 + Math.sin(a * 1.3) * 0.3, c.z + Math.sin(a) * 0.62, 0, 0, 0, 0.06 + tw * 0.05), { unlit: true, emissive: 0.8, tint: [1, 0.92, 0.5, 1], alpha: 0.9 });
      }
      r.draw(this.world.shadow, compose(c.x, heightAt(c.x, c.z) + 0.02, c.z, 0, 0, 0, 0.45), { unlit: true, alpha: 0.08 });
    }

    const pose = this.photo.active ? this.photo.pose() : null;
    const cozyM = cozy(r);
    for (const a of this.avatars.values()) {
      const d = this.drawPos(a);
      const y = d.y;
      const posed = a === me && pose;
      const sip = a.act === "cocoa" ? this.sipAmount(a) : 0;
      // Soft contact shadow keeps beavers planted; the sun adds the real cast shadow.
      if (a.soak < 0.3) r.draw(this.world.shadow, compose(a.x, this.groundY(a) + 0.014, a.z, a.ry, 0, 0, a.swim > 0.5 ? 0.68 : 1), { unlit: true, alpha: a.swim > 0.5 ? 0.03 : 0.07 });
      if (a.act === "cocoa") {
        const mp = this.mugPos(a);
        r.draw(cozyM.mug, compose(mp[0], mp[1], mp[2], d.ry, -sip * 0.9, 0), { outline: 0.02 });
      }
      if (a.soak > 0.6 && !a.info.look.hat) {
        // A folded spa towel balanced on the head.
        r.draw(cozyM.towel, compose(d.x, y + 2.12 + Math.sin(this.time * 1.4 + a.seed) * 0.02, d.z, d.ry + 0.2, 0, 0.08), { outline: 0.02 });
      }
      drawBeaver(r, getBeaverMeshes(r, a.info.look), compose(d.x, y, d.z, d.ry), {
        hold: a.act === "cocoa" ? 1 : 0, sip,
        walk: a.walk, moving: a.moving, swim: a.swim, time: this.time, sled: 0, seed: a.seed, talk: a.talkT > 0 ? 1 : 0,
        jump: posed ? pose.jump : Math.sin(a.jumpT * Math.PI) * (a.jumpT > 0 ? 1 : 0),
        wave: posed ? pose.wave : Math.min(1, a.waveT),
        cheer: posed ? pose.cheer : Math.min(1, a.cheerT * 2),
        expr: posed ? pose.expr : a.exprT > 0 ? a.expr : a.soak > 0.6 || sip > 0.3 || a.swim > 0.5 || a.waveT > 0 ? "happy" : "neutral",
      });
    }
    for (const p of this.particles) {
      const k = p.life / p.max;
      const s = p.size * (0.6 + k * 1.4);
      r.draw(this.world.steam, compose(p.x, p.y, p.z, 0, 0, 0, s), { unlit: true, tint: [...p.color, 1], alpha: 0.55 * (1 - k) });
    }
    r.end();
    this.photo.afterRender();
    this.labels.style.visibility = this.photo.active ? "hidden" : "";
    this.updateLabels();
  }

  private updateLabels() {
    const r = this.ctx.r;
    const place = (el: HTMLElement, x: number, y: number, z: number, maxDepth = 140) => {
      const s = r.project(x, y, z);
      if (!s || s.depth > maxDepth) { el.style.display = "none"; return; }
      el.style.display = "";
      el.style.left = `${s.x}px`;
      el.style.top = `${s.y}px`;
    };
    this.world.labels.forEach((l, i) => place(this.placeEls[i], l.x, heightAt(l.x, l.z) + l.y, l.z, 110));
    for (const a of this.avatars.values()) {
      const d = this.drawPos(a);
      place(a.tag, d.x, d.y + 2.75, d.z, 70);
      if (a.bubble) place(a.bubble, d.x, d.y + 3.5, d.z, 90);
    }
    for (const el of this.labels.querySelectorAll<HTMLElement & { _follow?: Avatar }>(".emote")) {
      const a = el._follow;
      if (a) place(el, a.x, this.groundY(a) + 3.2, a.z);
    }
  }

  /** Test hook used by automated browser checks. */
  debugWalkTo(x: number, z: number) {
    this.target = { x, z };
  }

  dispose() {
    this.photo.dispose();
    window.removeEventListener("keydown", this.onKey);
    this.root.remove();
  }
}
