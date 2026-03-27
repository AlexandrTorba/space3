import { MatchUpdateSchema, BughouseStatusSchema, MatchStatusSchema, ChatMessageSchema } from "@antigravity/contracts";
import { fromBinary, toBinary, create } from "@bufbuild/protobuf";
import { Chess } from "chess.js";
import { createDb, matches } from "@antigravity/database";
import { eq } from "drizzle-orm";
import type { Env } from "./index";

console.log("BUGHOUSE_VERSION_LOBBY_V1");

export class BughouseMatch {
  state: DurableObjectState;
  env: Env;
  sessions: Set<WebSocket> = new Set();
  debugLogs: string[] = [];
  
  log(msg: string) {
    console.log(msg);
    this.debugLogs.push(`[${new Date().toISOString()}] ${msg}`);
    if (this.debugLogs.length > 100) this.debugLogs.shift();
  }
  
  // Two engines for the two boards
  engine0 = new Chess();
  engine1 = new Chess();
  promotedSquares0: Set<string> = new Set();
  promotedSquares1: Set<string> = new Set();
  
  // Piece Banks for each player
  // Board 0
  bank0w: string[] = []; // Pieces White 0 can drop
  bank0b: string[] = []; // Pieces Black 0 can drop
  // Board 1
  bank1w: string[] = []; // Pieces White 1 can drop
  bank1b: string[] = []; // Pieces Black 1 can drop

  // Player sockets
  sockets: {
    w0: WebSocket | null;
    b0: WebSocket | null;
    w1: WebSocket | null;
    b1: WebSocket | null;
  } = { w0: null, b0: null, w1: null, b1: null };

  isActive = true;
  isStarted = false;
  private videoEnabled: boolean = true;
  private matchId: string = "unknown";
  result = "";
  reason = "";
  private disconnectTimer: any = null;
  private botDecisionAt: Record<string, number> = {};
  private botSelectedMove: Record<string, string | null> = {};
  dbInserted: boolean = false;
  db: any;

  lobby = {
    slots: {
      w0: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
      b0: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
      w1: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
      b1: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
    },
    isAllReady: false
  };

  // Clocks
  time0w = 3 * 60 * 1000;
  time0b = 3 * 60 * 1000;
  time1w = 3 * 60 * 1000;
  time1b = 3 * 60 * 1000;
  lastMove0 = 0;
  lastMove1 = 0;
  moveCount0 = 0;
  moveCount1 = 0;

  rematchOffers: Set<string> = new Set();
  botTimer: any = null;
  messageCounts: WeakMap<WebSocket, { count: number; lastReset: number }> = new WeakMap();

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;

    const url = this.env.TURSO_URL || this.env.LIBSQL_URL;
    const token = this.env.TURSO_AUTH_TOKEN || this.env.LIBSQL_AUTH_TOKEN;
    if (url && token) {
       this.db = createDb(url, token);
    }
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    this.matchId = url.pathname.split("/")[2] || "unknown";

    if (url.pathname.includes("/api/admin/match/video")) {
       const enabled = url.searchParams.get("enabled") === "true";
       this.videoEnabled = enabled;
       const msg = JSON.stringify({ type: "video_enabled", enabled });
       this.sessions.forEach(s => s.send(msg));
       return new Response("OK");
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const tc = url.searchParams.get("tc");
    if (tc && !this.isStarted) {
       const minutes = parseInt(tc, 10);
       if (!isNaN(minutes)) {
          this.time0w = minutes * 60 * 1000;
          this.time0b = minutes * 60 * 1000;
          this.time1w = minutes * 60 * 1000;
          this.time1b = minutes * 60 * 1000;
       }
    }

    if (!this.dbInserted && this.db) {
       this.dbInserted = true;
       const p = this.db.insert(matches).values({
          id: this.matchId,
          whiteName: "White Team", blackName: "Black Team",
          timeControl: tc || "3m",
          status: 'active',
          videoEnabled: true,
          createdAt: new Date(), updatedAt: new Date()
       }).onConflictDoNothing().execute().catch(() => {});
       this.state.waitUntil(p);
    }
 
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    if (this.matchId.includes("test-logic")) {
       this.isStarted = true;
    }

    this.handleSession(server, url.searchParams.get("role") || "spectator");

    return new Response(null, { status: 101, webSocket: client });
  }

