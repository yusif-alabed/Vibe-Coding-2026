/** Per-device settings (graphics, time of day, touch controls), saved in this browser. */
export interface Prefs {
  graphics: "high" | "low";
  time: "auto" | "golden" | "day" | "night";
  joystick: "auto" | "on" | "off";
  season: "auto" | "spring" | "summer" | "autumn" | "winter";
  weather: "auto" | "clear" | "rain" | "snow" | "fog" | "rainbow";
  /** Bigger text and buttons. */
  textSize: "normal" | "large";
  /** Map markers drawn with distinct shapes as well as colours. */
  shapes: boolean;
  /** Little vibrations on phones for coins, quests and bumps. */
  haptics: boolean;
  /** How far away (metres) buildings, trees and props are drawn. Lower = faster. */
  renderDist: number;
}

const KEY = "bb-prefs";
const DEFAULTS: Prefs = { graphics: "high", time: "auto", joystick: "auto", season: "auto", weather: "auto", textSize: "normal", shapes: false, haptics: true, renderDist: 110 };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  // Small or touch-only screens start on the lighter graphics setting.
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  const small = coarse && Math.min(screen.width, screen.height) < 500;
  return { ...DEFAULTS, graphics: small ? "low" : "high", renderDist: small ? 70 : DEFAULTS.renderDist };
}

export function savePrefs(p: Prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function wantsJoystick(p: Prefs): boolean {
  if (p.joystick === "on") return true;
  if (p.joystick === "off") return false;
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
}
