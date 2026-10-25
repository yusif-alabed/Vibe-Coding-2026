import { MOVE_SEND_INTERVAL, type ServerMsg } from "@beaver/shared";
import { compose, fbm2, hash2, hexToRgb, lerp, lerpAngle, lookAt, mixRgb, perspective, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { h, toast } from "../ui/dom";
import { coin } from "../ui/icons";
import { Joystick } from "../ui/joystick";
import { wantsJoystick } from "../prefs";
import { drawBeaver, getBeaverMeshes } from "./beaver";
import { applyTimeOfDay, dayPhase } from "./daylight";
import { applyMood, currentMood, drawWeather, type WorldMood } from "./weather";
import { buildMountainMesh } from "./village/mountains";
import { boulder, spruce } from "./village/nature";
import { PhotoMode } from "./photo";
import { chatBar, Others } from "./others";
import type { Ctx, Scene } from "./scene";

/**
 * 🏔️ The summit, at the top of the gondola: a snowy plateau with a turquoise glacier lake, a glowing
 * blue ice cave you can walk into, a viewpoint with a telescope, and the whole valley far below.
 * Online it's shared: everyone who rode up from your village is up here with you.
 */

const R = 34;
const LAKE = { x: -12, z: -10, r: 9 };
const CAVE = { x: 16, z: -16, ry: -0.6 };
const VIEW = { x: 0, z: 26 };
const STATION = { x: -18, z: 20 };

function groundY(x: number, z: number): number {
  const d = Math.hypot(x, z);
  let y = Math.sin(x * 0.12) * 0.4 + Math.cos(z * 0.1) * 0.35 + fbm2(x * 0.05, z * 0.05, 2) * 0.6;
  const ld = Math.hypot(x - LAKE.x, z - LAKE.z);
  if (ld < LAKE.r + 3) y = Math.min(y, -1.2 + Math.max(0, ld - LAKE.r) * 0.4);
  if (d > R) y -= (d - R) * (d - R) * 0.18; // the plateau drops away
  return y;
}

interface SummitMeshes { ground: GpuMesh; props: GpuMesh; ice: GpuMesh; crystals: GpuMesh; lake: GpuMesh; mtn: GpuMesh; valley: GpuMesh }

function build(r: Renderer): SummitMeshes {
  const g = new MeshBuilder();
  const snow = hexToRgb("#f2f6fa"), shade = hexToRgb("#d6e2ee"), rock = hexToRgb("#7d7872");
  const step = 2;
  for (let x = -60; x < 60; x += step) for (let z = -60; z < 60; z += step) {
    const p = (a: number, b: number): Vec3 => [a, groundY(a, b), b];
    const a = p(x, z), b = p(x + step, z), c = p(x, z + step), d = p(x + step, z + step);
    const steep = Math.abs(a[1] - d[1]) > 2.2;
    const col = steep ? rock : mixRgb(snow, shade, hash2(Math.floor(x / 4), Math.floor(z / 4)) * 0.6);
    g.tri(a, c, d, col);
    g.tri(a, d, b, col);
  }
  const pr = new MeshBuilder();
  // Rocky outcrops and wind-bent firs around the rim.
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * Math.PI * 2 + hash2(i, 1) * 0.2, d = R - 3 + hash2(i, 2) * 4;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (Math.hypot(x - VIEW.x, z - VIEW.z) < 9 || Math.hypot(x - STATION.x, z - STATION.z) < 8) continue;
    if (i % 3 === 0) spruce(pr, x, groundY(x, z) - 0.2, z, 0.8 + hash2(i, 3) * 0.4, i, { snow: true });
    else boulder(pr, x, groundY(x, z), z, 1.6 + hash2(i, 4), 1.2 + hash2(i, 5), 1.4, i, 0);
  }
  // Viewpoint deck with railings and a coin telescope.
  const vy = groundY(VIEW.x, VIEW.z);
  pr.box(compose(VIEW.x, vy + 0.2, VIEW.z, 0, 0, 0, 10, 0.3, 6), "#8a5a34");
  for (let i = 0; i <= 10; i++) pr.box(compose(VIEW.x - 5 + i, vy + 0.8, VIEW.z + 3, 0, 0, 0, 0.12, 1.1, 0.12), "#5b3a24");
  pr.box(compose(VIEW.x, vy + 1.35, VIEW.z + 3, 0, 0, 0, 10.2, 0.12, 0.14), "#5b3a24");
  pr.cylinder(compose(VIEW.x + 2, vy + 0.9, VIEW.z + 1.8, 0, 0, 0, 0.16, 1.4, 0.16), "#2e2b2a", 6);
  pr.cylinder(compose(VIEW.x + 2, vy + 1.75, VIEW.z + 2.0, 0, -0.35, 0, 0.32, 0.9, 0.32), "#3a8f6a", 8);
  // Summit cairn and a little sign.
  for (let k = 0; k < 5; k++) boulder(pr, 4, groundY(4, 4) + k * 0.55, 4, 1.2 - k * 0.18, 0.5, 1.1 - k * 0.18, k + 50, 0);
  pr.box(compose(6.5, groundY(6.5, 5) + 1.2, 5, 0.4, 0, 0, 0.12, 2.4, 0.12), "#5b3a24");
  pr.box(compose(6.5, groundY(6.5, 5) + 2.1, 5, 0.4, 0, 0, 1.8, 0.6, 0.08), "#f2e6c8");
  // Gondola top station (matches the one seen from the village).
  const sy = groundY(STATION.x, STATION.z);
  pr.box(compose(STATION.x, sy + 2.4, STATION.z, 0.7, 0, 0, 7, 4.4, 6), "#d8d0c4");
  pr.box(compose(STATION.x, sy + 4.8, STATION.z, 0.7, 0, 0, 8, 0.4, 7), "#c8473a");
  pr.cone(compose(STATION.x, sy + 5.9, STATION.z, 0.7 + Math.PI / 4, 0, 0, 6.5, 2.2, 5.5), "#c8473a", 4);
  for (const s of [-1, 1]) pr.box(compose(STATION.x + s * 1.2, sy + 1.2, STATION.z + 3.2, 0.7, 0, 0, 1.4, 2.4, 0.1), "#ffd08a");
  // Ice cave: a hollow arch of blue ice with glowing crystals inside.
  const ice = new MeshBuilder(), cr = new MeshBuilder();
  const cy = groundY(CAVE.x, CAVE.z);
  const iceA = hexToRgb("#9fdcf2"), iceB = hexToRgb("#6fc1e6");
  for (let k = 0; k < 9; k++) {
    for (let i = 0; i <= 12; i++) {
      const t = (i / 12) * Math.PI;
      const lz = -k * 1.4;
      const lx = Math.cos(t) * 3.4, ly = Math.sin(t) * 3.6;
      const c = Math.cos(CAVE.ry), s = Math.sin(CAVE.ry);
      ice.sphere(compose(CAVE.x + lx * c + lz * s, cy + ly, CAVE.z - lx * s + lz * c, CAVE.ry, 0, t, 0.9, 0.7, 1.0), (k + i) % 2 ? iceA : iceB, 3, 5);
    }
  }
  for (let i = 0; i < 22; i++) {
    const lz = -1 - hash2(i, 1) * 10, lx = (hash2(i, 2) - 0.5) * 5;
    const c = Math.cos(CAVE.ry), s = Math.sin(CAVE.ry);
    const x = CAVE.x + lx * c + lz * s, z = CAVE.z - lx * s + lz * c;
    const top = hash2(i, 3) > 0.5;
    cr.cone(compose(x, cy + (top ? 3.3 : 0), z, i, top ? Math.PI : 0, 0, 0.25, 0.8 + hash2(i, 4), 0.25), ["#7ff3f0", "#a8c8ff", "#c9a8ff"][i % 3], 5);
  }
  const lake = new MeshBuilder().cylinder(compose(LAKE.x, -0.5, LAKE.z, 0, 0, 0, LAKE.r * 2 + 2, 0.05, LAKE.r * 2 + 2), "#3fd1d6", 28);
  // Far below: the valley floor with a turquoise lake and dark forest, seen over the edge.
  const v = new MeshBuilder();
  for (let x = -600; x < 600; x += 30) for (let z = -600; z < 600; z += 30) {
    const d = Math.hypot(x + 15, z + 15);
    if (d < 90) continue;
    const y = -260 + fbm2(x * 0.004, z * 0.004, 3) * 30;
    const lakeD = Math.hypot(x - 60, z - 260);
    const col = lakeD < 70 ? hexToRgb("#37b6c4") : hash2(x, z) > 0.5 ? hexToRgb("#2f5a35") : hexToRgb("#3d6b3a");
    v.box(compose(x + 15, y, z + 15, 0, 0, 0, 30.5, 2, 30.5), col);
  }
  const mtn = buildMountainMesh({ inner: 260, outer: 1100, baseHeight: () => -200, heroAngle: -Math.PI / 2, seed: 77 });
  return {
    ground: r.upload(g.build()), props: r.upload(pr.build()), ice: r.upload(ice.build()), crystals: r.upload(cr.build()),
    lake: r.upload(lake.build()), mtn: r.upload(mtn.build()), valley: r.upload(v.build()),
  };
}

