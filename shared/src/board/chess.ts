/**
 * Chess with the full rules: castling, en passant, promotion, check, checkmate, stalemate, the
 * fifty-move rule and insufficient material. Squares are 0..63 (index = rank × 8 + file, rank 0 is
 * White's back rank). Pieces are "PNBRQK" for White and "pnbrqk" for Black, "" for empty.
 */

export type Side = "w" | "b";
export interface ChessMove { from: number; to: number; promo?: "q" | "r" | "b" | "n" }
export interface ChessState {
  board: string[];
  turn: Side;
  castle: string; // subset of "KQkq"
  ep: number; // en-passant target square or -1
  half: number; // half-moves since a capture or pawn move
  plies: number;
  result: null | "w" | "b" | "draw";
  reason?: string;
  last?: ChessMove;
}

const sideOf = (p: string): Side | null => (p ? (p === p.toUpperCase() ? "w" : "b") : null);
const file = (sq: number) => sq & 7, rank = (sq: number) => sq >> 3;

export function chessStart(): ChessState {
  const back = "RNBQKBNR";
  const board = Array(64).fill("");
  for (let f = 0; f < 8; f++) {
    board[f] = back[f]; board[8 + f] = "P";
    board[48 + f] = "p"; board[56 + f] = back[f].toLowerCase();
  }
  return { board, turn: "w", castle: "KQkq", ep: -1, half: 0, plies: 0, result: null };
}

const KNIGHT = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
const KING = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const ROOK = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const BISHOP = [[1, 1], [1, -1], [-1, 1], [-1, -1]];

function attacked(b: string[], sq: number, by: Side): boolean {
  const f = file(sq), r = rank(sq);
  const at = (ff: number, rr: number) => (ff >= 0 && ff < 8 && rr >= 0 && rr < 8 ? b[rr * 8 + ff] : null);
  const own = (p: string | null, t: string) => !!p && sideOf(p) === by && p.toLowerCase() === t;
  const dir = by === "w" ? -1 : 1; // white pawns attack from below
  if (own(at(f - 1, r + dir), "p") || own(at(f + 1, r + dir), "p")) return true;
  for (const [df, dr] of KNIGHT) if (own(at(f + df, r + dr), "n")) return true;
  for (const [df, dr] of KING) if (own(at(f + df, r + dr), "k")) return true;
  for (const [dirs, kinds] of [[ROOK, "rq"], [BISHOP, "bq"]] as const) {
    for (const [df, dr] of dirs) {
      let ff = f + df, rr = r + dr;
      while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
        const p = b[rr * 8 + ff];
        if (p) { if (sideOf(p) === by && kinds.includes(p.toLowerCase())) return true; break; }
        ff += df; rr += dr;
      }
    }
  }
  return false;
}

export function inCheck(s: ChessState, side: Side = s.turn): boolean {
  const k = s.board.indexOf(side === "w" ? "K" : "k");
  return k >= 0 && attacked(s.board, k, side === "w" ? "b" : "w");
}

function pseudo(s: ChessState): ChessMove[] {
  const out: ChessMove[] = [];
  const b = s.board, me = s.turn;
  for (let sq = 0; sq < 64; sq++) {
    const p = b[sq];
    if (!p || sideOf(p) !== me) continue;
    const f = file(sq), r = rank(sq), t = p.toLowerCase();
    const add = (to: number) => {
      if (t === "p" && (rank(to) === 7 || rank(to) === 0)) for (const promo of ["q", "r", "b", "n"] as const) out.push({ from: sq, to, promo });
      else out.push({ from: sq, to });
    };
    const empty = (ff: number, rr: number) => ff >= 0 && ff < 8 && rr >= 0 && rr < 8 && !b[rr * 8 + ff];
    const enemy = (ff: number, rr: number) => ff >= 0 && ff < 8 && rr >= 0 && rr < 8 && sideOf(b[rr * 8 + ff]) === (me === "w" ? "b" : "w");
    if (t === "p") {
      const d = me === "w" ? 1 : -1, start = me === "w" ? 1 : 6;
      if (empty(f, r + d)) {
        add((r + d) * 8 + f);
        if (r === start && empty(f, r + 2 * d)) out.push({ from: sq, to: (r + 2 * d) * 8 + f });
      }
      for (const df of [-1, 1]) {
        const ff = f + df, rr = r + d;
        if (enemy(ff, rr) || (ff >= 0 && ff < 8 && rr * 8 + ff === s.ep)) add(rr * 8 + ff);
      }
    } else if (t === "n" || t === "k") {
      for (const [df, dr] of t === "n" ? KNIGHT : KING) {
        const ff = f + df, rr = r + dr;
        if (empty(ff, rr) || enemy(ff, rr)) out.push({ from: sq, to: rr * 8 + ff });
      }
      if (t === "k") {
        const home = me === "w" ? 4 : 60, opp: Side = me === "w" ? "b" : "w";
        if (sq === home && !attacked(b, sq, opp)) {
          const [kc, qc] = me === "w" ? ["K", "Q"] : ["k", "q"];
          if (s.castle.includes(kc) && !b[sq + 1] && !b[sq + 2] && !attacked(b, sq + 1, opp) && !attacked(b, sq + 2, opp)) out.push({ from: sq, to: sq + 2 });
          if (s.castle.includes(qc) && !b[sq - 1] && !b[sq - 2] && !b[sq - 3] && !attacked(b, sq - 1, opp) && !attacked(b, sq - 2, opp)) out.push({ from: sq, to: sq - 2 });
        }
      }
    } else {
      const dirs = t === "r" ? ROOK : t === "b" ? BISHOP : [...ROOK, ...BISHOP];
      for (const [df, dr] of dirs) {
        let ff = f + df, rr = r + dr;
        while (ff >= 0 && ff < 8 && rr >= 0 && rr < 8) {
          if (empty(ff, rr)) out.push({ from: sq, to: rr * 8 + ff });
          else { if (enemy(ff, rr)) out.push({ from: sq, to: rr * 8 + ff }); break; }
          ff += df; rr += dr;
        }
      }
    }
  }
  return out;
}

