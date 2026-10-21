import { compose, hexToRgb, type Vec3 } from "../../engine/math";
import { MeshBuilder } from "../../engine/mesh";
import type { GpuMesh, Renderer } from "../../engine/renderer";

/**
 * Chunky 3D letters, built from a 5×7 block font.
 *
 * The Word Lodge needs real letters standing in the world — on tiles that flip, on cards you
 * pick up, carved into the sign over the door — and the game has no textures and no font
 * loading, so they're modelled from boxes like everything else. Horizontal runs of pixels
 * merge into single boxes, which takes a glyph from 35 boxes down to a dozen or so.
 *
 * A glyph is 1.0 wide and 1.4 tall, centred on the origin, so callers can scale it freely.
 */

const GLYPHS: Record<string, string> = {
  A: ".###.|#...#|#...#|#####|#...#|#...#|#...#",
  B: "####.|#...#|#...#|####.|#...#|#...#|####.",
  C: ".###.|#...#|#....|#....|#....|#...#|.###.",
  D: "####.|#...#|#...#|#...#|#...#|#...#|####.",
  E: "#####|#....|#....|####.|#....|#....|#####",
  F: "#####|#....|#....|####.|#....|#....|#....",
  G: ".###.|#...#|#....|#.###|#...#|#...#|.###.",
  H: "#...#|#...#|#...#|#####|#...#|#...#|#...#",
  I: "#####|..#..|..#..|..#..|..#..|..#..|#####",
  J: "..###|...#.|...#.|...#.|...#.|#..#.|.##..",
  K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
  L: "#....|#....|#....|#....|#....|#....|#####",
  M: "#...#|##.##|#.#.#|#...#|#...#|#...#|#...#",
  N: "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#",
  O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
  P: "####.|#...#|#...#|####.|#....|#....|#....",
  Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
  R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
  S: ".####|#....|#....|.###.|....#|....#|####.",
  T: "#####|..#..|..#..|..#..|..#..|..#..|..#..",
  U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
  V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
  W: "#...#|#...#|#...#|#...#|#.#.#|##.##|#...#",
  X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
  Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..",
  Z: "#####|....#|...#.|..#..|.#...|#....|#####",
  "0": ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.",
  "1": "..#..|.##..|..#..|..#..|..#..|..#..|.###.",
  "2": ".###.|#...#|....#|...#.|..#..|.#...|#####",
  "3": "####.|....#|....#|.###.|....#|....#|####.",
  "4": "#..#.|#..#.|#..#.|#####|...#.|...#.|...#.",
  "5": "#####|#....|####.|....#|....#|#...#|.###.",
  "6": ".###.|#...#|#....|####.|#...#|#...#|.###.",
  "7": "#####|....#|...#.|..#..|.#...|.#...|.#...",
  "8": ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
  "9": ".###.|#...#|#...#|.####|....#|#...#|.###.",
  "?": ".###.|#...#|....#|...#.|..#..|.....|..#..",
  "!": "..#..|..#..|..#..|..#..|..#..|.....|..#..",
  "-": ".....|.....|.....|#####|.....|.....|.....",
  "'": "..#..|..#..|.....|.....|.....|.....|.....",
};

const COLS = 5;
const ROWS = 7;
const CELL_W = 1 / COLS;
const CELL_H = 1.4 / ROWS;
/** How far a letter stands off the tile it sits on. */
export const LETTER_DEPTH = 0.16;

/** One box of a glyph, in glyph space: centred on the origin, 1.0 wide and 1.4 tall. */
export interface GlyphRect { x: number; y: number; w: number; h: number }

/**
 * The boxes that make up a glyph. Exposed as plain rectangles rather than only as a mesh so
 * callers that build geometry inside a building's own frame (the sign over the Lodge door)
 * can place them with the same helper they use for everything else.
 */
export function glyphRects(ch: string): GlyphRect[] {
  const key = ch.toUpperCase();
  const cached = rectCache.get(key);
  if (cached) return cached;
  const rows = GLYPHS[key];
  const out: GlyphRect[] = [];
  if (rows) {
    rows.split("|").forEach((row, r) => {
      const y = 0.7 - (r + 0.5) * CELL_H;
      let c = 0;
      while (c < COLS) {
        if (row[c] !== "#") { c++; continue; }
        // Merge the run of lit cells into one box rather than emitting each separately.
        let end = c;
        while (end + 1 < COLS && row[end + 1] === "#") end++;
        const n = end - c + 1;
        out.push({ x: -0.5 + (c + n / 2) * CELL_W, y, w: n * CELL_W, h: CELL_H });
        c = end + 1;
      }
    });
  }
  rectCache.set(key, out);
  return out;
}
const rectCache = new Map<string, GlyphRect[]>();

/** Builds one glyph, centred on the origin, 1.0 wide and 1.4 tall. */
export function letterMesh(ch: string, color: Vec3 | string = "#2e1c12", depth = LETTER_DEPTH): MeshBuilder {
  const m = new MeshBuilder();
  for (const q of glyphRects(ch)) m.box(compose(q.x, q.y, 0, 0, 0, 0, q.w, q.h, depth), color);
  return m;
}

/** True when this character can be drawn. */
export function hasGlyph(ch: string): boolean {
  return GLYPHS[ch.toUpperCase()] !== undefined;
}

interface LetterSet {
  get(ch: string): GpuMesh | null;
  dispose(): void;
}

const cache = new WeakMap<Renderer, Map<string, LetterSet>>();

/**
 * The uploaded glyphs for one colour, built once per renderer and reused for every tile. A
 * Wordle board draws thirty letters a frame; they must all come from the same five meshes.
 */
export function letters(r: Renderer, color: string = "#2e1c12"): LetterSet {
  let byColor = cache.get(r);
  if (!byColor) cache.set(r, (byColor = new Map()));
  let set = byColor.get(color);
  if (set) return set;

  const meshes = new Map<string, GpuMesh | null>();
  set = {
    get(ch: string) {
      const key = ch.toUpperCase();
      if (meshes.has(key)) return meshes.get(key)!;
      const built = GLYPHS[key] ? r.upload(letterMesh(key, color).build()) : null;
      meshes.set(key, built);
      return built;
    },
    dispose() {
      for (const m of meshes.values()) if (m) r.dispose(m);
      meshes.clear();
      byColor!.delete(color);
    },
  };
  byColor.set(color, set);
  return set;
}

/**
 * Draws a word centred on (x, y, z), lying in the XY plane and facing +z.
 * `size` is the cap height of a letter in world units.
 */
export function drawWord(
  r: Renderer,
  set: LetterSet,
  text: string,
  x: number, y: number, z: number,
  size: number,
  opts: { ry?: number; rx?: number; spacing?: number; emissive?: number; unlit?: boolean; alpha?: number; tint?: [number, number, number, number] } = {},
): void {
  const spacing = opts.spacing ?? 0.78;
  const step = size * spacing;
  const start = -((text.length - 1) * step) / 2;
  const ry = opts.ry ?? 0, rx = opts.rx ?? 0;
  const cy = Math.cos(ry), sy = Math.sin(ry);
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " ") continue;
    const mesh = set.get(ch);
    if (!mesh) continue;
    const off = start + i * step;
    // Offset along the word's own left-to-right axis, which the yaw rotates.
    r.draw(mesh, compose(x + off * cy, y, z - off * sy, ry, rx, 0, size), {
      unlit: opts.unlit, emissive: opts.emissive, alpha: opts.alpha, tint: opts.tint,
    });
  }
}

export const INK = hexToRgb("#2e1c12");
