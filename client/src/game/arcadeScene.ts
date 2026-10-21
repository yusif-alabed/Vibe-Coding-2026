import { ARCADE_INFO, DAM, DEFAULT_LOOK, FUR_COLORS, HUNT, SNOW, type ArcadeGame, type Look, type ServerMsg } from "@beaver/shared";
import { compose, hash2, hexToRgb, lerp, lerpAngle, lookAt, perspective, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { h } from "../ui/dom";
import { Joystick } from "../ui/joystick";
import { buzz } from "../ui/life";
import { wantsJoystick } from "../prefs";
import { drawBeaver, getBeaverMeshes, type Expression } from "./beaver";
import { applyTimeOfDay, dayPhase } from "./daylight";
import { buildMountains } from "./hubWorld";
import { applyMood, currentMood, drawWeather, type WorldMood } from "./weather";
import { spruce } from "./village/nature";
import type { Ctx, Scene } from "./scene";

/**
 * The four village minigames, each in its own little arena:
 *  🌰 Pinecone Hunt (a forest clearing), 🪵 Log Rolling (logs on the lake), ⛄ Snowball Fight
 *  (the frozen pond) and 🦫 Dam Builder (a stretch of river). The server runs the simulation;
 *  this scene draws its snapshots and sends your input.
 */

interface P { id: string; name: string; look: Look; isBot: boolean; x: number; z: number; ry: number; tx: number; tz: number; score: number; tag: HTMLElement; extra: Record<string, number | boolean> }

const ORD = ["1st", "2nd", "3rd", "4th"];

interface ArenaMeshes { ground: GpuMesh; props: GpuMesh; water: GpuMesh | null; cone: GpuMesh; bigCone: GpuMesh; log: GpuMesh; ball: GpuMesh; puff: GpuMesh; mtn: GpuMesh }

function buildArena(r: Renderer, game: ArcadeGame): ArenaMeshes {
  const ground = new MeshBuilder(), props = new MeshBuilder();
  let water: MeshBuilder | null = null;
  const grass = hexToRgb("#7fb069"), snow = hexToRgb("#eef4f8"), ice = hexToRgb("#cfeaf5");
  if (game === "hunt") {
    ground.cylinder(compose(0, -0.5, 0, 0, 0, 0, 120, 1, 120), (x, _y, z) => (hash2(Math.floor(x * 30), Math.floor(z * 30)) > 0.5 ? grass : hexToRgb("#74a55f")), 40);
    ground.cylinder(compose(0, 0.01, 0, 0, 0, 0, HUNT.radius * 2 + 1, 0.04, HUNT.radius * 2 + 1), hexToRgb("#8cc26f"), 40);
    for (let i = 0; i < 90; i++) {
      const a = (i / 90) * Math.PI * 2 + hash2(i, 1) * 0.1, d = HUNT.radius + 3 + hash2(i, 2) * 18;
      spruce(props, Math.cos(a) * d, 0, Math.sin(a) * d, 1 + hash2(i, 3) * 0.6, i);
    }
    for (let i = 0; i < 40; i++) {
      const a = hash2(i, 4) * Math.PI * 2, d = Math.sqrt(hash2(i, 5)) * HUNT.radius;
      props.sphere(compose(Math.cos(a) * d, 0.1, Math.sin(a) * d, 0, 0, 0, 0.3, 0.15, 0.3), ["#ffd93b", "#ffffff", "#a77bff"][i % 3], 3, 5);
    }
  } else if (game === "snowball") {
    ground.cylinder(compose(0, -0.5, 0, 0, 0, 0, 120, 1, 120), snow, 40);
    ground.box(compose(0, 0.02, 0, 0, 0, 0, SNOW.halfWidth * 2 + 6, 0.06, SNOW.gap + 8), ice);
    for (const s of [-1, 1]) {
      // Snow fort walls in front of each team.
      for (let i = -3; i <= 3; i++) props.sphere(compose(i * 2.2, 0.35, s * (SNOW.gap / 2 - 1.6), 0, 0, 0, 1.2, 0.6, 0.5), snow, 4, 8);
      props.box(compose(0, 0.04, s * (SNOW.gap / 2 + 0.4), 0, 0, 0, SNOW.halfWidth * 2 + 1, 0.04, 0.3), s < 0 ? "#e2483d" : "#2f7fb0");
    }
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, d = 18 + hash2(i, 2) * 16;
      spruce(props, Math.cos(a) * d, 0, Math.sin(a) * d, 1 + hash2(i, 3) * 0.6, i, { snow: true });
    }
  } else if (game === "logroll") {
    ground.cylinder(compose(0, -1.2, 0, 0, 0, 0, 160, 1, 160), hexToRgb("#6f9a4a"), 40);
    water = new MeshBuilder();
    water.cylinder(compose(0, 0, -4, 0, 0, 0, 70, 0.1, 50), hexToRgb("#3fb6c4"), 40);
    // A wooden jetty and the lighthouse on the shore.
    props.box(compose(0, 0.3, 9, 0, 0, 0, 14, 0.3, 3), "#a77a4a");
    props.cylinder(compose(-14, 5, -26, 0, 0, 0, 3.4, 10, 3.4), (_x, y) => (Math.floor((y + 0.5) * 5) % 2 ? hexToRgb("#e2483d") : hexToRgb("#fbf7ee")), 12, 0.42, 0.5);
    props.cone(compose(-14, 11, -26, 0, 0, 0, 3.6, 2, 3.6), "#2f3a4a", 10);
    for (let i = 0; i < 40; i++) {
      const a = Math.PI + (i / 40) * Math.PI, d = 34 + hash2(i, 2) * 10;
      spruce(props, Math.cos(a) * d, -0.7, Math.sin(a) * d - 4, 1.2 + hash2(i, 3) * 0.5, i);
    }
  } else {
    // Dam Builder: a river channel running toward the camera, banks with trees.
    ground.cylinder(compose(0, -0.5, 0, 0, 0, 0, 140, 1, 140), grass, 40);
    for (const s of [-1, 1]) ground.box(compose(s * (DAM.halfWidth + 5), 0.4, -10, 0, 0, 0, 8, 1.6, 60), hexToRgb("#8a6a45"));
    water = new MeshBuilder();
    water.box(compose(0, 0, -16, 0, 0, 0, DAM.halfWidth * 2 + 2.5, 0.1, 34), hexToRgb("#3fb6c4"));
    for (let i = 0; i < 40; i++) {
      const s = i % 2 ? 1 : -1, z = -40 + (i >> 1) * 3;
      spruce(props, s * (DAM.halfWidth + 6 + hash2(i, 1) * 6), 1.2, z, 1 + hash2(i, 3) * 0.5, i);
    }
    // The beavers' lodge beside the dam.
    props.sphere(compose(DAM.halfWidth + 3.5, 1.2, 2, 0, 0, 0, 2.6, 1.6, 2.2), "#6b4a2c", 6, 10);
  }
  const cone = new MeshBuilder();
  for (let ring = 0; ring < 5; ring++) {
    const y = 0.1 + ring * 0.13, rad = 0.24 * Math.sin(((ring + 0.8) / 5.6) * Math.PI) + 0.05;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + ring * 0.45;
      cone.sphere(compose(Math.cos(a) * rad, y, Math.sin(a) * rad, -a, 0.5, 0, 0.11, 0.08, 0.1), ring % 2 ? "#ffc93c" : "#e09a1f", 3, 5);
    }
  }
  cone.sphere(compose(0, 0.4, 0, 0, 0, 0, 0.18, 0.38, 0.18), "#e09a1f", 5, 8);
  const big = new MeshBuilder().merge(cone);
  big.sphere(compose(0, 0.95, 0, 0, 0, 0, 0.12), "#fff1a8", 3, 5);
  const log = new MeshBuilder();
  log.cylinder(compose(0, 0, 0, 0, 0, Math.PI / 2, 1.1, 5, 1.1), (x, _y, z) => (Math.floor((Math.atan2(z, x) + Math.PI) * 3) % 2 ? hexToRgb("#8a5a34") : hexToRgb("#7a4b2c")), 14);
  for (const s of [-1, 1]) log.cylinder(compose(s * 2.5, 0, 0, 0, 0, Math.PI / 2, 1.0, 0.05, 1.0), "#e2b27a", 14);
  const ball = new MeshBuilder().sphere(compose(0, 0, 0, 0, 0, 0, 0.32), "#ffffff", 5, 8);
  const puff = new MeshBuilder().sphere(compose(0, 0, 0), "#ffffff", 3, 5);
  return {
    ground: r.upload(ground.build()), props: r.upload(props.build()), water: water ? r.upload(water.build()) : null,
    cone: r.upload(cone.build()), bigCone: r.upload(big.build()), log: r.upload(log.build()), ball: r.upload(ball.build()), puff: r.upload(puff.build()),
    mtn: buildMountains(r, 5, [160, 260], 14),
  };
}

