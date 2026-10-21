import {
  alongHole,
  CLUBS,
  DEFAULT_LOOK,
  FUR_COLORS,
  GOLF_HOLES,
  GOLF_WATER_Y,
  golfHeight,
  golfTrees,
  suggestClub,
  surfaceAt,
  type Club,
  type GolfHole,
  type GolfPlayerWire,
  type Look,
  type ServerMsg,
  type Surface,
} from "@beaver/shared";
import { compose, hash2, hexToRgb, lerp, lerpAngle, lookAt, mixRgb, perspective, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { h, toast } from "../ui/dom";
import { buzz } from "../ui/life";
import { drawBeaver, getBeaverMeshes } from "./beaver";
import { applyTimeOfDay, dayPhase } from "./daylight";
import { applyMood, currentMood, drawWeather, type WorldMood } from "./weather";
import { buildMountainMesh } from "./village/mountains";
import { spruce, boulder } from "./village/nature";
import type { Ctx, Scene } from "./scene";

/**
 * ⛳ Bow Valley Golf. Nine holes laid out like the famous mountain course along the Bow River:
 * tree-lined fairways, the river alongside, Mount Rundle towering over the greens and the castle
 * hotel behind the 9th. Aim (A/D or drag), pick a club, then hold Space / the swing button and let go
 * at the power you want. The server simulates every shot so everybody sees the same ball flight.
 */

const SURF_COL: Record<Surface, Vec3> = {
  tee: hexToRgb("#7cc46a"), fairway: hexToRgb("#79c25f"), rough: hexToRgb("#4f8a3a"), green: hexToRgb("#8fdc78"),
  sand: hexToRgb("#ecd9a4"), water: hexToRgb("#3b8f8f"), ob: hexToRgb("#3f6b33"),
};

interface HoleMeshes { ground: GpuMesh; trees: GpuMesh; water: GpuMesh; props: GpuMesh; mtn: GpuMesh; flag: GpuMesh }

function buildHole(r: Renderer, hole: GolfHole): HoleMeshes {
  const g = new MeshBuilder();
  const xs = hole.path.map((p) => p[0]), zs = hole.path.map((p) => p[1]);
  const x0 = Math.min(...xs) - 80, x1 = Math.max(...xs) + 80, z0 = -50, z1 = Math.max(...zs) + 70;
  const step = 1.6;
  const col = (x: number, z: number): Vec3 => {
    const s = surfaceAt(hole, x, z);
    let c = SURF_COL[s];
    if (s === "fairway" || s === "tee") {
      // Mown stripes.
      const { s: along } = alongHole(hole, x, z);
      c = Math.floor(along * 40) % 2 ? c : mixRgb(c, [1, 1, 1], 0.08);
    }
    if (s === "green") c = Math.floor((x + z) * 0.8) % 2 ? c : mixRgb(c, [1, 1, 1], 0.06);
    if (s === "rough" || s === "ob") c = mixRgb(c, hexToRgb("#5d9a40"), hash2(Math.floor(x / 3), Math.floor(z / 3)) * 0.35);
    return c;
  };
  for (let x = x0; x < x1; x += step) {
    for (let z = z0; z < z1; z += step) {
      const p00: Vec3 = [x, golfHeight(hole, x, z), z];
      const p10: Vec3 = [x + step, golfHeight(hole, x + step, z), z];
      const p01: Vec3 = [x, golfHeight(hole, x, z + step), z + step];
      const p11: Vec3 = [x + step, golfHeight(hole, x + step, z + step), z + step];
      const c = col(x + step / 2, z + step / 2);
      g.tri(p00, p01, p11, c);
      g.tri(p00, p11, p10, c);
    }
  }
  // Water: ponds and the river at a common level.
  const w = new MeshBuilder();
  const wc = hexToRgb("#41b4c8");
  for (const p of hole.ponds) w.cylinder(compose(p.x, GOLF_WATER_Y, p.z, 0, 0, 0, p.r * 2 + 3, 0.05, p.r * 2 + 3), wc, 28);
  if (hole.river) {
    for (let i = 0; i < hole.river.pts.length - 1; i++) {
      const [ax, az] = hole.river.pts[i], [bx, bz] = hole.river.pts[i + 1];
      const len = Math.hypot(bx - ax, bz - az);
      w.box(compose((ax + bx) / 2, GOLF_WATER_Y, (az + bz) / 2, Math.atan2(bx - ax, bz - az), 0, 0, hole.river.w + 3, 0.05, len + hole.river.w), wc);
    }
  }
  // Trees, exactly where the physics has them, plus a dense forest beyond.
  const t = new MeshBuilder();
  for (const tr of golfTrees(hole)) spruce(t, tr.x, golfHeight(hole, tr.x, tr.z) - 0.1, tr.z, tr.s, Math.floor(tr.x * 7 + tr.z), { lod: "far" });
  for (let i = 0; i < 260; i++) {
    const x = x0 - 10 + hash2(i, 1) * (x1 - x0 + 20), z = z1 - 30 + hash2(i, 2) * 60;
    if (Math.abs(x - hole.green.x) < 40 && z < hole.green.z + 30) continue;
    spruce(t, x, golfHeight(hole, x, z), z, 1.3 + hash2(i, 3) * 0.6, i, { lod: "far" });
  }
  for (let i = 0; i < 120; i++) {
    const side = i % 2 ? 1 : -1;
    const x = (side > 0 ? x1 - hash2(i, 4) * 20 : x0 + hash2(i, 4) * 20), z = z0 + hash2(i, 5) * (z1 - z0);
    spruce(t, x, golfHeight(hole, x, z), z, 1.3 + hash2(i, 6) * 0.6, i + 400, { lod: "far" });
  }
  // Props: tee markers, bunker lips, elk, benches, and the castle hotel on the 9th.
  const pr = new MeshBuilder();
  for (const s of [-1, 1]) pr.sphere(compose(hole.tee[0] + s * 2.4, golfHeight(hole, hole.tee[0], hole.tee[1]) + 0.2, hole.tee[1] + 0.8, 0, 0, 0, 0.22), hole.n % 2 ? "#ffffff" : "#e2483d", 4, 6);
  for (const e of hole.elk ?? []) {
    const y = golfHeight(hole, e[0], e[1]);
    const brown = hexToRgb("#8a5a34"), tan = hexToRgb("#d9b47a");
    const ry = hash2(e[0], e[1]) * Math.PI * 2;
    const f = (lx: number, ly: number, lz: number) => [e[0] + lx * Math.cos(ry) + lz * Math.sin(ry), y + ly, e[1] - lx * Math.sin(ry) + lz * Math.cos(ry)] as Vec3;
    let p = f(0, 1.5, 0); pr.box(compose(p[0], p[1], p[2], ry, 0, 0, 0.9, 0.8, 1.9), brown);
    p = f(0, 1.5, -0.95); pr.box(compose(p[0], p[1], p[2], ry, 0, 0, 0.85, 0.7, 0.3), tan);
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.7, 0.7]) { p = f(sx, 0.55, sz); pr.box(compose(p[0], p[1], p[2], ry, 0, 0, 0.16, 1.1, 0.16), hexToRgb("#5b3a24")); }
    p = f(0, 2.2, 1.1); pr.box(compose(p[0], p[1], p[2], ry, -0.6, 0, 0.35, 0.9, 0.35), brown);
    p = f(0, 2.55, 1.4); pr.box(compose(p[0], p[1], p[2], ry, 0.3, 0, 0.38, 0.38, 0.7), brown);
    for (const s of [-1, 1]) { p = f(s * 0.3, 3.0, 1.2); pr.box(compose(p[0], p[1], p[2], ry, 0, s * 0.6, 0.08, 0.9, 0.08), tan); p = f(s * 0.55, 3.35, 1.1); pr.box(compose(p[0], p[1], p[2], ry, 0.4, s * 0.9, 0.06, 0.6, 0.06), tan); }
  }
  for (let i = 0; i < 6; i++) boulder(pr, hole.green.x + Math.cos(i) * (hole.green.r + 14), golfHeight(hole, hole.green.x + Math.cos(i) * (hole.green.r + 14), hole.green.z + Math.sin(i) * 9 + 14), hole.green.z + Math.sin(i) * 9 + 14, 1.4, 1, 1.2, i);
  if (hole.backdrop === "castle") {
    // The grand castle hotel on the hill beyond the 18th... er, 9th green.
    const cx = hole.green.x + 6, cz = hole.green.z + 70, cy = golfHeight(hole, cx, cz) + 4;
    const stone = hexToRgb("#c9b89c"), roof = hexToRgb("#5f8f7c");
    pr.box(compose(cx, cy + 9, cz, 0, 0, 0, 46, 18, 14), stone);
    pr.box(compose(cx, cy + 22, cz, 0, 0, 0, 22, 12, 12), stone);
    pr.cone(compose(cx, cy + 32, cz, Math.PI / 4, 0, 0, 22, 8, 16), roof, 4);
    for (const sx of [-1, 1]) {
      pr.cone(compose(cx + sx * 18, cy + 21, cz, Math.PI / 4, 0, 0, 14, 6, 16), roof, 4);
      pr.cylinder(compose(cx + sx * 24, cy + 14, cz + 6, 0, 0, 0, 6, 28, 6), stone, 10);
      pr.cone(compose(cx + sx * 24, cy + 31, cz + 6, 0, 0, 0, 7, 7, 7), roof, 10);
    }
    for (let k = 0; k < 4; k++) for (let i = 0; i < 9; i++) pr.box(compose(cx - 20 + i * 5, cy + 3 + k * 4.2, cz + 7.05, 0, 0, 0, 1.4, 1.8, 0.1), hexToRgb("#ffd08a"));
  }
  // Flag pin (drawn separately so it can flutter).
  const flag = new MeshBuilder();
  flag.cylinder(compose(0, 1.4, 0, 0, 0, 0, 0.06, 2.8, 0.06), "#fbf7ee", 5);
  flag.box(compose(0.42, 2.5, 0, 0, 0, 0, 0.8, 0.52, 0.03), "#e2483d");
  flag.cylinder(compose(0, 0.02, 0, 0, 0, 0, 0.8, 0.03, 0.8), "#2a2624", 12);
  const zc = Math.max(...zs) / 2;
  const mtn = buildMountainMesh({ inner: 230, outer: 900, baseHeight: () => 0, heroAngle: Math.PI / 2 + (hole.backdrop === "cascade" ? 0.5 : hole.backdrop === "sulphur" ? -0.5 : 0), center: [0, zc], seed: hole.n * 3 + 1 });
  return { ground: r.upload(g.build()), trees: r.upload(t.build()), water: r.upload(w.build()), props: r.upload(pr.build()), mtn: r.upload(mtn.build()), flag: r.upload(flag.build()) };
}