/** Plays a move without checking it (used after legality is known). */
export function applyChess(s: ChessState, m: ChessMove): ChessState {
  const b = [...s.board];
  const p = b[m.from], t = p.toLowerCase();
  const captured = b[m.to] !== "" || (t === "p" && m.to === s.ep);
  if (t === "p" && m.to === s.ep) b[m.to + (s.turn === "w" ? -8 : 8)] = "";
  b[m.to] = m.promo ? (s.turn === "w" ? m.promo.toUpperCase() : m.promo) : p;
  b[m.from] = "";
  if (t === "k" && Math.abs(m.to - m.from) === 2) {
    // Castling: bring the rook round.
    if (m.to > m.from) { b[m.to - 1] = b[m.to + 1]; b[m.to + 1] = ""; } else { b[m.to + 1] = b[m.to - 2]; b[m.to - 2] = ""; }
  }
  let castle = s.castle;
  const strip = (c: string) => { castle = castle.replace(c, ""); };
  if (p === "K") { strip("K"); strip("Q"); }
  if (p === "k") { strip("k"); strip("q"); }
  for (const [sq, c] of [[0, "Q"], [7, "K"], [56, "q"], [63, "k"]] as const) if (m.from === sq || m.to === sq) strip(c);
  const ep = t === "p" && Math.abs(m.to - m.from) === 16 ? (m.from + m.to) / 2 : -1;
  return { board: b, turn: s.turn === "w" ? "b" : "w", castle, ep, half: t === "p" || captured ? 0 : s.half + 1, plies: s.plies + 1, result: null, last: m };
}

export function legalChess(s: ChessState): ChessMove[] {
  if (s.result) return [];
  return pseudo(s).filter((m) => !inCheck(applyChess(s, m), s.turn));
}

/** Plays a move if it's legal, settling the game when it ends. Returns null for an illegal move. */
export function playChess(s: ChessState, m: ChessMove): ChessState | null {
  // A promotion choice only matters on a promotion (a queen if none was given); elsewhere it's ignored.
  const legal = legalChess(s).find((x) => x.from === m.from && x.to === m.to && (!x.promo || x.promo === (m.promo ?? "q")));
  if (!legal) return null;
  const n = applyChess(s, legal);
  const replies = legalChess(n);
  if (replies.length === 0) {
    if (inCheck(n)) { n.result = s.turn; n.reason = "checkmate"; } else { n.result = "draw"; n.reason = "stalemate"; }
  } else if (n.half >= 100) { n.result = "draw"; n.reason = "fifty-move rule"; }
  else if (insufficient(n.board)) { n.result = "draw"; n.reason = "insufficient material"; }
  else if (n.plies >= 300) { n.result = "draw"; n.reason = "move limit"; }
  return n;
}

function insufficient(b: string[]) {
  const rest = b.filter((p) => p && p.toLowerCase() !== "k");
  return rest.length === 0 || (rest.length === 1 && "nb".includes(rest[0].toLowerCase()));
}

// ------------------------------------------------------------------ Bot

const VAL: Record<string, number> = { p: 100, n: 310, b: 330, r: 500, q: 900, k: 0 };
const CENTER = Array.from({ length: 64 }, (_, sq) => {
  const f = file(sq), r = rank(sq);
  return 14 - (Math.abs(3.5 - f) + Math.abs(3.5 - r)) * 4;
});

function evaluate(s: ChessState): number {
  let v = 0;
  for (let sq = 0; sq < 64; sq++) {
    const p = s.board[sq];
    if (!p) continue;
    const t = p.toLowerCase(), w = sideOf(p) === "w" ? 1 : -1;
    let x = VAL[t];
    if (t === "n" || t === "b") x += CENTER[sq];
    if (t === "p") x += (w > 0 ? rank(sq) : 7 - rank(sq)) * 6 + CENTER[sq] * 0.3;
    v += w * x;
  }
  return v;
}

function search(s: ChessState, depth: number, alpha: number, beta: number): number {
  const moves = legalChess(s);
  const sign = s.turn === "w" ? 1 : -1;
  if (moves.length === 0) return inCheck(s) ? -100000 - depth : 0;
  if (depth === 0) return sign * evaluate(s);
  // Captures first makes pruning work.
  moves.sort((a, b) => (s.board[b.to] ? VAL[s.board[b.to].toLowerCase()] : 0) - (s.board[a.to] ? VAL[s.board[a.to].toLowerCase()] : 0));
  for (const m of moves) {
    const v = -search(applyChess(s, m), depth - 1, -beta, -alpha);
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return alpha;
}

/** A friendly bot: a short look-ahead with a little randomness so it isn't a wall. */
export function chessBot(s: ChessState, rand: () => number, depth = 2): ChessMove | null {
  const moves = legalChess(s);
  if (!moves.length) return null;
  let best: ChessMove[] = [], bv = -Infinity;
  for (const m of moves) {
    const v = -search(applyChess(s, m), depth - 1, -Infinity, Infinity) + rand() * 30;
    if (v > bv + 1e-6) { bv = v; best = [m]; } else if (Math.abs(v - bv) < 1e-6) best.push(m);
  }
  return best[Math.floor(rand() * best.length)];
}
