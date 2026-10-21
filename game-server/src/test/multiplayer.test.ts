import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { DEFAULT_LOOK, HUB_PLACES, TOWN_PLACES, type ServerMsg } from "@beaver/shared";
import { GameServer } from "../server";

/**
 * Online play is real players only: lobbies gather beavers for every game, and the summit and
 * cabins are shared spaces. On its own server so lobbies from other tests can't interfere.
 */

let http: Server;
let game: GameServer;
let url: string;

before(async () => {
  http = createServer();
  game = new GameServer(http);
  await new Promise<void>((r) => http.listen(0, r));
  url = `ws://127.0.0.1:${(http.address() as AddressInfo).port}`;
});

after(() => {
  game.close();
  http.close();
});

async function connect(name: string) {
  const ws = new WebSocket(url);
  const inbox: ServerMsg[] = [];
  ws.on("message", (d) => inbox.push(JSON.parse(String(d))));
  await new Promise((r) => ws.on("open", r));
  ws.send(JSON.stringify({ t: "join", name, look: DEFAULT_LOOK }));
  const waitFor = async <T extends ServerMsg["t"]>(t: T, pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true, ms = 2000) => {
    for (let i = 0; i < ms / 20; i++) {
      const m = inbox.find((x) => x.t === t && pred(x as Extract<ServerMsg, { t: T }>));
      if (m) return m as Extract<ServerMsg, { t: T }>;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`timed out waiting for ${t}`);
  };
  const welcome = await waitFor("welcome");
  /** Puts this beaver somewhere in the village (movement rules are tested elsewhere). */
  const standAt = (p: { x: number; z: number }) => {
    const c = game.hubs.get(welcome.room.id)!.clients.get(welcome.you)!;
    c.x = p.x;
    c.z = p.z;
  };
  return { ws, inbox, waitFor, welcome, standAt, send: (m: object) => ws.send(JSON.stringify(m)) };
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("lobbies", () => {
  it("a lone beaver waits for company instead of getting bots", async () => {
    const a = await connect("Waiter");
    a.standAt(HUB_PLACES.trailhead);
    a.send({ t: "queueRace" });
    const q = await a.waitFor("queue", (m) => !!m.lobby);
    assert.equal(q.lobby!.count, 1);
    assert.equal(q.lobby!.startsInMs, null, "no countdown until someone else joins");
    await pause(400);
    assert.ok(!a.inbox.some((m) => m.t === "raceStart"), "never starts on its own");
    a.send({ t: "lobbyLeave" });
    await a.waitFor("queue", (m) => m.lobby === null);
    a.ws.close();
  });

  it("other villagers see the lobby, join from anywhere, and race together", async () => {
    const a = await connect("Host");
    const b = await connect("Joiner");
    assert.equal(a.welcome.room.id, b.welcome.room.id);
    a.standAt(HUB_PLACES.trailhead);
    a.send({ t: "queueRace" });
    const seen = await b.waitFor("lobbies", (m) => m.list.some((l) => l.names.includes("Host")));
    const lobby = seen.list.find((l) => l.names.includes("Host"))!;
    assert.equal(lobby.title, "Toboggan Rush");

    b.send({ t: "lobbyJoin", key: lobby.key });
    const q = await a.waitFor("queue", (m) => m.lobby?.count === 2);
    assert.ok(q.lobby!.startsInMs !== null && q.lobby!.startsInMs > 0, "a second beaver starts the countdown");
    assert.deepEqual(q.lobby!.names.sort(), ["Host", "Joiner"]);

    b.send({ t: "lobbyStart" });
    const sa = await a.waitFor("raceStart");
    const sb = await b.waitFor("raceStart");
    assert.equal(sa.racers.length, 2);
    assert.ok(sa.racers.every((r) => !r.isBot), "only real players");
    assert.deepEqual(sa.racers.map((r) => r.id), sb.racers.map((r) => r.id));
    a.ws.close();
    b.ws.close();
  });

  it("you can play alone, but not in a team game", async () => {
    const a = await connect("Solo");
    a.standAt(TOWN_PLACES.rink);
    a.send({ t: "queueGame", game: "snowball" });
    await a.waitFor("queue", (m) => m.lobby?.min === 2);
    a.send({ t: "lobbyStart" });
    await a.waitFor("error", (m) => /two beavers/.test(m.text));
    a.send({ t: "lobbyLeave" });

    a.standAt(TOWN_PLACES.camp);
    a.send({ t: "queueGame", game: "hunt" });
    await a.waitFor("queue", (m) => m.lobby?.game === "hunt");
    a.send({ t: "lobbyStart" });
    const start = await a.waitFor("gameStart");
    assert.equal(start.players.length, 1);
    a.ws.close();
  });

  it("golf with a friend: both tee off on the same course, no bot partner", async () => {
    const a = await connect("Golfer");
    const b = await connect("Caddie");
    a.standAt(TOWN_PLACES.clubhouse);
    a.send({ t: "golfQueue", holes: 1 });
    const seen = await b.waitFor("lobbies", (m) => m.list.some((l) => l.kind === "golf"));
    b.send({ t: "lobbyJoin", key: seen.list.find((l) => l.kind === "golf")!.key });
    await a.waitFor("queue", (m) => m.lobby?.count === 2);
    a.send({ t: "lobbyStart" });
    const g = await a.waitFor("golfStart");
    assert.equal(g.players.length, 2);
    assert.ok(g.players.every((p) => !p.isBot));
    a.send({ t: "golfQuit" });
    b.send({ t: "golfQuit" });
    await a.waitFor("golfEnd");
    a.ws.close();
    b.ws.close();
  });
});

describe("shared spaces", () => {
  it("beavers at the summit see each other", async () => {
    const a = await connect("Climber");
    const b = await connect("Hiker");
    a.standAt(TOWN_PLACES.gondola);
    b.standAt(TOWN_PLACES.gondola);
    a.send({ t: "gondola", up: true });
    const sa = await a.waitFor("summit");
    assert.deepEqual(sa.players, []);
    b.send({ t: "gondola", up: true });
    const sb = await b.waitFor("summit");
    assert.deepEqual(sb.players.map((p) => p.name), ["Climber"]);
    await a.waitFor("joined", (m) => m.p.name === "Hiker");

    const me = sb.players[0];
    await pause(250); // a legal walking speed: half a metre in a quarter of a second
    b.send({ t: "move", x: -14.5, z: 16, ry: 1 });
    await a.waitFor("state", (m) => m.p.some(([id, x]) => id !== me.id && Math.abs(x + 14.5) < 0.01));
    b.send({ t: "chat", text: "what a view" });
    await a.waitFor("chat", (m) => m.text === "what a view");

    b.send({ t: "gondola", up: false });
    await a.waitFor("left");
    a.ws.close();
    b.ws.close();
  });

  it("cabin visitors see the owner and watch the room change", async () => {
    const owner = await connect("Host2");
    const guest = await connect("Guest");
    owner.send({ t: "enterCabin" });
    await owner.waitFor("cabin");
    guest.send({ t: "visitCabin", id: owner.welcome.you });
    const seen = await guest.waitFor("cabin");
    assert.deepEqual(seen.players!.map((p) => p.name), ["Host2"]);
    await owner.waitFor("joined", (m) => m.p.name === "Guest");

    owner.send({ t: "saveCabin", items: [{ id: "armchair", x: 7, z: 5, rot: 0 }] });
    const changed = await guest.waitFor("cabin", (m) => m.items.length === 1);
    assert.equal(changed.editable, false);
    guest.send({ t: "leaveCabin" });
    await owner.waitFor("left");
    owner.ws.close();
    guest.ws.close();
  });
});
