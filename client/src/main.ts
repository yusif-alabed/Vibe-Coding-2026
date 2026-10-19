import { DEFAULT_LOOK, FUR_COLORS, NAME_MAX, type Look, type ServerMsg } from "@beaver/shared";
import { compose, lookAt, perspective, type Vec3 } from "./engine/math";
import { Renderer } from "./engine/renderer";
import { drawBeaver, getBeaverMeshes, type Expression } from "./game/beaver";
import { HubScene } from "./game/hubScene";
import { buildHub, heightAt, type HubWorld } from "./game/hubWorld";
import { Input } from "./game/input";
import { RaceScene } from "./game/raceScene";
import type { Ctx, Scene } from "./game/scene";
import { OfflineNet } from "./net/offline";
import { OnlineNet, type Net } from "./net/net";
import { h, toast } from "./ui/dom";
import { CSS } from "./ui/style";

declare const __GAME_SERVER_URL__: string;

const style = document.createElement("style");
style.textContent = CSS;
document.head.append(style);

const canvas = h("canvas") as HTMLCanvasElement;
canvas.id = "game";
const ui = h("div");
ui.id = "ui";
document.body.append(canvas, ui);

function storageGet(k: string): string | null {
  try { return localStorage.getItem(k); } catch { return null; }
}
function storageSet(k: string, v: string) {
  try { localStorage.setItem(k, v); } catch { /* ignore */ }
}

const params = new URLSearchParams(location.search);
const serverUrl = params.get("server") ?? (typeof __GAME_SERVER_URL__ === "string" ? __GAME_SERVER_URL__ : "");

let renderer: Renderer;
try {
  renderer = new Renderer(canvas);
} catch (e) {
  ui.append(h("div.title", {}, h("div.card.pe", { style: "padding:22px;max-width:420px;text-align:center" }, [
    h("h2", {}, "Oh no! 🦫"),
    h("p", {}, "Beaver Banff needs WebGL 2, which this browser or device doesn't support. Try a recent Chrome, Edge, Firefox or Safari."),
  ])));
  throw e;
}

const input = new Input(canvas);
const hub: HubWorld = buildHub(renderer);

let scene: Scene | null = null;
let ctx: Ctx | null = null;
let titleEl: HTMLElement | null = null;
const titleLook: Look = { ...DEFAULT_LOOK, fur: storageGet("bb-fur") ?? DEFAULT_LOOK.fur };

function showTitle() {
  const name = h("input.field.pe", { value: storageGet("bb-name") ?? "", placeholder: "Your beaver name", maxLength: NAME_MAX }) as HTMLInputElement;
  const swatches = h("div.swatches");
  const drawSwatches = () => swatches.replaceChildren(...FUR_COLORS.map((c) =>
    h("div.swatch.pe" + (c === titleLook.fur ? ".on" : ""), { style: { background: c }, title: "Fur colour", onclick: () => { titleLook.fur = c; drawSwatches(); } }),
  ));
  drawSwatches();
  const code = h("input.field.pe", { placeholder: "Cabin code", maxLength: 5, style: "text-transform:uppercase" }) as HTMLInputElement;
  const go = (room?: string) => start(name.value, room);
  name.addEventListener("keydown", (e) => { if (e.key === "Enter") go("public"); });

  const buttons = serverUrl
    ? [
        h("button.btn.orange.pe", { onclick: () => go("public") }, "🏔️ Play online"),
        h("div.row", {}, [
          h("button.btn.pe", { style: "flex:1", onclick: () => go("private-new") }, "🏡 New private cabin"),
        ]),
        h("div.row", {}, [code, h("button.btn.cream.pe", { onclick: () => code.value.trim() && go(code.value.trim().toUpperCase()) }, "Join")]),
        h("button.btn.cream.small.pe", { onclick: () => go(undefined) }, "Play solo with bot beavers"),
      ]
    : [h("button.btn.orange.pe", { style: "font-size:21px;padding:13px", onclick: () => go(undefined) }, "🛷 Let's go!")];

  titleEl = h("div.title", {}, h("div.card.pe", {}, [
    h("h1.logo", {}, ["Beaver ", h("span", {}, "Banff")]),
    h("div.tagline", {}, "Explore the mountains · meet friends · race toboggans · dress up"),
    h("div.label", {}, "Name"),
    name,
    h("div.label", {}, "Fur colour"),
    swatches,
    h("div.stack", {}, buttons),
    h("div.hint", {}, serverUrl
      ? [h("b", {}, "Online: "), "real players on the game server. ", h("b", {}, "Private cabin: "), "share the code with friends."]
      : [h("b", {}, "Solo preview: "), "runs right in your browser with friendly bot beavers. Run the game server (see README) to play together online."]),
  ]));
  ui.append(titleEl);
  setTimeout(() => name.focus(), 50);
}

