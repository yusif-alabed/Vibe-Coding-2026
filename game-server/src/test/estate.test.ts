import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { DEFAULT_LOOK, TOWN_PLACES, type ServerMsg } from "@beaver/shared";
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

async function connect(name: string) {
  const ws = new WebSocket(url);
  const inbox: ServerMsg[] = [];
  ws.on("message", (d) => inbox.push(JSON.parse(String(d))));
  await new Promise((r) => ws.on("open", r));
  ws.send(JSON.stringify({ t: "join", name, look: DEFAULT_LOOK }));
  const waitFor = async <T extends ServerMsg["t"]>(t: T, pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true, tries = 150) => {
    for (let i = 0; i < tries; i++) {
      const m = inbox.find((x) => x.t === t && pred(x as Extract<ServerMsg, { t: T }>));
      if (m) return m as Extract<ServerMsg, { t: T }>;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`timed out waiting for ${t}`);
  };
  const welcome = await waitFor("welcome");
  const client = () => game.hubs.get(welcome.room.id)!.clients.get(welcome.you)!;
  return { ws, inbox, waitFor, welcome, client, send: (m: object) => ws.send(JSON.stringify(m)) };
}

describe("Downtown", () => {
  it("only lets you gamble inside the Lucky Lodge, within the limits", async () => {
    const a = await connect("Lucky");
    a.send({ t: "casino", game: "slots", bet: 5 });
    const far = await a.waitFor("casino");
    assert.equal(far.ok, false);
    const c = a.client();
    c.x = TOWN_PLACES.casino.x; c.z = TOWN_PLACES.casino.z;
    const before = c.record.coins;
    a.send({ t: "casino", game: "slots", bet: 500 });
    await a.waitFor("casino", (m) => m !== far && !m.ok && !!m.note?.includes("Bets"));
    a.send({ t: "casino", game: "slots", bet: 5 });
    const spin = await a.waitFor("casino", (m) => m.ok);
    assert.equal(c.record.coins, before + (spin.delta ?? 0));
    a.ws.close();
  });

  it("seats two beavers on the estate lawn at one table and never leaks a secret", async () => {
    const a = await connect("Sleuth");
    const b = await connect("Snoop");
    for (const p of [a, b]) {
      const c = p.client();
      c.x = TOWN_PLACES.estategate.x; c.z = TOWN_PLACES.estategate.z;
      p.send({ t: "estate", enter: true });
      await p.waitFor("estate");
      assert.equal(c.estate, true);
    }
    // They can see each other on the lawn.
    await a.waitFor("joined", (m) => m.p.name === "Snoop");
    a.send({ t: "boardQueue", game: "guesswho" });
    const lobby = await a.waitFor("queue", (m) => !!m.lobby);
    assert.equal(lobby.lobby!.kind, "board");
    // Snoop sees the open table, and joins it: two is a full guess-who table, so it starts.
    const open = await b.waitFor("lobbies", (m) => m.list.some((l) => l.game === "guesswho"));
    b.send({ t: "lobbyJoin", key: open.list[0].key });
    const first = await a.waitFor("board", () => true, 400);
    const theirs = await b.waitFor("board", () => true, 400);
    assert.equal(first.v.seats.length, 2);
    assert.ok(first.v.seats.every((s) => !s.isBot), "online tables are real players only");
    assert.notEqual(first.v.you, theirs.v.you);
    assert.equal(first.v.guesswho!.reveal, null);
    assert.ok(!JSON.stringify([...a.inbox, ...b.inbox].filter((m) => m.t === "board")).includes("secret"));
    const mover = first.v.turn === first.v.you ? a : b;
    mover.send({ t: "boardAct", a: { kind: "ask", q: "hat" } });
    await a.waitFor("board", (m) => m.v.rev > first.v.rev);
    // Garbage actions are ignored, not fatal.
    mover.send({ t: "boardAct", a: { kind: "ask", q: { evil: true } } });
    mover.send({ t: "boardAct", a: null });
    a.send({ t: "boardQuit" });
    await a.waitFor("boardEnd");
    const end = await b.waitFor("boardEnd");
    assert.equal(end.v.winner, end.v.you, "the beaver who stays wins");
    a.send({ t: "estate", enter: false });
    await a.waitFor("welcome", (m) => m !== a.welcome);
    a.ws.close();
    b.ws.close();
  });
});
