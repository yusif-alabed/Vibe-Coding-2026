import {
  BOARD_INFO, FUR_COLORS, GW_QUESTIONS, GW_SUSPECTS, hashString, isDark, MY_COLORS, MY_ITEMS, MY_ROOMS, MY_SUSPECTS, roomDistance, TY, TY_BOARD, TY_GROUPS, ownsSet,
  cardName, type BoardAction, type BoardGame, type BoardView, type LobbyWire, type Look, type ServerMsg, type TycoonState,
} from "@beaver/shared";
import { compose, hash2, hexToRgb, lerp, lerpAngle, lookAt, perspective, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import { h, toast } from "../ui/dom";
import { Joystick } from "../ui/joystick";
import { wantsJoystick } from "../prefs";
import { drawBeaver, getBeaverMeshes, type BeaverPose } from "./beaver";
import { applyTimeOfDay, dayPhase } from "./daylight";
import { applyMood, currentMood, drawWeather, type WorldMood } from "./weather";
import { buildMountains } from "./hubWorld";
import { spruce } from "./village/nature";
import { PhotoMode } from "./photo";
import { chatBar, Others } from "./others";
import type { Ctx, Scene } from "./scene";

/**
 * 🎲 The Board Game Estate: a walled garden behind Downtown with an old mansion and five giant games
 * laid out on the lawn, each one a real table game played life-size:
 *   ♟️ giant chess and 🔴 giant checkers on stone boards, 🕵️ a field of standing beaver portraits that
 *   tip over as you rule them out, 🏙️ a property-trading city board you walk around, and 🔍 the
 *   mansion's floor plan laid out in hedges for the whodunnit.
 * Walk up to a game to sit down. The estate is a shared space: online you see the other beavers on
 * the lawn, and a table waits until a second one sits down (solo mode seats bots instead). The rules
 * live in shared/board (the server runs them); this draws your seat's view and turns clicks on the
 * board into moves. Only prompts and buttons are DOM.
 */

const R = 46;
const GATE = { x: 0, z: 36 };
const MANSION = { x: 0, z: -36, w: 26, d: 10 };
type Station = { game: BoardGame; x: number; z: number; r: number };
const S_CHESS = 1.6, S_CHECK = 1.5, GW_SP = 1.9, TY_CELL = 2.3, MY_ROOM = 5;
const STATIONS: Station[] = [
  { game: "chess", x: -22, z: -2, r: 9.5 },
  { game: "checkers", x: -22, z: 21, r: 9 },
  { game: "guesswho", x: 22, z: -2, r: 9 },
  { game: "tycoon", x: 22, z: 21, r: 11 },
  { game: "mystery", x: 0, z: -16, r: 10 },
];
const st = (g: BoardGame) => STATIONS.find((s) => s.game === g)!;

const groundY = (x: number, z: number) => {
  const d = Math.hypot(x, z);
  return d > R - 4 ? (d - (R - 4)) * 0.6 + Math.sin(x * 0.3) * 0.2 : 0;
};

// ------------------------------------------------------------------ Meshes

interface Meshes {
  world: GpuMesh; lawn: GpuMesh; mtn: GpuMesh; water: GpuMesh;
  pieces: Record<string, GpuMesh>; man: Record<string, GpuMesh>; tile: GpuMesh; card: GpuMesh; house: GpuMesh; hotel: GpuMesh; ring: GpuMesh;
}

function chessPiece(kind: string, col: string): MeshBuilder {
  const m = new MeshBuilder();
  const trim = col === "#f4ead6" ? "#d8c7a4" : "#241812";
  m.cylinder(compose(0, 0.12, 0, 0, 0, 0, 1.0, 0.24, 1.0), trim, 14);
  m.cylinder(compose(0, 0.3, 0, 0, 0, 0, 0.85, 0.14, 0.85), col, 14);
  const body = (h: number, top = 0.28) => m.cylinder(compose(0, 0.37 + h / 2, 0, 0, 0, 0, 0.8, h, 0.8), col, 12, top, 0.42);
  if (kind === "p") { body(0.55, 0.22); m.cylinder(compose(0, 0.95, 0, 0, 0, 0, 0.6, 0.08, 0.6), trim, 12); m.sphere(compose(0, 1.18, 0, 0, 0, 0, 0.27), col, 6, 10); }
  else if (kind === "r") {
    m.cylinder(compose(0, 0.95, 0, 0, 0, 0, 0.78, 1.15, 0.78), col, 12, 0.42, 0.48);
    m.cylinder(compose(0, 1.6, 0, 0, 0, 0, 0.95, 0.22, 0.95), col, 12);
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; m.box(compose(Math.cos(a) * 0.36, 1.82, Math.sin(a) * 0.36, -a, 0, 0, 0.22, 0.24, 0.22), col); }
  } else if (kind === "n") {
    body(0.5, 0.32);
    m.box(compose(0, 1.2, 0.08, 0, -0.35, 0, 0.4, 0.95, 0.55), col);
    m.box(compose(0, 1.45, 0.42, 0, 0.5, 0, 0.36, 0.34, 0.62), col);
    for (const s of [-1, 1]) m.cone(compose(s * 0.12, 1.8, -0.02, 0, 0, 0, 0.14, 0.26, 0.14), col, 5);
    m.box(compose(0, 1.25, -0.2, 0, -0.35, 0, 0.12, 0.85, 0.2), trim);
  } else if (kind === "b") {
    body(0.8, 0.22);
    m.cylinder(compose(0, 1.2, 0, 0, 0, 0, 0.6, 0.08, 0.6), trim, 12);
    m.sphere(compose(0, 1.55, 0, 0, 0, 0, 0.3, 0.42, 0.3), col, 6, 10);
    m.sphere(compose(0, 2.02, 0, 0, 0, 0, 0.1), trim, 4, 6);
  } else if (kind === "q") {
    body(1.05, 0.24);
    m.cylinder(compose(0, 1.45, 0, 0, 0, 0, 0.75, 0.1, 0.75), trim, 12);
    m.cylinder(compose(0, 1.7, 0, 0, 0, 0, 0.72, 0.4, 0.72), col, 12, 0.5, 0.3);
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; m.sphere(compose(Math.cos(a) * 0.34, 1.95, Math.sin(a) * 0.34, 0, 0, 0, 0.09), trim, 4, 6); }
    m.sphere(compose(0, 2.0, 0, 0, 0, 0, 0.17), col, 5, 8);
  } else {
    body(1.2, 0.26);
    m.cylinder(compose(0, 1.6, 0, 0, 0, 0, 0.8, 0.1, 0.8), trim, 12);
    m.cylinder(compose(0, 1.85, 0, 0, 0, 0, 0.72, 0.4, 0.72), col, 12, 0.48, 0.3);
    m.box(compose(0, 2.25, 0, 0, 0, 0, 0.14, 0.5, 0.14), trim);
    m.box(compose(0, 2.3, 0, 0, 0, 0, 0.4, 0.13, 0.14), trim);
  }
  return m;
}

