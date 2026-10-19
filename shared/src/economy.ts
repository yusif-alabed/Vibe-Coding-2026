import { CATALOG_BY_ID, type Look, type Slot } from "./cosmetics";

export interface Wallet {
  coins: number;
  owned: string[];
}

export type PurchaseResult =
  | { ok: true; wallet: Wallet }
  | { ok: false; reason: "unknown_item" | "already_owned" | "not_enough_coins" };

/** Pure purchase rule, run on the server. Never trust a client's coin count. */
export function purchase(wallet: Wallet, itemId: string): PurchaseResult {
  const item = CATALOG_BY_ID[itemId];
  if (!item) return { ok: false, reason: "unknown_item" };
  if (wallet.owned.includes(itemId)) return { ok: false, reason: "already_owned" };
  if (wallet.coins < item.price) return { ok: false, reason: "not_enough_coins" };
  return { ok: true, wallet: { coins: wallet.coins - item.price, owned: [...wallet.owned, itemId] } };
}

const SLOTS: Slot[] = ["hat", "scarf", "backpack", "trail"];
const HEX = /^#[0-9a-fA-F]{6}$/;

/** Returns a safe look: unknown, unowned or wrong-slot items are removed; bad colors fall back. */
export function sanitizeLook(input: unknown, owned: string[], fallbackFur: string): Look {
  const src = (typeof input === "object" && input) ? (input as Record<string, unknown>) : {};
  const fur = typeof src.fur === "string" && HEX.test(src.fur) ? src.fur : fallbackFur;
  const look: Look = { fur, hat: null, scarf: null, backpack: null, trail: null };
  for (const slot of SLOTS) {
    const id = src[slot];
    if (typeof id === "string" && owned.includes(id) && CATALOG_BY_ID[id]?.slot === slot) look[slot] = id;
  }
  return look;
}
