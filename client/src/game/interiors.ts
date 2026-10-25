import { ARCADE_INFO, WORD_GAMES, WORD_INFO, type HubAct, type LeaderGame, type MiniGame, type WordGame } from "@beaver/shared";
import type { CasinoGame } from "@beaver/shared";
import { compose, hash2, hexToRgb, lerp, lerpAngle, lookAt, perspective, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh } from "../engine/renderer";
import { h } from "../ui/dom";
import type { Joystick } from "../ui/joystick";
import { drawBeaver, getBeaverMeshes } from "./beaver";
import { applyTimeOfDay } from "./daylight";
import { buildGymHall } from "./village/gymHall";
import type { Ctx } from "./scene";

/**
 * Walk-in interiors. Step through the door of a building that does something (the Sports Centre,
 * the Word Lodge, the Lucky Lodge, shops, the café…) and you're inside a room you can walk around,
 * with the games and counters where you'd expect them: stand at one and press the button.
 *
 * Interiors live inside the village scene. As far as the server knows you're still standing at the
 * door, so every game, lobby and activity works exactly as it does outside.
 */

export interface InteriorApi {
  queueGame(g: MiniGame): void;
  queueWord(g: WordGame): void;
  /** The game you're waiting for in a lobby, if any. */
  lobbyGame(): string | null;
  leaveLobby(): void;
  shop(tab: "hat" | "fur" | "dye" | "cabin"): void;
  life(kind: string, game?: LeaderGame): void;
  casino(tab: CasinoGame): void;
  act(a: HubAct): void;
  myAct(): HubAct | null;
  read(): void;
  photo(): void;
  toast(text: string): void;
}

interface Station { x: number; z: number; label: () => string; run: () => void; game?: string }
type Solid = [number, number, number, number]; // centre x, z, half-width, half-depth

interface RoomDef {
  title: string;
  w: number; d: number; h: number;
  build(m: MeshBuilder, glow: MeshBuilder, solids: Solid[]): void;
  stations(api: InteriorApi): Station[];
}

// ------------------------------------------------------------------ Building blocks

const C = (s: string) => hexToRgb(s);

function room(m: MeshBuilder, w: number, d: number, hgt: number, wall: string, floor: string | ((x: number, z: number) => string), trim = "#6b4426") {
  const x0 = -w / 2, z0 = -d / 2;
  for (let x = x0; x < w / 2 - 0.01; x += 1) for (let z = z0; z < d / 2 - 0.01; z += 1) {
    const col = typeof floor === "string" ? floor : floor(x, z);
    m.box(compose(x + 0.5, -0.05, z + 0.5, 0, 0, 0, 1, 0.1, 1), col);
  }
  m.box(compose(0, hgt / 2, z0 - 0.15, 0, 0, 0, w + 0.6, hgt, 0.3), wall);
  m.box(compose(x0 - 0.15, hgt / 2, 0, 0, 0, 0, 0.3, hgt, d), wall);
  m.box(compose(w / 2 + 0.15, hgt / 2, 0, 0, 0, 0, 0.3, hgt, d), wall);
  // Front wall with a doorway in the middle.
  const side = w / 2 - 1.1;
  m.box(compose(-(1.1 + side / 2), hgt / 2, d / 2 + 0.15, 0, 0, 0, side, hgt, 0.3), wall);
  m.box(compose(1.1 + side / 2, hgt / 2, d / 2 + 0.15, 0, 0, 0, side, hgt, 0.3), wall);
  m.box(compose(0, (hgt + 2.7) / 2, d / 2 + 0.15, 0, 0, 0, 2.2, hgt - 2.7, 0.3), wall);
  m.box(compose(0, 1.35, d / 2 + 0.25, 0, 0, 0, 2.2, 2.7, 0.08), "#8a5a34"); // the open door's frame glow
  // Skirting and ceiling.
  for (const [x, z, ww, dd] of [[0, z0 + 0.02, w, 0.06], [x0 + 0.02, 0, 0.06, d], [w / 2 - 0.02, 0, 0.06, d]] as const) m.box(compose(x, 0.15, z, 0, 0, 0, ww, 0.3, dd), trim);
  m.box(compose(0, hgt + 0.1, 0, 0, 0, 0, w + 0.6, 0.2, d + 0.6), "#efe6d4");
  for (let i = 0; i < Math.ceil(w / 4); i++) m.box(compose(x0 + 2 + i * 4, hgt - 0.15, 0, 0, 0, 0, 0.25, 0.3, d), trim);
}

interface DressOpts { wainscot?: string; rug?: [string, string]; pictures?: number; plants?: boolean; pendants?: number; beams?: string }

/**
 * The finishing touches every room gets: a panelled dado with a chair rail, a rug, framed pictures,
 * potted plants in the back corners and pendant lamps on chains. This is what makes a box with
 * furniture feel like a room someone looks after.
 */