function build(r: Renderer): Meshes {
  const lawn = new MeshBuilder();
  const w = new MeshBuilder();
  const lawnA = hexToRgb("#7cb35e"), lawnB = hexToRgb("#73a957"), stone = hexToRgb("#d9cdb8");
  // Lawn with mown stripes.
  const step = 2;
  for (let x = -70; x < 70; x += step) for (let z = -70; z < 70; z += step) {
    const p = (a: number, b: number): Vec3 => [a, groundY(a, b), b];
    const col = Math.floor(x / 4) % 2 ? lawnA : lawnB;
    lawn.tri(p(x, z), p(x, z + step), p(x + step, z + step), col);
    lawn.tri(p(x, z), p(x + step, z + step), p(x + step, z), col);
  }
  // Gravel paths: gate → mansion, and a cross walk between the game lawns.
  w.box(compose(0, 0.03, 0, 0, 0, 0, 3.4, 0.06, 72), stone);
  w.box(compose(0, 0.03, 9, 0, 0, 0, 56, 0.06, 3), stone);
  w.box(compose(0, 0.03, -6, 0, 0, 0, 56, 0.06, 3), stone);
  // Clipped hedges around the estate, with the gate in the south wall.
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    const x = Math.cos(a) * (R - 3), z = Math.sin(a) * (R - 3);
    if (Math.hypot(x - GATE.x, z - GATE.z) < 6) continue;
    w.box(compose(x, 1.2, z, -a, 0, 0, 1.6, 2.4, 4.8), "#3f7a3a");
  }
  // The gate: stone pillars with acorn finials and an iron arch.
  for (const s of [-1, 1]) {
    w.box(compose(GATE.x + s * 3, 1.9, GATE.z + 6, 0, 0, 0, 1.2, 3.8, 1.2), "#b9ab94");
    w.sphere(compose(GATE.x + s * 3, 4.1, GATE.z + 6, 0, 0, 0, 0.45, 0.55, 0.45), "#c48a52", 5, 8);
  }
  w.torus(compose(GATE.x, 3.8, GATE.z + 6, 0, Math.PI / 2, 0, 3), "#2e2b2a", 1, 0.05, 16, 4);
  // The mansion: three storeys, a portico, a big roof and lit windows.
  const M = MANSION;
  w.box(compose(M.x, 5, M.z, 0, 0, 0, M.w, 10, M.d), "#c8b08a");
  w.box(compose(M.x, 10.3, M.z, 0, 0, 0, M.w + 1, 0.6, M.d + 1), "#7a4b2c");
  w.cylinder(compose(M.x, 12.8, M.z, Math.PI / 4, 0, 0, M.w * 0.95, 4.4, M.d * 1.3), "#5a3a2c", 4, 0.0, 0.5);
  for (const s of [-1, 1]) {
    w.box(compose(M.x + s * (M.w / 2 - 1.5), 13, M.z, 0, 0, 0, 1.4, 4, 1.4), "#9a6a4a");
    w.cylinder(compose(M.x + s * (M.w / 2 + 1), 7, M.z, 0, 0, 0, 5, 14, 5), "#c8b08a", 10);
    w.cone(compose(M.x + s * (M.w / 2 + 1), 16, M.z, 0, 0, 0, 6, 4.4, 6), "#5a3a2c", 10);
  }
  for (let k = 0; k < 3; k++) for (let i = 0; i < 7; i++) {
    const x = M.x - 9 + i * 3;
    if (k === 0 && Math.abs(x) < 2) continue;
    w.box(compose(x, 2 + k * 3, M.z + M.d / 2 + 0.05, 0, 0, 0, 1.3, 1.8, 0.1), "#ffe2a0");
  }
  w.box(compose(M.x, 1.7, M.z + M.d / 2 + 0.05, 0, 0, 0, 2.2, 3.4, 0.12), "#5b3a24");
  w.box(compose(M.x, 4.6, M.z + M.d / 2 + 2, 0, 0, 0, 8, 0.4, 4), "#efe6d4");
  for (const s of [-3.4, -1.2, 1.2, 3.4]) w.cylinder(compose(M.x + s, 2.2, M.z + M.d / 2 + 3.6, 0, 0, 0, 0.6, 4.4, 0.6), "#f4ede0", 10);
  for (let i = 0; i < 4; i++) w.box(compose(M.x, 0.12 + i * 0.12, M.z + M.d / 2 + 4.3 - i * 0.4, 0, 0, 0, 7, 0.24, 1.2), "#d9cdb8");
  // Mystery board: the mansion's floor plan laid out in front of it, nine rooms with low hedge walls.
  const my = st("mystery");
  for (let i = 0; i < 9; i++) {
    const cx = my.x + ((i % 3) - 1) * MY_ROOM, cz = my.z + (Math.floor(i / 3) - 1) * MY_ROOM;
    w.box(compose(cx, 0.06, cz, 0, 0, 0, MY_ROOM - 0.2, 0.1, MY_ROOM - 0.2), ["#e8d8b8", "#d8c0a0", "#c8d8c0", "#d0c4e0", "#f0d0c0", "#c8dce8", "#e0d8a8", "#d8b8b8", "#f0e8d8"][i]);
    for (const [ox, oz, ww, dd] of [[0, -MY_ROOM / 2, MY_ROOM, 0.3], [0, MY_ROOM / 2, MY_ROOM, 0.3], [-MY_ROOM / 2, 0, 0.3, MY_ROOM], [MY_ROOM / 2, 0, 0.3, MY_ROOM]] as const) {
      // Doorways in every inner wall.
      if (ww > 1) { for (const s of [-1, 1]) w.box(compose(cx + s * (MY_ROOM / 2 - 0.9), 0.35, cz + oz, 0, 0, 0, 1.6, 0.7, dd), "#4f8a45"); }
      else for (const s of [-1, 1]) w.box(compose(cx + ox, 0.35, cz + s * (MY_ROOM / 2 - 0.9), 0, 0, 0, ww, 0.7, 1.6), "#4f8a45");
    }
  }
  // Secret passages: little trapdoors in the corner rooms.
  for (const i of [0, 2, 6, 8]) w.box(compose(my.x + ((i % 3) - 1) * MY_ROOM + 1.5, 0.13, my.z + (Math.floor(i / 3) - 1) * MY_ROOM + 1.5, 0, 0, 0, 0.9, 0.05, 0.9), "#5b3a24");
  // Giant chess and checkers boards: raised stone squares.
  for (const [g, S, light, dark] of [["chess", S_CHESS, "#efe3c8", "#6b4a35"], ["checkers", S_CHECK, "#f2d9a8", "#3a6b3a"]] as const) {
    const s = st(g);
    w.box(compose(s.x, 0.12, s.z, 0, 0, 0, S * 8 + 0.8, 0.24, S * 8 + 0.8), "#8a7a66");
    for (let sq = 0; sq < 64; sq++) {
      const f = sq & 7, rk = sq >> 3;
      w.box(compose(s.x + (f - 3.5) * S, 0.27, s.z + (3.5 - rk) * S, 0, 0, 0, S * 0.98, 0.06, S * 0.98), isDark(sq) ? dark : light);
    }
  }
  // Guess-who lawn: a low wooden stage the portraits stand on.
  const gw = st("guesswho");
  w.box(compose(gw.x, 0.1, gw.z, 0, 0, 0, GW_SP * 6 + 1, 0.2, GW_SP * 4 + 1), "#a8784a");
  // City board: a ring of 24 coloured lots around a park.
  const ty = st("tycoon");
  w.box(compose(ty.x, 0.08, ty.z, 0, 0, 0, TY_CELL * 7 + 0.6, 0.16, TY_CELL * 7 + 0.6), "#e8e2d0");
  w.box(compose(ty.x, 0.12, ty.z, 0, 0, 0, TY_CELL * 5 - 0.2, 0.12, TY_CELL * 5 - 0.2), "#8cc26f");
  for (let i = 0; i < 24; i++) {
    const [x, z] = tyCell(i);
    const sp = TY_BOARD[i];
    const col = sp.group ? TY_GROUPS[sp.group].color : sp.kind === "rail" ? "#5b5b5b" : sp.kind === "chance" ? "#ff9a3c" : sp.kind === "chest" ? "#7fd6ff" : sp.kind === "go" ? "#e2483d" : sp.kind === "jail" || sp.kind === "gotojail" ? "#2e2b2a" : "#f5c242";
    w.box(compose(x, 0.2, z, 0, 0, 0, TY_CELL * 0.92, 0.08, TY_CELL * 0.92), "#fbf7ee");
    w.box(compose(x, 0.25, z, 0, 0, 0, TY_CELL * 0.8, 0.04, TY_CELL * 0.8), col);
  }
  // Trees, lamp posts, a fountain and some benches.
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + hash2(i, 1) * 0.1, d = R + 2 + hash2(i, 2) * 14;
    spruce(w, Math.cos(a) * d, groundY(Math.cos(a) * d, Math.sin(a) * d), Math.sin(a) * d, 1.2 + hash2(i, 3) * 0.6, i);
  }
  w.cylinder(compose(0, 0.35, 9, 0, 0, 0, 5, 0.7, 5), "#b9ab94", 16);
  w.cylinder(compose(0, 1.2, 9, 0, 0, 0, 0.6, 1.8, 0.6), "#b9ab94", 8);
  w.cylinder(compose(0, 2.2, 9, 0, 0, 0, 2, 0.3, 2), "#b9ab94", 12);
  for (const [x, z] of [[-10, 9], [10, 9], [-10, -6], [10, -6], [-4, 28], [4, 28]]) {
    w.cylinder(compose(x, 1.6, z, 0, 0, 0, 0.16, 3.2, 0.16), "#2e2b2a", 6);
    w.sphere(compose(x, 3.3, z, 0, 0, 0, 0.32), "#ffe2a0", 5, 8);
  }
  const water = new MeshBuilder().cylinder(compose(0, 0.62, 9, 0, 0, 0, 4.4, 0.05, 4.4), "#5fc8d8", 16);

  const pieces: Record<string, GpuMesh> = {};
  for (const k of "prnbqk") { pieces[k.toUpperCase()] = r.upload(chessPiece(k, "#f4ead6").build()); pieces[k] = r.upload(chessPiece(k, "#3a2a22").build()); }
  const man: Record<string, GpuMesh> = {};
  for (const [k, col] of [["r", "#c8323a"], ["b", "#2e2b2a"]]) {
    const one = new MeshBuilder().cylinder(compose(0, 0.18, 0, 0, 0, 0, 1.15, 0.36, 1.15), col, 18);
    one.torus(compose(0, 0.37, 0, 0, 0, 0, 0.36), col === "#c8323a" ? "#e86a6a" : "#5a5550", 1, 0.12, 16, 4);
    man[k] = r.upload(one.build());
    const two = new MeshBuilder().merge(one);
    two.cylinder(compose(0, 0.55, 0, 0, 0, 0, 1.15, 0.36, 1.15), col, 18);
    two.sphere(compose(0, 0.8, 0, 0, 0, 0, 0.2), "#f5c242", 5, 8);
    man[k.toUpperCase()] = r.upload(two.build());
  }
  const tile = r.upload(new MeshBuilder().box(compose(0, 0, 0, 0, 0, 0, 1, 0.04, 1), "#ffffff").build());
  // A standing portrait frame (the beaver stands in front of it; the whole thing tips over when ruled out).
  const card = new MeshBuilder();
  card.box(compose(0, 0.95, -0.15, 0, 0, 0, 1.5, 1.9, 0.1), "#7a4b2c");
  card.box(compose(0, 0.95, -0.09, 0, 0, 0, 1.3, 1.7, 0.04), "#fbf2dc");
  card.box(compose(0, 0.05, 0.1, 0, 0, 0, 1.5, 0.1, 0.6), "#5b3a24");
  const house = new MeshBuilder().box(compose(0, 0.25, 0, 0, 0, 0, 0.45, 0.5, 0.45), "#3f8a5a");
  house.cone(compose(0, 0.62, 0, Math.PI / 4, 0, 0, 0.7, 0.3, 0.7), "#2f6a45", 4);
  const hotel = new MeshBuilder().box(compose(0, 0.4, 0, 0, 0, 0, 1.2, 0.8, 0.6), "#c8323a");
  hotel.box(compose(0, 0.85, 0, 0, 0, 0, 1.3, 0.1, 0.7), "#8a2a24");
  const ring = new MeshBuilder().torus(compose(0, 0, 0), "#ffd93b", 1, 0.08, 20, 4);
  return {
    world: r.upload(w.build()), lawn: r.upload(lawn.build()), mtn: buildMountains(r, 21, [170, 280], 14), water: r.upload(water.build()),
    pieces, man, tile, card: r.upload(card.build()), house: r.upload(house.build()), hotel: r.upload(hotel.build()), ring: r.upload(ring.build()),
  };
}

