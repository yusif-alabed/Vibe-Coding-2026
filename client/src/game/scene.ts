import type { FriendView, Look, QuestsWire, ServerMsg } from "@beaver/shared";
import type { Sound } from "../audio/sound";
import type { Renderer } from "../engine/renderer";
import type { Prefs } from "../prefs";
import type { Net } from "../net/net";
import type { Input } from "./input";

export interface PlayerState {
  you: string;
  name: string;
  coins: number;
  owned: string[];
  look: Look;
  furniture: Record<string, number>;
  quests: QuestsWire | null;
  account: { pid: string; friendCode: string; recoveryCode: string } | null;
  friends: FriendView[];
  party: { leader: string | null; members: { pid: string; name: string; online: boolean }[] };
}

export interface Ctx {
  r: Renderer;
  input: Input;
  net: Net;
  ui: HTMLElement;
  state: PlayerState;
  sound: Sound;
  prefs: Prefs;
}

export interface Scene {
  handle(m: ServerMsg): void;
  update(dt: number): void;
  render(): void;
  dispose(): void;
}
