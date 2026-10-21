import { seasonAt, weatherAt, type Season, type Weather, type WeatherNow } from "@beaver/shared";
import { compose, hash2, hexToRgb, mixRgb, type Vec3 } from "../engine/math";
import { MeshBuilder } from "../engine/mesh";
import type { GpuMesh, Renderer } from "../engine/renderer";
import type { Prefs } from "../prefs";

/**
 * Seasons and weather effects: tints the greenery for the season, settles snow in winter, wets the
 * town when it rains, and draws rain, snowflakes, falling leaves, spring petals and rainbows.
 */

export interface WorldMood {
  season: Season;
  weather: WeatherNow;
}

export function currentMood(prefs: Prefs, now = Date.now()): WorldMood {
  const season = prefs.season && prefs.season !== "auto" ? prefs.season : seasonAt(now);
  let weather = weatherAt(now, season);
  if (prefs.weather && prefs.weather !== "auto") weather = { kind: prefs.weather as Weather, amount: 1, remaining: 300 };
  // Snowfall outside winter becomes rain, rain in winter becomes snow.
  if (weather.kind === "snow" && season !== "winter") weather = { ...weather, kind: "rain" };
  if (weather.kind === "rain" && season === "winter") weather = { ...weather, kind: "snow" };
  return { season, weather };
}

const SEASON_TINT: Record<Season, [number, number, number, number]> = {
  spring: [0.55, 0.9, 0.42, 0.25],
  summer: [0.42, 0.78, 0.26, 0.12],
  autumn: [0.98, 0.58, 0.16, 0.55],
  winter: [0.62, 0.72, 0.62, 0.35],
};

/** Adjusts the lighting the day/night cycle set up, for the season and weather. */
export function applyMood(r: Renderer, mood: WorldMood) {
  const e = r.env;
  const w = mood.weather, a = w.amount;
  e.seasonCol = SEASON_TINT[mood.season];
  e.snow = mood.season === "winter" ? 0.8 : 0;
  e.wet = 0;
  const grey = (c: Vec3, k: number): Vec3 => mixRgb(c, [0.62, 0.66, 0.72].map((v, i) => v * (0.4 + 0.6 * (c[0] + c[1] + c[2]) / 1.6)) as Vec3, k);
  if (w.kind === "cloudy") {
    e.clouds = Math.min(1.6, e.clouds + 0.6 * a);
    e.sunIntensity *= 1 - 0.3 * a;
    e.skyTop = grey(e.skyTop, 0.35 * a);
  }
  if (w.kind === "rain" || w.kind === "snow") {
    e.clouds = Math.min(1.8, e.clouds + 0.9 * a);
    e.sunIntensity *= 1 - 0.5 * a;
    e.ambient *= 1 + 0.08 * a;
    e.skyTop = grey(e.skyTop, 0.6 * a);
    e.skyHorizon = grey(e.skyHorizon, 0.5 * a);
    e.fogFar = e.fogFar * (1 - 0.5 * a) + 220 * 0.5 * a;
    if (w.kind === "rain") e.wet = a;
    if (w.kind === "snow") e.snow = Math.max(e.snow, 0.8 + 0.2 * a);
  }
  if (w.kind === "fog") {
    e.fogNear = 45 * (1 - a) + 8 * a;
    e.fogFar = e.fogFar * (1 - a) + 170 * a;
    e.fogHeight = 0.011 * (1 - a) + 0.03 * a;
    e.skyHorizon = mixRgb(e.skyHorizon, [0.82, 0.84, 0.86], 0.5 * a);
    e.sunIntensity *= 1 - 0.25 * a;
  }
}

interface FxMeshes { rain: GpuMesh; snow: GpuMesh; leaves: GpuMesh; petals: GpuMesh; rainbow: GpuMesh; umbrella: GpuMesh[] }
const cache = new WeakMap<Renderer, FxMeshes>();

const BOX = 56, HEIGHT = 26;

