/**
 * BotEngine.ts
 *
 * Tiered chess AI for the Antigravity Chess bot.
 *
 * Levels (mapped from botElo setting):
 *   ≤ 600  → Level 1: Random moves
 *   ≤ 900  → Level 2: Greedy captures (MVV-LVA, 1-ply)
 *   ≤ 1200 → Level 3: Piece-Square Tables evaluation, 1-ply
 *   > 1200 → Level 4: Negamax 2-ply + PST + alpha-beta
 *
 * All evaluation values are in centipawns from the perspective of the side to move.
 * Higher value = better for the side to move.
 */

import { Chess } from "chess.js";

// ─── Piece values (centipawns) ────────────────────────────────────────────────
const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// ─── Piece-Square Tables ──────────────────────────────────────────────────────
// Indexed [rank 0-7][file 0-7] from WHITE's perspective (rank 0 = rank 1)
// Source: Simplified Evaluation Function by Tomasz Michniewski

const PST: Record<string, number[][]> = {
  p: [
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [ 50, 50, 50, 50, 50, 50, 50, 50],
    [ 10, 10, 20, 30, 30, 20, 10, 10],
    [  5,  5, 10, 25, 25, 10,  5,  5],
    [  0,  0,  0, 20, 20,  0,  0,  0],
    [  5, -5,-10,  0,  0,-10, -5,  5],
    [  5, 10, 10,-20,-20, 10, 10,  5],
    [  0,  0,  0,  0,  0,  0,  0,  0],
  ],
  n: [
    [-50,-40,-30,-30,-30,-30,-40,-50],
    [-40,-20,  0,  0,  0,  0,-20,-40],
    [-30,  0, 10, 15, 15, 10,  0,-30],
    [-30,  5, 15, 20, 20, 15,  5,-30],
    [-30,  0, 15, 20, 20, 15,  0,-30],
    [-30,  5, 10, 15, 15, 10,  5,-30],
    [-40,-20,  0,  5,  5,  0,-20,-40],
    [-50,-40,-30,-30,-30,-30,-40,-50],
  ],
  b: [
    [-20,-10,-10,-10,-10,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5, 10, 10,  5,  0,-10],
    [-10,  5,  5, 10, 10,  5,  5,-10],
    [-10,  0, 10, 10, 10, 10,  0,-10],
    [-10, 10, 10, 10, 10, 10, 10,-10],
    [-10,  5,  0,  0,  0,  0,  5,-10],
    [-20,-10,-10,-10,-10,-10,-10,-20],
  ],
  r: [
    [  0,  0,  0,  0,  0,  0,  0,  0],
    [  5, 10, 10, 10, 10, 10, 10,  5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [ -5,  0,  0,  0,  0,  0,  0, -5],
    [  0,  0,  0,  5,  5,  0,  0,  0],
  ],
  q: [
    [-20,-10,-10, -5, -5,-10,-10,-20],
    [-10,  0,  0,  0,  0,  0,  0,-10],
    [-10,  0,  5,  5,  5,  5,  0,-10],
    [ -5,  0,  5,  5,  5,  5,  0, -5],
    [  0,  0,  5,  5,  5,  5,  0, -5],
    [-10,  5,  5,  5,  5,  5,  0,-10],
    [-10,  0,  5,  0,  0,  0,  0,-10],
    [-20,-10,-10, -5, -5,-10,-10,-20],
  ],
  k: [
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-30,-40,-40,-50,-50,-40,-40,-30],
    [-20,-30,-30,-40,-40,-30,-30,-20],
    [-10,-20,-20,-20,-20,-20,-20,-10],
    [ 20, 20,  0,  0,  0,  0, 20, 20],
    [ 20, 30, 10,  0,  0, 10, 30, 20],
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Square e.g. "e4" → rank index 0-7 (0=rank1), file index 0-7 */
function squareToIndices(sq: string): [number, number] {
  const file = sq.charCodeAt(0) - 97;     // a=0 … h=7
  const rank = parseInt(sq[1], 10) - 1;   // "1"=0 … "8"=7
  return [rank, file];
}

/**
 * PST value for a piece on a square.
 * Black pieces mirror the table (rank 7-rank).
 */
function pstValue(type: string, color: "w" | "b", sq: string): number {
  const table = PST[type];
  if (!table) return 0;
  let [rank, file] = squareToIndices(sq);
  if (color === "w") rank = 7 - rank;     // flip for white (rank 7 = white's back rank)
  return table[rank][file];
}

/**
 * Static evaluation of the board.
 * Returns centipawns from the perspective of `perspective` color.
 */
function evaluate(engine: Chess, perspective: "w" | "b"): number {
  const board = engine.board();
  let score = 0;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;
      const sq = String.fromCharCode(97 + f) + (r + 1);
      const val = PIECE_VALUES[piece.type] + pstValue(piece.type, piece.color, sq);
      if (piece.color === perspective) {
        score += val;
      } else {
        score -= val;
      }
    }
  }

  return score;
}

