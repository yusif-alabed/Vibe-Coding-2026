import {
  ARCADE_INFO, BOX, boxCues, DEFAULT_LOOK, FUR_COLORS, hoopMeter, HOOPS, PENS, SPLEEF, TD, tdPoint, TD_PATH_LEN, VOLLEY,
  type ArcadeGame, type BoxMove, type Look, type ServerMsg,
} from "@beaver/shared";
import { compose, hash2, hexToRgb, lerp, lookAt, perspective, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { h } from "../ui/dom";
import { Joystick } from "../ui/joystick";
import { buzz } from "../ui/life";
import { wantsJoystick } from "../prefs";
import { drawBeaver, getBeaverMeshes, type BeaverPose, type Expression } from "./beaver";
import { applyTimeOfDay, dayPhase } from "./daylight";
import { buildMountains } from "./hubWorld";
import { applyMood, currentMood, drawWeather, type WorldMood } from "./weather";
import { spruce } from "./village/nature";
import { buildGymHall } from "./village/gymHall";
import type { Ctx, Scene } from "./scene";

/**
 * The Downtown games, each in an arena modelled on the real thing:
 *  ⛏️ Spleef on a snow-block stage over the pond · 🏰 Fort Timber, a co-op tower defence on the dam path ·
 *  🏐 two-a-side beach volleyball · 🏀 an arcade hoop-shoot row · ⚽ a penalty shootout · 🥊 shadow
 *  boxing in the gym. The server runs the simulation (shared/arcade2.ts); this draws its snapshots and
 *  sends your input, exactly like the village arcade games.
 */

export const DOWNTOWN_GAMES: ArcadeGame[] = ["spleef", "td", "volley", "hoops", "penalty", "shadowbox"];

interface P { id: string; name: string; look: Look; isBot: boolean; x: number; y: number; z: number; ry: number; tx: number; ty: number; tz: number; score: number; tag: HTMLElement; s: any }

const ORD = ["1st", "2nd", "3rd", "4th"];

interface Meshes { ground: GpuMesh; props: GpuMesh; mtn: GpuMesh | null; block: GpuMesh; ball: GpuMesh; puff: GpuMesh; foe: GpuMesh; tower: GpuMesh; head: GpuMesh; cone: GpuMesh; water: GpuMesh | null; glove: GpuMesh }

function raccoon(m: MeshBuilder) {
  m.sphere(compose(0, 0.45, 0, 0, 0, 0, 0.55, 0.42, 0.7), "#8d8a86", 5, 8);
  m.sphere(compose(0, 0.72, 0.55, 0, 0, 0, 0.38, 0.32, 0.34), "#a29f9a", 5, 8);
  m.box(compose(0, 0.76, 0.78, 0, 0, 0, 0.5, 0.12, 0.08), "#2a2522");
  m.sphere(compose(0, 0.66, 0.86, 0, 0, 0, 0.1, 0.08, 0.1), "#1e1a18", 3, 5);
  for (const s of [-1, 1]) m.cone(compose(s * 0.2, 1.0, 0.5, 0, 0, s * 0.3, 0.14, 0.2, 0.1), "#5f5b57", 4);
  for (let i = 0; i < 5; i++) m.sphere(compose(0, 0.6 + i * 0.04, -0.7 - i * 0.18, 0, 0, 0, 0.17), i % 2 ? "#2a2522" : "#a29f9a", 4, 6);
}

function launcher(m: MeshBuilder) {
  m.cylinder(compose(0, 0.35, 0, 0, 0, 0, 1.3, 0.7, 1.3), "#8a5a34", 8);
  m.cylinder(compose(0, 0.75, 0, 0, 0, 0, 1.0, 0.12, 1.0), "#5b3a24", 8);
}

function launcherHead(m: MeshBuilder) {
  // A little catapult arm with a pinecone in the cup, pointing along +z.
  m.box(compose(0, 1.0, 0, 0, -0.5, 0, 0.16, 0.16, 1.3), "#6b4426");
  m.sphere(compose(0, 1.35, 0.55, 0, 0, 0, 0.26, 0.14, 0.26), "#3a2618", 4, 6);
  m.sphere(compose(0, 1.45, 0.55, 0, 0, 0, 0.16, 0.22, 0.16), "#c47a2c", 4, 6);
}

function pinecone(m: MeshBuilder) {
  m.sphere(compose(0, 0, 0, 0, 0, 0, 0.18, 0.26, 0.18), "#c47a2c", 4, 6);
}


/** Crowds, lights and set dressing round each arena, so every game feels like somewhere real. */
function dressArena(game: ArcadeGame, ground: MeshBuilder, props: MeshBuilder) {
  const crowdCol = ["#c8473a", "#2f6fb0", "#f5c242", "#3f8a5a", "#ff7eb3", "#ffffff", "#8a5a34"];
  /** A row of seated spectator beavers (simple rounded bodies with scarves). */
  const crowd = (x0: number, x1: number, y: number, z: number, ry: number, seed: number) => {
    for (let x = x0; x < x1; x += 0.75) {
      const h = hash2(x * 3, seed);
      if (h < 0.18) continue;
      const fur = ["#6b4a2c", "#8a5a3b", "#c48a52", "#9a8f86"][Math.floor(h * 4)];
      props.sphere(compose(x, y + 0.35, z, ry, 0, 0, 0.28, 0.34, 0.26), fur, 4, 6);
      props.sphere(compose(x, y + 0.82, z, ry, 0, 0, 0.22, 0.21, 0.21), fur, 4, 6);
      props.box(compose(x, y + 0.6, z + Math.cos(ry) * 0.18, ry, 0, 0, 0.42, 0.08, 0.08), crowdCol[Math.floor(hash2(seed, x) * crowdCol.length)]);
    }
  };
  if (game === "spleef") {
    // Snowbanks, lantern posts and pennant strings round the frozen pond; a crowd on the far bank.
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2, r = 15 + hash2(i, 9) * 2;
      props.sphere(compose(Math.cos(a) * r, -5.4, Math.sin(a) * r, a, 0, 0, 2.4, 0.9, 1.6), "#f4f8fb", 5, 8);
    }
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2, r = 13;
      props.box(compose(Math.cos(a) * r, -4.4, Math.sin(a) * r, 0, 0, 0, 0.18, 2.4, 0.18), "#5b3a24");
      props.sphere(compose(Math.cos(a) * r, -3.1, Math.sin(a) * r, 0, 0, 0, 0.25), "#ffe2a0", 4, 6);
    }
    for (let k = 0; k < 3; k++) crowd(-9, 9, -5.6 + k * 0.6, -14.5 - k * 0.9, 0, 40 + k);
    for (let k = 0; k < 3; k++) props.box(compose(0, -5.75 + k * 0.6, -14.5 - k * 0.9, 0, 0, 0, 19, 0.3, 0.8), "#8a5a34");
  } else if (game === "td") {
    // Flowers along the trail, signposts, and the raccoons' den (a rock pile with a hollow log).
    for (let i = 0; i < 60; i++) {
      const d = hash2(i, 1) * TD_PATH_LEN, [px, pz] = tdPoint(d);
      const side = hash2(i, 2) > 0.5 ? 1 : -1;
      props.sphere(compose(px + side * 1.6, 0.15, pz + side * 0.4, 0, 0, 0, 0.12, 0.12, 0.12), ["#ff7eb3", "#ffd93b", "#ffffff", "#a77bff"][i % 4], 3, 4);
    }
    const [sx, sz] = TD.path[0];
    for (let i = 0; i < 7; i++) props.sphere(compose(sx - 1.5 + (i % 3) * 1.0, 0.5 + Math.floor(i / 3) * 0.6, sz - 2.2 - (i % 2) * 0.6, i, 0, 0, 0.9, 0.7, 0.8), i % 2 ? "#8a8580" : "#9a958e", 4, 6);
    props.cylinder(compose(sx, 0.55, sz - 1.4, 0, 0, Math.PI / 2, 1.1, 2.4, 1.1), "#6b4426", 10);
    props.cylinder(compose(sx + 1.21, 0.55, sz - 1.4, 0, 0, Math.PI / 2, 0.8, 0.04, 0.8), "#2a1a10", 10);
    for (const [x, z] of [[-4, 8], [10, 2], [-10, -4]]) {
      props.box(compose(x, 0.9, z, 0, 0, 0, 0.12, 1.8, 0.12), "#5b3a24");
      props.box(compose(x + 0.4, 1.6, z, 0.3, 0, 0, 0.9, 0.35, 0.06), "#8a5a34");
    }
  } else if (game === "volley") {
    // A boardwalk behind the camera, a lifeguard tower, beach huts and a crowd on towels.
    ground.box(compose(0, 0.05, 11, 0, 0, 0, 40, 0.15, 2.4), "#a77a4a");
    for (let i = 0; i < 20; i++) ground.box(compose(-19 + i * 2, 0.14, 11, 0, 0, 0, 0.05, 0.02, 2.4), "#7a5534");
    const tw = [-12.5, 0, -6];
    props.box(compose(tw[0], 2.2, tw[2], 0, 0, 0, 2.0, 0.15, 2.0), "#f2efe8");
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) props.box(compose(tw[0] + x * 0.9, 1.1, tw[2] + z * 0.9, 0, 0, 0, 0.14, 2.2, 0.14), "#f2efe8");
    props.box(compose(tw[0], 2.9, tw[2], 0, 0, 0, 1.6, 1.2, 1.6), "#e2483d");
    props.cone(compose(tw[0], 3.85, tw[2], Math.PI / 4, 0, 0, 2.4, 0.7, 2.4), "#f2efe8", 4);
    for (let i = 0; i < 4; i++) {
      const x = 8 + i * 3;
      props.box(compose(x, 1.1, -9, 0, 0, 0, 2.2, 2.2, 1.8), ["#7fd6ff", "#ff9ec7", "#ffd93b", "#9ad27a"][i]);
      props.cone(compose(x, 2.6, -9, Math.PI / 4, 0, 0, 3.2, 0.9, 2.6), "#f2efe8", 4);
      props.box(compose(x, 0.8, -8.09, 0, 0, 0, 0.8, 1.5, 0.04), "#5b3a24");
    }
    for (let i = 0; i < 6; i++) ground.box(compose(-10 + i * 2.2, 0.03, 6.5, 0.2, 0, 0, 0.9, 0.02, 1.8), ["#e2483d", "#2fa7a2", "#f5c242"][i % 3]);
    crowd(-10, 4, 0, 6.6, Math.PI, 70);
  } else if (game === "penalty") {
    // Floodlight towers, ad boards and a crowd in the stands.
    for (const [x, z] of [[-14, -14], [14, -14]]) {
      props.box(compose(x, 6, z, 0, 0, 0, 0.4, 12, 0.4), "#9aa3a8");
      props.box(compose(x, 12, z, 0, 0, 0, 3, 1.6, 0.4), "#55555f");
      for (let i = 0; i < 6; i++) props.sphere(compose(x - 1.1 + (i % 3) * 1.1, 11.6 + Math.floor(i / 3) * 0.8, z + 0.25, 0, 0, 0, 0.3), "#fff6d8", 4, 6);
    }
    const ads = ["#e2483d", "#2f6fb0", "#f5c242", "#3f8a5a", "#7a52c7"];
    for (let i = 0; i < 10; i++) props.box(compose(-18 + i * 4, 0.5, -15.2, 0, 0, 0, 3.9, 1.0, 0.2), ads[i % 5]);
    for (let k = 0; k < 4; k++) {
      props.box(compose(0, 0.5 + k * 0.7, -17 - k * 1.0, 0, 0, 0, 44, 0.3, 1.0), "#8a8f94");
      crowd(-21, 21, 0.65 + k * 0.7, -17 - k * 1.0, 0, 80 + k);
    }
  } else if (game === "shadowbox") {
    // Bleachers along the right wall, championship banners and a speed bag.
    for (let k = 0; k < 3; k++) props.box(compose(9.5 + k * 0.6, 0.35 + k * 0.45, -2, 0, 0, 0, 0.6, 0.12, 10), "#c8a26a");
    for (let k = 0; k < 3; k++) crowd(-6.5, 3, 0.4 + k * 0.45, 9.5 + k * 0.6, -Math.PI / 2, 120 + k);
    for (let i = 0; i < 4; i++) {
      props.box(compose(-9 + i * 6, 5.2, -11.8, 0, 0, 0, 1.4, 2.2, 0.05), ["#e2483d", "#2f6fb0", "#f5c242", "#3f8a5a"][i]);
      props.cone(compose(-9 + i * 6, 3.9, -11.8, 0, 0, Math.PI, 1.4, 0.5, 0.05), ["#e2483d", "#2f6fb0", "#f5c242", "#3f8a5a"][i], 3);
    }
  }
}

