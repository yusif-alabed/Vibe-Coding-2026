/**
 * Beaver Banff's own sprite sheet: every little picture the game uses in text (HUD pills, menus,
 * toasts, quests, chat, the map), drawn by hand as tiny SVGs in the same storybook style as the
 * trail-lodge menus — chunky ink-brown outlines, warm flat colours and a soft highlight.
 *
 * Each entry is the inside of a 32×32 SVG. Shapes inherit an ink stroke from the wrapper, so most
 * only need a fill. Keys are the characters the game's text uses as shorthand; `sprites.ts` swaps
 * them for these pictures wherever they appear.
 */

export const INK = "#3b251b";
const C = {
  cream: "#fbefd5", wood: "#b9763f", dwood: "#7a4b2c", red: "#e0503f", orange: "#f08a33", gold: "#f4c24a",
  yellow: "#ffd94a", green: "#6fae4f", dgreen: "#3f7f45", leaf: "#8cc65a", blue: "#3f86d0", sky: "#9fd4f2",
  navy: "#2f4f8f", pink: "#f293b5", purple: "#8d68c9", grey: "#a6adb2", dgrey: "#6b7277", white: "#ffffff",
  snow: "#eef7fc", fur: "#9a6438", belly: "#e8c69c", sand: "#e8c582", water: "#4aa8d8", teal: "#2fa7a2",
};

