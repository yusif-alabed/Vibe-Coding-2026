import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { fish, harvest, plant, sell, talk, water, journalOf, lifeEvent, NPC_BY_ID, TOWN_PLACES, HUB_PLACES } from "./index";
import { GOLF_HOLES, GolfMatch, simulateShot, planShot, surfaceAt, golfCoins } from "./golf";
import { makeSim, weekKey } from "./minigames";
import { mulberry32 } from "./rng";
import { recordBest, leaderRows, handleLife } from "./services";

const rec = () => ({ coins: 100, owned: [] as string[], furniture: {} as Record<string, number> });

describe("village life", () => {
  it("fishing needs water and fills the journal and bag", () => {
    const r = rec();
    assert.equal(fish(r, 0, 0, 1e12).ok, false);
    const out = fish(r, HUB_PLACES.lake.x + 20, HUB_PLACES.lake.z, 1e12, mulberry32(3));
    assert.equal(out.ok, true);
    const id = out.catch!.fish;
    assert.equal(r.bag?.[id], 1);
    assert.equal(journalOf(r).fish[id], 1);
    // Cooldown stops spamming.
    assert.equal(fish(r, HUB_PLACES.lake.x + 20, HUB_PLACES.lake.z, 1e12 + 100).ok, false);
  });

  it("gardens grow, water speeds them up, and harvests can be sold", () => {
    const r = rec();
    const g = TOWN_PLACES.garden;
    assert.equal(plant(r, 0, "carrot", g.x, g.z, 0).ok, true);
    assert.equal(r.coins, 95);
    assert.equal(harvest(r, 0, g.x, g.z, 60_000).ok, false);
    assert.equal(water(r, 0, g.x, g.z).ok, true);
    assert.equal(harvest(r, 0, g.x, g.z, 3 * 60_000 * 0.6 + 1).ok, true);
    assert.equal(r.bag?.carrot, 3);
    const s = sell(r, "carrot", 3);
    assert.equal(s.ok, true);
    assert.equal(r.coins, 95 + 12);
  });

  it("townsfolk quest chains advance and pay out", () => {
    const r = rec();
    const gus = NPC_BY_ID.gus;
    const first = talk(r, "gus", gus.x, gus.z);
    assert.equal(first.ok, true);
    assert.equal(r.npcs?.gus.step, 0);
    for (let i = 0; i < 3; i++) lifeEvent(r, { kind: "catch", fish: "trout" });
    assert.equal(r.npcs?.gus.step, 1);
    lifeEvent(r, { kind: "race", game: "canoe" });
    assert.equal(r.npcs?.gus.step, 2);
    r.bag = { bottle: 1 };
    const done = talk(r, "gus", gus.x, gus.z);
    assert.equal(r.npcs?.gus.done, true);
    assert.ok(done.gifts?.includes("pet_duckling"));
    assert.ok(r.owned.includes("pet_duckling"));
  });

  it("handleLife ignores unrelated messages", () => {
    assert.equal(handleLife({ ...rec(), cabin: [] }, "k", { t: "ping" }, 0, 0), null);
  });
});

describe("golf", () => {
  it("has nine holes with sensible pars", () => {
    assert.equal(GOLF_HOLES.length, 9);
    assert.equal(GOLF_HOLES.reduce((s, h) => s + h.par, 0), 35);
    for (const h of GOLF_HOLES) assert.equal(surfaceAt(h, h.pin[0], h.pin[1]), "green");
  });

  it("is deterministic and the putter can sink a short putt", () => {
    const h = GOLF_HOLES[0];
    const a = simulateShot(h, [0, 0], 0.05, 0.8, "driver");
    const b = simulateShot(h, [0, 0], 0.05, 0.8, "driver");
    assert.deepEqual(a.end, b.end);
    assert.ok(a.end[1] > 40, "a driver goes a fair way");
    const near: [number, number] = [h.pin[0], h.pin[1] - 2];
    let holed = false;
    for (let p = 0.05; p <= 0.6 && !holed; p += 0.01) holed = simulateShot(h, near, 0, p, "putter").holed;
    assert.ok(holed, "some putt from 2 m drops");
  });

  it("bots can finish every hole, and quitting keeps your coins", () => {
    const m = new GolfMatch(9, [{ id: "a", name: "A", isBot: true }, { id: "b", name: "B", isBot: true }], 7);
    let now = 0;
    for (let i = 0; i < 20000 && !m.over; i++) { now += 250; m.botTurns(now); m.advance(now); }
    assert.equal(m.over, true);
    const t = m.totals();
    assert.ok(t.every((x) => x.holes === 9));
    assert.ok(t.every((x) => x.total <= 9 * 10));
    const m2 = new GolfMatch(3, [{ id: "me", name: "Me", isBot: false }], 1);
    m2.quit("me", 0);
    assert.equal(m2.over, true);
    assert.equal(golfCoins(0, 0, true), 0);
    assert.ok(golfCoins(3, 1, false) > golfCoins(3, 1, true));
    const plan = planShot(GOLF_HOLES[3], GOLF_HOLES[3].tee, 1, mulberry32(1));
    assert.ok(plan.power > 0 && plan.power <= 1);
  });
});

describe("minigames", () => {
  it("every arcade game finishes with ranked results", () => {
    for (const g of ["hunt", "logroll", "snowball", "dam"] as const) {
      const sim = makeSim(g, 5, [{ id: "p", name: "P", isBot: false }, { id: "b1", name: "B1", isBot: true }, { id: "b2", name: "B2", isBot: true }, { id: "b3", name: "B3", isBot: true }]);
      let n = 0;
      while (!sim.isOver() && n++ < 20 * 120) sim.step(1 / 20, { p: { steer: Math.sin(n / 10), fwd: 0.5, press: n % 7 === 0 } });
      assert.ok(sim.isOver(), `${g} ends`);
      const res = sim.results();
      assert.equal(res.length, 4);
      assert.deepEqual(res.map((r) => r.place), [1, 2, 3, 4]);
    }
  });

  it("weekly bests and leaderboards", () => {
    const r = { ...rec(), cabin: [] };
    const now = Date.UTC(2026, 9, 21);
    assert.equal(recordBest(r, "hunt", 10, now), true);
    assert.equal(recordBest(r, "hunt", 8, now), false);
    assert.equal(recordBest(r, "golf", 3, now), true);
    assert.equal(recordBest(r, "golf", 1, now), true, "lower is better in golf");
    const rows = leaderRows([{ name: "A", best: r.bests!.hunt }, { name: "B", best: { week: weekKey(now), score: 12 } }], "hunt", now);
    assert.deepEqual(rows.map((x) => x.name), ["B", "A"]);
  });
});
