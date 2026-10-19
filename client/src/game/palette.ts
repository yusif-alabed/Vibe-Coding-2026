import { hexToRgb, mixRgb, type Vec3 } from "../engine/math";

/**
 * Beaver Banff palette — "Chunky Alpine Toon".
 * Cheerful storybook colours inspired by a Canadian mountain winter:
 * big readable shapes, crisp snow, candy-bright ice and warm lodge timber.
 */
export const P = {
  ink: "#2e1c12",
  grassA: "#8fba70",
  grassB: "#78a85f",
  grassC: "#a6c97b",
  meadowDark: "#548a4b",
  dirt: "#c99d5e",
  sand: "#e7cb91",
  paving: "#edf3f2",
  pavingDark: "#d4e2e6",
  stone: "#a9a39a",
  stoneDark: "#7d7770",
  rock: "#8c8f99",
  rockDark: "#6d7280",
  snow: "#ffffff",
  snowShade: "#b9d8e8",
  glacier: "#46d5e1",
  glacierDeep: "#168fb2",
  lakebed: "#2a7f86",
  pine: "#3a9c6b",
  pineDark: "#226d52",
  pineLight: "#67b97d",
  trunk: "#7a4b2c",
  timber: "#c8874f",
  timberDark: "#7f4428",
  timberLight: "#e7ad70",
  roofGreen: "#317d63",
  roofRed: "#ed6355",
  roofTeal: "#28b9b7",
  window: "#ffd67a",
  lampGlow: "#ffe9a8",
  portal: "#8effef",
  gold: "#ffd14f",
  white: "#ffffff",
  flowerPink: "#ff7eb3",
  flowerYellow: "#ffd93b",
  flowerPurple: "#a77bff",
} as const;

export const rgb = (h: string): Vec3 => hexToRgb(h);
export const shade = (h: string, k: number): Vec3 => mixRgb(hexToRgb(h), k > 0 ? [1, 1, 1] : [0, 0, 0], Math.abs(k));
