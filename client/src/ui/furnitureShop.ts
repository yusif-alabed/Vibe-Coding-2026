import { FURNITURE } from "@beaver/shared";
import type { Ctx } from "../game/scene";
import { h } from "./dom";

/** The grid of cabin furniture for sale (used by the Outfitter's "Cabin" tab and inside your cabin). */
export function furnitureGrid(ctx: Ctx): HTMLElement {
  const st = ctx.state;
  return h("div.grid", {}, FURNITURE.map((f) => {
    const have = st.furniture[f.id] ?? 0;
    const maxed = have >= 6;
    return h("div.item", {}, [
      h("div.ico", { style: { background: "#f7e8c9" } }, f.icon),
      h("div.nm", {}, f.name),
      h("div.price", {}, have ? `You have ${have}` : f.layer === 0 ? "Rug · goes under things" : `${f.w}×${f.d} tiles`),
      h("button.btn.small.gold", { disabled: maxed || st.coins < f.price, onclick: () => ctx.net.send({ t: "buyFurniture", item: f.id }) }, maxed ? "Max 6" : `Buy · 🪙 ${f.price}`),
    ]);
  }));
}
