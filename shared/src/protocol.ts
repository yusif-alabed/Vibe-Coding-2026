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
  /** Stable public player id (for friends); absent for bots. */
  pid?: string;
}

export interface RoomInfo {
  id: string;
  kind: "hub" | "race";
  isPrivate: boolean;
  /** Short code friends type to join a private room. */
  code?: string;
}

/** Cozy things you can do at a place: sip cocoa at the lodge, soak in the hot spring. */
/** The two minigames share one race engine: Toboggan Rush down the mountain and Canoe Dash down the river. */
export type RaceGame = "toboggan" | "canoe";

export type HubAct = "cocoa" | "soak" | "croissant" | "icecream" | "taffy" | "marshmallow" | "guitar" | "ride" | "skate" | "climb" | "stop";

/** Where each cozy activity can be started (the server checks you're there). */
export const ACT_PLACES: Record<Exclude<HubAct, "stop">, string> = {
  cocoa: "lodge", soak: "hotSpring", croissant: "bakery", icecream: "icecream", taffy: "maple", marshmallow: "camp",
  guitar: "bandstand", ride: "ferris", skate: "rink", climb: "lookout",
};
/** Which daily-quest kind an activity counts toward, if any. */
export const ACT_QUEST: Partial<Record<HubAct, "ride" | "skate" | "treat" | "music">> = {
  croissant: "treat", icecream: "treat", taffy: "treat", marshmallow: "treat", cocoa: "treat", guitar: "music", ride: "ride", skate: "skate",
};

export interface FriendView {
  pid: string;
  name: string;
  online: boolean;
  /** Where they are right now ("Village", "Racing", "In a cabin"…), when online. */
  where: string | null;
  /** True when you can hop straight into their village. */
  joinable: boolean;
  look: Look | null;
}

export type ClientMsg =
  | { t: "friendRequest"; id?: string; code?: string }
  | { t: "friendRespond"; from: string; accept: boolean }
  | { t: "friendRemove"; pid: string }
  | { t: "joinFriend"; pid: string }
  | { t: "partyInvite"; pid: string }
  | { t: "partyRespond"; from: string; accept: boolean }
  | { t: "partyLeave" }
  | { t: "act"; a: HubAct }
  | { t: "join"; name: string; look: Look; room?: "public" | "private-new" | string; token?: string; recovery?: string }
  | { t: "move"; x: number; z: number; ry: number }
  | { t: "chat"; text: string }
  | { t: "quick"; i: number }
  | { t: "emote"; i: number }
  | { t: "look"; look: Look }
  | { t: "buy"; item: string }
  | { t: "queueRace"; game?: RaceGame }
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
  | { t: "account"; pid: string; friendCode: string; recoveryCode: string }
  | { t: "friends"; list: FriendView[] }
  | { t: "friendRequest"; from: string; name: string }
  | { t: "partyInvite"; from: string; name: string }
  | { t: "party"; leader: string | null; members: { pid: string; name: string; online: boolean }[] }
  | { t: "wallet"; coins: number; owned: string[] }
  | { t: "queue"; count: number; size: number; startsInMs: number }
  | { t: "raceStart"; game?: RaceGame; seed: number; racers: { id: string; name: string; look: Look | null; isBot: boolean }[]; countdownMs: number }
  | { t: "race"; time: number; r: RaceSnapshot }
  | { t: "raceEnd"; results: RaceResultWire[] }
  | { t: "system"; text: string }
  | { t: "error"; text: string }
  | { t: "pong" }
  | QuestsWire
  | { t: "pinecones"; day: string; spots: { id: number; x: number; z: number }[]; collected: number[] }
  | { t: "furniture"; counts: Record<string, number> }
  | { t: "cabin"; owner: string; ownerName: string; items: PlacedItem[]; editable: boolean; look: Look };