function dress(m: MeshBuilder, glow: MeshBuilder, solids: Solid[], w: number, d: number, h: number, o: DressOpts, seed = 1) {
  const x0 = -w / 2, z0 = -d / 2;
  if (o.wainscot) {
    const wc = o.wainscot, dark = mixHex(wc, "#2a1a10", 0.25);
    m.box(compose(0, 0.6, z0 + 0.05, 0, 0, 0, w, 1.2, 0.08), wc);
    for (const s of [-1, 1]) m.box(compose(s * (w / 2 - 0.05), 0.6, 0, 0, 0, 0, 0.08, 1.2, d), wc);
    m.box(compose(0, 1.22, z0 + 0.1, 0, 0, 0, w, 0.08, 0.12), dark);
    for (const s of [-1, 1]) m.box(compose(s * (w / 2 - 0.1), 1.22, 0, 0, 0, 0, 0.12, 0.08, d), dark);
    // Raised panels.
    for (let x = x0 + 0.6; x < w / 2 - 0.4; x += 1.2) m.box(compose(x + 0.2, 0.62, z0 + 0.1, 0, 0, 0, 0.9, 0.8, 0.04), dark);
    for (const s of [-1, 1]) for (let z = z0 + 0.6; z < d / 2 - 0.4; z += 1.2) m.box(compose(s * (w / 2 - 0.1), 0.62, z + 0.2, 0, 0, 0, 0.04, 0.8, 0.9), dark);
  }
  if (o.rug) {
    const [a, b] = o.rug;
    m.box(compose(0, 0.012, 0.6, 0, 0, 0, Math.min(w - 3, 7), 0.02, Math.min(d - 3, 4.6)), b);
    m.box(compose(0, 0.02, 0.6, 0, 0, 0, Math.min(w - 3, 7) - 0.5, 0.02, Math.min(d - 3, 4.6) - 0.5), a);
    for (let i = 0; i < 5; i++) m.box(compose(0, 0.025, 0.6 - 1.2 + i * 0.6, 0, 0, 0, Math.min(w - 3, 7) - 1.0, 0.02, 0.06), b);
  }
  const PAINT = ["#3f8a5a", "#2f6fb0", "#e8b84a", "#c8473a", "#7a52c7", "#5aa0c8"];
  for (let i = 0; i < (o.pictures ?? 0); i++) {
    const side = i % 3; // back, left, right
    const t = (Math.floor(i / 3) + 0.5) / Math.ceil((o.pictures ?? 1) / 3);
    const fw = 1.0 + hash2(i, seed) * 0.5, fh = 0.8 + hash2(seed, i) * 0.4, y = 2.2 + hash2(i + 3, seed) * 0.4;
    const col = PAINT[(i + seed) % PAINT.length];
    if (side === 0) {
      const x = x0 + w * (0.18 + 0.64 * t) * (i % 2 ? 1 : 0.6);
      m.box(compose(x, y, z0 + 0.06, 0, 0, 0, fw + 0.16, fh + 0.16, 0.06), "#6b4426");
      m.box(compose(x, y, z0 + 0.1, 0, 0, 0, fw, fh, 0.03), col);
      m.sphere(compose(x - fw * 0.15, y + fh * 0.1, z0 + 0.12, 0, 0, 0, fw * 0.18, fh * 0.2, 0.02), "#f2efe8", 3, 5); // a mountain-ish dab
    } else {
      const sx = side === 1 ? -1 : 1, z = z0 + d * (0.25 + 0.5 * t);
      m.box(compose(sx * (w / 2 - 0.06), y, z, 0, 0, 0, 0.06, fh + 0.16, fw + 0.16), "#6b4426");
      m.box(compose(sx * (w / 2 - 0.1), y, z, 0, 0, 0, 0.03, fh, fw), col);
    }
  }
  if (o.plants) for (const s of [-1, 1]) {
    const px = s * (w / 2 - 0.6), pz = z0 + 0.6;
    if (solids.some(([sx, sz, hw, hd]) => Math.abs(px - sx) < hw + 0.4 && Math.abs(pz - sz) < hd + 0.4)) continue;
    m.cylinder(compose(px, 0.3, pz, 0, 0, 0, 0.6, 0.6, 0.6), "#b0603a", 10, 0.5, 0.4);
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      m.sphere(compose(px + Math.cos(a) * 0.2, 0.9 + hash2(k, s) * 0.5, pz + Math.sin(a) * 0.2, a, 0, 0, 0.28, 0.4, 0.2), k % 2 ? "#3f7a3a" : "#4f8a42", 4, 6);
    }
    solids.push([px, pz, 0.45, 0.45]);
  }
  for (let i = 0; i < (o.pendants ?? 0); i++) {
    const x = x0 + (w * (i + 0.5)) / (o.pendants ?? 1);
    m.box(compose(x, h - 0.6, 0, 0, 0, 0, 0.03, 1.2, 0.03), "#2e2b2a");
    m.cone(compose(x, h - 1.3, 0, 0, 0, 0, 0.8, 0.35, 0.8), "#2e4a3a", 10);
    glow.sphere(compose(x, h - 1.42, 0, 0, 0, 0, 0.18), "#ffe2a0", 4, 6);
  }
  if (o.beams) for (let z = z0 + 1.5; z < d / 2 - 0.5; z += 2.5) m.box(compose(0, h - 0.2, z, 0, 0, 0, w, 0.32, 0.3), o.beams);
}

function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a), cb = hexToRgb(b);
  const c = ca.map((v, i) => v + (cb[i] - v) * t);
  return "#" + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0")).join("");
}

/** A deep upholstered armchair facing direction ry. */
function armchair(m: MeshBuilder, solids: Solid[], x: number, z: number, ry: number, col: string) {
  const c = Math.cos(ry), s = Math.sin(ry);
  const at = (lx: number, ly: number, lz: number, sx: number, sy: number, sz: number) => compose(x + lx * c + lz * s, ly, z - lx * s + lz * c, ry, 0, 0, sx, sy, sz);
  m.box(at(0, 0.3, 0, 0.9, 0.4, 0.85), col);
  m.box(at(0, 0.75, -0.35, 0.9, 0.9, 0.2), col);
  for (const k of [-1, 1]) m.box(at(k * 0.45, 0.6, 0, 0.18, 0.4, 0.85), mixHex(col, "#000000", 0.15));
  m.box(at(0, 0.53, 0.05, 0.62, 0.1, 0.6), mixHex(col, "#ffffff", 0.15));
  solids.push([x, z, 0.55, 0.55]);
}

/** A fringed bar stool. */
function stool(m: MeshBuilder, x: number, z: number, seat = "#c8473a") {
  m.cylinder(compose(x, 0.4, z, 0, 0, 0, 0.08, 0.8, 0.08), "#2e2b2a", 6);
  m.cylinder(compose(x, 0.05, z, 0, 0, 0, 0.4, 0.06, 0.4), "#2e2b2a", 8);
  m.cylinder(compose(x, 0.84, z, 0, 0, 0, 0.45, 0.12, 0.45), seat, 10);
}

function counter(m: MeshBuilder, solids: Solid[], x: number, z: number, w: number, col = "#8a5a34", top = "#e8dcc4") {
  m.box(compose(x, 0.55, z, 0, 0, 0, w, 1.1, 0.8), col);
  m.box(compose(x, 1.13, z, 0, 0, 0, w + 0.1, 0.06, 0.9), top);
  solids.push([x, z, w / 2 + 0.2, 0.6]);
}

function shelf(m: MeshBuilder, solids: Solid[], x: number, z: number, w: number, ry: number, items: string[], seed: number) {
  const c = Math.cos(ry), s = Math.sin(ry);
  m.box(compose(x, 1.3, z, ry, 0, 0, w, 2.6, 0.5), "#7a4b2c");
  for (let k = 0; k < 4; k++) {
    m.box(compose(x + s * 0.05, 0.35 + k * 0.62, z + c * 0.05, ry, 0, 0, w - 0.1, 0.05, 0.45), "#5b3a24");
    const n = Math.floor(w / 0.32);
    for (let i = 0; i < n; i++) {
      const t = -w / 2 + 0.2 + i * 0.32, col = items[Math.floor(hash2(i + seed, k) * items.length)];
      m.box(compose(x + c * t + s * 0.12, 0.55 + k * 0.62, z - s * t + c * 0.12, ry, 0, 0, 0.24, 0.32 + hash2(i, k + seed) * 0.1, 0.3), col);
    }
  }
  solids.push([x, z, Math.abs(c) * w / 2 + Math.abs(s) * 0.4 + 0.2, Math.abs(s) * w / 2 + Math.abs(c) * 0.4 + 0.2]);
}

function table(m: MeshBuilder, solids: Solid[], x: number, z: number, r: number, col = "#8a5a34", chairs = 3) {
  m.cylinder(compose(x, 0.78, z, 0, 0, 0, r * 2, 0.08, r * 2), col, 14);
  m.cylinder(compose(x, 0.38, z, 0, 0, 0, 0.16, 0.76, 0.16), "#4a3020", 6);
  for (let i = 0; i < chairs; i++) {
    const a = (i / chairs) * Math.PI * 2 + 0.4;
    m.box(compose(x + Math.cos(a) * (r + 0.45), 0.45, z + Math.sin(a) * (r + 0.45), -a, 0, 0, 0.45, 0.08, 0.45), "#6b4426");
    m.box(compose(x + Math.cos(a) * (r + 0.68), 0.75, z + Math.sin(a) * (r + 0.68), -a + Math.PI / 2, 0, 0, 0.45, 0.6, 0.06), "#6b4426");
  }
  solids.push([x, z, r + 0.3, r + 0.3]);
}

