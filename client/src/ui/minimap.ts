import { HUB, HUB_COLLIDERS, HUB_PLACES, LODGE, TOWN_BUILDINGS, TRAILS } from "@beaver/shared";
import { heightAt, plazaEdge, riverDist, WATER_Y, type HubWorld } from "../game/hubWorld";
import { h } from "./dom";

/**
 * Minimap in the corner: turns with your camera so "up" is always the way you're facing.
 * Tap it (or press M) for the big north-up town map with every place named.
 * Shows you, other beavers (friends in green), golden pinecones and every landmark.
 */

const SPAN = 220; // metres covered by the background image (-110..110)
const PPM = 2; // background pixels per metre

let bgCache: HTMLCanvasElement | null = null;

function distSeg(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

/** Paints the town once: meadow, forest, water, trails, plaza and building footprints. */
function background(): HTMLCanvasElement {
  if (bgCache) return bgCache;
  const N = SPAN * PPM;
  const c = document.createElement("canvas");
  c.width = c.height = N;
  const g = c.getContext("2d")!;
  const img = g.createImageData(N, N);
  const d = img.data;
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      const x = px / PPM - SPAN / 2, z = py / PPM - SPAN / 2;
      const r = Math.hypot(x, z);
      const y = heightAt(x, z);
      let col: [number, number, number];
      if (y < WATER_Y - 0.05) col = y < -1.1 ? [52, 128, 160] : [74, 168, 184];
      else if (r < plazaEdge(Math.atan2(z, x))) col = [200, 190, 172];
      else if (TRAILS.some((t) => distSeg(x, z, ...t) < 2.2)) col = [222, 196, 148];
      else if (riverDist(x, z) < 4.6) col = [214, 200, 160];
      else if (z < HUB_PLACES.trailhead.z - 4 && y > 1.2) col = [236, 242, 248];
      else {
        const n = Math.sin(x * 0.21) * Math.cos(z * 0.17) * 8;
        col = [128 + n, 176 + n, 96 + n];
      }
      if (r > HUB.radius) col = [col[0] * 0.55, col[1] * 0.62, col[2] * 0.55];
      const i = (py * N + px) * 4;
      d[i] = col[0]; d[i + 1] = col[1]; d[i + 2] = col[2]; d[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  g.setTransform(PPM, 0, 0, PPM, (SPAN / 2) * PPM, (SPAN / 2) * PPM);
  // Trees and rocks (small solid circles).
  g.fillStyle = "rgba(48, 104, 70, 0.9)";
  for (const s of HUB_COLLIDERS) {
    if (s.r < 0.9 || s.r > 3.2) continue;
    g.beginPath();
    g.arc(s.x, s.z, Math.min(2.2, s.r * 0.9), 0, Math.PI * 2);
    g.fill();
  }
  // Buildings.
  const roof = ["#c8473a", "#4b505b", "#3f6b5a", "#8a3b2e", "#2f7fb0"];
  const rect = (x: number, z: number, ry: number, w: number, dd: number, fill: string, round = false) => {
    g.save();
    g.translate(x, z);
    g.rotate(-ry);
    g.fillStyle = fill;
    g.strokeStyle = "#3b251b";
    g.lineWidth = 0.6;
    g.beginPath();
    if (round) g.arc(0, 0, w / 2, 0, Math.PI * 2);
    else g.rect(-w / 2, -dd / 2, w, dd);
    g.fill();
    g.stroke();
    g.restore();
  };
  rect(LODGE.x, LODGE.z, LODGE.ry, LODGE.width, LODGE.depth, "#7a4b2c");
  rect(HUB_PLACES.outfitter.x, HUB_PLACES.outfitter.z, Math.atan2(-HUB_PLACES.outfitter.x, -HUB_PLACES.outfitter.z), 8, 6.5, "#c8473a");
  rect(HUB_PLACES.arcade.x, HUB_PLACES.arcade.z, Math.atan2(-HUB_PLACES.arcade.x, -HUB_PLACES.arcade.z), 7.5, 6.5, "#28b9b7");
  for (const b of TOWN_BUILDINGS) {
    if (b.kind === "stall") continue;
    const round = ["bandstand", "observatory", "lighthouse", "windmill", "tent"].includes(b.kind);
    rect(b.x, b.z, b.ry, b.kind === "ferris" ? 6 : b.w, b.kind === "ferris" ? 3 : b.d, round ? "#e9dfcc" : roof[b.seed % roof.length], round);
  }
  // Fountain.
  g.fillStyle = "#4fa7b3";
  g.beginPath();
  g.arc(0, 0, 5.2, 0, Math.PI * 2);
  g.fill();
  bgCache = c;
  return c;
}

export interface MinimapDot { x: number; z: number; kind: "player" | "friend" | "cone" }

export class Minimap {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private big = false;
  private last = 0;
  private wrap: HTMLElement;

  constructor(parent: HTMLElement, private world: HubWorld) {
    this.canvas = h("canvas") as HTMLCanvasElement;
    this.wrap = h("div.minimap-wrap", { onclick: (e: Event) => { if (this.big && e.target === this.wrap) this.toggle(); } });
    this.el = h("div.minimap.pe", { title: "Map (M)", onclick: () => this.toggle() }, [this.canvas]);
    this.wrap.append(this.el);
    parent.append(this.wrap);
    window.addEventListener("keydown", this.onKey);
  }

  private onKey = (e: KeyboardEvent) => {
    if ((e.target as HTMLElement)?.tagName === "INPUT") return;
    if (e.key.toLowerCase() === "m") this.toggle();
    if (e.key === "Escape" && this.big) this.toggle();
  };

  toggle() {
    this.big = !this.big;
    this.el.classList.toggle("big", this.big);
    this.wrap.classList.toggle("big", this.big);
    this.last = 0;
  }

  get isBig() {
    return this.big;
  }

  /** Redraws (about 12 times a second). yaw is the follow camera's yaw; ry is your beaver's facing. */
  update(now: number, me: { x: number; z: number; ry: number }, yaw: number, dots: MinimapDot[]) {
    if (now - this.last < 80) return;
    this.last = now;
    const css = this.el.clientWidth;
    if (!css) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const size = Math.round(css * dpr);
    if (this.canvas.width !== size) { this.canvas.width = size; this.canvas.height = size; }
    const g = this.canvas.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, size, size);
    const bg = background();
    const half = size / 2;
    // World → screen. Small map: centred on you, rotated so your camera's forward is up.
    // Big map: whole town, north (-z) up.
    let a: number, b: number, c: number, d: number, e: number, f: number;
    if (this.big) {
      const s = size / (HUB.radius * 2 + 16);
      a = s; b = 0; c = 0; d = s; e = half; f = half;
    } else {
      const s = (size / 72);
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      // screen x = right component, screen y = -forward component
      a = -fz * s; c = fx * s; b = -fx * s; d = -fz * s;
      e = half - (a * me.x + c * me.z);
      f = half - (b * me.x + d * me.z);
    }
    const toScreen = (x: number, z: number): [number, number] => [a * x + c * z + e, b * x + d * z + f];
    g.save();
    g.beginPath();
    if (this.big) g.rect(0, 0, size, size);
    else g.arc(half, half, half - 1, 0, Math.PI * 2);
    g.clip();
    g.fillStyle = "#3d5a3a";
    g.fillRect(0, 0, size, size);
    g.setTransform(a, b, c, d, e, f);
    g.imageSmoothingEnabled = true;
    g.drawImage(bg, -SPAN / 2, -SPAN / 2, SPAN, SPAN);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // Landmarks (emoji stay upright).
    const em = Math.round((this.big ? 15 : 13) * dpr);
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (const l of this.world.labels) {
      const [sx, sy] = toScreen(l.x, l.z);
      if (sx < -20 || sy < -20 || sx > size + 20 || sy > size + 20) continue;
      const [icon, ...rest] = l.text.split(" ");
      g.font = `${em}px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
      g.fillText(icon, sx, sy);
      if (this.big) {
        g.font = `800 ${Math.round(10 * dpr)}px Nunito, ui-rounded, system-ui, sans-serif`;
        g.lineWidth = 3 * dpr;
        g.strokeStyle = "rgba(255,250,240,0.95)";
        g.strokeText(rest.join(" "), sx, sy + em * 0.95);
        g.fillStyle = "#3b251b";
        g.fillText(rest.join(" "), sx, sy + em * 0.95);
      }
    }
    // Pinecones, other beavers, friends.
    for (const dot of dots) {
      const [sx, sy] = toScreen(dot.x, dot.z);
      g.beginPath();
      if (dot.kind === "cone") {
        g.fillStyle = "#ffc93c";
        g.strokeStyle = "#8a5a1a";
        g.lineWidth = dpr;
        g.arc(sx, sy, 2.6 * dpr, 0, Math.PI * 2);
      } else {
        g.fillStyle = dot.kind === "friend" ? "#4cd964" : "#fffaf0";
        g.strokeStyle = "#3b251b";
        g.lineWidth = 1.5 * dpr;
        g.arc(sx, sy, 3.6 * dpr, 0, Math.PI * 2);
      }
      g.fill();
      g.stroke();
    }
    // You: a gold arrow pointing the way you face.
    const [mx, my] = toScreen(me.x, me.z);
    const [hx, hy] = toScreen(me.x + Math.sin(me.ry), me.z + Math.cos(me.ry));
    const ang = Math.atan2(hy - my, hx - mx);
    g.translate(mx, my);
    g.rotate(ang);
    g.beginPath();
    const k = 7 * dpr;
    g.moveTo(k, 0);
    g.lineTo(-k * 0.7, k * 0.65);
    g.lineTo(-k * 0.35, 0);
    g.lineTo(-k * 0.7, -k * 0.65);
    g.closePath();
    g.fillStyle = "#ffd14f";
    g.strokeStyle = "#3b251b";
    g.lineWidth = 2 * dpr;
    g.fill();
    g.stroke();
    g.restore();
    // North marker on the rim of the small map.
    if (!this.big) {
      const nx = c * -1, ny = d * -1; // screen direction of world -z
      const l = Math.hypot(nx, ny) || 1;
      const px = half + (nx / l) * (half - 9 * dpr), py = half + (ny / l) * (half - 9 * dpr);
      g.beginPath();
      g.fillStyle = "#3b251b";
      g.arc(px, py, 7 * dpr, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#fffaf0";
      g.font = `800 ${Math.round(9 * dpr)}px Nunito, system-ui, sans-serif`;
      g.fillText("N", px, py + 0.5 * dpr);
    }
  }

  dispose() {
    window.removeEventListener("keydown", this.onKey);
    this.wrap.remove();
  }
}