interface Golfer {
  w: GolfPlayerWire;
  look: Look;
  ball: Vec3;
  /** Ball resting spot (server truth, updated when an animation ends). */
  rest: [number, number];
  aim: number;
  club: Club;
  anim: { path: number[]; t: number; holed: boolean; penalty: boolean; from: [number, number] } | null;
  swingT: number;
  tag: HTMLElement;
  cheerT: number;
}

const CLUB_ORDER: Club[] = ["driver", "iron", "wedge", "putter"];

export class GolfScene implements Scene {
  private holes: number[];
  private idx = 0;
  private hole: GolfHole;
  private m: HoleMeshes | null = null;
  private golfers: Golfer[] = [];
  private me: Golfer | null = null;
  private root: HTMLElement;
  private labels: HTMLElement;
  private card: HTMLElement;
  private hud: HTMLElement;
  private powerEl: HTMLElement;
  private powerBar: HTMLElement;
  private clubsEl: HTMLElement;
  private time = 0;
  private charging = false;
  private power = 0;
  private powerDir = 1;
  private camEye: Vec3 = [0, 10, -15];
  private camLook: Vec3 = [0, 0, 20];
  private nextAt = 0;
  private ended = false;
  private aimSendAcc = 0;
  private lastAimSent = NaN;
  private night = 0;
  private mood!: WorldMood;
  private scoreOpen = false;
  private ballMesh: GpuMesh;
  private clubMesh: GpuMesh;
  private aimMesh: GpuMesh;
  private dragAim = 0;