function buildArena(r: Renderer, game: ArcadeGame): Meshes {
  const ground = new MeshBuilder(), props = new MeshBuilder();
  let water: MeshBuilder | null = null;
  let mtn: GpuMesh | null = buildMountains(r, 9, [170, 270], 14);
  const grass = hexToRgb("#7fb069"), snow = hexToRgb("#eef4f8");
  if (game === "spleef") {
    // A frozen pond with a stage of packed snow blocks in the middle.
    ground.cylinder(compose(0, -6.5, 0, 0, 0, 0, 140, 1, 140), snow, 40);
    water = new MeshBuilder().cylinder(compose(0, -5.6, 0, 0, 0, 0, 34, 0.1, 34), "#3a8fb0", 32);
    const half = (SPLEEF.n * SPLEEF.cell) / 2;
    for (const [x, z, w, d] of [[0, -half - 0.5, half * 2 + 2, 1], [0, half + 0.5, half * 2 + 2, 1], [-half - 0.5, 0, 1, half * 2], [half + 0.5, 0, 1, half * 2]]) {
      props.box(compose(x, -3, z, 0, 0, 0, w, 6, d), "#6f8fa8");
    }
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2, d = 24 + hash2(i, 2) * 18;
      spruce(props, Math.cos(a) * d, -6, Math.sin(a) * d, 1 + hash2(i, 3) * 0.6, i, { snow: true });
    }
  } else if (game === "td") {
    ground.cylinder(compose(0, -0.5, 0, 0, 0, 0, 120, 1, 120), (x, _y, z) => (hash2(Math.floor(x * 20), Math.floor(z * 20)) > 0.5 ? grass : hexToRgb("#74a55f")), 40);
    ground.cylinder(compose(0, 0.01, 0, 0, 0, 0, TD.radius * 2 + 1, 0.04, TD.radius * 2 + 1), hexToRgb("#8cc26f"), 40);
    for (let i = 0; i < TD.path.length - 1; i++) {
      const [ax, az] = TD.path[i], [bx, bz] = TD.path[i + 1];
      const l = Math.hypot(bx - ax, bz - az);
      ground.box(compose((ax + bx) / 2, 0.05, (az + bz) / 2, Math.atan2(bx - ax, bz - az), 0, 0, 2.2, 0.06, l + 2.2), "#c8a26a");
    }
    // The dam (what you're protecting) and the dark woods the raccoons come out of.
    const [ex, ez] = TD.path[TD.path.length - 1];
    for (let k = 0; k < 9; k++) props.cylinder(compose(ex - 3 + (k % 5) * 1.5, 0.4 + Math.floor(k / 5) * 0.6, ez + 1.5, 0, 0, Math.PI / 2, 0.6, 2.6, 0.6), "#7a4b2c", 8);
    props.sphere(compose(ex + 3.5, 0.9, ez + 2, 0, 0, 0, 2.4, 1.4, 2.0), "#6b4a2c", 6, 10);
    water = new MeshBuilder().box(compose(ex, 0.08, ez + 7, 0, 0, 0, 14, 0.1, 8), "#3fb6c4");
    const [sx, sz] = TD.path[0];
    for (let i = 0; i < 14; i++) spruce(props, sx - 4 - hash2(i, 1) * 6, 0, sz - 8 + i * 1.3, 1.2 + hash2(i, 3) * 0.4, i);
    for (let i = 0; i < 70; i++) {
      const a = (i / 70) * Math.PI * 2, d = TD.radius + 3 + hash2(i, 2) * 14;
      spruce(props, Math.cos(a) * d, 0, Math.sin(a) * d, 1 + hash2(i, 3) * 0.6, i);
    }
  } else if (game === "volley") {
    ground.cylinder(compose(0, -0.5, 0, 0, 0, 0, 150, 1, 150), (x, _y, z) => (hash2(Math.floor(x * 9), Math.floor(z * 9)) > 0.5 ? hexToRgb("#e6c27e") : hexToRgb("#dcb670")), 40);
    water = new MeshBuilder().box(compose(0, -0.05, -40, 0, 0, 0, 200, 0.1, 50), "#3fb6c4");
    // Court lines, net and posts.
    for (const [x, z, w, d] of [[0, -3, VOLLEY.half * 2, 0.1], [0, 3, VOLLEY.half * 2, 0.1], [-VOLLEY.half, 0, 0.1, 6], [VOLLEY.half, 0, 0.1, 6]]) props.box(compose(x, 0.02, z, 0, 0, 0, w, 0.03, d), "#ffffff");
    for (const s of [-1, 1]) props.cylinder(compose(0, VOLLEY.net / 2 + 0.2, s * 3.4, 0, 0, 0, 0.14, VOLLEY.net + 0.4, 0.14), "#e2483d", 6);
    props.box(compose(0, VOLLEY.net - 0.45, 0, 0, 0, 0, 0.04, 0.9, 6.8), (_x, y) => (Math.floor((y + 0.5) * 8) % 2 ? hexToRgb("#2e2b2a") : hexToRgb("#f2efe8")));
    props.box(compose(0, VOLLEY.net, 0, 0, 0, 0, 0.08, 0.1, 6.8), "#ffffff");
    // Beach umbrellas along the far side of the court, the lake behind them, pines at the ends.
    for (let i = 0; i < 6; i++) {
      const x = -14 + i * 5.6, z = -7 - hash2(i, 1) * 3;
      props.cylinder(compose(x, 1.1, z, 0, 0, 0, 0.08, 2.2, 0.08), "#ddd", 5);
      props.cone(compose(x, 2.3, z, 0, 0, 0, 2.4, 0.7, 2.4), ["#ff7eb3", "#2fa7a2", "#f5c242"][i % 3], 8);
    }
    for (let i = 0; i < 24; i++) spruce(props, (i % 2 ? 1 : -1) * (20 + hash2(i, 1) * 10), 0, -12 + (i >> 1) * 2.5, 1.1 + hash2(i, 3) * 0.5, i);
  } else if (game === "hoops") {
    // Indoors, in the Sports Centre's hall: four practice hoops along the back wall, one per shooter.
    mtn = null;
    ground.box(compose(0, -0.7, 2.85, 0, 0, 0, 32, 1, 24), "#b88a5a");
    buildGymHall(props, { cx: 0, cz: 2.85, w: 30, d: 22, h: 9, practiceHoops: [-7.5, -2.5, 2.5, 7.5], courtHoops: true, openFront: true });
    for (let i = 0; i < 4; i++) props.box(compose((i - 1.5) * 5, 0.013, 0, 0, 0, 0, 1.4, 0.012, 0.08), "#ffffff"); // shooting lines
  } else if (game === "penalty") {
    ground.cylinder(compose(0, -0.5, 0, 0, 0, 0, 150, 1, 150), (x, _y, z) => (Math.floor(z / 3) % 2 ? hexToRgb("#5fa54a") : hexToRgb("#6db456")), 40);
    const W = PENS.goalW, H = PENS.goalH, gz = -11;
    for (const [x, z, w, d] of [[0, gz + 5.5, 18, 0.1], [-9, gz + 2.7, 0.1, 5.5], [9, gz + 2.7, 0.1, 5.5], [0, 0, 0.3, 0.3]]) props.box(compose(x, 0.02, z, 0, 0, 0, w, 0.03, d), "#ffffff");
    for (const s of [-1, 1]) props.cylinder(compose((s * W) / 2, H / 2, gz, 0, 0, 0, 0.14, H, 0.14), "#ffffff", 6);
    props.cylinder(compose(0, H, gz, 0, 0, Math.PI / 2, 0.14, W + 0.14, 0.14), "#ffffff", 6);
    // The net.
    props.box(compose(0, H / 2, gz - 1.6, 0, 0, 0, W, H, 0.03), (x, y) => (Math.floor(x * 6) % 2 && Math.floor(y * 6) % 2 ? hexToRgb("#e8e8e8") : hexToRgb("#c8ccd0")));
    for (const s of [-1, 1]) props.box(compose((s * W) / 2, H / 2, gz - 0.8, 0, 0, 0, 0.03, H, 1.6), "#d8dcdf");
    props.box(compose(0, H, gz - 0.8, 0, 0, 0, W, 0.03, 1.6), "#d8dcdf");
    // Stands full of (cardboard) fans.
    for (let i = 0; i < 40; i++) props.box(compose(-20 + i, 1.5 + (i % 3) * 0.8, gz - 7 - (i % 3), 0, 0, 0, 0.7, 0.9, 0.3), ["#e2483d", "#2f7fb0", "#f5c242", "#ffffff"][i % 4]);
    props.box(compose(0, 1, gz - 8, 0, 0, 0, 42, 2, 4), "#8a8f94");
  } else {
    // Shadow boxing: a gym with a ring, ropes and punching bags.
    mtn = null;
    ground.box(compose(0, -0.1, 0, 0, 0, 0, 24, 0.2, 24), "#b88a5a");
    props.box(compose(0, 0.35, 0, 0, 0, 0, 7, 0.7, 7), "#2f6fb0");
    props.box(compose(0, 0.71, 0, 0, 0, 0, 6.6, 0.02, 6.6), "#f2efe8");
    for (const [x, z] of [[-3.3, -3.3], [3.3, -3.3], [-3.3, 3.3], [3.3, 3.3]]) props.cylinder(compose(x, 1.4, z, 0, 0, 0, 0.2, 1.4, 0.2), x * z > 0 ? "#e2483d" : "#2f7fb0", 6);
    for (let k = 0; k < 3; k++) {
      const y = 1.0 + k * 0.4;
      props.box(compose(0, y, -3.3, 0, 0, 0, 6.6, 0.05, 0.05), "#ffffff");
      props.box(compose(-3.3, y, 0, 0, 0, 0, 0.05, 0.05, 6.6), "#ffffff");
      props.box(compose(3.3, y, 0, 0, 0, 0, 0.05, 0.05, 6.6), "#ffffff");
    }
    for (const [x, z, ry] of [[0, -12, 0], [-12, 0, Math.PI / 2], [12, 0, -Math.PI / 2]]) props.box(compose(x, 3, z, ry, 0, 0, 24, 6, 0.3), "#e8dcc4");
    for (const s of [-1, 1]) {
      props.cylinder(compose(s * 7, 1.6, -7, 0, 0, 0, 0.9, 1.6, 0.9), "#c8473a", 10);
      props.box(compose(s * 7, 3.2, -7, 0, 0, 0, 0.05, 1.2, 0.05), "#555");
    }
    props.box(compose(0, 4.4, -11.8, 0, 0, 0, 6, 1, 0.1), "#2e2b2a");
    for (let i = 0; i < 6; i++) props.box(compose(-8 + i * 3.2, 0.3, 9, 0, 0, 0, 1.8, 0.6, 0.6), "#5b3a24");
  }
  dressArena(game, ground, props);
  const block = new MeshBuilder().box(compose(0, 0, 0, 0, 0, 0, SPLEEF.cell * 0.98, 1, SPLEEF.cell * 0.98), (_x, y) => (y > 0.3 ? hexToRgb("#ffffff") : hexToRgb("#dbe8f2")));
  const ball = new MeshBuilder();
  if (game === "volley") ball.sphere(compose(0, 0, 0, 0, 0, 0, 0.42), (x, y) => (y > 0 ? (x > 0 ? hexToRgb("#ffd93b") : hexToRgb("#ffffff")) : hexToRgb("#2fa7a2")), 6, 10);
  else if (game === "hoops") ball.sphere(compose(0, 0, 0, 0, 0, 0, 0.3), (x, y) => (Math.abs(x) < 0.02 || Math.abs(y) < 0.02 ? hexToRgb("#2e2b2a") : hexToRgb("#e8742a")), 6, 10);
  else ball.sphere(compose(0, 0, 0, 0, 0, 0, 0.22), (x, y, z) => (Math.floor((Math.atan2(z, x) + 4) * 2) % 2 && y > -0.1 ? hexToRgb("#2e2b2a") : hexToRgb("#ffffff")), 6, 10);
  const foe = new MeshBuilder(); raccoon(foe);
  const tower = new MeshBuilder(); launcher(tower);
  const head = new MeshBuilder(); launcherHead(head);
  const cone = new MeshBuilder(); pinecone(cone);
  const glove = new MeshBuilder().sphere(compose(0, 0, 0, 0, 0, 0, 0.17, 0.15, 0.2), "#d8322a", 4, 6);
  const puff = new MeshBuilder().sphere(compose(0, 0, 0), "#ffffff", 3, 5);
  const up = (b: MeshBuilder) => r.upload(b.build());
  return {
    ground: up(ground), props: up(props), mtn, block: up(block), ball: up(ball), puff: up(puff), foe: up(foe), tower: up(tower), head: up(head), cone: up(cone),
    water: water ? up(water) : null, glove: up(glove),
  };
}

