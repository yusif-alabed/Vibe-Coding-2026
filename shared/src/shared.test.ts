import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ChatRateLimiter,
  CHAT,
  BRIDGE,
  coinsForRace,
  filterChat,
  HUB,
  HUB_COLLIDERS,
  purchase,
  sanitizeLook,
  STARTER_ITEMS,
  TobogganRace,
  TRACK,
  validateMove,
} from "./index";

describe("rewards", () => {
  it("pays participation plus a place bonus for finishers", () => {
    assert.equal(coinsForRace({ place: 1, finished: true, racers: 4 }), 50);
    assert.equal(coinsForRace({ place: 2, finished: true, racers: 4 }), 35);
    assert.equal(coinsForRace({ place: 4, finished: true, racers: 4 }), 15);
  });
  it("doesn't pay a winner's bonus for racing on your own", () => {
    assert.equal(coinsForRace({ place: 1, finished: true, racers: 1 }), 25);
    assert.equal(coinsForRace({ place: 1, finished: true, racers: 2 }), 50);
  });
  it("pays only participation if you did not finish", () => {
    assert.equal(coinsForRace({ place: 1, finished: false, racers: 4 }), 10);
  });
  it("rejects impossible places", () => {
    assert.equal(coinsForRace({ place: 0, finished: true, racers: 4 }), 0);
    assert.equal(coinsForRace({ place: 5, finished: true, racers: 4 }), 0);
  });
});

describe("shop & inventory", () => {
  const wallet = { coins: 100, owned: [...STARTER_ITEMS] };
  it("buys an item and deducts coins without mutating the original", () => {
    const r = purchase(wallet, "hat_toque_teal");
    assert.ok(r.ok);
    if (r.ok) {
      assert.equal(r.wallet.coins, 40);
      assert.ok(r.wallet.owned.includes("hat_toque_teal"));
    }
    assert.equal(wallet.coins, 100);
  });
  it("refuses when too poor, already owned, or unknown", () => {
    assert.deepEqual(purchase(wallet, "hat_crown"), { ok: false, reason: "not_enough_coins" });
    assert.deepEqual(purchase(wallet, "hat_toque_red"), { ok: false, reason: "already_owned" });
    assert.deepEqual(purchase(wallet, "free_money"), { ok: false, reason: "unknown_item" });
  });
  it("strips unowned or wrong-slot items from a look", () => {
    const look = sanitizeLook({ fur: "#123456", hat: "hat_crown", scarf: "hat_toque_red" }, STARTER_ITEMS, "#000000");
    assert.deepEqual(look, { fur: "#123456", hat: null, scarf: null, backpack: null, trail: null });
    assert.equal(sanitizeLook({ fur: "red; drop table" }, [], "#8a5a3b").fur, "#8a5a3b");
  });
});

describe("chat safety", () => {
  it("stars out blocked words, including disguised ones", () => {
    const r = filterChat("you are so stup1d lol");
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.text, "you are so ★★★★★★ lol");
  });
  it("leaves friendly messages alone", () => {
    const r = filterChat("Race you to the lodge!");
    assert.ok(r.ok);
    if (r.ok) assert.equal(r.text, "Race you to the lodge!");
  });
  it("blocks personal info", () => {
    assert.equal(filterChat("email me at kid@example.com").ok, false);
    assert.equal(filterChat("call 050 123 4567").ok, false);
    assert.equal(filterChat("go to www.example.com").ok, false);
  });
  it("rejects empty and over-long messages", () => {
    assert.equal(filterChat("   ").ok, false);
    assert.equal(filterChat("a".repeat(CHAT.maxLength + 1)).ok, false);
  });
  it("rate limits bursts and refills over time", () => {
    const rl = new ChatRateLimiter(0);
    for (let i = 0; i < CHAT.burst; i++) assert.equal(rl.allow(`msg ${i}`, 0), true);
    assert.equal(rl.allow("one more", 0), false);
    assert.equal(rl.allow("later", CHAT.refillMs), true);
  });
  it("blocks repeated identical messages", () => {
    const rl = new ChatRateLimiter(0);
    assert.equal(rl.allow("hello", 0), true);
    assert.equal(rl.allow("HELLO", 100), false);
    assert.equal(rl.allow("hello", CHAT.duplicateWindowMs + 100), true);
  });
});