function windows(m: MeshBuilder, w: number, d: number, y: number) {
  for (const s of [-1, 1]) for (let i = 0; i < Math.floor(d / 4); i++) {
    const z = -d / 2 + 2 + i * 4;
    m.box(compose(s * (w / 2 - 0.02), y, z, 0, 0, 0, 0.06, 1.4, 1.2), "#bfe3ff");
    m.box(compose(s * (w / 2 - 0.05), y, z, 0, 0, 0, 0.06, 1.5, 0.08), "#6b4426");
  }
}

function lamp(glow: MeshBuilder, x: number, z: number, y: number, col = "#fff1c4", r = 0.3) {
  glow.sphere(compose(x, y, z, 0, 0, 0, r), col, 5, 8);
}

function sign(glow: MeshBuilder, x: number, y: number, z: number, w: number, col: string) {
  glow.box(compose(x, y, z, 0, 0, 0, w, 0.5, 0.06), col);
}

// ------------------------------------------------------------------ The rooms

const ROOMS: Record<string, RoomDef> = {
  sports: {
    title: "🏟️ Sports Centre", w: 30, d: 22, h: 9,
    build(m, glow, solids) {
      buildGymHall(m, { w: 30, d: 22, h: 9, practiceHoops: [-2.5, 2.5], courtHoops: true });
      // A volleyball net set up across the left half, and a futsal goal at the far left end.
      for (const z of [-4.8, 4.8]) { m.cylinder(compose(-6, 1.25, z, 0, 0, 0, 0.12, 2.5, 0.12), "#e2483d", 6); solids.push([-6, z, 0.3, 0.3]); }
      m.box(compose(-6, 2.0, 0, 0, 0, 0, 0.04, 0.9, 9.6), (_x, y) => (Math.floor((y + 0.5) * 9) % 2 ? C("#2e2b2a") : C("#f2efe8")));
      m.box(compose(-6, 2.47, 0, 0, 0, 0, 0.06, 0.08, 9.6), "#ffffff");
      for (const z of [-1.5, 1.5]) m.box(compose(-14.4, 1, z, 0, 0, 0, 0.1, 2, 0.1), "#ffffff");
      m.box(compose(-14.4, 2, 0, 0, 0, 0, 0.1, 0.1, 3.1), "#ffffff");
      m.box(compose(-14.8, 1, 0, 0, 0, 0, 0.7, 2, 3), (x, y) => (Math.floor(y * 6 + x * 6) % 2 ? C("#d8dcdf") : C("#c3c8cc")));
      solids.push([-14.6, 0, 0.6, 1.7]);
      // Ball racks.
      for (let i = 0; i < 6; i++) m.sphere(compose(4 + i * 0.5, 0.25, -9.6, 0, 0, 0, 0.24), i % 2 ? "#e8742a" : "#ffffff", 5, 8);
      sign(glow, 0, 4.2, -10.9, 5, "#2f63b8");
    },
    stations: (api) => [
      { x: 0, z: -6.5, game: "hoops", label: () => `${ARCADE_INFO.hoops.icon} Play ${ARCADE_INFO.hoops.name}`, run: () => api.queueGame("hoops") },
      { x: -4.2, z: 3, game: "volley", label: () => `${ARCADE_INFO.volley.icon} Play ${ARCADE_INFO.volley.name} (2+ players)`, run: () => api.queueGame("volley") },
      { x: -11, z: 0, game: "penalty", label: () => `${ARCADE_INFO.penalty.icon} Play ${ARCADE_INFO.penalty.name}`, run: () => api.queueGame("penalty") },
      { x: 12.4, z: 3, label: () => "🏆 Sports leaderboards", run: () => api.life("leaderboard", "hoops") },
    ],
  },
  wordlodge: {
    title: "📚 The Word Lodge", w: 16, d: 12, h: 6,
    build(m, glow, solids) {
      room(m, 16, 12, 6, "#c8a878", (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 ? "#8a5a34" : "#7a4b2c"));
      const books = ["#c8473a", "#2f6fb0", "#3f8a5a", "#e8b84a", "#7a52c7", "#e8dcc4"];
      shelf(m, solids, -5.5, -5.6, 4, 0, books, 1); shelf(m, solids, 5.5, -5.6, 4, 0, books, 2);
      shelf(m, solids, -7.6, 0, 6, Math.PI / 2, books, 3); shelf(m, solids, 7.6, 0, 6, -Math.PI / 2, books, 4);
      m.box(compose(0, 2.6, -5.85, 0, 0, 0, 5, 2.4, 0.08), "#2e3b30"); // the big board
      m.box(compose(0, 2.6, -5.8, 0, 0, 0, 5.2, 2.6, 0.04), "#6b4426");
      WORD_GAMES.forEach((_g, i) => {
        const x = -4.5 + i * 3;
        m.box(compose(x, 0.6, -2.2, 0, 0, 0, 0.5, 1.2, 0.5), "#6b4426");
        m.box(compose(x, 1.25, -2.1, 0, -0.5, 0, 1.1, 0.08, 0.8), "#8a5a34");
        lamp(glow, x, -2.6, 1.9, "#ffd88a", 0.12);
        solids.push([x, -2.2, 0.6, 0.5]);
      });
      table(m, solids, 0, 2.5, 1.1);
      dress(m, glow, solids, 16, 12, 6, { wainscot: "#6b4426", rug: ["#2f6f6a", "#e8b84a"], pictures: 3, pendants: 3, beams: "#5b3a24" }, 2);
      armchair(m, solids, -5.6, 3.6, Math.PI * 0.8, "#2f6f6a");
      armchair(m, solids, 5.6, 3.6, -Math.PI * 0.8, "#8a3b2e");
      m.cylinder(compose(4, 0.5, 4.2, 0, 0, 0, 0.12, 1.0, 0.12), "#5b3a24", 6);
      m.sphere(compose(4, 1.25, 4.2, 0, 0, 0.4, 0.35), (x, y) => (Math.sin(x * 9) + Math.cos(y * 7) > 0.6 ? C("#4f8a42") : C("#3a7fc0")), 6, 8);
      m.torus(compose(4, 1.25, 4.2, 0, 0, 0.4, 0.4), "#c8a24a", 1, 0.03, 14, 4);
      solids.push([4, 4.2, 0.4, 0.4]);
    },
    stations: (api) => WORD_GAMES.map((g, i) => ({ x: -4.5 + i * 3, z: -0.9, game: g, label: () => `${WORD_INFO[g].icon} Play ${WORD_INFO[g].name}`, run: () => api.queueWord(g) })),
  },
  gym: {
    title: "🥊 The Boxing Gym", w: 18, d: 14, h: 6.5,
    build(m, glow, solids) {
      room(m, 18, 14, 6.5, "#e8dcc4", "#b88a5a");
      m.box(compose(0, 0.35, -2, 0, 0, 0, 7, 0.7, 7), "#2f6fb0");
      m.box(compose(0, 0.71, -2, 0, 0, 0, 6.6, 0.02, 6.6), "#f2efe8");
      for (const [x, z] of [[-3.3, -5.3], [3.3, -5.3], [-3.3, 1.3], [3.3, 1.3]]) m.cylinder(compose(x, 1.4, z, 0, 0, 0, 0.2, 1.4, 0.2), x * (z + 2) > 0 ? "#e2483d" : "#2f7fb0", 6);
      for (let k = 0; k < 3; k++) {
        const y = 1.0 + k * 0.4;
        for (const [x, z, w, d] of [[0, -5.3, 6.6, 0.05], [0, 1.3, 6.6, 0.05], [-3.3, -2, 0.05, 6.6], [3.3, -2, 0.05, 6.6]]) m.box(compose(x, y, z, 0, 0, 0, w, 0.05, d), "#ffffff");
      }
      solids.push([0, -2, 3.7, 3.7]);
      for (const s of [-1, 1]) {
        m.cylinder(compose(s * 7, 1.6, -4, 0, 0, 0, 0.9, 1.6, 0.9), "#c8473a", 10);
        m.box(compose(s * 7, 3.2, -4, 0, 0, 0, 0.05, 1.6, 0.05), "#555");
        solids.push([s * 7, -4, 0.6, 0.6]);
      }
      sign(glow, 0, 4.6, -6.85, 6, "#e2483d");
      dress(m, glow, solids, 18, 14, 6.5, { wainscot: "#4a5868", pictures: 5, plants: false, pendants: 3 }, 5);
      for (let i = 0; i < 6; i++) {
        m.box(compose(-8.6, 1.1, 2 + i * 0.75, 0, 0, 0, 0.6, 2.2, 0.72), i % 2 ? "#3a6fc4" : "#2f5aa8");
        m.box(compose(-8.28, 1.7, 2 + i * 0.75, 0, 0, 0, 0.02, 0.3, 0.4), "#1d2a4a");
      }
      solids.push([-8.6, 3.9, 0.4, 2.4]);
      m.box(compose(6.5, 0.45, 3.5, 0, 0, 0, 0.5, 0.12, 1.6), "#2e2b2a");
      m.box(compose(6.5, 0.22, 3.5, 0, 0, 0, 0.3, 0.44, 1.2), "#55555f");
      for (const s of [-1, 1]) { m.box(compose(6.5 + s * 0.6, 0.8, 3.0, 0, 0, 0, 0.06, 1.6, 0.06), "#9aa3a8"); }
      m.cylinder(compose(6.5, 1.6, 3.0, 0, 0, Math.PI / 2, 0.06, 1.6, 0.06), "#9aa3a8", 6);
      for (const s of [-1, 1]) m.cylinder(compose(6.5 + s * 0.7, 1.6, 3.0, 0, 0, Math.PI / 2, 0.5, 0.1, 0.5), "#2e2b2a", 10);
      solids.push([6.5, 3.4, 0.9, 1.0]);
      m.box(compose(8.4, 0.5, -0.5, 0, 0, 0, 0.6, 1.0, 2.4), "#55555f");
      for (let i = 0; i < 5; i++) for (const s of [-0.25, 0.25]) m.cylinder(compose(8.4 + s, 1.05, -1.4 + i * 0.45, 0, Math.PI / 2, 0, 0.22, 0.12, 0.22), "#2e2b2a", 8);
      solids.push([8.4, -0.5, 0.4, 1.3]);
    },
    stations: (api) => [
      { x: 0, z: 2.6, game: "shadowbox", label: () => `${ARCADE_INFO.shadowbox.icon} Step into the ring: ${ARCADE_INFO.shadowbox.name}`, run: () => api.queueGame("shadowbox") },
      { x: 6.5, z: 0, label: () => "🏆 Boxing leaderboard", run: () => api.life("leaderboard", "shadowbox") },
    ],
  },
  casino: {
    title: "🍀 The Lucky Lodge", w: 18, d: 14, h: 6,
    build(m, glow, solids) {
      room(m, 18, 14, 6, "#5a1f2a", (x, z) => ((Math.floor(x * 0.5) + Math.floor(z * 0.5)) % 2 ? "#2f5a3a" : "#28503a"), "#c8a24a");
      for (let i = 0; i < 6; i++) {
        const x = -5 + i * 2;
        m.box(compose(x, 0.9, -6.2, 0, 0, 0, 1.2, 1.8, 0.8), "#c8a24a");
        glow.box(compose(x, 1.25, -5.79, 0, 0, 0, 0.8, 0.55, 0.02), ["#ff7eb3", "#7fd6ff", "#ffd93b"][i % 3]);
        m.box(compose(x + 0.62, 1.2, -6.0, 0, 0, 0.2, 0.06, 0.6, 0.06), "#e2483d");
      }
      solids.push([0, -6.2, 6.4, 0.6]);
      // Roulette: a round table with the wheel; blackjack: a half-moon card table.
      m.cylinder(compose(-5, 0.85, 0, 0, 0, 0, 3, 0.12, 3), "#2f7a4a", 20);
      m.cylinder(compose(-5, 0.95, 0, 0, 0, 0, 1.1, 0.12, 1.1), (x, _y, z) => (Math.floor((Math.atan2(z, x) + 4) * 6) % 2 ? C("#c8323a") : C("#2e2b2a")), 20);
      m.cylinder(compose(-5, 0.42, 0, 0, 0, 0, 0.4, 0.84, 0.4), "#4a3020", 8);
      solids.push([-5, 0, 1.7, 1.7]);
      m.cylinder(compose(5, 0.85, -0.4, 0, 0, 0, 3.4, 0.12, 2.4), "#2f7a4a", 20);
      m.cylinder(compose(5, 0.42, -0.4, 0, 0, 0, 0.4, 0.84, 0.4), "#4a3020", 8);
      for (let i = 0; i < 3; i++) m.box(compose(4 + i, 0.93, 0, 0, 0, 0, 0.3, 0.02, 0.42), "#ffffff");
      solids.push([5, -0.4, 1.9, 1.4]);
      for (const x of [-5, 0, 5]) { lamp(glow, x, -1, 5.1, "#ffe08a", 0.45); m.box(compose(x, 5.6, -1, 0, 0, 0, 0.04, 0.8, 0.04), "#c8a24a"); }
      sign(glow, 0, 4.2, -6.85, 6, "#3fd16a");
      dress(m, glow, solids, 18, 14, 6, { wainscot: "#3a0f16", pictures: 4, plants: true }, 7);
      for (const s of [-1, 1]) for (const z of [-4, 0, 4]) {
        m.box(compose(s * 8.85, 3.2, z, 0, 0, 0, 0.12, 4.6, 1.6), "#9a1f2e");
        m.box(compose(s * 8.8, 5.45, z, 0, 0, 0, 0.18, 0.2, 1.9), "#c8a24a");
        m.cylinder(compose(s * 8.75, 2.2, z + 0.75, 0, 0, 0, 0.18, 0.12, 0.18), "#c8a24a", 6);
      }
      m.box(compose(0, 0.015, 3.6, 0, 0, 0, 2.2, 0.02, 6.6), "#9a1f2e");
      m.box(compose(0, 0.02, 3.6, 0, 0, 0, 1.8, 0.02, 6.4), "#b8283a");
      for (let i = 0; i < 4; i++) stool(m, 3.6 + i * 0.95, 1.4, "#3f9a5a");
    },
    stations: (api) => [
      { x: 0, z: -4.6, label: () => "🎰 Play the slot machines", run: () => api.casino("slots") },
      { x: -5, z: 2.6, label: () => "🎡 Play roulette", run: () => api.casino("roulette") },
      { x: 5, z: 2.2, label: () => "🃏 Play blackjack", run: () => api.casino("blackjack") },
    ],
  },
  club: {
    title: "🪩 Club Beaver", w: 18, d: 14, h: 6.5,
    build(m, glow, solids) {
      room(m, 18, 14, 6.5, "#2a1f3a", "#1f1a2a", "#7a52c7");
      // The dance floor is drawn separately (it lights up); here's the DJ booth, stage and bar.
      m.box(compose(0, 0.6, -5.8, 0, 0, 0, 4, 1.2, 1.2), "#3a2f4a");
      for (const s of [-1, 1]) m.cylinder(compose(s * 0.9, 1.25, -5.8, 0, 0, 0, 0.8, 0.08, 0.8), "#2e2b2a", 14);
      solids.push([0, -5.8, 2.2, 0.8]);
      m.box(compose(-6, 0.3, -4.5, 0, 0, 0, 4.5, 0.6, 3.5), "#5a3a2c");
      m.cylinder(compose(-6, 1.3, -4.2, 0, 0, 0, 0.05, 1.4, 0.05), "#888", 5);
      m.sphere(compose(-6, 2.05, -4.2, 0, 0, 0, 0.1), "#2e2b2a", 4, 6);
      solids.push([-6, -4.5, 2.4, 1.9]);
      counter(m, solids, 6.5, -4, 4, "#3a2f4a", "#7a52c7");
      for (let i = 0; i < 5; i++) glow.box(compose(5 + i * 0.7, 1.4, -4.4, 0, 0, 0, 0.12, 0.3, 0.12), ["#ff7eb3", "#7fd6ff", "#ffd93b"][i % 3]);
      glow.sphere(compose(0, 5.6, -1, 0, 0, 0, 0.5), "#e8e8ff", 6, 10); // disco ball
      m.box(compose(0, 6.1, -1, 0, 0, 0, 0.03, 0.9, 0.03), "#888");
      // Booths along the walls, stools at the bar, neon strips on the walls.
      for (const s of [-1, 1]) for (const z of [1.5, 4.5]) {
        m.box(compose(s * 8.3, 0.4, z, 0, 0, 0, 1.0, 0.5, 2.2), "#7a52c7");
        m.box(compose(s * 8.75, 1.0, z, 0, 0, 0, 0.3, 1.4, 2.2), "#5a3a8f");
        m.box(compose(s * 7.3, 0.75, z, 0, 0, 0, 0.9, 0.06, 1.4), "#2e2b2a");
        m.cylinder(compose(s * 7.3, 0.38, z, 0, 0, 0, 0.12, 0.74, 0.12), "#2e2b2a", 6);
        glow.sphere(compose(s * 7.3, 0.86, z, 0, 0, 0, 0.08), "#ffd93b", 3, 4);
        solids.push([s * 7.9, z, 1.1, 1.2]);
      }
      for (let i = 0; i < 4; i++) stool(m, 5.3 + i * 0.9, -3.0, "#ff4fa3");
      for (const s of [-1, 1]) for (const y of [2.4, 3.4]) glow.box(compose(s * 8.92, y, 0, 0, 0, 0, 0.03, 0.06, 13), y > 3 ? "#3ff0e0" : "#ff4fa3");
      glow.box(compose(0, 3.4, -6.92, 0, 0, 0, 17.8, 0.06, 0.03), "#ffd93b");
      sign(glow, 0, 4.4, -6.85, 8, "#ff4fa3");
    },
    stations: (api) => [
      { x: 0, z: -1, label: () => (api.myAct() === "dance" ? "🪩 Take a breather" : "🪩 Hit the dance floor"), run: () => api.act(api.myAct() === "dance" ? "stop" : "dance") },
      { x: -6, z: -2, label: () => (api.myAct() === "sing" ? "🎤 Stop singing" : "🎤 Sing karaoke"), run: () => api.act(api.myAct() === "sing" ? "stop" : "sing") },
      { x: 6.5, z: -2.6, label: () => "🧃 Order a maple fizz", run: () => api.toast("🧃 A maple fizz with three straws. Cheers! 🥂") },
    ],
  },
  shop: {
    title: "🎒 The Outfitter", w: 14, d: 11, h: 5.5,
    build(m, glow, solids) {
      room(m, 14, 11, 5.5, "#d8c8a8", "#a8784a");
      counter(m, solids, 0, -3.6, 4);
      const goods = ["#e2483d", "#2fa7a2", "#f5c242", "#a77bff", "#ff7eb3", "#4c8cff"];
      shelf(m, solids, -4.5, -5.2, 3.5, 0, goods, 5); shelf(m, solids, 4.5, -5.2, 3.5, 0, goods, 6);
      m.box(compose(-6.8, 1.4, 1, 0, 0, 0, 0.08, 2.4, 1.4), "#cfe8f5"); // mirror
      m.box(compose(-6.85, 1.4, 1, 0, 0, 0, 0.06, 2.6, 1.6), "#8a5a34");
      table(m, solids, 4.5, 1.5, 0.8, "#c8a878", 2);
      dress(m, glow, solids, 14, 11, 5.5, { wainscot: "#8a5a34", rug: ["#c8473a", "#f2e6c8"], pictures: 3, plants: true, beams: "#6b4426" }, 3);
      for (const [x, z, hat] of [[-2.6, 1.8, "#e2483d"], [-1.2, 2.6, "#2fa7a2"], [2.2, 3.4, "#f5c242"]] as const) {
        m.cylinder(compose(x, 0.7, z, 0, 0, 0, 0.08, 1.4, 0.08), "#5b3a24", 6);
        m.cylinder(compose(x, 0.04, z, 0, 0, 0, 0.5, 0.08, 0.5), "#5b3a24", 8);
        m.sphere(compose(x, 1.55, z, 0, 0, 0, 0.22, 0.26, 0.22), "#e8d8c0", 5, 8);
        m.cone(compose(x, 1.85, z, 0, 0, 0, 0.42, 0.36, 0.42), hat, 8);
        m.sphere(compose(x, 2.06, z, 0, 0, 0, 0.08), "#ffffff", 3, 4);
        solids.push([x, z, 0.35, 0.35]);
      }
      m.box(compose(1.2, 1.32, -3.6, 0, 0, 0, 0.6, 0.35, 0.45), "#c8a24a");
      m.box(compose(1.2, 1.55, -3.75, 0, -0.5, 0, 0.5, 0.2, 0.05), "#2e2b2a");
      windows(m, 14, 11, 2.2);
      lamp(glow, 0, -1, 5, "#ffe2a0", 0.3);
    },
    stations: (api) => [
      { x: 0, z: -2.2, label: () => "🎒 Browse hats, scarves and packs", run: () => api.shop("hat") },
      { x: -5.6, z: 1, label: () => "🪞 Try a new fur colour", run: () => api.shop("fur") },
      { x: 4.5, z: 3.2, label: () => "🏡 Cabin furniture", run: () => api.shop("cabin") },
    ],
  },
  lodge: {
    title: "☕ Lodge Café", w: 16, d: 12, h: 6,
    build(m, glow, solids) {
      room(m, 16, 12, 6, "#a8784a", "#7a4b2c");
      counter(m, solids, -4, -4.6, 5);
      for (let i = 0; i < 4; i++) m.cylinder(compose(-5.5 + i, 1.3, -4.6, 0, 0, 0, 0.18, 0.22, 0.18), ["#f2efe8", "#c8473a", "#2f6fb0", "#f2efe8"][i], 8);
      // Stone fireplace with a fire.
      m.box(compose(5, 1.6, -5.6, 0, 0, 0, 3, 3.2, 0.8), "#8a8580");
      m.box(compose(5, 0.6, -5.2, 0, 0, 0, 1.6, 1.0, 0.2), "#2e2b2a");
      glow.cone(compose(5, 0.55, -5.2, 0, 0, 0, 0.8, 0.8, 0.3), "#ff9a3c", 6);
      solids.push([5, -5.6, 1.7, 0.6]);
      table(m, solids, -3, 1.5, 0.8); table(m, solids, 3, 1.8, 0.8);
      dress(m, glow, solids, 16, 12, 6, { wainscot: "#5b3a24", rug: ["#8a3b2e", "#e8b84a"], pictures: 3, plants: true, beams: "#4a3020" }, 4);
      armchair(m, solids, 3.6, -3.4, 0.6, "#3f6b3a");
      armchair(m, solids, 6.6, -3.2, -0.5, "#8a3b2e");
      m.box(compose(-4, 2.6, -5.88, 0, 0, 0, 3.0, 1.4, 0.06), "#2e3b30");
      m.box(compose(-4, 2.6, -5.84, 0, 0, 0, 3.2, 1.6, 0.03), "#6b4426");
      for (let i = 0; i < 4; i++) m.box(compose(-4.9 + i * 0.6, 2.8 - (i % 2) * 0.35, -5.84, 0, 0, 0, 0.45, 0.06, 0.02), "#f2efe8");
      glow.box(compose(-2.2, 1.45, -4.55, 0, 0, 0, 1.0, 0.5, 0.5), "#fff1cf");
      for (let i = 0; i < 4; i++) m.sphere(compose(-2.55 + i * 0.24, 1.3, -4.5, 0, 0, 0, 0.1, 0.06, 0.1), i % 2 ? "#d9934a" : "#c47a2c", 3, 5);
      windows(m, 16, 12, 2.4);
      for (const x of [-4, 4]) lamp(glow, x, 0, 5.4, "#ffd88a", 0.35);
    },
    stations: (api) => [
      { x: -4, z: -3.2, label: () => (api.myAct() === "cocoa" ? "☕ Finish your cocoa" : "☕ Order a maple hot cocoa"), run: () => api.act(api.myAct() === "cocoa" ? "stop" : "cocoa") },
      { x: 5, z: -3.6, label: () => "🔥 Warm your paws by the fire", run: () => api.toast("🔥 Ahh, crackly and toasty.") },
    ],
  },
  golf: {
    title: "⛳ Golf Clubhouse", w: 14, d: 10, h: 5.5,
    build(m, glow, solids) {
      room(m, 14, 10, 5.5, "#e8dcc4", (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 ? "#3f7a4a" : "#3a7044"));
      counter(m, solids, 0, -3, 4, "#6b4426");
      // Trophy cabinet and a rack of clubs.
      m.box(compose(-5.5, 1.3, -4.6, 0, 0, 0, 2.4, 2.6, 0.6), "#5b3a24");
      for (let i = 0; i < 4; i++) m.cylinder(compose(-6.3 + i * 0.55, 1.8, -4.5, 0, 0, 0, 0.25, 0.5, 0.25), "#f5c242", 8);
      solids.push([-5.5, -4.6, 1.4, 0.5]);
      for (let i = 0; i < 5; i++) m.box(compose(5 + i * 0.25, 0.6, -4.6, 0, 0, 0.1, 0.05, 1.2, 0.05), "#9aa3a8");
      dress(m, glow, solids, 14, 10, 5.5, { wainscot: "#5b3a24", rug: ["#2f5a3a", "#e8dcc4"], pictures: 4, plants: true, beams: "#5b3a24" }, 6);
      armchair(m, solids, -4.5, 2.2, Math.PI * 0.85, "#8a3b2e");
      armchair(m, solids, -2.8, 2.9, Math.PI, "#8a3b2e");
      m.box(compose(3.0, 2.6, -4.94, 0, 0, 0, 2.6, 1.6, 0.06), "#6b4426");
      m.box(compose(3.0, 2.6, -4.9, 0, 0, 0, 2.4, 1.4, 0.03), "#7fb069");
      for (let i = 0; i < 5; i++) m.cylinder(compose(2.0 + i * 0.5, 2.5 + Math.sin(i) * 0.3, -4.87, 0, Math.PI / 2, 0, 0.18, 0.02, 0.18), "#9ad27a", 8);
      windows(m, 14, 10, 2.3);
      lamp(glow, 0, 0, 5, "#ffe2a0", 0.3);
    },
    stations: (api) => [
      { x: 0, z: -1.7, game: "golf", label: () => "⛳ Book a round of golf", run: () => api.life("golf") },
      { x: -5.5, z: -3.2, label: () => "🏆 Golf leaderboard", run: () => api.life("leaderboard", "golf") },
    ],
  },
  arcade: {
    title: "🕹️ Riverside Arcade", w: 14, d: 11, h: 5.5,
    build(m, glow, solids) {
      room(m, 14, 11, 5.5, "#2a2f4a", (x, z) => ((Math.floor(x) + Math.floor(z)) % 2 ? "#3a2f5a" : "#2f2a4a"), "#7fd6ff");
      ARCADE_GAMES.forEach((_g, i) => {
        const { x, z, ry } = cabinet(i);
        m.box(compose(x, 0.95, z, ry, 0, 0, 1.1, 1.9, 0.8), ["#c8473a", "#2f6fb0", "#3f8a5a", "#e8b84a", "#7a52c7"][i % 5]);
        glow.box(compose(x + Math.sin(ry) * 0.41, 1.35, z + Math.cos(ry) * 0.41, ry, -0.2, 0, 0.8, 0.6, 0.02), ["#7fd6ff", "#ff7eb3", "#b6ff7a"][i % 3]);
        solids.push([x, z, 0.65, 0.65]);
      });
      for (const s of [-1, 1]) glow.box(compose(s * 6.9, 5.2, 0, 0, 0, 0, 0.04, 0.08, 11), s < 0 ? "#ff4fa3" : "#3ff0e0");
      glow.box(compose(0, 5.2, -5.45, 0, 0, 0, 14, 0.08, 0.04), "#ffd93b");
      dress(m, glow, solids, 14, 11, 5.5, { rug: ["#3a2f5a", "#7fd6ff"], pictures: 0 }, 8);
      counter(m, solids, 4.6, 3.6, 2.4, "#3a2f5a", "#7fd6ff");
      for (let i = 0; i < 6; i++) m.sphere(compose(3.8 + i * 0.32, 1.32, 3.6, 0, 0, 0, 0.13), ["#ff7eb3", "#ffd93b", "#7fd6ff"][i % 3], 4, 6);
    },
    stations: (api) => ARCADE_GAMES.map((g, i) => {
      void api;
      const { x, z, ry } = cabinet(i);
      return { x: x + Math.sin(ry) * 1.4, z: z + Math.cos(ry) * 1.4, label: () => `${ARCADE_INFO[g].icon} ${ARCADE_INFO[g].name} high scores`, run: () => api.life("leaderboard", g) };
    }),
  },
  library: {
    title: "📚 Library", w: 14, d: 10, h: 5.5,
    build(m, glow, solids) {
      room(m, 14, 10, 5.5, "#c8a878", "#8a5a34");
      const books = ["#c8473a", "#2f6fb0", "#3f8a5a", "#e8b84a", "#7a52c7"];
      for (const x of [-4.5, 0, 4.5]) shelf(m, solids, x, -4.6, 3.6, 0, books, Math.floor(x + 9));
      table(m, solids, 0, 1, 1.0, "#8a5a34", 4);
      dress(m, glow, solids, 14, 10, 5.5, { wainscot: "#6b4426", rug: ["#2f5a7a", "#e8dcc4"], pictures: 2, plants: true, beams: "#5b3a24" }, 9);
      armchair(m, solids, -5, 2.8, Math.PI * 0.85, "#2f5a7a");
      armchair(m, solids, 5, 2.8, -Math.PI * 0.85, "#3f6b3a");
      for (const s of [-1, 1]) m.box(compose(-2.4 + s * 0.25, 1.4, -4.1, 0, 0.18, 0, 0.06, 2.8, 0.06), "#8a5a34");
      for (let i = 0; i < 6; i++) m.box(compose(-2.4, 0.3 + i * 0.45, -4.1 + i * 0.08, 0, 0, 0, 0.5, 0.05, 0.06), "#8a5a34");
      lamp(glow, 0, 1, 1.15, "#ffd88a", 0.12);
      windows(m, 14, 10, 2.3);
    },
    stations: (api) => [
      { x: 0, z: -3.2, label: () => "📖 Read a Banff fact", run: () => api.read() },
      { x: 0, z: 2.8, label: () => "📓 Open your journal", run: () => api.life("journal") },
    ],
  },
  dyeshop: {
    title: "🎨 Dye Shop", w: 10, d: 8, h: 5,
    build(m, glow, solids) {
      room(m, 10, 8, 5, "#e8dcc4", "#a8784a");
      ["#e2483d", "#2fa7a2", "#f5c242", "#a77bff"].forEach((c, i) => {
        const x = -3 + i * 2;
        m.cylinder(compose(x, 0.5, -2.6, 0, 0, 0, 1.2, 1, 1.2), "#7a4b2c", 12);
        m.cylinder(compose(x, 1.01, -2.6, 0, 0, 0, 1.0, 0.02, 1.0), c, 12);
        solids.push([x, -2.6, 0.7, 0.7]);
      });
      dress(m, glow, solids, 10, 8, 5, { wainscot: "#7a52c7", pictures: 3, plants: true, pendants: 2 }, 10);
    },
    stations: (api) => [{ x: 0, z: -1, label: () => "🎨 Dye your hat, scarf or pack", run: () => api.shop("dye") }],
  },
  post: {
    title: "📮 Post Office", w: 10, d: 8, h: 5,
    build(m, glow, solids) {
      room(m, 10, 8, 5, "#d8e0e8", "#8a7a66");
      counter(m, solids, 0, -2.4, 4, "#2f5ab0");
      for (let i = 0; i < 12; i++) m.box(compose(-3 + (i % 6) * 1.2, 1.8 + Math.floor(i / 6) * 0.6, -3.85, 0, 0, 0, 1, 0.5, 0.2), "#c8a878");
      dress(m, glow, solids, 10, 8, 5, { wainscot: "#2f5ab0", rug: ["#2f5ab0", "#f2efe8"], pictures: 2, plants: true, pendants: 2 }, 11);
    },
    stations: (api) => [{ x: 0, z: -1, label: () => "📮 Send a photo postcard", run: () => api.photo() }],
  },
};