function fx(r: Renderer): FxMeshes {
  let m = cache.get(r);
  if (m) return m;
  const rain = new MeshBuilder();
  for (let i = 0; i < 1100; i++) {
    const x = (hash2(i, 1) - 0.5) * BOX, y = hash2(i, 2) * HEIGHT, z = (hash2(i, 3) - 0.5) * BOX;
    rain.box(compose(x, y, z, 0, 0.12, 0, 0.025, 0.9, 0.025), [0.82, 0.88, 0.96]);
  }
  const snow = new MeshBuilder();
  for (let i = 0; i < 900; i++) {
    const x = (hash2(i, 4) - 0.5) * BOX, y = hash2(i, 5) * HEIGHT, z = (hash2(i, 6) - 0.5) * BOX;
    const v0 = snow.vertexCount;
    snow.box(compose(x, y, z, i, i * 0.3, 0, 0.09, 0.09, 0.09), [1, 1, 1]);
    snow.setSway(v0, () => 0.6 + hash2(i, 7) * 0.8);
  }
  const leafCols = ["#e2722b", "#d9483b", "#f2b13b", "#c8873a", "#a83a28"].map(hexToRgb);
  const leaves = new MeshBuilder();
  for (let i = 0; i < 220; i++) {
    const x = (hash2(i, 8) - 0.5) * BOX, y = hash2(i, 9) * HEIGHT, z = (hash2(i, 10) - 0.5) * BOX;
    const v0 = leaves.vertexCount;
    leaves.box(compose(x, y, z, i, i * 0.7, i * 1.3, 0.22, 0.02, 0.15), leafCols[i % leafCols.length]);
    leaves.setSway(v0, () => 1.5 + hash2(i, 11) * 1.5);
  }
  const petalCols = ["#ffc4dc", "#ffffff", "#ff9fc4"].map(hexToRgb);
  const petals = new MeshBuilder();
  for (let i = 0; i < 260; i++) {
    const x = (hash2(i, 12) - 0.5) * BOX, y = hash2(i, 13) * HEIGHT, z = (hash2(i, 14) - 0.5) * BOX;
    const v0 = petals.vertexCount;
    petals.box(compose(x, y, z, i, i * 0.5, i, 0.12, 0.015, 0.1), petalCols[i % petalCols.length]);
    petals.setSway(v0, () => 1.2 + hash2(i, 15) * 1.4);
  }
  const rainbow = new MeshBuilder();
  const bands = ["#ff5a5a", "#ffa04a", "#ffe45a", "#6ee07a", "#5ab8ff", "#6a7cff", "#b46aff"];
  bands.forEach((c, i) => rainbow.torus(compose(0, 0, 0, 0, Math.PI / 2, 0), c, 1 - i * 0.022, 0.011, 64, 4));
  const umbrella: GpuMesh[] = [];
  for (const c of ["#e2483d", "#2fa7a2", "#f5c242", "#a77bff", "#ff7eb3"]) {
    const u = new MeshBuilder();
    u.cone(compose(0, 0.25, 0, 0, 0, 0, 1.6, 0.45, 1.6), (x, _y, z) => (Math.floor(((Math.atan2(z, x) + Math.PI) / (Math.PI * 2)) * 8) % 2 ? hexToRgb(c) : hexToRgb("#fffaf0")), 16);
    u.cylinder(compose(0, -0.45, 0, 0, 0, 0, 0.05, 1.3, 0.05), "#5b3a24", 5);
    u.torus(compose(0.08, -1.1, 0, 0, Math.PI / 2, 0, 0.08, 0.08, 0.08), "#5b3a24", 1, 0.3, 8, 4);
    umbrella.push(r.upload(u.build()));
  }
  m = {
    rain: r.upload(rain.build()), snow: r.upload(snow.build()), leaves: r.upload(leaves.build()), petals: r.upload(petals.build()),
    rainbow: r.upload(rainbow.build()), umbrella,
  };
  cache.set(r, m);
  return m;
}

/** Falling things around the camera, plus the rainbow. */
export function drawWeather(r: Renderer, mood: WorldMood, time: number, cam: Vec3, night: number) {
  const m = fx(r);
  const w = mood.weather;
  const vol = (mesh: GpuMesh, speed: number, opts: Parameters<Renderer["draw"]>[2]) => {
    const fall = (time * speed) % HEIGHT;
    for (const k of [0, 1]) r.draw(mesh, compose(cam[0], cam[1] - HEIGHT * 0.55 - fall + k * HEIGHT, cam[2]), opts);
  };
  if (w.kind === "rain" && w.amount > 0.02) vol(m.rain, 22, { unlit: true, alpha: 0.4 * w.amount, noCast: true, noFog: true });
  if (w.kind === "snow" && w.amount > 0.02) vol(m.snow, 1.8, { unlit: true, emissive: 0.1, alpha: 0.9 * w.amount, sway: 0.5, noCast: true });
  if (mood.season === "autumn" && w.kind !== "rain") vol(m.leaves, 1.3, { unlit: true, emissive: 0.05 - night * 0.4, alpha: 0.95, sway: 0.6, noCast: true });
  if (mood.season === "spring" && w.kind !== "rain") vol(m.petals, 1.1, { unlit: true, emissive: 0.1 - night * 0.4, alpha: 0.95, sway: 0.6, noCast: true });
  if (w.kind === "rainbow" && w.amount > 0.02 && night < 0.5) {
    // Opposite the sun, far away over the mountains.
    const L = r.env.lightDir;
    const dx = -L[0], dz = -L[2], l = Math.hypot(dx, dz) || 1;
    const px = cam[0] + (dx / l) * 200, pz = cam[2] + (dz / l) * 200;
    r.draw(m.rainbow, compose(px, -75, pz, Math.atan2(dx, dz), 0, 0, 125), { unlit: true, emissive: 0.3, alpha: 0.5 * w.amount * Math.max(0, 1 - night * 2), noCast: true, noFog: true });
  }
}

export function umbrellaMesh(r: Renderer, seed: number): GpuMesh {
  const u = fx(r).umbrella;
  return u[Math.abs(Math.floor(seed * 7)) % u.length];
}

/** Is it wet enough out that beavers carry umbrellas? */
export function umbrellaWeather(mood: WorldMood): number {
  return mood.weather.kind === "rain" || mood.weather.kind === "snow" ? mood.weather.amount : 0;
}