// ─── Level 1: Random ─────────────────────────────────────────────────────────

function pickRandom(engine: Chess): ReturnType<Chess["moves"]>[0] | null {
  const moves = engine.moves({ verbose: true });
  if (!moves.length) return null;
  return moves[Math.floor(Math.random() * moves.length)];
}

// ─── Level 2: Greedy capture (MVV-LVA) ───────────────────────────────────────
// Always take the most valuable piece if possible; otherwise random.

function pickGreedy(engine: Chess): ReturnType<Chess["moves"]>[0] | null {
  const moves = engine.moves({ verbose: true });
  if (!moves.length) return null;

  let best: typeof moves[0] | null = null;
  let bestScore = -Infinity;

  for (const m of moves) {
    // Prefer captures (victim value − aggressor value / 10 to avoid bad trades)
    const victimVal  = m.captured ? PIECE_VALUES[m.captured] ?? 0 : 0;
    const attackerVal = PIECE_VALUES[m.piece] ?? 0;
    const captureScore = victimVal > 0 ? victimVal - attackerVal / 10 : -attackerVal / 20;

    // Promotion bonus
    const promoScore = m.promotion ? PIECE_VALUES[m.promotion] ?? 0 : 0;

    const score = captureScore + promoScore + Math.random() * 5; // tiny noise to break ties
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

// ─── Level 3: 1-ply PST evaluation ───────────────────────────────────────────
// Pick the move that leaves the best position for us.

function pickPST(engine: Chess): ReturnType<Chess["moves"]>[0] | null {
  const moves = engine.moves({ verbose: true });
  if (!moves.length) return null;

  const color = engine.turn();
  let best: typeof moves[0] | null = null;
  let bestScore = -Infinity;

  for (const m of moves) {
    engine.move(m);
    const score = evaluate(engine, color) + Math.random() * 3;
    engine.undo();
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}

// ─── Level 4: Negamax 2-ply + alpha-beta ─────────────────────────────────────

const NEGAMAX_DEPTH = 2;
const NEGAMAX_TIME_LIMIT_MS = 400; // safety net for Cloudflare CPU budget

function negamax(
  engine: Chess,
  depth: number,
  alpha: number,
  beta: number,
  color: "w" | "b",
  startTime: number
): number {
  if (Date.now() - startTime > NEGAMAX_TIME_LIMIT_MS) return evaluate(engine, color);
  if (depth === 0 || engine.isGameOver()) return evaluate(engine, color);

  const moves = engine.moves({ verbose: true });
  let best = -Infinity;

  for (const m of moves) {
    engine.move(m);
    const opponent = color === "w" ? "b" : "w";
    const score = -negamax(engine, depth - 1, -beta, -alpha, opponent, startTime);
    engine.undo();

    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break; // pruning
  }

  return best;
}

function pickNegamax(engine: Chess): ReturnType<Chess["moves"]>[0] | null {
  const moves = engine.moves({ verbose: true });
  if (!moves.length) return null;

  const color = engine.turn();
  const startTime = Date.now();

  let best: typeof moves[0] | null = null;
  let bestScore = -Infinity;

  for (const m of moves) {
    engine.move(m);
    const opponent = color === "w" ? "b" : "w";
    const score = -negamax(engine, NEGAMAX_DEPTH - 1, -Infinity, Infinity, opponent, startTime);
    engine.undo();

    // Tiny noise prevents deterministic play without affecting quality
    const noised = score + Math.random() * 2;
    if (noised > bestScore) {
      bestScore = noised;
      best = m;
    }
  }
  return best;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Map botElo (from frontend settings) to a difficulty level 1-4.
 *   1 = Random    (~200 Elo)
 *   2 = Greedy    (~600 Elo)
 *   3 = PST 1-ply (~900 Elo)
 *   4 = Negamax   (~1200 Elo)
 */
export function eloToLevel(elo: number): 1 | 2 | 3 | 4 {
  if (elo <= 600)  return 1;
  if (elo <= 900)  return 2;
  if (elo <= 1200) return 3;
  return 4;
}

/**
 * Pick the best move for the current position given a difficulty level.
 * Returns the move object (chess.js verbose format), or null if no legal moves.
 */
export function pickBotMove(
  engine: Chess,
  level: 1 | 2 | 3 | 4
): ReturnType<Chess["moves"]>[0] | null {
  switch (level) {
    case 1: return pickRandom(engine);
    case 2: return pickGreedy(engine);
    case 3: return pickPST(engine);
    case 4: return pickNegamax(engine);
  }
}
