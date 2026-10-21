import { hashString } from "./quests";

/**
 * Seasons and weather, worked out from the clock so every player sees the same sky.
 * Seasons follow the real calendar month; weather changes every few minutes.
 */

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather = "clear" | "cloudy" | "rain" | "snow" | "fog" | "rainbow";

export function seasonAt(now = Date.now()): Season {
  const m = new Date(now).getUTCMonth(); // 0 = Jan
  if (m >= 2 && m <= 4) return "spring";
  if (m >= 5 && m <= 7) return "summer";
  if (m >= 8 && m <= 10) return "autumn";
  return "winter";
}

/** One weather spell lasts this long. */
export const WEATHER_SECONDS = 5 * 60;

function rawWeather(slot: number, season: Season): Weather {
  const r = (hashString(`weather|${slot}`) % 1000) / 1000;
  const wet: Weather = season === "winter" ? "snow" : "rain";
  if (season === "winter") return r < 0.45 ? "clear" : r < 0.62 ? "cloudy" : r < 0.88 ? "snow" : "fog";
  if (season === "summer") return r < 0.62 ? "clear" : r < 0.78 ? "cloudy" : r < 0.92 ? wet : "fog";
  return r < 0.48 ? "clear" : r < 0.64 ? "cloudy" : r < 0.84 ? wet : "fog";
}

export interface WeatherNow {
  kind: Weather;
  /** 0..1, eases in and out at the edges of each spell. */
  amount: number;
  /** Seconds left in this spell. */
  remaining: number;
}

/** The weather right now (a rainbow follows a rain shower when the sky clears). */
export function weatherAt(now = Date.now(), season: Season = seasonAt(now)): WeatherNow {
  const t = now / 1000 / WEATHER_SECONDS;
  const slot = Math.floor(t);
  const f = t - slot;
  let kind = rawWeather(slot, season);
  if (kind === "clear" && rawWeather(slot - 1, season) === "rain") kind = "rainbow";
  const edge = 40 / WEATHER_SECONDS;
  const amount = Math.min(1, f / edge, (1 - f) / edge);
  return { kind, amount: Math.max(0, amount), remaining: (1 - f) * WEATHER_SECONDS };
}

export const SEASON_INFO: Record<Season, { icon: string; name: string }> = {
  spring: { icon: "🌸", name: "Spring" },
  summer: { icon: "🌞", name: "Summer" },
  autumn: { icon: "🍂", name: "Autumn" },
  winter: { icon: "❄️", name: "Winter" },
};

export const WEATHER_INFO: Record<Weather, { icon: string; name: string }> = {
  clear: { icon: "", name: "Clear" },
  cloudy: { icon: "☁️", name: "Cloudy" },
  rain: { icon: "🌧️", name: "Rain" },
  snow: { icon: "🌨️", name: "Snow" },
  fog: { icon: "🌫️", name: "Fog" },
  rainbow: { icon: "🌈", name: "Rainbow" },
};
