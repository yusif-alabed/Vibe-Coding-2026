import { DEFAULT_LOOK, FUR_COLORS, NAME_MAX, type Look, type ServerMsg } from "@beaver/shared";
import { Sound } from "./audio/sound";
import { compose, lookAt, perspective, type Vec3 } from "./engine/math";
import { Renderer } from "./engine/renderer";
import { drawBeaver, getBeaverMeshes, type Expression } from "./game/beaver";
import { CabinScene } from "./game/cabinScene";
import { applyTimeOfDay, dayPhase } from "./game/daylight";
import { HubScene } from "./game/hubScene";
import { applyMood, currentMood, drawWeather } from "./game/weather";
import { applyVillageLight, buildHub, drawHub, heightAt, type HubWorld } from "./game/hubWorld";
import { Input } from "./game/input";
import { RaceScene } from "./game/raceScene";
import { ArcadeScene } from "./game/arcadeScene";
import { GolfScene } from "./game/golfScene";
import { SummitScene } from "./game/summitScene";
import { giftToast } from "./ui/life";
import type { Ctx, Scene } from "./game/scene";
import { OfflineNet } from "./net/offline";
import { OnlineNet, type Net } from "./net/net";
import { h, toast } from "./ui/dom";
import { CSS } from "./ui/style";
import { loadPrefs } from "./prefs";

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
const builtUrl = typeof __GAME_SERVER_URL__ === "string" ? __GAME_SERVER_URL__ : "";
// A hosted build talks to the same server that served the page.
const sameOrigin = builtUrl === "same-origin" && /^https?:$/.test(location.protocol) ? `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}` : "";
const serverUrl = params.get("server") ?? (builtUrl === "same-origin" ? sameOrigin : builtUrl);

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
const sound = new Sound();
const prefs = loadPrefs();
renderer.quality = prefs.graphics;
/** Comfort settings that apply to the whole page. */
export function applyComfort() {
  document.body.classList.toggle("big-text", prefs.textSize === "large");
}
applyComfort();
const buildStart = performance.now();
const hub: HubWorld = buildHub(renderer);
const buildMs = Math.round(performance.now() - buildStart);