export class SummitScene implements Scene {
  private m: SummitMeshes;
  private me = { x: STATION.x + 3, z: STATION.z - 4, ry: Math.PI, tr: Math.PI, walk: 0, moving: 0 };
  private yaw = Math.PI * 0.85;
  private time = 0;
  private root: HTMLElement;
  private actionEl: HTMLElement;
  private actionKey = "";
  private joystick: Joystick | null = null;
  private night = 0;
  private mood!: WorldMood;
  private telescope = 0;
  private photo: PhotoMode;
  private seenCave = false;
  private seenLake = false;
  private labels: HTMLElement;
  private others: Others;
  private chat: { el: HTMLElement; focus: () => void };
  private sendAcc = 0;
  private lastSent = { x: NaN, z: NaN, ry: NaN };

  constructor(private ctx: Ctx, m: Extract<ServerMsg, { t: "summit" }>) {
    this.m = build(ctx.r);
    this.root = h("div", { style: "position:absolute;inset:0" });
    this.labels = h("div", { style: "position:absolute;inset:0;overflow:hidden;pointer-events:none" });
    this.others = new Others(ctx, this.labels, m.players);
    this.actionEl = h("div.action.pe");
    this.chat = chatBar(ctx);
    this.root.append(
      this.labels,
      h("div.hud-top", {}, [h("div.pill", {}, "🏔️ Sulphur Summit · 2,281 m"), h("div.row.plank", {}, [h("div.pill.coins", {}, [coin(), String(ctx.state.coins)])])]),
      this.actionEl,
      h("div.dock.plank", {}, [
        h("button.btn.cream.icon.pe", { title: "Photo mode", onclick: () => this.photo.open(this.me.ry, 6.5) }, "📷"),
        h("button.btn.orange.icon.pe", { title: "Ride the gondola down", onclick: () => this.down() }, "🚡"),
      ]),
      h("div.hud-bottom", {}, [
        this.chat.el,
        h("button.btn.orange.icon.pe", { title: "Wave", onclick: () => ctx.net.send({ t: "emote", i: 0 }) }, "👋"),
      ]),
    );
    window.addEventListener("keydown", this.onKey);
    ctx.ui.append(this.root);
    this.photo = new PhotoMode(ctx, this.root, { place: () => "Sulphur Summit, Banff", onShot: () => ctx.net.send({ t: "photo" }) });
    if (wantsJoystick(ctx.prefs)) this.joystick = new Joystick(this.root);
    const company = m.players.length ? ` ${m.players.length === 1 ? `${m.players[0].name} is` : `${m.players.length} beavers are`} up here too!` : "";
    toast(this.root, `🚡 Welcome to the summit! Explore the ice cave, the glacier lake and the viewpoint.${company}`, 4200);
  }

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT" || this.photo.active) return;
    if (e.key === "Enter") { this.chat.focus(); e.preventDefault(); }
  };

  private down() {
    this.ctx.net.send({ t: "gondola", up: false });
  }

  handle(m: ServerMsg) {
    if (this.others.handle(m)) return;
    if (m.t === "wallet") this.ctx.state.coins = m.coins;
    if (m.t === "error") toast(this.root, m.text);
    if (m.t === "lifeSay") toast(this.root, m.text, 4200);
  }

  private nearby(): string {
    const d = (p: { x: number; z: number }) => Math.hypot(this.me.x - p.x, this.me.z - p.z);
    if (d(VIEW) < 6) return "view";
    if (d(STATION) < 7) return "station";
    if (d(CAVE) < 9) return "cave";
    if (d(LAKE) < LAKE.r + 4) return "lake";
    return "";
  }

  private run(k: string) {
    if (k === "view") {
      this.telescope = this.telescope ? 0 : 1;
      if (this.telescope) toast(this.root, "🔭 Way down there: the village, the river and Mount Rundle. Wave! 👋", 3600);
    }
    if (k === "station") this.down();
    if (k === "cave") toast(this.root, "🧊 The ice glows blue because glacier ice absorbs red light. Brrr!", 3600);
    if (k === "lake") toast(this.root, "💎 Glacial meltwater full of rock flour makes the lake this turquoise colour.", 3600);
    this.actionKey = "";
  }

  update(dt: number) {
    this.time += dt;
    this.others.update(dt);
    if (this.photo.active) { this.photo.update(dt); return; }
    const inp = this.ctx.input;
    this.yaw -= inp.consumeDrag() * 0.006;
    if (inp.down("q")) this.yaw += dt * 1.8;
    if (inp.down("e")) this.yaw -= dt * 1.8;
    if (inp.consumeTap()) { /* taps just look around up here */ }
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    let mx = 0, mz = 0;
    if (inp.down("w", "arrowup")) { mx += fx; mz += fz; }
    if (inp.down("s", "arrowdown")) { mx -= fx; mz -= fz; }
    if (inp.down("d", "arrowright")) { mx += -fz; mz += fx; }
    if (inp.down("a", "arrowleft")) { mx -= -fz; mz -= fx; }
    if (this.joystick && (this.joystick.x || this.joystick.y)) { mx += fx * this.joystick.y - fz * this.joystick.x; mz += fz * this.joystick.y + fx * this.joystick.x; }
    const len = Math.hypot(mx, mz);
    const me = this.me;
    if (len > 0) {
      this.telescope = 0;
      let nx = me.x + (mx / len) * 6 * dt, nz = me.z + (mz / len) * 6 * dt;
      const d = Math.hypot(nx, nz);
      if (d > R - 2) { nx *= (R - 2) / d; nz *= (R - 2) / d; }
      const ld = Math.hypot(nx - LAKE.x, nz - LAKE.z);
      if (ld < LAKE.r - 0.5) { nx = LAKE.x + ((nx - LAKE.x) / ld) * (LAKE.r - 0.5); nz = LAKE.z + ((nz - LAKE.z) / ld) * (LAKE.r - 0.5); }
      const sd = Math.hypot(nx - STATION.x, nz - STATION.z);
      if (sd < 4.6) { nx = STATION.x + ((nx - STATION.x) / sd) * 4.6; nz = STATION.z + ((nz - STATION.z) / sd) * 4.6; }
      me.x = nx; me.z = nz;
      me.tr = Math.atan2(mx, mz);
      if (Math.floor(this.time * 2.6) !== Math.floor((this.time - dt) * 2.6)) this.ctx.sound.play("step-snow", 0.7);
    }
    me.moving = lerp(me.moving, len > 0 ? 1 : 0, Math.min(1, dt * 10));
    me.ry = lerpAngle(me.ry, me.tr, Math.min(1, dt * 12));
    me.walk += dt * 11 * me.moving;
    this.sendMove(dt);
    const k = this.nearby();
    if (k === "cave" && !this.seenCave) { this.seenCave = true; this.ctx.sound.play("chime"); }
    if (k === "lake" && !this.seenLake) { this.seenLake = true; this.ctx.sound.play("chime"); }
    const label = k === "view" ? (this.telescope ? "🔭 Step back" : "🔭 Look through the telescope") : k === "station" ? "🚡 Ride the gondola down" : k === "cave" ? "🧊 Touch the glowing ice" : k === "lake" ? "💎 Gaze into the glacier lake" : "";
    if (label !== this.actionKey) {
      this.actionKey = label;
      this.actionEl.replaceChildren(label ? h("button.btn", { onclick: () => this.run(k), style: "font-size:19px;padding:12px 20px" }, label) : "");
    }
  }

  /** Tells the others where you are, a few times a second while you're moving. */
  private sendMove(dt: number) {
    this.sendAcc += dt;
    if (this.sendAcc < MOVE_SEND_INTERVAL) return;
    this.sendAcc = Math.min(this.sendAcc - MOVE_SEND_INTERVAL, MOVE_SEND_INTERVAL);
    const me = this.me, l = this.lastSent;
    if (Math.hypot(me.x - l.x, me.z - l.z) < 0.02 && Math.abs(me.tr - l.ry) < 0.02) return;
    this.lastSent = { x: me.x, z: me.z, ry: me.tr };
    this.ctx.net.send({ t: "move", x: Math.round(me.x * 100) / 100, z: Math.round(me.z * 100) / 100, ry: Math.round(me.tr * 100) / 100 });
  }

  render() {
    const { r } = this.ctx;
    r.time = this.time;
    this.night = applyTimeOfDay(r, dayPhase(this.ctx.prefs.time));
    this.mood = { ...currentMood(this.ctx.prefs), season: "winter" };
    if (this.mood.weather.kind === "rain") this.mood.weather = { ...this.mood.weather, kind: "snow" };
    applyMood(r, this.mood);
    r.env.fogFar = Math.max(r.env.fogFar, 1600);
    r.env.fogHeight = 0.002;
    r.resize();
    const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
    const me = this.me;
    const y = groundY(me.x, me.z);
    let cam: Vec3, look: Vec3;
    if (this.telescope) {
      cam = [VIEW.x + 2, groundY(VIEW.x, VIEW.z) + 2.2, VIEW.z + 2];
      look = [VIEW.x + 40, -230, VIEW.z + 300];
    } else {
      const dist = 11, pitch = 0.42;
      cam = [me.x + Math.sin(this.yaw) * Math.cos(pitch) * dist, y + 1.5 + Math.sin(pitch) * dist, me.z + Math.cos(this.yaw) * Math.cos(pitch) * dist];
      look = [me.x, y + 1.5, me.z];
    }
    if (this.photo.active) { const pc = this.photo.camera([me.x, y + 1.2, me.z]); cam = pc.eye; look = pc.target; }
    r.shadowFocus = [me.x, y, me.z];
    r.cutFocus = this.photo.active || this.telescope ? null : [me.x, y + 1.1, me.z];
    r.begin(lookAt(cam, look), perspective(this.telescope ? 0.35 : aspect < 0.8 ? 1.05 : 0.86, aspect, 0.4, 4000), cam);
    const I = compose(0, 0, 0);
    r.draw(this.m.valley, I, { noCast: true });
    r.draw(this.m.mtn, compose(0, -40, 0), { noCast: true });
    r.draw(this.m.ground, I, { noCast: true });
    r.draw(this.m.props, I, { season: true, cut: true, sway: 0.1 });
    r.draw(this.m.lake, I, { wave: 1, alpha: 0.9 });
    r.draw(this.m.ice, I, { alpha: 0.72, cut: true, emissive: 0.1 });
    r.draw(this.m.crystals, I, { unlit: true, emissive: 0.5 + Math.sin(this.time * 1.5) * 0.15 + this.night * 0.6 });
    drawWeather(r, this.mood, this.time, cam, this.night);
    const pose = this.photo.active ? this.photo.pose() : null;
    drawBeaver(r, getBeaverMeshes(r, this.ctx.state.look), compose(me.x, y, me.z, me.ry), {
      walk: me.walk, moving: me.moving, swim: 0, time: this.time, seed: 1, sled: 0,
      jump: pose?.jump ?? 0, wave: pose?.wave ?? (this.telescope ? 0 : 0), cheer: pose?.cheer ?? 0, expr: pose?.expr ?? (this.nearby() ? "happy" : "neutral"),
    });
    this.others.draw(r, groundY);
    r.end();
    this.others.placeLabels(r, groundY, this.photo.active);
    this.photo.afterRender();
  }

  dispose() {
    for (const g of Object.values(this.m)) this.ctx.r.dispose(g);
    window.removeEventListener("keydown", this.onKey);
    this.others.dispose();
    this.joystick?.dispose();
    this.photo.dispose();
    this.root.remove();
  }
}
