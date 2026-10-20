import { mixRgb, type Vec3 } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import type { Prefs } from "../prefs";

/**
 * Day and night. One in-game day lasts DAY_SECONDS of real time and is driven by the wall clock,
 * so everyone in the village sees the same sunset at the same moment. Golden hour gets extra time
 * on either side of the day because it's the look the village was designed around.
 */
export const DAY_SECONDS = 40 * 60;

/** 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset. */
export function dayPhase(pref: Prefs["time"], now = Date.now()): number {
  if (pref === "golden") return 0.29;
  if (pref === "day") return 0.45;
  if (pref === "night") return 0.0;
  // Days are long and nights are short (about a fifth of the cycle), with a slow golden hour each side.
  const c = (now / 1000 / DAY_SECONDS) % 1;
  const keys: [number, number][] = [[0, 0.26], [0.66, 0.74], [0.72, 0.84], [0.86, 1.16], [1, 1.26]];
  for (let i = 0; i < keys.length - 1; i++) {
    const [c0, p0] = keys[i], [c1, p1] = keys[i + 1];
    if (c <= c1) return (p0 + ((c - c0) / (c1 - c0)) * (p1 - p0)) % 1;
  }
  return 0.26;
}

interface Key {
  alt: number;
  sun: Vec3; intensity: number; ambient: number; top: Vec3; horizon: Vec3; ground: Vec3; exposure: number; fogFar: number; stars: number; clouds: number;
}
const KEYS: Key[] = [
  { alt: -0.35, sun: [0.52, 0.62, 0.95], intensity: 0.5, ambient: 0.6, top: [0.02, 0.05, 0.14], horizon: [0.09, 0.12, 0.24], ground: [0.1, 0.11, 0.14], exposure: 1.1, fogFar: 520, stars: 1, clouds: 0.35 },
  { alt: -0.06, sun: [0.98, 0.5, 0.42], intensity: 0.6, ambient: 0.56, top: [0.13, 0.17, 0.38], horizon: [0.93, 0.52, 0.42], ground: [0.3, 0.24, 0.22], exposure: 1.05, fogFar: 620, stars: 0.35, clouds: 0.8 },
  { alt: 0.16, sun: [1.0, 0.8, 0.56], intensity: 1.45, ambient: 0.78, top: [0.2, 0.46, 0.82], horizon: [0.78, 0.87, 0.94], ground: [0.5, 0.44, 0.3], exposure: 1.08, fogFar: 760, stars: 0, clouds: 1 },
  { alt: 0.6, sun: [1.0, 0.95, 0.86], intensity: 1.5, ambient: 0.84, top: [0.17, 0.45, 0.86], horizon: [0.74, 0.86, 0.96], ground: [0.5, 0.46, 0.34], exposure: 1.05, fogFar: 820, stars: 0, clouds: 1 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Sets the renderer's sky and lighting for this moment. Returns how "night" it is (0..1). */
export function applyTimeOfDay(r: Renderer, phase: number): number {
  const th = (phase - 0.25) * Math.PI * 2;
  // Sun path: rises in the east (+x), arcs over the south, sets in the west. Kept fairly low.
  const alt = Math.sin(th) * 0.78;
  let i = 0;
  while (i < KEYS.length - 2 && alt > KEYS[i + 1].alt) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = Math.max(0, Math.min(1, (alt - a.alt) / (b.alt - a.alt)));
  const e = r.env;
  e.sunColor = mixRgb(a.sun, b.sun, t);
  e.sunIntensity = lerp(a.intensity, b.intensity, t);
  e.ambient = lerp(a.ambient, b.ambient, t);
  e.skyTop = mixRgb(a.top, b.top, t);
  e.skyHorizon = mixRgb(a.horizon, b.horizon, t);
  e.ground = mixRgb(a.ground, b.ground, t);
  e.exposure = lerp(a.exposure, b.exposure, t);
  e.fogNear = 45;
  e.fogFar = lerp(a.fogFar, b.fogFar, t);
  e.fogHeight = 0.011;
  e.stars = lerp(a.stars, b.stars, t);
  e.clouds = lerp(a.clouds, b.clouds, t);
  e.sky = true;
  const sunDir: Vec3 = [Math.cos(th) * 0.86, Math.max(0.06, alt), 0.28 + Math.abs(Math.cos(th)) * 0.1];
  // At night the moon (opposite the sun) casts the shadows.
  const moonDir: Vec3 = [-Math.cos(th) * 0.6, 0.62, -0.35];
  const night = Math.max(0, Math.min(1, (-alt + 0.02) / 0.3));
  const dir = night > 0.5 ? moonDir : sunDir;
  const l = Math.hypot(dir[0], dir[1], dir[2]);
  e.lightDir = [dir[0] / l, dir[1] / l, dir[2] / l];
  e.moonDir = moonDir;
  return night;
}
