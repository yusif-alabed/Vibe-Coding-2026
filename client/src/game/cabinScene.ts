import {
  CABIN_D,
  CABIN_W,
  FIREPLACE_CELLS,
  footprint,
  FURNITURE,
  FURNITURE_BY_ID,
  validateLayout,
  type Look,
  type PlacedItem,
  type ServerMsg,
} from "@beaver/shared";
import { compose, hash2, hexToRgb, lerp, lerpAngle, lookAt, mixRgb, perspective, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { h, toast } from "../ui/dom";
import { furnitureGrid } from "../ui/furnitureShop";
import { drawBeaver, getBeaverMeshes } from "./beaver";
import { applyTimeOfDay, dayPhase } from "./daylight";
import { PhotoMode } from "./photo";
import type { Ctx, Scene } from "./scene";
import { CELL, furnitureMesh } from "./village/furniture";

/** Inside a beaver's log cabin: walk around, decorate on a tile grid, take photos, invite friends. */

const HALF_W = (CABIN_W * CELL) / 2;
const HALF_D = (CABIN_D * CELL) / 2;
const WALL_H = 4.3;

interface Shell { body: GpuMesh; glow: GpuMesh; view: GpuMesh; fire: GpuMesh; grid: GpuMesh; shadow: GpuMesh }
const shells = new WeakMap<Renderer, Shell>();
const furnitureGpu = new WeakMap<Renderer, Map<string, { body: GpuMesh; glow: GpuMesh | null }>>();

function gpuFurniture(r: Renderer, id: string) {
  let m = furnitureGpu.get(r);
  if (!m) furnitureGpu.set(r, (m = new Map()));
  let f = m.get(id);
  if (!f) {
    const src = furnitureMesh(id);
    f = { body: r.upload(src.body.build()), glow: src.glow ? r.upload(src.glow.build()) : null };
    m.set(id, f);
  }
  return f;
}

function buildShell(r: Renderer): Shell {
  const hit = shells.get(r);
  if (hit) return hit;
  const m = new MeshBuilder(), g = new MeshBuilder(), view = new MeshBuilder(), fire = new MeshBuilder(), grid = new MeshBuilder(), shadow = new MeshBuilder();
  const plankA = hexToRgb("#c98e58"), plankB = hexToRgb("#b47a47"), plankC = hexToRgb("#d9a26b");
  // Plank floor, slightly wider than the play grid.
  const planks = 26;
  for (let i = 0; i < planks; i++) {
    const x = -HALF_W - 0.3 + ((i + 0.5) * (HALF_W * 2 + 0.6)) / planks;
    const segs = 2 + (i % 3);
    let z = -HALF_D - 0.3;
    for (let s = 0; s < segs; s++) {
      const len = (HALF_D * 2 + 1.6) / segs;
      const k = hash2(i, s);
      m.box(compose(x, -0.09, z + len / 2, 0, 0, 0, (HALF_W * 2 + 0.6) / planks - 0.025, 0.18, len - 0.03), k < 0.33 ? plankA : k < 0.66 ? plankB : plankC);
      z += len;
    }
  }
  m.box(compose(0, -0.3, 0, 0, 0, 0, HALF_W * 2 + 1.6, 0.4, HALF_D * 2 + 1.8), hexToRgb("#5e3a22"));
  // Front sill and a woven door mat.
  m.box(compose(0, 0.06, HALF_D + 0.55, 0, 0, 0, HALF_W * 2 + 1.2, 0.3, 0.5), hexToRgb("#8a5531"));
  m.box(compose(0, 0.22, HALF_D + 0.55, 0, 0, 0, 2.2, 0.02, 0.42), hexToRgb("#d9b77a"));

  const log = (x: number, y: number, z: number, len: number, alongX: boolean, seed: number) => {
    const c = mixRgb(hexToRgb("#9a6a48"), hexToRgb("#6f4630"), hash2(seed, y * 3));
    m.cylinder(compose(x, y, z, alongX ? 0 : Math.PI / 2, 0, Math.PI / 2, 0.58, len, 0.58), c, 12);
    // Cut ends show light rings.
    for (const s of [-1, 1]) {
      const ex = alongX ? x + (s * len) / 2 : x, ez = alongX ? z : z + (s * len) / 2;
      m.cylinder(compose(ex, y, ez, alongX ? 0 : Math.PI / 2, 0, Math.PI / 2, 0.5, 0.03, 0.5), hexToRgb("#e2b27a"), 12);
    }
  };
  const rows = Math.ceil(WALL_H / 0.52);
  for (let k = 0; k < rows; k++) {
    const y = 0.28 + k * 0.52;
    log(0, y, -HALF_D - 0.3, HALF_W * 2 + 1.4, true, k);
    for (const s of [-1, 1]) {
      // Side walls have a window between rows 2 and 5.
      const winRow = k >= 2 && k <= 5;
      if (!winRow) log(s * (HALF_W + 0.3), y + 0.26, 0.2, HALF_D * 2 + 0.8, false, k + s * 10);
      else {
        const wz = -0.4, ww = 2.6;
        const backLen = wz - ww / 2 - (-HALF_D - 0.2), frontLen = HALF_D + 0.6 - (wz + ww / 2);
        log(s * (HALF_W + 0.3), y + 0.26, -HALF_D - 0.2 + backLen / 2, backLen, false, k + s * 10);
        log(s * (HALF_W + 0.3), y + 0.26, wz + ww / 2 + frontLen / 2, frontLen, false, k + s * 20);
      }
    }
  }
  // Windows: frames + a painted snowy view.
  for (const s of [-1, 1]) {
    const x = s * (HALF_W + 0.3), wz = -0.4;
    const frame = hexToRgb("#5b3420");
    m.box(compose(x, 1.06, wz, 0, 0, 0, 0.75, 0.16, 2.9), frame);
    m.box(compose(x, 3.2, wz, 0, 0, 0, 0.75, 0.16, 2.9), frame);
    for (const dz of [-1.38, 0, 1.38]) m.box(compose(x, 2.13, wz + dz, 0, 0, 0, 0.7, 2.1, dz === 0 ? 0.08 : 0.16), frame);
    m.box(compose(x - s * 0.06, 2.13, wz, 0, 0, 0, 0.06, 0.08, 2.7), frame);
    m.box(compose(x - s * 0.42, 1.0, wz, 0, 0, 0, 0.3, 0.08, 3.0), hexToRgb("#8a5531"));
    // The view: sky, mountains, snow and pines, drawn unlit so it glows like daylight.
    const px = x + s * 0.12;
    view.box(compose(px, 2.13, wz, 0, 0, 0, 0.02, 2.0, 2.6), hexToRgb("#a9d6f2"));
    for (let i = 0; i < 3; i++) {
      const mz = wz - 0.9 + i * 0.9;
      view.cone(compose(px - s * 0.02, 1.85, mz, 0, 0, Math.PI / 2 * 0, 0.02, 1.0, 1.1), hexToRgb(i === 1 ? "#ffffff" : "#e7f3fb"), 3);
    }
    view.box(compose(px - s * 0.03, 1.32, wz, 0, 0, 0, 0.02, 0.4, 2.6), hexToRgb("#f4fbff"));
    for (let i = 0; i < 4; i++) view.cone(compose(px - s * 0.04, 1.6, wz - 1.0 + i * 0.66, 0, 0, 0, 0.02, 0.6, 0.3), hexToRgb("#2f7d5a"), 4);
  }
  // Top plates along the walls (the roof is left off, dollhouse style, so you can see in).
  m.box(compose(0, WALL_H + 0.12, -HALF_D - 0.3, 0, 0, 0, HALF_W * 2 + 1.5, 0.24, 0.7), hexToRgb("#6e4024"));
  for (const s of [-1, 1]) m.box(compose(s * (HALF_W + 0.3), WALL_H + 0.38, 0.2, 0, 0, 0, 0.7, 0.24, HALF_D * 2 + 0.9), hexToRgb("#6e4024"));
  // Stone fireplace on the back wall (grid cells 4–5, row 0).
  const fx = 0, fz = -HALF_D + 0.35;
  const stoneCols = ["#a9a39a", "#8f8a83", "#c2bcb2", "#7d7770"].map(hexToRgb);
  for (let yy = 0; yy < 12; yy++) {
    const wide = yy < 6 ? 2.6 : 1.5;
    const n = yy < 6 ? 5 : 3;
    for (let i = 0; i < n; i++) {
      const sx = -wide / 2 + ((i + 0.5 + (yy % 2) * 0.3) * wide) / (n + 0.3);
      m.box(compose(fx + sx, 0.2 + yy * 0.38, fz, 0, (hash2(i, yy) - 0.5) * 0.06, 0, wide / n + 0.04, 0.4, yy < 6 ? 0.9 : 0.6), stoneCols[Math.floor(hash2(yy, i) * 4)], 0.08);
    }
  }
  m.box(compose(fx, 0.75, fz + 0.2, 0, 0, 0, 1.3, 1.1, 0.62), hexToRgb("#2a1b14")); // firebox
  m.box(compose(fx, 0.07, fz + 0.62, 0, 0, 0, 2.9, 0.14, 0.5), hexToRgb("#8f8a83")); // hearth
  m.box(compose(fx, 2.36, fz + 0.32, 0, 0, 0, 3.1, 0.18, 0.62), hexToRgb("#7b4527")); // mantle
  for (const s of [-1, 1]) {
    m.cylinder(compose(fx + s * 1.1, 2.6, fz + 0.36, 0, 0, 0, 0.16, 0.3, 0.16), hexToRgb("#fffaf0"), 8);
    g.sphere(compose(fx + s * 1.1, 2.8, fz + 0.36, 0, 0, 0, 0.05, 0.08, 0.05), hexToRgb("#ffcf6a"), 4, 6);
  }
  m.box(compose(fx, 2.75, fz + 0.3, 0, 0, 0, 0.7, 0.5, 0.06), hexToRgb("#5b3420"));
  g.box(compose(fx, 2.75, fz + 0.34, 0, 0, 0, 0.56, 0.36, 0.02), hexToRgb("#7fc3d9"));
  g.cone(compose(fx, 2.73, fz + 0.36, 0, 0, 0, 0.5, 0.26, 0.02), hexToRgb("#ffffff"), 3);
  // Logs and flames in the firebox.
  for (const s of [-1, 1]) m.cylinder(compose(fx + s * 0.15, 0.32, fz + 0.3, s * 0.4, 0, Math.PI / 2, 0.18, 0.9, 0.18), hexToRgb("#5b3420"), 8);
  const flame: [number, number, number, string][] = [[0, 0.62, 0.42, "#ff8a3d"], [-0.22, 0.52, 0.3, "#ffb347"], [0.22, 0.5, 0.3, "#ffb347"], [0, 0.48, 0.22, "#ffe28a"]];
  for (const [x, hgt, w, c] of flame) fire.cone(compose(fx + x, 0.42 + hgt / 2, fz + 0.36, 0, 0, 0, w, hgt, w * 0.7), hexToRgb(c), 6);
  // A painting and a pair of snowshoes on the back wall.
  const pnt = (x: number, y: number) => {
    m.box(compose(x, y, -HALF_D + 0.05, 0, 0, 0, 1.6, 1.1, 0.08), hexToRgb("#5b3420"));
    g.box(compose(x, y, -HALF_D + 0.1, 0, 0, 0, 1.36, 0.86, 0.02), hexToRgb("#f2b36b"));
    g.cone(compose(x - 0.2, y - 0.08, -HALF_D + 0.12, 0, 0, 0, 0.9, 0.62, 0.02), hexToRgb("#5d6c8a"), 3);
    g.cone(compose(x + 0.3, y - 0.14, -HALF_D + 0.13, 0, 0, 0, 0.7, 0.5, 0.02), hexToRgb("#7a87a6"), 3);
    g.box(compose(x, y - 0.33, -HALF_D + 0.14, 0, 0, 0, 1.36, 0.2, 0.02), hexToRgb("#3a7d6b"));
  };
  pnt(-3.6, 2.6);
  for (const s of [-1, 1]) {
    m.torus(compose(3.4 + s * 0.35, 2.6, -HALF_D + 0.08, 0, Math.PI / 2, s * 0.15, 0.32, 0.5, 0.32), hexToRgb("#7b4527"), 1, 0.12, 14, 4);
    m.box(compose(3.4 + s * 0.35, 2.6, -HALF_D + 0.1, 0, 0, s * 0.15, 0.4, 0.7, 0.02), hexToRgb("#d9b77a"));
  }
  // Grid lines (edit mode only).
  for (let i = 0; i <= CABIN_W; i++) grid.box(compose(-HALF_W + i * CELL, 0.012, 0, 0, 0, 0, 0.035, 0.01, HALF_D * 2), [1, 1, 1]);
  for (let j = 0; j <= CABIN_D; j++) grid.box(compose(0, 0.012, -HALF_D + j * CELL, 0, 0, 0, HALF_W * 2, 0.01, 0.035), [1, 1, 1]);
  shadow.cylinder(compose(0, 0, 0, 0, 0, 0, 1.2, 0.01, 1.2), [0, 0, 0], 16);
  const out = { body: r.upload(m.build()), glow: r.upload(g.build()), view: r.upload(view.build()), fire: r.upload(fire.build()), grid: r.upload(grid.build()), shadow: r.upload(shadow.build()) };
  shells.set(r, out);
  return out;
}

const mixDir = (a: Vec3, b: Vec3, t: number): Vec3 => {
  const v: Vec3 = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const l = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / l, v[1] / l, v[2] / l];
};

