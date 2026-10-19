import {
  CATALOG,
  CATALOG_BY_ID,
  EMOTES,
  FUR_COLORS,
  HUB_PLACES,
  PORTAL_RADIUS,
  QUICK_CHAT,
  validateMove,
  type Look,
  type PlayerInfo,
  type ServerMsg,
  type Slot,
} from "@beaver/shared";
import { compose, hexToRgb, lerp, lerpAngle, lookAt, perspective, type Vec3 } from "../engine/math";
import { h, toast } from "../ui/dom";
import { drawBeaver, getBeaverMeshes } from "./beaver";
import { heightAt, WATER_Y, type HubWorld } from "./hubWorld";
import type { Ctx, Scene } from "./scene";

const WALK_SPEED = 7.5;
const PL = HUB_PLACES;

interface Avatar {
  info: PlayerInfo;
  x: number; z: number; ry: number;
  tx: number; tz: number; tr: number;
  walk: number; moving: number; swim: number;
  jumpT: number; waveT: number;
  tag: HTMLElement;
  bubble: HTMLElement | null; bubbleUntil: number;
  trailAcc: number;
}

interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; color: Vec3; size: number; }

const ITEM_ICON: Record<string, string> = { toque: "🧶", ranger: "🤠", antlers: "🦌", crown: "👑", scarf: "🧣", pack: "🎒", canoe: "🛶", snow: "❄️", leaf: "🍁" };

