import { hexToRgb, mixRgb, type Vec3 } from "../engine/math";

/**
 * Beaver Banff palette — "Chunky Alpine Toon".
 * Saturated postcard colours inspired by the Canadian Rockies:
 * glacier turquoise, pine green, warm timber, snow and a peach-to-blue sky.
 */
export const P = {
  ink: "#2e1c12",
  grassA: "#86c25a",
  grassB: "#74b04c",
  grassC: "#9bd068",
  meadowDark: "#5f9a43",
  dirt: "#d1a970",
  sand: "#ead6a1",
  paving: "#dccfb6",
  pavingDark: "#c8b99c",
  stone: "#a9a39a",
  stoneDark: "#7d7770",
  rock: "#8c8f99",
  rockDark: "#6d7280",
  snow: "#f7fbff",
  snowShade: "#dbe8f5",
  glacier: "#2ec4c6",
  glacierDeep: "#1a9aa6",
  lakebed: "#2a7f86",
  pine: "#2f7d55",
  pineDark: "#23634a",
  pineLight: "#3f9a63",
  trunk: "#7a4b2c",
  timber: "#b27445",
  timberDark: "#8a5532",
  timberLight: "#cf9260",
  roofGreen: "#4c7a64",
  roofRed: "#d9483b",
  roofTeal: "#1fa9a1",
  window: "#ffd67a",
  lampGlow: "#ffe9a8",
  portal: "#7ff3f0",
  gold: "#f5c242",
  white: "#ffffff",
  flowerPink: "#ff7eb3",
  flowerYellow: "#ffd93b",
  flowerPurple: "#a77bff",
} as const;

export const rgb = (h: string): Vec3 => hexToRgb(h);
export const shade = (h: string, k: number): Vec3 => mixRgb(hexToRgb(h), k > 0 ? [1, 1, 1] : [0, 0, 0], Math.abs(k));
