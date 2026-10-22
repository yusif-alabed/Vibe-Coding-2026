import { h } from "./dom";

/**
 * Hand-drawn line icons for the menus (ink-brown strokes, like doodles on a trail map).
 * Each is a 24×24 SVG drawn in `currentColor`, so it takes the colour of the text around it.
 */
const PATHS: Record<string, string> = {
  mountains: `<path d="M2.5 19.5 8.6 8.2l3.3 5.6 2.7-3.9 6.9 9.6"/><path d="m7 11 1.6.9 1.2-1.3"/><path d="M2 19.6c6.5.5 13.5.4 20 0"/>`,
  house: `<path d="M3.2 11.4 12 4.2l8.8 7.2"/><path d="M5.6 9.6v10.2h12.8V9.6"/><path d="M10 19.8v-5.3h4v5.3"/><path d="M15.6 5.4v2.2"/>`,
  calendar: `<rect x="3.2" y="5.2" width="17.6" height="15.4" rx="3.2"/><path d="M3.4 9.8h17.2M8 3.2v4M16 3.2v4"/><g fill="currentColor" stroke="none"><circle cx="8" cy="13.4" r="1.1"/><circle cx="12" cy="13.4" r="1.1"/><circle cx="16" cy="13.4" r="1.1"/><circle cx="8" cy="17.2" r="1.1"/><circle cx="12" cy="17.2" r="1.1"/></g>`,
  friends: `<circle cx="9" cy="8.6" r="3.4" fill="currentColor"/><path d="M2.8 19.6c.4-4 2.9-6 6.2-6s5.8 2 6.2 6z" fill="currentColor"/><circle cx="16.6" cy="9.4" r="2.7" fill="currentColor"/><path d="M15.4 13.9c.4-.1.8-.1 1.2-.1 2.7 0 4.5 1.8 4.8 5h-4.1" fill="currentColor"/>`,
  gear: `<circle cx="12" cy="12" r="7.2" stroke-width="3.6" stroke-dasharray="2.9 2.75" stroke-linecap="butt"/><circle cx="12" cy="12" r="5.2" stroke-width="2.6"/><circle cx="12" cy="12" r="1.9" stroke-width="2.2"/>`,
  tree: `<path d="M12 2.8 7.6 8.6h2.6l-3.9 5h2.9L5 19h14l-4.2-5.4h2.9l-3.9-5h2.6z"/><path d="M12 19v2.4"/>`,
  paw: `<g fill="currentColor" stroke="none"><ellipse cx="6.2" cy="10.6" rx="2" ry="2.5"/><ellipse cx="10" cy="6.6" rx="2" ry="2.6"/><ellipse cx="14.4" cy="6.6" rx="2" ry="2.6"/><ellipse cx="18" cy="10.8" rx="2" ry="2.5"/><path d="M12.2 11.6c2.6 0 5.2 3.4 5.2 5.8 0 2-1.6 2.8-3 2.4-1-.3-1.4-.8-2.2-.8s-1.3.5-2.2.8c-1.4.4-3-.4-3-2.4 0-2.4 2.6-5.8 5.2-5.8z"/></g>`,
  pin: `<path d="M8.5 3.5h7l-1.2 5.6 2.9 3.2H6.8l2.9-3.2z" fill="currentColor"/><path d="M12 12.4v8.2"/>`,
};

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, cls = ""): HTMLElement {
  const el = h("span.ic" + (cls ? `.${cls}` : ""), { "aria-hidden": "true" });
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
  return el;
}

/** The big mountain doodle that sits on top of the title sign. */
export function logoMountains(): HTMLElement {
  const el = h("div.logo-mtn", { "aria-hidden": "true" });
  el.innerHTML = `<svg viewBox="0 0 220 70" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M38 64 74 18l18 22 22-30 22 26 14-12 26 40"/>
    <path d="M66 31l9 6 8-8M105 22l9 7 9-8"/>
    <path d="M18 34l9 4M22 22l9 9M172 16l-5 10M186 28l-9 5M190 42l-10 1"/>
  </svg>`;
  return el;
}

/** A gold coin with a beaver stamped on it. */
export function coin(): HTMLElement {
  const el = h("span.coin", { "aria-hidden": "true" });
  el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="7.6" cy="7.4" r="2"/><circle cx="16.4" cy="7.4" r="2"/>
    <path d="M6.6 12.4c0-3.4 2.4-5.4 5.4-5.4s5.4 2 5.4 5.4c0 3.2-2.4 5.4-5.4 5.4s-5.4-2.2-5.4-5.4z"/>
    <path d="M10.6 14.2h2.8v2.4h-2.8z"/><circle cx="9.8" cy="11.2" r=".5" fill="currentColor"/><circle cx="14.2" cy="11.2" r=".5" fill="currentColor"/>
  </svg>`;
  return el;
}
