/**
 * Judging the server's answers about where *we* are.
 *
 * Movement is client-led: we walk instantly and tell the server where we are, numbering each
 * update. The server answers with where it put us after update #n. That answer is always a
 * round trip old, so comparing it with where we are *now* looks like an error whenever we have
 * walked since (the more ping, the bigger the false error: that was the rubber-banding).
 *
 * Instead we remember where we were when we sent each update and compare the answer with that.
 * If they match, the server agreed and nothing happens. If they differ, the server really moved
 * us (a wall, the speed limit, a teleport) and we shift by exactly that difference, keeping
 * everything walked since.
 */
export interface Sent { n: number; x: number; z: number }

export class MoveReconciler {
  private seq = 0;
  private sent: Sent[] = [];
  /** How many times (and how far in total) the server has genuinely moved us. */
  fixes = 0;
  fixDist = 0;

  /** Call when sending a move; returns the number to put on the message. */
  record(x: number, z: number): number {
    const n = ++this.seq;
    this.sent.push({ n, x, z });
    if (this.sent.length > 80) this.sent.shift();
    return n;
  }

  /**
   * The server says we were at (x, z) after move #n. Returns how far to shift our position, or
   * null if the server agreed (or the answer is too old to judge).
   */
  ack(n: number, x: number, z: number): { dx: number; dz: number } | null {
    const i = this.sent.findIndex((s) => s.n === n);
    if (i < 0) return null;
    const s = this.sent[i];
    this.sent.splice(0, i); // everything older than this is settled
    const dx = x - s.x, dz = z - s.z;
    if (Math.hypot(dx, dz) < 0.25) return null;
    this.fixes++;
    this.fixDist += Math.hypot(dx, dz);
    // Moves already in flight were judged from the old path: keep our history on the corrected one.
    for (const e of this.sent) { e.x += dx; e.z += dz; }
    return { dx, dz };
  }
}
