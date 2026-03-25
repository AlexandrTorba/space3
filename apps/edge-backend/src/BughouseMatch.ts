import { MatchUpdateSchema, BughouseStatusSchema, MatchStatusSchema } from "@antigravity/contracts";
import { fromBinary, toBinary, create } from "@bufbuild/protobuf";
import { Chess } from "chess.js";
import type { Env } from "./index";

console.log("BUGHOUSE_VERSION_LOBBY_V1");

export class BughouseMatch {
  state: DurableObjectState;
  env: Env;
  sessions: Set<WebSocket> = new Set();
  
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
  matchId = "unknown";

  lobby = {
    slots: {
      w0: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
      b0: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
      w1: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
      b1: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
    },
    isAllReady: false
  };

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    this.matchId = url.pathname.split("/")[2] || "unknown";

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.handleSession(server, url.searchParams.get("role") || "spectator");

    return new Response(null, { status: 101, webSocket: client });
  }

  handleSession(server: WebSocket, role: string) {
    server.accept();
    this.sessions.add(server);

    // Initial assignment from URL params
    if (["w0", "b0", "w1", "b1"].includes(role)) {
       (this.sockets as any)[role] = server;
       const slot = (this.lobby.slots as any)[role];
       if (slot) {
         slot.isClaimed = true;
         if (!slot.playerName) slot.playerName = `Player ${role.toUpperCase()}`;
       }
       console.log(`[BUGHOUSE] Assigned ${role} to session`);
    }

    this.broadcastStatus();

      server.addEventListener("message", (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      const buffer = new Uint8Array(event.data);
      try {
        const update = fromBinary(MatchUpdateSchema, buffer);
        if (update.event.case === "move" && this.isActive && this.isStarted) {
           this.handleMove(update.event.value.uci, server);
        } else if (update.event.case === "lobby") {
           this.handleLobbyAction(update.event.value, server);
        } else if (update.event.case === "action") {
           // Handle actions if needed
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
      console.log(`[BUGHOUSE] Session Closed - Role mapping check...`);
      this.sessions.delete(server);
      // If a player leaves, unclaim their slot
      for (const role of ["w0", "b0", "w1", "b1"] as const) {
        if ((this.sockets as any)[role] === server) {
          console.log(`[BUGHOUSE] Player ${role} disconnected.`);
          (this.sockets as any)[role] = null;
          (this.lobby.slots as any)[role].isClaimed = false;
          (this.lobby.slots as any)[role].isReady = false;
        }
      }
      this.broadcastStatus();
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
       if (targetSlot && !targetSlot.isClaimed) {
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
    }

    // Check all ready
    this.lobby.isAllReady = this.lobby.slots.w0.isReady && this.lobby.slots.b0.isReady && this.lobby.slots.w1.isReady && this.lobby.slots.b1.isReady;
    if (this.lobby.isAllReady) {
      this.isStarted = true;
    }

    this.broadcastStatus();
  }

  handleMove(uci: string, server: WebSocket | null, botRole?: string) {
    if (!this.isActive || !this.isStarted) return;
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
       console.log(`[BUGHOUSE] Piece drop requested: ${uci} on Board ${boardIdx} by ${player}`);
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
         engine.put({ type: pieceType as any, color: player as any }, target as any);
         // Toggle turn manually since put doesn't do it
         const fen = engine.fen();
         const parts = fen.split(" ");
         parts[1] = parts[1] === "w" ? "b" : "w";
         // Move counter etc could be updated too if needed
         engine.load(parts.join(" "));
         
         bank.splice(pieceIdx, 1);
       } catch(e) { return; }
    } else {
       // Normal move
       try {
         const from = uci.substring(0, 2);
         const to = uci.substring(2, 4);
         const promotion = uci.length > 4 ? uci[4] : undefined;
         
         const targetPiece = engine.get(to as any);
         const promotedSquares = boardIdx === 0 ? this.promotedSquares0 : this.promotedSquares1;
         const isOriginallyPromoted = promotedSquares.has(from);
         const targetOriginallyPromoted = promotedSquares.has(to);
         
         const move = engine.move({ from, to, promotion });
         console.log(`[BUGHOUSE] Board ${boardIdx} move successful: ${uci}. New FEN: ${engine.fen().substring(0,30)}`);
         
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
       } catch(e) { return; }
    }

    this.checkGameOver();
    this.broadcastStatus();
  }

  transferCapture(pieceType: string, boardIdx: number, playerColor: string) {
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
       this.isActive = false;
       // Winner logic...
    }
  }

  broadcastStatus() {
    const status0 = create(MatchStatusSchema, {
       fen: this.engine0.fen(),
       isActive: this.isActive,
       whiteName: "Board 0 White",
       blackName: "Board 0 Black"
    });
    const status1 = create(MatchStatusSchema, {
       fen: this.engine1.fen(),
       isActive: this.isActive,
       whiteName: "Board 1 White",
       blackName: "Board 1 Black"
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
       } catch (e: any) {
         this.sessions.delete(s);
       }
     });
  }

  botTimer: any = null;

  tickBots() {
    if (!this.isActive || !this.isStarted) return;
    const roles = ["w0", "b0", "w1", "b1"] as const;
    for (const role of roles) {
      const slot = this.lobby.slots[role];
      if (slot.isBot) {
        this.handleBotTurn(role);
      }
    }
  }

  handleBotTurn(role: "w0" | "b0" | "w1" | "b1") {
    const boardIdx = role.endsWith('0') ? 0 : 1;
    const player = role.startsWith('w') ? 'w' : 'b';
    const engine = boardIdx === 0 ? this.engine0 : this.engine1;

    if (engine.turn() !== player) return;

    // Pick a random legal move or drop
    const moves = engine.moves({ verbose: true });
    
    // Check bank
    let bank: string[];
    if (boardIdx === 0) bank = (player === "w" ? this.bank0w : this.bank0b);
    else bank = (player === "w" ? this.bank1w : this.bank1b);

    const canDrop = bank.length > 0;
    
    // 30% chance to drop if possible
    if (canDrop && Math.random() < 0.3) {
       const pieceChar = bank[Math.floor(Math.random() * bank.length)];
       const emptySquares: string[] = [];
       // Find empty squares
       for (let i = 0; i < 8; i++) {
         for (let j = 0; j < 8; j++) {
           const square = String.fromCharCode(97 + i) + (j + 1);
           if (!engine.get(square as any)) {
             if (pieceChar.toLowerCase() === 'p' && (j === 0 || j === 7)) continue;
             emptySquares.push(square);
           }
         }
       }
       if (emptySquares.length > 0) {
         const target = emptySquares[Math.floor(Math.random() * emptySquares.length)];
         this.handleMove(`${pieceChar}@${target}`, null, role);
         return;
       }
    }

    if (moves.length > 0) {
      const move = moves[Math.floor(Math.random() * moves.length)];
      this.handleMove(move.lan || move.from + move.to, null, role);
    }
  }
}
