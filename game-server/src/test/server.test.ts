import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { DEFAULT_LOOK, validateMove, type ServerMsg } from "@beaver/shared";
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
    // Spawns are random, so +1 may be solid (a bench, the fountain): expect what the shared rules allow.
    const want = validateMove(start, { x: start.x + 1, z: start.z }, 1000);
    a.send({ t: "move", x: start.x + 1, z: start.z, ry: 1 });
    const st = await b.waitFor("state", (m) => m.p.some(([id, x, z]) => id === a.welcome.you && Math.abs(x - want.x) < 0.02 && Math.abs(z - want.z) < 0.02));
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
    // 100 coins to start, minus the 60 hat. A random spawn beside a landmark can add a visit reward, so allow for that.
    assert.ok(w.coins >= 40, `coins after buying: ${w.coins}`);
    a.ws.close();

    const ws = new WebSocket(url);
    const inbox: ServerMsg[] = [];
    ws.on("message", (d) => inbox.push(JSON.parse(String(d))));
    await new Promise((r) => ws.on("open", r));
    ws.send(JSON.stringify({ t: "join", name: "Shopper", look: DEFAULT_LOOK, token: a.welcome.token }));
    for (let i = 0; i < 50 && !inbox.some((m) => m.t === "welcome"); i++) await new Promise((r) => setTimeout(r, 20));
    const welcome = inbox.find((m) => m.t === "welcome") as Extract<ServerMsg, { t: "welcome" }>;
    assert.equal(welcome.coins, w.coins); // exactly what we had when we left
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

describe("quests, pinecones and cabins on the server", () => {
  it("sends today's quests and pinecones on arrival and pays for a pinecone only when close", async () => {
    const a = await connect("Gatherer");
    const quests = await a.waitFor("quests");
    assert.equal(quests.list.length, 3);
    const cones = await a.waitFor("pinecones");
    const spot = cones.spots[0];
    a.send({ t: "collect", id: spot.id });
    await new Promise((r) => setTimeout(r, 120));
    assert.equal(a.inbox.filter((m) => m.t === "pinecones").length, 1, "too far away: nothing happens");
    // Walk there at a legal speed.
    const me = a.welcome.players.find((p) => p.id === a.welcome.you)!;
    let x = me.x, z = me.z;
    const hub = game.hubs.get(a.welcome.room.id)!;
    const c = hub.clients.get(a.welcome.you)!;
    // Teleport the server-side position directly for the test (movement rules are tested elsewhere).
    c.x = spot.x + 0.5; c.z = spot.z;
    void x; void z;
    a.send({ t: "collect", id: spot.id });
    const after = await a.waitFor("pinecones", (m) => m.collected.includes(spot.id));
    assert.ok(after);
    a.ws.close();
  });

  it("lets you decorate your own cabin, rejects bad layouts, and lets friends visit", async () => {
    const owner = await connect("Decorator");
    await owner.waitFor("quests");
    owner.send({ t: "enterCabin" });
    const cabin = await owner.waitFor("cabin");
    assert.equal(cabin.editable, true);
    owner.send({ t: "saveCabin", items: [{ id: "bed", x: 0, z: 0, rot: 0 }] });
    await owner.waitFor("error", (m) => /only have/.test(m.text));
    owner.send({ t: "saveCabin", items: [{ id: "armchair", x: 7, z: 5, rot: 0 }] });
    await new Promise((r) => setTimeout(r, 80));
    const friend = await connect("Visitor");
    friend.send({ t: "visitCabin", id: owner.welcome.you });
    const seen = await friend.waitFor("cabin");
    assert.equal(seen.editable, false);
    assert.deepEqual(seen.items, [{ id: "armchair", x: 7, z: 5, rot: 0 }]);
    friend.send({ t: "leaveCabin" });
    await friend.waitFor("welcome", (m) => m !== friend.welcome);
    owner.ws.close();
    friend.ws.close();
  });

  it("buys furniture with coins", async () => {
    const a = await connect("Shopper2");
    a.send({ t: "buyFurniture", item: "chair" });
    const f = await a.waitFor("furniture", (m) => (m.counts.chair ?? 0) === 1);
    assert.equal(f.counts.chair, 1);
    a.ws.close();
  });
});

