import {
  WORD_INFO,
  type RaceResultWire,
  type ServerMsg,
  type WordAction,
  type WordGame,
  type WordRivalWire,
  type WordSelfWire,
  type WordSetup,
} from "@beaver/shared";
import { compose, hash2, hexToRgb, lerp, lookAt, perspective, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { h, toast } from "../ui/dom";
import { buzz } from "../ui/life";
import { drawBeaver, getBeaverMeshes } from "./beaver";
import { letters } from "./village/letters";
import type { Ctx, Scene } from "./scene";

/**
 * Inside the Word Lodge: a timber reading room with a board at one end and a beaver at a
 * lectern in front of it.
 *
 * Every board is real geometry in the room rather than an HTML panel over the top of it —
 * Wordle tiles physically flip, Connections cards lift off the table, the crossword stands on
 * an easel and the Bee is a honeycomb on a plinth. Only the keyboard and the scoreboard are
 * DOM, which is where the game's art guide puts "sticker UI" anyway.
 *
 * Rivals appear twice: as beavers at their own lecterns down the room, and as progress bars on
 * the scoreboard. For Wordle their boards also hang on the side walls showing colour patterns
 * with the letters left off, which is all `WordRivalWire` carries.
 */

const ROOM = { halfW: 11, halfD: 9, wallH: 6.4 };
const C = (s: string) => hexToRgb(s);
const GREEN = "#6aaa64", AMBER = "#c9b458", SLATE = "#787c7e", CREAM = "#f6ead2", INK = "#2e1c12";
/** Connections group colours, easiest first. */
const GROUP_COLORS = ["#f2d35c", "#8fc96b", "#6fb3e0", "#b58fd6"];

interface Shell {
  room: GpuMesh;
  glow: GpuMesh;
  /** One tile, one card, one grid cell, one hex — reused for every instance. */
  tile: GpuMesh;
  card: GpuMesh;
  cell: GpuMesh;
  hex: GpuMesh;
  easel: GpuMesh;
  shadow: GpuMesh;
}

const shells = new WeakMap<Renderer, Shell>();

function buildShell(r: Renderer): Shell {
  const hit = shells.get(r);
  if (hit) return hit;
  const m = new MeshBuilder(), g = new MeshBuilder();
  const { halfW, halfD, wallH } = ROOM;
  const plankA = C("#c98e58"), plankB = C("#b47a47"), plankC = C("#d9a26b");

  // Plank floor with a long reading rug down the middle.
  for (let i = 0; i < 30; i++) {
    const x = -halfW + ((i + 0.5) * halfW * 2) / 30;
    const k = hash2(i, 3);
    m.box(compose(x, -0.09, 0, 0, 0, 0, (halfW * 2) / 30 - 0.03, 0.18, halfD * 2), k < 0.33 ? plankA : k < 0.66 ? plankB : plankC);
  }
  m.box(compose(0, 0.015, 1.5, 0, 0, 0, 7.5, 0.03, 9), C("#9c4f46"));
  m.box(compose(0, 0.025, 1.5, 0, 0, 0, 6.6, 0.03, 8.1), C("#b5635a"));

  // Log walls, a beamed ceiling, and a warm band of lamplight.
  const logRow = (y: number, k: number) => {
    const col = k % 2 ? C("#9a6a48") : C("#8a5c3e");
    m.cylinder(compose(0, y, -halfD, 0, 0, Math.PI / 2, 0.6, halfW * 2, 0.6), col, 10);
    m.cylinder(compose(0, y, halfD, 0, 0, Math.PI / 2, 0.6, halfW * 2, 0.6), col, 10);
    for (const s of [-1, 1]) m.cylinder(compose(s * halfW, y, 0, Math.PI / 2, 0, Math.PI / 2, 0.6, halfD * 2, 0.6), col, 10);
  };
  for (let k = 0; k * 0.56 < wallH; k++) logRow(0.3 + k * 0.56, k);
  m.box(compose(0, wallH + 0.2, 0, 0, 0, 0, halfW * 2 + 1, 0.4, halfD * 2 + 1), C("#6b4730"));
  for (let i = -3; i <= 3; i++) m.box(compose(i * 2.8, wallH - 0.2, 0, 0, 0, 0, 0.3, 0.4, halfD * 2), C("#5b3a24"));

  // Bookshelves along both side walls — this is a reading lodge.
  for (const s of [-1, 1]) {
    for (let b = 0; b < 4; b++) {
      const z = -6 + b * 4;
      if (s < 0 && z > -4 && z < 2) continue; // the hearth stands here now
      m.box(compose(s * (halfW - 0.75), 1.9, z, 0, 0, 0, 0.7, 3.8, 3.2), C("#6f4a30"));
      for (let shelf = 0; shelf < 4; shelf++) {
        const y = 0.5 + shelf * 0.95;
        m.box(compose(s * (halfW - 0.75), y, z, 0, 0, 0, 0.74, 0.08, 3.2), C("#8a5c3e"));
        for (let bk = 0; bk < 11; bk++) {
          const bz = z - 1.4 + bk * 0.28 + hash2(b * 7 + shelf, bk) * 0.05;
          const hgt = 0.52 + hash2(bk, shelf) * 0.22;
          const col = [C("#2f6f8a"), C("#c8473a"), C("#e7b13d"), C("#6aa84f"), C("#8a6bb5"), C("#d9834a")][(bk + shelf + b) % 6];
          m.box(compose(s * (halfW - 0.78), y + hgt / 2 + 0.04, bz, 0, 0, 0, 0.5, hgt, 0.2), col);
        }
      }
    }
    // Wall lamps between the shelves.
    for (const z of [-4, 0, 4]) {
      m.cylinder(compose(s * (halfW - 0.45), 4.5, z, 0, 0, Math.PI / 2, 0.14, 0.5, 0.14), C("#2e2b2a"), 8);
      g.sphere(compose(s * (halfW - 0.85), 4.5, z, 0, 0, 0, 0.3, 0.34, 0.3), C("#ffd08a"), 5, 8);
    }
  }

  // A hearth on the left wall. It used to sit under the board at the end of the room, where it
  // hid the bottom rows of every game; the end wall is now left clear for the board alone.
  const hx = -halfW + 0.6;
  m.box(compose(hx, 1.1, -1.5, 0, 0, 0, 0.8, 2.2, 4.4), C("#8d8272"));
  m.box(compose(hx + 0.45, 0.85, -1.5, 0, 0, 0, 0.3, 1.5, 2.6), C("#2a2522"));
  g.box(compose(hx + 0.5, 0.62, -1.5, 0, 0, 0, 0.18, 1.0, 2.1), C("#ff9a3c"));
  m.box(compose(hx + 0.55, 2.4, -1.5, 0, 0, 0, 1.1, 0.3, 5.0), C("#6f4a30"));

  // Lecterns: one for you at the front, three for rivals further back.
  for (let i = 0; i < 4; i++) {
    const x = i === 0 ? 0 : (i - 2) * 4.4 + (i === 1 ? -0.6 : 0.6);
    const z = i === 0 ? 2.2 : 6.2;
    m.box(compose(x, 0.45, z, 0, 0, 0, 1.5, 0.9, 0.7), C("#7a5436"));
    m.box(compose(x, 0.98, z, 0, -0.18, 0, 1.7, 0.16, 0.9), C("#9a6a48"));
  }

  const tile = new MeshBuilder();
  tile.box(compose(0, 0, 0, 0, 0, 0, 1, 1, 0.22), "#ffffff");
  const card = new MeshBuilder();
  card.box(compose(0, 0, 0, 0, 0, 0, 1, 1, 0.18), "#ffffff");
  const cell = new MeshBuilder();
  cell.box(compose(0, 0, 0, 0, 0, 0, 1, 1, 0.16), "#ffffff");

  // A flat hexagon prism for the Bee hive, lying in the XY plane so its face points at the
  // room. Rotating it about Z (as it was) turns it edge-on and it all but disappears.
  const hex = new MeshBuilder();
  hex.cylinder(compose(0, 0, 0, 0, Math.PI / 2, 0, 1, 1, 1), "#ffffff", 6);

  // The easel the crossword stands on.
  const easel = new MeshBuilder();
  for (const s of [-1, 1]) easel.cylinder(compose(s * 2.6, 1.6, 0.35, 0, 0, s * 0.12, 0.18, 3.2, 0.18), C("#7a5436"), 8);
  easel.box(compose(0, 0.9, 0.3, 0, 0, 0, 5.6, 0.2, 0.5), C("#7a5436"));

  const shadow = new MeshBuilder();
  shadow.cylinder(compose(0, 0, 0, 0, 0, 0, 2, 0.02, 2), "#000000", 12);

  const built: Shell = {
    room: r.upload(m.build()),
    glow: r.upload(g.build()),
    tile: r.upload(tile.build()),
    card: r.upload(card.build()),
    cell: r.upload(cell.build()),
    hex: r.upload(hex.build()),
    easel: r.upload(easel.build()),
    shadow: r.upload(shadow.build()),
  };
  shells.set(r, built);
  return built;
}

const KEY_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm"];

export class WordScene implements Scene {
  private shell: Shell;
  private game: WordGame;
  private setup: WordSetup;
  private self: WordSelfWire;
  private rivals: WordRivalWire[];
  private endsAt: number;
  private time = 0;
  private finished = false;

  // Local input state.
  private typed = "";
  private selected: number[] = [];
  private cursor = 0;
  private dir: "a" | "d" = "a";

  // Animation.
  /** When each Wordle row started flipping. */
  private flipAt: number[] = [];
  /** How high each Connections card is lifted, eased toward its target. */
  private lift: number[] = new Array(16).fill(0);
  private shake = 0;
  private yaw = 0;

  // DOM.
  private root: HTMLElement;
  private boardEl: HTMLElement;
  private timeEl: HTMLElement;
  private noteEl: HTMLElement;
  private keyboardEl: HTMLElement | null = null;
  private tags: HTMLElement[] = [];
  /** Screen positions of the things you can tap, refreshed every frame. */
  private hotspots: { x: number; y: number; r: number; hit: () => void }[] = [];

  constructor(private ctx: Ctx, start: Extract<ServerMsg, { t: "wordStart" }>) {
    this.shell = buildShell(ctx.r);
    this.game = start.game;
    this.setup = start.setup;
    this.self = start.you;
    this.rivals = start.rivals;
    this.endsAt = start.endsAt;
    this.cursor = this.firstOpenCell();

    const info = WORD_INFO[this.game];
    this.root = h("div", { style: "position:absolute;inset:0" });
    this.timeEl = h("div.pill", {}, "");
    this.noteEl = h("div.card.word-note", {});
    this.boardEl = h("div.card.scoreboard", {});
    this.root.append(
      h("div", { style: "position:absolute;left:14px;top:12px;display:grid;gap:8px;justify-items:start" }, [
        h("div.pill", {}, `${info.icon} ${info.name}`),
        this.timeEl,
        h("button.btn.small.cream.pe", { onclick: () => this.leave() }, "🚪 Leave"),
      ]),
      this.boardEl,
      h("div.card.word-how", {}, info.how),
      this.noteEl,
    );
    setTimeout(() => this.root.querySelector(".word-how")?.remove(), 9000);
    if (this.game === "wordle" || this.game === "bee") this.buildKeyboard();
    else this.root.append(h("div.card.word-note.word-hint", {}, this.game === "connections" ? "Tap four cards that belong together." : "Tap a square, then type. Tap it again to switch across/down."));
    ctx.ui.append(this.root);
    window.addEventListener("keydown", this.onKey);
    this.renderBoard();
  }

  // ---------------------------------------------------------------- input

  private onKey = (e: KeyboardEvent) => {
    if (this.finished) return;
    const target = e.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA)$/.test(target.tagName)) return;
    const k = e.key;
    if (k === "Escape") { this.leave(); return; }
    if (/^[a-zA-Z]$/.test(k)) { this.press(k.toLowerCase()); e.preventDefault(); return; }
    if (k === "Enter") { this.press("enter"); e.preventDefault(); return; }
    if (k === "Backspace") { this.press("back"); e.preventDefault(); return; }
    if (this.game === "crossword" && k.startsWith("Arrow")) {
      const d = k === "ArrowLeft" ? -1 : k === "ArrowRight" ? 1 : k === "ArrowUp" ? -this.setup.size : this.setup.size;
      this.moveCursor(d);
      e.preventDefault();
    }
  };

  /** One keystroke, from the real keyboard or the on-screen one. */
  private press(key: string) {
    if (this.finished || this.self.done) return;
    const { game } = this;
    if (game === "wordle" || game === "bee") {
      if (key === "enter") {
        if (this.typed.length) { this.send({ kind: "guess", word: this.typed }); this.typed = ""; }
        return;
      }
      if (key === "back") { this.typed = this.typed.slice(0, -1); return; }
      const max = game === "wordle" ? this.setup.length : 9;
      if (this.typed.length >= max) return;
      // The Bee can only use the seven letters in the hive, so a stray key is simply ignored.
      if (game === "bee" && !this.setup.centre.includes(key) && !this.setup.outer.includes(key)) {
        this.note(`No ${key.toUpperCase()} in the hive.`);
        return;
      }
      this.typed += key;
      this.ctx.sound.play("pop", 0.35);
      return;
    }
    if (game === "crossword") {
      if (key === "back") {
        if (this.self.cells[this.cursor]) this.send({ kind: "fill", cell: this.cursor, letter: "" });
        else { this.moveCursor(this.dir === "a" ? -1 : -this.setup.size); this.send({ kind: "fill", cell: this.cursor, letter: "" }); }
        return;
      }
      if (key === "enter") { this.dir = this.dir === "a" ? "d" : "a"; return; }
      if (key.length === 1) {
        this.send({ kind: "fill", cell: this.cursor, letter: key });
        this.moveCursor(this.dir === "a" ? 1 : this.setup.size);
      }
    }
  }

  private moveCursor(step: number) {
    const n = this.setup.size * this.setup.size;
    let c = this.cursor;
    for (let i = 0; i < n; i++) {
      c = (c + step + n) % n;
      if (!this.setup.blocks[c]) break;
    }
    this.cursor = c;
  }

  private firstOpenCell(): number {
    const n = this.setup.size * this.setup.size;
    for (let i = 0; i < n; i++) if (!this.setup.blocks[i]) return i;
    return 0;
  }

  private send(a: WordAction) {
    this.ctx.net.send({ t: "wordAct", a });
  }

  private leave() {
    this.ctx.net.send({ t: "wordQuit" });
  }

  private note(text: string) {
    this.noteEl.textContent = text;
    this.noteEl.classList.remove("pop");
    void this.noteEl.offsetWidth;
    this.noteEl.classList.add("pop");
  }

  // ---------------------------------------------------------------- DOM

  private buildKeyboard() {
    const rows = KEY_ROWS.map((row, i) =>
      h("div.kb-row", {}, [
        i === 2 ? h("button.kb-key.wide.pe", { onpointerdown: (e: Event) => { e.preventDefault(); this.press("enter"); } }, "ENTER") : null,
        ...[...row].map((ch) => h("button.kb-key.pe", { "data-k": ch, onpointerdown: (e: Event) => { e.preventDefault(); this.press(ch); } }, ch.toUpperCase())),
        i === 2 ? h("button.kb-key.wide.pe", { onpointerdown: (e: Event) => { e.preventDefault(); this.press("back"); } }, "⌫") : null,
      ].filter((x): x is HTMLElement => !!x)),
    );
    this.keyboardEl = h("div.kb", {}, rows);
    this.root.append(this.keyboardEl);
  }

  /** Colours each key by the best news any guess has given about that letter. */
  private paintKeys() {
    if (!this.keyboardEl || this.game !== "wordle") return;
    const best = new Map<string, string>();
    const rank: Record<string, number> = { b: 1, y: 2, g: 3 };
    this.self.rows.forEach((row, i) => {
      const mark = this.self.marks[i] ?? "";
      for (let k = 0; k < row.length; k++) {
        const ch = row[k], mk = mark[k];
        if (!mk) continue;
        if ((rank[mk] ?? 0) > (rank[best.get(ch) ?? ""] ?? 0)) best.set(ch, mk);
      }
    });
    for (const el of this.keyboardEl.querySelectorAll<HTMLElement>(".kb-key[data-k]")) {
      const mk = best.get(el.dataset.k!);
      el.className = `kb-key pe${mk ? ` m-${mk}` : ""}`;
    }
  }

  private renderBoard() {
    const rows = [...this.rivals]
      .sort((a, b) => b.score - a.score)
      .map((p) => {
        const me = p.id === this.ctx.state.you;
        return h("div.word-row" + (me ? ".me" : ""), {}, [
          h("span.nm", {}, `${me ? "You" : p.name}${p.isBot ? " 🤖" : ""}`),
          h("div.bar", {}, h("i", { style: { width: `${Math.round(p.progress * 100)}%`, background: p.solved ? "var(--gold)" : undefined } })),
          h("span", {}, p.done ? (p.solved ? "✅" : "—") : String(p.score)),
        ]);
      });
    this.boardEl.replaceChildren(...rows);
    this.paintKeys();
  }

  // ---------------------------------------------------------------- net

  handle(m: ServerMsg) {
    if (m.t === "wordState") {
      if (m.you) {
        const before = this.self.rows.length;
        this.self = m.you;
        // A newly marked row starts its flip.
        for (let i = before; i < this.self.marks.length; i++) this.flipAt[i] = this.time;
        if (m.you.note) {
          this.note(m.you.note);
          if (/isn't|Not |already|four letters|Four letters|No /i.test(m.you.note)) {
            this.shake = 0.4;
            buzz(this.ctx, 30);
          } else {
            this.ctx.sound.play("chime", 0.5);
          }
        }
        if (m.you.solved) this.ctx.sound.play("quest");
      }
      this.rivals = m.rivals;
      this.selected = this.selected.filter((i) => !this.self.found.some((f) => f.cards.includes(i)));
      this.renderBoard();
    }
    if (m.t === "wordEnd") this.showResults(m);
  }

  private showResults(m: Extract<ServerMsg, { t: "wordEnd" }>) {
    if (this.finished) return;
    this.finished = true;
    this.keyboardEl?.remove();
    const mine = m.results.find((r) => r.id === this.ctx.state.you);
    const title = mine?.solved ? (mine.place === 1 ? "🏆 Solved it first!" : "✅ Solved it!") : "⏳ Out of time!";
    if (mine?.solved) this.ctx.sound.play("quest");
    this.root.append(h("div.overlay", {}, h("div.card.results", {}, [
      h("h2", {}, title),
      h("div.hint", { style: "margin:4px 0 10px" }, m.answer),
      ...m.results.map((r) => h("div.res" + (r.id === this.ctx.state.you ? ".me" : ""), {}, [
        h("span.pl", {}, ["🥇", "🥈", "🥉"][r.place - 1] ?? `${r.place}`),
        h("span", {}, r.id === this.ctx.state.you ? `${r.name} (you)` : r.name),
        h("span", { style: "color:var(--muted)" }, `${r.score ?? 0} pts`),
        h("span", {}, r.isBot ? "" : `+🪙 ${r.coins}`),
      ])),
      m.best !== undefined ? h("div.hint", {}, `⭐ New weekly best: ${m.best}`) : null,
      h("div.hint", {}, "Back out to the lane in a moment…"),
    ].filter((x): x is HTMLElement => !!x))));
  }

  // ---------------------------------------------------------------- update

  update(dt: number) {
    this.time += dt;
    this.shake = Math.max(0, this.shake - dt);
    const left = Math.max(0, this.endsAt - Date.now());
    const secs = Math.ceil(left / 1000);
    this.timeEl.textContent = `⏱ ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
    this.timeEl.classList.toggle("urgent", secs <= 30 && !this.finished);

    // Ease the Connections cards toward lifted or resting.
    for (let i = 0; i < 16; i++) {
      const want = this.selected.includes(i) ? 1 : 0;
      this.lift[i] = lerp(this.lift[i], want, Math.min(1, dt * 14));
    }

    // Slow drift of the view, plus whatever the player has dragged.
    const drag = this.ctx.input.dragX;
    this.ctx.input.dragX = 0;
    this.ctx.input.dragY = 0;
    this.yaw = Math.max(-0.5, Math.min(0.5, this.yaw - drag * 0.004));

    const tap = this.ctx.input.consumeTap();
    if (tap && !this.finished) {
      // Nearest hotspot within reach of the tap wins.
      let best: { d: number; hit: () => void } | null = null;
      for (const s of this.hotspots) {
        const d = Math.hypot(s.x - tap.x, s.y - tap.y);
        if (d < s.r && (!best || d < best.d)) best = { d, hit: s.hit };
      }
      best?.hit();
    }
  }

  // ---------------------------------------------------------------- render

  render() {
    const { r } = this.ctx;
    r.time = this.time;
    // Indoors: a warm, even lamplight rather than the valley's sun.
    r.env.sky = false;
    r.env.lightDir = [0.35, 0.9, 0.3];
    r.env.sunColor = [1, 0.9, 0.74];
    r.env.sunIntensity = 0.95;
    r.env.skyTop = [0.34, 0.26, 0.2];
    r.env.skyHorizon = [0.2, 0.15, 0.12];
    r.env.ground = [0.3, 0.22, 0.16];
    r.env.ambient = 0.62;
    r.env.fogNear = 60;
    r.env.fogFar = 160;
    r.env.exposure = 1.04;
    r.env.snow = 0;
    r.env.wet = 0;
    r.env.seasonCol = [0, 0, 0, 0];
    r.resize();

    const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
    const shakeX = this.shake > 0 ? Math.sin(this.time * 60) * this.shake * 0.25 : 0;
    const cam: Vec3 = [Math.sin(this.yaw) * 7 + shakeX, 4.8, 7.6];
    const look: Vec3 = [shakeX * 0.4, 3.8, -5.5];
    r.shadowFocus = [0, 1, -2];
    r.cutFocus = null;
    r.begin(lookAt(cam, look), perspective(aspect < 0.8 ? 1.15 : 0.9, aspect, 0.3, 300), cam);

    const s = this.shell;
    r.draw(s.room, compose(0, 0, 0), { noCast: true });
    r.draw(s.glow, compose(0, 0, 0), { unlit: true, emissive: 0.8, noCast: true });

    this.hotspots = [];
    if (this.game === "wordle") this.drawWordle();
    else if (this.game === "connections") this.drawConnections();
    else if (this.game === "crossword") this.drawCrossword();
    else this.drawBee();

    this.drawBeavers();
    r.end();
    this.placeTags();
  }

  /** You at the front lectern, rivals at theirs. */
  private drawBeavers() {
    const { r } = this.ctx;
    const me = this.ctx.state.look;
    const seat = (i: number): Vec3 => (i === 0 ? [0, 0, 3.4] : [(i - 2) * 4.4 + (i === 1 ? -0.6 : 0.6), 0, 7.2]);
    const mine = seat(0);
    r.draw(this.shell.shadow, compose(mine[0], 0.03, mine[2], 0, 0, 0, 0.5), { unlit: true, alpha: 0.1 });
    drawBeaver(r, getBeaverMeshes(r, me), compose(mine[0], 0, mine[2], Math.PI), {
      walk: 0, moving: 0, swim: 0, jump: 0, wave: 0, sled: 0, time: this.time, seed: 1,
      expr: this.self.solved ? "happy" : this.self.done ? "neutral" : "determined",
      cheer: this.self.solved ? (Math.sin(this.time * 5) > 0 ? 1 : 0.3) : 0,
    });

    const others = this.rivals.filter((p) => p.id !== this.ctx.state.you).slice(0, 3);
    others.forEach((p, i) => {
      const at = seat(i + 1);
      const look = { ...me, fur: ["#8a5a3b", "#4e3324", "#c48a52"][i % 3], hat: ["hat_toque_teal", "hat_ranger", "hat_party"][i % 3] };
      r.draw(this.shell.shadow, compose(at[0], 0.03, at[2], 0, 0, 0, 0.5), { unlit: true, alpha: 0.1 });
      drawBeaver(r, getBeaverMeshes(r, look), compose(at[0], 0, at[2], Math.PI), {
        walk: 0, moving: 0, swim: 0, jump: 0, wave: 0, sled: 0, time: this.time, seed: 2 + i,
        expr: p.solved ? "happy" : "determined",
        talk: p.done ? 0 : Math.sin(this.time * 2 + i) > 0.8 ? 1 : 0,
        cheer: p.solved ? (Math.sin(this.time * 5 + i) > 0 ? 1 : 0.3) : 0,
      });
    });
  }

  /** Name tags over each beaver. */
  private placeTags() {
    const { r } = this.ctx;
    const people = [{ name: "You", me: true }, ...this.rivals.filter((p) => p.id !== this.ctx.state.you).slice(0, 3).map((p) => ({ name: p.name, me: false }))];
    while (this.tags.length < people.length) {
      const el = h("div.tag", {});
      this.root.append(el);
      this.tags.push(el);
    }
    people.forEach((p, i) => {
      const el = this.tags[i];
      el.className = `tag${p.me ? " me" : ""}`;
      el.textContent = p.name;
      const at: Vec3 = i === 0 ? [0, 2.9, 3.4] : [(i - 2) * 4.4 + (i === 1 ? -0.6 : 0.6), 2.9, 7.2];
      const sp = r.project(at[0], at[1], at[2]);
      if (!sp) { el.style.display = "none"; return; }
      el.style.display = "";
      el.style.left = `${sp.x}px`;
      el.style.top = `${sp.y}px`;
    });
    for (let i = people.length; i < this.tags.length; i++) this.tags[i].style.display = "none";
  }

  // ---------------------------------------------------------------- Wordle

  private drawWordle() {
    const { r } = this.ctx;
    const ink = letters(r, INK);
    const white = letters(r, "#ffffff");
    const { length: cols, tries: rows } = this.setup;
    const size = 0.78, step = 0.88;
    const x0 = -((cols - 1) * step) / 2;
    const y0 = 5.9;
    const z = -ROOM.halfD + 0.75;

    for (let row = 0; row < rows; row++) {
      const word = row < this.self.rows.length ? this.self.rows[row] : row === this.self.rows.length ? this.typed : "";
      const mark = this.self.marks[row] ?? "";
      const startedAt = this.flipAt[row];
      for (let col = 0; col < cols; col++) {
        const x = x0 + col * step;
        const y = y0 - row * step;
        // Each tile in a row flips a moment after the one before it.
        const t = startedAt === undefined ? 1 : Math.max(0, Math.min(1, (this.time - startedAt - col * 0.16) / 0.34));
        const flip = mark ? Math.sin(t * Math.PI) : 0;
        const revealed = !mark || t > 0.5;
        const mk = revealed ? mark[col] : "";
        const face = mk === "g" ? GREEN : mk === "y" ? AMBER : mk === "b" ? SLATE : CREAM;
        const ch = word[col];
        // Squash on the X axis fakes the flip without needing a second face.
        const squash = 1 - flip * 0.96;
        r.draw(this.shell.tile, compose(x, y, z, 0, 0, 0, size, size * squash, 0.22), { outline: 0.025, tint: [...C(face), 1] });
        if (ch && squash > 0.4) {
          const glyph = (mk === "g" || mk === "y" || mk === "b" ? white : ink).get(ch);
          if (glyph) r.draw(glyph, compose(x, y, z + 0.17, 0, 0, 0, size * 0.56, size * 0.56 * squash, 0.1), { unlit: !!mk, emissive: mk ? 0.1 : 0 });
        }
      }
    }

    // Rivals' boards flank the main one: colours only, never their letters.
    //
    // These began on the side walls, which was tidier and useless — the camera looks straight
    // down the room, so nobody ever saw them. Watching a rival close in is the whole point of
    // playing here, so they go where they can be watched.
    const others = this.rivals.filter((p) => p.id !== this.ctx.state.you).slice(0, 3);
    const nameInk = letters(r, INK);
    others.forEach((p, i) => {
      const side = i === 1 ? 1 : -1;
      const bx = side * 6.4;
      const by = i === 2 ? y0 - 2.9 : y0;
      const mini = 0.34, mstep = 0.4;
      for (let row = 0; row < rows; row++) {
        const mark = p.marks[row] ?? "";
        for (let col = 0; col < cols; col++) {
          const mk = mark[col];
          const face = mk === "g" ? GREEN : mk === "y" ? AMBER : mk === "b" ? SLATE : "#d8cbb0";
          r.draw(this.shell.tile, compose(bx + (col - (cols - 1) / 2) * mstep, by - row * mstep, z, 0, 0, 0, mini, mini, 0.12), {
            tint: [...C(face), 1],
          });
        }
      }
      const label = p.name.slice(0, 9).toUpperCase();
      for (let k = 0; k < label.length; k++) {
        const glyph = nameInk.get(label[k]);
        if (!glyph) continue;
        r.draw(glyph, compose(bx + (k - (label.length - 1) / 2) * 0.23, by + 0.46, z + 0.05, 0, 0, 0, 0.2, 0.2, 0.06), {});
      }
    });
  }

  // ---------------------------------------------------------------- Connections

  private drawConnections() {
    const { r } = this.ctx;
    const ink = letters(r, INK);
    const white = letters(r, "#ffffff");
    const cardW = 2.5, cardH = 1.0, gapX = 2.7, gapY = 1.2;
    const baseY = 4.6, z = -ROOM.halfD + 1.3;

    const foundOf = (i: number) => this.self.found.find((f) => f.cards.includes(i));
    // Solved groups collapse into a bar at the top, in the order they were found.
    this.self.found.forEach((f, gi) => {
      const y = baseY + 0.9 - gi * gapY;
      const col = GROUP_COLORS[f.rank] ?? GROUP_COLORS[0];
      r.draw(this.shell.card, compose(0, y, z, 0, 0, 0, gapX * 4, cardH, 0.2), { outline: 0.03, tint: [...C(col), 1] });
      const text = f.theme.toUpperCase().slice(0, 26);
      for (let k = 0; k < text.length; k++) {
        const glyph = ink.get(text[k]);
        if (!glyph) continue;
        r.draw(glyph, compose((k - (text.length - 1) / 2) * 0.3, y + 0.2, z + 0.14, 0, 0, 0, 0.27, 0.27, 0.07), {});
      }
      const words = f.cards.map((c) => this.setup.cards[c].toUpperCase()).join(" ");
      for (let k = 0; k < words.length; k++) {
        const glyph = ink.get(words[k]);
        if (!glyph) continue;
        r.draw(glyph, compose((k - (words.length - 1) / 2) * 0.23, y - 0.24, z + 0.14, 0, 0, 0, 0.21, 0.21, 0.06), {});
      }
    });

    // The cards still in play, filling the rows below the solved bars.
    const open = this.setup.cards.map((_, i) => i).filter((i) => !foundOf(i));
    open.forEach((i, slot) => {
      const row = Math.floor(slot / 4) + this.self.found.length;
      const col = slot % 4;
      const x = (col - 1.5) * gapX;
      const y = baseY + 0.9 - row * gapY;
      const chosen = this.selected.includes(i);
      const lift = this.lift[i];
      const face = chosen ? "#ffe9a8" : CREAM;
      r.draw(this.shell.card, compose(x, y + lift * 0.14, z + lift * 0.3, 0, 0, 0, cardW, cardH, 0.18), {
        outline: 0.03, tint: [...C(face), 1],
      });
      const word = this.setup.cards[i].toUpperCase();
      // Sized so the longest word still fits the card at a spacing that keeps letters apart.
      const letterSize = Math.min(0.34, (cardW - 0.3) / (word.length * 1.08));
      for (let k = 0; k < word.length; k++) {
        const glyph = (chosen ? ink : ink).get(word[k]);
        if (!glyph) continue;
        const lx = (k - (word.length - 1) / 2) * letterSize * 1.08;
        r.draw(glyph, compose(x + lx, y + lift * 0.14, z + lift * 0.3 + 0.12, 0, 0, 0, letterSize, letterSize, 0.07), {});
      }
      // Tapping a card picks it; four picks submit.
      const sp = r.project(x, y, z + 0.3);
      if (sp && !this.self.done) {
        this.hotspots.push({
          x: sp.x, y: sp.y, r: 46,
          hit: () => {
            const at = this.selected.indexOf(i);
            if (at >= 0) this.selected.splice(at, 1);
            else if (this.selected.length < 4) this.selected.push(i);
            this.ctx.sound.play("pop", 0.4);
            if (this.selected.length === 4) {
              this.send({ kind: "pick", cards: [...this.selected] });
              this.selected = [];
            }
          },
        });
      }
      void white;
    });

    // Mistake pips under the table.
    for (let k = 0; k < this.setup.tries; k++) {
      const used = k < this.self.mistakes;
      r.draw(this.shell.hex, compose(-0.6 + k * 0.4, baseY - 5.1, z + 0.2, 0, 0, 0, 0.14, 0.14, 0.14), {
        unlit: true, emissive: used ? 0.1 : 0.5, tint: used ? [0.35, 0.3, 0.28, 1] : [0.95, 0.5, 0.35, 1],
      });
    }
  }

  // ---------------------------------------------------------------- Crossword

  private drawCrossword() {
    const { r } = this.ctx;
    const ink = letters(r, INK);
    const size = this.setup.size;
    const cell = 0.85, step = 0.9;
    const x0 = -((size - 1) * step) / 2;
    const y0 = 5.9;
    const z = -ROOM.halfD + 1.0;

    r.draw(this.shell.easel, compose(0, 2.2, z + 0.5), {});
    r.draw(this.shell.cell, compose(0, y0 - ((size - 1) * step) / 2, z - 0.12, 0, 0, 0, size * step + 0.4, size * step + 0.4, 0.14), {
      outline: 0.03, tint: [...C("#6f4a30"), 1],
    });

    // Which entry the cursor is in, so the whole word can be highlighted.
    const inEntry = new Set<number>();
    const clue = this.setup.clues.find((c) => {
      if (c.dir !== this.dir) return false;
      const stepN = c.dir === "a" ? 1 : size;
      for (let k = 0; k < c.len; k++) if (c.cell + k * stepN === this.cursor) return true;
      return false;
    });
    if (clue) {
      const stepN = clue.dir === "a" ? 1 : size;
      for (let k = 0; k < clue.len; k++) inEntry.add(clue.cell + k * stepN);
    }

    for (let i = 0; i < size * size; i++) {
      const col = i % size, row = Math.floor(i / size);
      const x = x0 + col * step;
      const y = y0 - row * step;
      if (this.setup.blocks[i]) {
        r.draw(this.shell.cell, compose(x, y, z, 0, 0, 0, cell, cell, 0.16), { tint: [...C("#3a2b22"), 1] });
        continue;
      }
      const isCursor = i === this.cursor;
      const face = isCursor ? "#ffe08a" : inEntry.has(i) ? "#fff6dc" : "#fdfaf2";
      r.draw(this.shell.cell, compose(x, y, z, 0, 0, 0, cell, cell, 0.16), { outline: 0.02, tint: [...C(face), 1] });
      const ch = this.self.cells[i];
      if (ch) {
        const glyph = ink.get(ch);
        if (glyph) r.draw(glyph, compose(x, y - 0.04, z + 0.12, 0, 0, 0, 0.52, 0.52, 0.07), {});
      }
      const numbered = this.setup.clues.find((c) => c.cell === i);
      if (numbered) {
        const glyph = ink.get(String(numbered.n));
        if (glyph) r.draw(glyph, compose(x - 0.3, y + 0.3, z + 0.12, 0, 0, 0, 0.17, 0.17, 0.05), {});
      }
      const sp = r.project(x, y, z + 0.2);
      if (sp && !this.self.done) {
        this.hotspots.push({
          x: sp.x, y: sp.y, r: 26,
          hit: () => {
            // Tapping the square you're already on flips between across and down.
            if (this.cursor === i) this.dir = this.dir === "a" ? "d" : "a";
            else this.cursor = i;
            this.ctx.sound.play("pop", 0.3);
          },
        });
      }
    }

    // The clue for wherever the cursor is, on a board under the grid.
    const text = clue ? `${clue.n} ${clue.dir === "a" ? "ACROSS" : "DOWN"}  ${clue.text.toUpperCase()}` : "";
    const lines = wrap(text, 22);
    const boardY = y0 - size * step - 0.75;
    r.draw(this.shell.cell, compose(0, boardY - (lines.length - 1) * 0.16, z + 0.05, 0, 0, 0, 6.4, 0.5 + lines.length * 0.34, 0.12), {
      outline: 0.02, unlit: true, emissive: 0.5, tint: [...C("#fdfaf2"), 1],
    });
    lines.forEach((line, li) => {
      for (let k = 0; k < line.length; k++) {
        const glyph = ink.get(line[k]);
        if (!glyph) continue;
        r.draw(glyph, compose((k - (line.length - 1) / 2) * 0.24, boardY - li * 0.32, z + 0.14, 0, 0, 0, 0.21, 0.21, 0.06), {});
      }
    });
  }

  // ---------------------------------------------------------------- Spelling Bee

  private drawBee() {
    const { r } = this.ctx;
    const ink = letters(r, INK);
    const hive: [number, number][] = [[0, 0], [0, 1.72], [1.49, 0.86], [1.49, -0.86], [0, -1.72], [-1.49, -0.86], [-1.49, 0.86]];
    const cx = 0, cy = 4.0, z = -ROOM.halfD + 1.6;

    hive.forEach(([hx, hy], i) => {
      const ch = i === 0 ? this.setup.centre : this.setup.outer[i - 1];
      const centre = i === 0;
      const used = this.typed.includes(ch);
      r.draw(this.shell.hex, compose(cx + hx, cy + hy, z, 0, Math.PI / 2, 0, 0.98, 0.26, 0.98), {
        outline: 0.03,
        tint: centre ? [...C("#f2c14e"), 1] : used ? [...C("#ffe9a8"), 1] : [...C(CREAM), 1],
        emissive: centre ? 0.18 : 0,
      });
      const glyph = ink.get(ch);
      if (glyph) r.draw(glyph, compose(cx + hx, cy + hy, z + 0.2, 0, 0, 0, 0.6, 0.6, 0.09), {});
      const sp = r.project(cx + hx, cy + hy, z + 0.2);
      if (sp && !this.self.done) this.hotspots.push({ x: sp.x, y: sp.y, r: 34, hit: () => this.press(ch) });
    });

    // What you've typed so far, floating above the hive.
    const typed = this.typed.toUpperCase();
    for (let k = 0; k < typed.length; k++) {
      const glyph = ink.get(typed[k]);
      if (!glyph) continue;
      r.draw(glyph, compose(cx + (k - (typed.length - 1) / 2) * 0.42, cy + 2.6, z, 0, 0, 0, 0.36, 0.36, 0.09), { emissive: 0.1 });
    }

    // Found words on the board behind, newest last.
    const found = this.self.words.slice(-18);
    const perCol = 9;
    found.forEach((w, i) => {
      const col = Math.floor(i / perCol), row = i % perCol;
      const bx = col === 0 ? -5.6 : 5.6;
      const by = 5.2 - row * 0.44;
      const text = w.toUpperCase();
      for (let k = 0; k < text.length; k++) {
        const glyph = ink.get(text[k]);
        if (!glyph) continue;
        r.draw(glyph, compose(bx + (k - (text.length - 1) / 2) * 0.2, by, -ROOM.halfD + 0.8, 0, 0, 0, 0.17, 0.17, 0.05), {});
      }
    });
  }

  dispose() {
    window.removeEventListener("keydown", this.onKey);
    this.root.remove();
  }
}

/** Breaks a line of clue text into chunks that fit the lectern board. */
function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line && line.length + 1 + word.length > width) { out.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out.slice(0, 3);
}
