import { MatchUpdateSchema, BughouseStatusSchema, MatchStatusSchema } from "@antigravity/contracts";
import { fromBinary, toBinary, create } from "@bufbuild/protobuf";
import { Chess } from "chess.js";
import type { Env } from "./index";

export class BughouseMatch {
  state: DurableObjectState;
  env: Env;
  sessions: Set<WebSocket> = new Set();
  
  // Two engines for the two boards
  engine0 = new Chess();
  engine1 = new Chess();
  
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
  matchId = "unknown";

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

    // Initial assignment
    if (role === "w0") this.sockets.w0 = server;
    else if (role === "b0") this.sockets.b0 = server;
    else if (role === "w1") this.sockets.w1 = server;
    else if (role === "b1") this.sockets.b1 = server;

    this.broadcastStatus();

    server.addEventListener("message", (event) => {
      if (!(event.data instanceof ArrayBuffer)) return;
      const buffer = new Uint8Array(event.data);
      try {
        const update = fromBinary(MatchUpdateSchema, buffer);
        if (update.event.case === "move" && this.isActive) {
           this.handleMove(update.event.value.uci, server);
        } else if (update.event.case === "action") {
           // Handle actions if needed
        }
      } catch (e) {
        console.error("Protobuf decode error:", e);
      }
    });

    server.addEventListener("close", () => {
      this.sessions.delete(server);
      if (server === this.sockets.w0) this.sockets.w0 = null;
      if (server === this.sockets.b0) this.sockets.b0 = null;
      if (server === this.sockets.w1) this.sockets.w1 = null;
      if (server === this.sockets.b1) this.sockets.b1 = null;
    });
  }

  handleMove(uci: string, server: WebSocket) {
    // Determine which player moved
    let boardIdx = -1;
    let player = "";
    if (server === this.sockets.w0) { boardIdx = 0; player = "w"; }
    else if (server === this.sockets.b0) { boardIdx = 0; player = "b"; }
    else if (server === this.sockets.w1) { boardIdx = 1; player = "w"; }
    else if (server === this.sockets.b1) { boardIdx = 1; player = "b"; }

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
         
         // Capture check
         const targetPiece = engine.get(to as any);
         
         const move = engine.move({ from, to, promotion });
         console.log(`[BUGHOUSE] Board ${boardIdx} move successful: ${uci}. New FEN: ${engine.fen().substring(0,30)}`);
         
         if (targetPiece) {
            // Captured piece goes to PARTNER'S bank on OTHER board
            this.transferCapture(targetPiece.type, boardIdx, player);
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
       bank1b: this.bank1b
    });

    const update = create(MatchUpdateSchema, {
       event: { case: "bughouse", value: { matchId: this.matchId, event: { case: "status", value: bughouseStatus } } }
    });

    const binary = toBinary(MatchUpdateSchema, update);
    this.sessions.forEach(s => s.send(binary));
  }
}
