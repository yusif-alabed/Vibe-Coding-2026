import type { Look, ServerMsg } from "@beaver/shared";
import type { Renderer } from "../engine/renderer";
import type { Net } from "../net/net";
import type { Input } from "./input";

export interface PlayerState {
  you: string;
  name: string;
  coins: number;
  owned: string[];
  look: Look;
}

export interface Ctx {
  r: Renderer;
  input: Input;
  net: Net;
  ui: HTMLElement;
  state: PlayerState;
}

export interface Scene {
  handle(m: ServerMsg): void;
  update(dt: number): void;
  render(): void;
  dispose(): void;
}