/** World position of city-board lot i (GO in the near-right corner, play runs clockwise). */
function tyCell(i: number): [number, number] {
  const s = st("tycoon");
  let c: number, rr: number;
  if (i < 6) { c = 6 - i; rr = 6; } else if (i < 12) { c = 0; rr = 6 - (i - 6); } else if (i < 18) { c = i - 12; rr = 0; } else { c = 6; rr = i - 18; }
  return [s.x + (c - 3) * TY_CELL, s.z + (rr - 3) * TY_CELL];
}

const sqPos = (g: "chess" | "checkers", sq: number): [number, number] => {
  const s = st(g), S = g === "chess" ? S_CHESS : S_CHECK;
  return [s.x + ((sq & 7) - 3.5) * S, s.z + (3.5 - (sq >> 3)) * S];
};
const gwPos = (i: number): [number, number] => {
  const s = st("guesswho");
  return [s.x + ((i % 6) - 2.5) * GW_SP, s.z + (Math.floor(i / 6) - 1.5) * GW_SP];
};
const roomPos = (i: number): [number, number] => {
  const s = st("mystery");
  return [s.x + ((i % 3) - 1) * MY_ROOM, s.z + (Math.floor(i / 3) - 1) * MY_ROOM];
};

/** A bot's look from its name, so the same bot always looks the same. */
function botLook(name: string, base: Look): Look {
  const k = hashString(name);
  return { ...base, fur: FUR_COLORS[k % FUR_COLORS.length], hat: ["hat_toque_teal", "hat_ranger", "hat_earmuffs", "hat_party", null][k % 5], scarf: null, backpack: null, trail: null };
}

// ------------------------------------------------------------------ Scene

export class EstateScene implements Scene {
  private m: Meshes;
  private me = { x: GATE.x, z: GATE.z - 4, ry: Math.PI, tr: Math.PI, walk: 0, moving: 0 };
  private yaw = 0;
  private time = 0;
  private root: HTMLElement;
  private labels: HTMLElement;
  private actionEl: HTMLElement;
  private panel: HTMLElement;
  private actionKey = "";
  private joystick: Joystick | null = null;
  private night = 0;
  private mood!: WorldMood;
  private photo: PhotoMode;
  private view: BoardView | null = null;
  private table: BoardGame | null = null;
  private queued: { game: BoardGame; lobby: LobbyWire | null; at: number } | null = null;
  /** Tables other beavers on the lawn are waiting at. */
  private open = new Map<BoardGame, LobbyWire>();
  private others: Others;
  private chat: { el: HTMLElement; focus: () => void };
  private sendAcc = 0;
  private lastSent = { x: NaN, z: NaN, ry: NaN };
  private sel = -1;
  private camT = 0;
  private cam: Vec3 = [0, 10, 40];
  private look: Vec3 = [0, 0, 0];
  private stationTags: HTMLElement[] = [];
  private roomTags: HTMLElement[] = [];
  private seatTags: HTMLElement[] = [];
  private pick: { suspect: number; item: number; room: number; accuse: boolean } = { suspect: 0, item: 6, room: 12, accuse: false };
  private gwGuess = -1;
  private ended: { coins: number } | null = null;
  private lastRev = -1;
  /** Set after leaving a table, so the server's goodbye doesn't reopen it. */
  private leaving = false;

