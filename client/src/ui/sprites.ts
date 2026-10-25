import { ALIAS, ART, INK } from "./spriteArt";

/**
 * Swaps the emoji shorthand the game's text uses for Beaver Banff's own hand-drawn sprites.
 *
 * Game data (quests, labels, toasts, chat, the server's messages) keeps using the characters as
 * compact names, and this turns them into pictures as they reach the screen: a MutationObserver
 * watches the UI and replaces each character with a `<span class="spr">` showing its sprite. The
 * character stays inside the span (pushed out of view), so `textContent`, copy-paste and screen
 * readers still see the same text, and code that compares text keeps working.
 */

const PICT = /\p{Extended_Pictographic}️?(?:‍\p{Extended_Pictographic}️?)*/gu;
const HAS = /\p{Extended_Pictographic}/u;
const urls = new Map<string, string | null>();
const imgs = new Map<string, HTMLImageElement>();

function key(ch: string): string {
  const k = ch.replace(/️/g, "");
  return ALIAS[k] ?? k;
}

/** The sprite for a character as an SVG data URL, or null if it has none (left as text). */
export function spriteUrl(ch: string): string | null {
  const k = key(ch);
  let u = urls.get(k);
  if (u === undefined) {
    const art = ART[k];
    u = art
      ? "data:image/svg+xml," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">${art}</svg>`)
      : null;
    urls.set(k, u);
  }
  return u;
}

/** A loaded image of a sprite, for drawing on a canvas (null until it has loaded). */
export function spriteImage(ch: string): HTMLImageElement | null {
  const u = spriteUrl(ch);
  if (!u) return null;
  let im = imgs.get(u);
  if (!im) { im = new Image(); im.src = u; imgs.set(u, im); }
  return im.complete && im.naturalWidth ? im : null;
}

/** Split a string into plain text and sprite characters. */
export function splitSprites(text: string): { text: string; sprite?: string }[] {
  const out: { text: string; sprite?: string }[] = [];
  let last = 0;
  PICT.lastIndex = 0;
  for (const m of text.matchAll(PICT)) {
    const u = spriteUrl(m[0]);
    if (!u) continue;
    if (m.index! > last) out.push({ text: text.slice(last, m.index) });
    out.push({ text: m[0], sprite: u });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last) });
  return out;
}

/** Text with the sprite characters removed (for tooltips and placeholders, which can't show pictures). */
export function stripSprites(text: string): string {
  return text.replace(PICT, (m) => (spriteUrl(m) ? "" : m)).replace(/^\s+/, "").replace(/\s{2,}/g, " ");
}

/**
 * Draw text that may contain sprites on a 2D canvas, centred or left-aligned like `fillText`
 * (respects the canvas's current `textAlign` for "center"/"left"/"right"). Returns nothing.
 */
export function fillSpriteText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  const parts = splitSprites(text);
  const w = parts.reduce((a, p) => a + (p.sprite ? size * 1.1 : g.measureText(p.text).width), 0);
  const align = g.textAlign;
  let cx = align === "center" ? x - w / 2 : align === "right" || align === "end" ? x - w : x;
  g.textAlign = "left";
  for (const p of parts) {
    if (p.sprite) {
      const im = spriteImage(p.text);
      if (im) g.drawImage(im, cx + size * 0.05, y - size / 2 - (g.textBaseline === "middle" ? 0 : size * 0.35), size, size);
      cx += size * 1.1;
    } else {
      g.fillText(p.text, cx, y);
      cx += g.measureText(p.text).width;
    }
  }
  g.textAlign = align;
}

/** One CSS class per sprite, so each picture's data is parsed once rather than on every span. */
const classes = new Map<string, string>();
let sheet: CSSStyleSheet | null = null;
function spriteClass(url: string): string {
  let c = classes.get(url);
  if (!c) {
    c = "s" + classes.size.toString(36);
    classes.set(url, c);
    sheet?.insertRule(`.spr.${c}{background-image:url("${url}")}`, sheet.cssRules.length);
  }
  return c;
}

const SKIP = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION", "TITLE"]);

function swapText(node: Text) {
  const t = node.data;
  if (!HAS.test(t)) return;
  const parent = node.parentElement;
  if (!parent || SKIP.has(parent.tagName) || parent.classList.contains("spr") || parent.isContentEditable) return;
  const parts = splitSprites(t);
  if (!parts.some((p) => p.sprite)) return;
  const frag = document.createDocumentFragment();
  for (const p of parts) {
    if (!p.sprite) { frag.append(p.text); continue; }
    const s = document.createElement("span");
    s.className = "spr " + spriteClass(p.sprite);
    s.setAttribute("role", "img");
    s.textContent = p.text;
    frag.append(s);
  }
  node.replaceWith(frag);
}

const ATTRS = ["title", "placeholder", "aria-label"];

function swapAttrs(el: Element) {
  for (const a of ATTRS) {
    const v = el.getAttribute(a);
    if (v && HAS.test(v)) {
      const s = stripSprites(v);
      if (s !== v) el.setAttribute(a, s);
    }
  }
}

function sweep(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) { swapText(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE) return;
  const el = root as Element;
  if (SKIP.has(el.tagName) || el.classList.contains("spr")) return;
  swapAttrs(el);
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const texts: Text[] = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) { if (HAS.test((n as Text).data)) texts.push(n as Text); }
    else swapAttrs(n as Element);
  }
  texts.forEach(swapText);
}

const CSS = `
.spr{display:inline-block;width:1.18em;height:1.18em;vertical-align:-.22em;background:center/contain no-repeat;
  overflow:hidden;white-space:nowrap;text-indent:3em;line-height:1;color:transparent;flex:none}
.btn.icon .spr,.btn.icon>.spr:only-child{width:1.35em;height:1.35em}
`;

let started = false;

/** Start swapping sprites into the page (idempotent). */
export function installSprites(root: HTMLElement = document.body): void {
  if (started) return;
  started = true;
  const st = document.createElement("style");
  st.textContent = CSS;
  document.head.append(st);
  sheet = st.sheet;
  sweep(root);
  new MutationObserver((list) => {
    for (const m of list) {
      if (m.type === "characterData") swapText(m.target as Text);
      else if (m.type === "attributes") swapAttrs(m.target as Element);
      else m.addedNodes.forEach(sweep);
    }
  }).observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  for (const k of Object.keys(ART)) spriteImage(k); // warm the canvas cache
}