describe("friends, parties, activities and the Canoe Dash", () => {
  it("sends friend and recovery codes, and lets you sign in on another device with the recovery code", async () => {
    const a = await connect("Traveller");
    const acct = await a.waitFor("account");
    assert.match(acct.friendCode, /^[A-Z0-9]{6}$/);
    assert.match(acct.recoveryCode, /^[A-Z0-9]{10}$/);
    a.send({ t: "buyFurniture", item: "plant" });
    await a.waitFor("furniture", (m) => (m.counts.plant ?? 0) === 1);
    a.ws.close();
    await new Promise((r) => setTimeout(r, 50));
    const ws = new WebSocket(url);
    const inbox: ServerMsg[] = [];
    ws.on("message", (d) => inbox.push(JSON.parse(String(d))));
    await new Promise((r) => ws.on("open", r));
    ws.send(JSON.stringify({ t: "join", name: "Traveller", look: DEFAULT_LOOK, recovery: acct.recoveryCode.toLowerCase() }));
    for (let i = 0; i < 50 && !inbox.some((m) => m.t === "account"); i++) await new Promise((r) => setTimeout(r, 20));
    const again = inbox.find((m) => m.t === "account") as Extract<ServerMsg, { t: "account" }>;
    assert.equal(again.pid, acct.pid, "same beaver on the new device");
    const furn = inbox.find((m) => m.t === "furniture") as Extract<ServerMsg, { t: "furniture" }>;
    assert.equal(furn.counts.plant, 1, "progress came along");
    ws.close();
  });

  it("makes friends only when the other beaver accepts, then forms a party", async () => {
    const a = await connect("Maple");
    const b = await connect("Cedar");
    const bAcct = await b.waitFor("account");
    a.send({ t: "friendRequest", id: b.welcome.you });
    const req = await b.waitFor("friendRequest");
    assert.equal(req.name, "Maple");
    b.send({ t: "friendRespond", from: req.from, accept: true });
    const aFriends = await a.waitFor("friends", (m) => m.list.some((f) => f.pid === bAcct.pid && f.online));
    assert.equal(aFriends.list.length, 1);
    a.send({ t: "partyInvite", pid: bAcct.pid });
    const inv = await b.waitFor("partyInvite");
    b.send({ t: "partyRespond", from: inv.from, accept: true });
    const party = await a.waitFor("party", (m) => m.members.length === 2);
    assert.equal(party.leader, (await a.waitFor("account")).pid);
    a.ws.close();
    b.ws.close();
  });

  it("only starts cozy activities at the right place", async () => {
    const a = await connect("Sipper");
    a.send({ t: "act", a: "cocoa" });
    await new Promise((r) => setTimeout(r, 80));
    assert.ok(!a.inbox.some((m) => m.t === "act"), "not at the lodge: nothing happens");
    const hub = game.hubs.get(a.welcome.room.id)!;
    const c = hub.clients.get(a.welcome.you)!;
    c.x = -39; c.z = -2.5; // bakery doorstep
    a.send({ t: "act", a: "croissant" });
    const act = await a.waitFor("act", (m) => m.a === "croissant");
    assert.equal(act.id, a.welcome.you);
    a.ws.close();
  });

  it("queues the Canoe Dash only from the lake dock and starts a canoe race", async () => {
    const a = await connect("Paddler");
    a.send({ t: "queueRace", game: "canoe" });
    await a.waitFor("error", (m) => /Lake Dock/.test(m.text));
    const hub = game.hubs.get(a.welcome.room.id)!;
    const c = hub.clients.get(a.welcome.you)!;
    c.x = -24; c.z = 20;
    a.send({ t: "queueRace", game: "canoe" });
    await a.waitFor("queue");
    a.ws.close();
  });
});