export class HubScene implements Scene {
  private avatars = new Map<string, Avatar>();
  private me: Avatar;
  private yaw = 0.3;
  private dist = 15;
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
    window.addEventListener("keydown", this.onKey);
    if (room.isPrivate && room.code !== "SOLO") this.log(null, `Private cabin code: ${room.code} — share it with friends so they can join!`);
  }

  private onKey = (e: KeyboardEvent) => {
    const t = e.target as HTMLElement;
    if (t?.tagName === "INPUT") return;
    if (e.key === "Enter") {
      (this.root.querySelector("input.field") as HTMLInputElement | null)?.focus();
      e.preventDefault();
    }
    if (e.key === " ") this.ctx.net.send({ t: "emote", i: 1 });
    if (e.key.toLowerCase() === "f") this.runAction();
    if (e.key === "Escape") this.closeOverlays();
  };

  private addAvatar(p: PlayerInfo) {
    const tag = h("div.tag" + (p.id === this.ctx.state.you ? ".me" : ""), {}, p.name);
    this.labels.append(tag);
    const a: Avatar = {
      info: p, x: p.x, z: p.z, ry: p.ry, tx: p.x, tz: p.z, tr: p.ry,
      walk: 0, moving: 0, swim: 0, jumpT: 0, waveT: 0, tag, bubble: null, bubbleUntil: 0, trailAcc: 0,
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
        }
        break;
      }
      case "emote": {
        const a = this.avatars.get(m.id);
        if (!a) return;
        a.jumpT = 1;
        if (m.i === 0) a.waveT = 1.6;
        const el = h("div.emote", {}, EMOTES[m.i] ?? "");
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

  private shopTab: Slot | "fur" = "hat";

  private openShop(tab: Slot | "fur") {
    this.shopTab = tab;
    this.closeOverlays();
    this.panelEl = h("div.overlay.pe", { onclick: (e: Event) => { if (e.target === this.panelEl) this.closeOverlays(); } });
    this.root.append(this.panelEl);
    this.refreshShop();
  }

  private refreshShop() {
    if (!this.panelEl) return;
    const st = this.ctx.state;
    const tabs: [Slot | "fur", string][] = [["hat", "Hats"], ["scarf", "Scarves"], ["backpack", "Packs"], ["trail", "Trails"], ["fur", "Fur"]];
    const setLook = (look: Look) => this.ctx.net.send({ t: "look", look });
    let grid: HTMLElement;
    if (this.shopTab === "fur") {
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
      h("div", { style: "padding:0 16px 6px;font-size:13px;color:var(--muted);font-weight:700" }, "Cosmetics are just for looks — they never change how you play. Earn coins in Toboggan Rush!"),
      grid,
    ]);
    this.panelEl.replaceChildren(panel);
  }

  private showHelp() {
    this.closeOverlays();
    this.panelEl = h("div.overlay.pe", { onclick: () => this.closeOverlays() }, h("div.card.help", {}, [
      h("h2", {}, "How to play"),
      h("div", {}, [h("b", {}, "Walk: "), h("kbd", {}, "W A S D"), " / arrows, or tap the ground"]),
      h("div", {}, [h("b", {}, "Look around: "), "drag the screen · ", h("kbd", {}, "Q"), " ", h("kbd", {}, "E"), " · scroll to zoom"]),
      h("div", {}, [h("b", {}, "Chat: "), h("kbd", {}, "Enter"), " · 💬 quick chat · 😀 emotes · ", h("kbd", {}, "Space"), " to hop"]),
      h("div", {}, [h("b", {}, "Do things: "), "walk up to a place and press the big button (or ", h("kbd", {}, "F"), ")"]),
      h("div", { style: "margin-top:8px" }, "🛷 Head north to the trailhead portal for Toboggan Rush. Win coins, then spend them at the 🎒 Outfitter."),
      h("div", { style: "margin-top:8px" }, "🛡️ Tap another beaver to wave, block or report them."),
    ]));
    this.root.append(this.panelEl);
  }

  private openPlayerCard(a: Avatar, sx: number, sy: number) {
    this.closeOverlays();
    const close = () => this.closeOverlays();
    const card = h("div.card.playercard.pe", { style: { left: `${sx}px`, top: `${sy}px` } }, [
      h("h3", {}, a.info.name),
      h("button.btn.small", { onclick: () => { this.ctx.net.send({ t: "emote", i: 0 }); close(); } }, "👋 Wave"),
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
    if (k === "lodge") { this.ctx.net.send({ t: "emote", i: 1 }); toast(this.root, "☕ Mmm… maple hot cocoa. Cozy!"); }
    if (k === "arcade") toast(this.root, "🕹️ Coming soon: Log Rolling & Dam Builder!");
    if (k === "spring") { this.ctx.net.send({ t: "emote", i: 7 }); toast(this.root, "♨️ Ahh, toasty warm."); }
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
    if (k === "lodge") label = "☕ Grab a hot cocoa";
    if (k === "arcade") label = "🕹️ Peek inside the arcade";
    if (k === "spring") label = "♨️ Soak in the hot spring";
    if (label === this.actionKey) return;
    this.actionKey = label;
    this.actionEl.replaceChildren(label ? h("button.btn" + (k === "race" ? ".orange" : ""), { onclick: () => this.runAction(), style: "font-size:19px;padding:12px 20px" }, label) : "");
  }

  // ---------- Frame ----------

  update(dt: number) {
    this.time += dt;
    const inp = this.ctx.input;
    this.yaw -= inp.consumeDrag() * 0.006;
    if (inp.down("q")) this.yaw += dt * 1.8;
    if (inp.down("e")) this.yaw -= dt * 1.8;
    this.dist = Math.max(7, Math.min(28, this.dist + inp.consumeZoom() * 1.2));

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
    if (len > 0) {
      const swimming = heightAt(me.x, me.z) < WATER_Y - 0.3;
      const sp = WALK_SPEED * (swimming ? 0.7 : 1);
      const next = validateMove(me, { x: me.x + (mx / len) * sp * dt, z: me.z + (mz / len) * sp * dt }, dt * 1000);
      if (this.target && Math.hypot(next.x - me.x, next.z - me.z) < sp * dt * 0.2) this.target = null; // blocked
      me.x = next.x;
      me.z = next.z;
      me.tr = Math.atan2(mx, mz);
    }
    me.tx = me.x; me.tz = me.z;
    me.moving = lerp(me.moving, len > 0 ? 1 : 0, Math.min(1, dt * 10));

    this.sendAcc += dt;
    if (this.sendAcc > 1 / 12) {
      this.sendAcc = 0;
      if (me.x !== this.lastSent.x || me.z !== this.lastSent.z || me.tr !== this.lastSent.ry) {
        this.ctx.net.send({ t: "move", x: me.x, z: me.z, ry: me.tr });
        this.lastSent = { x: me.x, z: me.z, ry: me.tr };
      }
    }

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
      a.ry = lerpAngle(a.ry, a.tr, Math.min(1, dt * 12));
      a.walk += dt * 11 * a.moving;
      a.swim = lerp(a.swim, heightAt(a.x, a.z) < WATER_Y - 0.3 ? 1 : 0, Math.min(1, dt * 5));
      a.jumpT = Math.max(0, a.jumpT - dt * 2.2);
      a.waveT = Math.max(0, a.waveT - dt);
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
        vx: 0, vy: 1.0, vz: 0, life: 0, max: 2.4, color: [1, 1, 1], size: 0.7,
      });
    }
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    this.particles = this.particles.filter((p) => p.life < p.max);
    this.updateAction();
  }

  private groundY(a: Avatar) {
    return Math.max(heightAt(a.x, a.z), a.swim > 0.5 ? WATER_Y : -Infinity);
  }

  render() {
    const { r } = this.ctx;
    const me = this.me;
    r.time = this.time;
    r.env.fogNear = 90;
    r.env.fogFar = 420;
    // Match the painted sky mesh: a clear cold-blue Banff day, not a peach fog filter.
    r.env.skyHorizon = [0.72, 0.85, 0.91];
    r.env.skyTop = [0.16, 0.48, 0.70];
    const py = this.groundY(me);
    const pitch = 0.42 + (this.dist - 7) * 0.008;
    let cx = me.x + Math.sin(this.yaw) * Math.cos(pitch) * this.dist;
    let cz = me.z + Math.cos(this.yaw) * Math.cos(pitch) * this.dist;
    let cy = py + 1.4 + Math.sin(pitch) * this.dist;
    cy = Math.max(cy, heightAt(cx, cz) + 1.2);
    const cam: Vec3 = [cx, cy, cz];
    r.resize();
    const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
    r.begin(lookAt(cam, [me.x, py + 1.5, me.z]), perspective(aspect < 0.8 ? 1.05 : 0.85, aspect, 0.5, 1600), cam);

    const I = compose(0, 0, 0);
    r.draw(this.world.sky, compose(cx, 0, cz), { unlit: true, noFog: true });
    r.draw(this.world.mountains, I, { outline: 0.6 });
    r.draw(this.world.terrain, I);
    r.draw(this.world.props, I, { outline: 0.07 });
    r.draw(this.world.glow, I, { unlit: true });
    const pulse = 1 + Math.sin(this.time * 3) * 0.05;
    r.draw(this.world.portal, compose(PL.trailhead.x, 3.3, PL.trailhead.z, 0, 0, this.time * 0.8, pulse), { unlit: true });

    for (const a of this.avatars.values()) {
      const y = this.groundY(a);
      drawBeaver(r, getBeaverMeshes(r, a.info.look), compose(a.x, y, a.z, a.ry), {
        walk: a.walk, moving: a.moving, swim: a.swim, jump: Math.sin(a.jumpT * Math.PI) * (a.jumpT > 0 ? 1 : 0), wave: Math.min(1, a.waveT), sled: 0, time: this.time + a.x,
      });
    }
    r.draw(this.world.water, I, { wave: true, alpha: 0.86 });
    for (const p of this.particles) {
      const k = p.life / p.max;
      const s = p.size * (0.6 + k * 1.4);
      r.draw(this.world.steam, compose(p.x, p.y, p.z, 0, 0, 0, s), { unlit: true, tint: [...p.color, 1], alpha: 0.55 * (1 - k) });
    }
    r.end();
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
      const y = this.groundY(a);
      place(a.tag, a.x, y + 2.75, a.z, 70);
      if (a.bubble) place(a.bubble, a.x, y + 3.5, a.z, 90);
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
    window.removeEventListener("keydown", this.onKey);
    this.root.remove();
  }
}