// Little drawing helpers. All take the 32×32 grid.
const circ = (cx: number, cy: number, r: number, f: string, x = "") => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${x}/>`;
const ell = (cx: number, cy: number, rx: number, ry: number, f: string, x = "") => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" ${x}/>`;
const rect = (x: number, y: number, w: number, h: number, f: string, rx = 2, e = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${e}/>`;
const path = (d: string, f = "none", x = "") => `<path d="${d}" fill="${f}" ${x}/>`;
const line = (d: string, w = 2, col = INK) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}"/>`;
/** A dot with no outline (eyes, sparkles, details). */
const dot = (cx: number, cy: number, r: number, f = INK) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" stroke="none"/>`;
/** The soft white shine every sprite gets. */
const hl = (cx: number, cy: number, rx: number, ry: number, rot = -30) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="#fff" opacity=".5" stroke="none" transform="rotate(${rot} ${cx} ${cy})"/>`;
const poly = (pts: string, f: string) => `<polygon points="${pts}" fill="${f}"/>`;

function star(cx: number, cy: number, R: number, r: number, f: string, n = 5) {
  const p: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, d = i % 2 ? r : R;
    p.push(`${(cx + Math.cos(a) * d).toFixed(1)},${(cy + Math.sin(a) * d).toFixed(1)}`);
  }
  return poly(p.join(" "), f);
}
function sparkle(cx: number, cy: number, s: number, f: string) {
  return path(`M${cx} ${cy - s}Q${cx + s * 0.18} ${cy - s * 0.18} ${cx + s} ${cy}Q${cx + s * 0.18} ${cy + s * 0.18} ${cx} ${cy + s}Q${cx - s * 0.18} ${cy + s * 0.18} ${cx - s} ${cy}Q${cx - s * 0.18} ${cy - s * 0.18} ${cx} ${cy - s}z`, f);
}
const heart = (f: string, extra = "") => path("M16 27.5C6 21 3.5 15.8 4.2 11.4 5 6.8 10.6 4.8 16 10.2c5.4-5.4 11-3.4 11.8 1.2.7 4.4-1.8 9.6-11.8 16.1z", f) + hl(10, 11, 2.6, 1.6) + extra;
const medal = (f: string, label = "") =>
  path("M9 3h5l3 9h-5z", C.blue) + path("M23 3h-5l-3 9h5z", C.red) + circ(16, 20, 8.5, f) + circ(16, 20, 5.6, "none", `stroke-width="1.4" opacity=".55"`) + hl(12.6, 16.8, 2.4, 1.4) +
  (label ? `<text x="16" y="23.6" font-size="9.5" font-weight="900" text-anchor="middle" font-family="Nunito,system-ui,sans-serif" fill="${INK}" stroke="none">${label}</text>` : star(16, 20, 4, 1.8, C.cream));
const ball = (f: string) => circ(16, 16, 12, f) + hl(11.5, 10.5, 3.2, 1.8);
const square = (f: string) => rect(5, 5, 22, 22, f, 5) + hl(11, 10, 3, 1.6);
const book = (f: string, open = false) => open
  ? path("M16 9C12 6.5 7.5 6 3.5 7v17c4-1 8.5-.5 12.5 2z", C.cream) + path("M16 9c4-2.5 8.5-3 12.5-2v17c-4-1-8.5-.5-12.5 2z", C.cream) + path("M2.5 9v16.5c4.5-1 9-.5 13.5 2 4.5-2.5 9-3 13.5-2V9", "none") + line("M6.5 11.5c2.5-.3 5 .1 6.6 1M6.5 15.5c2.5-.3 5 .1 6.6 1M19 12.5c1.6-.9 4-1.3 6.5-1M19 16.5c1.6-.9 4-1.3 6.5-1", 1.4) + path("M16 9v17", "none", `stroke="${f}" stroke-width="2.4"`)
  : rect(6, 4, 19, 24, f, 2.5) + rect(9, 4, 3, 24, "#0002", 0, `stroke="none"`) + rect(14, 9, 8, 5, C.cream, 1) + path("M25 24H9.5a2 2 0 0 0 0 4H25", C.cream) + hl(19, 19, 2.4, 1.2);
const arrow = (rot: number) => `<g transform="rotate(${rot} 16 16)">${rect(3.5, 3.5, 25, 25, C.sky, 6)}${path("M9 16h12M16.5 10.5 22 16l-5.5 5.5", "none", `stroke-width="3.4"`)}</g>`;

/** A beaver's face — used for all the smileys, so even the emotes are beavers. */
function beaverFace(mouth: string, eyes?: string, extra = "") {
  return circ(7, 8.5, 3.6, C.fur) + circ(25, 8.5, 3.6, C.fur) + dot(7, 8.6, 1.6, C.dwood) + dot(25, 8.6, 1.6, C.dwood) +
    ell(16, 17, 12, 11.4, C.fur) + ell(16, 21.4, 6.6, 4.8, C.belly) + hl(10, 11, 3, 1.6) +
    (eyes ?? (dot(11.4, 15, 1.7) + dot(20.6, 15, 1.7) + dot(11.9, 14.4, 0.55, "#fff") + dot(21.1, 14.4, 0.55, "#fff"))) +
    ell(16, 18.6, 2.2, 1.5, INK, `stroke="none"`) + mouth + extra;
}
const teeth = rect(14.4, 21.4, 3.2, 3.4, "#fff", 0.6, `stroke-width="1.2"`) + line("M16 21.6v3", 1);
const smile = line("M12.6 20.6c1.6 1.6 5.2 1.6 6.8 0", 1.6);

const fishBody = (f: string, fin: string) =>
  path("M4 16c4-6 13-7.5 19-1 2-2 4-3.5 6-4-.8 3-.8 7 0 10-2-.5-4-2-6-4-6 6.5-15 5-19-1z", f) + path("M12 10.6c2-2.4 5-3.4 7.4-2.6l-1.4 3.4", fin) + dot(9, 15, 1.4) + hl(12, 13, 3, 1.3);

const sunSky = (top: string, bottom: string, sun: string, sunY: number) =>
  `<defs><clipPath id="c"><rect x="3" y="4" width="26" height="24" rx="5"/></clipPath></defs>` +
  rect(3, 4, 26, 24, top, 5) + `<g clip-path="url(#c)" stroke="none">${rect(3, 17, 26, 11, bottom, 0, `stroke="none"`)}${circ(16, sunY, 5.5, sun, `stroke="none"`)}</g>` + rect(3, 4, 26, 24, "none", 5);

const cloud = (y = 0, f: string = C.white) => path(`M8 ${24 + y}h16a5 5 0 0 0 0-10 7 7 0 0 0-13-2.2A5.5 5.5 0 0 0 8 ${24 + y}z`, f) + hl(13, 14 + y, 2.6, 1.2);

const tree = (x: number, s: number, f = C.dgreen) =>
  path(`M${x} ${16 - 12 * s}l${7 * s} ${10 * s}h${-3 * s}l${5 * s} ${7 * s}h${-18 * s}l${5 * s} ${-7 * s}h${-3 * s}z`, f) + rect(x - 1.5 * s, 16 + 5 * s, 3 * s, 4 * s, C.dwood, 0.5);

export const ART: Record<string, string> = {
  // ——— Beavers, money and rewards ———
  "🦫": beaverFace(teeth),
  "🪙": circ(16, 16, 12, C.gold) + circ(16, 16, 8.4, "#f7d77a", `stroke-width="1.4"`) + path("M12.5 13.5c0-2 1.6-3 3.5-3s3.5 1 3.5 3c0 2.6-1.6 3.6-3.5 3.6S12.5 16 12.5 13.5z", C.dwood, `stroke-width="1.2"`) + rect(14.6, 16.8, 2.8, 2.4, "#fff", 0.4, `stroke-width="1"`) + hl(10.5, 10, 3, 1.5),
  "🏆": path("M9 5h14v6c0 5-3 8.5-7 8.5S9 16 9 11z", C.gold) + path("M9 7.5H5c0 4 2 6 5 6.4M23 7.5h4c0 4-2 6-5 6.4", "none") + rect(13.8, 19, 4.4, 4, C.gold, 0.5) + rect(9.5, 23, 13, 5, C.dwood, 1.5) + rect(13, 24.6, 6, 1.8, C.cream, 0.6, `stroke="none"`) + hl(12.5, 9.5, 1.6, 3, 0),
  "🥇": medal(C.gold, "1"), "🥈": medal("#d5dbe0", "2"), "🥉": medal("#d99a5c", "3"), "🏅": medal(C.gold),
  "🎖": medal(C.gold),
  "⭐": star(16, 16.6, 13, 5.6, C.yellow) + hl(13, 12.5, 2.2, 1.2),
  "🌟": star(16, 16.6, 12, 5.2, C.yellow) + sparkle(27, 6, 3, C.white) + sparkle(5, 25, 2.4, C.white) + hl(13, 13, 2, 1.1),
  "✨": sparkle(13, 17, 9, C.yellow) + sparkle(24.5, 7.5, 4.2, C.yellow) + sparkle(25, 24.5, 3, C.white),
  "💫": star(11, 21, 7, 3, C.yellow) + path("M14 9c5-5 14-3 14 4 0 5-6 7-9 4", "none", `stroke-width="2.4"`) + sparkle(25, 26, 2.6, C.white),
  "🎉": path("M5 27.5 10.5 8l13.5 13.5z", C.gold) + line("M8 18l6 6M9.6 12.6l9.8 9.8", 1.6) + circ(23, 6, 1.8, C.pink) + circ(27, 13, 1.6, C.sky) + path("M18 5c1 2 3 2 3 4M24 16c2-1 3 0 5-1", "none") + rect(15, 11, 2.4, 2.4, C.green, 0.4) + rect(20, 2.6, 2, 2, C.orange, 0.4),
  "🎊": circ(16, 13, 8, C.pink) + path("M8 13h16", "none") + line("M10 21l-2 7M16 21v7M22 21l2 7", 1.6) + rect(9, 26, 2, 2, C.gold, 0.4) + hl(12.5, 9.5, 2, 1.1),
  "🎁": rect(4.5, 11, 23, 6, C.red, 1.5) + rect(6.5, 17, 19, 11, C.red, 1.5) + rect(14, 11, 4, 17, C.gold, 0) + path("M16 11C13 6 7 5 8.5 8.5c1 2.2 4.5 2.5 7.5 2.5zM16 11c3-5 9-6 7.5-2.5-1 2.2-4.5 2.5-7.5 2.5z", C.gold) + hl(9.5, 13.4, 2, 1),
  "🎈": path("M16 22.5c-6 0-9.5-5.5-9.5-10.5S10 3.5 16 3.5 25.5 7 25.5 12 22 22.5 16 22.5z", C.red) + path("M14.6 22.5h2.8l-1.4 2z", C.red) + line("M16 24.5c-2 2 2 3 0 5", 1.4) + hl(11.8, 9.5, 2.6, 1.4),
  "🥳": beaverFace(path("M11.5 19.8c1.2 3.6 7.8 3.6 9 0z", C.dwood), undefined, path("M12 7.5 16 -1 20 7.5z", C.purple, `transform="translate(0 1)"`) + circ(16, 0.8, 1.4, C.gold)),
  "🎗": path("M16 13c-4 4-7 10-8 15l3.5-1.5L13 29c1-5 2-9 3-11 1 2 2 6 3 11l1.5-2.5L24 28c-1-5-4-11-8-15z", C.gold) + circ(16, 9, 5.5, "none", `stroke="${C.gold}" stroke-width="3.4"`) + circ(16, 9, 7.2, "none", `stroke-width="1.2"`),

  // ——— Homes, buildings and places ———
  "🏡": tree(26, 0.6, C.green) + path("M3.5 15 15 5.5 26.5 15", C.red) + rect(6.5, 14, 17, 13, C.cream, 1) + rect(13, 19, 5, 8, C.dwood, 1) + rect(8.5, 16.5, 3.4, 3.4, C.sky, 0.6) + rect(19, 16.5, 3.4, 3.4, C.sky, 0.6) + path("M3 27.5h26", "none"),
  "🏠": path("M3.5 15 16 4.5 28.5 15", C.red) + rect(7, 13.5, 18, 14, C.cream, 1) + rect(13.5, 19, 5, 8.5, C.dwood, 1) + rect(9, 16, 3.6, 3.6, C.sky, 0.6) + rect(19.4, 16, 3.6, 3.6, C.sky, 0.6),
  "🏔": path("M2 27 12.5 7l5.5 9 3.5-4.5L30 27z", C.grey) + path("M9.5 13 12.5 7l3 5-1.6 1.6-1.4-1.3-1.5 1.5zM19 14.2l2.5-2.7 2.6 3.4-1.4.6-1.2-1z", C.snow) + line("M2 27h28"),
  "⛰": path("M2 27 13 8l7 11 3-4 7 12z", "#b38a62") + path("M10.5 12.5 13 8l2.6 4-1.5 1.4-1.3-1.2z", C.snow),
  "🏰": rect(5, 12, 22, 15, C.grey, 1) + path("M5 12V6h3.5v3H12V6h3.5v3H19V6h3.5v3H27v3", C.grey) + path("M13 27v-6a3 3 0 0 1 6 0v6", C.dwood) + rect(8, 15, 2.6, 4, INK, 1, `stroke="none"`) + rect(21.4, 15, 2.6, 4, INK, 1, `stroke="none"`) + path("M16 6V1.5l4 1.4-4 1.4", C.red),
  "🏛": path("M3 11 16 4l13 7z", C.cream) + rect(4, 11, 24, 2.6, C.cream, 0.5) + rect(6, 13.6, 3, 10, C.cream, 0.5) + rect(11.3, 13.6, 3, 10, C.cream, 0.5) + rect(17.6, 13.6, 3, 10, C.cream, 0.5) + rect(23, 13.6, 3, 10, C.cream, 0.5) + rect(3, 23.6, 26, 4, C.cream, 0.5),
  "🏟": ell(16, 18, 13, 8, C.grey) + ell(16, 16.5, 9.5, 5, C.green) + line("M16 11.5v10", 1.2, "#fff") + circ(16, 16.5, 2, "none", `stroke="#fff" stroke-width="1.2"`) + path("M7 9V5l3 1-3 1M25 9V5l3 1-3 1", C.red, `stroke-width="1.4"`),
  "🏙": rect(4, 12, 7, 16, C.sky, 1) + rect(11, 5, 9, 23, C.blue, 1) + rect(20, 15, 8, 13, C.sky, 1) + line("M13.5 9h1M17 9h1M13.5 13h1M17 13h1M13.5 17h1M17 17h1M6.5 16h2M6.5 20h2M22.5 19h3M22.5 23h3", 1.6, C.cream),
  "🏕": tree(6, 0.55) + tree(27, 0.5) + path("M5.5 27 16 8l10.5 19z", C.orange) + path("M16 8v19M12.5 27 16 19l3.5 8", C.dwood) + line("M2 27.5h28"),
  "🏖": rect(2, 20, 28, 9, C.sand, 0) + path("M2 20c5-2 9 2 14 0s9-2 14 0", C.water) + line("M9 26 17 9", 1.8) + path("M8 13c2-6 13-8 17-3z", C.red) + path("M12.5 11.4c1.6-2.6 4.2-4 7-4.4", "none", `stroke="#fff" stroke-width="2"`) + circ(25, 25, 2.6, C.yellow),
  "⛲": ell(16, 25, 12, 3.6, C.sky) + rect(13.5, 13, 5, 11, C.grey, 1) + ell(16, 13, 7, 2.2, C.grey) + path("M16 11c-3-5-7-5-9 1M16 11c3-5 7-5 9 1M16 11V4", "none", `stroke="${C.water}" stroke-width="2.4"`),
  "🗼": path("M16 3 13 13h6zM13 13h6l3 15h-3.5L16 20l-2.5 8H10z", C.red) + rect(11.5, 12, 9, 2.6, C.cream, 0.6) + path("M12.4 20h7.2", "none") + circ(16, 7.2, 1.6, C.yellow, `stroke-width="1.2"`),
  "🗺": path("M3 7 11 4l10 3 8-3v21l-8 3-10-3-8 3z", C.cream) + path("M11 4v21M21 7v21", "none", `stroke-width="1.4"`) + path("M5 19c3-2 4 2 6 0M14 12c2 1 3 4 5 3", "none", `stroke="${C.dgreen}" stroke-width="1.6"`) + path("M24 11l2.5 2.5M26.5 11 24 13.5", "none", `stroke="${C.red}" stroke-width="1.8"`),
  "📍": path("M16 29s-9-9.5-9-16a9 9 0 0 1 18 0c0 6.5-9 16-9 16z", C.red) + circ(16, 13, 3.4, C.cream) + hl(12, 8.6, 2, 1.1),
  "🚩": line("M8 29V3.5", 2.4) + path("M8.5 4.5h17l-4 6 4 6h-17z", C.red) + hl(13, 7.5, 2.4, 1),
  "🏁": line("M7 29V3.5", 2.4) + rect(7.5, 4.5, 19, 13, C.white, 0.5) + path("M7.5 4.5h4.75v4.33H7.5zM17 4.5h4.75v4.33H17zM12.25 8.83H17v4.33h-4.75zM21.75 8.83h4.75v4.33h-4.75zM7.5 13.17h4.75v4.33H7.5zM17 13.17h4.75v4.33H17z", INK, `stroke="none"`),
  "🚪": rect(7, 3.5, 18, 25, C.wood, 2) + rect(10, 7, 12, 8, C.dwood, 1, `stroke-width="1.4"`) + rect(10, 17.5, 12, 7.5, C.dwood, 1, `stroke-width="1.4"`) + circ(21.5, 16.5, 1.4, C.gold, `stroke-width="1"`),
  "🚉": rect(4, 7, 24, 18, C.blue, 3) + rect(7, 10, 18, 7, C.sky, 1.5) + line("M16 10v7", 1.4) + circ(10, 21, 1.6, C.yellow, `stroke-width="1"`) + circ(22, 21, 1.6, C.yellow, `stroke-width="1"`) + line("M6 29l3-4M26 29l-3-4"),
  "🎪": path("M3 14 16 4l13 10z", C.red) + rect(5, 14, 22, 13, C.cream, 0.5) + path("M10 14v13M22 14v13", "none") + path("M13 27v-7h6v7", C.dwood),

  // ——— Vehicles and rides ———
  "🛷": path("M5 13h18l3 4H8z", C.red) + rect(8.5, 17, 2, 5, C.dwood, 0.5) + rect(19.5, 17, 2, 5, C.dwood, 0.5) + path("M3 22h23c3 0 4-3 3-5", "none", `stroke-width="2.6"`) + hl(12, 14.5, 3, 0.8, 0),
  "🛶": path("M2 16c6 6 22 6 28 0-6 2-22 2-28 0z", C.orange) + path("M2 16c6 1.6 22 1.6 28 0", "none") + line("M20 6 13 24", 2.2) + ell(12.6, 25, 1.6, 3, C.wood, `transform="rotate(20 12.6 25)"`),
  "🚂": rect(4, 11, 15, 12, C.red, 2) + rect(18, 6, 10, 17, C.navy, 2) + rect(21, 9, 4.5, 5, C.sky, 1) + rect(6, 5, 4, 6, INK, 1) + path("M3 23h26", "none") + circ(9, 25, 3, C.dgrey) + circ(16, 25, 3, C.dgrey) + circ(24, 25, 3, C.dgrey) + circ(6, 3, 2, C.white, `stroke-width="1.2"`),
  "🚡": line("M2 5l28 4", 1.6) + line("M16 7v5", 2) + rect(7, 12, 18, 14, C.red, 3) + rect(9.5, 14.5, 5.5, 5, C.sky, 1) + rect(17, 14.5, 5.5, 5, C.sky, 1) + rect(7, 22, 18, 2, C.cream, 0, `stroke="none"`),
  "🚁": ell(15, 18, 9, 6.5, C.orange) + path("M23 17h6v-4", "none", `stroke-width="2.4"`) + ell(13, 16.5, 4, 3, C.sky) + line("M15 11.5V8M4 8h22M9 26h13M12 24v2M18 24v2"),
  "🎡": circ(16, 14, 10.5, "none", `stroke-width="2"`) + line("M16 3.5v21M5.5 14h21M8.6 6.6l14.8 14.8M23.4 6.6 8.6 21.4", 1.2) + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => circ(16 + Math.cos((i * Math.PI) / 4) * 10.5, 14 + Math.sin((i * Math.PI) / 4) * 10.5, 2.1, [C.red, C.yellow, C.blue, C.green][i % 4], `stroke-width="1.2"`)).join("") + path("M11 29l5-15 5 15", "none") + circ(16, 14, 2, C.gold),
  "🎠": path("M4 9 16 3l12 6z", C.red) + rect(5, 9, 22, 2.4, C.gold, 0.5) + line("M9 11.4v15M23 11.4v15") + rect(4, 25, 24, 3, C.wood, 1) + ell(16, 19, 5, 3, C.white),

  // ——— Food and drink ———
  "🥐": path("M4 18c0-6 6-10 12-10s12 4 12 10c-2 2-4 2-6 1-1 2-4 3-6 3s-5-1-6-3c-2 1-4 1-6-1z", C.gold) + line("M10.5 11.5l2.5 9M16 9.5v12M21.5 11.5 19 20.5", 1.4) + hl(12, 12, 2.6, 1.2),
  "☕": path("M6 12h16v9a6 6 0 0 1-6 6h-4a6 6 0 0 1-6-6z", C.cream) + path("M22 14h2.5a3 3 0 0 1 0 6H22", "none") + ell(14, 12, 8, 1.8, C.dwood) + path("M11 3.5c-1.4 1.6 1.4 2.4 0 4.6M16 2.5c-1.4 1.6 1.4 2.4 0 4.6M21 3.5c-1.4 1.6 1.4 2.4 0 4.6", "none", `stroke-width="1.5"`) + line("M4 28h20"),
  "🍦": path("M10 15h12l-6 14z", C.wood) + path("M12.5 18.5l5 4M19 17l-6.5 6.6", "none", `stroke-width="1.2"`) + path("M8.5 15c-1-4 2-6 4-6 0-4 7-4 7 0 2 0 5 2 4 6z", C.pink) + path("M12 9.5c0-4 2.5-6.5 4-7 0 2 4 2.5 3.5 6.5", "#c8f0d0") + hl(12.4, 12, 2, 1),
  "🍁": path("M16 2.5l2.2 4.8 3-1.5-.6 5.6 4.4-3.2-.6 3 4.6 1.2-3.6 3.4 1.4 1.4-6.6 1.8.8 2.6-4.6-1.2L16 26l-.4-5.8-4.6 1.2.8-2.6-6.6-1.8 1.4-1.4-3.6-3.4 4.6-1.2-.6-3 4.4 3.2-.6-5.6 3 1.5z", C.red) + line("M16 18v11", 1.8),
  "🍂": path("M7 25C4 14 12 5 25 5c1 13-7 21-18 20z", C.orange) + line("M7 25 22 9M12 19h5M15 15.5l.5-5", 1.4) + path("M4 28l3-3", "none"),
  "🌰": path("M16 9c6 0 10 4.5 10 10s-4.5 9-10 9-10-3.5-10-9S10 9 16 9z", C.wood) + path("M6.4 15c2-5 17-5 19.2 0-3-1-16-1-19.2 0z", C.dwood) + path("M16 9V4.5", "none", `stroke-width="2.2"`) + hl(11, 19, 2.4, 1.4),
  "🥕": path("M23 9 7 27c-1 1-2.4-.4-1.6-1.4L19 6z", C.orange) + line("M12 18.5l2 2M15 14.5l2.2 2M9.5 22l1.5 1.4", 1.2) + path("M21 7c0-3 1-5 3-5 0 2-1 4-1 5 1 0 3-2 6-1-1 2-3 3-5 3 2 1 2 3 1 4-2 0-3-2-4-3", C.leaf),
  "🍯": path("M8 12h16v11a5 5 0 0 1-5 5h-6a5 5 0 0 1-5-5z", C.gold) + rect(7, 7, 18, 5, C.wood, 1.5) + path("M8 15c3 2 4-1 6 1s3 3 3 0 4-2 7-1", "none", `stroke="${C.orange}" stroke-width="1.6"`) + rect(11.5, 18, 9, 6, C.cream, 1, `stroke-width="1.2"`) + hl(11, 14.5, 1.6, 0.9),
  "🧃": rect(8, 7, 16, 21, C.orange, 2) + path("M17 7 19 2h3", "none") + rect(11, 13, 10, 9, C.cream, 1, `stroke-width="1.2"`) + circ(16, 17.5, 2.6, C.red, `stroke-width="1"`) + path("M15.4 14.8l1-1.6", "none", `stroke="${C.green}" stroke-width="1.4"`),
  "🍬": path("M10 16a6 6 0 0 1 12 0 6 6 0 0 1-12 0z", C.pink) + path("M10 16 3 11.5v9zM22 16l7-4.5v9z", C.pink) + path("M13 12c2 3 2 5 0 8M17 11c2 3 2 7 0 10", "none", `stroke="#fff" stroke-width="1.6"`),
  "🍳": circ(14, 18, 10, C.dgrey) + path("M23 14l7-5", "none", `stroke-width="3.6"`) + path("M9 18c0-4 3-6 6-5 4-1 6 3 4 6s-7 4-10-1z", C.white, `stroke-width="1.2"`) + circ(14.6, 17.6, 2.6, C.yellow, `stroke-width="1.2"`),
  "🍽": circ(16, 16, 10.5, C.white) + circ(16, 16, 6.5, C.cream, `stroke-width="1.2"`) + line("M3 5v8M5 5v8M4 13v14M29 5c-3 2-3 7 0 9v13"),
  "🥂": path("M6 4h7l-.5 6a3 3 0 0 1-6 0zM19 4h7l.5 6a3 3 0 0 1-6 0z", C.yellow) + line("M9.5 13v12M23.5 13v12M6 25.5h7M20 25.5h7") + sparkle(16, 6, 2.6, C.gold),
  "🍾": path("M13 3h6v5c3 2 4 4 4 7v12a2 2 0 0 1-2 2H11a2 2 0 0 1-2-2V15c0-3 1-5 4-7z", C.dgreen) + rect(12.6, 2.5, 6.8, 4, C.gold, 1) + rect(9, 15, 14, 7, C.cream, 0.5) + hl(13, 20, 1, 3, 0),
  "🫐": circ(11, 19, 6.5, C.navy) + circ(21, 17, 6.5, C.purple) + circ(15, 10.5, 5.5, C.blue) + path("M9.5 18.5l3 1M19.5 16.5l3 1M13.5 10l3 1", "none", `stroke-width="1.4"`) + line("M15 5l2-3 2 2", 1.6, C.dgreen),
  "🧊": path("M8 11 16 7l8 4v10l-8 4-8-4z", C.sky) + path("M8 11l8 4 8-4M16 15v10", "none", `stroke-width="1.4"`) + hl(12, 11.5, 2, 1, 20),

  // ——— Nature, plants and weather ———
  "🌲": tree(16, 1),
  "🌳": circ(16, 12, 9.5, C.green) + rect(14, 20, 4, 8, C.dwood, 1) + hl(12, 8, 2.6, 1.4),
  "🌿": line("M8 28C10 18 16 9 26 4", 2.2, C.dgreen) + ell(12.5, 18, 2.4, 5, C.leaf, `transform="rotate(-40 12.5 18)"`) + ell(19, 13, 2.4, 5, C.leaf, `transform="rotate(50 19 13)"`) + ell(18, 7.5, 2.2, 4.6, C.leaf, `transform="rotate(-30 18 7.5)"`) + ell(11, 25, 2.2, 4.6, C.leaf, `transform="rotate(60 11 25)"`),
  "🌱": line("M16 28V15", 2.4, C.dgreen) + path("M16 16C16 9 11 6 5 7c0 6 4 9 11 9z", C.leaf) + path("M16 15c0-6 4-9 10-8 0 5-3 8-10 8z", C.green) + path("M8 28h16", "none"),
  "🌾": [10, 16, 22].map((x, i) => line(`M${x} 29C${x} 20 ${x - 1 + i} 12 ${x + (i - 1) * 2} 6`, 1.6, C.dwood) + ell(x + (i - 1) * 2, 8, 2, 4.4, C.gold, `transform="rotate(${(i - 1) * 15} ${x + (i - 1) * 2} 8)"`)).join(""),
  "🌻": line("M16 18v11", 2.4, C.dgreen) + ell(11, 25, 4, 2, C.leaf, `transform="rotate(30 11 25)"`) + [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => ell(16 + Math.cos(i * 0.628) * 7, 12 + Math.sin(i * 0.628) * 7, 3.2, 2, C.yellow, `transform="rotate(${i * 36} ${16 + Math.cos(i * 0.628) * 7} ${12 + Math.sin(i * 0.628) * 7})"`)).join("") + circ(16, 12, 5, C.dwood) + dot(14.5, 11, 0.9, C.gold) + dot(17.5, 13, 0.9, C.gold),
  "🌸": [0, 1, 2, 3, 4].map((i) => circ(16 + Math.cos(i * 1.2566 - 1.57) * 6.6, 16 + Math.sin(i * 1.2566 - 1.57) * 6.6, 5.4, C.pink)).join("") + circ(16, 16, 3.4, C.yellow) + hl(13, 9, 1.8, 1),
  "💐": path("M11 18l5 11 5-11z", C.sky) + circ(11, 12, 4, C.pink) + circ(20, 11, 4, C.yellow) + circ(15.5, 7, 4, C.red) + circ(22, 17, 3, C.purple) + circ(10, 18, 3, C.white) + path("M13 23h6", "none"),
  "🪴": path("M9 19h14l-2 9H11z", C.orange) + rect(8, 17, 16, 3, C.red, 1) + path("M16 17C16 10 10 7 6 9c1 5 5 8 10 8zM16 17c0-7 5-11 10-9-1 5-5 9-10 9zM16 17c0-5 0-9 0-13", C.green),
  "🍀": line("M16 14c1 6 2 10 6 15", 2.4, C.dgreen) + [0, 1, 2, 3].map((i) => `<g transform="rotate(${i * 90 + 45} 16 13)">${path("M16 13C11 11 10 4 13 3.4c1.6-.3 2.6.8 3 2.2.4-1.4 1.4-2.5 3-2.2 3 .6 2 7.6-3 9.6z", C.green)}</g>`).join("") + hl(12, 8, 1.6, 1),
  "🌊": path("M2 23c3-1 4-4 7-4 4 0 3 4 7 4 2.5 0 3.5-4 6.5-4s4 3 7.5 4v6H2z", C.water) + path("M3 17c2-6 7-11 14-10 4 .5 6 3 5 6-3-2-6-1-6 2 0 4 4 5 6 4-3 4-12 4-19-2z", C.blue) + path("M10 12c2-2 5-3 8-2", "none", `stroke="#fff" stroke-width="1.6"`),
  "💧": path("M16 3C12 10 8 14 8 19a8 8 0 0 0 16 0c0-5-4-9-8-16z", C.water) + hl(12.5, 18, 1.6, 3, 10),
  "💦": path("M11 8C9 12 6 14 6 17a5 5 0 0 0 10 0c0-3-3-5-5-9z", C.water) + path("M22 4c-1.6 3-4 5-4 7a4 4 0 0 0 8 0c0-2-2.4-4-4-7z", C.water) + path("M22 18c-1.4 2.6-3.4 4-3.4 6a3.4 3.4 0 0 0 6.8 0c0-2-2-3.4-3.4-6z", C.water),
  "🫧": circ(12, 18, 7.5, "#d8f0fc") + circ(22.5, 10, 5, "#d8f0fc") + circ(23, 23, 3, "#d8f0fc") + hl(9.5, 15.5, 2, 1.2) + hl(21, 8.5, 1.4, 0.8),
  "❄": `<g stroke="${C.blue}" stroke-width="2.4">` + line("M16 3v26M4.7 9.5l22.6 13M4.7 22.5l22.6-13", 2.6, C.blue) + line("M12.5 5 16 8.5 19.5 5M12.5 27 16 23.5l3.5 3.5M4.5 14l4.7-1.3L8 8M27.5 18l-4.7 1.3L24 24M4.5 18l4.7 1.3L8 24M27.5 14l-4.7-1.3L24 8", 2, C.blue) + `</g>`,
  "⛄": circ(16, 21.5, 7.5, C.snow) + circ(16, 10.5, 5.2, C.snow) + rect(11, 2, 10, 4.5, INK, 1) + rect(9, 6, 14, 1.6, INK, 0.6) + path("M16 11l5 1-5 1z", C.orange, `stroke-width="1"`) + dot(14, 9.4, 0.9) + dot(18, 9.4, 0.9) + dot(16, 19.5, 1) + dot(16, 23, 1) + path("M11 15.4c3 1.6 7 1.6 10 0", "none", `stroke="${C.red}" stroke-width="2.6"`),
  "☀": [0, 1, 2, 3, 4, 5, 6, 7].map((i) => line(`M${16 + Math.cos(i * 0.785) * 10.5} ${16 + Math.sin(i * 0.785) * 10.5}L${16 + Math.cos(i * 0.785) * 14} ${16 + Math.sin(i * 0.785) * 14}`, 2.4, C.orange)).join("") + circ(16, 16, 7.5, C.yellow) + hl(13, 13, 2, 1.1),
  "🌞": [0, 1, 2, 3, 4, 5, 6, 7].map((i) => line(`M${16 + Math.cos(i * 0.785) * 11} ${16 + Math.sin(i * 0.785) * 11}L${16 + Math.cos(i * 0.785) * 14.2} ${16 + Math.sin(i * 0.785) * 14.2}`, 2.4, C.orange)).join("") + circ(16, 16, 9, C.yellow) + dot(13, 14.5, 1.2) + dot(19, 14.5, 1.2) + line("M12.6 18.6c2 2 4.8 2 6.8 0", 1.6),
  "🌙": path("M21 4a12 12 0 1 0 7 19A10 10 0 0 1 21 4z", C.yellow) + hl(10, 12, 2, 1.2, -60),
  "🌗": circ(16, 16, 12, C.dgrey) + path("M16 4a12 12 0 0 0 0 24z", C.yellow) + hl(10, 11, 2, 1.2),
  "☁": cloud(-2),
  "🌧": cloud(-6) + line("M10 23l-1.5 4M16 23l-1.5 4M22 23l-1.5 4", 2.2, C.blue),
  "🌨": cloud(-6) + dot(10, 24, 1.6, C.blue) + dot(16, 27, 1.6, C.blue) + dot(22, 24, 1.6, C.blue),
  "🌦": circ(22, 9, 5.5, C.yellow) + cloud(-3) + line("M12 24l-1.4 4M18 24l-1.4 4", 2, C.blue),
  "🌫": line("M4 9h18M8 15h20M4 21h17M10 27h16", 2.8, C.dgrey),
  "🌈": path("M2 25a14 14 0 0 1 28 0", "none", `stroke="${C.red}" stroke-width="3"`) + path("M5.5 25a10.5 10.5 0 0 1 21 0", "none", `stroke="${C.yellow}" stroke-width="3"`) + path("M9 25a7 7 0 0 1 14 0", "none", `stroke="${C.green}" stroke-width="3"`) + path("M12.4 25a3.6 3.6 0 0 1 7.2 0", "none", `stroke="${C.blue}" stroke-width="3"`) + cloud(2.5) ,
  "⚡": path("M18 2 6 18h8l-3 12 15-17h-9z", C.yellow) + hl(14, 10, 1.6, 0.9, -50),
  "🔥": path("M16 29c-6 0-10-4-10-9.5 0-5 4-7 4-12 3 2 5 4 5 7 1-3 3-6 2-12 5 3 9 9 9 16 0 6-4 10.5-10 10.5z", C.orange) + path("M16 29c-3 0-5-2-5-5 0-3 2-4 3-6 1 2 2 3 3 3 1-2 1-3 1-5 2 2 3 5 3 8 0 3-2 5-5 5z", C.yellow),
  "♨": path("M5 21c0 4 5 7 11 7s11-3 11-7", "none", `stroke-width="2.4"`) + ell(16, 21, 11, 3.4, C.sky) + path("M10 16c-2-3 2-4 0-7s2-4 0-6M16 16c-2-3 2-4 0-7s2-4 0-6M22 16c-2-3 2-4 0-7s2-4 0-6", "none", `stroke="${C.red}" stroke-width="2.2"`),
  "🌅": sunSky(C.gold, C.water, C.orange, 18) + line("M7 22h6M17 24h8", 1.4, "#fff"),
  "🌇": sunSky(C.orange, C.purple, C.yellow, 16) + rect(5, 16, 5, 12, C.navy, 0.5) + rect(18, 14, 6, 14, C.navy, 0.5) + rect(11, 19, 6, 9, INK, 0.5, `stroke="none"`),
  "🌆": sunSky(C.purple, C.navy, C.orange, 20) + rect(6, 14, 6, 14, INK, 0.5, `stroke="none"`) + rect(13, 10, 6, 18, "#2a1f3a", 0.5, `stroke="none"`) + rect(20, 16, 6, 12, INK, 0.5, `stroke="none"`) + line("M8 17h2M15 13h2M15 17h2M22 19h2", 1.4, C.yellow),
  "🌌": rect(3, 4, 26, 24, C.navy, 5) + path("M3 22c8-3 12-10 26-13", "none", `stroke="${C.purple}" stroke-width="5" opacity=".7"`) + sparkle(9, 10, 2.4, C.white) + sparkle(23, 20, 2, C.yellow) + dot(15, 8, 0.9, "#fff") + dot(25, 9, 0.8, "#fff") + dot(8, 22, 0.8, "#fff"),

  // ——— Animals ———
  "🦋": path("M16 15C12 5 3 4 4 10c.6 3.4 5 5 12 5zM16 15c4-10 13-11 12-5-.6 3.4-5 5-12 5z", C.orange) + path("M16 16c-6 0-10 2-9 6 1 3 6 1 9-6zM16 16c6 0 10 2 9 6-1 3-6 1-9-6z", C.yellow) + rect(15, 9, 2, 14, INK, 1) + line("M15.5 9 13 5M16.5 9 19 5", 1.4) + dot(9, 9.5, 1.3, "#fff") + dot(23, 9.5, 1.3, "#fff"),
  "🐟": fishBody(C.blue, C.sky),
  "🐠": fishBody(C.orange, C.yellow) + line("M12 11.6v8.6M16 10.6v10", 2, "#fff"),
  "🐡": circ(15, 16, 9, C.yellow) + [0, 1, 2, 3, 4, 5, 6, 7].map((i) => line(`M${15 + Math.cos(i * 0.785) * 9} ${16 + Math.sin(i * 0.785) * 9}l${Math.cos(i * 0.785) * 2.6} ${Math.sin(i * 0.785) * 2.6}`, 1.6)).join("") + path("M24 16l5-4v8z", C.orange) + dot(11, 13.5, 1.4) + ell(9, 18, 1.4, 1, C.red),
  "🦈": path("M2 18c6-5 15-6 22-3l6-5-1 7 1 6-6-4c-7 3-16 3-22-1z", C.grey) + path("M14 13l3-7 3 8z", C.grey) + path("M5 19c5 2 12 2 18-1", C.white, `stroke-width="1.2"`) + dot(8, 16, 1.2),
  "🦝": circ(7.5, 9, 3.6, C.grey) + circ(24.5, 9, 3.6, C.grey) + ell(16, 17, 11.5, 10, C.grey) + path("M5.5 15c3-2 6.5-2 8.5 1-1.5 2.6-6 3-8.5-1zM26.5 15c-3-2-6.5-2-8.5 1 1.5 2.6 6 3 8.5-1z", INK) + dot(10, 15.6, 1.2, "#fff") + dot(22, 15.6, 1.2, "#fff") + ell(16, 22, 5, 3.6, C.white) + ell(16, 20, 1.8, 1.2, INK),
  "🐿": path("M23 27c6-2 7-10 3-16-3-4-1-8 2-8-6-2-11 3-9 10", C.wood) + circ(13, 20, 7, C.wood) + circ(11, 11, 5.4, C.wood) + path("M8 7l1-4 3 3", C.wood) + ell(12, 21, 3.4, 4.4, C.belly) + dot(9.6, 10.4, 1.1) + dot(6.2, 12.6, 1, INK),
  "🐰": ell(12, 7, 2.6, 6.5, C.white) + ell(20, 7, 2.6, 6.5, C.white) + ell(12, 7, 1.1, 4.2, C.pink, `stroke="none"`) + ell(20, 7, 1.1, 4.2, C.pink, `stroke="none"`) + circ(16, 19.5, 9, C.white) + dot(12.5, 18, 1.4) + dot(19.5, 18, 1.4) + ell(16, 21, 1.4, 1, C.pink) + line("M16 22v1.6", 1.2),
  "🦉": ell(16, 17, 10.5, 11.5, C.wood) + path("M6 9l4 3M26 9l-4 3", "none", `stroke-width="2.4"`) + ell(16, 21, 6, 5.5, C.belly) + circ(11.6, 13.5, 4, C.cream) + circ(20.4, 13.5, 4, C.cream) + dot(11.6, 13.5, 2) + dot(20.4, 13.5, 2) + path("M16 15.6l-1.6 2.4h3.2z", C.orange, `stroke-width="1"`),
  "🦊": path("M5 5l7 6h8l7-6-1 10c0 7-5 13-10 13S6 22 6 15z", C.orange) + path("M6.5 16c2 6 5 11 9.5 11s7.5-5 9.5-11c-3 2-6 3-9.5 3S9.5 18 6.5 16z", C.white) + dot(12, 15, 1.4) + dot(20, 15, 1.4) + ell(16, 21, 1.8, 1.2, INK),
  "🦌": path("M10 9C7 6 6 3 7 1M7 4 4 4M10 6l-3 1M22 9c3-3 4-6 3-8M25 4l3 0M22 6l3 1", "none", `stroke="${C.dwood}" stroke-width="2"`) + ell(8, 12, 3.6, 2, C.wood, `transform="rotate(-30 8 12)"`) + ell(24, 12, 3.6, 2, C.wood, `transform="rotate(30 24 12)"`) + path("M10 12c0-3 3-4 6-4s6 1 6 4l-2 11c-1 4-7 4-8 0z", C.wood) + ell(16, 23.5, 3.2, 2.6, C.belly) + dot(16, 23, 1.4) + dot(13, 14.5, 1.2) + dot(19, 14.5, 1.2),
  "🫎": path("M3 6c2 3 5 4 9 4M29 6c-2 3-5 4-9 4M5 4c0 2 1 3 2 4M27 4c0 2-1 3-2 4", "none", `stroke="${C.wood}" stroke-width="3"`) + path("M10 10c0-2 3-3 6-3s6 1 6 3l1 9c0 6-3 9-7 9s-7-3-7-9z", C.dwood) + ell(16, 24, 5, 4, C.wood) + dot(14.2, 24, 1) + dot(17.8, 24, 1) + dot(12.6, 14, 1.2) + dot(19.4, 14, 1.2),
  "🐥": circ(16, 18, 10, C.yellow) + path("M16 19.5l5-2-5-2z", C.orange, `stroke-width="1.2"`) + dot(12.6, 15.5, 1.4) + path("M7 30c3-3 15-3 18 0", C.cream) + path("M14 8c0-3 2-5 3-5", "none"),
  "🐦": path("M5 20c0-7 5-12 11-12 4 0 7 3 7 6l5 1-5 2c0 6-5 9-10 9-5 0-8-2-8-6z", C.blue) + path("M8 19c3 0 7 2 8 5-4 1-7 0-8-5z", C.sky) + dot(18, 13, 1.4) + path("M6 23 2 27", "none"),
  "🦅": path("M2 12c5 0 9 2 11 5 1-4 5-6 9-6l2-2 6 2-6 2c0 7-4 11-10 11-2 3-5 4-8 4l2-5c-3-1-5-6-6-11z", C.dwood) + path("M21 11l2-2 6 2-6 2c-1-1-1-1-2-2z", C.white) + path("M29 11l-2 3-3-1", C.gold, `stroke-width="1.2"`) + dot(24, 10.8, 0.9),
  "🦘": path("M10 28c-2-6 0-12 5-14l1-6 2-4 2 4-1 5c4 1 5 6 4 10l-3 5z", C.wood) + path("M10 25c-5 0-8 2-8 4h10", C.wood) + dot(18, 8, 0.9) + ell(17, 22, 3, 3.6, C.belly),
  "🐾": [[8, 11], [13.4, 6.4], [19.2, 6.4], [24.4, 11]].map(([x, y]) => ell(x, y, 2.6, 3.2, C.dwood)).join("") + path("M16 13c4 0 8 5 8 9 0 3-2.4 4-4.4 3.4-1.4-.4-2.4-1.2-3.6-1.2s-2.2.8-3.6 1.2C10.4 26 8 25 8 22c0-4 4-9 8-9z", C.dwood),
  "🪰": ell(16, 18, 5, 7, INK) + ell(10, 11, 5, 3, "#d8f0fc", `transform="rotate(-30 10 11)"`) + ell(22, 11, 5, 3, "#d8f0fc", `transform="rotate(30 22 11)"`) + dot(13.6, 12.5, 1.4, C.red) + dot(18.4, 12.5, 1.4, C.red),
  "🐞": ell(16, 18, 10, 10.5, C.red) + path("M16 8v20", "none") + path("M9 9c1-5 13-5 14 0", INK) + dot(11, 16, 2) + dot(21, 16, 2) + dot(12, 23, 1.6) + dot(20, 23, 1.6) + dot(12.6, 6.8, 0.9, "#fff") + dot(19.4, 6.8, 0.9, "#fff"),

  // ——— Games, sport and play ———
  "⛳": ell(16, 26, 12, 3.4, C.green) + ell(18, 26, 2.2, 0.9, INK) + line("M18 26V4", 2) + path("M18.5 4.5l9 4-9 4z", C.red) + circ(9, 23, 2, C.white, `stroke-width="1.2"`),
  "🏌": circ(13, 7, 3.6, C.belly) + path("M10 12h6l2 8-3 8h-3l1-7-4 7H6l4-9z", C.blue) + line("M17 13l8 12", 2) + path("M24 25.5l4 1", "none", `stroke-width="3"`),
  "🏐": ball(C.white) + path("M16 4c-1 7 2 13 10 16M4.6 13c6-2 13-1 16 6M8 25.6c3-6 9-9 18-8", "none", `stroke-width="1.6"`) + path("M16 4c4 3 6.6 7 6 12", "none", `stroke="${C.blue}" stroke-width="2.2"`) + path("M4.6 13c-.5 5 1.4 9.5 3.4 12.6", "none", `stroke="${C.yellow}" stroke-width="2.2"`),
  "⚽": ball(C.white) + poly("16,11 20.5,14 19,19.5 13,19.5 11.5,14", INK) + path("M16 11V4.5M20.5 14l6-2M19 19.5l4 5M13 19.5l-4 5M11.5 14l-6-2", "none", `stroke-width="1.6"`),
  "🏀": ball(C.orange) + path("M4 16h24M16 4v24M7.5 7.5c4 4 4 13 0 17M24.5 7.5c-4 4-4 13 0 17", "none", `stroke-width="1.6"`),
  "🥊": path("M8 13c0-6 4-9 9-9s9 3 9 9v5c0 4-3 6-6 6H13c-3 0-5-2-5-5z", C.red) + path("M8 15c-3 0-4 2-4 4s2 3 4 3", C.red) + rect(10, 23, 13, 6, C.white, 2) + hl(14, 9, 3, 1.6),
  "🎲": rect(5, 5, 22, 22, C.white, 5) + dot(10.5, 10.5, 2.2) + dot(16, 16, 2.2) + dot(21.5, 21.5, 2.2) + dot(21.5, 10.5, 2.2, C.red) + dot(10.5, 21.5, 2.2, C.red),
  "🃏": rect(7, 3, 18, 26, C.white, 3) + path("M11 18l2.6-6 2.4 4 2.4-4 2.6 6z", C.red, `stroke-width="1.2"`) + circ(13.4, 11, 1.2, C.yellow, `stroke-width="1"`) + circ(18.6, 11, 1.2, C.yellow, `stroke-width="1"`) + `<text x="10" y="9" font-size="5" font-weight="900" font-family="system-ui" fill="${C.red}" stroke="none">J</text>` + line("M11 22h10", 1.4),
  "♟": circ(16, 8, 4, INK) + path("M12 13h8l-1 3h-6zM13 16h6l2 7H11z", INK) + rect(8, 23, 16, 5, INK, 1.5) + hl(14.6, 6.6, 1.2, 0.7),
  "🎰": rect(4, 7, 22, 21, C.red, 3) + rect(4, 4, 22, 4, C.gold, 1.5) + rect(7, 11, 16, 9, C.cream, 1.5) + path("M12.3 11v9M17.7 11v9", "none", `stroke-width="1.2"`) + dot(9.7, 15.5, 1.6, C.red) + dot(15, 15.5, 1.6, C.gold) + dot(20.3, 15.5, 1.6, C.green) + line("M26 22h3V9", 2) + circ(29, 8, 2, C.gold, `stroke-width="1.2"`) + rect(9, 23, 12, 2.4, INK, 1, `stroke="none"`),
  "🎯": circ(16, 16, 12, C.white) + circ(16, 16, 8.4, C.red) + circ(16, 16, 4.8, C.white) + circ(16, 16, 1.8, C.red) + line("M16 16l11-11M24 4l3 1 1 3", 2),
  "🎮": path("M7 9h18a5 5 0 0 1 5 5l-1 9c-.5 3-4 4-6 2l-3-3h-8l-3 3c-2 2-5.5 1-6-2l-1-9a5 5 0 0 1 5-5z", C.purple) + line("M9 15v5M6.5 17.5h5", 2.2) + dot(21.5, 15.5, 1.6, C.yellow) + dot(24.5, 18.5, 1.6, C.red),
  "🕹": ell(16, 24, 12, 4.5, C.red) + rect(4, 20, 24, 4, C.red, 0) + ell(16, 20, 12, 4.5, "#f07060") + line("M16 20V9", 2.6) + circ(16, 7, 4, C.red) + hl(14.6, 5.6, 1.2, 0.7),
  "🏂": line("M4 26l24-6", 3.2, C.blue) + circ(17, 6, 3.4, C.belly) + path("M14 11h6l1 7-3 4h-4l2-4z", C.red) + path("M14 13l-5 2M20 12l5-2", "none") + line("M15 22l-2 3M19 21l1 3", 2),
  "⛸": path("M7 5h9v9c4 0 9 2 9 7v2H7z", C.white) + path("M7 18h18", "none", `stroke-width="1.2"`) + line("M9 9h5M9 12h5", 1.2) + line("M5 27h22c2 0 3-1 3-3", 2.2, C.dgrey) + line("M10 23v4M22 23v4", 2),
  "⛏": path("M4 11C10 4 22 4 28 11c-6-3-18-3-24 0z", C.grey) + line("M16 7 10 29", 3, C.dwood),
  "🎣": line("M5 28 23 4", 2.6, C.dwood) + line("M23 4c4 6 4 13 3 18", 1, INK) + path("M26 22c-1 2 0 4 2 4", "none", `stroke-width="1.4"`) + circ(26, 18, 2.2, C.red, `stroke-width="1.2"`) + circ(8.5, 23.5, 2.4, C.grey, `stroke-width="1.2"`),
  "🎨": path("M16 3C8 3 3 9 3 15.5S8 28 14 28c3 0 3-2 2-4s0-4 3-4h4c4 0 6-2 6-6C29 8 23 3 16 3z", C.belly) + circ(9, 14, 2.2, C.red) + circ(13, 8.5, 2.2, C.yellow) + circ(19.5, 8, 2.2, C.blue) + circ(24, 12.6, 2.2, C.green) + circ(9.6, 21, 2, C.purple),
  "🎤": circ(20, 10, 6.5, C.grey) + path("M16 13 5 25.6c-.8 1 .4 2.2 1.4 1.4L19 16", C.dgrey) + line("M16.5 6.5l7 7M14.5 10l7.4 7.4", 1, INK) + hl(18, 7.6, 1.8, 1),
  "🎸": path("M11 17c-4-1-8 2-8 6s3 7 7 6c3-1 3-3 5-4 2-1 4-2 3-5s-4-2-7-3z", C.orange) + circ(11, 21.5, 2, INK) + line("M14 18 27 5", 2.6, C.dwood) + rect(25, 2, 5, 5, C.dwood, 1),
  "🎺": path("M3 13h16l8-6v18l-8-6H3z", C.gold) + line("M8 13v-3M12 13v-3M16 13v-3", 2) + hl(14, 15, 3, 1, 0),
  "🎵": line("M12 25V7l12-3v17", 2.2) + ell(9, 25, 3.6, 3, INK) + ell(21, 21.6, 3.6, 3, INK),
  "🎶": line("M9 24V9l7-2v14M20 26V11l8-2v14", 2) + ell(6.6, 24, 2.6, 2.2, INK) + ell(13.6, 21, 2.6, 2.2, INK) + ell(17.6, 26, 2.6, 2.2, INK) + ell(25.6, 23, 2.6, 2.2, INK),
  "🎧": path("M5 20v-4a11 11 0 0 1 22 0v4", "none", `stroke-width="2.6"`) + rect(3, 18, 7, 10, C.red, 3) + rect(22, 18, 7, 10, C.red, 3),
  "🪩": circ(16, 17, 11, C.grey) + path("M5 17h22M16 6v22M8 9.5c5 3 11 3 16 0M8 24.5c5-3 11-3 16 0M10.5 7c-3 6-3 14 0 20M21.5 7c3 6 3 14 0 20", "none", `stroke-width="1"`) + rect(10, 11, 3.6, 3.2, C.sky, 0, `stroke="none"`) + rect(18, 18, 3.6, 3.2, C.pink, 0, `stroke="none"`) + line("M16 6V2", 1.6) + sparkle(26, 6, 3, C.yellow),
  "💃": circ(17, 5.6, 3.4, C.belly) + path("M14 10h6l-1 7 7 10H8l7-10z", C.red) + path("M14 11l-6-4M20 11l5 3", "none") + path("M10 27c3-2 9-2 12 0", "none", `stroke="${C.pink}" stroke-width="1.6"`),
  "🎳": ell(16, 8, 4, 5, C.white) + path("M12 12c-3 4-3 10 0 15h8c3-5 3-11 0-15z", C.white) + line("M12.5 11.5h7", 2, C.red),

  // ——— Things, tools and gear ———
  "📚": rect(4, 20, 24, 6, C.red, 1.5) + rect(6, 14, 21, 6, C.blue, 1.5) + rect(5, 8, 20, 6, C.green, 1.5) + line("M8 23h12M10 17h12M8 11h12", 1.2, C.cream),
  "📖": book(C.dwood, true), "📕": book(C.red), "📗": book(C.green), "📓": book("#4d4a6b"),
  "📜": path("M8 5h15c2 0 3 1 3 3v15H11V8c0-2-1-3-3-3z", C.cream) + path("M8 5c-2 0-3 1-3 3v3h6M11 23c0 2 1 4 3 4h12c2 0 3-2 3-4z", C.belly) + line("M14 11h8M14 15h8M14 19h6", 1.4),
  "📋": rect(6, 5, 20, 24, C.wood, 2) + rect(9, 9, 14, 17, C.white, 1) + rect(11.5, 3, 9, 5, C.grey, 1.5) + line("M12 14h8M12 18h8M12 22h5", 1.4),
  "📅": rect(4, 6, 24, 22, C.white, 3) + path("M4 9a3 3 0 0 1 3-3h18a3 3 0 0 1 3 3v4H4z", C.red) + line("M10 3.5v5M22 3.5v5", 2) + dot(10, 18, 1.5) + dot(16, 18, 1.5) + dot(22, 18, 1.5) + dot(10, 23.5, 1.5) + dot(16, 23.5, 1.5),
  "📷": rect(3, 9, 26, 18, C.dgrey, 3) + path("M10 9l2-4h8l2 4", C.dgrey) + circ(16, 18, 6, C.sky) + circ(16, 18, 3, C.navy, `stroke="none"`) + rect(22.5, 11.5, 3.6, 2.4, C.yellow, 0.6, `stroke-width="1"`) + hl(14, 16, 1.4, 0.8),
  "📸": rect(3, 9, 26, 18, C.dgrey, 3) + path("M10 9l2-4h8l2 4", C.dgrey) + circ(16, 18, 6, C.sky) + circ(16, 18, 3, C.navy, `stroke="none"`) + sparkle(26, 6, 4, C.yellow),
  "📮": rect(8, 9, 16, 19, C.red, 2) + path("M8 11a8 8 0 0 1 16 0", C.red) + rect(11, 13, 10, 2.4, INK, 1, `stroke="none"`) + rect(5, 27, 22, 2.6, C.dwood, 1) + rect(11, 18.5, 10, 6, C.white, 1, `stroke-width="1.2"`),
  "✉": rect(3, 8, 26, 17, C.white, 2) + path("M3.5 9 16 18l12.5-9", "none"),
  "📤": path("M3 17h8l2 3h6l2-3h8v8a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z", C.sky) + line("M16 15V4M11 8.6 16 4l5 4.6", 2.4),
  "🔭": path("M3 15l20-8 3 7-20 8z", C.blue) + path("M23 7l4-1.4 2.6 6.6-4 1.6z", C.gold) + line("M14 18l-5 11M15.5 18l5 11", 2) + ell(4.4, 18.4, 1.8, 3.8, C.sky, `transform="rotate(-22 4.4 18.4)"`),
  "🔍": circ(13, 13, 8.6, C.sky) + line("M19.5 19.5 28 28", 4, C.dwood) + hl(10, 10, 2.6, 1.4),
  "🔒": path("M10 14v-4a6 6 0 0 1 12 0v4", "none", `stroke-width="2.8"`) + rect(6, 14, 20, 15, C.gold, 3) + circ(16, 20.4, 2, INK) + rect(15, 21, 2, 4, INK, 1, `stroke="none"`),
  "🔗": rect(3, 11, 14, 9, "none", 4.5, `stroke-width="3" transform="rotate(-35 10 15.5)"`) + rect(15, 12, 14, 9, "none", 4.5, `stroke-width="3" transform="rotate(-35 22 16.5)"`),
  "🔔": path("M16 4a2 2 0 0 1 2 2c5 1 7 5 7 10v5l3 3H4l3-3v-5c0-5 2-9 7-10a2 2 0 0 1 2-2z", C.gold) + circ(16, 26.6, 2.6, C.gold) + hl(12, 12, 1.6, 3, 10),
  "🔊": path("M4 12h5l7-6v20l-7-6H4z", C.grey) + path("M20 11c2 3 2 7 0 10M24 7c4 5 4 13 0 18", "none", `stroke-width="2.2"`),
  "📳": rect(9, 3, 14, 26, C.dgrey, 3) + rect(11, 6, 10, 17, C.sky, 1) + path("M5 10c-2 2-2 4 0 6s2 4 0 6M27 10c2 2 2 4 0 6s-2 4 0 6", "none", `stroke-width="1.6"`),
  "💾": rect(4, 4, 24, 24, C.blue, 3) + rect(9, 4, 13, 8, C.grey, 0) + rect(18, 5.6, 2.4, 4.8, INK, 0.4, `stroke="none"`) + rect(8, 17, 16, 11, C.white, 1),
  "🔨": rect(5, 4, 15, 8, C.grey, 2) + path("M20 6l5-1v6l-5-1z", C.dgrey) + line("M13 12l-1 17", 3.6, C.wood),
  "✏": `<g transform="rotate(45 16 16)">${rect(12, 3, 8, 20, C.yellow, 1)}${path("M12 23h8l-4 7z", C.belly)}${path("M14.6 27.6h2.8L16 30z", INK)}${rect(12, 1, 8, 4, C.pink, 1)}</g>`,
  "⚙": circ(16, 16, 10.4, C.grey, `stroke-width="4.2" stroke-dasharray="3.4 3.15" stroke="${INK}"`) + circ(16, 16, 9, C.grey) + circ(16, 16, 3.6, C.cream),
  "⚖": line("M16 4v22M7 8h18M10 28h12", 2.2) + path("M3 17l4-9 4 9z", "none", `stroke-width="1.4"`) + path("M21 17l4-9 4 9z", "none", `stroke-width="1.4"`) + path("M2.6 17h8.8a4.4 4.4 0 0 1-8.8 0zM20.6 17h8.8a4.4 4.4 0 0 1-8.8 0z", C.gold),
  "⏱": circ(16, 18, 11, C.white) + rect(13, 2, 6, 3.4, C.dgrey, 1) + line("M16 18V11.5M16 18l4 3", 2.2) + line("M24.5 7.5l2-2", 2.4),
  "⏳": path("M7 3h18M7 29h18", "none", `stroke-width="2.6"`) + path("M9 4h14c0 6-4 9-7 12 3 3 7 6 7 12H9c0-6 4-9 7-12-3-3-7-6-7-12z", C.sky) + path("M12 9h8l-4 5zM10.6 27c1-3 3.4-5 5.4-6 2 1 4.4 3 5.4 6z", C.sand, `stroke="none"`),
  "🔄": path("M25 12A10 10 0 0 0 7 11.5", "none", `stroke-width="2.6"`) + path("M7 20.5A10 10 0 0 0 25 20", "none", `stroke-width="2.6"`) + path("M27 6l-1.4 7-6.6-2.4zM5 26l1.4-7 6.6 2.4z", C.green),
  "🧭": circ(16, 16, 12, C.cream) + circ(16, 16, 9, "none", `stroke-width="1.2"`) + path("M16 6l3 10h-6z", C.red) + path("M16 26l-3-10h6z", C.sky) + dot(16, 16, 1.4),
  "🛒": path("M2 5h4l3 15h15l3-11H8", C.white) + circ(11, 25, 2.4, C.dgrey) + circ(22, 25, 2.4, C.dgrey) + line("M10 12.5h15M11 16.5h12", 1.2),
  "🛍": path("M6 10h20l-1.5 18h-17z", C.pink) + path("M11.5 13V8a4.5 4.5 0 0 1 9 0v5", "none", `stroke-width="2.2"`) + hl(10, 15, 1.2, 3, 0),
  "🧺": path("M4 13h24l-3 15H7z", C.wood) + path("M8 13a8 8 0 0 1 16 0", "none", `stroke-width="2.6"`) + line("M7 17.5h18M8 22h16M12 13l1 15M20 13l-1 15", 1.2) + rect(3, 11.5, 26, 3, C.red, 1.5),
  "🎒": path("M9 9c0-4 3-6 7-6s7 2 7 6", "none", `stroke-width="2.4"`) + rect(6, 8, 20, 21, C.orange, 6) + rect(10, 17, 12, 9, C.red, 3) + line("M13 21h6", 1.4) + hl(10.5, 12, 2, 1.1),
  "🪵": rect(5, 10, 22, 13, C.wood, 6.5) + ell(25, 16.5, 4.4, 6.5, C.belly) + ell(25, 16.5, 2, 3.2, "none", `stroke-width="1.2"`) + line("M8 14h10M10 19h8", 1.4),
  "🪜": line("M9 3v26M23 3v26", 2.6, C.dwood) + line("M9 8h14M9 14h14M9 20h14M9 26h14", 2.2, C.wood),
  "🪑": rect(9, 4, 14, 12, C.wood, 2) + rect(7, 15, 18, 4, C.wood, 1) + line("M9 19v10M23 19v10", 2.6, C.dwood),
  "🛋": rect(5, 9, 22, 10, C.red, 3) + rect(2, 15, 6, 10, C.red, 2.4) + rect(24, 15, 6, 10, C.red, 2.4) + rect(8, 17, 16, 7, "#f07060", 1.5) + line("M5 25v3M27 25v3", 2.2),
  "🛏": rect(3, 15, 26, 8, C.blue, 2) + rect(5, 11, 8, 5, C.white, 2) + line("M3 8v20M29 16v12", 2.6, C.dwood) + path("M14 15h15v-1c0-2-1-3-3-3H14z", C.sky),
  "🏮": line("M16 2v4M16 27v3", 2) + rect(10, 5, 12, 3, C.dwood, 1) + ell(16, 16.5, 9, 9, C.red) + rect(10, 25, 12, 3, C.dwood, 1) + path("M11 10c-2 4-2 9 0 13M21 10c2 4 2 9 0 13", "none", `stroke-width="1.2"`),
  "🧸": circ(9, 7, 3.6, C.wood) + circ(23, 7, 3.6, C.wood) + circ(16, 11, 7, C.wood) + ell(16, 23, 8, 7, C.wood) + ell(16, 23.5, 4, 4, C.belly) + ell(16, 13, 3, 2.2, C.belly) + dot(13.4, 10, 1.1) + dot(18.6, 10, 1.1) + dot(16, 12.4, 1),
  "🖼": rect(3, 5, 26, 22, C.gold, 2) + rect(7, 9, 18, 14, C.sky, 0.5) + path("M7 23l6-8 4 5 3-3 5 6z", C.green, `stroke-width="1.2"`) + circ(20, 13, 2, C.yellow, `stroke-width="1"`),
  "🪞": ell(16, 14, 9, 11.5, C.sky) + rect(13, 25, 6, 5, C.wood, 1) + hl(12, 10, 2, 5, 15),
  "🥢": line("M8 29 22 3M12 29 28 5", 2.6, C.wood),
  "🧶": circ(16, 16, 11, C.red) + path("M7 9c6 2 13 8 16 15M5.5 14c6 1 12 5 14 12M11 6c5 3 11 9 14 15", "none", `stroke-width="1.4"`) + path("M27 16c3 0 3 7 0 10", "none", `stroke-width="1.6"`),
  "👑": path("M4 24 3 8l7 7 6-10 6 10 7-7-1 16z", C.gold) + rect(4, 23, 24, 5, C.gold, 1.5) + dot(16, 18, 1.8, C.red) + dot(9.6, 19, 1.4, C.blue) + dot(22.4, 19, 1.4, C.blue),
  "🎩": rect(9, 4, 14, 17, INK, 2) + rect(9, 15, 14, 3.4, C.red, 0) + ell(16, 22, 13, 3.6, INK) + hl(13, 9, 1.2, 3, 0),
  "👒": ell(16, 19, 14, 6, C.yellow) + path("M8 18c0-7 4-11 8-11s8 4 8 11", C.yellow) + path("M8.4 15c5 2 10 2 15.2 0", "none", `stroke="${C.pink}" stroke-width="2.6"`) + circ(23, 14, 2.4, C.red, `stroke-width="1.2"`),
  "🧣": path("M8 6h16c0 4 0 6-4 7h-8c-4-1-4-3-4-7z", C.red) + path("M18 13l2 15h-6l-1-15z", C.red) + line("M14 28v2M17 28v2M20 28v2", 1.4) + line("M10 8h12M15 17h4M15 21h4", 1.2, C.cream),
  "🧤": path("M8 29V14c0-4 1-8 3-9s3 1 3 3V5c0-2 3-2 3 0v2c0-2 3-2 3 0v3c1-2 4-2 4 1v18z", C.blue) + path("M8 17c-3-1-5 1-4 3l4 4", C.blue) + rect(7, 25, 17, 4, C.white, 1),
  "🥾": path("M8 3h10v14c5 0 11 2 11 7v4H4v-7c0-3 4-4 4-7z", C.wood) + rect(4, 25, 25, 3, INK, 1, `stroke="none"`) + line("M11 8h5M11 12h5", 1.4),
  "👓": circ(9, 17, 5.4, C.sky) + circ(23, 17, 5.4, C.sky) + path("M14.4 16c1-1.4 2.2-1.4 3.2 0M3.6 16 2 12M28.4 16 30 12", "none") + hl(7.6, 15.4, 1.4, 0.8) + hl(21.6, 15.4, 1.4, 0.8),
  "🤠": path("M2 17c4 2 8-1 14-1s10 3 14 1c-2 3-7 4-14 4s-12-1-14-4z", C.wood) + path("M8 17c0-7 3-11 8-11s8 4 8 11", C.wood) + path("M8.5 14.5c5 1.4 10 1.4 15 0", "none", `stroke="${C.dwood}" stroke-width="2.4"`) + path("M7 22c2 5 6 7 9 7s7-2 9-7", C.fur) + dot(12.6, 24, 1.1) + dot(19.4, 24, 1.1),
  "🎓": path("M2 12 16 6l14 6-14 6z", INK) + path("M8 15v6c3 3 13 3 16 0v-6l-8 3z", INK) + line("M27 13v8", 1.4, C.gold) + circ(27, 22, 1.6, C.gold, `stroke="none"`),
  "🔦": path("M3 13l13-4v14L3 19z", C.dgrey) + rect(16, 7, 6, 18, C.gold, 2) + path("M22 9l8-3v20l-8-3z", C.yellow, `opacity=".6"`),
  "🎄": path("M16 2 8 12h3l-6 8h4l-5 6h24l-5-6h4l-6-8h3z", C.dgreen) + rect(14, 26, 4, 4, C.dwood, 0.5) + dot(12, 15, 1.4, C.red) + dot(19, 19, 1.4, C.yellow) + dot(14, 22, 1.4, C.blue) + star(16, 3.4, 3.4, 1.4, C.yellow),
  "🎃": ell(16, 18, 12.5, 10, C.orange) + path("M11 9c-3 3-3 15 0 18M21 9c3 3 3 15 0 18M16 8v20", "none", `stroke-width="1.2"`) + path("M15 8c0-3 1-5 3-6", "none", `stroke="${C.dgreen}" stroke-width="2.6"`) + path("M9 15l3-2.6 3 2.6zM17 15l3-2.6 3 2.6z", INK, `stroke="none"`) + path("M9.6 20c3 4 9.8 4 12.8 0l-2 2-2-1.6-2.4 1.6-2.4-1.6-2 1.6z", INK, `stroke="none"`),
  "👁": path("M2 16c4-6 9-9 14-9s10 3 14 9c-4 6-9 9-14 9S6 22 2 16z", C.white) + circ(16, 16, 5.5, C.blue) + dot(16, 16, 2.6) + dot(17.6, 14.4, 1, "#fff"),
  "👀": ell(10, 16, 6.4, 8.6, C.white) + ell(22, 16, 6.4, 8.6, C.white) + dot(12, 17, 3) + dot(24, 17, 3) + dot(13, 15.8, 0.9, "#fff") + dot(25, 15.8, 0.9, "#fff"),
  "🤖": rect(6, 9, 20, 16, C.grey, 4) + line("M16 9V4", 2) + circ(16, 3.6, 1.8, C.red) + circ(11.5, 16, 2.6, C.sky) + circ(20.5, 16, 2.6, C.sky) + rect(11, 20.5, 10, 2, INK, 1, `stroke="none"`) + rect(3, 14, 3, 6, C.dgrey, 1) + rect(26, 14, 3, 6, C.dgrey, 1),
  "🕵": path("M5 13c0-4 5-8 11-8s11 4 11 8z", C.dwood) + ell(16, 13.5, 14, 2.6, C.dwood) + ell(16, 21, 8.6, 8, C.fur) + circ(12.4, 19.5, 2.4, C.sky) + circ(19.6, 19.5, 2.4, C.sky) + line("M14.8 19.5h2.4", 1.4) + rect(14.6, 23.6, 2.8, 2.4, "#fff", 0.4, `stroke-width="1"`),
  "🛡": path("M16 3 4 7v8c0 7 5 12 12 14 7-2 12-7 12-14V7z", C.blue) + path("M16 6v20M7 13h18", "none", `stroke="${C.gold}" stroke-width="2.6"`) + hl(10, 10, 2, 1),
  "♿": rect(4, 4, 24, 24, C.blue, 5) + circ(15, 9, 2, "#fff", `stroke="none"`) + path("M15 12v6h6l2 5M12 15a6 6 0 1 0 7 7", "none", `stroke="#fff" stroke-width="2.2"`),
  "💎": path("M4 12 9 5h14l5 7-12 15z", C.sky) + path("M4 12h24M9 5l3 7 4-7 4 7 3-7M12 12l4 15 4-15", "none", `stroke-width="1.2"`) + hl(10, 9, 1.6, 0.9),
  "💬": path("M5 5h22a3 3 0 0 1 3 3v11a3 3 0 0 1-3 3H14l-6 5v-5H5a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3z", C.white) + dot(10, 13.5, 1.6) + dot(16, 13.5, 1.6) + dot(22, 13.5, 1.6),
  "🗨": path("M16 4C9 4 3 8 3 14c0 3 2 6 5 7.6V28l5-5h3c7 0 13-4 13-9.5S23 4 16 4z", C.white),
  "📢": path("M4 13h6l14-7v20l-14-7H4z", C.red) + rect(6, 19, 4, 7, C.dgrey, 1) + path("M27 12v8", "none", `stroke-width="2.4"`),

  // ——— Hands and people ———
  "👋": path("M10 28c-4-3-6-8-6-11 0-2 2-2 3-1l3 3V8c0-1.6 2.6-1.6 2.6 0v8V5c0-1.6 2.8-1.6 2.8 0v11V6.6c0-1.6 2.8-1.6 2.8 0V17v-6.6c0-1.6 2.6-1.6 2.6 0V19c0 5-3 9-8 9z", C.fur) + path("M25 4c2 1 3 3 3 5M27 2c2 2 3 4 3 7", "none", `stroke-width="1.4"`),
  "✋": path("M10 29c-3-3-5-8-5-11 0-2 2-2 3-1l2 2V7c0-1.6 2.6-1.6 2.6 0v9V4.6c0-1.6 2.8-1.6 2.8 0V16V5.6c0-1.6 2.8-1.6 2.8 0V16V8.4c0-1.6 2.6-1.6 2.6 0V19c0 6-3 10-8 10z", C.fur),
  "🙌": path("M4 26c-2-4-2-9 0-12l1 4V7c0-1 2-1 2 0v6V5c0-1 2-1 2 0v8V6c0-1 2-1 2 0v9c0 6-2 10-5 11zM28 26c2-4 2-9 0-12l-1 4V7c0-1-2-1-2 0v6V5c0-1-2-1-2 0v8V6c0-1-2-1-2 0v9c0 6 2 10 5 11z", C.fur) + sparkle(16, 6, 3, C.yellow),
  "🤝": path("M2 12l6-3 5 2 5-2 6 1 6 3v5l-6 6-4 3-4-2-4-3-6-3-4-2z", C.fur) + path("M13 11l-4 4c1 1 3 1 4 0l3-2 6 6M18 21l-2 2M15 19l-2 2M21 18.6l-2 2", "none", `stroke-width="1.4"`),
  "👥": circ(20, 9, 4.4, C.dwood) + path("M12 25c0-6 3.6-9 8-9s8 3 8 9z", C.dwood) + circ(12, 11, 4.6, C.fur) + path("M3 28c0-6 4-9.6 9-9.6s9 3.6 9 9.6z", C.fur),
  "👨‍🍳": path("M9 11c-3 0-4-5 0-6 1-3 6-4 7-1 1-3 6-2 7 1 4 1 3 6 0 6z", C.white) + rect(9, 10, 14, 3, C.white, 0.6) + ell(16, 20.5, 8.5, 8, C.fur) + dot(13, 19, 1.3) + dot(19, 19, 1.3) + ell(16, 22, 1.8, 1.2, INK, `stroke="none"`) + rect(14.6, 23.6, 2.8, 2.4, "#fff", 0.4, `stroke-width="1"`),
  "😀": beaverFace(path("M11.5 19.8c1.2 3.6 7.8 3.6 9 0z", C.dwood) + rect(14.4, 20.2, 3.2, 2.4, "#fff", 0.4, `stroke-width="1"`)),
  "😄": beaverFace(path("M11.5 19.8c1.2 3.6 7.8 3.6 9 0z", C.dwood) + rect(14.4, 20.2, 3.2, 2.4, "#fff", 0.4, `stroke-width="1"`), line("M9.4 15.4c1-1.6 3-1.6 4 0M18.6 15.4c1-1.6 3-1.6 4 0", 1.8)),
  "🙂": beaverFace(smile + teeth),
  "😊": beaverFace(smile + teeth, line("M9.4 15.4c1-1.6 3-1.6 4 0M18.6 15.4c1-1.6 3-1.6 4 0", 1.8), dot(8.4, 19, 2, "#f29a9a") + dot(23.6, 19, 2, "#f29a9a")),
  "😮": beaverFace(ell(16, 23, 2.4, 3, C.dwood)),
  "😴": beaverFace(teeth, line("M9.6 15.4c1 1.2 3 1.2 4 0M18.4 15.4c1 1.2 3 1.2 4 0", 1.8), `<text x="24" y="7" font-size="8" font-weight="900" font-family="system-ui" fill="${C.blue}" stroke="none">z</text>`),
  "😎": beaverFace(smile + teeth, path("M7.5 13h17l-1 4c-1 2-5 2-6 0l-1-2-1 2c-1 2-5 2-6 0z", INK)),

  // ——— Hearts, shapes and signs ———
  "❤": heart(C.red), "💛": heart(C.yellow), "💜": heart(C.purple),
  "💖": heart(C.pink, sparkle(26, 6, 3.4, C.yellow) + sparkle(6, 25, 2.4, C.white)),
  "💗": heart(C.pink, path("M10 15c2-2 4 0 6 2 2-2 4-4 6-2", "none", `stroke="#fff" stroke-width="1.6"`)),
  "🔴": ball(C.red), "🔵": ball(C.blue), "🟢": ball(C.green), "⚪": ball(C.white), "⚫": ball(INK), "🟤": ball(C.wood),
  "🟥": square(C.red), "🟩": square(C.green), "🟪": square(C.purple), "🟫": square(C.wood), "⬛": square(INK),
  "✅": rect(4, 4, 24, 24, C.green, 6) + path("M9.5 16.5l4.5 4.5 9-10", "none", `stroke="#fff" stroke-width="3.4"`),
  "➕": rect(4, 4, 24, 24, C.sky, 6) + path("M16 9v14M9 16h14", "none", `stroke-width="3.4"`),
  "❔": circ(16, 16, 12, C.cream) + path("M11.5 12.5c0-3 2-4.6 4.6-4.6 2.8 0 4.6 1.6 4.6 4 0 3.4-4.4 3.4-4.4 6.6", "none", `stroke-width="3"`) + dot(16.2, 23.6, 1.8),
  "❗": path("M13 4h6l-1 16h-4z", C.red) + circ(16, 25.5, 2.6, C.red),
  "⚠": path("M16 3 2 28h28z", C.yellow) + path("M16 11v8", "none", `stroke-width="3"`) + dot(16, 23.4, 1.7),
  "🚫": circ(16, 16, 12, C.white, `stroke="${C.red}" stroke-width="3.6"`) + line("M7.5 7.5l17 17", 3.6, C.red),
  "🔤": rect(3, 6, 26, 20, C.cream, 4) + `<text x="16" y="21" font-size="11" font-weight="900" text-anchor="middle" font-family="Nunito,system-ui,sans-serif" fill="${INK}" stroke="none">abc</text>`,
  "💨": path("M3 11h15a4 4 0 1 0-4-4M3 17h22a4 4 0 1 1-4 4M3 23h10", "none", `stroke="${C.dgrey}" stroke-width="2.6"`),
  "▶": path("M9 5v22l18-11z", C.green) + hl(13, 11, 1.6, 2.4, 0),
  "⬅": arrow(180), "➡": arrow(0), "⬆": arrow(-90), "⬇": arrow(90),
};

/** Extra names some characters go by (the same picture under another code point). */
export const ALIAS: Record<string, string> = { "☺": "😊", "✔": "✅" };
