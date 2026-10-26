import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { makeSim } from "./minigames";
import { MoveReconciler } from "./reconcile";
import { predictLateral } from "./racePredict";
import { validateMove } from "./movement";

describe("MoveReconciler", () => {
  it("never complains about a server that agrees, however far we have walked since", () => {
    const rec = new MoveReconciler();
    // We send 20 moves of 0.4 units, and the server's answers arrive 10 moves late.
    const sent: { n: number; x: number }[] = [];
    let x = 0, worstFalseGap = 0;
    for (let i = 0; i < 20; i++) { x += 0.4; sent.push({ n: rec.record(x, 0), x }); }
    for (let i = 0; i < 10; i++) {
      const s = sent[i];
      worstFalseGap = Math.max(worstFalseGap, Math.abs(x - s.x)); // what the old "compare with now" rule would see
      assert.equal(rec.ack(s.n, s.x, 0), null);
    }
    assert.ok(worstFalseGap > 3, "the old rule would have snapped back here");
    assert.equal(rec.fixes, 0);
  });

  it("moves us by exactly what the server changed, once, even with moves in flight", () => {
    const rec = new MoveReconciler();
    // A wall at x = 5: we keep walking into it; the server clamps every move to 5.
    const ns: number[] = [];
    let x = 4.6, shifted = 0;
    for (let i = 0; i < 6; i++) { x += 0.2; ns.push(rec.record(x, 0)); }
    // answers for moves 1..6 arrive in order, each clamped at 5
    for (let i = 0; i < 6; i++) {
      const proposed = 4.8 + 0.2 * i;
      const fix = rec.ack(ns[i], Math.min(5, proposed), 0);
      if (fix) shifted += fix.dx;
    }
    // we ended at 5.8 proposed; the server says 5.0: total shift must be -0.8, not more
    assert.ok(Math.abs(shifted - (5 - 5.8)) < 1e-9, `shifted ${shifted}`);
  });

  it("ignores answers it can't place", () => {
    const rec = new MoveReconciler();
    assert.equal(rec.ack(99, 5, 5), null);
  });

  it("agrees with the real server rules while walking into a building (no false fixes)", () => {
    const rec = new MoveReconciler();
    let me = { x: -10, z: 0 };
    let srv = { x: -10, z: 0 };
    const queue: { n: number; px: number; pz: number }[] = [];
    for (let step = 0; step < 200; step++) {
      const next = validateMove(me, { x: me.x + 0.15, z: me.z }, 1000 / 60 * 3);
      me = next;
      queue.push({ n: rec.record(me.x, me.z), px: me.x, pz: me.z });
      if (queue.length > 6) { // answers arrive 6 moves late
        const q = queue.shift()!;
        srv = validateMove(srv, { x: q.px, z: q.pz }, 1500);
        const fix = rec.ack(q.n, srv.x, srv.z);
        if (fix) { me = { x: me.x + fix.dx, z: me.z + fix.dz }; }
      }
    }
    assert.equal(rec.fixes, 0);
  });
});

describe("predictLateral", () => {
  function run(rtt: number) {
    const sim = makeSim("toboggan", 7, [{ id: "me", name: "me", isBot: false }]) as unknown as { race: { layout: { obstacles: unknown[] } } } & ReturnType<typeof makeSim>;
    const ideal = makeSim("toboggan", 7, [{ id: "me", name: "me", isBot: false }]) as typeof sim;
    sim.race.layout.obstacles = []; ideal.race.layout.obstacles = [];
    const DT = 1 / 20, up = rtt / 2, down = rtt / 2;
    const u = (t: number) => (Math.sin(t * 1.7) > 0.3 ? 1 : Math.sin(t * 1.7) < -0.3 ? -1 : 0);
    const inp = (v: number) => ({ me: { steer: v, fwd: 0, press: false } });
    const log: { t: number; v: number }[] = [];
    const snaps: { arrive: number; x: number; steer: number; stun: boolean }[] = [];
    let errStale = 0, errPred = 0, n = 0;
    for (let step = 0; step < 20 * 30; step++) {
      const tNow = step * DT * 1000;
      sim.step(DT, inp(u((tNow - up) / 1000)));
      ideal.step(DT, inp(u(tNow / 1000)));
      const s = (sim.snapshot() as { x: number; steer: number; stun: boolean }[])[0];
      snaps.push({ arrive: tNow + down, x: s.x, steer: s.steer, stun: s.stun });
      log.push({ t: tNow, v: u(tNow / 1000) });
      const got = snaps.filter((q) => q.arrive <= tNow).at(-1);
      if (!got || tNow < 3000) continue;
      const idealX = (ideal.snapshot() as { x: number }[])[0].x;
      const pred = predictLateral({ x: got.x, steer: got.steer, stun: got.stun, at: got.arrive }, log, tNow, rtt);
      errStale += Math.abs(got.x - idealX); errPred += Math.abs(pred - idealX); n++;
    }
    return { stale: errStale / n, pred: errPred / n };
  }

  it("keeps your sled where your fingers put it, at pings from 60 to 300 ms", () => {
    for (const rtt of [60, 130, 200, 300]) {
      const { stale, pred } = run(rtt);
      assert.ok(pred < 0.4, `rtt ${rtt}: predicted error ${pred.toFixed(2)} units`);
      assert.ok(pred < stale * 0.6, `rtt ${rtt}: prediction (${pred.toFixed(2)}) should beat the stale picture (${stale.toFixed(2)})`);
    }
  });

  it("does not steer a stunned sled", () => {
    assert.equal(predictLateral({ x: 2, steer: 0, stun: true, at: 1000 }, [{ t: 1000, v: 1 }], 1200, 150), 2);
  });
});
