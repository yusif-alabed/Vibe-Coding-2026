import {
  CATALOG,
  CATALOG_BY_ID,
  EMOTES,
  FUR_COLORS,
  HUB,
  HUB_COLLIDERS,
  HUB_PLACES,
  PORTAL_RADIUS,
  QUICK_CHAT,
  TOWN_PLACES,
  validateMove,
  visitedPlace,
  type HubAct,
  type Look,
  type QuestsWire,
  SEASON_INFO,
  WEATHER_INFO,
  type PlayerInfo,
  type ServerMsg,
  type Slot,
  ARCADE_INFO,
  BUGS,
  CHAINS,
  fishingSpot,
  GAME_SPOTS,
  inGarden,
  isNight,
  ITEMS,
  NPCS,
  NPC_TALK_RANGE,
  SEEDS,
  seasonAt,
  TRAIN,
  TRAIN_LOOP_S,
  trainAngle,
  type LeaderGame,
  type MiniGame,
} from "@beaver/shared";
import { compose, hexToRgb, lerp, lerpAngle, lookAt, perspective, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { h, toast } from "../ui/dom";
import { furnitureGrid } from "../ui/furnitureShop";
import { Joystick } from "../ui/joystick";
import { Minimap } from "../ui/minimap";
import { openFriends, openSettings } from "../ui/panels";
import { wantsJoystick } from "../prefs";
import { Ambient } from "./ambient";
import { streetYaw } from "./cameraZones";
import { applyTimeOfDay, dayPhase, timeLabel } from "./daylight";
import { applyMood, currentMood, drawWeather, umbrellaMesh, umbrellaWeather, type WorldMood } from "./weather";
import { PhotoMode } from "./photo";
import { drawBeaver, emoteReaction, getBeaverMeshes, type Expression } from "./beaver";
import { bridgeHeightAt, dockHeightAt, drawHub, ferrisSeat, heightAt, WATER_Y, type HubWorld } from "./hubWorld";
import { gondolaPoint, nextBoarding, railPoint, trainUnit } from "./village/transport";
import { isFlyingPet, PetFollower, petMesh } from "./pets";
import { buzz, Fishing, npcSay, openBag, openClubs, openGarden, openGolf, openJournal, openLeaderboard, openNeighbours, openWordLodge, PLACE_TITLES, type Panel } from "../ui/life";
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
  /** The last away activity, so the hop back to land knows where it starts from. */
  lastAway: HubAct | null;
  /** 0 = standing on land, 1 = fully into an away activity (spring, wheel, ice, tower). */
  soak: number;
  pet: PetFollower | null;
  /** Train ride: when the train reaches the platform, and which train. */
  board: { at: number; which: number; car: number } | null;
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

/** Hand-held things for cozy activities, plus the spa towel (built once per renderer). */
type HeldItem = "mug" | "croissant" | "icecream" | "taffy" | "marshmallow" | "guitar" | "rod";
const cozyMeshes = new WeakMap<Renderer, Record<HeldItem | "towel" | "bobber" | "bug" | "sprout" | "plant", GpuMesh>>();
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
  const croissant = new MeshBuilder();
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.45;
    croissant.sphere(compose(Math.sin(a) * 0.12, 0, Math.cos(a) * 0.06 - 0.02, a, 0, 0, 0.07 - Math.abs(i - 2) * 0.012, 0.06, 0.06), hexToRgb(i % 2 ? "#d9934a" : "#c47a35"), 4, 6);
  }
  const icecream = new MeshBuilder();
  icecream.cone(compose(0, -0.05, 0, 0, 0, Math.PI, 0.16, 0.26, 0.16), hexToRgb("#d9a25a"), 8);
  icecream.sphere(compose(0, 0.1, 0, 0, 0, 0, 0.1), hexToRgb("#ffb3c7"), 5, 8);
  icecream.sphere(compose(0, 0.2, 0, 0, 0, 0, 0.08), hexToRgb("#c7ecdf"), 5, 8);
  const taffy = new MeshBuilder();
  taffy.cylinder(compose(0, -0.05, 0, 0, 0, 0, 0.025, 0.32, 0.025), hexToRgb("#e8dcc0"), 4);
  taffy.sphere(compose(0, 0.13, 0, 0, 0, 0, 0.07, 0.09, 0.07), hexToRgb("#c97a2a"), 4, 6);
  const marshmallow = new MeshBuilder();
  marshmallow.cylinder(compose(0, 0, 0.4, 0, Math.PI / 2, 0, 0.03, 1.0, 0.03), hexToRgb("#8a5a34"), 4);
  marshmallow.cylinder(compose(0, 0, 0.92, 0, Math.PI / 2, 0, 0.09, 0.11, 0.09), hexToRgb("#e8c49a"), 8);
  const guitar = new MeshBuilder();
  guitar.sphere(compose(0, -0.08, 0, 0, 0, 0, 0.24, 0.22, 0.07), hexToRgb("#c47a35"), 6, 10);
  guitar.sphere(compose(0, 0.16, 0, 0, 0, 0, 0.18, 0.16, 0.065), hexToRgb("#c47a35"), 6, 10);
  guitar.cylinder(compose(0, 0.02, 0.06, 0, Math.PI / 2, 0, 0.09, 0.02, 0.09), hexToRgb("#3a2218"), 10);
  guitar.box(compose(0, 0.55, 0.02, 0, 0, 0, 0.07, 0.62, 0.04), hexToRgb("#5b3a24"));
  guitar.box(compose(0, 0.9, 0.02, 0, 0, 0, 0.1, 0.14, 0.05), hexToRgb("#3a2218"));
  const rod = new MeshBuilder();
  rod.cylinder(compose(0, 0, 1.0, 0, Math.PI / 2 - 0.5, 0, 0.04, 2.4, 0.04), hexToRgb("#8a5a34"), 5);
  rod.cylinder(compose(0, -0.45, 0.2, 0, 0, 0, 0.1, 0.06, 0.1), hexToRgb("#3a3a42"), 6);
  const bobber = new MeshBuilder();
  bobber.sphere(compose(0, 0.05, 0, 0, 0, 0, 0.12), hexToRgb("#e2483d"), 4, 6);
  bobber.sphere(compose(0, 0.13, 0, 0, 0, 0, 0.09), hexToRgb("#fffaf0"), 4, 6);
  const bug = new MeshBuilder();
  for (const s of [-1, 1]) bug.box(compose(s * 0.11, 0, 0, 0, 0, 0, 0.2, 0.01, 0.16), hexToRgb("#ffffff"));
  bug.box(compose(0, 0, 0, 0, 0, 0, 0.03, 0.03, 0.14), hexToRgb("#2a2624"));
  const sprout = new MeshBuilder();
  for (let i = 0; i < 3; i++) sprout.box(compose(Math.cos(i * 2.1) * 0.08, 0.12, Math.sin(i * 2.1) * 0.08, i * 2.1, 0.5, 0, 0.12, 0.02, 0.06), hexToRgb("#6fbf4a"));
  const plant = new MeshBuilder();
  plant.cylinder(compose(0, 0.3, 0, 0, 0, 0, 0.06, 0.6, 0.06), hexToRgb("#4f8a3a"), 5);
  for (let i = 0; i < 5; i++) plant.sphere(compose(Math.cos(i * 1.3) * 0.2, 0.25 + i * 0.08, Math.sin(i * 1.3) * 0.2, 0, 0, 0, 0.16, 0.06, 0.1), hexToRgb("#5f9a3a"), 3, 5);
  c = {
    mug: r.upload(mug.build()), towel: r.upload(towel.build()), croissant: r.upload(croissant.build()), icecream: r.upload(icecream.build()),
    taffy: r.upload(taffy.build()), marshmallow: r.upload(marshmallow.build()), guitar: r.upload(guitar.build()), rod: r.upload(rod.build()),
    bobber: r.upload(bobber.build()), bug: r.upload(bug.build()), sprout: r.upload(sprout.build()), plant: r.upload(plant.build()),
  };
  cozyMeshes.set(r, c);
  return c;
}
const HELD: Partial<Record<HubAct, HeldItem>> = { cocoa: "mug", croissant: "croissant", icecream: "icecream", taffy: "taffy", marshmallow: "marshmallow", guitar: "guitar", fish: "rod" };
/** Activities that move you somewhere else (into the spring, onto the wheel, the ice, the tower, the train or a balloon). */
const AWAY_ACTS: HubAct[] = ["soak", "ride", "skate", "climb", "train", "balloon"];
const BALLOON_S = 75;

