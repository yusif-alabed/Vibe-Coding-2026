/** Per-device settings (graphics, time of day, touch controls), saved in this browser. */
export interface Prefs {
  graphics: "high" | "low";
  time: "auto" | "golden" | "day" | "night";
  joystick: "auto" | "on" | "off";
}

const KEY = "bb-prefs";
const DEFAULTS: Prefs = { graphics: "high", time: "auto", joystick: "auto" };

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  // Small or touch-only screens start on the lighter graphics setting.
  const coarse = typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
  return { ...DEFAULTS, graphics: coarse && Math.min(screen.width, screen.height) < 500 ? "low" : "high" };
}

export function savePrefs(p: Prefs) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function wantsJoystick(p: Prefs): boolean {
  if (p.joystick === "on") return true;
  if (p.joystick === "off") return false;
  return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
}