const ARCADE_GAMES: MiniGame[] = ["toboggan", "canoe", "hunt", "logroll", "snowball", "dam", "spleef", "td"];
function cabinet(i: number) {
  // Four on the back wall, two on each side.
  if (i < 4) return { x: -4.5 + i * 3, z: -4.9, ry: 0 };
  if (i < 6) return { x: -6.4, z: -1.5 + (i - 4) * 2.6, ry: Math.PI / 2 };
  return { x: 6.4, z: -1.5 + (i - 6) * 2.6, ry: -Math.PI / 2 };
}

/** Small shops that sell a treat: a counter, a display and the treat's activity. */
const TREATS: Record<string, { title: string; act: HubAct; label: string; done: string; wall: string; floor: string; goods: string[] }> = {
  bakery: { title: "🥐 Bakery", act: "croissant", label: "🥐 Buy a maple croissant", done: "🥐 All gone!", wall: "#f2d9a8", floor: "#a8784a", goods: ["#e8b84a", "#c47a2c", "#f2e6c8"] },
  icecream: { title: "🍦 Ice Cream Parlour", act: "icecream", label: "🍦 Get a double scoop", done: "🍦 Finish your cone", wall: "#ffd6e6", floor: "#f2efe8", goods: ["#ff9ec7", "#b6f2c8", "#fff1a8", "#c49a7a"] },
  maple: { title: "🍁 Maple Shop", act: "taffy", label: "🍁 Try maple taffy on snow", done: "🍁 Finish your taffy", wall: "#e8c8a0", floor: "#8a5a34", goods: ["#c8641c", "#e8a03a", "#8a3a1c"] },
};
for (const [k, t] of Object.entries(TREATS)) {
  ROOMS[k] = {
    title: t.title, w: 10, d: 8, h: 5,
    build(m, glow, solids) {
      room(m, 10, 8, 5, t.wall, t.floor);
      counter(m, solids, 0, -2.2, 4.5, "#8a5a34", "#f2efe8");
      for (let i = 0; i < 8; i++) m.sphere(compose(-1.8 + i * 0.5, 1.28, -2.2, 0, 0, 0, 0.16), t.goods[i % t.goods.length], 4, 6);
      shelf(m, solids, 0, -3.6, 6, 0, t.goods, 7);
      lamp(glow, 0, 0, 4.5, "#ffe2a0", 0.3);
      dress(m, glow, solids, 10, 8, 5, { wainscot: "#8a5a34", rug: [t.goods[0], "#f2efe8"], pictures: 2, plants: true }, 12);
      table(m, solids, -2.6, 2.2, 0.55, "#c8a878", 2);
      table(m, solids, 2.6, 2.2, 0.55, "#c8a878", 2);
    },
    stations: (api) => [{ x: 0, z: -0.9, label: () => (api.myAct() === t.act ? t.done : t.label), run: () => api.act(api.myAct() === t.act ? "stop" : t.act) }],
  };
}

