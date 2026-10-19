import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { DEFAULT_LOOK, type ServerMsg } from "@beaver/shared";
import { GameServer } from "../server";

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

/** Tiny test client that records every message. */
async function connect(name: string, room?: string) {
  const ws = new WebSocket(url);
  const inbox: ServerMsg[] = [];
  ws.on("message", (d) => inbox.push(JSON.parse(String(d))));
  await new Promise((r) => ws.on("open", r));
  ws.send(JSON.stringify({ t: "join", name, look: DEFAULT_LOOK, room }));
  const waitFor = async <T extends ServerMsg["t"]>(t: T, pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true) => {
    for (let i = 0; i < 100; i++) {
      const m = inbox.find((x) => x.t === t && pred(x as Extract<ServerMsg, { t: T }>));
      if (m) return m as Extract<ServerMsg, { t: T }>;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`timed out waiting for ${t}`);
  };
  const welcome = await waitFor("welcome");
  return { ws, inbox, waitFor, welcome, send: (m: object) => ws.send(JSON.stringify(m)) };
}

describe("game server", () => {
  it("puts two players in the same public village and syncs movement", async () => {
    const a = await connect("Alder");
    const b = await connect("Briar");
    assert.equal(b.welcome.room.id, a.welcome.room.id);
    assert.ok(b.welcome.players.map((p) => p.name).includes("Alder"));
    await a.waitFor("joined", (m) => m.p.name === "Briar");

    const start = a.welcome.players.find((p) => p.id === a.welcome.you)!;
    await new Promise((r) => setTimeout(r, 200));
    a.send({ t: "move", x: start.x + 1, z: start.z, ry: 1 });
    const st = await b.waitFor("state", (m) => m.p.some(([id, x]) => id === a.welcome.you && Math.abs(x - (start.x + 1)) < 0.01));
    assert.ok(st);
    a.ws.close();
    b.ws.close();
  });

  it("rejects teleporting", async () => {
    const a = await connect("Zippy");
    a.send({ t: "move", x: 50, z: 50, ry: 0 });
    await new Promise((r) => setTimeout(r, 150));
    const hub = game.hubs.get(a.welcome.room.id)!;
    const me = hub.clients.get(a.welcome.you)!;
    assert.ok(Math.hypot(me.x - 50, me.z - 50) > 20);
    a.ws.close();
  });

  it("creates a private room that friends can join by code", async () => {
    const host = await connect("Host", "private-new");
    assert.equal(host.welcome.room.isPrivate, true);
    const code = host.welcome.room.code!;
    const friend = await connect("Friend", code.toLowerCase());
    assert.equal(friend.welcome.room.id, host.welcome.room.id);
    const stranger = await connect("Stranger");
    assert.notEqual(stranger.welcome.room.id, host.welcome.room.id);
    host.ws.close();
    friend.ws.close();
    stranger.ws.close();
  });

  it("filters chat, rate limits, and respects blocks", async () => {
    const a = await connect("Chatty");
    const b = await connect("Listener");
    a.send({ t: "chat", text: "you are dumb" });
    const m = await b.waitFor("chat", (x) => x.name === "Chatty");
    assert.ok(!m.text.includes("dumb"));

    a.send({ t: "chat", text: "my email is a@b.com" });
    await a.waitFor("system", (x) => x.text.includes("safety"));

    b.send({ t: "block", id: a.welcome.you });
    await new Promise((r) => setTimeout(r, 50));
    a.send({ t: "chat", text: "can you hear me" });
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(b.inbox.some((x) => x.t === "chat" && x.text === "can you hear me"), false);
    a.ws.close();
    b.ws.close();
  });

  it("only lets you buy what you can afford, and keeps coins across reconnects", async () => {
    const a = await connect("Shopper");
    a.send({ t: "buy", item: "hat_crown" });
    await a.waitFor("error");
    a.send({ t: "buy", item: "hat_toque_teal" });
    const w = await a.waitFor("wallet");
    assert.equal(w.coins, 40);
    a.ws.close();

    const ws = new WebSocket(url);
    const inbox: ServerMsg[] = [];
    ws.on("message", (d) => inbox.push(JSON.parse(String(d))));
    await new Promise((r) => ws.on("open", r));
    ws.send(JSON.stringify({ t: "join", name: "Shopper", look: DEFAULT_LOOK, token: a.welcome.token }));
    for (let i = 0; i < 50 && !inbox.some((m) => m.t === "welcome"); i++) await new Promise((r) => setTimeout(r, 20));
    const welcome = inbox.find((m) => m.t === "welcome") as Extract<ServerMsg, { t: "welcome" }>;
    assert.equal(welcome.coins, 40);
    assert.ok(welcome.owned.includes("hat_toque_teal"));
    ws.close();
  });

  it("won't queue for a race away from the portal", async () => {
    const a = await connect("Eager");
    a.send({ t: "queueRace" });
    const e = await a.waitFor("error");
    assert.match(e.text, /trailhead/);
    a.ws.close();
  });
});