function start(rawName: string, room?: string) {
  const name = rawName.trim().slice(0, NAME_MAX) || `Beaver${Math.floor(Math.random() * 900 + 100)}`;
  storageSet("bb-name", name);
  storageSet("bb-fur", titleLook.fur);
  const net: Net = room && serverUrl ? new OnlineNet(serverUrl) : new OfflineNet();
  ctx = { r: renderer, input, net, ui, state: { you: "", name, coins: 0, owned: [], look: titleLook } };
  titleEl?.remove();
  titleEl = null;
  const loading = h("div.title", {}, h("div.card", { style: "padding:18px 26px;font:600 20px var(--font-display)" }, "Paddling over… 🦫"));
  ui.append(loading);

  net.onMessage((m: ServerMsg) => {
    if (!ctx) return;
    if (m.t === "welcome") {
      loading.remove();
      if (m.token && m.token !== "solo") storageSet("bb-token", m.token);
      scene?.dispose();
      scene = new HubScene(ctx, hub, m);
      return;
    }
    if (m.t === "raceStart") {
      scene?.dispose();
      scene = new RaceScene(ctx, m);
      return;
    }
    scene?.handle(m);
  });
  net.onClose(() => {
    loading.remove();
    scene?.dispose();
    scene = null;
    ctx = null;
    toast(ui, "Lost connection to the game server. You can play solo while it's away.", 5000);
    showTitle();
  });
  net.send({ t: "join", name, look: titleLook, room: room === undefined ? undefined : room, token: storageGet("bb-token") ?? undefined });
}

// ---------- Main loop ----------
let last = performance.now();
let titleT = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  try {
    if (scene) {
      scene.update(dt);
      scene.render();
    } else {
      renderTitleBackdrop(dt);
    }
  } catch (err) {
    console.error(err);
  }
  requestAnimationFrame(frame);
}

function renderTitleBackdrop(dt: number) {
  titleT += dt;
  const r = renderer;
  r.time = titleT;
  r.resize();
  const a = titleT * 0.08 + 0.6;
  const cam: Vec3 = [Math.sin(a) * 15, 7.5, Math.cos(a) * 15 + 4];
  const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
  r.env.fogNear = 90;
  r.env.fogFar = 420;
  r.begin(lookAt(cam, [0, 2.4, 4]), perspective(aspect < 0.8 ? 1.1 : 0.85, aspect, 0.5, 1600), cam);
  const I = compose(0, 0, 0);
  r.draw(hub.sky, compose(cam[0], 0, cam[2]), { unlit: true, noFog: true });
  r.draw(hub.mountains, I, { outline: 0.6 });
  r.draw(hub.terrain, I, { texture: hub.terrainTexture, textureScale: 0.04, textureStrength: 0.28 });
  for (const prop of hub.props) r.draw(prop, I, { outline: 0.07 });
  r.draw(hub.glow, I, { unlit: true });
  drawBeaver(r, getBeaverMeshes(r, titleLook), compose(0, heightAt(0, 5), 5, a, 0, 0, 1.2), {
    walk: 0, moving: 0, swim: 0, jump: 0, wave: (Math.sin(titleT * 0.9) > 0.6 ? 1 : 0), sled: 0, time: titleT,
    expr: Math.sin(titleT * 0.9) > 0.6 ? "happy" : "neutral", talk: 0, seed: 1,
  });
  r.draw(hub.water, I, { wave: true, alpha: 0.86 });
  r.end();
}

