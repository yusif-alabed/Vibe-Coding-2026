import { mixRgb, type Vec3 } from "../engine/math";
import type { Renderer } from "../engine/renderer";
import type { Prefs } from "../prefs";

/**
 * Day and night. One full in-game day lasts DAY_SECONDS (25 minutes) of real time and is driven by
 * the wall clock, so every player sees the same sunrise and the same starry night at the same moment.
 *
 * Over one cycle: ~2.5 min pink sunrise → ~10 min of bright day with golden hours either side →
 * ~2.5 min orange sunset and purple blue hour → ~7 min of moonlit night → blue hour before dawn.
 */
export const DAY_SECONDS = 25 * 60;

/** Where we are in the 25-minute cycle, 0..1 (shared by everyone). */
export function cyclePos(now = Date.now()): number {
  return (now / 1000 / DAY_SECONDS) % 1;
}

/**
 * Sun phase: 0 = midnight, 0.25 = sunrise, 0.5 = noon, 0.75 = sunset.
 * The real cycle spends a little longer around sunrise and sunset, because that's when it's prettiest.
 */
export function dayPhase(pref: Prefs["time"], now = Date.now()): number {
  if (pref === "golden") return 0.29;
  if (pref === "day") return 0.45;
  if (pref === "night") return 0.0;
  const c = cyclePos(now);
  // cycle position → sun phase
  const keys: [number, number][] = [
    [0, 0.22], // blue hour before dawn
    [0.1, 0.28], // sunrise
    [0.2, 0.33], // golden morning
    [0.45, 0.67], // day
    [0.55, 0.72], // golden evening
    [0.65, 0.79], // sunset → blue hour
    [0.72, 0.85], // nightfall
    [1, 1.22], // night
  ];
  for (let i = 0; i < keys.length - 1; i++) {
    const [c0, p0] = keys[i], [c1, p1] = keys[i + 1];
    if (c <= c1) return (p0 + ((c - c0) / (c1 - c0)) * (p1 - p0)) % 1;
  }
  return 0.22;
}

/** Friendly name and emoji for the time of day (for the HUD). */
export function timeLabel(phase: number): { icon: string; name: string; clock: string } {
  const h = (phase * 24) % 24;
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 10) * 10;
  const clock = `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${hh < 12 ? "AM" : "PM"}`;
  if (h < 5 || h >= 20.5) return { icon: "🌙", name: "Night", clock };
  if (h < 6.3) return { icon: "🌌", name: "Dawn", clock };
  if (h < 8) return { icon: "🌅", name: "Sunrise", clock };
  if (h < 16.5) return { icon: "☀️", name: "Day", clock };
  if (h < 18.3) return { icon: "🌇", name: "Golden hour", clock };
  if (h < 19.4) return { icon: "🌆", name: "Sunset", clock };
  return { icon: "🌌", name: "Dusk", clock };
}

interface Key {
  alt: number;
  sun: Vec3; intensity: number; ambient: number; top: Vec3; horizon: Vec3; ground: Vec3; exposure: number; fogFar: number; stars: number; clouds: number;
}
const KEYS: Key[] = [
  // Deep night: cool silver moonlight, starry sky (still bright enough to play comfortably).
  { alt: -0.5, sun: [0.6, 0.7, 1.0], intensity: 0.95, ambient: 1.45, top: [0.02, 0.04, 0.13], horizon: [0.07, 0.1, 0.23], ground: [0.12, 0.13, 0.2], exposure: 1.25, fogFar: 520, stars: 1, clouds: 0.3 },
  // Blue hour: violet sky, the first or last stars.
  { alt: -0.14, sun: [0.7, 0.62, 0.98], intensity: 0.8, ambient: 1.05, top: [0.09, 0.12, 0.34], horizon: [0.48, 0.38, 0.62], ground: [0.22, 0.19, 0.27], exposure: 1.1, fogFar: 560, stars: 0.6, clouds: 0.6 },
  // Sun on the horizon: pink-orange sky and long rosy light.
  { alt: 0.0, sun: [1.0, 0.5, 0.4], intensity: 0.9, ambient: 0.6, top: [0.24, 0.28, 0.55], horizon: [1.0, 0.58, 0.46], ground: [0.4, 0.27, 0.25], exposure: 1.06, fogFar: 620, stars: 0.08, clouds: 0.9 },
  // Golden hour: the warm postcard look.
  { alt: 0.16, sun: [1.0, 0.8, 0.56], intensity: 1.45, ambient: 0.78, top: [0.2, 0.46, 0.82], horizon: [0.78, 0.87, 0.94], ground: [0.5, 0.44, 0.3], exposure: 1.08, fogFar: 760, stars: 0, clouds: 1 },
  // Midday: crisp, clean and bright.
  { alt: 0.6, sun: [1.0, 0.96, 0.88], intensity: 1.5, ambient: 0.84, top: [0.17, 0.45, 0.86], horizon: [0.74, 0.86, 0.96], ground: [0.5, 0.46, 0.34], exposure: 1.05, fogFar: 820, stars: 0, clouds: 1 },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);

/** Sets the renderer's sky and lighting for this moment. Returns how "night" it is (0..1). */
export function applyTimeOfDay(r: Renderer, phase: number): number {
  const th = (phase - 0.25) * Math.PI * 2;
  // Sun path: rises in the east (+x), arcs over the south, sets in the west. Kept fairly low so
  // shadows stay long and dramatic.
  const alt = Math.sin(th) * 0.78;
  let i = 0;
  while (i < KEYS.length - 2 && alt > KEYS[i + 1].alt) i++;
  const a = KEYS[i], b = KEYS[i + 1];
  const t = smooth(Math.max(0, Math.min(1, (alt - a.alt) / (b.alt - a.alt))));
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
  // At night the moon (opposite the sun) casts the shadows; blend across the horizon so they don't jump.
  const moonDir: Vec3 = [-Math.cos(th) * 0.6, 0.62, -0.35];
  const night = Math.max(0, Math.min(1, (-alt + 0.02) / 0.3));
  const k = smooth(Math.max(0, Math.min(1, (night - 0.25) / 0.5)));
  const dir: Vec3 = [lerp(sunDir[0], moonDir[0], k), lerp(sunDir[1], moonDir[1], k), lerp(sunDir[2], moonDir[2], k)];
  const l = Math.hypot(dir[0], dir[1], dir[2]);
  e.lightDir = [dir[0] / l, dir[1] / l, dir[2] / l];
  e.moonDir = moonDir;
  return night;
}