  constructor(private ctx: Ctx, start: Extract<ServerMsg, { t: "golfStart" }>) {
    this.holes = start.holes;
    this.hole = GOLF_HOLES[this.holes[0] - 1];
    this.root = h("div", { style: "position:absolute;inset:0" });
    this.labels = h("div", { style: "position:absolute;inset:0;overflow:hidden" });
    this.card = h("div.card.golf-card.pe", { onclick: () => { this.scoreOpen = !this.scoreOpen; this.renderCard(); } });
    this.powerBar = h("i", { style: "left:0%" });
    this.powerEl = h("div.power", {}, this.powerBar);
    this.clubsEl = h("div.golf-clubs");
    const swing = h("button.btn.orange.pe", { style: "font-size:20px;padding:12px 26px" }, "🏌️ Hold to swing");
    swing.addEventListener("pointerdown", (e) => { e.preventDefault(); this.startCharge(); });
    swing.addEventListener("pointerup", (e) => { e.preventDefault(); this.release(); });
    swing.addEventListener("pointerleave", () => { if (this.charging) this.release(); });
    const aimRow = h("div.row.pe", {}, [
      h("button.btn.cream.small", { onpointerdown: () => (this.dragAim = 1), onpointerup: () => (this.dragAim = 0), onpointerleave: () => (this.dragAim = 0) }, "⟲ Aim"),
      swing,
      h("button.btn.cream.small", { onpointerdown: () => (this.dragAim = -1), onpointerup: () => (this.dragAim = 0), onpointerleave: () => (this.dragAim = 0) }, "Aim ⟳"),
    ]);
    this.hud = h("div.golf-hud", {}, [this.clubsEl, this.powerEl, aimRow]);
    this.root.append(this.labels, this.card, this.hud, h("div", { style: "position:absolute;right:12px;top:calc(12px + env(safe-area-inset-top,0px));display:grid;gap:8px;justify-items:end" }, [
      h("button.btn.red.small.pe", { onclick: () => this.askQuit() }, "🚪 Quit round"),
      h("div.pill", {}, "A/D aim · 1-4 clubs · hold Space"),
    ]));
    ctx.ui.append(this.root);
    const ball = new MeshBuilder().sphere(compose(0, 0, 0, 0, 0, 0, 0.16), "#ffffff", 5, 8);
    this.ballMesh = ctx.r.upload(ball.build());
    const club = new MeshBuilder();
    club.cylinder(compose(0, -0.55, 0, 0, 0, 0, 0.035, 1.1, 0.035), "#c8c8d0", 5);
    club.box(compose(0.05, -1.12, 0.02, 0, 0, 0, 0.16, 0.08, 0.08), "#3a3a42");
    club.cylinder(compose(0, -0.08, 0, 0, 0, 0, 0.06, 0.2, 0.06), "#2a2624", 5);
    this.clubMesh = ctx.r.upload(club.build());
    const aim = new MeshBuilder();
    for (let i = 0; i < 14; i++) aim.box(compose(0, 0, 1.2 + i * 1.3, 0, 0, 0, 0.18, 0.04, 0.6), "#ffffff");
    this.aimMesh = ctx.r.upload(aim.build());
    this.setPlayers(start.players);
    this.enterHole(0);
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
    toast(this.root, `⛳ ${this.holes.length} hole${this.holes.length > 1 ? "s" : ""} at Bow Valley Golf. Have fun!`, 3200);
  }

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.key === " ") { e.preventDefault(); if (!e.repeat) this.startCharge(); }
    const n = Number(e.key);
    if (n >= 1 && n <= 4) this.pickClub(CLUB_ORDER[n - 1]);
    if (e.key === "Escape") this.askQuit();
  };
  private onKeyUp = (e: KeyboardEvent) => {
    if (e.key === " ") { e.preventDefault(); this.release(); }
  };

  private setPlayers(list: GolfPlayerWire[]) {
    for (const w of list) {
      let g = this.golfers.find((x) => x.w.id === w.id);
      if (!g) {
        const i = this.golfers.length;
        const look = w.look ?? { ...DEFAULT_LOOK, fur: FUR_COLORS[(i * 3 + w.name.length) % FUR_COLORS.length], hat: ["hat_ranger", "hat_sun", "hat_earmuffs"][i % 3] };
        const tag = h("div.tag" + (w.id === this.ctx.state.you ? ".me" : ""), {}, w.id === this.ctx.state.you ? "You" : w.name);
        this.labels.append(tag);
        g = { w, look, ball: [w.ball[0], 0, w.ball[1]], rest: [...w.ball], aim: 0, club: "driver", anim: null, swingT: 0, tag, cheerT: 0 };
        this.golfers.push(g);
      }
      g.w = w;
      if (!g.anim) { g.rest = [...w.ball]; g.ball = [w.ball[0], golfHeight(this.hole, w.ball[0], w.ball[1]), w.ball[1]]; }
      if (w.quit) g.tag.style.opacity = "0.4";
    }
    this.me = this.golfers.find((g) => g.w.id === this.ctx.state.you) ?? null;
  }

  private enterHole(idx: number) {
    this.idx = idx;
    this.hole = GOLF_HOLES[this.holes[idx] - 1];
    if (this.m) for (const g of Object.values(this.m)) this.ctx.r.dispose(g);
    this.m = buildHole(this.ctx.r, this.hole);
    for (const g of this.golfers) {
      g.anim = null;
      g.ball = [g.rest[0], golfHeight(this.hole, g.rest[0], g.rest[1]), g.rest[1]];
      g.aim = Math.atan2(this.hole.path[1][0] - g.rest[0], this.hole.path[1][1] - g.rest[1]);
      g.club = suggestClub(this.hole, g.rest[0], g.rest[1]);
    }
    this.renderClubs();
    this.renderCard();
    const h0 = this.hole;
    toast(this.root, `Hole ${h0.n}: ${h0.name} · Par ${h0.par} — ${h0.blurb}`, 4200);
  }

  handle(m: ServerMsg) {
    if (m.t === "golfShot") {
      const g = this.golfers.find((x) => x.w.id === m.id);
      if (!g) return;
      g.anim = { path: m.path, t: 0, holed: m.holed, penalty: m.penalty, from: [...g.rest] };
      g.swingT = 0.01;
      g.club = m.club;
      g.w.strokes[this.idx] = m.strokes;
      if (m.holed) g.w.done = true;
      if (g === this.me) this.ctx.sound.play("pop");
      this.renderCard();
    }
    if (m.t === "golfAim") {
      const g = this.golfers.find((x) => x.w.id === m.id);
      if (g && !g.anim) { g.aim = m.aim; g.club = m.club; }
    }
    if (m.t === "golfState") {
      const changed = m.idx !== this.idx;
      for (const w of m.players) {
        const g = this.golfers.find((x) => x.w.id === w.id);
        if (g && changed) { g.anim = null; g.rest = [...w.ball]; }
      }
      this.setPlayers(m.players);
      this.nextAt = m.nextAt;
      if (changed) this.enterHole(m.idx);
      else this.renderCard();
    }
    if (m.t === "golfEnd") this.showEnd(m.totals);
  }

  private pickClub(c: Club) {
    if (!this.me || this.me.anim) return;
    this.me.club = c;
    this.renderClubs();
    this.sendAim(true);
  }

  private renderClubs() {
    const cur = this.me?.club;
    this.clubsEl.replaceChildren(...CLUB_ORDER.map((c, i) => h("button.btn.small.pe" + (c === cur ? ".gold.on" : ".cream"), { onclick: () => this.pickClub(c), title: `Key ${i + 1}` }, `${CLUBS[c].icon} ${CLUBS[c].name}`)));
  }

  private canShoot() {
    const me = this.me;
    return !!me && !me.anim && !me.w.done && !me.w.quit && !this.ended;
  }

  private startCharge() {
    if (!this.canShoot() || this.charging) return;
    this.charging = true;
    this.power = 0;
    this.powerDir = 1;
  }

  private release() {
    if (!this.charging) return;
    this.charging = false;
    const me = this.me;
    if (!me || !this.canShoot()) return;
    const power = Math.max(0.04, this.power);
    this.ctx.net.send({ t: "golfShot", aim: me.aim, power, club: me.club });
    buzz(this.ctx, 30);
  }

  private sendAim(force = false) {
    const me = this.me;
    if (!me) return;
    if (!force && Math.abs(me.aim - this.lastAimSent) < 0.01) return;
    this.lastAimSent = me.aim;
    this.ctx.net.send({ t: "golfAim", aim: me.aim, club: me.club });
  }

  private askQuit() {
    if (this.ended) return;
    const box = h("div.overlay.pe", {}, h("div.card", { style: "padding:18px;max-width:340px;text-align:center" }, [
      h("h2", { style: "margin:0 0 8px" }, "Leave the round?"),
      h("div.hint", { style: "margin:0 0 12px" }, "You'll keep the coins for every hole you've finished."),
      h("div.row", { style: "justify-content:center" }, [
        h("button.btn.red", { onclick: () => { box.remove(); this.ctx.net.send({ t: "golfQuit" }); } }, "🚪 Quit"),
        h("button.btn.cream", { onclick: () => box.remove() }, "Keep playing"),
      ]),
    ]));
    this.root.append(box);
  }

  private renderCard() {
    const hole = this.hole;
    const me = this.me;
    const strokes = me ? me.w.strokes[this.idx] ?? 0 : 0;
    const d = me ? Math.hypot(hole.pin[0] - me.rest[0], hole.pin[1] - me.rest[1]) : 0;
    const lie = me ? surfaceAt(hole, me.rest[0], me.rest[1]) : "tee";
    const wind = Math.hypot(...hole.wind);
    const windArrow = ["⬆️", "↗️", "➡️", "↘️", "⬇️", "↙️", "⬅️", "↖️"][Math.round(((Math.atan2(hole.wind[0], hole.wind[1]) / (Math.PI * 2)) * 8 + 8)) % 8];
    const rows: (HTMLElement | string)[] = [
      h("h3", {}, `Hole ${hole.n} · ${hole.name}`),
      h("div", {}, `Par ${hole.par} · Strokes ${strokes} · ${Math.round(d)} m to pin`),
      h("div.hint", { style: "margin:2px 0 0" }, `Lie: ${lie} · Wind ${windArrow} ${(wind * 10).toFixed(0)} km/h · ${this.idx + 1}/${this.holes.length}`),
    ];
    if (me?.w.done && !this.ended) rows.push(h("div", { style: "margin-top:4px;font-weight:800" }, this.nextAt ? "Next hole coming up…" : "⛳ Holed! Waiting for the others…"));
    if (this.scoreOpen) {
      const holesShown = this.holes.slice(0, this.idx + 1);
      rows.push(h("table.golf-score", {}, [
        h("tr", {}, [h("th", {}, ""), ...holesShown.map((n) => h("th", {}, String(n))), h("th", {}, "Tot")]),
        h("tr", {}, [h("td", {}, "Par"), ...holesShown.map((n) => h("td", {}, String(GOLF_HOLES[n - 1].par))), h("td", {}, String(holesShown.reduce((s, n) => s + GOLF_HOLES[n - 1].par, 0)))]),
        ...this.golfers.map((g) => h("tr", {}, [h("td", {}, g === me ? "You" : g.w.name), ...holesShown.map((_, i) => h("td", {}, g.w.strokes[i] != null ? String(g.w.strokes[i]) : "–")), h("td", {}, String(g.w.strokes.reduce((s: number, x) => s + (x ?? 0), 0)))])),
      ]));
    } else rows.push(h("div.hint", { style: "margin:4px 0 0" }, "Tap for the scorecard"));
    this.card.replaceChildren(...rows);
  }

  private showEnd(totals: Extract<ServerMsg, { t: "golfEnd" }>["totals"]) {
    this.ended = true;
    this.hud.style.display = "none";
    const mine = totals.find((t) => t.id === this.ctx.state.you);
    const sorted = [...totals].filter((t) => t.holes > 0).sort((a, b) => a.toPar - b.toPar);
    const fmt = (v: number) => (v === 0 ? "E" : v > 0 ? `+${v}` : String(v));
    this.ctx.sound.play("quest");
    this.root.append(h("div.overlay", {}, h("div.card.results", {}, [
      h("h2", {}, mine?.quit ? "⛳ Thanks for playing!" : sorted[0]?.id === mine?.id ? "🏆 Clubhouse leader!" : "⛳ Round complete!"),
      ...(sorted.length ? sorted : totals).map((t, i) => h("div.res" + (t.id === this.ctx.state.you ? ".me" : ""), {}, [
        h("span.pl", {}, ["🥇", "🥈", "🥉"][i] ?? `${i + 1}`),
        h("span", {}, `${t.id === this.ctx.state.you ? `${t.name} (you)` : t.name}${t.quit ? " · left" : ""}`),
        h("span", { style: "color:var(--muted)" }, `${t.total} (${fmt(t.toPar)}) · ${t.holes} holes`),
        h("span", {}, t.isBot ? "" : `+🪙 ${t.coins}`),
      ])),
      h("div.hint", {}, "Heading back to the clubhouse…"),
    ])));
  }

  update(dt: number) {
    this.time += dt;
    const inp = this.ctx.input;
    const me = this.me;
    if (me && !me.anim && !me.w.done) {
      let turn = this.dragAim;
      if (inp.down("a", "arrowleft")) turn += 1;
      if (inp.down("d", "arrowright")) turn -= 1;
      const drag = inp.consumeDrag();
      me.aim += turn * dt * (me.club === "putter" ? 0.5 : 0.9) - drag * 0.004;
      this.aimSendAcc += dt;
      if (this.aimSendAcc > 0.2) { this.aimSendAcc = 0; this.sendAim(); }
    } else inp.consumeDrag();
    inp.consumeTap();
    if (this.charging) {
      // The meter swings up and back down: let go at the right moment.
      this.power += this.powerDir * dt * 0.85;
      if (this.power >= 1) { this.power = 1; this.powerDir = -1; }
      if (this.power <= 0) { this.power = 0; this.powerDir = 1; }
    }
    this.powerBar.style.left = `calc(${(this.power * 100).toFixed(1)}% - 3px)`;
    this.hud.style.opacity = this.canShoot() ? "1" : "0.5";
    for (const g of this.golfers) {
      g.cheerT = Math.max(0, g.cheerT - dt);
      if (g.swingT > 0) g.swingT += dt;
      if (g.swingT > 1.2) g.swingT = 0;
      if (!g.anim) continue;
      g.anim.t += dt;
      const n = g.anim.path.length / 3;
      const i = Math.min(n - 1, g.anim.t * 30);
      const i0 = Math.floor(i), i1 = Math.min(n - 1, i0 + 1), f = i - i0;
      const P = g.anim.path;
      g.ball = [lerp(P[i0 * 3], P[i1 * 3], f), lerp(P[i0 * 3 + 1], P[i1 * 3 + 1], f), lerp(P[i0 * 3 + 2], P[i1 * 3 + 2], f)];
      if (i >= n - 1) {
        const end: [number, number] = g.anim.penalty ? g.anim.from : [P[(n - 1) * 3], P[(n - 1) * 3 + 2]];
        if (g.anim.penalty) {
          this.ctx.sound.play("splash");
          if (g === me) { toast(this.root, "💦 Splash! +1 penalty stroke — play again from where you were."); buzz(this.ctx, [60, 40, 60]); }
        }
        if (g.anim.holed) {
          g.cheerT = 2.5;
          this.ctx.sound.play("chime");
          const s = g.w.strokes[this.idx] ?? 0, par = this.hole.par;
          const word = s === 1 ? "HOLE IN ONE!!! 🎉" : s - par <= -2 ? "EAGLE! 🦅" : s - par === -1 ? "Birdie! 🐦" : s === par ? "Par ⛳" : s - par === 1 ? "Bogey" : `${s} strokes`;
          if (g === me) { this.flash(word); buzz(this.ctx, [40, 30, 40, 30, 80]); } else toast(this.root, `${g.w.name}: ${word}`);
        }
        g.rest = end;
        g.ball = [end[0], golfHeight(this.hole, end[0], end[1]), end[1]];
        g.anim = null;
        if (g === me) {
          me.club = suggestClub(this.hole, end[0], end[1]);
          me.aim = Math.atan2(this.hole.pin[0] - end[0], this.hole.pin[1] - end[1]);
          const d = Math.hypot(this.hole.pin[0] - end[0], this.hole.pin[1] - end[1]);
          if (d > 70) {
            // Aim at the next bend of the fairway rather than straight at a pin around the corner.
            const { s } = alongHole(this.hole, end[0], end[1]);
            const next = this.hole.path.find((p) => alongHole(this.hole, p[0], p[1]).s > s + 0.08);
            if (next) me.aim = Math.atan2(next[0] - end[0], next[1] - end[1]);
          }
          this.renderClubs();
          this.sendAim(true);
        }
        this.renderCard();
      }
    }
  }

  private flash(text: string) {
    const el = h("div.flash", {}, text);
    this.root.append(el);
    setTimeout(() => el.remove(), 1600);
  }

  render() {
    const { r } = this.ctx;
    r.time = this.time;
    this.night = applyTimeOfDay(r, dayPhase(this.ctx.prefs.time));
    this.mood = currentMood(this.ctx.prefs);
    applyMood(r, this.mood);
    r.env.snow = 0;
    r.resize();
    const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
    const me = this.me ?? this.golfers[0];
    const hole = this.hole;
    // Camera: behind your ball looking down the aim line; follows the ball in flight.
    let eye: Vec3, look: Vec3;
    const flying = this.golfers.find((g) => g.anim && (g === me || !me?.anim)) ?? null;
    if (flying && (flying === me || me?.w.done)) {
      const b = flying.ball;
      const a = flying.aim;
      eye = [b[0] - Math.sin(a) * 9, Math.max(b[1] + 4.5, golfHeight(hole, b[0], b[2]) + 4), b[2] - Math.cos(a) * 9];
      look = [b[0] + Math.sin(a) * 6, b[1], b[2] + Math.cos(a) * 6];
    } else if (me) {
      const b = me.ball, a = me.aim;
      const putt = me.club === "putter";
      const back = putt ? 5 : 8, up = putt ? 2.6 : 4;
      eye = [b[0] - Math.sin(a) * back, b[1] + up, b[2] - Math.cos(a) * back];
      const ahead = putt ? 6 : 30;
      look = [b[0] + Math.sin(a) * ahead, b[1] + (putt ? 0 : 2), b[2] + Math.cos(a) * ahead];
    } else { eye = [0, 12, -16]; look = [0, 0, 30]; }
    const k = Math.min(1, 0.06 + 4 * (1 / 60));
    for (let i = 0; i < 3; i++) { this.camEye[i] = lerp(this.camEye[i], eye[i], k); this.camLook[i] = lerp(this.camLook[i], look[i], k); }
    this.camEye[1] = Math.max(this.camEye[1], golfHeight(hole, this.camEye[0], this.camEye[2]) + 1.2);
    r.shadowFocus = [me?.ball[0] ?? 0, me?.ball[1] ?? 0, me?.ball[2] ?? 0];
    r.cutFocus = me ? [me.ball[0], me.ball[1] + 1, me.ball[2]] : null;
    r.begin(lookAt(this.camEye, this.camLook), perspective(aspect < 0.8 ? 1.1 : 0.9, aspect, 0.3, 3000), this.camEye);
    const m = this.m!;
    const I = compose(0, 0, 0);
    r.draw(m.mtn, compose(0, -20, 0), { noCast: true });
    r.draw(m.ground, I, { noCast: true, season: true });
    r.draw(m.trees, I, { sway: 0.15, season: true, cut: true });
    r.draw(m.props, I, { season: true, cut: true });
    r.draw(m.water, I, { wave: 1, alpha: 0.85 });
    const py = golfHeight(hole, hole.pin[0], hole.pin[1]);
    r.draw(m.flag, compose(hole.pin[0], py, hole.pin[1], Math.sin(this.time * 2) * 0.3 + Math.atan2(hole.wind[0], hole.wind[1]) - Math.PI / 2), { cut: true });
    drawWeather(r, this.mood, this.time, this.camEye, this.night);

    // Aim line for you (only when it's your shot).
    if (me && this.canShoot()) {
      const c = CLUBS[me.club];
      const len = me.club === "putter" ? 0.45 : 0.4 + c.v / 45;
      r.draw(this.aimMesh, compose(me.ball[0], me.ball[1] + 0.08, me.ball[2], me.aim, 0, 0, 1, 1, len), { unlit: true, alpha: 0.65, noCast: true });
    }
    this.golfers.forEach((g, i) => {
      if (g.w.quit) return;
      const b = g.ball;
      const holed = g.w.done && !g.anim;
      if (!holed || g.anim) r.draw(this.ballMesh, compose(b[0], b[1] + 0.12, b[2]), { outline: 0.01 });
      // The beaver stands beside its resting ball, facing along the aim (side-on, like a real golfer).
      const rx = g.rest[0], rz = g.rest[1];
      const a = g.aim;
      const sx = rx - Math.cos(a) * 0.95, sz = rz + Math.sin(a) * 0.95;
      const sy = golfHeight(hole, sx, sz);
      const swing = g.swingT > 0 ? Math.min(1, g.swingT / 0.35) : 0;
      const charge = g === me && this.charging ? this.power : 0;
      const look = g.look;
      const atPin = holed;
      const px = atPin ? hole.pin[0] + Math.cos(i * 1.6) * 2.2 : sx, pz = atPin ? hole.pin[1] + Math.sin(i * 1.6) * 2.2 : sz;
      const pyy = atPin ? golfHeight(hole, px, pz) : sy;
      const ry = atPin ? Math.atan2(hole.pin[0] - px, hole.pin[1] - pz) : a + Math.PI / 2;
      drawBeaver(r, getBeaverMeshes(r, look), compose(px, pyy, pz, ry), {
        walk: 0, moving: 0, swim: 0, jump: g.cheerT > 2 ? Math.sin((2.5 - g.cheerT) * Math.PI * 2) * 0.5 : 0, wave: 0, sled: 0, time: this.time, seed: i * 1.7,
        hold: atPin ? 0 : 1, cheer: g.cheerT > 0 ? 1 : 0, expr: g.cheerT > 0 ? "excited" : charge > 0 ? "determined" : "neutral",
      });
      if (!atPin) {
        // The club: back-swing while charging, a quick swing through on the shot.
        const back = -charge * 2.2;
        const through = swing > 0 ? -2.2 + swing * 4.4 : back;
        const hx = px + Math.sin(ry) * 0.62, hz = pz + Math.cos(ry) * 0.62;
        r.draw(this.clubMesh, compose(hx, pyy + 1.05, hz, ry - Math.PI / 2, 0, through * 0.55), { outline: 0.01 });
      }
      const s = r.project(px, pyy + 2.8, pz);
      if (s && s.depth < 120) { g.tag.style.display = ""; g.tag.style.left = `${s.x}px`; g.tag.style.top = `${s.y}px`; } else g.tag.style.display = "none";
    });
    r.end();
  }

  dispose() {
    const r = this.ctx.r;
    if (this.m) for (const g of Object.values(this.m)) r.dispose(g);
    for (const g of [this.ballMesh, this.clubMesh, this.aimMesh]) r.dispose(g);
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKeyUp);
    this.root.remove();
  }
}

export const _unused = lerpAngle;