/** What the action button offers at each place, and what happens. */
const PLACE_ACTS: Record<string, { act?: HubAct; label: string; done?: string; toast?: string }> = {
  lodge: { act: "cocoa", label: "☕ Grab a hot cocoa", done: "☕ Finish your cocoa", toast: "☕ Mmm… maple hot cocoa. Cozy!" },
  hotSpring: { act: "soak", label: "♨️ Soak in the hot spring", done: "♨️ Hop out", toast: "♨️ Ahh, toasty warm." },
  bakery: { act: "croissant", label: "🥐 Buy a maple croissant", done: "🥐 All gone!", toast: "🥐 Still warm from the oven!" },
  icecream: { act: "icecream", label: "🍦 Get a double scoop", done: "🍦 Finish your cone", toast: "🍦 Strawberry and mint!" },
  maple: { act: "taffy", label: "🍁 Try maple taffy on snow", done: "🍁 Finish your taffy", toast: "🍁 Sticky, sweet, very Canadian." },
  camp: { act: "marshmallow", label: "🔥 Toast a marshmallow", done: "🔥 Eat it!", toast: "🔥 Golden brown… perfect." },
  bandstand: { act: "guitar", label: "🎸 Play guitar on the bandstand", done: "🎸 Take a bow", toast: "🎸 The crowd goes wild!" },
  ferris: { act: "ride", label: "🎡 Ride the Ferris wheel", done: "🎡 Hop off", toast: "🎡 Wheee! Look at the view!" },
  rink: { act: "skate", label: "⛸️ Go skating", done: "⛸️ Stop skating", toast: "⛸️ Glide, glide, twirl!" },
  lookout: { act: "climb", label: "🔭 Climb the fire lookout", done: "🪜 Climb back down", toast: "🔭 You can see the whole town from up here!" },
  station: { act: "train", label: "🚂 Ride the valley train", done: "🚉 Hop off the train", toast: "🚂 All aboard! The train loops right round the valley." },
  balloons: { act: "balloon", label: "🎈 Take a hot-air balloon ride", done: "🎈 Land the balloon", toast: "🎈 Up, up and away!" },
};
const EMOTE_ICON: Partial<Record<HubAct, string>> = { cocoa: "☕", soak: "♨️", croissant: "🥐", icecream: "🍦", taffy: "🍁", marshmallow: "🔥", guitar: "🎸", ride: "🎡", skate: "⛸️", climb: "🔭", train: "🚂", balloon: "🎈", dance: "💃", sing: "🎤", fish: "🎣" };
const NPC_ICON: Record<string, string> = { bea: "🥐", maple: "🎩", rowan: "🌲", gus: "🗼" };

const BANFF_FACTS = [
  "Banff is Canada's oldest national park, founded in 1885.",
  "Lake Louise's turquoise colour comes from glacial 'rock flour' floating in the water.",
  "The Banff Upper Hot Springs bubble up at about 38 °C.",
  "Beavers can hold their breath for up to 15 minutes!",
  "A beaver's front teeth never stop growing — that's why they chew so much.",
  "Moraine Lake was once on the back of the Canadian twenty-dollar bill.",
  "Grizzly bears, elk, bighorn sheep and pikas all live around Banff.",
  "The Icefields Parkway is one of the most beautiful drives in the world.",
  "Beavers build dams so their lodge entrances stay safely underwater.",
];
const RANGER_TIPS = [
  "Ranger tip: golden pinecones reset every day — 12 to find!",
  "Ranger tip: the lookout tower has the best view in town.",
  "Ranger tip: try a Canoe Dash from the Lake Dock.",
  "Ranger tip: leave no trace — and never feed the wildlife!",
  "Ranger tip: come back at night to see the stars and the lit-up town.",
];
const INFO: Record<string, { label: string; lines: string[] }> = {
  library: { label: "📚 Read a Banff fact", lines: [] },
  ranger: { label: "🌲 Ask the ranger", lines: RANGER_TIPS },
  townHall: { label: "🔔 Ring the town bell", lines: ["🔔 DONG! DONG! The whole town hears it.", "🔔 The mayor waves from the balcony."] },
  windmill: { label: "🌾 Watch the sails turn", lines: ["🌾 The miller grinds flour for the bakery.", "🌾 Whoosh… whoosh… so peaceful."] },
  watermill: { label: "⚙️ Watch the mill wheel", lines: ["⚙️ Splish, splash, creak.", "⚙️ The river turns the wheel, the wheel turns the stones."] },
  lighthouse: { label: "🗼 Look out over the lake", lines: ["🗼 The lamp guides canoes home after dark.", "🗼 You can see the waterfall from here."] },
  observatory: { label: "🔭 Peek through the telescope", lines: ["🔭 Is that a moon of Jupiter?", "🔭 Come back at night for the best stars!"] },
  greenhouse: { label: "🌻 Smell the sunflowers", lines: ["🌻 Tomatoes, sunflowers and very happy ferns.", "🌻 It's warm and humid in here!"] },
  post: { label: "📮 Send a postcard", lines: ["📮 Snap a photo to send as a postcard!"] },
  trailhead: { label: "", lines: [] },
};


const SPRING_Y = () => heightAt(PL.hotSpring.x, PL.hotSpring.z) + 0.25;

const ITEM_ICON: Record<string, string> = {
  toque: "🧶", ranger: "🤠", antlers: "🦌", crown: "👑", scarf: "🧣", pack: "🎒", canoe: "🛶", snow: "❄️", leaf: "🍁",
  flowers: "🌸", sunhat: "👒", pumpkin: "🎃", holiday: "🎄", earmuffs: "🎧", propeller: "🚁", party: "🥳", candy: "🍬",
  basket: "🧺", firewood: "🪵", guitar: "🎸", board: "🏂", bubbles: "🫧", hearts: "💖", sparkle: "✨",
  fluffy: "🐿️", striped: "🦝", heart: "💗", star: "🌟", round: "👀", sleepy: "😴", lashes: "😊", glasses: "👓",
  chipmunk: "🐿️", bunny: "🐰", owl: "🦉", moose: "🫎", fox: "🦊", duck: "🐥", baker: "👨‍🍳", sash: "🎗️", bucket: "🎣",
  scholar: "🎓", maproll: "🗺️", butterfly: "🦋", beachball: "🏐",
};