describe("movement validation", () => {
  it("caps speed", () => {
    const p = validateMove({ x: 0, z: 10 }, { x: 100, z: 10 }, 100);
    assert.ok(p.x < HUB.maxSpeed * HUB.speedTolerance * 0.1 + 0.1);
  });
  it("keeps players inside the world", () => {
    const p = validateMove({ x: HUB.radius - 0.5, z: 0 }, { x: HUB.radius + 0.5, z: 0 }, 1000);
    assert.ok(Math.hypot(p.x, p.z) <= HUB.radius + 1e-9);
  });
  it("pushes players out of buildings", () => {
    const p = validateMove({ x: 0, z: 4.5 }, { x: 0, z: 2.5 }, 1000);
    assert.ok(Math.hypot(p.x, p.z) >= 3.9 - 1e-9);
  });
  it("keeps solid scenery such as benches, trees and rocks non-pass-through", () => {
    assert.ok(HUB_COLLIDERS.length > 70, "every generated solid is registered");
    const bench = validateMove({ x: -15, z: -6.5 }, { x: -15, z: -6.5 }, 100);
    assert.ok(Math.hypot(bench.x - -15, bench.z - -6.5) >= 1.64);
    const rock = HUB_COLLIDERS.find((c) => c.r > 0.9 && c.r < 2 && Math.hypot(c.x, c.z) > 20);
    assert.ok(rock, "world rock registered");
    if (rock) {
      const p = validateMove({ x: rock.x + rock.r + 1, z: rock.z }, { x: rock.x, z: rock.z }, 1000);
      assert.ok(Math.hypot(p.x - rock.x, p.z - rock.z) >= rock.r - 1e-9);
    }
  });
  it("keeps bridge rails solid while leaving the bridge deck walkable", () => {
    const x = BRIDGE.x + 1.9 * Math.cos(BRIDGE.ry);
    const z = BRIDGE.z - 1.9 * Math.sin(BRIDGE.ry);
    const rail = HUB_COLLIDERS.find((c) => Math.hypot(c.x - x, c.z - z) < 0.01);
    assert.ok(rail, "bridge rail registered as solid");
    if (rail) {
      const p = validateMove({ x: rail.x - 1, z: rail.z }, { x: rail.x, z: rail.z }, 1000);
      assert.ok(Math.hypot(p.x - rail.x, p.z - rail.z) >= rail.r - 1e-9);
    }
  });
  it("ignores NaN input", () => {
    assert.deepEqual(validateMove({ x: 1, z: 2 }, { x: NaN, z: 0 }, 100), { x: 1, z: 2 });
  });
});

describe("toboggan race", () => {
  const entrants = [
    { id: "a", name: "A", isBot: false },
    { id: "b", name: "B", isBot: true },
    { id: "c", name: "C", isBot: true },
    { id: "d", name: "D", isBot: true },
  ];
  it("is deterministic for the same seed and inputs", () => {
    const run = () => {
      const race = new TobogganRace(42, entrants);
      while (!race.isOver()) race.step(1 / 20, { a: Math.sin(race.t) });
      return race.results();
    };
    assert.deepEqual(run(), run());
  });
  it("finishes within the time limit and ranks everyone uniquely", () => {
    for (const seed of [1, 7, 99, 12345]) {
      const race = new TobogganRace(seed, entrants);
      while (!race.isOver()) race.step(1 / 20, {});
      const res = race.results();
      assert.deepEqual(res.map((r) => r.place), [1, 2, 3, 4]);
      assert.ok(res.filter((r) => r.isBot).every((r) => r.finished), `bots finish (seed ${seed})`);
      assert.ok(race.t < 60);
    }
  });
  it("clamps cheating steer input", () => {
    const race = new TobogganRace(1, entrants);
    for (let i = 0; i < 40; i++) race.step(1 / 20, { a: 9999 });
    assert.ok(Math.abs(race.racers[0].x) <= TRACK.halfWidth);
    assert.ok(race.racers[0].steer <= 1);
  });
});