// ---------- Character sheet (open the game with ?characters) ----------
const SHEET: { label: string; look: Look; expr: Expression; wave?: number; cheer?: number; talk?: number; jumpEvery?: number; swim?: number }[] = [
  { label: "Neutral · blinks & looks around", look: { ...DEFAULT_LOOK, fur: "#4e3324" }, expr: "neutral" },
  { label: "Happy wave", look: { ...DEFAULT_LOOK, fur: "#c48a52", hat: "hat_ranger", scarf: "scarf_sky" }, expr: "happy", wave: 1 },
  { label: "Excited cheer", look: { ...DEFAULT_LOOK, fur: "#6b4428", hat: "hat_crown", scarf: "scarf_sunset" }, expr: "excited", cheer: 1 },
  { label: "Surprised", look: { ...DEFAULT_LOOK, fur: "#a8703f", hat: "hat_antlers", backpack: "pack_hiker" }, expr: "surprised" },
  { label: "Dizzy (bonked)", look: { ...DEFAULT_LOOK, fur: "#b5835a", hat: "hat_toque_teal", backpack: "pack_canoe" }, expr: "dizzy" },
  { label: "Determined", look: { ...DEFAULT_LOOK, fur: "#4e3324", hat: null, scarf: "scarf_plaid" }, expr: "determined" },
  { label: "Chatting", look: { ...DEFAULT_LOOK, fur: "#8a5a3b", hat: "hat_toque_teal", scarf: "scarf_plaid" }, expr: "neutral", talk: 1 },
  { label: "Hop!", look: { ...DEFAULT_LOOK, fur: "#c48a52", hat: null, backpack: "pack_canoe" }, expr: "happy", jumpEvery: 1.4 },
];
let sheetLabels: HTMLElement[] = [];
let sheetBack = false;
function renderCharacterSheet(dt: number) {
  titleT += dt;
  const r = renderer;
  r.time = titleT;
  r.resize();
  const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
  const close = params.get("characters") === "close";
  const sheet = close ? [SHEET[0], { ...SHEET[0], label: "Happy", expr: "happy" as Expression }, { ...SHEET[0], label: "Surprised", expr: "surprised" as Expression }] : SHEET;
  const cols = close ? 3 : aspect < 0.9 ? 2 : 4;
  const rows = Math.ceil(sheet.length / cols);
  const spacing = close ? 1.6 : 2.4;
  const cam: Vec3 = close ? [0, 1.75, 4.2] : [0, 3.2 + rows * 1.9, 5.5 + rows * 2.4];
  r.env.fogNear = 200; r.env.fogFar = 600;
  r.begin(lookAt(cam, close ? [0, 1.45, 0] : [0, 0.6, 0.4]), perspective(aspect < 0.9 ? 0.95 : 0.72, aspect, 0.5, 1600), cam);
  r.draw(hub.sky, compose(cam[0], 0, cam[2]), { unlit: true, noFog: true });
  r.draw(hub.terrain, compose(0, -0.02, 0));
  if (!sheetLabels.length) {
    sheetLabels = sheet.map((c) => { const el = h("div.place", {}, c.label); ui.append(el); return el; });
    ui.append(h("div.pill.pe", { style: "position:absolute;left:12px;top:12px;cursor:pointer", onclick: () => { sheetBack = !sheetBack; } }, "🔄 Turn around"));
  }
  sheet.forEach((c, i) => {
    const col = i % cols, row = Math.floor(i / cols);
    const x = (col - (cols - 1) / 2) * spacing, z = (row - (rows - 1) / 2) * spacing * 1.7;
    const jumpT = c.jumpEvery ? (titleT % c.jumpEvery) / 0.55 : 1;
    drawBeaver(r, getBeaverMeshes(r, c.look), compose(x, 0, z, sheetBack ? Math.PI : close ? 0 : Math.sin(titleT * 0.6 + i) * 0.25), {
      walk: 0, moving: 0, swim: c.swim ?? 0, jump: jumpT < 1 ? Math.sin(jumpT * Math.PI) : 0, wave: c.wave ?? 0, sled: 0,
      time: titleT, expr: c.expr, cheer: c.cheer, talk: c.talk, seed: i * 1.3,
    });
    const s = r.project(x, 2.75, z);
    if (s) { sheetLabels[i].style.left = `${s.x}px`; sheetLabels[i].style.top = `${s.y}px`; }
  });
  r.end();
}

(window as unknown as { __bb: unknown }).__bb = { get scene() { return scene; } };
if (params.has("characters")) {
  const loop = (now: number) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; renderCharacterSheet(dt); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
} else {
  showTitle();
  requestAnimationFrame(frame);
}