/** The places you can walk into (the keys `HubScene.nearby()` uses). */
export const INTERIOR_KEYS = new Set(Object.keys(ROOMS));
export const interiorTitle = (k: string) => ROOMS[k]?.title ?? "";

// ------------------------------------------------------------------ The walk-in scene

export class Interior {
  private def: RoomDef;
  private meshes: GpuMesh[] = [];
  private world!: GpuMesh;
  private glow!: GpuMesh;
  private floorTiles: GpuMesh | null = null;
  private solids: Solid[] = [];
  private stations: Station[];
  private me = { x: 0, z: 0, ry: Math.PI, tr: Math.PI, walk: 0, moving: 0 };
  private yaw = 0;
  private time = 0;
  private actionKey = "\u0000";
  private titleEl: HTMLElement;
  private cam: Vec3 = [0, 4, 10];

  constructor(private ctx: Ctx, readonly key: string, private api: InteriorApi, private actionEl: HTMLElement, private root: HTMLElement, private joystick: Joystick | null) {
    this.def = ROOMS[key];
    const m = new MeshBuilder(), glow = new MeshBuilder();
    this.def.build(m, glow, this.solids);
    this.world = ctx.r.upload(m.build());
    this.glow = ctx.r.upload(glow.build());
    if (key === "club") {
      const tiles = new MeshBuilder();
      for (let i = 0; i < 8; i++) for (let k = 0; k < 6; k++) tiles.box(compose(-3.5 + i, 0.02, -3.5 + k, 0, 0, 0, 0.96, 0.04, 0.96), ["#ff4fa3", "#4fd1ff", "#ffd93b", "#7a52ff"][(i + k * 3) % 4]);
      this.floorTiles = ctx.r.upload(tiles.build());
    }
    this.stations = this.def.stations(api);
    // Start a few steps inside the door, on free floor (nudged sideways if furniture is in the way).
    this.me.z = this.def.d / 2 - (this.def.w > 20 ? 6 : 2.4);
    for (const dx of [0, 1.4, -1.4, 2.8, -2.8]) if (!this.blocked(dx, this.me.z)) { this.me.x = dx; break; }
    this.cam = [NaN, 0, 0];
    this.titleEl = h("div.pill", { style: "position:absolute;left:50%;top:12px;transform:translateX(-50%);font-weight:800" }, this.def.title);
    root.append(this.titleEl);
    ctx.sound.play("chime", 0.6);
  }

