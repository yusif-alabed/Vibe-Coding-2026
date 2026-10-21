/**
 * Checkers (American rules / English draughts): 8×8, pieces on dark squares, men move diagonally
 * forward, captures are compulsory and chain into multi-jumps, men crown on the far row and kings move
 * both ways. "r"/"R" (red man / king) moves up the board (rank increasing) and goes first; "b"/"B" is black.
 */

export type CSide = "r" | "b";
export interface CheckersState {
  board: string[];
  turn: CSide;
  /** A piece in the middle of a multi-jump must keep jumping. */
  chain: number;
  plies: number;
  quiet: number; // plies since a capture or a man moved
  result: null | CSide | "draw";
  last?: { from: number; to: number };
}
export interface CheckersMove { from: number; to: number }

const sideOf = (p: string): CSide | null => (p ? (p.toLowerCase() as CSide) : null);
const f = (sq: number) => sq & 7, r = (sq: number) => sq >> 3;
export const isDark = (sq: number) => (f(sq) + r(sq)) % 2 === 0;

export function checkersStart(): CheckersState {
  const board = Array(64).fill("");
  for (let sq = 0; sq < 64; sq++) {
    if (!isDark(sq)) continue;
    if (r(sq) < 3) board[sq] = "r";
    if (r(sq) > 4) board[sq] = "b";
  }
  return { board, turn: "r", chain: -1, plies: 0, quiet: 0, result: null };
}

function dirs(p: string): [number, number][] {
  if (p === p.toUpperCase()) return [[1, 1], [-1, 1], [1, -1], [-1, -1]];
  return p === "r" ? [[1, 1], [-1, 1]] : [[1, -1], [-1, -1]];
}

function jumpsFrom(s: CheckersState, sq: number): CheckersMove[] {
  const p = s.board[sq], out: CheckersMove[] = [];
  for (const [df, dr] of dirs(p)) {
    const mf = f(sq) + df, mr = r(sq) + dr, tf = f(sq) + 2 * df, tr = r(sq) + 2 * dr;
    if (tf < 0 || tf > 7 || tr < 0 || tr > 7) continue;
    const mid = s.board[mr * 8 + mf];
    if (mid && sideOf(mid) !== sideOf(p) && !s.board[tr * 8 + tf]) out.push({ from: sq, to: tr * 8 + tf });
  }
  return out;
}

export function legalCheckers(s: CheckersState): CheckersMove[] {
  if (s.result) return [];
  if (s.chain >= 0) return jumpsFrom(s, s.chain);
  const jumps: CheckersMove[] = [], steps: CheckersMove[] = [];
  for (let sq = 0; sq < 64; sq++) {
    const p = s.board[sq];
    if (!p || sideOf(p) !== s.turn) continue;
    jumps.push(...jumpsFrom(s, sq));
    for (const [df, dr] of dirs(p)) {
      const tf = f(sq) + df, tr = r(sq) + dr;
      if (tf >= 0 && tf < 8 && tr >= 0 && tr < 8 && !s.board[tr * 8 + tf]) steps.push({ from: sq, to: tr * 8 + tf });
    }
  }
  return jumps.length ? jumps : steps;
}

/** Plays one step (a move, or one hop of a jump). Returns null if illegal. */
export function playCheckers(s: CheckersState, m: CheckersMove): CheckersState | null {
  if (!legalCheckers(s).some((x) => x.from === m.from && x.to === m.to)) return null;
  const b = [...s.board];
  let p = b[m.from];
  const jump = Math.abs(r(m.to) - r(m.from)) === 2;
  b[m.to] = p; b[m.from] = "";
  if (jump) b[(m.from + m.to) / 2] = "";
  let crowned = false;
  if (p === "r" && r(m.to) === 7) { p = "R"; crowned = true; }
  if (p === "b" && r(m.to) === 0) { p = "B"; crowned = true; }
  b[m.to] = p;
  const n: CheckersState = { board: b, turn: s.turn, chain: -1, plies: s.plies, quiet: jump || p === p.toLowerCase() ? 0 : s.quiet + 1, result: null, last: m };
  if (jump && !crowned && jumpsFrom(n, m.to).length) {
    n.chain = m.to; // keep jumping with the same piece
    return n;
  }
  n.turn = s.turn === "r" ? "b" : "r";
  n.plies = s.plies + 1;
  if (legalCheckers(n).length === 0) n.result = s.turn;
  else if (n.quiet >= 80 || n.plies >= 300) n.result = "draw";
  return n;
}

// ------------------------------------------------------------------ Bot

function score(s: CheckersState, me: CSide): number {
  if (s.result === me) return 10000;
  if (s.result && s.result !== "draw") return -10000;
  let v = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = s.board[sq];
    if (!p) continue;
    const w = sideOf(p) === me ? 1 : -1;
    const king = p === p.toUpperCase();
    v += w * (king ? 170 : 100 + (p === "r" ? r(sq) : 7 - r(sq)) * 4);
  }
  return v;
}

/** Whole turns (a full multi-jump counts as one), so the search depth means something. */
function turns(s: CheckersState): { steps: CheckersMove[]; end: CheckersState }[] {
  const out: { steps: CheckersMove[]; end: CheckersState }[] = [];
  const walk = (st: CheckersState, steps: CheckersMove[]) => {
    for (const m of legalCheckers(st)) {
      const n = playCheckers(st, m)!;
      if (n.chain >= 0 && n.turn === st.turn && !n.result) walk(n, [...steps, m]);
      else out.push({ steps: [...steps, m], end: n });
    }
  };
  walk(s, []);
  return out;
}

function search(s: CheckersState, depth: number, me: CSide, a: number, b: number): number {
  if (depth === 0 || s.result) return score(s, me);
  const opts = turns(s);
  if (s.turn === me) {
    let v = -Infinity;
    for (const o of opts) { v = Math.max(v, search(o.end, depth - 1, me, a, b)); a = Math.max(a, v); if (a >= b) break; }
    return v;
  }
  let v = Infinity;
  for (const o of opts) { v = Math.min(v, search(o.end, depth - 1, me, a, b)); b = Math.min(b, v); if (a >= b) break; }
  return v;
}

/** The bot's next step (it plays a whole multi-jump one hop at a time). */
export function checkersBot(s: CheckersState, rand: () => number, depth = 4): CheckersMove | null {
  const opts = turns(s);
  if (!opts.length) return null;
  let best = opts[0], bv = -Infinity;
  for (const o of opts) {
    const v = search(o.end, depth - 1, s.turn, -Infinity, Infinity) + rand() * 8;
    if (v > bv) { bv = v; best = o; }
  }
  return best.steps[0];
}