  handleSession(server: WebSocket, role: string) {
    server.accept();
    this.sessions.add(server);

    if (this.disconnectTimer) {
       console.log("[BUGHOUSE] Human returned. Clearing disconnect timer.");
       clearTimeout(this.disconnectTimer);
       this.disconnectTimer = null;
    }
    server.send(JSON.stringify({ type: "video_enabled", enabled: this.videoEnabled }));

    // Initial assignment from URL params
    if (["w0", "b0", "w1", "b1"].includes(role)) {
       (this.sockets as any)[role] = server;
       const slot = (this.lobby.slots as any)[role];
       if (slot) {
         slot.isClaimed = true;
         if (!slot.playerName) slot.playerName = `Player ${role.toUpperCase()}`;
       }
       this.log(`[BUGHOUSE] Assigned ${role} to session`);
    }

    this.broadcastStatus();

    server.addEventListener("message", (event) => {
      // Rate Limit: 10 msg/sec
      let ratelimit = this.messageCounts.get(server);
      const now = Date.now();
      if (!ratelimit || now - ratelimit.lastReset > 1000) {
        ratelimit = { count: 0, lastReset: now };
      }
      ratelimit.count++;
      this.messageCounts.set(server, ratelimit);
      if (ratelimit.count > 10) return;

      if (!(event.data instanceof ArrayBuffer)) return;
      const buffer = new Uint8Array(event.data);
      try {
        const update = fromBinary(MatchUpdateSchema, buffer);
        if (update.event.case === "move" && this.isActive && this.isStarted) {
           this.handleMove(update.event.value.uci, server);
        } else if (update.event.case === "lobby") {
           this.handleLobbyAction(update.event.value, server);
        } else if (update.event.case === "action") {
           this.handleAction(update.event.value, server);
        } else if (update.event.case === "chat") {
           this.handleChat(update.event.value, server);
        }
      } catch (e) {
        console.error("Protobuf decode error:", e);
      }
    });

    // Start bot loop periodically just in case
    if (!this.botTimer) {
      this.botTimer = setInterval(() => this.tickBots(), 2000);
    }

    server.addEventListener("close", () => {
      console.log(`[BUGHOUSE] Session Closed`);
      this.sessions.delete(server);
      // If a player leaves, unclaim their slot
      let roleRemoved: string | null = null;
      for (const role of ["w0", "b0", "w1", "b1"] as const) {
        if ((this.sockets as any)[role] === server) {
          console.log(`[BUGHOUSE] Player ${role} disconnected.`);
          (this.sockets as any)[role] = null;
          (this.lobby.slots as any)[role].isClaimed = false;
          (this.lobby.slots as any)[role].isReady = false;
          roleRemoved = role;
        }
      }

      // Check if any human players are left
      let humanPlayersCount = 0;
      for (const r of ["w0", "b0", "w1", "b1"] as const) {
         if ((this.sockets as any)[r]) humanPlayersCount++;
      }

      if (this.isActive && humanPlayersCount === 0) {
         console.log("[BUGHOUSE] No human players left. Starting 60s grace period before cleanup.");
         if (this.disconnectTimer) clearTimeout(this.disconnectTimer);
         this.disconnectTimer = setTimeout(() => {
            if (this.isActive && this.sessions.size === 0) {
               console.log("[BUGHOUSE] Grace period expired. Performing cleanup.");
               if (!this.isStarted && this.db) {
                  // If it never started and nobody is here, delete from DB to stay clean
                  const p = this.db.delete(matches).where(eq(matches.id, this.matchId)).execute().catch(() => {});
                  this.state.waitUntil(p);
               } else {
                  this.endGame("Aborted", "all_players_disconnected_timeout");
               }
            }
         }, 60000); 
      } else {
         this.broadcastStatus();
      }
    });

    server.addEventListener("error", (e) => {
       console.error("[BUGHOUSE] WS Error:", e);
    });
  }