  private blocked(x: number, z: number) {
    const W = this.def.w / 2 - 0.45, D = this.def.d / 2 - 0.45;
    if (Math.abs(x) > W) return true;
    if (z < -D) return true;
    if (z > D && Math.abs(x) > 1.0) return true;
    return this.solids.some(([sx, sz, hw, hd]) => Math.abs(x - sx) < hw && Math.abs(z - sz) < hd);
  }

  private nearest(): Station | null {
    let best: Station | null = null, bd = 2.2;
    for (const s of this.stations) { const d = Math.hypot(this.me.x - s.x, this.me.z - s.z); if (d < bd) { bd = d; best = s; } }
    return best;
  }

  /** Returns "exit" when you walk back out of the door. */
  update(dt: number): "exit" | null {
    this.time += dt;
    const inp = this.ctx.input;
    this.yaw -= inp.consumeDrag() * 0.006;
    if (inp.down("q")) this.yaw += dt * 1.8;
    if (inp.down("e")) this.yaw -= dt * 1.8;
    inp.consumeTap();
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
      const sp = 5.5 * dt;
      const nx = me.x + (mx / len) * sp, nz = me.z + (mz / len) * sp;
      // Slide along walls and furniture.
      if (!this.blocked(nx, me.z)) me.x = nx;
      if (!this.blocked(me.x, nz)) me.z = nz;
      me.tr = Math.atan2(mx, mz);
      if (me.z > this.def.d / 2 + 0.3) return "exit";
    }
    me.moving = lerp(me.moving, len > 0 ? 1 : 0, Math.min(1, dt * 10));
    me.ry = lerpAngle(me.ry, me.tr, Math.min(1, dt * 12));
    me.walk += dt * 11 * me.moving;
    // The action button: the station you're standing at, or the way out.
    const st = this.nearest();
    const waiting = st?.game && this.api.lobbyGame() === st.game;
    const atDoor = me.z > this.def.d / 2 - 1.4 && Math.abs(me.x) < 1.6;
    const label = st ? (waiting ? "⏳ Waiting for players · Leave" : st.label()) : atDoor ? "🚪 Go back outside" : "";
    if (label !== this.actionKey) {
      this.actionKey = label;
      const run = () => {
        this.actionKey = "";
        if (!st) { this.exitNow = true; return; }
        if (waiting) this.api.leaveLobby(); else st.run();
      };
      this.actionEl.replaceChildren(label ? h("div.row", { style: "justify-content:center" }, [h("button.btn" + (st?.game ? ".orange" : ""), { onclick: run, style: "font-size:19px;padding:12px 20px" }, label)]) : "");
    }
    if (this.exitNow) return "exit";
    return null;
  }
  private exitNow = false;

  /** Re-evaluates the button text (after an activity or lobby changes). */
  refresh() { this.actionKey = ""; }

  render() {
    const r = this.ctx.r;
    r.time = this.time;
    applyTimeOfDay(r, 0.45);
    r.env.snow = 0;
    r.env.fogFar = Math.max(r.env.fogFar, 400);
    r.resize();
    const aspect = r.canvas.clientWidth / Math.max(1, r.canvas.clientHeight);
    const me = this.me, D = this.def;
    const dist = D.w > 20 ? 8 : 6.2, pitch = 0.42;
    const want: Vec3 = [me.x + Math.sin(this.yaw) * Math.cos(pitch) * dist, 1.4 + Math.sin(pitch) * dist, me.z + Math.cos(this.yaw) * Math.cos(pitch) * dist];
    // Keep the camera inside the room.
    want[0] = Math.max(-D.w / 2 + 0.4, Math.min(D.w / 2 - 0.4, want[0]));
    want[2] = Math.max(-D.d / 2 + 0.4, Math.min(D.d / 2 - 0.3, want[2]));
    want[1] = Math.min(D.h - 0.5, want[1]);
    // Backed up against a wall: look down from higher up instead.
    const back = Math.hypot(want[0] - me.x, want[2] - me.z);
    if (back < 3) want[1] = Math.min(D.h - 0.5, want[1] + (3 - back) * 0.8);
    if (Number.isNaN(this.cam[0])) this.cam = [...want] as Vec3;
    for (let i = 0; i < 3; i++) this.cam[i] = lerp(this.cam[i], want[i], 0.25);
    const look: Vec3 = [me.x, 1.2, me.z];
    r.shadowFocus = [me.x, 0, me.z];
    r.cutFocus = null;
    r.begin(lookAt(this.cam, look), perspective(aspect < 0.8 ? 1.1 : 0.95, aspect, 0.2, 500), this.cam);
    const I = compose(0, 0, 0);
    // Indoors the sun doesn't reach: no cast shadows from the walls and ceiling (they'd darken everything).
    r.draw(this.world, I, { always: true, noCast: true });
    r.draw(this.glow, I, { unlit: true, emissive: 0.6, always: true });
    if (this.floorTiles) r.draw(this.floorTiles, I, { unlit: true, emissive: 0.4 + Math.max(0, Math.sin(this.time * 6)) * 0.5, always: true });
    // Your beaver, doing whatever you're doing (dancing, singing, holding a treat…).
    const act = this.api.myAct();
    const dancing = act === "dance", treat = act === "cocoa" || act === "croissant" || act === "icecream" || act === "taffy";
    const danceT = this.time * 4;
    drawBeaver(r, getBeaverMeshes(r, this.ctx.state.look), compose(me.x, dancing ? Math.abs(Math.sin(danceT)) * 0.25 : 0, me.z, me.ry + (dancing ? Math.sin(danceT * 0.5) * 0.9 : 0)), {
      walk: me.walk, moving: me.moving, swim: 0, jump: 0, wave: 0, sled: 0, time: this.time, seed: 1,
      cheer: dancing ? (Math.sin(danceT) > 0 ? 1 : 0.3) : 0, talk: act === "sing" ? 1 : 0, hold: treat ? 1 : 0, sip: treat ? Math.max(0, Math.sin(this.time * 1.2)) * 0.8 : 0,
      expr: act ? "happy" : this.nearest() ? "happy" : "neutral",
    });
    r.end();
  }

  dispose() {
    this.ctx.r.dispose(this.world);
    this.ctx.r.dispose(this.glow);
    if (this.floorTiles) this.ctx.r.dispose(this.floorTiles);
    for (const g of this.meshes) this.ctx.r.dispose(g);
    this.titleEl.remove();
    this.actionEl.replaceChildren();
  }
}