const cellCenter = (x: number, z: number, w: number, d: number) => ({ x: -HALF_W + (x + w / 2) * CELL, z: -HALF_D + (z + d / 2) * CELL });

interface Held { id: string; rot: number; from: PlacedItem | null }

export class CabinScene implements Scene {
  private root: HTMLElement;
  private shell: Shell;
  private items: PlacedItem[];
  private editing = false;
  private held: Held | null = null;
  private dirty = false;
  private saveTimer = 0;
  private yaw = 0;
  private pitch = 0.92;
  private dist = 16.5;
  private time = 0;
  private me = { x: 0, z: HALF_D - 1, ry: 0, tr: 0, walk: 0, moving: 0, jumpT: 0, waveT: 1.5 };
  private target: { x: number; z: number } | null = null;
  private ghost: { item: PlacedItem; ok: boolean } | null = null;
  private hoverItem: PlacedItem | null = null;
  private invEl: HTMLElement | null = null;
  private toolsEl: HTMLElement | null = null;
  private hintEl: HTMLElement;
  private coinsEl: HTMLElement;
  private editBtn: HTMLElement | null = null;
  private panelEl: HTMLElement | null = null;
  private meTag: HTMLElement;
  private ownerTag: HTMLElement | null = null;
  private photo: PhotoMode;
  private night = 0;
  private windowTint: [number, number, number, number] = [0, 0, 0, 0];