  handleLobbyAction(action: any, server: WebSocket) {
    const { type, role, name } = action;
    console.log(`[BUGHOUSE] Lobby Action from server: ${type} ${role} ${name}`);
    if (this.isStarted) return;

    if (type === "claim") {
       // Check if role is valid
       if (!["w0", "b0", "w1", "b1"].includes(role)) return;
       // Unclaim previous role if any
       for(const r of ["w0", "b0", "w1", "b1"] as const) {
         if ((this.sockets as any)[r] === server) {
            (this.sockets as any)[r] = null;
            this.lobby.slots[r].isClaimed = false;
            this.lobby.slots[r].isReady = false;
         }
       }
       // Claim new role
        const targetSlot = (this.lobby.slots as any)[role];
        if (targetSlot && (!targetSlot.isClaimed || targetSlot.isBot)) {
           // Reset bot flag if this is a human claim
           targetSlot.isBot = false;
           (this.sockets as any)[role] = server;
           targetSlot.isClaimed = true;
           targetSlot.playerName = name || "Player";
           targetSlot.isReady = false;
        }
    } else if (type === "ready") {
       for(const r of ["w0", "b0", "w1", "b1"] as const) {
         if ((this.sockets as any)[r] === server) {
            this.lobby.slots[r].isReady = !this.lobby.slots[r].isReady;
         }
       }
    } else if (type === "bot_add") {
       if (!["w0", "b0", "w1", "b1"].includes(role)) return;
       const targetSlot = (this.lobby.slots as any)[role];
       if (targetSlot && !targetSlot.isClaimed) {
          targetSlot.isClaimed = true;
          targetSlot.playerName = "Bot Engine";
          targetSlot.isReady = true;
          targetSlot.isBot = true;
       }
    } else if (type === "bot_remove") {
        if (!["w0", "b0", "w1", "b1"].includes(role)) return;
        const targetSlot = (this.lobby.slots as any)[role];
        if (targetSlot && targetSlot.isBot) {
           targetSlot.isClaimed = false;
           targetSlot.isBot = false;
           targetSlot.playerName = "";
           targetSlot.isReady = false;
        }
    }

    // Check all ready
    this.lobby.isAllReady = this.lobby.slots.w0.isReady && this.lobby.slots.b0.isReady && this.lobby.slots.w1.isReady && this.lobby.slots.b1.isReady;
    if (this.lobby.isAllReady && !this.isStarted) {
      this.isStarted = true;
    }

    this.broadcastStatus();
  }

  handleAction(action: any, server: WebSocket) {
    if (!["rematch", "resign"].includes(action.actionType)) return;
    
    if (action.actionType === "resign") {
       if (!this.isActive) return;
       // Find which team resigned
       let result = "";
       let reason = "resignation";
       if (server === this.sockets.w0 || server === this.sockets.b1) result = "0-1";
       else if (server === this.sockets.b0 || server === this.sockets.w1) result = "1-0";
       if (result) this.endGame(result, reason);
       return;
    }

    if (action.actionType === "rematch") {
       // Identify role of server
       let role = "";
       for(const r of ["w0", "b0", "w1", "b1"] as const) {
          if ((this.sockets as any)[r] === server) {
             role = r;
             break;
          }
       }
       if (!role) return;
       this.rematchOffers.add(role);
       
       // Broadcast the offer
       const offerUpdate = create(MatchUpdateSchema, {
          event: { case: "action", value: { matchId: this.matchId, actionType: "rematch", playerColor: role } }
       });
       const binary = toBinary(MatchUpdateSchema, offerUpdate);
       this.sessions.forEach(s => { if (s !== server) s.send(binary); });

       // Check if all human players have offered
       const humanPlayers = Object.entries(this.lobby.slots).filter(([r, s]) => s.isClaimed && !s.isBot).map(([r]) => r);
       const allOffered = humanPlayers.every(r => this.rematchOffers.has(r));

       if (allOffered && humanPlayers.length > 0) {
          const newMatchId = crypto.randomUUID();
          this.rematchOffers.clear();
          const response = create(MatchUpdateSchema, {
             event: { case: "action", value: { matchId: newMatchId, actionType: "rematch_accept", playerColor: "" } }
          });
          const acceptBinary = toBinary(MatchUpdateSchema, response);
          this.sessions.forEach(s => s.send(acceptBinary));
       }
    }
  }