export class HubScene implements Scene {
  private avatars = new Map<string, Avatar>();
  private me: Avatar;
  private yaw = 0.3;
  // Vertical cursor aim. This moves the follow-camera focus instead of letting
  // the whole orbit flip over when it is squeezed close to scenery.
  private lookOffset = 0;
  private dist = 13;
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
  private friendsBtn!: HTMLElement;
  private friendsPanel: { el: HTMLElement; refresh: () => void } | null = null;
  private joystick: Joystick | null = null;
  private ambient: Ambient;
  private mood!: WorldMood;
  private minimap: Minimap;
  private clockEl: HTMLElement;
  private clockKey = "";
  /** Fixed street/grandstand camera: which zone, and how far we've glided into it (0..1). */
  private lastRender = performance.now();
  /** Smoothed camera height target (so hops and steps don't shake the view). */
  private camY = NaN;
  private night = 0;
  private lastCoins = 0;
  private stepPhase = 0;
  private npcs: { look: Look; x: number; z: number; ry: number; kind: "busker" | "skater"; seed: number }[] = [];
  private lifePanel: Panel | null = null;
  private lifePanelKind = "";
  private fishing: Fishing | null = null;
  private npcMarks = new Map<string, HTMLElement>();
  private townsfolk = NPCS.map((n) => ({ ...n, look: { fur: n.fur, hat: n.hat, scarf: n.scarf, backpack: null, trail: null } as Look, face: n.ry, talkT: 0 }));
  private bugs: { id: number; kind: string; x: number; y: number; z: number; t: number; vx: number; vz: number; el: HTMLElement }[] = [];
  private bugAcc = 3;
  private bugId = 0;
  private gondolaRide = -1;
  private journalBtn!: HTMLElement;

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
          (this.friendsBtn = h("button.btn.cream.icon.pe.badge-host", { title: "Friends & party", onclick: () => this.openFriendsPanel() }, "👥")),
          h("button.btn.cream.icon.pe", { title: "Settings", onclick: () => this.openSettingsPanel() }, "⚙️"),
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
      (this.journalBtn = h("button.btn.cream.icon.pe", { title: "Journal & badges (J)", onclick: () => this.openLife("journal") }, "📖")),
      h("button.btn.cream.icon.pe", { title: "Your bag (B)", onclick: () => this.openLife("bag") }, "🧺"),
      h("button.btn.cream.icon.pe", { title: "More: clubs, leaderboards, invite", onclick: () => this.toggleMenu("more") }, "⋯"),
    ]));
    this.photo = new PhotoMode(ctx, this.root, {
      place: () => {
        const p = visitedPlace(this.me.x, this.me.z);
        return p ? `${PLACE_NAMES[p]}, Banff` : "Beaver Banff";
      },
      onShot: () => ctx.net.send({ t: "photo" }),
    });
    this.ambient = new Ambient(world);
    this.minimap = new Minimap(this.root, world);
    this.clockEl = h("div.pill.clock", { title: "Time of day — one full day lasts 25 minutes" });
    this.root.querySelector(".minimap-wrap")!.append(this.clockEl);
    this.lastCoins = ctx.state.coins;
    this.setupJoystick();
    // A busker strumming by the fountain and a few skaters out on the pond.
    const ba = 1.0, bx = Math.cos(ba) * 8.6, bz = Math.sin(ba) * 8.6;
    this.npcs.push({ look: { ...ctx.state.look, fur: "#6b4428", hat: "hat_ranger", scarf: "scarf_plaid", backpack: null, trail: null }, x: bx, z: bz, ry: Math.atan2(bx, bz), kind: "busker", seed: 3.3 });
    for (let i = 0; i < 3; i++) this.npcs.push({ look: { ...ctx.state.look, fur: ["#c48a52", "#8a5a3b", "#b5835a"][i], hat: ["hat_toque_teal", "hat_crown", null][i], scarf: ["scarf_sunset", "scarf_sky", "scarf_plaid"][i], backpack: null, trail: null }, x: 0, z: 0, ry: 0, kind: "skater", seed: i * 2.1 + 0.5 });
    this.updateFriendsBadge();
    window.addEventListener("keydown", this.onKey);
    if (room.isPrivate && room.code !== "SOLO") this.log(null, `Private cabin code: ${room.code} — share it with friends so they can join!`);
    this.roomCode = room.isPrivate && room.code !== "SOLO" ? room.code ?? null : null;
  }

  private setupJoystick() {
    const want = wantsJoystick(this.ctx.prefs);
    if (want && !this.joystick) this.joystick = new Joystick(this.root);
    if (!want && this.joystick) { this.joystick.dispose(); this.joystick = null; }
    this.root.classList.toggle("has-joy", !!this.joystick);
  }

  private openSettingsPanel() {
    this.closeOverlays();
    this.panelEl = openSettings(this.ctx, this.root, () => this.setupJoystick());
  }

  private openFriendsPanel() {
    this.closeOverlays();
    this.friendsPanel = openFriends(this.ctx, this.root);
    this.panelEl = this.friendsPanel.el;
  }

  private updateFriendsBadge() {
    const n = this.ctx.state.friends.filter((f) => f.online).length;
    this.friendsBtn.dataset.badge = n ? String(n) : "";
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
    if (e.key === "Escape" && !this.minimap.isBig) this.closeOverlays();
    if (e.key.toLowerCase() === "p") this.openPhoto();
    if (e.key.toLowerCase() === "j") this.openLife("journal");
    if (e.key.toLowerCase() === "b") this.openLife("bag");
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
    if (q.justCompleted?.length) { this.ctx.sound.play("quest"); buzz(this.ctx, [40, 40, 80]); }
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
    const tag = h("div.tag" + (p.id === this.ctx.state.you ? ".me" : ""), {}, [p.club ? h("span.clubtag", { style: { background: p.club.color } }, p.club.tag) : null, p.name]);
    this.labels.append(tag);
    const a: Avatar = {
      info: p, x: p.x, z: p.z, ry: p.ry, tx: p.x, tz: p.z, tr: p.ry,
      walk: 0, moving: 0, swim: 0, jumpT: 0, waveT: 0, cheerT: 0, expr: "neutral", exprT: 0, talkT: 0,
      seed: [...p.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 1000, 7) / 100, tag, bubble: null, bubbleUntil: 0, trailAcc: 0,
      act: null, actT: 0, actX: p.x, actZ: p.z, soak: 0, lastAway: null, pet: null, board: null,
    };
    this.avatars.set(p.id, a);
    if (this.countEl) this.countEl.textContent = String(this.avatars.size);
  }

  private removeAvatar(id: string) {
    const a = this.avatars.get(id);
    if (!a) return;
    a.tag.remove();
    a.bubble?.remove();
    this.npcMarks.get(id)?.remove();
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
        if (m.a === "stop") { a.act = null; if (a === this.me) this.fishing?.cancel(); break; }
        a.act = m.a;
        a.actT = 0;
        if (AWAY_ACTS.includes(m.a)) a.lastAway = m.a;
        this.ctx.sound?.play(m.a === "soak" ? "splash" : m.a === "guitar" ? "strum" : "pop");
        a.actX = a === this.me ? a.x : a.tx;
        a.actZ = a === this.me ? a.z : a.tz;
        a.expr = "happy";
        a.exprT = 1.5;
        if (m.a === "train") { const car = 1 + (Math.floor(a.seed * 10) % TRAIN.cars); a.board = { ...nextBoarding(Date.now(), car), car }; }
        if (a === this.me && m.a === "fish" && !this.fishing) this.fishing = new Fishing(this.ctx, this.root, () => { this.fishing = null; if (this.me.act === "fish") this.ctx.net.send({ t: "act", a: "stop" }); });
        const el = h("div.emote", {}, EMOTE_ICON[m.a] ?? "✨");
        this.labels.append(el);
        (el as HTMLElement & { _follow?: Avatar })._follow = a;
        setTimeout(() => el.remove(), 1600);
        break;
      }
      case "friends":
      case "party":
        this.updateFriendsBadge();
        if (this.friendsPanel?.el.isConnected) this.friendsPanel.refresh();
        break;
      case "wallet":
        if (m.coins > this.lastCoins) { this.ctx.sound.play("coin"); buzz(this.ctx, 15); }
        this.lastCoins = m.coins;
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
      case "life":
        this.ctx.state.life = m;
        if (this.panelEl === this.lifePanel?.el && this.panelEl?.isConnected) this.lifePanel.refresh();
        break;
      case "lifeSay": {
        if (m.npc) {
          const npc = NPCS.find((n) => n.name === m.npc);
          npcSay(this.root, m.npc, npc ? NPC_ICON[npc.id] : "🦫", m.text);
          if (npc) { const tf = this.townsfolk.find((t) => t.id === npc.id); if (tf) tf.talkT = 2.5; }
        } else if (m.catch) {
          const it = ITEMS[m.catch.fish];
          const pop = h("div.card.quest-pop", {}, [h("b", {}, `${it?.icon ?? "🐟"} ${m.catch.record ? "New personal best!" : "Caught!"}`), m.text]);
          this.root.append(pop);
          setTimeout(() => pop.remove(), 3600);
          this.me.cheerT = 1.6;
          this.me.expr = "excited";
          this.me.exprT = 2;
          this.ctx.sound.play("quest");
          buzz(this.ctx, [30, 30, 60]);
        } else toast(this.root, m.text, Math.min(9000, 2600 + m.text.length * 30));
        if (m.gifts?.length) {
          this.ctx.sound.play("quest");
          for (const g of m.gifts) toast(this.root, `🎁 You received: ${CATALOG_BY_ID[g]?.name ?? ITEMS[g]?.name ?? g}!`, 4000);
        }
        for (const pg of m.pages ?? []) {
          const pop = h("div.card.quest-pop", {}, [h("b", {}, "🏅 Journal page complete!"), `New badge for your ${pg} page`]);
          this.root.append(pop);
          setTimeout(() => pop.remove(), 3600);
        }
        break;
      }
      case "club":
        this.ctx.state.club = m.club;
        if (this.lifePanelKind === "clubs" && this.panelEl?.isConnected) this.lifePanel?.refresh();
        break;
      case "playerClub": {
        const a = this.avatars.get(m.id);
        if (a) {
          a.info.club = m.club;
          a.tag.replaceChildren(...[m.club ? h("span.clubtag", { style: { background: m.club.color } }, m.club.tag) : null, a.info.name].filter((x): x is HTMLElement | string => !!x));
        }
        break;
      }
      case "neighbours":
        this.ctx.state.neighbours = { list: m.list, coziest: m.coziest };
        if (this.lifePanelKind === "neighbours" && this.panelEl?.isConnected) this.lifePanel?.refresh();
        break;
      case "leaderboard":
        this.ctx.state.leaderboard = { game: m.game, week: m.week, rows: m.rows };
        if (this.lifePanelKind === "leaderboard" && this.panelEl?.isConnected) this.lifePanel?.refresh();
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

  private toggleMenu(kind: "quick" | "emote" | "more") {
    const was = this.menuEl?.dataset.kind;
    this.menuEl?.remove();
    this.menuEl = null;
    if (was === kind) return;
    const close = () => { this.menuEl?.remove(); this.menuEl = null; };
    const act = (a: HubAct) => { this.target = null; this.ctx.net.send({ t: "act", a: this.me.act === a ? "stop" : a }); close(); };
    const menu = kind === "quick"
      ? h("div.card.menu.quick.pe", {}, QUICK_CHAT.map((q, i) => h("button", { onclick: () => { this.ctx.net.send({ t: "quick", i }); close(); } }, q)))
      : kind === "emote"
        ? h("div.card.menu.emotes.pe", {}, [
            ...EMOTES.map((e, i) => h("button", { onclick: () => { if (e === "💃") act("dance"); else this.ctx.net.send({ t: "emote", i }); close(); } }, e)),
            h("button", { title: "Sing along", onclick: () => act("sing") }, "🎤"),
          ])
        : h("div.card.menu.quick.pe", {}, [
            h("button", { onclick: () => { close(); this.openLife("clubs"); } }, "🏅 Clubs"),
            h("button", { onclick: () => { close(); this.openLife("leaderboard"); } }, "🏆 Weekly leaderboards"),
            h("button", { onclick: () => { close(); this.openLife("neighbours"); } }, "🏡 Cottage Lane cabins"),
            h("button", { onclick: () => { close(); this.copyInvite(); } }, "🔗 Copy an invite link"),
            h("button", { onclick: () => { close(); this.openLife("garden"); } }, "🥕 My garden plots"),
          ]);
    menu.dataset.kind = kind;
    this.menuEl = menu;
    this.root.append(menu);
  }

  /** Opens one of the village-life panels (journal, bag, garden, clubs, neighbours, leaderboards). */
  private openLife(kind: string, game?: LeaderGame) {
    this.closeOverlays();
    const root = this.root;
    const ctx = this.ctx;
    const p = kind === "journal" ? openJournal(ctx, root) : kind === "bag" ? openBag(ctx, root) : kind === "garden" ? openGarden(ctx, root)
      : kind === "wordlodge" ? { el: openWordLodge(ctx, root), refresh: () => {} }
      : kind === "clubs" ? openClubs(ctx, root) : kind === "neighbours" ? openNeighbours(ctx, root) : kind === "golf" ? { el: openGolf(ctx, root), refresh: () => {} }
      : openLeaderboard(ctx, root, game ?? "hunt");
    this.lifePanel = p;
    this.lifePanelKind = kind;
    this.panelEl = p.el;
  }

  private copyInvite() {
    const st = this.ctx.state;
    const base = `${location.origin}${location.pathname}`;
    const room = this.roomCode;
    const link = room ? `${base}?room=${room}` : st.account ? `${base}?friend=${st.account.friendCode}` : base;
    try { void navigator.clipboard?.writeText(link); } catch { /* ignore */ }
    toast(this.root, room ? `🔗 Invite link to this cabin copied: ${link}` : st.account ? `🔗 Friend invite link copied! ${link}` : "🔗 Invite links work when you play online.", 5200);
  }
  private roomCode: string | null = null;

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
    if (!this.panelEl || this.lifePanel?.el === this.panelEl) return;
    const st = this.ctx.state;
    const tabs: [Slot | "fur" | "cabin", string][] = [["hat", "Hats"], ["scarf", "Scarves"], ["backpack", "Packs"], ["trail", "Trails"], ["tail", "Tails"], ["eyes", "Eyes"], ["pet", "🐾 Pets"], ["dye", "🎨 Dyes"], ["fur", "Fur"], ["cabin", "🏡 Cabin"]];
    const setLook = (look: Look) => this.ctx.net.send({ t: "look", look });
    const season = this.mood?.season ?? seasonAt();
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
    } else if (this.shopTab === "dye") {
      // Dye station: buy a colour once, then dye your hat, scarf or pack with it (or wash it out).
      const dyes = CATALOG.filter((i) => i.slot === "dye");
      const parts: ["hat" | "scarf" | "backpack", string][] = [["hat", "🎩 Hat"], ["scarf", "🧣 Scarf"], ["backpack", "🎒 Pack"]];
      grid = h("div.grid", {}, dyes.map((d) => {
        const owned = st.owned.includes(d.id);
        return h("div.item", {}, [
          h("div.ico", { style: { background: d.color } }, "🎨"),
          h("div.nm", {}, d.name),
          owned
            ? h("div.row", { style: "justify-content:center;flex-wrap:wrap;gap:4px" }, parts.map(([slot, label]) => {
                const on = st.look.dyes?.[slot] === d.id;
                return h("button.btn.small" + (on ? ".cream" : ""), { disabled: !st.look[slot], onclick: () => setLook({ ...st.look, dyes: { ...(st.look.dyes ?? {}), [slot]: on ? undefined : d.id } }) }, on ? `✓ ${label}` : label);
              }))
            : h("button.btn.small.gold", { disabled: st.coins < d.price, onclick: () => this.ctx.net.send({ t: "buy", item: d.id }) }, `Buy · 🪙 ${d.price}`),
        ]);
      }));
    } else {
      const slot = this.shopTab as Exclude<Slot, "dye">;
      const items = CATALOG.filter((i) => i.slot === slot && (st.owned.includes(i.id) || (!i.reward && (!i.season || i.season === season))));
      const locked = CATALOG.filter((i) => i.slot === slot && !st.owned.includes(i.id) && (i.reward || (i.season && i.season !== season)));
      grid = h("div.grid", {}, [
        ...items.map((item) => {
          const owned = st.owned.includes(item.id);
          const worn = st.look[slot] === item.id;
          const action = owned
            ? h("button.btn.small" + (worn ? ".cream" : ""), { onclick: () => setLook({ ...st.look, [slot]: worn ? null : item.id }) }, worn ? "Take off" : "Wear")
            : h("button.btn.small.gold", { disabled: st.coins < item.price, onclick: () => this.ctx.net.send({ t: "buy", item: item.id }) }, `Buy · 🪙 ${item.price}`);
          return h("div.item", {}, [
            h("div.ico", { style: { background: item.color } }, ITEM_ICON[item.shape] ?? "✨"),
            h("div.nm", {}, item.name),
            h("div.price", {}, owned ? (worn ? "✅ Wearing" : "Owned") : item.season ? `🍂 This ${item.season} only · 🪙 ${item.price}` : item.price === 0 ? "Free" : `🪙 ${item.price}`),
            action,
          ]);
        }),
        ...locked.map((item) => h("div.item.locked", {}, [
          h("div.ico", { style: { background: "#e8e0d4" } }, "🔒"),
          h("div.nm", {}, item.name),
          h("div.price", {}, item.reward ? "Earned from townsfolk or the journal" : `Back in ${item.season}`),
        ])),
      ]);
    }
    const panel = h("div.card.panel", {}, [
      h("header", {}, [
        h("h2", {}, "🎒 Beaver Outfitter"),
        h("div.row", {}, [h("div.pill.coins", {}, `🪙 ${st.coins}`), h("button.btn.cream.small", { onclick: () => this.closeOverlays() }, "✕")]),
      ]),
      h("div.tabs", { style: "flex-wrap:wrap" }, tabs.map(([k, label]) => h("button.tab" + (k === this.shopTab ? ".on" : ""), { onclick: () => { this.shopTab = k; this.refreshShop(); } }, label))),
      h("div", { style: "padding:0 16px 6px;font-size:13px;color:var(--muted);font-weight:700" }, this.shopTab === "cabin"
        ? "Furniture for your cabin — tap 🏡 to go home and decorate. Seasonal pieces come and go each season!"
        : this.shopTab === "dye" ? "Buy a dye once, then colour your hat, scarf or pack any time."
          : "Cosmetics are just for looks. Seasonal items are only sold during their season — earn coins in minigames, quests, fishing and gardening!"),
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
      h("div", { style: "margin-top:8px" }, "🎮 Minigames: 🌰 Pinecone Hunt at the campground, 🪵 Log Rolling by the lighthouse, ⛄ Snowball Fight at the pond, 🦫 Dam Builder at the watermill, ⛳ golf at the clubhouse."),
      h("div", { style: "margin-top:8px" }, "🎣 Fish at the lake or river · 🥕 grow veggies in the garden · 🦋 tap butterflies · 📖 fill your journal (J) · 🧺 sell or gift from your bag (B)."),
      h("div", { style: "margin-top:8px" }, "🗨️ Townsfolk with a ! have errands for you · 🚂 ride the valley train · 🎈 balloon rides · 🚡 gondola to the summit."),
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
      ...(() => {
        const friend = this.ctx.state.friends.find((f) => f.pid === a.info.pid);
        if (!friend) return [h("button.btn.small", { onclick: () => { this.ctx.net.send({ t: "friendRequest", id: a.info.id }); close(); } }, "🤝 Add friend")];
        if (this.ctx.state.party.members.some((p) => p.pid === friend.pid)) return [h("div.hint", { style: "margin:0;text-align:center" }, "🎉 In your party")];
        return [h("button.btn.small", { onclick: () => { this.ctx.net.send({ t: "partyInvite", pid: friend.pid }); close(); } }, "🎉 Invite to party")];
      })(),
      h("button.btn.small.cream", { onclick: () => { this.blocked.add(a.info.id); this.ctx.net.send({ t: "block", id: a.info.id }); toast(this.root, `You won't see chat from ${a.info.name}.`); close(); } }, "🚫 Block"),
      h("button.btn.small.red", { onclick: () => { this.ctx.net.send({ t: "report", id: a.info.id, reason: "Reported from player card" }); close(); } }, "🚩 Report"),
    ]);
    this.panelEl = h("div.pe", { style: "position:absolute;inset:0", onclick: (e: Event) => { if (e.target === this.panelEl) close(); } }, card);
    this.root.append(this.panelEl);
  }

  // ---------- Context action (portal, shop, lodge, arcade) ----------

  private nearby(): string {
    const d = (p: { x: number; z: number }) => Math.hypot(this.me.x - p.x, this.me.z - p.z);
    if (this.me.act === "fish") return "fishing";
    for (const n of this.townsfolk) if (d(n) < NPC_TALK_RANGE) return `npc:${n.id}`;
    if (d(PL.trailhead) < PORTAL_RADIUS + 2) return "race";
    if (d(PL.outfitter) < PL.outfitter.r + 4.5) return "shop";
    if (d(PL.dock) < 6.5) return "canoe";
    if (d(PL.lodge) < PL.lodge.r + 5) return "lodge";
    if (d(PL.arcade) < PL.arcade.r + 4.5) return "arcade";
    if (d(PL.hotSpring) < 6) return "hotSpring";
    if (d(TOWN_PLACES.clubhouse) < 8) return "golf";
    if (d(TOWN_PLACES.wordlodge) < 7) return "wordlodge";
    if (d(TOWN_PLACES.gondola) < 7) return "gondola";
    if (d(TOWN_PLACES.dyeshop) < 5) return "dyeshop";
    if (d(TOWN_PLACES.cottageLane) < 4.5) return "lane";
    if (inGarden(this.me.x, this.me.z)) return "garden";
    for (const g of ["hunt", "logroll", "snowball", "dam"] as MiniGame[]) {
      const sp = (TOWN_PLACES as Record<string, { x: number; z: number }>)[GAME_SPOTS[g]];
      if (sp && d(sp) < (g === "snowball" ? 11 : 8) && !(g === "snowball" && this.me.act === "skate")) {
        // The rink offers skating too: the game shows on the action bar's second button.
        return `game:${g}`;
      }
    }
    if (d(TOWN_PLACES.station) < 9) return "station";
    if (d(TOWN_PLACES.balloons) < 11) return "balloons";
    const place = visitedPlace(this.me.x, this.me.z);
    if (place && (PLACE_ACTS[place] || INFO[place]?.label)) return place;
    if (fishingSpot(this.me.x, this.me.z) && this.groundY(this.me) >= WATER_Y - 0.2) return "fish";
    return "";
  }

  /** A second, smaller action for places that offer two things (the rink: skate or snowball fight…). */
  private secondary(k: string): { label: string; run: () => void } | null {
    if (k === "game:snowball") return { label: this.me.act === "skate" ? "⛸️ Stop skating" : "⛸️ Go skating", run: () => this.ctx.net.send({ t: "act", a: this.me.act === "skate" ? "stop" : "skate" }) };
    if (k === "game:logroll") return { label: "🗼 Look out over the lake", run: () => toast(this.root, INFO.lighthouse.lines[Math.floor(Math.random() * INFO.lighthouse.lines.length)]) };
    if (k === "game:hunt") return { label: "🔥 Toast a marshmallow", run: () => this.ctx.net.send({ t: "act", a: "marshmallow" }) };
    if (k.startsWith("game:")) return { label: "🏆 Leaderboard", run: () => this.openLife("leaderboard", k.slice(5) as MiniGame) };
    if (k === "golf") return { label: "🏆 Golf leaderboard", run: () => this.openLife("leaderboard", "golf") };
    if (k === "garden") return { label: "🧺 Bag", run: () => this.openLife("bag") };
    if (k === "library") return { label: "📖 Journal", run: () => this.openLife("journal") };
    return null;
  }

  private runAction() {
    const k = this.nearby();
    if (k === "race") this.ctx.net.send(this.queueInfo ? { t: "leaveQueue" } : { t: "queueRace" });
    if (k === "race" && this.queueInfo) this.queueInfo = null;
    if (k === "canoe") this.ctx.net.send(this.queueInfo ? { t: "leaveQueue" } : { t: "queueRace", game: "canoe" });
    if (k === "canoe" && this.queueInfo) this.queueInfo = null;
    if (k.startsWith("game:")) {
      const g = k.slice(5) as MiniGame;
      this.ctx.net.send(this.queueInfo ? { t: "leaveQueue" } : { t: "queueGame", game: g });
      if (this.queueInfo) this.queueInfo = null;
    }
    if (k === "shop") this.openShop("hat");
    if (k === "dyeshop") this.openShop("dye");
    if (k === "arcade") this.openLife("leaderboard", "hunt");
    if (k === "golf") {
      if (this.queueInfo) { this.ctx.net.send({ t: "golfQuit" }); this.queueInfo = null; } else this.openLife("golf");
    }
    if (k === "wordlodge") this.openLife("wordlodge");
    if (k === "garden") this.openLife("garden");
    if (k === "lane") this.openLife("neighbours");
    if (k === "library") this.ctx.net.send({ t: "read" });
    if (k === "fish") {
      this.target = null;
      // Turn to face the water before casting.
      let best = this.me.tr, low = Infinity;
      for (let i = 0; i < 24; i++) {
        const a = (i / 24) * Math.PI * 2;
        const hgt = heightAt(this.me.x + Math.sin(a) * 4, this.me.z + Math.cos(a) * 4);
        if (hgt < low) { low = hgt; best = a; }
      }
      this.me.tr = best;
      this.ctx.net.send({ t: "move", x: this.me.x, z: this.me.z, ry: best });
      this.ctx.net.send({ t: "act", a: "fish" });
    }
    if (k === "fishing") this.fishing?.tap();
    if (k === "gondola" && this.gondolaRide < 0) {
      this.target = null;
      this.gondolaRide = 0;
      this.ctx.sound.play("chime");
    }
    if (k.startsWith("npc:")) {
      const id = k.slice(4);
      this.ctx.net.send({ t: "talk", npc: id });
      const tf = this.townsfolk.find((t) => t.id === id);
      if (tf) tf.talkT = 2.5;
    }
    const pa = PLACE_ACTS[k];
    if (pa?.act) {
      if (this.me.act === pa.act) this.ctx.net.send({ t: "act", a: "stop" });
      else {
        this.target = null;
        this.ctx.net.send({ t: "act", a: pa.act });
        if (pa.toast) toast(this.root, pa.toast);
      }
    }
    const info = INFO[k];
    if (info?.lines.length) {
      toast(this.root, info.lines[Math.floor(Math.random() * info.lines.length)], 3600);
      if (k === "post") this.openPhoto();
      if (k === "townHall") this.ctx.sound?.play("bell");
    }
    this.actionKey = "";
  }

  private updateAction() {
    const k = this.nearby();
    let label = "";
    const queueable = k === "race" || k === "canoe" || k.startsWith("game:") || k === "golf";
    if (queueable && this.queueInfo) {
      const s = Math.max(0, Math.ceil((this.queueInfo.until - performance.now()) / 1000));
      label = `⏳ Players ${this.queueInfo.count}/${this.queueInfo.size} · starting in ${s}s · Leave`;
    } else if (k === "race" || k === "canoe") label = k === "race" ? "🛷 Ride Toboggan Rush!" : "🛶 Race the Canoe Dash!";
    else if (this.queueInfo) {
      this.ctx.net.send({ t: "leaveQueue" });
      this.ctx.net.send({ t: "golfQuit" });
      this.queueInfo = null;
    }
    if (!label && k.startsWith("game:")) { const g = ARCADE_INFO[k.slice(5) as MiniGame]; label = `${g.icon} Play ${g.name}!`; }
    if (!label && k === "golf") label = "⛳ Play a round of golf";
    if (k === "shop") label = "🎒 Open the Outfitter";
    if (k === "dyeshop") label = "🎨 Open the dye station";
    if (k === "arcade") label = "🕹️ Arcade high scores";
    if (k === "wordlodge") label = "📚 Go into the Word Lodge";
    if (k === "garden") label = "🥕 Tend your garden";
    if (k === "lane") label = "🏡 Cottage Lane noticeboard";
    if (k === "library") label = "📚 Read a Banff fact";
    if (k === "fish") label = "🎣 Go fishing";
    if (k === "fishing") label = "🎣 Reel in!";
    if (k === "gondola") label = this.gondolaRide >= 0 ? "🚡 Riding up…" : "🚡 Ride the gondola to the summit";
    if (k.startsWith("npc:")) {
      const n = this.townsfolk.find((t) => t.id === k.slice(4));
      if (n) label = `🗨️ Talk to ${n.name}`;
    }
    const pa = PLACE_ACTS[k];
    if (pa) label = this.me.act === pa.act ? pa.done ?? "✋ Done" : pa.label;
    if (k === "station" && this.me.act === "train" && this.me.board && Date.now() < this.me.board.at) label = `🚉 Next train in ${Math.ceil((this.me.board.at - Date.now()) / 1000)}s · Leave`;
    if (INFO[k]?.label && k !== "library") label = INFO[k].label;
    const sec = this.secondary(k);
    const key = label + (sec?.label ?? "");
    if (key === this.actionKey) return;
    this.actionKey = key;
    const hot = k === "race" || k === "canoe" || k.startsWith("game:") || k === "golf";
    this.actionEl.replaceChildren(...(label ? [
      h("div.row", { style: "justify-content:center;flex-wrap:wrap" }, [
        h("button.btn" + (hot ? ".orange" : ""), { onclick: () => this.runAction(), style: "font-size:19px;padding:12px 20px" }, label),
        sec ? h("button.btn.cream.small", { onclick: () => { sec.run(); this.actionKey = ""; } }, sec.label) : null,
      ]),
    ] : []));
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
    const fz0 = this.drawPos(this.me);
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
    // On a street with a fixed angled camera, "forward" runs straight up the road.
    const ctrlYaw = streetYaw(fz0.x, fz0.z, this.yaw) ?? this.yaw;
    const fx = -Math.sin(ctrlYaw), fz = -Math.cos(ctrlYaw);
    let mx = 0, mz = 0;
    if (inp.down("w", "arrowup")) { mx += fx; mz += fz; }
    if (inp.down("s", "arrowdown")) { mx -= fx; mz -= fz; }
    if (inp.down("d", "arrowright")) { mx += -fz; mz += fx; }
    if (inp.down("a", "arrowleft")) { mx -= -fz; mz -= fx; }
    if (this.joystick && (this.joystick.x || this.joystick.y)) {
      const jx = this.joystick.x, jy = this.joystick.y;
      mx += fx * jy - fz * jx;
      mz += fz * jy + fx * jx;
    }
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

    // Footsteps: the sound depends on what you're walking on.
    if (me.moving > 0.5) {
      const ph = Math.floor(me.walk / Math.PI);
      if (ph !== this.stepPhase) {
        this.stepPhase = ph;
        const onWood = dockHeightAt(me.x, me.z) !== null || bridgeHeightAt(me.x, me.z) !== null;
        const r0 = Math.hypot(me.x, me.z);
        const stone = r0 < 13.5 || (Math.abs(me.z) < 2.9 && me.x < -12 && me.x > -94) || Math.hypot(me.x - TOWN_PLACES.bandstand.x, me.z - TOWN_PLACES.bandstand.z) < 10;
        const snow = me.z < PL.trailhead.z - 4 && heightAt(me.x, me.z) > 1.2;
        this.ctx.sound.play(onWood ? "step-wood" : snow ? "step-snow" : stone ? "step-stone" : "step-grass", 0.8);
      }
    }
    {
      const prox = Ambient.proximity(me.x, me.z, this.world.fires);
      this.ctx.sound.setNight(this.night);
      if (this.mood) this.ctx.sound.setRain(this.mood.weather.kind === "rain" ? this.mood.weather.amount : 0);
      this.ctx.sound.updateAmbience(prox.water, prox.fire, dt);
    }

    // Golden pinecones: walk into one to pick it up.
    for (const c of this.cones) {
      if (this.conesGot.has(c.id) || this.conePending.has(c.id)) continue;
      if (Math.hypot(c.x - me.x, c.z - me.z) < 1.6) {
        this.conePending.add(c.id);
        this.ctx.net.send({ t: "collect", id: c.id });
        this.ctx.sound.play("chime");
      }
    }

    this.updateLife(dt);

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

  /** Townsfolk, bugs to spot, pets, the gondola ride and timed rides ending. */
  private updateLife(dt: number) {
    const me = this.me;
    const now = Date.now();
    // The gondola: a short ride up in a cabin, then the summit.
    if (this.gondolaRide >= 0) {
      this.gondolaRide += dt / 4;
      if (this.gondolaRide >= 1) {
        this.gondolaRide = -1;
        this.ctx.net.send({ t: "gondola", up: true });
      }
    }
    // Rides end on their own: one loop of the valley by train, a balloon flight.
    if (me.act === "train" && me.board && now > me.board.at + TRAIN_LOOP_S * 1000) {
      this.ctx.net.send({ t: "act", a: "stop" });
      me.act = null;
      toast(this.root, "🚉 Back at the station. What a ride!");
    }
    if (me.act === "balloon" && me.actT > BALLOON_S) {
      this.ctx.net.send({ t: "act", a: "stop" });
      me.act = null;
      toast(this.root, "🎈 A gentle landing. Lovely flight!");
    }
    // Townsfolk turn to face you when you're close.
    for (const n of this.townsfolk) {
      n.talkT = Math.max(0, n.talkT - dt);
      const d = Math.hypot(me.x - n.x, me.z - n.z);
      n.face = lerpAngle(n.face, d < 7 ? Math.atan2(me.x - n.x, me.z - n.z) : n.ry, Math.min(1, dt * 4));
    }
    // Butterflies by day and fireflies at night flutter by now and then: tap one to spot it.
    this.bugAcc -= dt;
    if (this.bugAcc <= 0 && this.bugs.length < 2) {
      this.bugAcc = 14 + Math.random() * 16;
      const season = this.mood?.season ?? seasonAt(), night = isNight();
      const ok = BUGS.filter((b) => (!b.seasons || b.seasons.includes(season)) && (!b.night || night) && (!b.day || !night));
      if (ok.length && this.mood?.weather.kind !== "rain") {
        const b = ok[Math.floor(Math.random() * ok.length)];
        const a = Math.random() * Math.PI * 2;
        const x = me.x + Math.cos(a) * 7, z = me.z + Math.sin(a) * 7;
        const id = ++this.bugId;
        const el = h("div.bug-tap.pe", { title: "Tap to spot it!", onclick: () => this.spot(id) }, b.icon);
        this.labels.append(el);
        this.bugs.push({ id, kind: b.id, x, y: heightAt(x, z) + 1.4, z, t: 0, vx: (Math.random() - 0.5) * 1.2, vz: (Math.random() - 0.5) * 1.2, el });
      }
    }
    for (const b of this.bugs) {
      b.t += dt;
      b.x += (b.vx + Math.sin(b.t * 1.7 + b.id) * 0.9) * dt;
      b.z += (b.vz + Math.cos(b.t * 1.3 + b.id) * 0.9) * dt;
      b.y = heightAt(b.x, b.z) + 1.2 + Math.sin(b.t * 2.3) * 0.4;
    }
    for (const b of this.bugs.filter((x) => x.t > 22)) b.el.remove();
    this.bugs = this.bugs.filter((x) => x.t <= 22);
    // Pets trot after their owners.
    for (const a of this.avatars.values()) {
      const pet = a.info.look.pet;
      if (!pet) { a.pet = null; continue; }
      const d = this.drawPos(a);
      if (!a.pet) a.pet = new PetFollower(d.x - 1, d.z - 1);
      a.pet.update(dt, d.x, d.z, d.ry);
    }
  }

  private spot(id: number) {
    const b = this.bugs.find((x) => x.id === id);
    if (!b) return;
    if (Math.hypot(b.x - this.me.x, b.z - this.me.z) > 14) { toast(this.root, "Get a little closer to see it properly!"); return; }
    this.ctx.net.send({ t: "spot", bug: b.kind });
    this.ctx.sound.play("chime");
    buzz(this.ctx, 20);
    b.el.remove();
    this.bugs = this.bugs.filter((x) => x !== b);
  }

  private animate(dt: number) {
    const me = this.me;
    this.ambient.update(dt, this.time, this.night);
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
        if (a.act && HELD[a.act] && a.act !== "guitar" && a.act !== "fish" && a.actT > 14) a.act = null;
      }
      const away = !!a.act && AWAY_ACTS.includes(a.act);
      a.soak = Math.max(0, Math.min(1, a.soak + (away ? dt / 0.7 : -dt / 0.5)));
      if ((a.act === "guitar" || a.act === "sing" || a.act === "dance") && Math.floor(a.actT / 1.1) !== Math.floor((a.actT - dt) / 1.1)) {
        const el = h("div.emote", {}, Math.random() < 0.5 ? "🎵" : "🎶");
        this.labels.append(el);
        (el as HTMLElement & { _follow?: Avatar })._follow = a;
        setTimeout(() => el.remove(), 1600);
      }
      if ((a.act === "cocoa" || a.act === "marshmallow") && Math.random() < dt * 5) {
        const p = this.mugPos(a);
        this.particles.push({ x: p[0] + (Math.random() - 0.5) * 0.08, y: p[1] + 0.2, z: p[2] + (Math.random() - 0.5) * 0.08, vx: 0.05, vy: 0.45, vz: 0, life: 0, max: 1.1, color: [1, 1, 1], size: 0.09 });
      }
      if (a.act === "soak" && a.soak > 0.9 && Math.random() < dt * 1.5) {
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

  /** Where an avatar is drawn: normally where it stands, but in the spring, on the wheel, on the ice or up the tower during those activities. */
  private drawPos(a: Avatar): { x: number; y: number; z: number; ry: number; seated: number } {
    const y = this.groundY(a);
    if (a.soak <= 0) return { x: a.x, y, z: a.z, ry: a.ry, seated: 0 };
    let tx = a.x, ty = y, tz = a.z, tr = a.ry, seated = 0;
    const act = a.act ?? a.lastAway;
    if (act === "soak") {
      const cx = PL.hotSpring.x, cz = PL.hotSpring.z;
      const ang = Math.atan2(a.actX - cx, a.actZ - cz);
      tx = cx + Math.sin(ang) * 1.2; tz = cz + Math.cos(ang) * 1.2;
      ty = SPRING_Y() - 0.42 + Math.sin(this.time * 1.4 + a.seed) * 0.04;
      tr = ang;
    } else if (act === "ride" && this.world.ferris) {
      const fw = this.world.ferris;
      const p = ferrisSeat(fw, Math.floor(a.seed * 10) % fw.seats, this.time);
      tx = p[0]; ty = p[1] - 1.12; tz = p[2]; tr = fw.ry; seated = 1;
    } else if (act === "train") {
      const b = a.board;
      const now = Date.now();
      if (!b || now < b.at) {
        // Waiting on the platform for the next train.
        const p = railPoint(TRAIN.stationAngle + (a.seed % 1) * 0.03 - 0.015, -2.6);
        tx = p[0]; tz = p[2]; ty = heightAt(TOWN_PLACES.station.x, TOWN_PLACES.station.z) + 0.6;
        tr = TRAIN.stationAngle + Math.PI / 2;
      } else {
        const u = trainUnit(b.car, now, b.which);
        tx = u.x; tz = u.z; ty = u.y + 0.85; tr = u.yaw + Math.PI / 2 * (a.seed % 1 > 0.5 ? 1 : -1); seated = 1;
      }
    } else if (act === "balloon") {
      const p = this.balloonPos(a);
      tx = p[0]; ty = p[1] + 0.25; tz = p[2]; tr = a.actT * 0.2 + a.seed;
    } else if (act === "skate") {
      const rink = TOWN_PLACES.rink;
      // Pair skating: two beavers on the ice glide round together, side by side.
      const skaters = [...this.avatars.values()].filter((o) => o.act === "skate").sort((p, q) => (p.info.id < q.info.id ? -1 : 1));
      const si = skaters.indexOf(a);
      const partner = si >= 0 ? skaters[si ^ 1] : undefined;
      const lead = partner && si % 2 === 1 ? partner : a;
      const rr = (3.2 + (Math.floor(lead.seed * 10) % 3) * 0.9) + (partner && si % 2 === 1 ? 1.0 : 0);
      const ang = (partner ? this.time * 0.7 : a.actT * 0.7) + lead.seed * 3;
      tx = rink.x + Math.cos(ang) * rr; tz = rink.z + Math.sin(ang) * rr;
      ty = heightAt(rink.x, rink.z) + 0.12;
      tr = Math.atan2(-Math.sin(ang), Math.cos(ang));
    } else if (act === "climb") {
      const lk = TOWN_PLACES.lookout;
      const ang = Math.atan2(a.actX - lk.x, a.actZ - lk.z);
      tx = lk.x + Math.sin(ang) * 3.25; tz = lk.z + Math.cos(ang) * 3.25;
      ty = heightAt(lk.x, lk.z) + 12.25;
      tr = ang;
    }
    const k = a.soak, e = k * k * (3 - 2 * k);
    const hop = act === "train" || act === "balloon" ? 0 : Math.sin(Math.min(1, k * 1.15) * Math.PI) * (act === "soak" ? 1.3 : 0.6);
    return { x: lerp(a.x, tx, e), z: lerp(a.z, tz, e), y: lerp(y, ty, e) + hop, ry: lerpAngle(a.ry, tr, e), seated: seated * e };
  }

  /** A balloon flight: lift off from the meadow, drift in a big loop over the town, then land. */
  private balloonPos(a: Avatar): Vec3 {
    const m = TOWN_PLACES.balloons;
    const t = a.actT;
    const g = heightAt(m.x, m.z);
    const up = Math.min(1, t / 10), down = Math.max(0, Math.min(1, (BALLOON_S - t) / 10));
    const alt = 34 * Math.min(up, down) * Math.min(up, down) * (3 - 2 * Math.min(up, down));
    const loop = Math.max(0, Math.min(1, (t - 6) / (BALLOON_S - 16)));
    const ang = Math.atan2(m.z, m.x) + loop * Math.PI * 2;
    const R0 = Math.hypot(m.x, m.z);
    const rad = R0 + Math.sin(loop * Math.PI) * -25;
    const off = (a.seed % 1) * 3;
    return [Math.cos(ang) * rad + off, g + alt, Math.sin(ang) * rad];
  }

  /** The cocoa mug in world space: at the chest, rising to the mouth for a sip every few seconds. */
  private sipAmount(a: Avatar) {
    const c = (a.actT % 3.6) / 3.6;
    return a.actT < 0.6 ? 0 : c > 0.62 && c < 0.92 ? Math.sin(((c - 0.62) / 0.3) * Math.PI) : 0;
  }

  private mugPos(a: Avatar): Vec3 {
    const d = this.drawPos(a);
    const sip = a.act === "marshmallow" || a.act === "guitar" ? 0 : this.sipAmount(a);
    if (a.act === "marshmallow") return [d.x + Math.sin(d.ry) * 0.62, d.y + 0.95, d.z + Math.cos(d.ry) * 0.62];
    // Cradled between the paws at the chest; raised to the mouth for a sip.
    const up = 1.0 + sip * 0.3, fwd = 0.62 + sip * 0.05;
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
    this.night = applyTimeOfDay(r, dayPhase(this.ctx.prefs.time));
    this.mood = currentMood(this.ctx.prefs);
    applyMood(r, this.mood);
    // Follow where the beaver is drawn (on the Ferris wheel, up the lookout, out on the ice…).
    const fp = this.drawPos(me);
    if (this.gondolaRide >= 0) {
      const g = gondolaPoint(this.gondolaRide * 0.4);
      fp.x = g[0]; fp.y = g[1] - 3; fp.z = g[2];
    }
    const py = fp.y;
    const focus = { x: fp.x, z: fp.z };
    // A simple follow camera: it sits behind and above your beaver at a fixed angle and
    // moves exactly as you move. You turn it (drag / Q E) and zoom it (scroll); nothing else
    // pushes it around. The angle is high enough to see over fences, trees and benches.
    const now = performance.now();
    const fdt = Math.min(0.1, (now - this.lastRender) / 1000);
    this.lastRender = now;
    const pitch = 0.36 + (this.dist - 7) * 0.012;
    const sx = Math.sin(this.yaw), sz = Math.cos(this.yaw);
    const flat = Math.cos(pitch) * this.dist;
    const cx = focus.x + sx * flat, cz = focus.z + sz * flat;
    // Only the height is eased, so a hop or a step onto the bridge doesn't jolt the view.
    if (!Number.isFinite(this.camY) || Math.abs(this.camY - py) > 6) this.camY = py;
    this.camY += (py - this.camY) * Math.min(1, fdt * 6);
    const focusY = this.camY + 1.5;
    const cy = Math.max(focusY + Math.sin(pitch) * this.dist, heightAt(cx, cz) + 1.2, this.gondolaRide >= 0 ? focusY + 3 : -Infinity);
    let cam: Vec3 = [cx, cy, cz];
    let look: Vec3 = [focus.x, focusY + this.lookOffset, focus.z];
    if (this.photo.active) {
      const pc = this.photo.camera([focus.x, py + 1.2, focus.z]);
      pc.eye[1] = Math.max(pc.eye[1], heightAt(pc.eye[0], pc.eye[2]) + 0.4, WATER_Y + 0.3);
      cam = pc.eye;
      look = pc.target;
    }
    r.resize();
    const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
    r.shadowFocus = [focus.x, py, focus.z];
    // Anything between the camera and your beaver turns see-through (only on your screen).
    r.cutFocus = this.photo.active ? null : [focus.x, py + 1.1, focus.z];
    // Draw distance: detail fades in as you walk toward it. Up in a balloon you can see the whole valley.
    r.drawDistance = me.act === "balloon" && me.soak > 0.2 ? Infinity : this.ctx.prefs.renderDist ?? 110;
    r.begin(lookAt(cam, look), perspective(aspect < 0.8 ? 1.05 : 0.86, aspect, 0.4, 2400), cam);

    drawHub(r, this.world, this.time, this.night);
    this.ambient.draw(r, this.time, this.night);
    drawWeather(r, this.mood, this.time, cam, this.night);
    this.drawNpcs();
    this.drawLife();

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
      const held = a.act ? HELD[a.act] : undefined;
      const sip = held && held !== "marshmallow" && held !== "guitar" ? this.sipAmount(a) : held === "guitar" ? 0.15 + Math.abs(Math.sin(this.time * 9)) * 0.25 : 0;
      // Soft contact shadow keeps beavers planted; the sun adds the real cast shadow.
      if (a.soak < 0.3) r.draw(this.world.shadow, compose(a.x, this.groundY(a) + 0.014, a.z, a.ry, 0, 0, a.swim > 0.5 ? 0.68 : 1), { unlit: true, alpha: a.swim > 0.5 ? 0.03 : 0.07 });
      if (held) {
        const mp = this.mugPos(a);
        if (held === "guitar") r.draw(cozyM.guitar, compose(mp[0], mp[1] - 0.05, mp[2], d.ry, 0.15, 1.1, 1.3), { outline: 0.02 });
        else if (held === "marshmallow") r.draw(cozyM.marshmallow, compose(mp[0], mp[1], mp[2], d.ry, -0.35, 0, 1.2), { outline: 0.015 });
        else r.draw(cozyM[held], compose(mp[0], mp[1], mp[2], d.ry, sip * 0.6, 0, held === "mug" ? 1.45 : 1.5), { outline: 0.02 });
      }
      if (a.act === "soak" && a.soak > 0.6 && !a.info.look.hat) {
        // A folded spa towel balanced on the head.
        r.draw(cozyM.towel, compose(d.x, y + 2.12 + Math.sin(this.time * 1.4 + a.seed) * 0.02, d.z, d.ry + 0.2, 0, 0.08), { outline: 0.02 });
      }
      // Umbrellas come out in the rain and snow.
      const brolly = !held && !a.act && a.swim < 0.5 && umbrellaWeather(this.mood) > 0.3;
      if (a === me && this.gondolaRide >= 0) continue; // drawn inside the gondola cabin
      const dancing = a.act === "dance", singing = a.act === "sing";
      if (a.act === "balloon") {
        const bp = this.balloonPos(a);
        r.draw(this.world.balloons[Math.floor(a.seed * 10) % this.world.balloons.length], compose(bp[0], bp[1], bp[2], a.actT * 0.2 + a.seed), { cut: true });
      }
      if (brolly) r.draw(umbrellaMesh(r, a.seed), compose(d.x + Math.sin(d.ry) * 0.35, y + 3.05, d.z + Math.cos(d.ry) * 0.35, d.ry, -0.12, Math.sin(this.time * 1.3 + a.seed) * 0.05), { outline: 0.02 });
      const danceT = this.time * 4 + a.seed;
      drawBeaver(r, getBeaverMeshes(r, a.info.look), compose(d.x, y + (dancing ? Math.abs(Math.sin(danceT)) * 0.25 : 0), d.z, d.ry + (dancing ? Math.sin(danceT * 0.5) * 0.9 : 0)), {
        hold: held ? (held === "rod" ? 0.6 : 1) : brolly ? 0.45 : 0, sip, sled: d.seated,
        walk: a.act === "skate" ? this.time * 3 : a.walk, moving: a.act === "skate" ? 0.45 : a.moving, swim: a.act === "soak" ? 0 : a.swim, time: this.time, seed: a.seed,
        jump: posed ? pose.jump : Math.sin(a.jumpT * Math.PI) * (a.jumpT > 0 ? 1 : 0),
        wave: posed ? pose.wave : Math.min(1, a.waveT),
        cheer: posed ? pose.cheer : dancing ? (Math.sin(danceT) > 0 ? 1 : 0.3) : Math.min(1, a.cheerT * 2),
        talk: singing ? 1 : a.talkT > 0 ? 1 : 0,
        expr: posed ? pose.expr : a.exprT > 0 ? a.expr : dancing || singing || a.soak > 0.6 || sip > 0.3 || a.swim > 0.5 || a.waveT > 0 ? "happy" : "neutral",
      });
      if (held === "rod") {
        // Line out to a bobber on the water.
        const bx = d.x + Math.sin(d.ry) * 3.2, bz = d.z + Math.cos(d.ry) * 3.2;
        const bite = a === me && this.fishing && (this.root.querySelector(".fishing.bite") !== null);
        r.draw(cozyM.bobber, compose(bx, WATER_Y + (bite ? -0.15 : Math.sin(this.time * 2) * 0.03), bz), { outline: 0.01 });
      }
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
    this.updateMinimap();
  }

  private updateMinimap() {
    const dots: { x: number; z: number; kind: "player" | "friend" | "cone" | "npc" }[] = [];
    for (const n of this.townsfolk) dots.push({ x: n.x, z: n.z, kind: "npc" });
    this.minimap.shapes = this.ctx.prefs.shapes;
    for (const c of this.cones) if (!this.conesGot.has(c.id)) dots.push({ x: c.x, z: c.z, kind: "cone" });
    const friends = new Set(this.ctx.state.friends.map((f) => f.pid));
    for (const a of this.avatars.values()) {
      if (a === this.me) continue;
      dots.push({ x: a.x, z: a.z, kind: a.info.pid && friends.has(a.info.pid) ? "friend" : "player" });
    }
    this.minimap.update(performance.now(), { x: this.me.x, z: this.me.z, ry: this.me.ry }, this.yaw, dots);
    const t = timeLabel(dayPhase(this.ctx.prefs.time));
    const mood = this.mood ?? currentMood(this.ctx.prefs);
    const si = SEASON_INFO[mood.season], wi = WEATHER_INFO[mood.weather.kind];
    const key = `${t.icon}${t.name}${t.clock}${si.icon}${wi.icon}`;
    if (key !== this.clockKey) {
      this.clockKey = key;
      this.clockEl.textContent = `${si.icon}${wi.icon ? " " + wi.icon : ""} ${t.icon} ${t.clock}`;
      this.clockEl.title = `${si.name} · ${wi.name} · ${t.name} · one full day lasts 25 minutes`;
    }
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
    // Place names only pop up when you're nearby (the minimap shows the rest).
    const me = this.drawPos(this.me);
    this.world.labels.forEach((l, i) => {
      const el = this.placeEls[i];
      const d = Math.hypot(l.x - me.x, l.z - me.z);
      const near = 22, fade = 6;
      if (d > near + fade) { el.style.display = "none"; return; }
      el.style.opacity = String(Math.min(1, (near + fade - d) / fade));
      place(el, l.x, heightAt(l.x, l.z) + l.y, l.z, 110);
    });
    for (const a of this.avatars.values()) {
      const d = this.drawPos(a);
      place(a.tag, d.x, d.y + 2.75, d.z, 45);
      if (a.bubble) place(a.bubble, d.x, d.y + 3.5, d.z, 90);
    }
    for (const el of this.labels.querySelectorAll<HTMLElement & { _follow?: Avatar; _at?: Vec3 }>(".emote")) {
      const a = el._follow;
      if (a) {
        const d = this.drawPos(a);
        place(el, d.x, d.y + 3.2, d.z);
      } else if (el._at) place(el, el._at[0], el._at[1], el._at[2], 60);
    }
  }

  /** Townsfolk, bugs, garden plants, pets and the gondola ride. */
  private drawLife() {
    const r = this.ctx.r;
    const cz = cozy(r);
    const life = this.ctx.state.life;
    for (const n of this.townsfolk) {
      const y = heightAt(n.x, n.z);
      drawBeaver(r, getBeaverMeshes(r, n.look), compose(n.x, y, n.z, n.face), {
        walk: 0, moving: 0, swim: 0, jump: 0, wave: n.talkT > 2 ? 1 : 0, sled: 0, time: this.time, seed: n.x * 0.1,
        talk: n.talkT > 0 ? 1 : 0, expr: n.talkT > 0 ? "happy" : "neutral", hold: n.id === "bea" ? 0.3 : 0,
      });
      r.draw(this.world.shadow, compose(n.x, y + 0.014, n.z, n.face), { unlit: true, alpha: 0.07 });
      // A "!" over townsfolk with something new for you.
      const st = life?.npcs[n.id];
      const ch = CHAINS[n.id];
      const step = st && st.step >= 0 && !st.done ? ch.steps[st.step] : null;
      const has = !st || st.step < 0 || (step?.kind === "bring" && (life?.bag[step.item] ?? 0) >= step.count)
        || Object.entries(life?.npcs ?? {}).some(([oid, o]) => { const s2 = !o.done && o.step >= 0 ? CHAINS[oid].steps[o.step] : null; return s2?.kind === "talk" && s2.npc === n.id; });
      let mark = this.npcMarks.get(n.id);
      if (!mark) { mark = h("div.npc-mark", {}, "!"); this.labels.append(mark); this.npcMarks.set(n.id, mark); }
      mark.textContent = has ? "!" : st?.done ? "" : "…";
      const sp = r.project(n.x, y + 3.1, n.z);
      const near = Math.hypot(this.me.x - n.x, this.me.z - n.z) < 40;
      if (!sp || !near || !mark.textContent) mark.style.display = "none";
      else { mark.style.display = ""; mark.style.left = `${sp.x}px`; mark.style.top = `${sp.y}px`; }
    }
    // Bugs fluttering about.
    for (const b of this.bugs) {
      const def = BUGS.find((x) => x.id === b.kind);
      const flap = Math.sin(this.time * 22 + b.id) * 0.9;
      const col: [number, number, number, number] = b.kind === "firefly" ? [1, 0.95, 0.4, 1] : b.kind === "ladybug" ? [0.9, 0.2, 0.15, 1] : b.kind === "monarch" ? [1, 0.55, 0.1, 1] : b.kind === "blue" ? [0.55, 0.75, 1, 1] : b.kind === "cloak" ? [0.35, 0.2, 0.15, 1] : b.kind === "dragonfly" ? [0.3, 0.8, 0.9, 1] : [1, 0.9, 0.5, 1];
      r.draw(cz.bug, compose(b.x, b.y, b.z, b.t * 2, 0, flap * 0.5, 1.3), { unlit: true, tint: col, emissive: b.kind === "firefly" ? 1.2 : 0.1 });
      const s = r.project(b.x, b.y, b.z);
      if (s && s.depth < 40) { b.el.style.display = ""; b.el.style.left = `${s.x}px`; b.el.style.top = `${s.y}px`; } else b.el.style.display = "none";
      void def;
    }
    // Your garden plots (everyone grows their own; you see yours).
    const g = life?.garden ?? [];
    const now = Date.now();
    g.forEach((p, i) => {
      if (!p) return;
      const x = TOWN_PLACES.garden.x + ((i % 2) - 0.5) * 4.2, z = TOWN_PLACES.garden.z + (Math.floor(i / 2) - 0.5) * 4.2;
      const y = heightAt(x, z) + 0.45;
      const total = SEEDS[p.seed].minutes * 60_000 * (p.watered ? 0.6 : 1);
      const grow = Math.max(0, Math.min(1, 1 - (p.readyAt - now) / total));
      for (let k = 0; k < 4; k++) {
        const px = x + ((k % 2) - 0.5) * 1.0, pz = z + (Math.floor(k / 2) - 0.5) * 0.9;
        if (grow < 0.35) r.draw(cz.sprout, compose(px, y, pz, k, 0, 0, 0.8 + grow * 2), { sway: 0.1 });
        else r.draw(cz.plant, compose(px, y, pz, k, 0, 0, 0.4 + grow * 0.9), { sway: 0.15 });
        if (grow >= 1) r.draw(this.world.steam, compose(px, y + 0.9, pz, 0, 0, 0, 0.16), { unlit: true, emissive: 0.6, tint: p.seed === "pumpkin" ? [1, 0.55, 0.15, 1] : p.seed === "blueberry" ? [0.35, 0.4, 0.9, 1] : p.seed === "carrot" ? [1, 0.5, 0.1, 1] : p.seed === "sunflower" ? [1, 0.85, 0.2, 1] : [0.6, 0.45, 0.95, 1] });
      }
    });
    // Pets.
    for (const a of this.avatars.values()) {
      if (!a.pet || !a.info.look.pet || a.soak > 0.5) continue;
      const mesh = petMesh(r, a.info.look.pet);
      if (mesh) a.pet.draw(r, mesh, Math.max(heightAt(a.pet.x, a.pet.z), bridgeHeightAt(a.pet.x, a.pet.z) ?? -Infinity, dockHeightAt(a.pet.x, a.pet.z) ?? -Infinity), isFlyingPet(a.info.look.pet));
    }
    // Riding up in the gondola.
    if (this.gondolaRide >= 0) {
      const gp = gondolaPoint(this.gondolaRide * 0.4);
      const yaw = Math.atan2(54 - 18, -168 + 53);
      r.draw(this.world.liftCabin, compose(gp[0], gp[1], gp[2], yaw), {});
      drawBeaver(r, getBeaverMeshes(r, this.me.info.look), compose(gp[0], gp[1] - 3.05, gp[2], yaw + Math.PI), { walk: 0, moving: 0, swim: 0, jump: 0, wave: 1, sled: 0, time: this.time, seed: 1, expr: "excited" });
    }
  }

  private drawNpcs() {
    const r = this.ctx.r;
    const cz = cozy(r);
    let skater = 0;
    for (const n of this.npcs) {
      if (n.kind === "busker") {
        const y = heightAt(n.x, n.z) + 0.38;
        const strum = 0.15 + Math.abs(Math.sin(this.time * 7)) * 0.25;
        drawBeaver(r, getBeaverMeshes(r, n.look), compose(n.x, y, n.z, n.ry), { walk: 0, moving: 0, swim: 0, jump: 0, wave: 0, sled: 1, time: this.time, seed: n.seed, hold: 1, sip: strum, expr: Math.sin(this.time * 0.6) > 0 ? "happy" : "neutral" });
        r.draw(cz.guitar, compose(n.x + Math.sin(n.ry) * 0.62, y + 0.9, n.z + Math.cos(n.ry) * 0.62, n.ry, 0.15, 1.1, 1.3), { outline: 0.02 });
        if (Math.floor(this.time / 1.4) !== Math.floor((this.time - 1 / 60) / 1.4) && Math.hypot(this.me.x - n.x, this.me.z - n.z) < 30) {
          const el = h("div.emote", {}, Math.random() < 0.5 ? "🎵" : "🎶");
          this.labels.append(el);
          (el as HTMLElement & { _follow?: Avatar; _at?: Vec3 })._at = [n.x, y + 2.6, n.z];
          setTimeout(() => el.remove(), 1600);
        }
      } else {
        const rink = TOWN_PLACES.rink;
        const ang = this.time * (0.5 + skater * 0.12) + n.seed * 2;
        const rr = 2.2 + skater * 1.4;
        const x = rink.x + Math.cos(ang) * rr, z = rink.z + Math.sin(ang) * rr;
        const y = heightAt(rink.x, rink.z) + 0.12;
        drawBeaver(r, getBeaverMeshes(r, n.look), compose(x, y, z, Math.atan2(-Math.sin(ang), Math.cos(ang))), { walk: this.time * 3, moving: 0.45, swim: 0, jump: 0, wave: skater === 1 && Math.sin(this.time) > 0.7 ? 1 : 0, sled: 0, time: this.time, seed: n.seed, expr: "happy" });
        skater++;
      }
    }
  }

  /** Test hook used by automated browser checks. */
  debugWalkTo(x: number, z: number) {
    this.target = { x, z };
  }

  dispose() {
    this.minimap.dispose();
    this.joystick?.dispose();
    this.photo.dispose();
    window.removeEventListener("keydown", this.onKey);
    this.root.remove();
  }
}