  constructor(private ctx: Ctx, private msg: Extract<ServerMsg, { t: "cabin" }>) {
    this.shell = buildShell(ctx.r);
    this.items = msg.items.map((i) => ({ ...i }));
    this.root = h("div", { style: "position:absolute;inset:0" });
    ctx.ui.append(this.root);
    const hud = h("div", { style: "position:absolute;inset:0" });
    this.root.append(hud);
    const mine = msg.editable;
    this.coinsEl = h("span", {}, String(ctx.state.coins));
    this.hintEl = h("div.cabin-hint");
    this.meTag = h("div.tag.me", {}, ctx.state.name);
    this.root.append(this.meTag);
    if (!mine) {
      this.ownerTag = h("div.tag", {}, msg.ownerName);
      this.root.append(this.ownerTag);
    }
    hud.append(
      h("div.hud-top", {}, [
        h("div.pill", {}, mine ? "🏡 Your cabin" : `🏡 ${msg.ownerName}'s cabin`),
        h("div.row", {}, [h("div.pill.coins", { title: "Coins" }, ["🪙", this.coinsEl])]),
      ]),
      this.hintEl,
      h("div.hud-bottom", {}, [
        h("button.btn.orange.pe", { onclick: () => this.leave() }, "🚪 Back to the village"),
        h("div", { style: "flex:1" }),
        mine ? (this.editBtn = h("button.btn.gold.pe", { onclick: () => this.setEditing(!this.editing) }, "✏️ Decorate")) : null,
        h("button.btn.cream.icon.pe", { title: "Photo mode", onclick: () => this.photo.open(this.me.ry, 5) }, "📷"),
      ]),
    );
    this.photo = new PhotoMode(ctx, this.root, {
      place: () => (mine ? "Home sweet cabin" : `Visiting ${msg.ownerName}`),
      onShot: () => ctx.net.send({ t: "photo" }),
      minDist: 2.2,
      maxDist: 14,
      maxPitch: 1.0,
    });
    this.setHint();
    // Arrive near the door, on the first free spot.
    const spots: [number, number][] = [[0, HALF_D - 1], [-1.2, HALF_D - 1], [1.2, HALF_D - 1], [-2.4, HALF_D - 1], [2.4, HALF_D - 1], [0, HALF_D + 0.2], [-3.6, HALF_D - 1], [3.6, HALF_D - 1]];
    const free = spots.find(([x, z]) => !this.blocked(x, z)) ?? [0, HALF_D + 0.2];
    this.me.x = free[0];
    this.me.z = free[1];
    window.addEventListener("keydown", this.onKey);
    if (mine && this.items.length <= 3 && !(ctx.state.quests?.list.find((q) => q.id === "decorate")?.done ?? true)) {
      setTimeout(() => toast(this.root, "Tap ✏️ Decorate to arrange your furniture!", 3500), 600);
    }
  }

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT" || this.photo.active) return;
    const k = e.key.toLowerCase();
    if (k === "r" && this.held) this.rotate();
    if (k === "escape") {
      if (this.panelEl) this.closePanel();
      else if (this.held) this.cancelHeld();
      else if (this.editing) this.setEditing(false);
    }
    if ((k === "delete" || k === "backspace") && this.held) this.putAway();
    if (k === " ") this.me.jumpT = 1;
  };

  private setHint() {
    const t = !this.msg.editable
      ? `Make yourself at home in ${this.msg.ownerName}'s cabin — tap the floor to walk around.`
      : this.editing
        ? this.held
          ? "Tap a tile to place it · R or ⟳ to turn it · 🧺 to put it away"
          : "Pick something from your basket, or tap furniture in the room to move it."
        : "";
    this.hintEl.textContent = t;
  }

  private setEditing(on: boolean) {
    if (!on && this.held) this.cancelHeld();
    if (on) this.pitch = Math.max(this.pitch, 1.02);
    this.editing = on;
    this.target = null;
    this.editBtn && (this.editBtn.textContent = on ? "✅ Done" : "✏️ Decorate");
    if (!on) this.flushSave();
    this.renderEditUi();
  }

  private remaining(id: string) {
    const placed = this.items.filter((i) => i.id === id).length + (this.held?.id === id ? 1 : 0);
    return (this.ctx.state.furniture[id] ?? 0) - placed;
  }

  private renderEditUi() {
    this.invEl?.remove();
    this.toolsEl?.remove();
    this.invEl = this.toolsEl = null;
    this.setHint();
    if (!this.editing) return;
    const owned = FURNITURE.filter((f) => (this.ctx.state.furniture[f.id] ?? 0) > 0);
    this.invEl = h("div.card.inventory.pe", {}, [
      ...owned.map((f) => {
        const left = this.remaining(f.id);
        return h("div.inv" + (this.held?.id === f.id ? ".on" : "") + (left <= 0 ? ".empty" : ""), {
          title: f.name,
          onclick: () => {
            if (left <= 0) { toast(this.root, `All your ${f.name}s are out — buy another in the shop!`); return; }
            if (this.held && !this.held.from) this.held = null;
            else if (this.held) this.cancelHeld();
            this.held = { id: f.id, rot: 0, from: null };
            this.renderEditUi();
          },
        }, [h("span.e", {}, f.icon), f.name, h("span.c", {}, String(Math.max(0, left)))]);
      }),
      h("div.inv.shop", { title: "Buy furniture", onclick: () => this.openShop() }, [h("span.e", {}, "🛒"), "Shop"]),
    ]);
    this.root.append(this.invEl);
    if (this.held) {
      this.toolsEl = h("div.edit-tools.pe", {}, [
        h("button.btn.small", { onclick: () => this.rotate() }, "⟳ Turn"),
        h("button.btn.small.cream", { onclick: () => this.putAway() }, "🧺 Put away"),
        h("button.btn.small.cream", { onclick: () => this.cancelHeld() }, "✕ Cancel"),
      ]);
      this.root.append(this.toolsEl);
    }
  }

  private rotate() {
    if (!this.held) return;
    this.held.rot = (this.held.rot + 1) % 4;
  }

  private putAway() {
    if (!this.held) return;
    const had = this.held.from;
    this.held = null;
    if (had) this.markDirty();
    this.renderEditUi();
  }

  private cancelHeld() {
    if (!this.held) return;
    if (this.held.from) this.items.push(this.held.from);
    this.held = null;
    this.renderEditUi();
  }

  private markDirty() {
    this.dirty = true;
    this.saveTimer = 0.8;
  }

  private flushSave() {
    if (!this.dirty || !this.msg.editable) return;
    this.dirty = false;
    this.ctx.net.send({ t: "saveCabin", items: this.items });
  }

  private openShop() {
    this.closePanel();
    this.panelEl = h("div.overlay.pe", { onclick: (e: Event) => { if (e.target === this.panelEl) this.closePanel(); } });
    this.root.append(this.panelEl);
    this.refreshShop();
  }

  private refreshShop() {
    if (!this.panelEl) return;
    this.panelEl.replaceChildren(h("div.card.panel", {}, [
      h("header", {}, [
        h("h2", {}, "🛒 Cabin furniture"),
        h("div.row", {}, [h("div.pill.coins", {}, `🪙 ${this.ctx.state.coins}`), h("button.btn.cream.small", { onclick: () => this.closePanel() }, "✕")]),
      ]),
      h("div", { style: "padding:0 16px 6px;font-size:13px;color:var(--muted);font-weight:700" }, "Earn coins from races, daily quests and golden pinecones."),
      furnitureGrid(this.ctx),
    ]));
  }

  private closePanel() {
    this.panelEl?.remove();
    this.panelEl = null;
  }

  private leave() {
    if (this.held) this.cancelHeld();
    this.flushSave();
    this.ctx.net.send({ t: "leaveCabin" });
  }

  handle(m: ServerMsg) {
    switch (m.t) {
      case "furniture":
        this.ctx.state.furniture = m.counts;
        this.renderEditUi();
        this.refreshShop();
        break;
      case "wallet":
        this.ctx.state.coins = m.coins;
        this.ctx.state.owned = m.owned;
        this.coinsEl.textContent = String(m.coins);
        this.refreshShop();
        break;
      case "quests":
        this.ctx.state.quests = m;
        for (const label of m.justCompleted ?? []) toast(this.root, `✅ Quest complete: ${label}`, 3200);
        if (m.bonusNow) setTimeout(() => toast(this.root, "🎉 All daily quests done! +50 bonus coins", 3500), 900);
        break;
      case "cabin":
        // The server rejected a save and sent the stored layout back.
        this.items = m.items.map((i) => ({ ...i }));
        this.held = null;
        this.renderEditUi();
        break;
      case "system":
        toast(this.root, m.text);
        break;
      case "error":
        toast(this.root, m.text, 3200);
        break;
    }
  }

  /** Which grid cell a screen point is over (null when off the floor). */
  private cellAt(px: number, py: number): { i: number; j: number } | null {
    const g = this.ctx.r.pickGround(px, py, 0);
    if (!g) return null;
    const i = Math.floor((g.x + HALF_W) / CELL), j = Math.floor((g.z + HALF_D) / CELL);
    if (i < 0 || j < 0 || i >= CABIN_W || j >= CABIN_D) return null;
    return { i, j };
  }

  private itemAt(i: number, j: number): PlacedItem | null {
    let rug: PlacedItem | null = null;
    for (let k = this.items.length - 1; k >= 0; k--) {
      const it = this.items[k];
      const def = FURNITURE_BY_ID[it.id];
      const [w, d] = footprint(def, it.rot);
      if (i >= it.x && i < it.x + w && j >= it.z && j < it.z + d) {
        if (def.layer === 1) return it;
        rug ??= it;
      }
    }
    return rug;
  }

  private candidate(cell: { i: number; j: number }, held: Held): PlacedItem {
    const def = FURNITURE_BY_ID[held.id];
    const [w, d] = footprint(def, held.rot);
    const x = Math.max(0, Math.min(CABIN_W - w, cell.i - Math.floor((w - 1) / 2)));
    const z = Math.max(0, Math.min(CABIN_D - d, cell.j - Math.floor((d - 1) / 2)));
    return { id: held.id, x, z, rot: held.rot };
  }

  private blocked(x: number, z: number) {
    const i = Math.floor((x + HALF_W) / CELL), j = Math.floor((z + HALF_D) / CELL);
    if (FIREPLACE_CELLS.some(([a, b]) => a === i && b === j)) return true;
    const it = i >= 0 && j >= 0 && i < CABIN_W && j < CABIN_D ? this.itemAt(i, j) : null;
    return !!it && FURNITURE_BY_ID[it.id].layer === 1 && !["plush", "rug_round", "rug_plaid"].includes(it.id);
  }

  update(dt: number) {
    this.time += dt;
    const inp = this.ctx.input;
    if (this.saveTimer > 0) {
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) this.flushSave();
    }
    if (this.photo.active) {
      this.photo.update(dt);
      this.animateMe(dt, 0, 0);
      return;
    }
    this.yaw = Math.max(-0.75, Math.min(0.75, this.yaw - inp.consumeDrag() * 0.005));
    this.pitch = Math.max(0.42, Math.min(1.25, this.pitch + inp.consumeDragY() * 0.004));
    this.dist = Math.max(8, Math.min(22, this.dist + inp.consumeZoom() * 1.0));
    if (inp.down("q")) this.yaw = Math.min(0.75, this.yaw + dt * 1.2);
    if (inp.down("e")) this.yaw = Math.max(-0.75, this.yaw - dt * 1.2);

    // Placement preview follows the mouse (or the last tap on touch screens).
    const hov = inp.hover;
    const hoverCell = hov ? this.cellAt(hov.x, hov.y) : null;
    this.ghost = null;
    this.hoverItem = null;
    if (this.editing && hoverCell) {
      if (this.held) {
        const c = this.candidate(hoverCell, this.held);
        this.ghost = { item: c, ok: validateLayout([...this.items, c], this.ctx.state.furniture).ok };
      } else this.hoverItem = this.itemAt(hoverCell.i, hoverCell.j);
    }

    const tap = inp.consumeTap();
    if (tap && !this.panelEl) {
      const cell = this.cellAt(tap.x, tap.y);
      if (this.editing) {
        if (cell && this.held) {
          const c = this.candidate(cell, this.held);
          const res = validateLayout([...this.items, c], this.ctx.state.furniture);
          if (res.ok) {
            this.items.push(c);
            this.held = null;
            this.markDirty();
            this.renderEditUi();
          } else if (inp.hover && (Math.abs(inp.hover.x - tap.x) > 2 || Math.abs(inp.hover.y - tap.y) > 2)) {
            // Touch screens: the first tap only moves the preview.
          } else toast(this.root, res.reason);
        } else if (cell) {
          const it = this.itemAt(cell.i, cell.j);
          if (it) {
            this.items.splice(this.items.indexOf(it), 1);
            this.held = { id: it.id, rot: it.rot, from: it };
            this.markDirty();
            this.renderEditUi();
          }
        }
        if (cell) this.ctx.input.hover = { ...tap };
      } else {
        const g = this.ctx.r.pickGround(tap.x, tap.y, 0);
        if (g) this.target = { x: Math.max(-HALF_W + 0.5, Math.min(HALF_W - 0.5, g.x)), z: Math.max(-HALF_D + 0.6, Math.min(HALF_D + 0.3, g.z)) };
      }
    }

    // Walking (not while decorating).
    let mx = 0, mz = 0;
    if (!this.editing) {
      const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
      if (inp.down("w", "arrowup")) { mx += fx; mz += fz; }
      if (inp.down("s", "arrowdown")) { mx -= fx; mz -= fz; }
      if (inp.down("d", "arrowright")) { mx += -fz; mz += fx; }
      if (inp.down("a", "arrowleft")) { mx -= -fz; mz -= fx; }
      if (mx || mz) this.target = null;
      if (this.target) {
        const dx = this.target.x - this.me.x, dz = this.target.z - this.me.z, d = Math.hypot(dx, dz);
        if (d < 0.25) this.target = null;
        else { mx = dx / d; mz = dz / d; }
      }
    }
    this.animateMe(dt, mx, mz);
  }

  private animateMe(dt: number, mx: number, mz: number) {
    const me = this.me;
    const len = Math.hypot(mx, mz);
    if (len > 0) {
      const sp = 4.5 * dt;
      const nx = Math.max(-HALF_W + 0.5, Math.min(HALF_W - 0.5, me.x + (mx / len) * sp));
      const nz = Math.max(-HALF_D + 0.6, Math.min(HALF_D + 0.3, me.z + (mz / len) * sp));
      if (!this.blocked(nx, nz)) { me.x = nx; me.z = nz; }
      else if (!this.blocked(nx, me.z)) me.x = nx;
      else if (!this.blocked(me.x, nz)) me.z = nz;
      else this.target = null;
      me.tr = Math.atan2(mx, mz);
    }
    me.moving = lerp(me.moving, len > 0 ? 1 : 0, Math.min(1, dt * 10));
    me.walk += dt * 11 * me.moving;
    me.ry = lerpAngle(me.ry, me.tr, Math.min(1, dt * 12));
    me.jumpT = Math.max(0, me.jumpT - dt * 2.2);
    me.waveT = Math.max(0, me.waveT - dt);
  }

  render() {
    const { r } = this.ctx;
    const e = r.env;
    r.time = this.time;
    // The same 25-minute day as the village: sunlight through the open front by day,
    // cool moonlight and a cosy fire-lit glow by night.
    const night = applyTimeOfDay(r, dayPhase(this.ctx.prefs.time));
    const outside = { sky: e.skyHorizon, top: e.skyTop, sun: e.sunColor };
    this.night = night;
    e.lightDir = mixDir([0.42, 0.78, 0.46], [0.3, 0.85, 0.42], night);
    e.sunColor = mixRgb(mixRgb([1.0, 0.84, 0.62], outside.sun, 0.45), [0.62, 0.68, 1.0], night);
    e.sunIntensity = lerp(1.0, 0.45, night);
    e.ambient = lerp(0.8, 0.62, night);
    e.exposure = lerp(1.0, 1.08, night);
    this.windowTint = [...mixRgb(outside.sky, outside.top, 0.5), night > 0.05 ? 0.25 + night * 0.65 : 0.35] as [number, number, number, number];
    e.stars = 0;
    e.skyTop = [0.55, 0.42, 0.32];
    e.skyHorizon = [0.2, 0.13, 0.1];
    e.ground = [0.42, 0.3, 0.2];
    e.fogNear = 400;
    e.fogFar = 4000;
    e.fogHeight = 0;
    e.clouds = 0;
    e.sky = false;

    r.resize();
    const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
    const portrait = aspect < 0.8;
    let eye: Vec3, target: Vec3;
    if (this.photo.active) {
      ({ eye, target } = this.photo.camera([this.me.x, 1.0, this.me.z]));
      eye[1] = Math.max(0.3, Math.min(WALL_H + 3, eye[1]));
    } else {
      const d = this.dist * (portrait ? 1.35 : 1);
      target = [0, 0.4, portrait ? 1.2 : this.editing ? 2.4 : 1.6];
      eye = [Math.sin(this.yaw) * Math.cos(this.pitch) * d, target[1] + Math.sin(this.pitch) * d, target[2] + Math.cos(this.yaw) * Math.cos(this.pitch) * d];
    }
    r.shadowFocus = [0, 0, 0];
    r.begin(lookAt(eye, target), perspective(portrait ? 0.95 : 0.78, aspect, 0.3, 400), eye);

    const I = compose(0, 0, 0);
    r.draw(this.shell.body, I);
    r.draw(this.shell.glow, I, { unlit: true, emissive: 0.15 + this.night * 0.5 });
    r.draw(this.shell.view, I, { unlit: true, emissive: 0.05, tint: this.windowTint });
    const fl = 1 + Math.sin(this.time * 13) * 0.06 + Math.sin(this.time * 7.3) * 0.05;
    r.draw(this.shell.fire, compose(0, 0.42, -HALF_D + 0.35, 0, 0, 0, 1, fl, 1), { unlit: true, emissive: 0.5 + this.night * 0.6 });
    if (this.editing) r.draw(this.shell.grid, I, { unlit: true, alpha: 0.28 });

    for (const it of this.items) this.drawItem(it, it === this.hoverItem ? { tint: [1, 0.85, 0.3, 0.35] } : {});
    if (this.ghost) this.drawItem(this.ghost.item, { tint: this.ghost.ok ? [0.35, 1, 0.55, 0.45] : [1, 0.3, 0.25, 0.55], alpha: 0.72 });

    // Beavers.
    const pose = this.photo.active ? this.photo.pose() : null;
    const me = this.me;
    r.draw(this.shell.shadow, compose(me.x, 0.02, me.z), { unlit: true, alpha: 0.12 });
    drawBeaver(r, getBeaverMeshes(r, this.ctx.state.look), compose(me.x, 0, me.z, me.ry), {
      walk: me.walk, moving: me.moving, swim: 0, sled: 0, time: this.time, seed: 1,
      jump: pose ? pose.jump : Math.sin(me.jumpT * Math.PI) * (me.jumpT > 0 ? 1 : 0),
      wave: pose ? pose.wave : Math.min(1, me.waveT), cheer: pose?.cheer ?? 0, talk: 0,
      expr: pose?.expr ?? (me.waveT > 0 ? "happy" : "neutral"),
    });
    if (!this.msg.editable) {
      const ox = 2.2, oz = -HALF_D + 2.3;
      r.draw(this.shell.shadow, compose(ox, 0.02, oz), { unlit: true, alpha: 0.12 });
      const wave = Math.sin(this.time * 0.7) > 0.75 ? 1 : 0;
      drawBeaver(r, getBeaverMeshes(r, this.msg.look as Look), compose(ox, 0, oz, Math.atan2(me.x - ox, me.z - oz)), {
        walk: 0, moving: 0, swim: 0, sled: 0, time: this.time, seed: 4, jump: 0, wave, cheer: 0, talk: 0, expr: wave ? "happy" : "neutral",
      });
      const s = r.project(ox, 2.75, oz);
      if (this.ownerTag) {
        this.ownerTag.style.display = s && !this.photo.active ? "" : "none";
        if (s) { this.ownerTag.style.left = `${s.x}px`; this.ownerTag.style.top = `${s.y}px`; }
      }
    }
    r.end();
    this.photo.afterRender();
    const s = r.project(me.x, 2.75, me.z);
    this.meTag.style.display = s && !this.photo.active ? "" : "none";
    if (s) { this.meTag.style.left = `${s.x}px`; this.meTag.style.top = `${s.y}px`; }
  }

  private drawItem(it: PlacedItem, opts: { tint?: [number, number, number, number]; alpha?: number }) {
    const def = FURNITURE_BY_ID[it.id];
    if (!def) return;
    const [w, d] = footprint(def, it.rot);
    const c = cellCenter(it.x, it.z, w, d);
    const g = gpuFurniture(this.ctx.r, it.id);
    const m = compose(c.x, def.layer === 0 ? 0.002 * (1 + (it.x % 3)) : 0, c.z, it.rot * Math.PI / 2);
    this.ctx.r.draw(g.body, m, opts);
    if (g.glow) this.ctx.r.draw(g.glow, m, { unlit: true, emissive: 0.6, alpha: opts.alpha });
  }

  dispose() {
    this.flushSave();
    this.photo.dispose();
    window.removeEventListener("keydown", this.onKey);
    this.root.remove();
  }
}
