import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import WebSocket from "ws";
import { DEFAULT_LOOK, TOWN_PLACES, type ServerMsg } from "@beaver/shared";
import { GameServer } from "../server";

/**
 * The Word Lodge, against a live server.
 *
 * On its own server instance rather than sharing `server.test.ts`'s: a round at the Lodge pays
 * coins and ticks daily quests, which leaks into any test that asserts on a wallet balance.
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
  /** Polls the inbox. The default budget clears the Lodge's queue wait with room to spare. */
  const waitFor = async <T extends ServerMsg["t"]>(t: T, pred: (m: Extract<ServerMsg, { t: T }>) => boolean = () => true, ms = 12000) => {
    for (let i = 0; i < ms / 20; i++) {
      const m = inbox.find((x) => x.t === t && pred(x as Extract<ServerMsg, { t: T }>));
      if (m) return m as Extract<ServerMsg, { t: T }>;
      await new Promise((r) => setTimeout(r, 20));
    }
    throw new Error(`timed out waiting for ${t}`);
  };
  const welcome = await waitFor("welcome", () => true, 2000);
  /** Stand at the Lodge door: the server checks where you are before it lets you in. */
  const goToLodge = () => {
    const c = game.hubs.get(welcome.room.id)!.clients.get(welcome.you)!;
    c.x = TOWN_PLACES.wordlodge.x;
    c.z = TOWN_PLACES.wordlodge.z;
  };
  return { ws, inbox, waitFor, welcome, goToLodge, send: (m: object) => ws.send(JSON.stringify(m)) };
}

describe("the Word Lodge", () => {
  it("only starts a round at the Lodge, and fills the empty lecterns with bots", async () => {
    const a = await connect("Speller");
    a.send({ t: "queueWord", game: "wordle" });
    await a.waitFor("error", (m) => /Library Lane/.test(m.text), 2000);

    a.goToLodge();
    a.send({ t: "queueWord", game: "wordle" });
    const start = await a.waitFor("wordStart");
    assert.equal(start.game, "wordle");
    assert.equal(start.setup.length, 5);
    assert.equal(start.setup.tries, 6);
    assert.ok(start.rivals.length >= 2, "a word game needs opponents");
    assert.ok(start.rivals.some((r) => r.isBot), "empty lecterns get bots");
    assert.deepEqual(start.you.rows, [], "you start with a blank board");
    a.send({ t: "wordQuit" });
    await a.waitFor("wordEnd");
    a.ws.close();
  });

  it("marks a guess and never lets a rival see the letters", async () => {
    const a = await connect("Guesser");
    a.goToLodge();
    a.send({ t: "queueWord", game: "wordle" });
    const start = await a.waitFor("wordStart");

    a.send({ t: "wordAct", a: { kind: "guess", word: "crane" } });
    const st = await a.waitFor("wordState", (m) => !!m.you && m.you.rows.length > 0, 3000);
    assert.deepEqual(st.you!.rows, ["crane"]);
    assert.match(st.you!.marks[0], /^[gyb]{5}$/);

    const mine = st.rivals.find((r) => r.id === a.welcome.you)!;
    assert.deepEqual(mine.marks, st.you!.marks, "your colours do go out to rivals");
    assert.ok(!JSON.stringify(st.rivals).includes("crane"), "but never your letters");
    // The answer must not be anywhere in what the server has said so far.
    assert.ok(!JSON.stringify([start, ...a.inbox]).includes('"answer"'), "the answer waits for the end");
    a.send({ t: "wordQuit" });
    await a.waitFor("wordEnd");
    a.ws.close();
  });

  it("refuses a non-word without spending a row", async () => {
    const a = await connect("Typo");
    a.goToLodge();
    a.send({ t: "queueWord", game: "wordle" });
    await a.waitFor("wordStart");
    a.send({ t: "wordAct", a: { kind: "guess", word: "zzzzz" } });
    const st = await a.waitFor("wordState", (m) => !!m.you?.note, 3000);
    assert.equal(st.you!.rows.length, 0, "a refused guess must not cost a row");
    assert.match(st.you!.note, /dictionary/i);
    a.send({ t: "wordQuit" });
    await a.waitFor("wordEnd");
    a.ws.close();
  });

  it("leaving reveals the answer, pays out, and stops the room", async () => {
    const a = await connect("Quitter");
    a.goToLodge();
    a.send({ t: "queueWord", game: "bee" });
    await a.waitFor("wordStart");
    a.send({ t: "wordQuit" });
    const end = await a.waitFor("wordEnd", () => true, 3000);
    assert.ok(end.answer.length > 0, "the answer is revealed once it can't be used");
    assert.ok(end.results.some((r) => r.id === a.welcome.you));
    assert.equal(game.words.size, 0, "the room must not outlive the last player in it");
    a.ws.close();
  });

  it("keeps a weekly board for each word game", async () => {
    const a = await connect("Record");
    a.send({ t: "leaderboard", game: "word:crossword" });
    const lb = await a.waitFor("leaderboard", (m) => m.game === "word:crossword", 3000);
    assert.ok(Array.isArray(lb.rows));
    a.ws.close();
  });

  it("a disconnect closes the round rather than leaving its clock running", async () => {
    const a = await connect("Vanisher");
    a.goToLodge();
    a.send({ t: "queueWord", game: "connections" });
    await a.waitFor("wordStart");
    assert.equal(game.words.size, 1);
    a.ws.close();
    for (let i = 0; i < 100 && game.words.size > 0; i++) await new Promise((r) => setTimeout(r, 20));
    assert.equal(game.words.size, 0, "a room with nobody in it must shut down");
  });
});