  handleChat(content: any, server: WebSocket) {
    let sender = "Spectator";
    for (const r of ["w0", "b0", "w1", "b1"] as const) {
      if ((this.sockets as any)[r] === server) {
        sender = this.lobby.slots[r].playerName || r.toUpperCase();
        break;
      }
    }

    const chatUpdate = create(MatchUpdateSchema, {
      event: { 
        case: "chat", 
        value: { 
          sender, 
          text: String(content.text).substring(0, 500), 
          timestamp: BigInt(Date.now()) 
        } 
      }
    });

    const binary = toBinary(MatchUpdateSchema, chatUpdate);
    this.sessions.forEach(s => {
      try { s.send(binary); } catch (e) {}
    });
  }

  deductTime(boardIdx: number) {
    if (!this.isActive || !this.isStarted) return false;
    const count = boardIdx === 0 ? this.moveCount0 : this.moveCount1;
    if (count === 0) return false;

    const now = Date.now();
    const last = boardIdx === 0 ? this.lastMove0 : this.lastMove1;
    const elapsed = now - last;
    const engine = boardIdx === 0 ? this.engine0 : this.engine1;
    const turn = engine.turn();

    if (boardIdx === 0) {
      if (turn === 'w') {
        this.time0w -= elapsed;
        if (this.time0w <= 0) { this.time0w = 0; this.endGame("0-1", "timeout_board0"); return true; }
      } else {
        this.time0b -= elapsed;
        if (this.time0b <= 0) { this.time0b = 0; this.endGame("1-0", "timeout_board0"); return true; }
      }
      this.lastMove0 = now;
    } else {
      if (turn === 'w') {
        this.time1w -= elapsed;
        if (this.time1w <= 0) { this.time1w = 0; this.endGame("1-0", "timeout_board1"); return true; }
      } else {
        this.time1b -= elapsed;
        if (this.time1b <= 0) { this.time1b = 0; this.endGame("0-1", "timeout_board1"); return true; }
      }
      this.lastMove1 = now;
    }
    return false;
  }

  endGame(result: string, reason: string) {
    this.isActive = false;
    this.result = result;
    this.reason = reason;
    
    if (this.db) {
       const p = this.db.update(matches).set({
          status: 'finished',
          result: this.result,
          reason: this.reason,
          updatedAt: new Date()
       }).where(eq(matches.id, this.matchId)).execute().catch(() => {});
       this.state.waitUntil(p);
    }
    
    this.broadcastStatus();
  }

