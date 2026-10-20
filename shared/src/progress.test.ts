import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  applyQuestEvent,
  buyFurniture,
  collectPinecone,
  DAILY_BONUS,
  ensureDay,
  newProgress,
  pickDailyQuests,
  pineconeSpots,
  PINECONE_COINS,
  QUEST_BY_ID,
  questEvent,
  STARTER_FURNITURE,
  STARTER_LAYOUT,
  validateLayout,
  visitedPlace,
  HUB_PLACES,
  HUB_COLLIDERS,
  type ProgressRecord,
} from "./index";

const DAY = Date.UTC(2026, 9, 20, 12);

describe("daily quests", () => {
  it("picks three different kinds, the same for the same player and day", () => {
    const a = pickDailyQuests("2026-10-20", "player-a");
    assert.equal(a.length, 3);
    assert.deepEqual(a, pickDailyQuests("2026-10-20", "player-a"));
    const kinds = a.map((q) => QUEST_BY_ID[q.id].kind);
    assert.equal(new Set(kinds).size, 3);
    const other = ["player-b", "player-c", "player-d"].map((k) => pickDailyQuests("2026-10-20", k).map((q) => q.id).join());
    assert.ok(other.some((o) => o !== a.map((q) => q.id).join()), "players get different quests");
  });
  it("resets on a new day", () => {
    const q = ensureDay(undefined, "p", DAY);
    q.list[0].progress = 1;
    assert.equal(ensureDay(q, "p", DAY), q);
    const next = ensureDay(q, "p", DAY + 86_400_000);
    assert.notEqual(next.day, q.day);
    assert.ok(next.list.every((s) => s.progress === 0));
  });
  it("counts progress, pays rewards once, and pays the all-done bonus", () => {
    const q = { day: "d", bonus: false, list: [{ id: "emote_3", progress: 0, done: false }, { id: "photo", progress: 0, done: false }, { id: "visit_dock", progress: 0, done: false }] };
    assert.equal(applyQuestEvent(q, { kind: "emote" }).coins, 0);
    applyQuestEvent(q, { kind: "emote" });
    assert.equal(applyQuestEvent(q, { kind: "emote" }).coins, QUEST_BY_ID.emote_3.reward);
    assert.equal(applyQuestEvent(q, { kind: "emote" }).changed, false, "a finished quest stops counting");
    assert.equal(applyQuestEvent(q, { kind: "visit", place: "lodge" }).changed, false, "wrong place doesn't count");
    applyQuestEvent(q, { kind: "photo" });
    const last = applyQuestEvent(q, { kind: "visit", place: "dock" });
    assert.equal(last.coins, QUEST_BY_ID.visit_dock.reward + DAILY_BONUS);
    assert.equal(last.bonus, true);
  });
  it("adds quest coins to the player's balance", () => {
    const rec: ProgressRecord = { coins: 10, ...newProgress(), quests: { day: new Date(DAY).toISOString().slice(0, 10), bonus: false, list: [{ id: "photo", progress: 0, done: false }] } };
    const w = questEvent(rec, "p", { kind: "photo" }, DAY);
    assert.ok(w && w.justCompleted?.length === 1);
    assert.equal(rec.coins, 10 + QUEST_BY_ID.photo.reward + DAILY_BONUS);
  });
  it("recognises landmark visits", () => {
    assert.equal(visitedPlace(HUB_PLACES.dock.x, HUB_PLACES.dock.z), "dock");
    assert.equal(visitedPlace(0, 9), null);
  });
});

describe("golden pinecones", () => {
  it("places a dozen reachable pinecones away from solid things", () => {
    const spots = pineconeSpots("2026-10-20");
    assert.equal(spots.length, 12);
    for (const s of spots) assert.ok(!HUB_COLLIDERS.some((c) => Math.hypot(c.x - s.x, c.z - s.z) < c.r + 1.2));
    assert.deepEqual(spots, pineconeSpots("2026-10-20"));
    assert.notDeepEqual(spots, pineconeSpots("2026-10-21"));
  });
  it("only lets you pick one up when standing next to it, once", () => {
    const rec: ProgressRecord = { coins: 0, ...newProgress() };
    const s = pineconeSpots(new Date(DAY).toISOString().slice(0, 10))[0];
    assert.deepEqual(collectPinecone(rec, "p", s.id, s.x + 10, s.z, DAY), { ok: false, reason: "too_far" });
    const ok = collectPinecone(rec, "p", s.id, s.x + 1, s.z, DAY);
    assert.equal(ok.ok, true);
    assert.equal(rec.coins >= PINECONE_COINS, true);
    assert.deepEqual(collectPinecone(rec, "p", s.id, s.x, s.z, DAY), { ok: false, reason: "already" });
  });
});

describe("cabin decorating", () => {
  it("accepts the starter layout", () => {
    assert.equal(validateLayout(STARTER_LAYOUT, STARTER_FURNITURE).ok, true);
  });
  it("lets furniture stand on rugs but not on other furniture", () => {
    const counts = { rug_round: 1, chair: 2 };
    assert.equal(validateLayout([{ id: "rug_round", x: 1, z: 1, rot: 0 }, { id: "chair", x: 1, z: 1, rot: 0 }], counts).ok, true);
    const r = validateLayout([{ id: "chair", x: 1, z: 1, rot: 0 }, { id: "chair", x: 1, z: 1, rot: 0 }], counts);
    assert.equal(r.ok, false);
  });
  it("rejects items outside the room, on the fireplace, or that you don't own", () => {
    assert.equal(validateLayout([{ id: "sofa", x: 9, z: 0, rot: 0 }], { sofa: 1 }).ok, false);
    assert.equal(validateLayout([{ id: "sofa", x: 9, z: 0, rot: 1 }], { sofa: 1 }).ok, true, "rotated sofa fits along the wall");
    assert.equal(validateLayout([{ id: "chair", x: 4, z: 0, rot: 0 }], { chair: 1 }).ok, false);
    assert.equal(validateLayout([{ id: "bed", x: 0, z: 0, rot: 0 }], {}).ok, false);
    assert.equal(validateLayout([{ id: "chair", x: 0.5, z: 0, rot: 0 }], { chair: 1 }).ok, false);
    assert.equal(validateLayout("nope", {}).ok, false);
  });
  it("sells furniture for coins, more than one of each", () => {
    let coins = 50, counts: Record<string, number> = {};
    for (let i = 0; i < 2; i++) {
      const r = buyFurniture(coins, counts, "chair");
      assert.ok(r.ok);
      if (r.ok) ({ coins, counts } = r);
    }
    assert.equal(coins, 10);
    assert.equal(counts.chair, 2);
    assert.deepEqual(buyFurniture(coins, counts, "bed"), { ok: false, reason: "not_enough_coins" });
  });
});