let scene: Scene | null = null;
let friendInviteSent = false;
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
  const code = h("input.field.pe", { placeholder: "Cabin code", maxLength: 5, style: "text-transform:uppercase", value: (params.get("room") ?? "").toUpperCase().slice(0, 5) }) as HTMLInputElement;
  const invitedRoom = params.get("room");
  const invitedFriend = params.get("friend");
  const recovery = h("input.field.pe", { placeholder: "Recovery code (from your other device)", maxLength: 12, style: "text-transform:uppercase" }) as HTMLInputElement;
  const go = (room?: string) => start(name.value, room, recovery.value.trim() || undefined);
  name.addEventListener("keydown", (e) => { if (e.key === "Enter") go("public"); });

  const buttons = serverUrl
    ? [
        invitedRoom ? h("button.btn.gold.pe", { onclick: () => go(invitedRoom.toUpperCase()) }, `🎉 Join your friend's cabin ${invitedRoom.toUpperCase()}`) : null,
        invitedFriend ? h("div.hint", { style: "margin:0" }, "👋 A friend invited you! Play online and you'll get a friend request to them.") : null,
        h("button.btn.orange.pe", { onclick: () => go("public") }, "🏔️ Play online"),
        h("div.row", {}, [
          h("button.btn.pe", { style: "flex:1", onclick: () => go("private-new") }, "🏡 New private cabin"),
        ]),
        h("div.row", {}, [code, h("button.btn.cream.pe", { onclick: () => code.value.trim() && go(code.value.trim().toUpperCase()) }, "Join")]),
        h("button.btn.cream.small.pe", { onclick: () => go(undefined) }, "Play solo with bot beavers"),
        h("details.pe", { style: "text-align:left;font-weight:700;font-size:13px;color:var(--muted)" }, [h("summary", { style: "cursor:pointer" }, "Playing on a new device?"), h("div", { style: "margin-top:6px" }, recovery)]),
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

function inviteCard(text: string, onYes: () => void, onNo: () => void) {
  const card = h("div.card.invite.pe", {}, [
    h("div", { style: "font-weight:800;margin-bottom:8px" }, text),
    h("div.row", { style: "justify-content:center" }, [
      h("button.btn.small", { onclick: () => { card.remove(); onYes(); } }, "✅ Yes!"),
      h("button.btn.small.cream", { onclick: () => { card.remove(); onNo(); } }, "No thanks"),
    ]),
  ]);
  ui.append(card);
  sound.play("chime");
  setTimeout(() => card.remove(), 30000);
}

function start(rawName: string, room?: string, recovery?: string) {
  const name = rawName.trim().slice(0, NAME_MAX) || `Beaver${Math.floor(Math.random() * 900 + 100)}`;
  storageSet("bb-name", name);
  storageSet("bb-fur", titleLook.fur);
  const net: Net = room && serverUrl ? new OnlineNet(serverUrl) : new OfflineNet();
  ctx = {
    r: renderer, input, net, ui, sound, prefs,
    state: { you: "", name, coins: 0, owned: [], look: titleLook, furniture: {}, quests: null, account: null, friends: [], party: { leader: null, members: [] }, life: null, club: null, neighbours: null, leaderboard: null },
  };
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
      sound.setMode("village");
      return;
    }
    if (m.t === "cabin" && !(scene instanceof CabinScene)) {
      scene?.dispose();
      scene = new CabinScene(ctx, m);
      sound.setMode("cabin");
      return;
    }
    if (m.t === "account") {
      ctx.state.account = { pid: m.pid, friendCode: m.friendCode, recoveryCode: m.recoveryCode };
      storageSet("bb-recovery", m.recoveryCode);
      // Opened from a friend's invite link: send them a friend request straight away.
      const inviteFriend = params.get("friend");
      if (inviteFriend && inviteFriend.toUpperCase() !== m.friendCode && !friendInviteSent) {
        friendInviteSent = true;
        ctx.net.send({ t: "friendRequest", code: inviteFriend });
      }
    }
    if (m.t === "life") ctx.state.life = m;
    if (m.t === "club") ctx.state.club = m.club;
    if (m.t === "neighbours") ctx.state.neighbours = { list: m.list, coziest: m.coziest };
    if (m.t === "leaderboard") ctx.state.leaderboard = { game: m.game, week: m.week, rows: m.rows };
    if (m.t === "gift") giftToast(ui, m.name, m.item);
    if (m.t === "gameStart") {
      scene?.dispose();
      scene = new ArcadeScene(ctx, m);
      sound.setMode("race");
      return;
    }
    if (m.t === "golfStart") {
      scene?.dispose();
      scene = new GolfScene(ctx, m);
      sound.setMode("village");
      return;
    }
    if (m.t === "summit") {
      scene?.dispose();
      scene = new SummitScene(ctx, m);
      sound.setMode("village");
      return;
    }
    if (m.t === "friends") ctx.state.friends = m.list;
    if (m.t === "party") ctx.state.party = { leader: m.leader, members: m.members };
    if (m.t === "friendRequest") {
      const n = ctx.net;
      inviteCard(`🤝 ${m.name} wants to be friends!`, () => n.send({ t: "friendRespond", from: m.from, accept: true }), () => n.send({ t: "friendRespond", from: m.from, accept: false }));
    }
    if (m.t === "partyInvite") {
      const n = ctx.net;
      inviteCard(`🎉 ${m.name} invited you to their party!`, () => n.send({ t: "partyRespond", from: m.from, accept: true }), () => n.send({ t: "partyRespond", from: m.from, accept: false }));
    }
    if (m.t === "quests") ctx.state.quests = m;
    if (m.t === "furniture") ctx.state.furniture = m.counts;
    if (m.t === "raceStart") {
      scene?.dispose();
      scene = new RaceScene(ctx, m);
      sound.setMode("race");
      return;
    }
    scene?.handle(m);
  });
  net.onClose(() => {
    loading.remove();
    scene?.dispose();
    scene = null;
    ctx = null;
    sound.setMode("title");
    toast(ui, "Lost connection to the game server. You can play solo while it's away.", 5000);
    showTitle();
  });
  net.send({ t: "join", name, look: titleLook, room: room === undefined ? undefined : room, token: storageGet("bb-token") ?? undefined, recovery });
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
  // A slow drifting postcard shot: fountain in the middle, lodge on the left, peaks behind.
  const a = Math.sin(titleT * 0.06) * 0.3 - 0.08;
  const cam: Vec3 = [Math.sin(a) * 25, 4.6, Math.cos(a) * 25];
  const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
  const night = applyTimeOfDay(r, dayPhase(prefs.time));
  const mood = currentMood(prefs);
  applyMood(r, mood);
  r.shadowFocus = [0, 0, 6];
  r.begin(lookAt(cam, [0, 6.5, -4]), perspective(aspect < 0.8 ? 1.15 : 0.86, aspect, 0.4, 2400), cam);
  drawHub(r, hub, titleT, night);
  drawWeather(r, mood, titleT, cam, night);
  drawBeaver(r, getBeaverMeshes(r, titleLook), compose(3.2, heightAt(3.2, 15.5), 15.5, a + 0.35, 0, 0, 1.15), {
    walk: 0, moving: 0, swim: 0, jump: 0, wave: (Math.sin(titleT * 0.9) > 0.6 ? 1 : 0), sled: 0, time: titleT,
    expr: Math.sin(titleT * 0.9) > 0.6 ? "happy" : "neutral", talk: 0, seed: 1,
  });
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
  applyVillageLight(r);
  r.shadowFocus = [0, 0, 0];
  r.begin(lookAt(cam, close ? [0, 1.45, 0] : [0, 0.6, 0.4]), perspective(aspect < 0.9 ? 0.95 : 0.72, aspect, 0.5, 1600), cam);
  r.draw(hub.terrain, compose(0, -0.02, 30), { noCast: true });
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
      time: titleT, expr: c.expr, cheer: c.cheer, talk: c.talk, seed: i * 1.3, hold: params.has("hold") ? 1 : 0, sip: params.get("hold") === "sip" ? 1 : 0,
    });
    const s = r.project(x, 2.75, z);
    if (s) { sheetLabels[i].style.left = `${s.x}px`; sheetLabels[i].style.top = `${s.y}px`; }
  });
  r.end();
}

(window as unknown as { __bb: unknown }).__bb = { get scene() { return scene; }, hub, buildMs };
if (params.has("characters")) {
  const loop = (now: number) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; renderCharacterSheet(dt); requestAnimationFrame(loop); };
  requestAnimationFrame(loop);
} else {
  showTitle();
  requestAnimationFrame(frame);
}
