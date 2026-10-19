/** Tiny DOM helper: h("div.card.pe", { onclick }, ["text", child]) */
type Attrs = Record<string, unknown> & { style?: Partial<CSSStyleDeclaration> | string };
type Child = Node | string | number | null | undefined | false;

export function h<T extends HTMLElement = HTMLElement>(sel: string, attrs: Attrs = {}, children: Child[] | Child = []): T {
  const [tag, ...classes] = sel.split(".");
  const el = document.createElement(tag) as T;
  if (classes.length) el.className = classes.join(" ");
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === "style") {
      if (typeof v === "string") el.setAttribute("style", v);
      else Object.assign(el.style, v);
    } else if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2), v as EventListener);
    } else if (k in el && typeof v !== "string") {
      (el as unknown as Record<string, unknown>)[k] = v;
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of Array.isArray(children) ? children : [children]) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : String(c));
  }
  return el;
}

export function toast(root: HTMLElement, text: string, ms = 2600) {
  const t = h("div.card.toast", {}, text);
  root.append(t);
  setTimeout(() => t.remove(), ms);
}