  handleMove(uci: string, server: WebSocket | null, botRole?: string) {
    this.log(`[BUGHOUSE] handleMove: ${uci} (botRole: ${botRole})`);
    if (!this.isActive || !this.isStarted) {
       this.log(`[BUGHOUSE] Move rejected: isActive=${this.isActive}, isStarted=${this.isStarted}`);
       return;
    }
    
    // Determine which player moved
    let boardIdx = -1;
    let player = "";
    if (server) {
      if (server === this.sockets.w0) { boardIdx = 0; player = "w"; }
      else if (server === this.sockets.b0) { boardIdx = 0; player = "b"; }
      else if (server === this.sockets.w1) { boardIdx = 1; player = "w"; }
      else if (server === this.sockets.b1) { boardIdx = 1; player = "b"; }
    } else if (botRole) {
      boardIdx = botRole.endsWith('0') ? 0 : 1;
      player = botRole.startsWith('w') ? 'w' : 'b';
    }

    if (boardIdx === -1) return; // Spectator cannot move

    const engine = boardIdx === 0 ? this.engine0 : this.engine1;
    if (engine.turn() !== player) return;

    // Check if it's a drop (e.g. "P@e4")
    if (uci.includes("@")) {
       this.log(`[BUGHOUSE] Piece drop requested: ${uci} on Board ${boardIdx} by ${player}`);
       const [pieceChar, target] = uci.split("@");
       const pieceType = pieceChar.toLowerCase();
       
       // Verify bank
       let bank: string[];
       if (boardIdx === 0) bank = (player === "w" ? this.bank0w : this.bank0b);
       else bank = (player === "w" ? this.bank1w : this.bank1b);

       const pieceIdx = bank.findIndex(p => p.toLowerCase() === pieceType);
       if (pieceIdx === -1) return; // Not in bank

       // Verify square is empty
       if (engine.get(target as any)) return;

       // Pawns cannot be dropped on the 1st or 8th rank
       if (pieceType === "p") {
          const rank = target[1];
          if (rank === "1" || rank === "8") return;
       }

       // Execute drop
       try {
         if (this.deductTime(boardIdx)) return;

         // Try the drop
         engine.put({ type: pieceType as any, color: player as any }, target as any);
         
         // Illegal: if the player who just dropped is STILL in check (standard chess rules)
         if (engine.isCheck()) {
            engine.remove(target as any);
            return;
         }

         // Success: apply move counts and toggle turn
         if (boardIdx === 0) {
            this.moveCount0++;
            if (this.moveCount0 === 1) this.lastMove0 = Date.now();
         } else {
            this.moveCount1++;
            if (this.moveCount1 === 1) this.lastMove1 = Date.now();
         }

         // Toggle turn manually since put doesn't do it
         const fen = engine.fen();
         const parts = fen.split(" ");
         parts[1] = parts[1] === "w" ? "b" : "w";
         engine.load(parts.join(" "));
         
         bank.splice(pieceIdx, 1);
       } catch (e) { return; }
    } else {
       // Normal move
       try {
         // Deduct time BEFORE move to use correct turn
         if (this.deductTime(boardIdx)) return;

         const from = uci.substring(0, 2);
         const to = uci.substring(2, 4);
         const promotion = uci.length > 4 ? uci[4] : undefined;
         
         const targetPiece = engine.get(to as any);
         this.log(`[BUGHOUSE] Board ${boardIdx} pre-move target at ${to}: ${JSON.stringify(targetPiece)}`);
         const promotedSquares = boardIdx === 0 ? this.promotedSquares0 : this.promotedSquares1;
         const isOriginallyPromoted = promotedSquares.has(from);
         const targetOriginallyPromoted = promotedSquares.has(to);
         
         const move = engine.move({ from, to, promotion });
         this.log(`[BUGHOUSE] Board ${boardIdx} move successful: ${uci}. New FEN: ${engine.fen().substring(0,30)}`);
         
         if (boardIdx === 0) {
           this.moveCount0++;
           if (this.moveCount0 === 1) this.lastMove0 = Date.now();
         } else {
           this.moveCount1++;
           if (this.moveCount1 === 1) this.lastMove1 = Date.now();
         }

         // Update promoted squares set
         promotedSquares.delete(from);
         if (promotion) {
            promotedSquares.add(to);
         } else if (isOriginallyPromoted) {
            // Keep the "promoted" status if the promoted piece just moved
            promotedSquares.add(to);
         }

         if (targetPiece) {
            // Captured piece goes to PARTNER'S bank on OTHER board
            // IF it was a promoted piece, it reverts to PAWN
            const actualPieceType = targetOriginallyPromoted ? "p" : targetPiece.type;
            if (targetOriginallyPromoted) promotedSquares.delete(to); 
            this.transferCapture(actualPieceType, boardIdx, player);
         }
       } catch(e: any) { 
         this.log(`[BUGHOUSE] Move Failed UCI: ${uci} - ${e.message}`);
         return; 
       }
    }

    this.checkGameOver();
    this.broadcastStatus();
  }

  transferCapture(pieceType: string, boardIdx: number, playerColor: string) {
    this.log(`[BUGHOUSE] transferCapture: ${pieceType} from Board ${boardIdx} player ${playerColor}`);
    const partnerBoardIdx = 1 - boardIdx;
    const pieceChar = pieceType.toUpperCase();
    
    if (playerColor === "w") {
       // White captured a piece, give it to Black partner on the other board
       if (partnerBoardIdx === 0) this.bank0b.push(pieceChar);
       else this.bank1b.push(pieceChar);
    } else {
       // Black captured a piece, give it to White partner on the other board
       if (partnerBoardIdx === 0) this.bank0w.push(pieceChar);
       else this.bank1w.push(pieceChar);
    }
  }

