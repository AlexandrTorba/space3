/**
 * chess_clock.test.ts
 *
 * Tests the clock (time deduction) logic for bot matches.
 * Bugs being tested:
 *  1. Bot-as-Black clock resets to 3:00 every move instead of ticking down
 *  2. After bot move, deductTime() used engine.turn() AFTER move → deducted wrong player
 *  3. Human clock deduction when bot is Black
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { Chess } from "chess.js";

// ─── Minimal simulation of ChessMatch clock logic ────────────────────────────
// We extract just the clock/timing logic to test it in isolation without
// needing Cloudflare Worker/WebSocket infrastructure.

const INITIAL_TIME = 3 * 60 * 1000; // 3 minutes

class ClockSimulator {
  engine = new Chess();
  whiteTimeMs = INITIAL_TIME;
  blackTimeMs = INITIAL_TIME;
  lastMoveTimestamp = 0;
  totalMoveCount = 0;   // counts ALL moves (human + bot)
  isUnlimited = false;
  isActive = true;

  /**
   * Called BEFORE a move is registered.
   * Deducts time from whoever's turn it currently is.
   */
  deductTime(now: number): boolean {
    if (this.isUnlimited || this.totalMoveCount === 0 || !this.isActive) return false;
    const elapsed = now - this.lastMoveTimestamp;
    if (this.engine.turn() === "w") {
      this.whiteTimeMs = Math.max(0, this.whiteTimeMs - elapsed);
      if (this.whiteTimeMs === 0) { this.isActive = false; return true; }
    } else {
      this.blackTimeMs = Math.max(0, this.blackTimeMs - elapsed);
      if (this.blackTimeMs === 0) { this.isActive = false; return true; }
    }
    this.lastMoveTimestamp = now;
    return false;
  }

  /** Human makes a move at timestamp `now`. Returns false if invalid. */
  humanMove(uci: string, now: number): boolean {
    if (this.deductTime(now)) return false;
    const from = uci.substring(0, 2);
    const to   = uci.substring(2, 4);
    const promo = uci.length > 4 ? uci[4] : undefined;
    const result = this.engine.move({ from, to, promotion: promo });
    if (!result) return false;
    this.totalMoveCount++;
    if (this.totalMoveCount === 1) this.lastMoveTimestamp = now; // first move: start the clock
    return true;
  }

  /** Bot makes a move at timestamp `now`. Returns false if no legal moves. */
  botMove(uci: string, now: number): boolean {
    // Deduct BOT's time BEFORE moving (engine.turn() == bot's color here)
    if (this.deductTime(now)) return false;
    const from = uci.substring(0, 2);
    const to   = uci.substring(2, 4);
    const result = this.engine.move({ from, to });
    if (!result) return false;
    this.totalMoveCount++;
    if (this.totalMoveCount === 1) this.lastMoveTimestamp = now;
    return true;
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Chess Clock — Bot as Black", () => {
  let sim: ClockSimulator;

  beforeEach(() => {
    sim = new ClockSimulator();
  });

  it("clocks start at INITIAL_TIME before any move", () => {
    expect(sim.whiteTimeMs).toBe(INITIAL_TIME);
    expect(sim.blackTimeMs).toBe(INITIAL_TIME);
  });

  it("no time deducted on the very first move (clock hasn't started)", () => {
    // Human plays e4 (first move of the game)
    sim.humanMove("e2e4", 1000);
    // Neither clock should have lost time — it's move #1
    expect(sim.whiteTimeMs).toBe(INITIAL_TIME);
    expect(sim.blackTimeMs).toBe(INITIAL_TIME);
    expect(sim.lastMoveTimestamp).toBe(1000); // clock anchor set
  });

  it("Black (bot) time decrements when bot responds as Black", () => {
    // Move 1: human (White) plays e4
    sim.humanMove("e2e4", 0);            // t=0: clock starts

    // Move 2: bot (Black) plays e5 after 2 seconds
    sim.botMove("e7e5", 2000);           // t=2000: 2s elapsed → deduct from Black

    // Black should have lost 2 seconds
    expect(sim.blackTimeMs).toBe(INITIAL_TIME - 2000);
    // White's clock untouched (it's not White's turn being deducted)
    expect(sim.whiteTimeMs).toBe(INITIAL_TIME);
  });

  it("White time decrements on second human move", () => {
    sim.humanMove("e2e4", 0);            // t=0

    sim.botMove("e7e5", 2000);           // t=2000, black -2s

    // Move 3: human (White) plays d4 after 3 more seconds
    sim.humanMove("d2d4", 5000);         // t=5000, white -3s (from t=2000)

    expect(sim.blackTimeMs).toBe(INITIAL_TIME - 2000); // black: -2s
    expect(sim.whiteTimeMs).toBe(INITIAL_TIME - 3000); // white: -3s
  });

  it("clocks continue accumulating — never reset to INITIAL_TIME", () => {
    sim.humanMove("e2e4", 0);
    sim.botMove("e7e5", 1000);           // black -1s
    sim.humanMove("d2d4", 3000);         // white -2s
    sim.botMove("d7d5", 6000);           // black -3s more = -4s total
    sim.humanMove("c2c4", 11000);        // white -5s more = -7s total

    expect(sim.blackTimeMs).toBe(INITIAL_TIME - 4000);   // -1 -3 = -4s
    expect(sim.whiteTimeMs).toBe(INITIAL_TIME - 7000);   // -2 -5 = -7s

    // KEY: neither clock is at INITIAL_TIME (the bug: was resetting to 3:00)
    expect(sim.blackTimeMs).not.toBe(INITIAL_TIME);
    expect(sim.whiteTimeMs).not.toBe(INITIAL_TIME);
  });

  it("timeout is correctly detected when bot runs out of time", () => {
    sim.humanMove("e2e4", 0);
    // Bot takes too long — all 3 minutes expire
    const timedOut = sim.botMove("e7e5", INITIAL_TIME + 1);
    expect(timedOut).toBe(false); // game ended by timeout
    expect(sim.isActive).toBe(false);
    expect(sim.blackTimeMs).toBe(0);
  });
});

describe("Chess Clock — Bot as White", () => {
  let sim: ClockSimulator;

  beforeEach(() => {
    sim = new ClockSimulator();
  });

  it("White (bot) time decrements on first move", () => {
    // Bot (White) plays e4 after 1.5 seconds (opening)
    sim.botMove("e2e4", 0);              // move 1, clock starts, no deduction
    sim.humanMove("e7e5", 1500);        // human black responds in 1.5s, black -1.5s wait...

    // Actually: move 1 → no deduction (first move), move 2 → deduct the mover
    // Move 2: human plays e5 → deductTime: engine.turn()='b', elapsed = 1500ms
    expect(sim.blackTimeMs).toBe(INITIAL_TIME - 1500);
    expect(sim.whiteTimeMs).toBe(INITIAL_TIME); // white: first move, no deduction
  });

  it("White (bot) time decrements on second bot move", () => {
    sim.botMove("e2e4", 0);              // move 1: clock starts
    sim.humanMove("e7e5", 2000);        // black loses 2s
    sim.botMove("g1f3", 5000);          // white loses 3s (from t=2000)

    expect(sim.blackTimeMs).toBe(INITIAL_TIME - 2000);
    expect(sim.whiteTimeMs).toBe(INITIAL_TIME - 3000);
  });
});