function distToTrail(x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i < TD.path.length - 1; i++) {
    const [ax, az] = TD.path[i], [bx, bz] = TD.path[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

const CONTROLS: Partial<Record<ArcadeGame, string>> = {
  spleef: "W A S D to move · Space / ⛏️ to dig",
  td: "W A S D to walk · Space / 🔨 to build (🌰30)",
  volley: "A D to move · Space / W to jump",
  hoops: "Space / 🏀 to shoot at the top of the meter",
  penalty: "A D aim · W S height · Space / ⚽ to shoot",
  shadowbox: "← → jab · ↑ uppercut · ↓ duck",
};

const MOVE_ICON: Record<BoxMove, string> = { L: "⬅️", R: "➡️", U: "⬆️", D: "⬇️" };

export class DowntownScene implements Scene {
  private game: ArcadeGame;
  private players: P[];
  private me: P | null;
  private m: Meshes;
  private root: HTMLElement;
  private labels: HTMLElement;
  private countdownEl: HTMLElement;
  private boardEl: HTMLElement;
  private timeEl: HTMLElement;
  private hud: HTMLElement;
  private startAt: number;
  private time = 0;
  private gameTime = 0;
  private lastCount = -1;
  private sendAcc = 0;
  private lastInput = "";
  private press = false;
  private vSteer = 0;
  private vFwd = 0;
  private finished = false;
  private joystick: Joystick | null = null;
  private snap: any = null;
  private particles: { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; color: [number, number, number] }[] = [];
  private night = 0;
  private mood!: WorldMood;
  private grid = "";
  private fallen: Record<string, number> = {};
  private cues: { t: number; m: BoxMove }[] = [];
  private shots: Record<string, { t0: number; made: boolean; swish: boolean }> = {};
  private kicks: Record<string, { t0: number; x: number; y: number; dive: number; goal: boolean; saved: boolean; miss: boolean }> = {};
  private boxLast: Record<string, string> = {};
  private seed: number;

  constructor(private ctx: Ctx, start: Extract<ServerMsg, { t: "gameStart" }>) {
    this.game = start.game as ArcadeGame;
    this.seed = start.seed;
    this.m = buildArena(ctx.r, this.game);
    if (this.game === "shadowbox") this.cues = boxCues(start.seed);
    this.startAt = performance.now() + start.countdownMs;
    this.root = h("div", { style: "position:absolute;inset:0" });
    this.labels = h("div", { style: "position:absolute;inset:0;overflow:hidden" });
    this.root.append(this.labels);
    this.players = start.players.map((p, i) => {
      const look = p.look ?? { ...DEFAULT_LOOK, fur: FUR_COLORS[(i * 3 + p.name.length) % FUR_COLORS.length], hat: ["hat_toque_teal", "hat_ranger", "hat_earmuffs", "hat_party"][i % 4] };
      const tag = h("div.tag" + (p.id === ctx.state.you ? ".me" : ""), {}, p.id === ctx.state.you ? "You" : p.name);
      this.labels.append(tag);
      return { id: p.id, name: p.name, look, isBot: p.isBot, x: 0, y: 0, z: 0, ry: 0, tx: 0, ty: 0, tz: 0, score: 0, tag, s: {} };
    });
    this.me = this.players.find((p) => p.id === ctx.state.you) ?? null;
    const info = ARCADE_INFO[this.game];
    this.countdownEl = h("div.countdown", {}, "");
    this.boardEl = h("div.card.scoreboard", {});
    this.timeEl = h("div.pill", {}, `⏱ ${info.seconds}s`);
    this.hud = h("div", { style: "position:absolute;left:50%;bottom:calc(18px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);display:grid;gap:8px;justify-items:center;pointer-events:none" });
    this.root.append(
      h("div", { style: "position:absolute;left:14px;top:12px;display:grid;gap:8px;justify-items:start" }, [h("div.pill", {}, `${info.icon} ${info.name}`), this.timeEl, h("div.pill", {}, CONTROLS[this.game] ?? "")]),
      this.boardEl,
      this.hud,
      h("div.card.howto", { style: "position:absolute;left:50%;top:14%;transform:translateX(-50%);padding:10px 16px;max-width:min(460px,90vw);text-align:center;font-weight:700" }, info.how),
      this.countdownEl,
    );
    this.touchControls();
    ctx.ui.append(this.root);
    window.addEventListener("keydown", this.onKey);
    setTimeout(() => this.root.querySelector(".howto")?.remove(), start.countdownMs + 3000);
  }

  private touchControls() {
    const g = this.game;
    const btn = (label: string, style: string, down: () => void, up?: () => void) => {
      const b = h("button.btn.orange.pe", { style: `position:absolute;width:76px;height:76px;font-size:30px;border-radius:50%;${style}` }, label);
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); down(); });
      if (up) for (const ev of ["pointerup", "pointercancel", "pointerleave"]) b.addEventListener(ev, () => up());
      this.root.append(b);
      return b;
    };
    const bottom = "bottom:calc(20px + env(safe-area-inset-bottom,0px))";
    if (g === "spleef" || g === "td" || g === "penalty") {
      if (wantsJoystick(this.ctx.prefs)) this.joystick = new Joystick(this.root);
      btn(g === "spleef" ? "⛏️" : g === "td" ? "🔨" : "⚽", `right:16px;${bottom}`, () => (this.press = true));
    } else if (g === "volley") {
      this.root.append(h("div.touchpads", {}, [h("div", {}, "⬅️"), h("div", {}, "➡️")]));
      btn("⬆️", `right:16px;bottom:calc(140px + env(safe-area-inset-bottom,0px))`, () => (this.press = true));
    } else if (g === "hoops") {
      btn("🏀", `right:16px;${bottom};width:96px;height:96px;font-size:40px`, () => (this.press = true));
    } else if (g === "shadowbox") {
      const pad = (label: string, style: string, sx: number, fy: number) => btn(label, `${style};width:64px;height:64px;font-size:26px`, () => { this.vSteer = sx; this.vFwd = fy; }, () => { this.vSteer = 0; this.vFwd = 0; });
      pad("⬅️", `left:16px;${bottom}`, -1, 0);
      pad("⬇️", `left:88px;${bottom}`, 0, -1);
      pad("⬆️", `right:88px;${bottom}`, 0, 1);
      pad("➡️", `right:16px;${bottom}`, 1, 0);
    }
  }

  private onKey = (e: KeyboardEvent) => {
    if (e.key === " ") { this.press = true; e.preventDefault(); }
  };

  handle(m: ServerMsg) {
    if (m.t === "game") this.apply(m.s, m.time);
    if (m.t === "gameEnd") this.showResults(m.results);
  }

  private byId(id: string) { return this.players.find((p) => p.id === id); }

  private apply(s: any, t: number) {
    this.gameTime = t;
    this.snap = s;
    const g = this.game;
    if (g === "spleef") {
      if (this.grid && s.g !== this.grid) {
        const half = (SPLEEF.n * SPLEEF.cell) / 2;
        for (let i = 0; i < s.g.length; i++) if (this.grid[i] !== "0" && s.g[i] === "0") {
          const x = -half + ((i % SPLEEF.n) + 0.5) * SPLEEF.cell, z = -half + (Math.floor(i / SPLEEF.n) + 0.5) * SPLEEF.cell;
          this.burst(x, 0.2, z, [1, 1, 1], 8);
        }
        this.ctx.sound.play("pop", 0.5);
      }
      this.grid = s.g;
      for (const q of s.p) {
        const p = this.byId(q.id); if (!p) continue;
        p.tx = q.x; p.tz = q.z; p.ry = q.ry;
        if (q.out && !p.s.out) { this.fallen[p.id] = this.time; this.ctx.sound.play("splash"); if (p === this.me) { this.flash("SPLASH! 💦"); buzz(this.ctx, [60, 40, 60]); } }
        p.s = q;
        p.score = q.out ? 0 : t;
      }
    } else if (g === "td") {
      for (const q of s.p) { const p = this.byId(q.id); if (!p) continue; p.tx = q.x; p.tz = q.z; p.ry = q.ry; if (q.score > p.score && p === this.me) this.ctx.sound.play("coin", 0.5); p.score = q.score; }
      if (s.lives < (this.snap?.lives ?? s.lives)) buzz(this.ctx, 40);
    } else if (g === "volley") {
      const prev = this.snap?.s as number[] | undefined;
      for (const q of s.p) { const p = this.byId(q.id); if (!p) continue; p.tx = q.x; p.ty = q.y; p.s = q; p.score = s.s[q.team]; }
      if (prev && (prev[0] !== s.s[0] || prev[1] !== s.s[1])) {
        this.ctx.sound.play("chime");
        const myTeam = this.me?.s.team;
        const won = (prev[0] !== s.s[0] ? 0 : 1) === myTeam;
        this.flash(won ? "POINT! 🏐" : "Their point");
      }
    } else if (g === "hoops") {
      for (const q of s.p) {
        const p = this.byId(q.id); if (!p) continue;
        p.s = q; p.score = q.score;
        if (q.last && (!this.shots[p.id] || this.shots[p.id].t0 !== q.last[0])) {
          this.shots[p.id] = { t0: q.last[0], made: !!q.last[1], swish: !!q.last[2] };
          if (p === this.me) window.setTimeout(() => { this.ctx.sound.play(q.last[1] ? "coin" : "pop"); if (q.last[2]) this.flash("SWISH! 🔥"); else if (!q.last[1]) this.flash("Clank!"); }, HOOPS.flight * 1000);
        }
      }
    } else if (g === "penalty") {
      for (const q of s.p) {
        const p = this.byId(q.id); if (!p) continue;
        const was = p.s;
        p.s = q; p.score = q.goals;
        if (q.st === "flight" && was.st === "aim" && q.last) {
          this.kicks[p.id] = { t0: this.time - q.pt, ...q.last };
          if (p === this.me) window.setTimeout(() => {
            this.ctx.sound.play(q.last.goal ? "quest" : "pop");
            this.flash(q.last.goal ? "GOAL! ⚽" : q.last.saved ? "Saved! 🧤" : "Wide!");
            buzz(this.ctx, q.last.goal ? [30, 30, 60] : 40);
          }, PENS.flight * 1000);
        }
      }
    } else if (g === "shadowbox") {
      for (const q of s.p) {
        const p = this.byId(q.id); if (!p) continue;
        p.s = q; p.score = q.score;
        if (q.last && this.boxLast[p.id] !== String(q.last[3])) {
          this.boxLast[p.id] = String(q.last[3]);
          if (p === this.me) {
            this.ctx.sound.play(q.last[1] ? "pop" : "step-snow", q.last[1] ? 0.8 : 0.5);
            if (q.last[2]) this.flash("PERFECT!");
            else if (!q.last[1]) this.flash("Miss");
          }
        }
      }
    }
    this.renderBoard();
  }

  private renderBoard() {
    const info = ARCADE_INFO[this.game];
    const s = this.snap;
    let rows: HTMLElement[];
    if (this.game === "volley" && s) {
      const myTeam = this.me?.s.team;
      rows = [h("div", {}, [h("span", { style: "color:#e2483d" }, `🔴 ${s.s[0]}`), "  vs  ", h("span", { style: "color:#2f7fb0" }, `🔵 ${s.s[1]}`)]), h("div.hint", { style: "margin:0" }, `First to ${VOLLEY.toWin} · ${myTeam === 0 ? "You're 🔴 Red" : "You're 🔵 Blue"}`)];
    } else if (this.game === "td" && s) {
      rows = [
        h("div", {}, `🌊 Wave ${s.wave}/${TD.waves}${s.next ? ` · next in ${s.next}s` : ""}`),
        h("div", {}, `❤️ ${s.lives}  ·  🌰 ${s.coins}`),
        ...[...this.players].sort((a, b) => b.score - a.score).map((p) => h("div" + (p === this.me ? ".me" : ""), {}, `${p === this.me ? "You" : p.name}: ${p.score}`)),
      ];
    } else {
      const sorted = [...this.players].sort((a, b) => b.score - a.score);
      rows = sorted.map((p, i) => h("div" + (p === this.me ? ".me" : ""), {}, `${ORD[i] ?? i + 1} ${p === this.me ? "You" : p.name} · ${
        this.game === "spleef" ? (p.s.out ? "💦 out" : "⛏️ standing") : this.game === "penalty" ? `${p.score}/${PENS.kicks} ⚽` : `${p.score} ${info.scoreLabel}`
      }`));
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
    const title = this.game === "td" ? (mine?.finished ? "🏰 The dam is safe! Teamwork!" : "🦝 The raccoons got through!")
      : this.game === "volley" ? (mine?.finished ? "🏐 Your team wins!" : "🏐 Good game!")
      : this.game === "spleef" ? (mine?.finished ? "⛏️ Last beaver standing!" : mine?.place === 1 ? "🏆 You lasted longest!" : "💦 Splash! Good try!")
      : mine?.place === 1 ? "🏆 You won!" : mine ? `You came ${ORD[mine.place - 1]}!` : "Game over!";
    if (mine?.finished && mine.place === 1) this.ctx.sound.play("quest");
    this.hud.replaceChildren();
    this.root.append(h("div.overlay", {}, h("div.card.results", {}, [
      h("h2", {}, title),
      ...results.map((r) => h("div.res" + (r.id === this.ctx.state.you ? ".me" : ""), {}, [
        h("span.pl", {}, ["🥇", "🥈", "🥉"][r.place - 1] ?? `${r.place}`),
        h("span", {}, r.id === this.ctx.state.you ? `${r.name} (you)` : r.name),
        h("span", { style: "color:var(--muted)" }, `${r.score ?? 0} ${info.scoreLabel}`),
        h("span", {}, r.isBot ? "" : `+🪙 ${r.coins}`),
      ])),
      h("div.hint", {}, "Heading back to Downtown in a moment…"),
    ])));
  }

  /** The bottom-centre HUD: meters, aim, the coach's calls. */
  private updateHud() {
    const me = this.me;
    if (!me || this.finished) return;
    const t = this.gameTime;
    if (this.game === "hoops" && me.s.ph !== undefined) {
      const m = hoopMeter(t, me.s.ph);
      const fill = Math.abs(m - 0.5) * 2; // 1 = perfect
      this.hud.replaceChildren(
        h("div.pill", { style: `font-weight:800;${me.s.streak >= 3 ? "background:#ffb347" : ""}` }, me.s.streak >= 3 ? `🔥 On fire! ×${me.s.streak}` : this.snap?.deep ? "⭐ Deep range: 3 points!" : "Shoot when the bar is full"),
        h("div", { style: "width:min(320px,70vw);height:22px;border:3px solid var(--ink);border-radius:12px;background:#fff;overflow:hidden;position:relative" }, [
          h("div", { style: `position:absolute;inset:0 auto 0 0;width:${(fill * 100).toFixed(0)}%;background:${fill > 0.92 ? "#4cc96a" : fill > 0.78 ? "#f5c242" : "#e2483d"}` }),
          h("div", { style: "position:absolute;right:8%;top:0;bottom:0;width:3px;background:var(--ink)" }),
        ]),
      );
    } else if (this.game === "penalty" && me.s.st) {
      const meter = 0.5 + 0.5 * Math.sin((t * PENS.meterHz + me.s.mp) * Math.PI * 2);
      const aim = me.s.st === "aim";
      this.hud.replaceChildren(
        h("div.pill", {}, aim ? `Kick ${me.s.kick + 1} of ${PENS.kicks} · ${Math.max(0, Math.ceil(PENS.aimTime - me.s.pt))}s` : me.s.st === "done" ? "All kicks taken!" : "…"),
        aim ? h("div", { style: "width:min(320px,70vw);height:22px;border:3px solid var(--ink);border-radius:12px;background:#fff;overflow:hidden;position:relative" }, [
          h("div", { style: "position:absolute;left:60%;width:20%;top:0;bottom:0;background:#bdf0c8" }),
          h("div", { style: `position:absolute;inset:0 auto 0 0;width:${(meter * 100).toFixed(0)}%;background:${meter > 0.6 && meter < 0.8 ? "#4cc96a" : meter > 0.85 ? "#e2483d" : "#f5c242"};opacity:.85` }),
        ]) : "",
      );
    } else if (this.game === "shadowbox") {
      // The next few calls slide in from the right toward the "hit" line.
      const lane = h("div", { style: "position:relative;width:min(420px,88vw);height:64px;border:3px solid var(--ink);border-radius:16px;background:rgba(255,255,255,.85);overflow:hidden" });
      lane.append(h("div", { style: "position:absolute;left:44px;top:0;bottom:0;width:4px;background:#4cc96a" }));
      for (const c of this.cues) {
        const dt = c.t - t;
        if (dt < -0.3 || dt > 2.6) continue;
        const x = 46 + dt * 140;
        lane.append(h("div", { style: `position:absolute;left:${x - 22}px;top:8px;font-size:38px;line-height:44px;opacity:${dt < 0 ? 0.3 : 1}` }, MOVE_ICON[c.m]));
      }
      this.hud.replaceChildren(h("div.pill", {}, me.s.combo >= 3 ? `🔥 Combo ×${me.s.combo}` : "Hit each call as it reaches the line!"), lane);
    } else if (this.game === "td" && this.snap) {
      const ok = this.snap.coins >= TD.cost && distToTrail(me.x, me.z) > 1.6 && Math.hypot(me.x, me.z) < TD.radius - 0.5 && (this.snap.tw as number[][]).every((w) => Math.hypot(w[0] - me.x, w[1] - me.z) > 2.2);
      this.hud.replaceChildren(h("div.pill", { style: ok ? "background:#c9f2d2" : "" }, ok ? "🔨 Space to build a pinecone launcher here (🌰30)" : this.snap.coins < TD.cost ? "Not enough acorns yet: shoo some raccoons!" : "Can't build on the trail or too close to a launcher"));
    } else if (this.game === "spleef" && me.s.out) {
      this.hud.replaceChildren(h("div.pill", {}, "💦 You fell in! Watch who lasts longest…"));
    } else this.hud.replaceChildren();
  }

  private hudT = 0;

  update(dt: number) {
    this.time += dt;
    if (!this.finished && performance.now() > this.startAt) this.gameTime += dt; // smooth between snapshots
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
    let steer = this.vSteer, fwd = this.vFwd;
    if (this.game === "volley") steer += inp.touchSteer;
    if (inp.down("a", "arrowleft")) steer -= 1;
    if (inp.down("d", "arrowright")) steer += 1;
    if (inp.down("w", "arrowup")) fwd += 1;
    if (inp.down("s", "arrowdown")) fwd -= 1;
    if (this.joystick) { steer += this.joystick.x; fwd += this.joystick.y; }
    steer = Math.max(-1, Math.min(1, steer));
    fwd = Math.max(-1, Math.min(1, fwd));
    if (inp.consumeTap() && this.game !== "spleef" && this.game !== "td" && this.game !== "shadowbox") this.press = true;
    this.sendAcc += dt;
    const key = `${steer.toFixed(2)}|${fwd.toFixed(2)}`;
    if (!this.finished && (key !== this.lastInput || this.press || this.sendAcc > 0.25)) {
      this.ctx.net.send({ t: "input", steer, fwd, press: this.press });
      this.press = false;
      this.lastInput = key;
      this.sendAcc = 0;
    }
    for (const p of this.players) {
      const k = Math.min(1, dt * 12);
      const px = p.x, pz = p.z;
      p.x = lerp(p.x, p.tx, k);
      p.y = lerp(p.y, p.ty, Math.min(1, dt * 20));
      p.z = lerp(p.z, p.tz, k);
      p.s.moving = Math.hypot(p.x - px, p.z - pz) / Math.max(dt, 1e-3) > 0.5 ? 1 : 0;
    }
    for (const q of this.particles) { q.life += dt; q.vy -= 7 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; }
    this.particles = this.particles.filter((q) => q.life < 0.8);
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = this.game === "shadowbox" || this.game === "hoops" || this.game === "penalty" ? 0 : 0.2; this.updateHud(); }
  }

  private lane(i: number) {
    return (i - (this.players.length - 1) / 2) * 5;
  }

  render() {
    const { r } = this.ctx;
    r.time = this.time;
    // The gym is indoors: always bright.
    const indoors = this.game === "shadowbox" || this.game === "hoops";
    this.night = applyTimeOfDay(r, indoors ? 0.45 : dayPhase(this.ctx.prefs.time));
    this.mood = currentMood(this.ctx.prefs);
    if (this.game === "spleef") this.mood = { ...this.mood, season: "winter" };
    if (this.game === "shadowbox" || this.game === "hoops" || this.game === "volley") this.mood = { ...this.mood, weather: { ...this.mood.weather, kind: "clear" } };
    applyMood(r, this.mood);
    if (this.game !== "spleef") r.env.snow = 0;
    r.resize();
    const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
    const me = this.me ?? this.players[0];
    const myIndex = this.players.indexOf(me);
    const g = this.game;
    let cam: Vec3, look: Vec3;
    if (g === "spleef") { cam = [me.x * 0.5, 13, me.z * 0.5 + 14]; look = [me.x * 0.7, -0.5, me.z * 0.7 - 1]; }
    else if (g === "td") { cam = [me.x * 0.4, 24, me.z * 0.4 + 20]; look = [me.x * 0.6, 0, me.z * 0.6 - 1]; }
    else if (g === "volley") { cam = [me.x * 0.25, 4.5, 15]; look = [me.x * 0.2, 2.2, 0]; }
    else if (g === "hoops") { const x = this.lane(myIndex); cam = [x + 1.6, 3.9, 5.2]; look = [x, 2.6, -6]; }
    else if (g === "penalty") { cam = [1.2, 3.0, 6.2]; look = [0, 1.0, -11]; }
    else { cam = [2.6, 3.2, 7.5]; look = [0, 1.6, 0]; }
    r.shadowFocus = [look[0], 0, look[2]];
    r.cutFocus = null;
    r.begin(lookAt(cam, look), perspective(aspect < 0.8 ? 1.1 : 0.9, aspect, 0.3, 2400), cam);
    const I = compose(0, 0, 0);
    if (this.m.mtn) r.draw(this.m.mtn, compose(0, -10, 0), { noCast: true });
    const inside = g === "shadowbox" || g === "hoops";
    r.draw(this.m.ground, I, { noCast: true, season: !inside });
    r.draw(this.m.props, I, { sway: inside ? 0 : 0.1, season: !inside, noCast: g === "hoops" });
    if (this.m.water) r.draw(this.m.water, I, { wave: 1, alpha: 0.85 });
    if (!inside) drawWeather(r, this.mood, this.time, cam, this.night);

    const pose = (p: P, extra: Partial<BeaverPose> = {}): BeaverPose => ({
      walk: this.time * 10, moving: p.s.moving || 0, swim: 0, jump: 0, wave: 0, sled: 0, time: this.time,
      seed: this.players.indexOf(p) * 1.7, expr: (this.finished ? "happy" : "determined") as Expression, ...extra,
    });
    const beaver = (p: P, m: Float32Array, extra: Partial<BeaverPose> = {}) => drawBeaver(r, getBeaverMeshes(r, p.look), m, pose(p, extra));
    const tags: [P, number, number, number][] = [];

    if (g === "spleef") {
      const half = (SPLEEF.n * SPLEEF.cell) / 2;
      for (let i = 0; i < this.grid.length; i++) {
        const g = this.grid[i];
        if (g === "0" || !g) continue;
        const x = -half + ((i % SPLEEF.n) + 0.5) * SPLEEF.cell, z = -half + (Math.floor(i / SPLEEF.n) + 0.5) * SPLEEF.cell;
        // Cracking snow shakes and turns blue-grey just before it drops.
        const crack = g === "2";
        const j = crack ? Math.sin(this.time * 40 + i) * 0.05 : 0;
        r.draw(this.m.block, compose(x + j, crack ? -0.56 : -0.5, z - j), { outline: 0.02, tint: crack ? [0.72, 0.8, 0.92, 1] : undefined });
      }
      for (const p of this.players) {
        const fell = this.fallen[p.id];
        const y = fell !== undefined ? Math.max(-5.6, -((this.time - fell) ** 2) * 9) : 0;
        beaver(p, compose(p.x, y, p.z, p.ry), { wave: p.s.dig ? 1 : 0, swim: fell !== undefined && y <= -5.5 ? 1 : 0, expr: fell !== undefined ? "surprised" : p.s.dig ? "excited" : "determined" });
        tags.push([p, p.x, y + 2.6, p.z]);
      }
    } else if (g === "td" && this.snap) {
      const s = this.snap;
      for (const w of s.tw as number[][]) {
        r.draw(this.m.tower, compose(w[0], 0, w[1]), { outline: 0.03 });
        r.draw(this.m.head, compose(w[0], 0, w[1], w[3]), { outline: 0.02 });
      }
      for (const f of s.f as number[][]) {
        const [x, z] = tdPoint(f[1]);
        const [x2, z2] = tdPoint(Math.min(TD_PATH_LEN, f[1] + 0.3));
        const ry = Math.atan2(x2 - x, z2 - z);
        const big = f[3] > 8 ? 1.5 : 1;
        r.draw(this.m.foe, compose(x, Math.abs(Math.sin(this.time * 9 + f[0])) * 0.12, z, ry, 0, 0, big), { outline: 0.03, tint: f[4] ? [1, 0.6, 0.6, 1] : undefined });
      }
      for (const sh of s.sh as number[][]) {
        const k = Math.min(1, sh[4] / 0.35);
        r.draw(this.m.cone, compose(lerp(sh[0], sh[2], k), 1.4 + Math.sin(k * Math.PI) * 1.6, lerp(sh[1], sh[3], k), 0, this.time * 12, 0));
      }
      for (const p of this.players) { beaver(p, compose(p.x, 0, p.z, p.ry)); tags.push([p, p.x, 2.6, p.z]); }
    } else if (g === "volley" && this.snap) {
      for (const p of this.players) {
        const team = p.s.team ?? 0;
        const slot = this.players.filter((o) => o.s.team === team).indexOf(p);
        const z = slot ? -0.9 : 0.9;
        beaver(p, compose(p.x, p.y, z, team === 0 ? Math.PI / 2 : -Math.PI / 2), { cheer: p.y > 0.2 ? 1 : 0, expr: p.y > 0.2 ? "excited" : "determined", moving: Math.abs(p.tx - p.x) > 0.05 ? 1 : 0 });
        tags.push([p, p.x, p.y + 2.6, z]);
      }
      const [bx, by] = this.snap.b as number[];
      r.draw(this.m.ball, compose(bx, by, 0, this.time * 3, this.time * 2, 0), { outline: 0.02 });
      r.draw(this.m.puff, compose(bx, 0.03, 0, 0, 0, 0, 0.5, 0.01, 0.5), { unlit: true, tint: [0, 0, 0, 1], alpha: 0.2 });
    } else if (g === "hoops") {
      this.players.forEach((p, i) => {
        const x = this.lane(i);
        const sh = this.shots[p.id];
        const since = sh ? this.gameTime - sh.t0 : 99;
        const shooting = since < 0.4;
        beaver(p, compose(x, 0, 0.3, Math.PI), { cheer: shooting ? 1 : 0, expr: sh && since < 2 && since > HOOPS.flight ? (sh.made ? "happy" : "surprised") : "determined" });
        tags.push([p, x, 2.8, 0.3]);
        // The ball: in your paws, then a high arc to the rim; in, or off the rim.
        let bx = x, by = 1.8, bz = -0.2;
        if (since < HOOPS.flight) {
          const k = since / HOOPS.flight;
          by = 1.8 + (3.05 - 1.8) * k + Math.sin(k * Math.PI) * 2.6;
          bz = -0.2 + (-6.85 + 0.2) * k;
        } else if (since < HOOPS.flight + 0.7) {
          const k = (since - HOOPS.flight) / 0.7;
          if (sh!.made) { by = 3.0 - k * 2.6; bz = -6.85; }
          else { by = 3.1 + Math.sin(k * Math.PI) * 0.9 - k * 2.2; bz = -6.85 + k * 2.4; bx = x + k * 1.2 * (i % 2 ? 1 : -1); }
        }
        r.draw(this.m.ball, compose(bx, by, bz, 0, this.time * 6, 0), { outline: 0.02 });
      });
    } else if (g === "penalty" && me) {
      const s = me.s;
      const kick = this.kicks[me.id];
      const since = kick ? this.time - kick.t0 : 99;
      const flying = since < PENS.flight + PENS.rest;
      // The keeper (a big friendly moose-sized beaver in gloves) dives the way they guessed.
      const keeper = this.players.find((p) => p !== me) ?? me;
      const k = flying ? Math.min(1, since / (PENS.flight * 0.8)) : 0;
      const dive = flying && kick ? kick.dive : 0;
      drawBeaver(r, getBeaverMeshes(r, { ...keeper.look, hat: null }), compose(dive * k * 2.4, Math.sin(k * Math.PI) * 0.5, -10.6, 0, 0, -dive * k * 1.1, 1.25), {
        walk: this.time * 3, moving: 0, swim: 0, jump: 0, wave: 0, sled: 0, time: this.time, cheer: 1, expr: kick?.saved && since > PENS.flight ? "excited" : "determined",
      });
      beaver(me, compose(-1.1, 0, 1.0, Math.PI + 0.35), { moving: since < 0.25 ? 1 : 0, cheer: kick?.goal && since > PENS.flight && since < PENS.flight + PENS.rest ? 1 : 0, expr: kick && since > PENS.flight && since < 3 ? (kick.goal ? "happy" : "surprised") : "determined" });
      let bx = 0, by = 0.22, bz = 0;
      if (flying && kick) {
        const kk = Math.min(1, since / PENS.flight);
        bx = kick.x * kk; by = 0.22 + (kick.y - 0.22) * kk + Math.sin(kk * Math.PI) * 0.6; bz = -11 * kk;
        if (kick.saved && kk >= 1) { const b = Math.min(1, (since - PENS.flight) / 0.6); bz = -11 + b * 4; by = Math.max(0.22, kick.y - b * 2); }
        if (kick.goal && kk >= 1) { bz = -12.2; by = Math.max(0.22, kick.y - (since - PENS.flight) * 2); }
      }
      r.draw(this.m.ball, compose(bx, by, bz, 0, this.time * (flying ? 12 : 0), 0), { outline: 0.02 });
      if (s.st === "aim") {
        const ax = s.ax * (PENS.goalW / 2), ay = s.ay * PENS.goalH;
        r.draw(this.m.puff, compose(ax, Math.max(0.2, ay), -10.9, 0, 0, 0, 0.32, 0.32, 0.05), { unlit: true, tint: [1, 0.25, 0.2, 1], alpha: 0.75 });
      }
      tags.push([me, -1.1, 2.6, 1.0]);
    } else if (g === "shadowbox") {
      this.players.forEach((p, i) => {
        const mine = p === me;
        const x = mine ? 0 : (i % 2 ? -1 : 1) * (6 + Math.floor(i / 2) * 2.4), z = mine ? 0.5 : -3;
        const y = mine ? 0.72 : 0;
        const last = p.s.last as [BoxMove, number, number, number] | null;
        const age = last ? this.gameTime - last[3] : 9;
        const m = age < 0.3 ? last![0] : null;
        const bob = Math.sin(this.time * 6 + i) * 0.04;
        const lean = m === "L" ? 0.25 : m === "R" ? -0.25 : 0;
        beaver(p, compose(x, y + (m === "D" ? -0.35 : bob), z, (mine ? 0 : 0) + lean, m === "D" ? 0.3 : 0, 0), {
          wave: m === "L" || m === "R" ? 1 : 0, cheer: m === "U" ? 1 : 0, hold: m ? 0 : 1, expr: last && age < 0.6 ? (last[1] ? "excited" : "dizzy") : "determined",
        });
        // Boxing gloves follow the punches.
        const reach = m === "L" || m === "R" ? 0.75 : 0.35;
        for (const s of [-1, 1]) {
          const punching = (m === "L" && s < 0) || (m === "R" && s > 0) || m === "U";
          r.draw(this.m.glove, compose(x + s * 0.32, y + (m === "U" && punching ? 2.0 : 1.25) + bob, z + (punching ? reach : 0.35)), { outline: 0.02 });
        }
        tags.push([p, x, y + 2.7, z]);
      });
    }
    for (const q of this.particles) r.draw(this.m.puff, compose(q.x, q.y, q.z, 0, 0, 0, 0.16 * (1 - q.life)), { unlit: true, tint: [...q.color, 1], alpha: 0.85 * (1 - q.life / 0.8) });
    r.end();
    for (const p of this.players) p.tag.style.display = "none";
    for (const [p, x, y, z] of tags) {
      const s = r.project(x, y, z);
      if (!s) continue;
      p.tag.style.display = "";
      p.tag.style.left = `${s.x}px`;
      p.tag.style.top = `${s.y}px`;
    }
  }

  dispose() {
    const r = this.ctx.r;
    for (const g of Object.values(this.m)) if (g) r.dispose(g);
    this.joystick?.dispose();
    window.removeEventListener("keydown", this.onKey);
    this.root.remove();
  }
}
