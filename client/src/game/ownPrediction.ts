import { predictWalk, walkRule, type InputSample, type ServerSpot, type WalkRule } from "@beaver/shared";

/**
 * Keeps your own character responsive in the walking minigames (see arcadePredict.ts in shared/):
 * remembers the steering we have been sending and the server's last word about where we are, and
 * says where to draw ourselves right now. Returns null when it shouldn't guess (solo play, a game
 * it doesn't know, or a ping so low there's nothing to hide), in which case the scene just follows
 * the server as before.
 */
export class OwnPrediction {
  private log: InputSample[] = [];
  private srv: ServerSpot | null = null;
  private readonly rule: WalkRule | null;

  constructor(game: string) {
    this.rule = walkRule(game);
  }

  /** The steering we are sending this frame. */
  note(steer: number, fwd: number, now: number) {
    if (!this.rule) return;
    this.log.push({ t: now, steer, fwd });
    while (this.log.length > 2 && this.log[1].t < now - 1500) this.log.shift();
  }

  /** The server's latest word about our own character. */
  server(x: number, z: number, now = performance.now()) {
    this.srv = { x, z, at: now };
  }

  /** Where to draw ourselves, or null to follow the server. `mirror` is snowball's second team. */
  at(now: number, rtt: number | null | undefined, mirror = false): { x: number; z: number } | null {
    if (!this.rule || !this.srv || !rtt || rtt < 25) return null;
    return predictWalk(this.rule, this.srv, this.log, now, Math.min(rtt, 500), mirror);
  }
}