export class ArcadeScene implements Scene {
  private game: ArcadeGame;
  private players: P[];
  private me: P | null;
  private m: ArenaMeshes;
  private root: HTMLElement;
  private labels: HTMLElement;
  private countdownEl: HTMLElement;
  private boardEl: HTMLElement;
  private timeEl: HTMLElement;
  private startAt: number;
  private time = 0;
  private gameTime = 0;
  private lastCount = -1;
  private sendAcc = 0;
  private lastInput = "";
  private press = false;
  private finished = false;
  private joystick: Joystick | null = null;
  private snap: any = null;
  private cones: { id: number; x: number; z: number; big: boolean }[] = [];
  private balls: { id: number; team: number; x: number; z: number }[] = [];
  private logs: { id: number; x: number; z: number }[] = [];
  private dam = { h: 0, w: 2, done: null as null | string };
  private particles: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: [number, number, number] }[] = [];
  private night = 0;
  private mood!: WorldMood;
  private seenCones = new Set<number>();

  constructor(private ctx: Ctx, start: Extract<ServerMsg, { t: "gameStart" }>) {
    this.game = start.game as ArcadeGame;
    this.m = buildArena(ctx.r, this.game);
    this.startAt = performance.now() + start.countdownMs;
    this.root = h("div", { style: "position:absolute;inset:0" });
    this.labels = h("div", { style: "position:absolute;inset:0;overflow:hidden" });
    this.root.append(this.labels);
    this.players = start.players.map((p, i) => {
      const look = p.look ?? { ...DEFAULT_LOOK, fur: FUR_COLORS[(i * 3 + p.name.length) % FUR_COLORS.length], hat: ["hat_toque_teal", "hat_ranger", "hat_earmuffs", "hat_party"][i % 4] };
      const tag = h("div.tag" + (p.id === ctx.state.you ? ".me" : ""), {}, p.id === ctx.state.you ? "You" : p.name);
      this.labels.append(tag);
      return { id: p.id, name: p.name, look, isBot: p.isBot, x: 0, z: 0, ry: 0, tx: 0, tz: 0, score: 0, tag, extra: {} };
    });
    this.me = this.players.find((p) => p.id === ctx.state.you) ?? null;
    const info = ARCADE_INFO[this.game];
    this.countdownEl = h("div.countdown", {}, "");
    this.boardEl = h("div.card.scoreboard", {});
    this.timeEl = h("div.pill", {}, `⏱ ${info.seconds}s`);
    const controls = this.game === "hunt" ? "W A S D / joystick to run" : this.game === "snowball" ? "A D to move · Space / ❄️ to throw" : this.game === "logroll" ? "A D to lean · Space / ⬆️ to hop" : "A D to slide along the dam";
    this.root.append(
      h("div", { style: "position:absolute;left:14px;top:12px;display:grid;gap:8px;justify-items:start" }, [h("div.pill", {}, `${info.icon} ${info.name}`), this.timeEl, h("div.pill", {}, controls)]),
      this.boardEl,
      h("div.card", { style: "position:absolute;left:50%;top:14%;transform:translateX(-50%);padding:10px 16px;max-width:min(460px,90vw);text-align:center;font-weight:700", class: "howto" }, info.how),
      this.countdownEl,
    );
    if (this.game === "snowball" || this.game === "logroll") {
      this.root.append(h("button.btn.orange.pe", { style: "position:absolute;right:16px;bottom:calc(20px + env(safe-area-inset-bottom,0px));width:84px;height:84px;font-size:34px;border-radius:50%", onpointerdown: (e: Event) => { e.preventDefault(); this.press = true; } }, this.game === "snowball" ? "❄️" : "⬆️"));
    }
    if (this.game === "hunt" && wantsJoystick(ctx.prefs)) this.joystick = new Joystick(this.root);
    else if (this.game !== "hunt") this.root.append(h("div.touchpads", {}, [h("div", {}, "⬅️"), h("div", {}, "➡️")]));
    ctx.ui.append(this.root);
    window.addEventListener("keydown", this.onKey);
    setTimeout(() => this.root.querySelector(".howto")?.remove(), start.countdownMs + 2500);
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === " " || e.key === "ArrowUp" && this.game === "logroll") { this.press = true; e.preventDefault(); }
  };

  handle(m: ServerMsg) {
    if (m.t === "game") this.apply(m.s, m.time);
    if (m.t === "gameEnd") this.showResults(m.results);
  }

  private apply(s: any, t: number) {
    this.gameTime = t;
    this.snap = s;
    const byId = (id: string) => this.players.find((p) => p.id === id);
    if (this.game === "hunt") {
      for (const q of s.p) { const p = byId(q.id); if (!p) continue; p.tx = q.x; p.tz = q.z; p.ry = q.ry; if (q.score > p.score && p === this.me) { this.ctx.sound.play("coin"); buzz(this.ctx, 25); } p.score = q.score; }
      const fresh = (s.c as number[][]).map(([id, x, z, big]) => ({ id, x, z, big: !!big }));
      for (const c of this.cones) if (!fresh.some((f) => f.id === c.id)) this.burst(c.x, 0.6, c.z, [1, 0.84, 0.3]);
      this.cones = fresh;
    } else if (this.game === "logroll") {
      s.forEach((q: any, i: number) => {
        const p = byId(q.id); if (!p) return;
        const wasOut = p.extra.out;
        p.extra = { a: q.a, hop: q.hop, out: q.out, lean: q.lean, lane: i };
        if (q.out && !wasOut) { this.burst(this.lane(i), 0.2, 0, [0.8, 0.95, 1], 24); this.ctx.sound.play("splash"); if (p === this.me) { this.flash("SPLASH! 💦"); buzz(this.ctx, [60, 40, 60]); } }
        p.score = q.out ? p.score : this.gameTime;
      });
    } else if (this.game === "snowball") {
      for (const q of s.p) {
        const p = byId(q.id); if (!p) continue;
        p.tx = q.x; p.score = q.score;
        if (q.hit && !p.extra.hit) { this.burst(q.x, 1.2, q.team === 0 ? -SNOW.gap / 2 : SNOW.gap / 2, [1, 1, 1]); if (p === this.me) { this.flash("BONK! ❄️"); buzz(this.ctx, 50); } this.ctx.sound.play("pop"); }
        p.extra = { team: q.team, hit: q.hit, throw: q.throw };
      }
      this.balls = (s.b as number[][]).map(([id, team, x, z]) => ({ id, team, x, z }));
    } else {
      for (const q of s.p) { const p = byId(q.id); if (!p) continue; p.tx = q.x; if (q.score > p.score) this.ctx.sound.play("pop"); p.score = q.score; p.extra = { carry: q.carry }; }
      this.logs = (s.l as number[][]).map(([id, x, z]) => ({ id, x, z }));
      this.dam = { h: s.h, w: s.w, done: s.done };
    }
    this.renderBoard();
  }

  private lane(i: number) {
    return (i - (this.players.length - 1) / 2) * 6;
  }

  private renderBoard() {
    const info = ARCADE_INFO[this.game];
    let rows: HTMLElement[];
    if (this.game === "snowball" && this.snap) {
      const [a, b] = this.snap.s as number[];
      const myTeam = this.me?.extra.team;
      rows = [h("div", {}, [h("span", { style: "color:#e2483d" }, `🔴 ${a}`), "  vs  ", h("span", { style: "color:#2f7fb0" }, `🔵 ${b}`)]), h("div.hint", { style: "margin:0" }, myTeam === 0 ? "You're on 🔴 Red" : myTeam === 1 ? "You're on 🔵 Blue" : "")];
    } else if (this.game === "dam") {
      rows = [h("div", {}, `🪵 Dam ${this.dam.h}/${DAM.goal}`), h("div", {}, `🌊 Water ${this.dam.w.toFixed(1)}`), ...this.players.map((p) => h("div" + (p === this.me ? ".me" : ""), {}, `${p === this.me ? "You" : p.name}: ${p.score}`))];
    } else {
      const sorted = [...this.players].sort((a, b) => b.score - a.score);
      rows = sorted.map((p, i) => h("div" + (p === this.me ? ".me" : ""), {}, `${ORD[i] ?? i + 1} ${p === this.me ? "You" : p.name} · ${this.game === "logroll" ? (p.extra.out ? "💦 out" : "🪵 on") : `${p.score} ${info.scoreLabel}`}`));
    }
    this.boardEl.replaceChildren(...rows);
  }

  private flash(text: string) {
    const el = h("div.flash", {}, text);
    this.root.append(el);
    setTimeout(() => el.remove(), 700);
  }

  private burst(x: number, y: number, z: number, color: [number, number, number], n = 14) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      this.particles.push({ x, y, z, vx: Math.cos(a) * 2.4, vy: 2 + Math.random() * 2.5, vz: Math.sin(a) * 2.4, life: 0, color });
    }
  }

  private showResults(results: Extract<ServerMsg, { t: "gameEnd" }>["results"]) {
    this.finished = true;
    const info = ARCADE_INFO[this.game];
    const mine = results.find((r) => r.id === this.ctx.state.you);
    const title = this.game === "dam"
      ? (mine?.finished ? "🦫 The dam holds! Teamwork!" : "🌊 The river spilled over!")
      : this.game === "snowball" ? (mine?.finished ? "⛄ Your team wins!" : "⛄ Good fight!") : mine?.place === 1 ? "🏆 You won!" : mine ? `You came ${ORD[mine.place - 1]}!` : "Game over!";
    if (mine?.finished || mine?.place === 1) this.ctx.sound.play("quest");
    this.root.append(h("div.overlay", {}, h("div.card.results", {}, [
      h("h2", {}, title),
      ...results.map((r) => h("div.res" + (r.id === this.ctx.state.you ? ".me" : ""), {}, [
        h("span.pl", {}, ["🥇", "🥈", "🥉"][r.place - 1] ?? `${r.place}`),
        h("span", {}, r.id === this.ctx.state.you ? `${r.name} (you)` : r.name),
        h("span", { style: "color:var(--muted)" }, `${r.score ?? 0} ${info.scoreLabel}`),
        h("span", {}, r.isBot ? "" : `+🪙 ${r.coins}`),
      ])),
      h("div.hint", {}, "Heading back to the village in a moment… (🏆 weekly leaderboards are by the game spot)"),
    ])));
  }

  update(dt: number) {
    this.time += dt;
    const now = performance.now();
    const remain = this.startAt - now;
    const count = remain > 0 ? Math.ceil(remain / 1000) : remain > -900 ? 0 : -1;
    if (count !== this.lastCount) {
      this.lastCount = count;
      this.countdownEl.textContent = count > 0 ? String(count) : count === 0 ? "GO!" : "";
      if (count > 0) this.ctx.sound.play("countdown");
      if (count === 0) this.ctx.sound.play("go");
    }
    this.timeEl.textContent = `⏱ ${Math.max(0, Math.ceil(ARCADE_INFO[this.game].seconds - this.gameTime))}s`;
    const inp = this.ctx.input;
    let steer = inp.touchSteer * (this.game === "hunt" ? 0 : 1), fwd = 0;
    if (inp.down("a", "arrowleft")) steer -= 1;
    if (inp.down("d", "arrowright")) steer += 1;
    if (inp.down("w", "arrowup") && this.game === "hunt") fwd += 1;
    if (inp.down("s", "arrowdown")) fwd -= 1;
    if (this.joystick) { steer += this.joystick.x; fwd += this.joystick.y; }
    // Snowball cameras look along ±z, so screen-right is world −x for both teams' views (the sim mirrors team 1).
    if (this.game === "snowball") steer = -steer;
    steer = Math.max(-1, Math.min(1, steer));
    fwd = Math.max(-1, Math.min(1, fwd));
    if (inp.consumeTap() && this.game !== "hunt") this.press = true;
    this.sendAcc += dt;
    const key = `${steer.toFixed(2)}|${fwd.toFixed(2)}`;
    if (!this.finished && (key !== this.lastInput || this.press || this.sendAcc > 0.25)) {
      this.ctx.net.send({ t: "input", steer, fwd, press: this.press });
      if (this.press && this.game === "snowball") this.ctx.sound.play("pop", 0.6);
      this.press = false;
      this.lastInput = key;
      this.sendAcc = 0;
    }
    for (const p of this.players) {
      const k = Math.min(1, dt * 12);
      const px = p.x, pz = p.z;
      p.x = lerp(p.x, p.tx, k);
      p.z = lerp(p.z, p.tz, k);
      p.extra.moving = Math.hypot(p.x - px, p.z - pz) / Math.max(dt, 1e-3) > 0.5 ? 1 : 0;
    }
    for (const q of this.particles) { q.life += dt; q.vy -= 7 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
    this.particles = this.particles.filter((q) => q.life < 0.8);
  }

  render() {
    const { r } = this.ctx;
    r.time = this.time;
    this.night = applyTimeOfDay(r, dayPhase(this.ctx.prefs.time));
    this.mood = currentMood(this.ctx.prefs);
    if (this.game === "snowball") this.mood = { ...this.mood, season: "winter" };
    applyMood(r, this.mood);
    if (this.game !== "snowball") r.env.snow = 0;
    r.resize();
    const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
    const me = this.me ?? this.players[0];
    let cam: Vec3, look: Vec3;
    if (this.game === "hunt") {
      cam = [me.x * 0.4, 21, me.z * 0.4 + 22]; look = [me.x * 0.6, 0, me.z * 0.6 - 2];
    } else if (this.game === "logroll") {
      const i = this.players.indexOf(me);
      cam = [this.lane(i) * 0.6, 4.2, 10.5]; look = [this.lane(i) * 0.8, 1.6, 0];
    } else if (this.game === "snowball") {
      const z = me.extra.team === 1 ? SNOW.gap / 2 : -SNOW.gap / 2;
      const back = me.extra.team === 1 ? 1 : -1;
      cam = [me.x * 0.3, 8.5, z + back * 10.5]; look = [me.x * 0.3, 0.5, -z * 0.6];
    } else {
      cam = [me.x * 0.3, 7.5, 9.5]; look = [0, 0.4, -7];
    }
    r.shadowFocus = [look[0], 0, look[2]];
    r.cutFocus = null;
    r.begin(lookAt(cam, look), perspective(aspect < 0.8 ? 1.1 : 0.9, aspect, 0.3, 2400), cam);
    const I = compose(0, 0, 0);
    r.draw(this.m.mtn, compose(0, -10, 0), { noCast: true });
    r.draw(this.m.ground, I, { noCast: true, season: true });
    r.draw(this.m.props, I, { sway: 0.15, season: true });
    if (this.m.water && this.game !== "dam") r.draw(this.m.water, I, { wave: 1, alpha: 0.85 });
    drawWeather(r, this.mood, this.time, cam, this.night);

    const pose = (p: P, extra: Partial<Parameters<typeof drawBeaver>[3]> = {}) => ({
      walk: this.time * 10, moving: (p.extra.moving as number) || 0, swim: 0, jump: 0, wave: 0, sled: 0, time: this.time,
      seed: this.players.indexOf(p) * 1.7, expr: (this.finished && p.score > 0 ? "happy" : "determined") as Expression, ...extra,
    });

    if (this.game === "hunt") {
      for (const c of this.cones) {
        const y = 0.3 + Math.sin(this.time * 2.4 + c.id) * 0.12;
        r.draw(c.big ? this.m.bigCone : this.m.cone, compose(c.x, y, c.z, this.time * 1.5 + c.id, 0, 0, c.big ? 2.6 : 1.8), { unlit: true, emissive: 0.35, outline: 0.03 });
        if (!this.seenCones.has(c.id)) this.seenCones.add(c.id);
      }
      for (const p of this.players) drawBeaver(r, getBeaverMeshes(r, p.look), compose(p.x, 0, p.z, p.ry), pose(p));
    } else if (this.game === "logroll") {
      this.players.forEach((p, i) => {
        const x = this.lane(i);
        const a = (p.extra.a as number) ?? 0;
        const out = !!p.extra.out;
        const spin = this.time * (2 + this.gameTime / 12);
        r.draw(this.m.log, compose(x, 0.35 + Math.sin(this.time * 2 + i) * 0.05, 0, 0, spin, 0), { outline: 0.03 });
        if (out) {
          drawBeaver(r, getBeaverMeshes(r, p.look), compose(x + 1.5, -0.2, 1.8, 0.3), pose(p, { swim: 1, expr: "happy", wave: Math.sin(this.time * 3) > 0 ? 1 : 0 }));
        } else {
          const hop = p.extra.hop ? 0.6 : 0;
          drawBeaver(r, getBeaverMeshes(r, p.look), compose(x, 1.45 + hop, 0, 0, 0, a * 0.55), pose(p, { walk: spin * 2, moving: 0.6, expr: Math.abs(a) > 0.7 ? "surprised" : "determined", cheer: Math.abs(a) > 0.9 ? 1 : 0 }));
        }
      });
    } else if (this.game === "snowball") {
      for (const p of this.players) {
        const team = (p.extra.team as number) ?? 0;
        const z = team === 0 ? -SNOW.gap / 2 : SNOW.gap / 2;
        drawBeaver(r, getBeaverMeshes(r, p.look), compose(p.x, 0.05, z, team === 0 ? 0 : Math.PI), pose(p, {
          wave: p.extra.throw ? 1 : 0, expr: p.extra.hit ? "dizzy" : p.extra.throw ? "excited" : "determined", moving: Math.abs(p.tx - p.x) > 0.05 ? 1 : 0,
        }), p.extra.hit ? [1, 1, 1, 0.3] : undefined);
      }
      for (const b of this.balls) {
        const zt = (b.z + SNOW.gap / 2) / SNOW.gap;
        const arc = Math.sin(Math.max(0, Math.min(1, b.team === 0 ? zt : 1 - zt)) * Math.PI) * 1.6;
        r.draw(this.m.ball, compose(b.x, 1.3 + arc, b.z, 0, 0, 0, 1), { outline: 0.02 });
      }
    } else {
      // The dam grows log by log; the water climbs behind it.
      for (let k = 0; k < this.dam.h; k++) {
        const row = Math.floor(k / 4), col = k % 4;
        r.draw(this.m.log, compose(-DAM.halfWidth * 0.75 + col * (DAM.halfWidth * 0.5), 0.15 + row * 0.42, 0, 0.2 * Math.sin(k), 0, Math.PI / 2 * 0 + 0.05 * (k % 3), 0.34), { outline: 0.02 });
      }
      if (this.m.water) r.draw(this.m.water, compose(0, Math.max(0, ((Math.min(this.dam.w, this.dam.h + 6) - 6) / 4) * 0.42) + 0.05, 0), { wave: 1, alpha: 0.85 });
      for (const l of this.logs) r.draw(this.m.log, compose(l.x, 0.2 + Math.sin(this.time * 3 + l.id) * 0.05, l.z, Math.PI / 2, this.time * 1.2 + l.id, 0, 0.3), { outline: 0.02 });
      for (const p of this.players) drawBeaver(r, getBeaverMeshes(r, p.look), compose(p.x, 0.2, 0.9, Math.PI), pose(p, { hold: p.extra.carry ? 1 : 0, moving: Math.abs(p.tx - p.x) > 0.05 ? 1 : 0 }));
    }
    for (const q of this.particles) r.draw(this.m.puff, compose(q.x, q.y, q.z, 0, 0, 0, 0.16 * (1 - q.life)), { unlit: true, tint: [...q.color, 1], alpha: 0.85 * (1 - q.life / 0.8) });
    r.end();
    for (const p of this.players) {
      let x = p.x, y = 2.8, z = p.z;
      if (this.game === "logroll") { x = this.lane(this.players.indexOf(p)); y = p.extra.out ? 1.6 : 4.2; z = 0; }
      if (this.game === "snowball") z = (p.extra.team as number) === 1 ? SNOW.gap / 2 : -SNOW.gap / 2;
      if (this.game === "dam") z = 0.9;
      const s = r.project(x, y, z);
      if (!s) { p.tag.style.display = "none"; continue; }
      p.tag.style.display = "";
      p.tag.style.left = `${s.x}px`;
      p.tag.style.top = `${s.y}px`;
    }
  }

  dispose() {
    const r = this.ctx.r;
    for (const g of [this.m.ground, this.m.props, this.m.cone, this.m.bigCone, this.m.log, this.m.ball, this.m.puff, this.m.mtn]) r.dispose(g);
    if (this.m.water) r.dispose(this.m.water);
    this.joystick?.dispose();
    window.removeEventListener("keydown", this.onKey);
    this.root.remove();
  }
}

export const lerpA = lerpAngle;