  checkGameOver() {
    if (this.engine0.isCheckmate() || this.engine1.isCheckmate()) {
       const result = this.engine0.isCheckmate() ? (this.engine0.turn() === 'w' ? "0-1" : "1-0") : (this.engine1.turn() === 'w' ? "1-0" : "0-1");
       this.endGame(result, "checkmate");
    }
  }

  broadcastStatus() {
    const status0 = create(MatchStatusSchema, {
       fen: this.engine0.fen(),
       isActive: this.isActive,
       result: this.result,
       reason: this.reason,
       whiteName: "Board 0 White",
       blackName: "Board 0 Black",
       whiteTimeMs: Math.max(0, this.time0w),
       blackTimeMs: Math.max(0, this.time0b)
    });
    const status1 = create(MatchStatusSchema, {
       fen: this.engine1.fen(),
       isActive: this.isActive,
       result: this.result,
       reason: this.reason,
       whiteName: "Board 1 White",
       blackName: "Board 1 Black",
       whiteTimeMs: Math.max(0, this.time1w),
       blackTimeMs: Math.max(0, this.time1b)
    });

     const bughouseStatus = create(BughouseStatusSchema, {
        board0: status0,
        board1: status1,
        bank0w: this.bank0w,
        bank0b: this.bank0b,
        bank1w: this.bank1w,
        bank1b: this.bank1b,
        lobby: {
          w0: this.lobby.slots.w0,
          b0: this.lobby.slots.b0,
          w1: this.lobby.slots.w1,
          b1: this.lobby.slots.b1,
          isAllReady: this.lobby.isAllReady
        }
     } as any);

     const update = create(MatchUpdateSchema, {
        event: { 
          case: "bughouse", 
          value: { 
            matchId: this.matchId, 
            event: { 
              case: "status", 
              value: bughouseStatus
            } 
          } 
        }
     });

     const binary = toBinary(MatchUpdateSchema, update);
     this.sessions.forEach(s => {
       try {
         s.send(binary);
         s.send(JSON.stringify({ type: "video_enabled", enabled: this.videoEnabled }));
       } catch (e: any) {
         this.sessions.delete(s);
       }
     });
  }


  tickBots() {
    if (!this.isActive || !this.isStarted) return;
    const roles = ["w0", "b0", "w1", "b1"] as const;
    const now = Date.now();
    for (const role of roles) {
      const slot = this.lobby.slots[role];
      if (slot.isBot) {
        const boardIdx = role.endsWith('0') ? 0 : 1;
        const player = role.startsWith('w') ? 'w' : 'b';
        const engine = boardIdx === 0 ? this.engine0 : this.engine1;

        if (engine.turn() === player) {
          if (!this.botDecisionAt[role]) {
             // Start "thinking"
             const selected = this.calculateBestBotMove(role);
             if (selected) {
                this.botSelectedMove[role] = selected;
                // Think between 1.5 and 4.5 seconds
                this.botDecisionAt[role] = now + 1500 + Math.random() * 3000;
             }
          } else if (now >= this.botDecisionAt[role]) {
             // Execute thought
             const move = this.botSelectedMove[role];
             if (move) this.handleMove(move, null, role);
             delete this.botDecisionAt[role];
             delete this.botSelectedMove[role];
          }
        } else {
           // Clear it if it's no longer our turn
           delete this.botDecisionAt[role];
           delete this.botSelectedMove[role];
        }
      }
    }
  }

