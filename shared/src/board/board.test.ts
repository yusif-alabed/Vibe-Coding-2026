import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BoardMatch, BOARD_INFO, type BoardGame,
  chessStart, legalChess, playChess,
  checkersStart, legalCheckers, playCheckers,
  casinoPlay, CASINO, type CasinoRecord,
  makeSim, mulberry32,
} from "../index";

describe("chess", () => {
  it("has 20 legal opening moves", () => assert.equal(legalChess(chessStart()).length, 20));
  it("accepts a promotion choice on an ordinary move", () => {
    assert.ok(playChess(chessStart(), { from: 12, to: 28, promo: "q" }));
  });
  it("spots fool's mate", () => {
    let s = chessStart();
    const sq = (n: string) => (Number(n[1]) - 1) * 8 + n.charCodeAt(0) - 97;
    for (const [a, b] of [["f2", "f3"], ["e7", "e5"], ["g2", "g4"], ["d8", "h4"]]) s = playChess(s, { from: sq(a), to: sq(b) })!;
    assert.equal(s.result, "b");
  });
});

describe("checkers", () => {
  it("forces a capture when one is available", () => {
    const s = checkersStart();
    s.board.fill("");
    s.board[18] = "r"; s.board[27] = "b"; s.board[0] = "r";
    const m = legalCheckers(s);
    assert.ok(m.length > 0 && m.every((x) => x.from === 18 && x.to === 36));
    const n = playCheckers(s, m[0])!;
    assert.equal(n.board[27], "");
  });
});

describe("board tables", () => {
  const all: [BoardGame, number][] = [["chess", 2], ["checkers", 2], ["guesswho", 2], ["mystery", 4], ["tycoon", 3]];
  for (const [game, n] of all) {
    it(`${BOARD_INFO[game].name} finishes with bots`, () => {
      const seats = Array.from({ length: n }, (_, i) => ({ id: `b${i}`, name: `Bot ${i}`, isBot: true }));
      const m = new BoardMatch(game, 7, seats, 0);
      let t = 0;
      while (!m.over && t < 5_000_000) { t += 2000; m.botTurns(t); }
      assert.ok(m.over, `${game} never finished`);
      assert.equal(m.payouts().length, n);
    });
  }
  it("never shows a seat the other player's secret beaver", () => {
    const m = new BoardMatch("guesswho", 3, [{ id: "a", name: "A", isBot: false }, { id: "b", name: "B", isBot: true }], 0);
    const v = m.view(0);
    assert.equal(v.guesswho!.reveal, null);
    assert.ok(!JSON.stringify(v).includes('"secret"'));
  });
  it("hides mystery cards shown to someone else", () => {
    const m = new BoardMatch("mystery", 5, [0, 1, 2].map((i) => ({ id: `${i}`, name: `${i}`, isBot: true })), 0);
    let t = 0;
    while (!m.view(1).mystery!.log.some((l) => l.to !== undefined) && t < 1e6) { t += 2000; m.botTurns(t); }
    for (const l of m.view(1).mystery!.log) if (l.seat !== 1) assert.equal(l.card, undefined);
    assert.equal(m.view(1).mystery!.answer, m.over ? m.view(1).mystery!.answer : null);
  });
});

describe("lucky lodge", () => {
  it("caps bets and daily losses", () => {
    const rec: CasinoRecord = { coins: 10_000 };
    assert.equal(casinoPlay(rec, "slots", 500, {}, Math.random).ok, false);
    const rand = () => 0.999; // always the worst roulette pick for red
    let n = 0;
    while (casinoPlay(rec, "roulette", 25, { choice: 0 }, rand).ok) n++;
    assert.ok(rec.casino!.net >= -CASINO.dailyLoss);
    assert.ok(n <= CASINO.dailyLoss / 25);
  });
  it("plays a hand of blackjack to the end", () => {
    const rec: CasinoRecord = { coins: 100 };
    const rand = mulberry32(9);
    let r = casinoPlay(rec, "blackjack", 10, { action: "deal" }, rand);
    assert.ok(r.ok);
    if (rec.blackjack && !rec.blackjack.done) r = casinoPlay(rec, "blackjack", 10, { action: "stand" }, rand);
    assert.ok(rec.blackjack?.done);
  });
});

describe("new arcade games", () => {
  for (const g of ["spleef", "td", "volley", "hoops", "penalty", "shadowbox"] as const) {
    it(`${g} runs to the end with bots`, () => {
      const sim = makeSim(g, 11, [0, 1, 2, 3].map((i) => ({ id: `p${i}`, name: `P${i}`, isBot: true })));
      let steps = 0;
      while (!sim.isOver() && steps < 60 * 400) { sim.step(1 / 30, {}); steps++; }
      assert.ok(sim.isOver(), `${g} never ended`);
      assert.equal(sim.results().length, 4);
      JSON.stringify(sim.snapshot());
    });
  }
});
