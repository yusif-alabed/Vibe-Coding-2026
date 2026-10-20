import { buildTrack, DEFAULT_LOOK, FUR_COLORS, TRACK, type Look, type RaceGame, type RaceSnapshot, type ServerMsg, type TrackLayout } from "@beaver/shared";
import { compose, lerp, lookAt, multiply, perspective, type Vec3 } from "../engine/math";
import { h } from "../ui/dom";
import { drawBeaver, getBeaverMeshes } from "./beaver";
import { buildMountains, buildSky } from "./hubWorld";
import { buildRaceWorld, courseTilt, setRaceTheme, trackToWorld, waterY, type RaceWorld } from "./raceWorld";
import type { Ctx, Scene } from "./scene";
import type { GpuMesh } from "../engine/renderer";

interface Racer {
  id: string;
  name: string;
  look: Look;
  isBot: boolean;
  x: number; z: number; speed: number; steer: number;
  tx: number; tz: number;
  stun: boolean; boost: boolean; done: boolean;
  dot: HTMLElement;
  tag: HTMLElement;
}

const ORD = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];

export class RaceScene implements Scene {
  private layout: TrackLayout;
  private world: RaceWorld;
  private sky: GpuMesh;
  private mtn: GpuMesh;
  private racers: Racer[];
  private me: Racer | null;
  private root: HTMLElement;
  private labels: HTMLElement;
  private countdownEl: HTMLElement;
  private placeEl: HTMLElement;
  private speedEl: HTMLElement;
  private speedlines: HTMLElement;
  private startAt: number;
  private time = 0;
  private lastSteer = 0;
  private steerAcc = 0;
  private lastCount = -1;
  private collected = new Set<number>();
  private particles: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; gold: boolean }[] = [];
  private finished = false;
  private wasStun = false;
  private wasBoost = false;
  private raceTime = 0;

  private game: RaceGame;
  private paddleAcc = 0;

  constructor(private ctx: Ctx, start: Extract<ServerMsg, { t: "raceStart" }>) {
    this.game = start.game ?? "toboggan";
    setRaceTheme(this.game);
    this.layout = buildTrack(start.seed);
    this.world = buildRaceWorld(ctx.r, this.layout, start.seed);
    this.sky = buildSky(ctx.r, "#5aa7ea", "#e9f3ff", "#fff6da");
    this.mtn = buildMountains(ctx.r, 11, [300, 420], 18, [0, -TRACK.length / 2]);
    this.startAt = performance.now() + start.countdownMs;

    this.root = h("div", { style: "position:absolute;inset:0" });
    this.labels = h("div", { style: "position:absolute;inset:0;overflow:hidden" });
    this.speedlines = h("div.speedlines");
    this.root.append(this.speedlines, this.labels);
    const prog = h("div.progress", {}, [h("div.track"), h("div.flag", {}, "🏁")]);
    this.racers = start.racers.map((r, i) => {
      const look = r.look ?? { ...DEFAULT_LOOK, fur: FUR_COLORS[(i * 3 + r.name.length) % FUR_COLORS.length], hat: i % 2 ? "hat_toque_teal" : "hat_ranger", scarf: "scarf_sunset" };
      const dot = h("div.dot" + (r.id === ctx.state.you ? ".me" : ""), { style: { left: "0%", background: r.id === ctx.state.you ? "" : look.fur } });
      prog.append(dot);
      const tag = h("div.tag" + (r.id === ctx.state.you ? ".me" : ""), {}, r.id === ctx.state.you ? "You" : r.name);
      this.labels.append(tag);
      const lane = start.racers.length > 1 ? -TRACK.halfWidth * 0.6 + (i * TRACK.halfWidth * 1.2) / (start.racers.length - 1) : 0;
      return { id: r.id, name: r.name, look, isBot: r.isBot, x: lane, z: 0, tx: lane, tz: 0, speed: 0, steer: 0, stun: false, boost: false, done: false, dot, tag };
    });
    this.me = this.racers.find((r) => r.id === ctx.state.you) ?? null;
    this.countdownEl = h("div.countdown", {}, "");
    this.placeEl = h("div.place-big", {}, "");
    this.speedEl = h("div.pill", {}, this.game === "canoe" ? "🛶 0 km/h" : "🛷 0 km/h");
    this.root.append(
      prog,
      h("div", { style: "position:absolute;left:14px;top:12px;display:grid;gap:8px;justify-items:start" }, [this.placeEl, this.speedEl]),
      h("div", { style: "position:absolute;right:14px;top:12px;display:grid;gap:6px;justify-items:end" }, [
        h("div.pill", {}, this.game === "canoe" ? "🛶 Canoe Dash" : "🛷 Toboggan Rush"),
        h("div.pill", {}, "⬅️ ➡️ / A D to steer"),
      ]),
      h("div.touchpads", {}, [h("div", {}, "⬅️"), h("div", {}, "➡️")]),
      this.countdownEl,
    );
    ctx.ui.append(this.root);
  }

  handle(m: ServerMsg) {
    if (m.t === "race") this.applySnapshot(m.r, m.time);
    if (m.t === "raceEnd") this.showResults(m.results);
  }

  private applySnapshot(snap: RaceSnapshot, t: number) {
    this.raceTime = t;
    for (const s of snap) {
      const r = this.racers.find((x) => x.id === s.id);
      if (!r) continue;
      r.tx = s.x;
      r.tz = s.z;
      r.speed = s.speed;
      r.steer = s.steer;
      r.stun = s.stun;
      r.boost = s.boost;
      r.done = s.done;
    }
    const me = this.me;
    if (!me) return;
    if (me.stun && !this.wasStun) { this.flash(this.game === "canoe" ? "SPLASH! 💦" : "BONK! 💫"); this.ctx.sound.play(this.game === "canoe" ? "splash" : "pop"); }
    if (me.boost && !this.wasBoost) { this.flash(this.game === "canoe" ? "RAPIDS! ⚡" : "BOOST! ⚡"); this.ctx.sound.play("chime"); }
    this.wasStun = me.stun;
    this.wasBoost = me.boost;
  }

  private flash(text: string) {
    const el = h("div.flash", {}, text);
    this.root.append(el);
    setTimeout(() => el.remove(), 700);
  }

  private showResults(results: Extract<ServerMsg, { t: "raceEnd" }>["results"]) {
    this.finished = true;
    const mine = results.find((r) => r.id === this.ctx.state.you);
    this.placeEl.textContent = mine ? ORD[mine.place - 1] ?? "" : "";
    const title = mine?.place === 1 ? "🏆 You won!" : mine ? `You came ${ORD[mine.place - 1]}!` : "Race over!";
    this.root.append(h("div.overlay", {}, h("div.card.results", {}, [
      h("h2", {}, title),
      ...results.map((r) =>
        h("div.res" + (r.id === this.ctx.state.you ? ".me" : ""), {}, [
          h("span.pl", {}, ["🥇", "🥈", "🥉"][r.place - 1] ?? `${r.place}`),
          h("span", {}, r.id === this.ctx.state.you ? `${r.name} (you)` : r.name),
          h("span", { style: "color:var(--muted)" }, r.time !== null ? `${r.time.toFixed(1)}s` : "DNF"),
          h("span", {}, r.isBot ? "" : `+🪙 ${r.coins}`),
        ]),
      ),
      h("div.hint", {}, "Heading back to the village in a moment…"),
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

    const inp = this.ctx.input;
    let steer = inp.touchSteer;
    if (inp.down("a", "arrowleft")) steer -= 1;
    if (inp.down("d", "arrowright")) steer += 1;
    steer = Math.max(-1, Math.min(1, steer));
    this.steerAcc += dt;
    if (!this.finished && (steer !== this.lastSteer || this.steerAcc > 0.25)) {
      this.ctx.net.send({ t: "steer", v: steer });
      this.lastSteer = steer;
      this.steerAcc = 0;
    }

    for (const r of this.racers) {
      // Extrapolate along the slope a little and ease toward the server position.
      const ahead = r.done ? r.tz : r.tz + r.speed * 0.05;
      r.z = r.z < 1 && r.tz < 1 ? r.tz : lerp(r.z, ahead, Math.min(1, dt * 12));
      r.x = lerp(r.x, r.tx, Math.min(1, dt * 12));
      if (r.speed > 6 && !r.done) {
        const [wx, wy0, wz] = trackToWorld(r.x, r.z - 1);
        const wy = this.game === "canoe" ? waterY(r.z - 1) : wy0;
        if (Math.random() < 0.7) this.particles.push({ x: wx + (Math.random() - 0.5), y: wy + 0.2, z: wz + 1, vx: (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 2, vz: 2, life: 0, gold: r.boost });
      }
    }
    for (const p of this.particles) {
      p.life += dt;
      p.vy -= 6 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    this.particles = this.particles.filter((p) => p.life < 0.7);

    const me = this.me;
    if (me) {
      for (const g of this.layout.gates) if (me.z > g.z && me.z - g.z < 6 && Math.abs(me.x - g.x) < TRACK.gateRadius) this.collected.add(g.id);
      if (!this.finished) {
        const ranked = [...this.racers].sort((a, b) => b.tz - a.tz);
        this.placeEl.textContent = ORD[ranked.indexOf(me)] ?? "";
      }
      this.speedEl.textContent = `${this.game === "canoe" ? "🛶" : "🛷"} ${Math.round(me.speed * 3.6)} km/h`;
      this.ctx.sound.setWhoosh(this.finished ? 0 : me.speed / 40);
      if (this.game === "canoe" && me.speed > 4 && !this.finished) {
        this.paddleAcc += dt;
        if (this.paddleAcc > 0.55) { this.paddleAcc = 0; this.ctx.sound.play("paddle", 0.7); }
      }
      this.speedlines.classList.toggle("on", me.boost);
    }
    for (const r of this.racers) r.dot.style.left = `${Math.min(100, (r.z / TRACK.length) * 100)}%`;
  }

  render() {
    const { r } = this.ctx;
    r.time = this.time;
    // Crisp snowy afternoon on the run (or a warm summer afternoon on the river).
    r.env.lightDir = [0.5, 0.55, -0.67];
    r.env.stars = 0;
    r.env.sunColor = [1.0, 0.9, 0.76];
    r.env.sunIntensity = 1.25;
    r.env.skyTop = [0.25, 0.52, 0.85];
    r.env.skyHorizon = [0.82, 0.88, 0.94];
    r.env.ground = [0.7, 0.72, 0.78];
    r.env.ambient = 0.6;
    r.env.exposure = 1.0;
    r.env.fogNear = 60;
    r.env.fogFar = 700;
    r.env.fogHeight = 0.006;
    r.env.clouds = 0.8;
    r.env.sky = true;
    if (this.game === "canoe") {
      r.env.sunColor = [1.0, 0.86, 0.64];
      r.env.sunIntensity = 1.35;
      r.env.ground = [0.42, 0.48, 0.3];
      r.env.ambient = 0.7;
    }
    const focus = this.me ?? this.racers[0];
    const p = trackToWorld(focus.x * 0.5, focus.z);
    const ahead = trackToWorld(focus.x * 0.5, focus.z + 10);
    const back = trackToWorld(focus.x * 0.4, focus.z - 9);
    const canoe = this.game === "canoe";
    if (canoe) { p[1] = waterY(focus.z); ahead[1] = waterY(focus.z + 10); back[1] = waterY(focus.z - 9); }
    const cam: Vec3 = [back[0], back[1] + (canoe ? 3.6 : 4.6), back[2]];
    r.resize();
    const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
    const fov = (aspect < 0.8 ? 1.1 : 0.95) + (focus.boost ? 0.12 : 0);
    r.shadowFocus = [p[0], p[1], p[2]];
    r.begin(lookAt(cam, [ahead[0], ahead[1] + 1, ahead[2]]), perspective(fov, aspect, 0.5, 2400), cam);
    const I = compose(0, 0, 0);
    r.draw(this.mtn, compose(0, -TRACK.length * TRACK.slope * 0.5 - 40, 0), { noCast: true });
    r.draw(this.world.ground, I, { noCast: true });
    r.draw(this.world.props, I, { sway: 0.15 });
    r.draw(this.world.glow, I, { unlit: true });
    if (this.world.water) r.draw(this.world.water, I, { wave: 1, alpha: 0.86 });

    for (const g of this.layout.gates) {
      const [x, y, z] = trackToWorld(g.x, g.z);
      const yaw = this.yawAt(g.z);
      const spin = this.time * 1.5;
      const took = this.collected.has(g.id);
      const gy = this.game === "canoe" ? waterY(g.z) + 0.2 : y;
      r.draw(this.world.gate, multiply(compose(x, gy + 1.9, z, yaw, -courseTilt()), compose(0, 0, 0, 0, 0, spin)), { unlit: true, alpha: took ? 0.25 : 1 });
    }

    for (const rc of this.racers) {
      const [x, y0, z] = trackToWorld(rc.x, rc.z);
      const y = canoe ? waterY(rc.z) - 0.25 + Math.sin(this.time * 3 + rc.z) * 0.04 : y0;
      const yaw = this.yawAt(rc.z) - rc.steer * 0.35;
      const tilt = courseTilt();
      const wobble = rc.stun ? Math.sin(this.time * 30) * 0.25 : 0;
      const root = compose(x, y + 0.05, z, yaw + wobble, tilt, rc.steer * (canoe ? 0.1 : 0.18));
      r.draw(this.world.sled, root, { outline: 0.04 });
      if (canoe) {
        // Paddle swaps sides with each stroke.
        const ph = this.time * 2.8 + this.racers.indexOf(rc);
        const side = Math.sin(ph) > 0 ? 1 : -1;
        const sweep = Math.cos(ph * 2) * 0.6;
        r.draw(this.world.paddle, multiply(root, compose(side * 0.55, 1.0, -0.1, 0, 0.5 + sweep, side * 0.5)), { outline: 0.02 });
      }
      const counting = performance.now() < this.startAt;
      const expr = rc.stun ? "dizzy" : rc.boost ? "excited" : rc.done ? "happy" : counting ? "determined" : "neutral";
      drawBeaver(r, getBeaverMeshes(r, rc.look), multiply(root, compose(0, canoe ? 0.15 : 0.2, -0.2)), {
        walk: 0, moving: 0, swim: 0, jump: 0, wave: rc.done ? 1 : 0, sled: 1, time: this.time, hold: canoe && !rc.done ? 0.6 : 0,
        expr, seed: this.racers.indexOf(rc) * 1.7, cheer: rc.done && this.racers.indexOf(rc) % 2 ? 1 : 0,
      }, rc.stun ? [1, 1, 1, 0.25] : undefined);
    }
    for (const p of this.particles) {
      const k = p.life / 0.7;
      r.draw(this.world.puff, compose(p.x, p.y, p.z, 0, 0, 0, 0.22 * (1 - k * 0.5)), { unlit: true, tint: p.gold ? [1, 0.85, 0.3, 1] : canoe ? [0.85, 0.95, 1, 1] : [1, 1, 1, 1], alpha: 0.8 * (1 - k) });
    }
    r.end();

    for (const rc of this.racers) {
      const [x, y0, z] = trackToWorld(rc.x, rc.z);
      const y = this.game === "canoe" ? waterY(rc.z) : y0;
      const s = r.project(x, y + 2.8, z);
      if (!s || s.depth > 80) { rc.tag.style.display = "none"; continue; }
      rc.tag.style.display = "";
      rc.tag.style.left = `${s.x}px`;
      rc.tag.style.top = `${s.y}px`;
    }
  }

  /** Heading of the run at distance z (beaver models face +z, the run heads toward -z). */
  private yawAt(z: number) {
    const a = trackToWorld(0, z), b = trackToWorld(0, z + 2);
    return Math.atan2(b[0] - a[0], b[2] - a[2]);
  }

  dispose() {
    const r = this.ctx.r;
    for (const m of [this.world.ground, this.world.props, this.world.glow, this.world.gate, this.world.sled, this.world.puff, this.world.paddle, this.sky, this.mtn]) r.dispose(m);
    if (this.world.water) r.dispose(this.world.water);
    this.ctx.sound.setWhoosh(0);
    this.root.remove();
  }
}