  private calculateBestBotMove(role: "w0" | "b0" | "w1" | "b1"): string | null {
    const boardIdx = role.endsWith('0') ? 0 : 1;
    const player = role.startsWith('w') ? 'w' : 'b';
    const engine = boardIdx === 0 ? this.engine0 : this.engine1;

    const pieceValues: Record<string, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
    const pst: Record<string, number[]> = {
        p: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, -20, -20, 10, 10, 5, 5, -5, -10, 0, 0, -10, -5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, 5, 10, 25, 25, 10, 5, 5, 10, 10, 20, 30, 30, 20, 10, 10, 50, 50, 50, 50, 50, 50, 50, 50, 0, 0, 0, 0, 0, 0, 0, 0],
        n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 10, 15, 15, 10, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 10, 15, 15, 10, 0, -30, -40, -20, 0, 0, 0, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
        b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -20, -10, -10, -10, -10, -10, -10, -20]
    };

    const moves = engine.moves({ verbose: true });
    let bank: string[];
    if (boardIdx === 0) bank = (player === "w" ? this.bank0w : this.bank0b);
    else bank = (player === "w" ? this.bank1w : this.bank1b);

    const scoredMoves: { uci: string; score: number }[] = [];

    for (const move of moves) {
        let score = 0;
        
        // Piece-Square table bonus (simple center control)
        const type = move.piece;
        const targetSquareIdx = (8 - parseInt(move.to[1])) * 8 + (move.to.charCodeAt(0) - 97);
        const correctedIdx = player === 'w' ? targetSquareIdx : 63 - targetSquareIdx;
        if (pst[type]) score += pst[type][correctedIdx];

        // Material bonus
        if (move.captured) score += pieceValues[move.captured] * 12;

        // Threat simulation
        const testEngine = new Chess(engine.fen());
        testEngine.move(move);
        if (testEngine.isCheckmate()) score += 10000;
        else if (testEngine.isCheck()) score += 80;

        // Mobility
        score += testEngine.moves().length;

        // Safety check (very simplified: don't move to square attacked by more enemies than friends)
        // Since we can't easily calculate total attackers in chess.js without heavy compute, 
        // we just rely on mobility and PST. But at 1800 we at least check if target is attacked.
        if (testEngine.attackers(move.to, player === 'w' ? 'b' : 'w').length > 0) {
            score -= pieceValues[type] * 5; 
        }

        scoredMoves.push({ uci: move.lan || (move.from + move.to), score });
    }

    // Drops are even stronger at 1800 level
    if (bank.length > 0) {
        const uniquePieces = [...new Set(bank)];
        for (const piece of uniquePieces) {
            const pieceType = piece.toLowerCase();
            for (let i = 0; i < 8; i++) {
                for (let j = 0; j < 8; j++) {
                    const square = String.fromCharCode(97 + i) + (j + 1);
                    if (!engine.get(square as any)) {
                        if (pieceType === 'p' && (j === 0 || j === 7)) continue;
                        
                        let score = 50; // Drop is valuable
                        const dropUci = `${piece.toUpperCase()}@${square}`;
                        
                        try {
                            const enemyKingPos = this.findKing(engine, player === 'w' ? 'b' : 'w');
                            const dx = Math.abs(i - (enemyKingPos.charCodeAt(0) - 97));
                            const dy = Math.abs(j - (parseInt(enemyKingPos[1]) - 1));
                            
                            // Tactical drops near king
                            if (dx <= 1 && dy <= 1) score += 250;
                            else if (dx <= 2 && dy <= 2) score += 100;
                            
                            // Center control drops
                            if (i >= 2 && i <= 5 && j >= 2 && j <= 5) score += 40;

                            scoredMoves.push({ uci: dropUci, score });
                        } catch (e) {}
                    }
                }
            }
        }
    }

    if (scoredMoves.length === 0) return null;
    scoredMoves.sort((a, b) => b.score - a.score);
    return scoredMoves[0].uci; // Take the definitely best move for 1800 feel
  }

  handleBotTurn(role: "w0" | "b0" | "w1" | "b1") {
     // No-op, integrated into tickBots for timing
  }

  private findKing(chess: Chess, color: 'w' | 'b'): string {
    for (let i = 0; i < 8; i++) {
        for (let j = 1; j <= 8; j++) {
            const square = String.fromCharCode(97 + i) + j;
            const piece = chess.get(square as any);
            if (piece && piece.type === 'k' && piece.color === color) return square;
        }
    }
    return "e1";
  }
}