  constructor(private ctx: Ctx, m: Extract<ServerMsg, { t: "estate" }>) {
    this.m = build(ctx.r);
    this.root = h("div", { style: "position:absolute;inset:0" });
    this.labels = h("div", { style: "position:absolute;inset:0;overflow:hidden;pointer-events:none" });
    this.others = new Others(ctx, this.labels, m.players);
    this.chat = chatBar(ctx);
    this.actionEl = h("div.action.pe");
    this.panel = h("div.card.pe", { style: "position:absolute;right:12px;top:64px;width:min(340px,calc(100vw - 24px));max-height:calc(100% - 150px);overflow:auto;padding:12px;display:none;font-size:14px" });
    this.root.append(
      this.labels,
      h("div.hud-top", {}, [h("div.pill", {}, "🎲 The Board Game Estate"), h("div.row", {}, [h("div.pill.coins", {}, `🪙 ${ctx.state.coins}`)])]),
      this.actionEl,
      this.panel,
      h("div.dock", {}, [
        h("button.btn.cream.icon.pe", { title: "Photo mode", onclick: () => this.photo.open(this.me.ry, 6.5) }, "📷"),
        h("button.btn.orange.icon.pe", { title: "Back to Downtown", onclick: () => this.leave() }, "🚪"),
      ]),
      h("div.hud-bottom", {}, [
        this.chat.el,
        h("button.btn.orange.icon.pe", { title: "Wave", onclick: () => ctx.net.send({ t: "emote", i: 0 }) }, "👋"),
      ]),
    );
    window.addEventListener("keydown", this.onKey);
    for (const s of STATIONS) {
      const el = h("div.place", {}, `${BOARD_INFO[s.game].icon} ${BOARD_INFO[s.game].name}`);
      this.labels.append(el);
      this.stationTags.push(el);
    }
    for (let i = 0; i < 9; i++) { const el = h("div.tag", { style: "font-size:12px;opacity:.85" }, MY_ROOMS[i]); this.labels.append(el); this.roomTags.push(el); }
    ctx.ui.append(this.root);
    this.photo = new PhotoMode(ctx, this.root, { place: () => "The Board Game Estate, Banff", onShot: () => ctx.net.send({ t: "photo" }) });
    if (wantsJoystick(ctx.prefs)) this.joystick = new Joystick(this.root);
    const company = m.players.length ? ` ${m.players.length === 1 ? `${m.players[0].name} is` : `${m.players.length} beavers are`} here too!` : "";
    toast(this.root, `🎲 Welcome to the Board Game Estate! Walk up to any giant game to play.${company}`, 4200);
  }

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT" || this.photo.active) return;
    if (e.key === "Enter") { this.chat.focus(); e.preventDefault(); }
  };

  /** Tells the others where you are, a few times a second while you're moving. */
  private sendMove(dt: number) {
    this.sendAcc += dt;
    if (this.sendAcc < 0.1) return;
    this.sendAcc = 0;
    const me = this.me, l = this.lastSent;
    if (Math.hypot(me.x - l.x, me.z - l.z) < 0.02 && Math.abs(me.tr - l.ry) < 0.02) return;
    this.lastSent = { x: me.x, z: me.z, ry: me.tr };
    this.ctx.net.send({ t: "move", x: Math.round(me.x * 100) / 100, z: Math.round(me.z * 100) / 100, ry: Math.round(me.tr * 100) / 100 });
  }

  private leave() {
    if (this.table && !this.ended) this.ctx.net.send({ t: "boardQuit" });
    this.ctx.net.send({ t: "estate", enter: false });
  }

  handle(m: ServerMsg) {
    if (this.others.handle(m)) return;
    if (m.t === "lobbies") {
      this.open.clear();
      for (const l of m.list) if (l.kind === "board") this.open.set(l.game as BoardGame, l);
      this.actionKey = "";
    }
    if (m.t === "wallet") { this.ctx.state.coins = m.coins; const c = this.root.querySelector(".coins"); if (c) c.textContent = `🪙 ${m.coins}`; }
    if (m.t === "error") toast(this.root, m.text);
    if (m.t === "lifeSay") toast(this.root, m.text, 4200);
    if (m.t === "queue") {
      if (m.lobby && m.lobby.kind === "board") {
        // Waiting at a new table: anything from here on is about that one.
        this.leaving = false;
        this.queued = { game: m.lobby.game as BoardGame, lobby: m.lobby, at: performance.now() };
      } else if (!m.lobby) this.queued = null;
      this.actionKey = "";
    }
    if ((m.t === "board" || m.t === "boardEnd") && this.leaving) return;
    if (m.t === "board") {
      const fresh = !this.view;
      this.queued = null;
      this.ended = null;
      this.view = m.v;
      this.table = m.v.game;
      if (fresh) { this.camT = 0; this.sel = -1; this.ctx.sound.play("chime"); }
      if (m.v.rev !== this.lastRev) {
        if (!fresh && m.v.turn === m.v.you) this.ctx.sound.play("pop", 0.6);
        this.lastRev = m.v.rev;
      }
      this.drawPanel();
    }
    if (m.t === "boardEnd") {
      this.view = m.v;
      this.ended = { coins: m.coins };
      const won = m.v.winner === m.v.you;
      this.ctx.sound.play(won ? "quest" : "chime");
      this.drawPanel();
    }
  }

  private send(a: BoardAction) { this.ctx.net.send({ t: "boardAct", a }); }

  private stand() {
    if (this.table && !this.ended) this.ctx.net.send({ t: "boardQuit" });
    this.leaving = true;
    this.view = null;
    this.table = null;
    this.ended = null;
    this.panel.style.display = "none";
    for (const t of this.seatTags) t.remove();
    this.seatTags = [];
  }

  // ---------------------------------------------------------------- Prompts (DOM)

  private drawPanel() {
    const v = this.view;
    if (!v) { this.panel.style.display = "none"; return; }
    this.panel.style.display = "";
    const info = BOARD_INFO[v.game];
    const myTurn = v.turn === v.you && v.winner === null;
    const who = (i: number) => (i === v.you ? "You" : v.seats[i]?.name ?? "?");
    const kids: (HTMLElement | string)[] = [h("div", { style: "display:flex;justify-content:space-between;align-items:center;gap:8px" }, [h("b", { style: "font-size:16px" }, `${info.icon} ${info.name}`), h("button.btn.cream.small", { onclick: () => this.stand() }, this.ended ? "Leave" : "Resign")])];
    if (this.ended) {
      const won = v.winner === v.you;
      kids.push(h("h3", { style: "margin:8px 0" }, v.winner === "draw" ? "🤝 A draw!" : won ? "🏆 You win!" : v.winner === null ? "Game over" : `${who(v.winner as number)} won!`));
      if (this.ended.coins) kids.push(h("div", {}, `+🪙 ${this.ended.coins}`));
      if (v.game === "guesswho" && v.guesswho?.reveal) kids.push(h("div.hint", {}, `Their beaver was ${GW_SUSPECTS[v.guesswho.reveal[1 - v.you]]?.name}.`));
      if (v.game === "mystery" && v.mystery?.answer) { const [a, b, c] = v.mystery.answer; kids.push(h("div.hint", {}, `It was ${cardName(a)} in the ${cardName(c)} with the ${cardName(b)}!`)); }
      kids.push(h("button.btn.orange", { style: "margin-top:8px", onclick: () => { this.stand(); this.ctx.net.send({ t: "boardQueue", game: v.game }); } }, "Play again"));
    } else {
      kids.push(h("div", { style: `margin:6px 0;font-weight:700;color:${myTurn ? "var(--teal-dk)" : "var(--muted)"}` }, myTurn ? "Your turn!" : `${who(v.turn)} is thinking…`));
    }
    kids.push(h("div.hint", { style: "margin:0 0 6px" }, v.seats.map((s, i) => `${i === v.turn ? "▶ " : ""}${i === v.you ? "You" : s.name}${s.resigned ? " (left)" : ""}`).join(" · ")));
    if (!this.ended) kids.push(...this.gamePanel(v, myTurn));
    const log = [...v.log.slice(-3)];
    if (log.length) kids.push(h("div.hint", { style: "margin-top:8px;font-size:12px" }, log.join(" · ")));
    this.panel.replaceChildren(...kids);
  }

  private gamePanel(v: BoardView, myTurn: boolean): (HTMLElement | string)[] {
    const out: (HTMLElement | string)[] = [];
    const btn = (label: string, fn: () => void, cls = ".orange") => h(`button.btn.small${cls}`, { onclick: fn }, label);
    if (v.chess) {
      out.push(h("div.hint", {}, `You're ${v.you === 0 ? "white ♙" : "black ♟"}. Click one of your pieces, then a glowing square.${v.chess.check ? " ⚠️ Check!" : ""}`));
    } else if (v.checkers) {
      out.push(h("div.hint", {}, `You're ${v.you === 0 ? "red 🔴" : "black ⚫"}. Click a piece, then a glowing square.${v.checkers.chain >= 0 ? " Keep jumping!" : ""}`));
    } else if (v.guesswho) {
      const g = v.guesswho;
      const left = g.up.filter(Boolean).length;
      out.push(h("div", {}, ["Your secret beaver: ", h("b", {}, GW_SUSPECTS[g.mine]?.name ?? "?")]));
      out.push(h("div.hint", {}, `${left} faces left on your board · they have ${g.theirUpCount} left.`));
      const mine = g.log.filter((l) => l.seat === v.you).slice(-3).map((l) => l.q ? `${GW_QUESTIONS.find((q) => q.id === l.q)?.text} ${l.yes ? "Yes" : "No"}` : "");
      const theirs = g.log.filter((l) => l.seat !== v.you).slice(-1).map((l) => l.q ? `They asked: ${GW_QUESTIONS.find((q) => q.id === l.q)?.text} (${l.yes ? "Yes" : "No"})` : "");
      for (const t of [...mine, ...theirs]) if (t) out.push(h("div.hint", { style: "margin:2px 0;font-size:12px" }, t));
      if (myTurn) {
        out.push(h("div", { style: "margin-top:6px;font-weight:700" }, "Ask a question:"));
        out.push(h("div", { style: "display:flex;flex-wrap:wrap;gap:4px" }, GW_QUESTIONS.map((q) => btn(q.text, () => this.send({ g: "guesswho", kind: "ask", q: q.id }), ".cream"))));
        out.push(h("div.hint", { style: "margin-top:6px" }, "…or click a standing portrait to guess who it is."));
        if (this.gwGuess >= 0) out.push(h("div.row", { style: "gap:6px;margin-top:4px" }, [btn(`Guess ${GW_SUSPECTS[this.gwGuess].name}!`, () => { this.send({ g: "guesswho", kind: "guess", id: this.gwGuess }); this.gwGuess = -1; }), btn("Cancel", () => { this.gwGuess = -1; this.drawPanel(); }, ".cream")]));
      }
    } else if (v.mystery) {
      const my = v.mystery;
      if (my.out[v.you]) out.push(h("div.hint", {}, "Your accusation was wrong, so you're out of the running, but you still show cards."));
      if (myTurn) {
        if (my.phase === "roll") out.push(btn("🎲 Roll", () => this.send({ g: "mystery", kind: "roll" })));
        if (my.phase === "move") out.push(h("div", {}, `You rolled ${my.roll}. Click a glowing room to walk there (or stay where you are).`), btn("Stay here", () => this.send({ g: "mystery", kind: "move", room: my.room[v.you] }), ".cream"));
        if (my.phase === "suggest" || this.pick.accuse) {
          const sel = (label: string, list: string[], base: number, key: "suspect" | "item" | "room") => h("label", { style: "display:grid;gap:2px;font-weight:700" }, [label, h("select", {
            onchange: (e: Event) => { this.pick[key] = base + Number((e.target as HTMLSelectElement).value); },
          }, list.map((n, i) => h("option", { value: String(i), ...(this.pick[key] === base + i ? { selected: "" } : {}) }, n)))]);
          out.push(h("div", { style: "display:grid;gap:6px;margin:6px 0" }, [
            sel("Who?", MY_SUSPECTS, 0, "suspect"), sel("With what?", MY_ITEMS, 6, "item"),
            this.pick.accuse ? sel("Where?", MY_ROOMS, 12, "room") : h("div.hint", { style: "margin:0" }, `In the ${MY_ROOMS[my.room[v.you]]}`),
          ]));
          out.push(h("div.row", { style: "gap:6px;flex-wrap:wrap" }, this.pick.accuse ? [
            btn("⚖️ Accuse!", () => { this.send({ g: "mystery", kind: "accuse", suspect: this.pick.suspect, item: this.pick.item, room: this.pick.room }); this.pick.accuse = false; }),
            btn("Not yet", () => { this.pick.accuse = false; this.drawPanel(); }, ".cream"),
          ] : [btn("🔍 Suggest", () => this.send({ g: "mystery", kind: "suggest", suspect: this.pick.suspect, item: this.pick.item }))]));
        }
        if (!this.pick.accuse) out.push(h("div.row", { style: "gap:6px;margin-top:6px" }, [btn("⚖️ Make an accusation", () => { this.pick.accuse = true; this.drawPanel(); }, ".cream"), my.phase === "end" || my.phase === "suggest" ? btn("End turn", () => this.send({ g: "mystery", kind: "end" }), ".cream") : ""]));
      }
      // Detective's notebook.
      const known = new Set([...my.hand, ...Object.keys(my.seen).map(Number)]);
      const col = (title: string, from: number, n: number) => h("div", {}, [h("b", {}, title), ...Array.from({ length: n }, (_, i) => {
        const c = from + i;
        const mark = my.hand.includes(c) ? "✋" : known.has(c) ? "✓" : "";
        return h("div", { style: `font-size:12px;${mark ? "text-decoration:line-through;opacity:.55" : "font-weight:700"}` }, `${mark || "◻"} ${cardName(c)}`);
      })]);
      out.push(h("div", { style: "display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px;padding:8px;border:2px dashed var(--ink);border-radius:10px;background:#fffbe9" }, [col("Who", 0, 6), col("What", 6, 6), col("Where", 12, 9)]));
      const last = my.log.slice(-3).map((l) => `${l.seat === v.you ? "You" : v.seats[l.seat]?.name} ${l.text}${l.to !== undefined ? ` · ${l.to === v.you ? "you" : v.seats[l.to]?.name} showed ${l.card !== undefined ? `“${cardName(l.card)}”` : "a card"}` : ""}`);
      for (const t of last) out.push(h("div.hint", { style: "margin:2px 0;font-size:12px" }, t));
    } else if (v.tycoon) {
      const t = v.tycoon;
      const me = t.players[v.you];
      out.push(h("div", { style: "display:grid;gap:2px" }, t.players.map((p, i) => h("div", { style: i === v.turn ? "font-weight:800" : "" }, `${i === v.you ? "You" : v.seats[i].name}: 🪙${p.money}${p.jail ? " 🔒" : ""}${p.out ? " (bankrupt)" : ""} · on ${TY_BOARD[p.pos].name}`))));
      out.push(h("div.hint", {}, `Round ${t.round}/${TY.maxRounds} · 🎲 ${t.dice[0]} + ${t.dice[1]}`));
      if (t.card) out.push(h("div", { style: "padding:6px;border:2px solid var(--ink);border-radius:8px;background:#fff2cc;margin:4px 0" }, `🃏 ${t.card}`));
      if (myTurn) {
        const sp = TY_BOARD[me.pos];
        const row: HTMLElement[] = [];
        if (t.phase === "roll") { row.push(btn("🎲 Roll", () => this.send({ g: "tycoon", kind: "roll" }))); if (me.jail) row.push(btn(`Pay bail 🪙${TY.jailFine}`, () => this.send({ g: "tycoon", kind: "bail" }), ".cream")); }
        if (t.phase === "buy") row.push(btn(`Buy ${sp.name} 🪙${sp.price}`, () => this.send({ g: "tycoon", kind: "buy" })), btn("Pass", () => this.send({ g: "tycoon", kind: "pass" }), ".cream"));
        if (t.phase === "end") row.push(btn("End turn", () => this.send({ g: "tycoon", kind: "end" })));
        out.push(h("div.row", { style: "gap:6px;flex-wrap:wrap;margin:6px 0" }, row));
        const state = { players: t.players, owner: t.owner, houses: t.houses } as unknown as TycoonState;
        const buildable = TY_BOARD.map((s2, i) => ({ s2, i })).filter(({ s2, i }) => s2.kind === "street" && t.owner[i] === v.you && ownsSet(state, v.you, s2.group!) && t.houses[i] < TY.maxHouses);
        if (buildable.length) out.push(h("div", {}, [h("b", {}, "Build:"), h("div", { style: "display:flex;flex-wrap:wrap;gap:4px" }, buildable.map(({ s2, i }) => btn(`🏠 ${s2.name} 🪙${TY_GROUPS[s2.group!].house}`, () => this.send({ g: "tycoon", kind: "build", space: i }), ".cream")))]));
      }
      const mine = TY_BOARD.map((s2, i) => (t.owner[i] === v.you ? s2.name : "")).filter(Boolean);
      if (mine.length) out.push(h("div.hint", { style: "font-size:12px" }, `Your streets: ${mine.join(", ")}`));
      for (const l of t.log.slice(-3)) out.push(h("div.hint", { style: "margin:2px 0;font-size:12px" }, `${l.seat === v.you ? "You" : v.seats[l.seat]?.name} ${l.text}`));
    }
    return out;
  }

  // ---------------------------------------------------------------- Clicking on the boards

  private onTap(px: number, py: number) {
    const v = this.view;
    if (!v || this.ended || v.turn !== v.you || v.winner !== null) return;
    const r = this.ctx.r;
    if (v.chess || v.checkers) {
      const g = v.chess ? "chess" : "checkers";
      const S = g === "chess" ? S_CHESS : S_CHECK, s = st(g);
      const p = r.pickGround(px, py, 0.3);
      if (!p) return;
      const f = Math.floor((p.x - s.x) / S + 4), rk = Math.floor(4 - (p.z - s.z) / S);
      if (f < 0 || f > 7 || rk < 0 || rk > 7) { this.sel = -1; return; }
      const sq = rk * 8 + f;
      const moves = (v.chess?.moves ?? v.checkers?.moves ?? []) as number[][];
      if (this.sel >= 0 && moves.some(([a, b]) => a === this.sel && b === sq)) {
        if (g === "chess") this.send({ kind: "chess", from: this.sel, to: sq, promo: "q" });
        else this.send({ kind: "checkers", from: this.sel, to: sq });
        this.sel = -1;
        this.ctx.sound.play("pop");
        return;
      }
      this.sel = moves.some(([a]) => a === sq) ? sq : -1;
      if (this.sel >= 0) this.ctx.sound.play("step-snow", 0.5);
    } else if (v.guesswho) {
      const p = r.pickGround(px, py, 0.9);
      if (!p) return;
      let best = -1, bd = 1.1;
      for (let i = 0; i < 24; i++) { const [x, z] = gwPos(i); const d = Math.hypot(p.x - x, p.z - z); if (d < bd && v.guesswho.up[i]) { bd = d; best = i; } }
      if (best >= 0) { this.gwGuess = best; this.drawPanel(); }
    } else if (v.mystery && v.mystery.phase === "move") {
      const p = r.pickGround(px, py, 0.1);
      if (!p) return;
      const s = st("mystery");
      const c = Math.floor((p.x - s.x) / MY_ROOM + 1.5), rr = Math.floor((p.z - s.z) / MY_ROOM + 1.5);
      if (c < 0 || c > 2 || rr < 0 || rr > 2) return;
      this.send({ g: "mystery", kind: "move", room: rr * 3 + c });
    }
  }

  // ---------------------------------------------------------------- Loop

  private nearby(): Station | null {
    for (const s of STATIONS) if (Math.hypot(this.me.x - s.x, this.me.z - s.z) < s.r) return s;
    return null;
  }

  private frameDt = 0.016;

  update(dt: number) {
    this.time += dt;
    this.frameDt = dt;
    this.others.update(dt);
    if (this.photo.active) { this.photo.update(dt); return; }
    const inp = this.ctx.input;
    const tap = inp.consumeTap();
    if (this.view) {
      if (tap) this.onTap(tap.x, tap.y);
      this.camT = Math.min(1, this.camT + dt * 1.5);
      this.actionKey = "";
      this.actionEl.replaceChildren();
      this.yaw -= inp.consumeDrag() * 0.004;
      return;
    }
    this.yaw -= inp.consumeDrag() * 0.006;
    if (inp.down("q")) this.yaw += dt * 1.8;
    if (inp.down("e")) this.yaw -= dt * 1.8;
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
      let nx = me.x + (mx / len) * 6.5 * dt, nz = me.z + (mz / len) * 6.5 * dt;
      const d = Math.hypot(nx, nz);
      if (d > R - 5 && !(Math.abs(nx - GATE.x) < 3 && nz > 0)) { nx *= (R - 5) / d; nz *= (R - 5) / d; }
      // The mansion and the fountain are solid.
      if (Math.abs(nx - MANSION.x) < MANSION.w / 2 + 3 && nz < MANSION.z + MANSION.d / 2 + 1 && nz > MANSION.z - MANSION.d) nz = MANSION.z + MANSION.d / 2 + 1;
      const fd = Math.hypot(nx, nz - 9);
      if (fd < 2.8) { nx = (nx / fd) * 2.8; nz = 9 + ((nz - 9) / fd) * 2.8; }
      me.x = nx; me.z = nz;
      me.tr = Math.atan2(mx, mz);
    }
    this.sendMove(dt);
    // Walking out through the gate takes you back to town.
    if (me.z > GATE.z + 5) { this.leave(); me.z = GATE.z + 4; }
    me.moving = lerp(me.moving, len > 0 ? 1 : 0, Math.min(1, dt * 10));
    me.ry = lerpAngle(me.ry, me.tr, Math.min(1, dt * 12));
    me.walk += dt * 11 * me.moving;
    const s = this.nearby();
    this.updateAction(s);
  }

  /** The action card: sit down at the table you're beside, or the table you're waiting at. */
  private updateAction(s: Station | null) {
    const me = this.me;
    const q = this.queued;
    const lob = q?.lobby;
    const secs = lob?.startsInMs != null ? Math.max(0, Math.ceil((lob.startsInMs - (performance.now() - q!.at)) / 1000)) : null;
    const waiting = s ? this.open.get(s.game) : undefined;
    const key = q ? `q:${q.game}:${lob?.count}:${secs}` : s ? `s:${s.game}:${waiting?.count ?? 0}` : Math.hypot(me.x - GATE.x, me.z - GATE.z) < 6 ? "gate" : "";
    if (key === this.actionKey) return;
    this.actionKey = key;
    const big = (label: string, fn: () => void, cls = "") => h(`button.btn${cls}`, { onclick: fn, style: "font-size:19px;padding:12px 20px" }, label);
    let kids: (HTMLElement | string)[] = [];
    if (q) {
      const info = BOARD_INFO[q.game];
      const n = lob?.count ?? 1, size = lob?.size ?? info.seats[1];
      const status = secs !== null ? `${info.icon} ${info.name} · ${n}/${size} · starting in ${secs}s` : `${info.icon} ${info.name} · waiting for another beaver…`;
      kids = [
        h("div.card", { style: "padding:8px 14px;font-weight:700;text-align:center" }, [status, lob && lob.names.length > 1 ? h("div.hint", { style: "margin:2px 0 0" }, lob.names.join(", ")) : ""]),
        h("div.row", { style: "gap:8px;justify-content:center" }, [
          n >= (lob?.min ?? 2) ? big("▶ Start now", () => this.ctx.net.send({ t: "lobbyStart" }), ".orange") : "",
          big("Leave", () => this.ctx.net.send({ t: "lobbyLeave" }), ".cream"),
        ]),
      ];
    } else if (s) {
      const info = BOARD_INFO[s.game];
      const label = waiting ? `${info.icon} Join ${waiting.names.slice(0, 2).join(" & ")} at ${info.name}` : `${info.icon} Play ${info.name}`;
      kids = [
        big(label, () => { this.leaving = false; this.ctx.net.send({ t: "boardQueue", game: s.game }); }),
        h("div.card", { style: "padding:6px 10px;max-width:min(420px,90vw);font-size:13px;text-align:center" }, info.how),
      ];
    } else if (key === "gate") kids = [big("🚪 Back to Downtown", () => this.leave())];
    this.actionEl.replaceChildren(kids.length ? h("div", { style: "display:grid;gap:6px;justify-items:center" }, kids) : "");
  }

  private seatLook(i: number): Look {
    const v = this.view!;
    return i === v.you ? this.ctx.state.look : botLook(v.seats[i]?.name ?? String(i), this.ctx.state.look);
  }

  render() {
    const { r } = this.ctx;
    r.time = this.time;
    this.night = applyTimeOfDay(r, dayPhase(this.ctx.prefs.time));
    this.mood = currentMood(this.ctx.prefs);
    applyMood(r, this.mood);
    r.resize();
    const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
    const me = this.me;
    const v = this.view;
    let cam: Vec3, look: Vec3;
    if (v) {
      const s = st(v.game);
      const flip = (v.game === "chess" || v.game === "checkers") && v.you === 1 ? -1 : 1;
      const dist = v.game === "tycoon" ? 17 : v.game === "mystery" ? 17 : v.game === "guesswho" ? 11 : 14.5;
      const height = v.game === "guesswho" ? 7 : v.game === "chess" || v.game === "checkers" ? 15.5 : 14;
      // Leave room on the right for the prompt card on wide screens.
      const side = aspect > 1.2 ? 3 : 0;
      const wantCam: Vec3 = [s.x + side + Math.sin(this.yaw * 0.3) * 3, height, s.z + flip * dist];
      const wantLook: Vec3 = [s.x + side, 0, s.z + flip * (v.game === "guesswho" ? 0 : v.game === "chess" || v.game === "checkers" ? -0.5 : 1)];
      const k = 1 - Math.exp(-this.frameDt * (this.camT < 1 ? 3 : 6));
      for (let i = 0; i < 3; i++) { this.cam[i] = lerp(this.cam[i], wantCam[i], k); this.look[i] = lerp(this.look[i], wantLook[i], k); }
      cam = [...this.cam] as Vec3; look = [...this.look] as Vec3;
    } else {
      const dist = 11, pitch = 0.42, y = groundY(me.x, me.z);
      cam = [me.x + Math.sin(this.yaw) * Math.cos(pitch) * dist, y + 1.5 + Math.sin(pitch) * dist, me.z + Math.cos(this.yaw) * Math.cos(pitch) * dist];
      look = [me.x, y + 1.5, me.z];
      this.cam = [...cam] as Vec3; this.look = [...look] as Vec3;
    }
    if (this.photo.active) { const pc = this.photo.camera([me.x, groundY(me.x, me.z) + 1.2, me.z]); cam = pc.eye; look = pc.target; }
    r.shadowFocus = [look[0], 0, look[2]];
    r.cutFocus = null;
    r.begin(lookAt(cam, look), perspective(aspect < 0.8 ? 1.05 : 0.86, aspect, 0.4, 3000), cam);
    const I = compose(0, 0, 0);
    r.draw(this.m.mtn, compose(0, -8, 0), { noCast: true });
    r.draw(this.m.lawn, I, { noCast: true });
    r.draw(this.m.world, I, { sway: 0.08 });
    r.draw(this.m.water, I, { wave: 1, alpha: 0.85 });
    drawWeather(r, this.mood, this.time, cam, this.night);
    const pose = (extra: Partial<BeaverPose> = {}): BeaverPose => ({ walk: 0, moving: 0, swim: 0, jump: 0, wave: 0, sled: 0, time: this.time, ...extra });

    this.drawBoards(r, pose);
    this.others.draw(r, groundY);
    // You, walking about (or standing at your seat while you play).
    if (!v) {
      const p = this.photo.active ? this.photo.pose() : null;
      drawBeaver(r, getBeaverMeshes(r, this.ctx.state.look), compose(me.x, groundY(me.x, me.z), me.z, me.ry), pose({ walk: me.walk, moving: me.moving, seed: 1, jump: p?.jump ?? 0, wave: p?.wave ?? 0, cheer: p?.cheer ?? 0, expr: p?.expr ?? (this.nearby() ? "happy" : "neutral") }));
    }
    r.end();
    this.photo.afterRender();
    this.placeLabels(r);
    this.others.placeLabels(r, groundY, this.photo.active);
  }

  /** Draws all five games: the one you're playing from your view, the others in their opening position. */
  private drawBoards(r: Renderer, pose: (e?: Partial<BeaverPose>) => BeaverPose) {
    const v = this.view;
    const seated = (game: BoardGame, i: number, x: number, z: number, ry: number, extra: Partial<BeaverPose> = {}, token = false) => {
      // Other real players are already standing on the lawn; only game tokens and bots are drawn here.
      if (!token && v && i !== v.you && !v.seats[i]?.isBot) return;
      const turn = v && v.game === game && v.turn === i && v.winner === null;
      const won = v && v.game === game && v.winner === i;
      drawBeaver(r, getBeaverMeshes(r, this.seatLook(i)), compose(x, 0, z, ry), pose({ seed: i * 1.7, cheer: won ? 1 : 0, wave: turn && v!.you !== i ? Math.max(0, Math.sin(this.time * 2)) * 0.4 : 0, expr: won ? "excited" : turn ? "determined" : "neutral", ...extra }));
    };
    // ---- Chess
    {
      const board = v?.chess ? v.chess.board : "RNBQKBNRPPPPPPPP" + " ".repeat(32) + "pppppppprnbqkbnr";
      for (let sq = 0; sq < 64; sq++) {
        const p = (board[sq] ?? "").trim();
        if (!p) continue;
        const [x, z] = sqPos("chess", sq);
        const lift = v?.chess && this.sel === sq ? 0.4 + Math.sin(this.time * 6) * 0.1 : 0;
        r.draw(this.m.pieces[p], compose(x, 0.3 + lift, z, p === "N" ? Math.PI : 0, 0, 0, 1.15), { outline: 0.03 });
      }
      if (v?.chess) {
        this.highlights("chess", v.chess.moves, v.chess.last);
        seated("chess", 0, st("chess").x - 4.5, st("chess").z + 7.6, Math.PI - 0.4);
        seated("chess", 1, st("chess").x + 4.5, st("chess").z - 7.6, -0.4);
      }
    }
    // ---- Checkers
    {
      const s = st("checkers");
      let board: string[];
      if (v?.checkers) board = v.checkers.board;
      else { board = Array(64).fill(""); for (let sq = 0; sq < 64; sq++) if (isDark(sq)) board[sq] = sq >> 3 < 3 ? "r" : sq >> 3 > 4 ? "b" : ""; }
      for (let sq = 0; sq < 64; sq++) {
        const p = board[sq];
        if (!p) continue;
        const [x, z] = sqPos("checkers", sq);
        const lift = v?.checkers && this.sel === sq ? 0.3 + Math.sin(this.time * 6) * 0.08 : 0;
        r.draw(this.m.man[p], compose(x, 0.3 + lift, z), { outline: 0.03 });
      }
      if (v?.checkers) {
        this.highlights("checkers", v.checkers.moves, v.checkers.last);
        seated("checkers", 0, s.x - 4.5, s.z + 7.2, Math.PI - 0.4);
        seated("checkers", 1, s.x + 4.5, s.z - 7.2, -0.4);
      }
    }
    // ---- Who's That Beaver?: your board of standing portraits; ruled-out ones lie flat.
    {
      const up = v?.guesswho?.up ?? Array(24).fill(true);
      for (let i = 0; i < 24; i++) {
        const [x, z] = gwPos(i);
        const standing = up[i];
        const tilt = standing ? 0 : -Math.PI / 2 + 0.05;
        const sel = v?.guesswho && this.gwGuess === i;
        r.draw(this.m.card, compose(x, 0.2, z + 0.15, 0, tilt, 0, 0.95), { outline: 0.02, tint: sel ? [1, 0.9, 0.5, 1] : undefined });
        if (standing) {
          const near = !v || v.game === "guesswho" || Math.hypot(this.me.x - x, this.me.z - z) < 30;
          if (near) drawBeaver(r, getBeaverMeshes(r, GW_SUSPECTS[i].look), compose(x, 0.25, z + 0.35, 0, 0, 0, 0.62), pose({ seed: i, expr: sel ? "surprised" : "neutral", wave: sel ? 1 : 0 }));
        }
      }
      if (v?.guesswho) {
        const s = st("guesswho");
        seated("guesswho", v.you, s.x - 7.2, s.z + 2.5, Math.PI / 2 + 0.5);
        seated("guesswho", 1 - v.you, s.x + 7.2, s.z + 2.5, -Math.PI / 2 - 0.5);
      }
    }
    // ---- Tycoon City: houses on owned lots and the players walking the board as tokens.
    {
      const t = v?.tycoon;
      if (t) {
        for (let i = 0; i < 24; i++) {
          const [x, z] = tyCell(i);
          if (t.owner[i] !== null) r.draw(this.m.tile, compose(x, 0.3, z, 0, 0, 0, TY_CELL * 0.8, 1, 0.25), { tint: [...hexToRgb(MY_COLORS[t.owner[i]!]), 1] as never, unlit: true });
          const n = t.houses[i];
          if (n >= 4) r.draw(this.m.hotel, compose(x, 0.28, z), { outline: 0.02 });
          else for (let k = 0; k < n; k++) r.draw(this.m.house, compose(x - 0.6 + k * 0.6, 0.28, z - 0.5), { outline: 0.02 });
        }
        t.players.forEach((p, i) => {
          if (p.out) return;
          const [x, z] = tyCell(p.pos);
          const ox = ((i % 2) - 0.5) * 0.8, oz = (Math.floor(i / 2) - 0.5) * 0.8;
          seated("tycoon", i, x + ox, z + oz, Math.atan2(st("tycoon").x - x, st("tycoon").z - z), { jump: i === v!.turn ? Math.max(0, Math.sin(this.time * 5)) * 0.3 : 0 }, true);
        });
      }
    }
    // ---- Mansion Mystery: suspects walk between the rooms of the floor plan.
    {
      const my = v?.mystery;
      if (my) {
        const reach = my.phase === "move" && v!.turn === v!.you ? Array.from({ length: 9 }, (_, i) => i).filter((i) => i === my.room[v!.you] || roomDistance(my.room[v!.you], i) <= Math.ceil(my.roll / 2)) : [];
        for (const i of reach) { const [x, z] = roomPos(i); r.draw(this.m.tile, compose(x, 0.14, z, 0, 0, 0, MY_ROOM - 0.6, 1, MY_ROOM - 0.6), { unlit: true, tint: [0.55, 1, 0.55, 1], alpha: 0.35 + Math.sin(this.time * 4) * 0.1 }); }
        my.room.forEach((room, i) => {
          const [x, z] = roomPos(room);
          const ox = ((i % 2) - 0.5) * 1.6, oz = (Math.floor(i / 2) - 0.5) * 1.6;
          seated("mystery", i, x + ox, z + oz, Math.PI, { expr: my.out[i] ? "dizzy" : undefined }, true);
          r.draw(this.m.ring, compose(x + ox, 0.15, z + oz, 0, 0, 0, 0.6), { unlit: true, tint: [...hexToRgb(MY_COLORS[i]), 1] as never });
        });
      }
    }
  }

  private highlights(g: "chess" | "checkers", moves: number[][], last: { from: number; to: number } | null) {
    const r = this.ctx.r;
    const S = g === "chess" ? S_CHESS : S_CHECK;
    const glow = (sq: number, col: [number, number, number], a: number) => { const [x, z] = sqPos(g, sq); r.draw(this.m.tile, compose(x, 0.32, z, 0, 0, 0, S * 0.94, 1, S * 0.94), { unlit: true, tint: [...col, 1], alpha: a }); };
    if (last) { glow(last.from, [1, 0.85, 0.3], 0.35); glow(last.to, [1, 0.85, 0.3], 0.45); }
    const froms = new Set(moves.map((m) => m[0]));
    if (this.sel >= 0) {
      glow(this.sel, [0.4, 0.8, 1], 0.6);
      for (const [a, b] of moves) if (a === this.sel) glow(b, [0.45, 1, 0.5], 0.45 + Math.sin(this.time * 5) * 0.12);
    } else for (const f of froms) glow(f, [0.45, 1, 0.5], 0.18 + Math.sin(this.time * 3) * 0.06);
  }

  private placeLabels(r: Renderer) {
    const hide = this.photo.active;
    STATIONS.forEach((s, i) => {
      const el = this.stationTags[i];
      const p = r.project(s.x, s.game === "mystery" ? 5 : 4.2, s.z + (s.game === "mystery" ? -9 : 0));
      const far = !this.view && Math.hypot(this.me.x - s.x, this.me.z - s.z) > 70;
      if (!p || hide || this.view || far) { el.style.display = "none"; return; }
      el.style.display = ""; el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
      const w = this.open.get(s.game);
      const text = `${BOARD_INFO[s.game].icon} ${BOARD_INFO[s.game].name}${w ? ` · ${w.count} waiting` : ""}`;
      if (el.textContent !== text) el.textContent = text;
    });
    const showRooms = !hide && (this.view?.game === "mystery" || Math.hypot(this.me.x - st("mystery").x, this.me.z - st("mystery").z) < 18);
    this.roomTags.forEach((el, i) => {
      const [x, z] = roomPos(i);
      const p = showRooms ? r.project(x, 0.6, z + MY_ROOM / 2 - 0.6) : null;
      if (!p) { el.style.display = "none"; return; }
      el.style.display = ""; el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
    });
  }

  dispose() {
    const r = this.ctx.r;
    for (const [k, g] of Object.entries(this.m)) {
      if (k === "pieces" || k === "man") for (const x of Object.values(g as Record<string, GpuMesh>)) r.dispose(x);
      else r.dispose(g as GpuMesh);
    }
    this.joystick?.dispose();
    this.photo.dispose();
    this.others.dispose();
    window.removeEventListener("keydown", this.onKey);
    this.root.remove();
  }
}
