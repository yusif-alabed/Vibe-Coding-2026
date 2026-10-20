import type { Look } from "./cosmetics";
import type { RaceSnapshot } from "./race";
import type { PlacedItem } from "./cabin";
import type { QuestsWire } from "./progress";

/** Wire protocol between the browser client and the game server (JSON over WebSocket). */

export interface PlayerInfo {
  id: string;
  name: string;
  look: Look;
  x: number;
  z: number;
  ry: number;
}

export interface RoomInfo {
  id: string;
  kind: "hub" | "race";
  isPrivate: boolean;
  /** Short code friends type to join a private room. */
  code?: string;
}

/** Cozy things you can do at a place: sip cocoa at the lodge, soak in the hot spring. */
export type HubAct = "cocoa" | "soak" | "stop";

export type ClientMsg =
  | { t: "act"; a: HubAct }
  | { t: "join"; name: string; look: Look; room?: "public" | "private-new" | string; token?: string }
  | { t: "move"; x: number; z: number; ry: number }
  | { t: "chat"; text: string }
  | { t: "quick"; i: number }
  | { t: "emote"; i: number }
  | { t: "look"; look: Look }
  | { t: "buy"; item: string }
  | { t: "queueRace" }
  | { t: "leaveQueue" }
  | { t: "steer"; v: number }
  | { t: "block"; id: string }
  | { t: "report"; id: string; reason: string }
  | { t: "ping" }
  | { t: "collect"; id: number }
  | { t: "photo" }
  | { t: "buyFurniture"; item: string }
  | { t: "enterCabin" }
  | { t: "visitCabin"; id: string }
  | { t: "leaveCabin" }
  | { t: "saveCabin"; items: PlacedItem[] };

export interface RaceResultWire {
  id: string;
  name: string;
  isBot: boolean;
  place: number;
  finished: boolean;
  time: number | null;
  coins: number;
}

export type ServerMsg =
  | { t: "welcome"; you: string; token: string; room: RoomInfo; players: PlayerInfo[]; coins: number; owned: string[]; look: Look }
  | { t: "state"; p: [string, number, number, number][] } // id, x, z, ry
  | { t: "joined"; p: PlayerInfo }
  | { t: "left"; id: string }
  | { t: "look"; id: string; look: Look }
  | { t: "chat"; id: string; name: string; text: string }
  | { t: "emote"; id: string; i: number }
  | { t: "act"; id: string; a: HubAct }
  | { t: "wallet"; coins: number; owned: string[] }
  | { t: "queue"; count: number; size: number; startsInMs: number }
  | { t: "raceStart"; seed: number; racers: { id: string; name: string; look: Look | null; isBot: boolean }[]; countdownMs: number }
  | { t: "race"; time: number; r: RaceSnapshot }
  | { t: "raceEnd"; results: RaceResultWire[] }
  | { t: "system"; text: string }
  | { t: "error"; text: string }
  | { t: "pong" }
  | QuestsWire
  | { t: "pinecones"; day: string; spots: { id: number; x: number; z: number }[]; collected: number[] }
  | { t: "furniture"; counts: Record<string, number> }
  | { t: "cabin"; owner: string; ownerName: string; items: PlacedItem[]; editable: boolean; look: Look };
