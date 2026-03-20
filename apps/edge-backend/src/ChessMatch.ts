import { MatchUpdateSchema } from "@antigravity/contracts";
import { fromBinary, toBinary, create } from "@bufbuild/protobuf";
import { createDb, matches } from "@antigravity/database";
import { eq } from "drizzle-orm";
import type { Env } from "./index";
import { Chess } from "chess.js";

export class ChessMatch {
  state: DurableObjectState;
  env: Env;
  sessions: Set<WebSocket>;
  moveCount: number;
  engine: Chess;
  isActive: boolean;
  drawOffer: string | null;
  matchId: string = "unknown";
  
  tc: string = "3";
  whiteTimeMs: number = 3 * 60 * 1000;
  blackTimeMs: number = 3 * 60 * 1000;
  lastMoveTimestamp: number = 0;
  whiteName: string = "White";
  blackName: string = "Black";
  isUnlimited: boolean = false;
  dbInserted: boolean = false;
  
  whiteSocket: WebSocket | null = null;
  blackSocket: WebSocket | null = null;
  
  rematchOffers: Set<string> = new Set();
  
  db: any;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    this.moveCount = 0;
    this.engine = new Chess();
    this.isActive = true;
    this.drawOffer = null;
    
    const url = this.env.TURSO_URL || this.env.LIBSQL_URL;
    const token = this.env.TURSO_AUTH_TOKEN || this.env.LIBSQL_AUTH_TOKEN;
    
    if (url && token) {
       this.db = createDb(url, token);
    }
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    this.matchId = url.pathname.split("/")[2];
    
    // Parse params on initial connection if they are provided (only first connection matters to init)
    if (this.moveCount === 0 && url.searchParams.has("tc")) {
       this.tc = url.searchParams.get("tc") || "3";
       this.isUnlimited = this.tc === "Unlimited";
       
       if (!this.isUnlimited) {
          const minutes = parseInt(this.tc, 10);
          if (!isNaN(minutes)) {
             this.whiteTimeMs = minutes * 60 * 1000;
             this.blackTimeMs = minutes * 60 * 1000;
          }
       }
       
       const w = url.searchParams.get("w");
       if (w) this.whiteName = w;
       const b = url.searchParams.get("b");
       if (b) this.blackName = b;
       
       if (!this.dbInserted && this.db && w && b) {
           this.dbInserted = true;
           const p = this.db.insert(matches).values({
              id: this.matchId,
              whiteName: this.whiteName,
              blackName: this.blackName,
              timeControl: this.tc + (this.isUnlimited ? "" : "m"),
              status: 'active',
              fen: this.engine.fen(),
              createdAt: new Date(),
              updatedAt: new Date()
           }).onConflictDoNothing().execute().catch(console.error);
           this.state.waitUntil(p);
       }
    }
    
    if (url.pathname.endsWith("/spectators")) {
       return new Response(JSON.stringify({ count: Math.max(0, this.sessions.size - (this.whiteSocket ? 1 : 0) - (this.blackSocket ? 1 : 0)) }));
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.handleSession(server);

    return new Response(null, { status: 101, webSocket: client });
  }
  
  deductTime() {
    if (this.isUnlimited || this.moveCount === 0 || !this.isActive) return false;
    
    const now = Date.now();
    const elapsed = now - this.lastMoveTimestamp;
    
    if (this.engine.turn() === 'w') {
        this.whiteTimeMs -= elapsed;
        if (this.whiteTimeMs <= 0) {
            this.whiteTimeMs = 0;
            this.endGame(this.matchId, "0-1", "timeout");
            return true;
        }
    } else {
        this.blackTimeMs -= elapsed;
        if (this.blackTimeMs <= 0) {
            this.blackTimeMs = 0;
            this.endGame(this.matchId, "1-0", "timeout");
            return true;
        }
    }
    
    this.lastMoveTimestamp = now;
    return false;
  }

  handleSession(server: WebSocket) {
    server.accept();
    this.sessions.add(server);

    this.broadcastStatus();

    server.addEventListener("message", (event) => {
      try {
        const buffer = new Uint8Array(event.data as ArrayBuffer);
        const matchUpdate = fromBinary(MatchUpdateSchema, buffer);
        
        // Timeout implicit check before processing any action
        if (this.deductTime()) return;

        // 1. Process Actions (Resign, Draw, Rematch)
        if (matchUpdate.event.case === "action") {
           const action = matchUpdate.event.value;
           
           // Authenticate player actions tightly
           const claimColor = action.playerColor; // 'w' or 'b'
           if (claimColor === 'w') {
               if (!this.whiteSocket) this.whiteSocket = server;
               else if (this.whiteSocket !== server) return; // Silent drop unauthorized action
           } else if (claimColor === 'b') {
               if (!this.blackSocket) this.blackSocket = server;
               else if (this.blackSocket !== server) return;
           }
           
           if (!this.isActive) {
               // Post-game actions
               if (action.actionType === "rematch") {
                   this.rematchOffers.add(action.playerColor);
                   this.sessions.forEach(s => { if (s !== server) s.send(event.data); }); // Forward offer
                   
                   if (this.rematchOffers.has("w") && this.rematchOffers.has("b")) {
                      const newMatchId = crypto.randomUUID();
                      const response = create(MatchUpdateSchema, {
                         event: { case: "action", value: { matchId: newMatchId, actionType: "rematch_accept", playerColor: "" } }
                      });
                      const binary = toBinary(MatchUpdateSchema, response);
                      this.sessions.forEach(s => s.send(binary));
                   }
               }
               return;
           }
           
           if (action.actionType === "resign") {
              const result = action.playerColor === "w" ? "0-1" : "1-0";
              this.endGame(this.matchId, result, "resignation");
           } 
           else if (action.actionType === "draw_offer") {
              this.drawOffer = action.playerColor;
              this.sessions.forEach(s => { if (s !== server) s.send(event.data); });
           }
           else if (action.actionType === "draw_accept") {
              if (this.drawOffer && this.drawOffer !== action.playerColor) {
                 this.endGame(this.matchId, "1/2-1/2", "agreement");
              }
           }
           return;
        }

        // 2. Process Moves
        if (matchUpdate.event.case === "move" && this.isActive) {
          const move = matchUpdate.event.value;
          const turn = this.engine.turn(); // 'w' or 'b'
          
          // Secure the sockets so black can't play for white
          if (turn === 'w') {
              if (!this.whiteSocket) this.whiteSocket = server;
              else if (this.whiteSocket !== server) return; // Silent drop unauthorized move
          } else {
              if (!this.blackSocket) this.blackSocket = server;
              else if (this.blackSocket !== server) return;
          }
          
          let isValid = false;
          try {
             const from = move.uci.substring(0, 2);
             const to = move.uci.substring(2, 4);
             const promotion = move.uci.length > 4 ? move.uci[4] : undefined;
             this.engine.move({ from, to, promotion });
             isValid = true;
          } catch(e) {
             console.error(`[Anti-Cheat] Invalid move intercepted: ${move.uci}`);
             this.broadcastStatus();
             return;
          }

          if (isValid) {
            this.moveCount++;
            this.drawOffer = null;
            
            // First move sets initial timestamp unconditionally
            if (this.moveCount === 1 && !this.isUnlimited) {
               this.lastMoveTimestamp = Date.now();
            }
            
            this.sessions.forEach(session => {
               if (session !== server) {
                   session.send(event.data); // Echo move
               }
            });

            if (this.engine.isGameOver()) {
               let reason = "unknown";
               if (this.engine.isCheckmate()) reason = "checkmate";
               else if (this.engine.isThreefoldRepetition()) reason = "repetition";
               else if (this.engine.isStalemate()) reason = "stalemate";
               else if (this.engine.isInsufficientMaterial()) reason = "insufficient_material";
               else if (this.engine.isDraw()) reason = "50-move rule";
               
               let result = "1/2-1/2";
               if (reason === "checkmate") {
                 result = this.engine.turn() === "w" ? "0-1" : "1-0";
               }
               this.endGame(this.matchId, result, reason);
            } else {
               // Broadcast the updated clocks correctly synced via status payload
               this.broadcastStatus();
            }
          }
        }
      } catch (err) {
        console.error("Failed to decode Protobuf message:", err);
      }
    });

    server.addEventListener("close", () => { 
        this.sessions.delete(server); 
        
        if (server === this.whiteSocket) this.whiteSocket = null;
        if (server === this.blackSocket) this.blackSocket = null;
        
        this.deductTime();
        
        if (this.isActive && this.moveCount === 0 && this.sessions.size === 0 && this.db) {
           const p = this.db.delete(matches).where(eq(matches.id, this.matchId)).execute().catch(() => {});
           this.state.waitUntil(p);
        }
        else if (this.isActive && this.moveCount > 0) {
           if (!this.whiteSocket || !this.blackSocket) {
               this.endGame(this.matchId, "1/2-1/2", "abandoned");
           }
        }
    });
    server.addEventListener("error", () => { 
        this.sessions.delete(server); 
        if (server === this.whiteSocket) this.whiteSocket = null;
        if (server === this.blackSocket) this.blackSocket = null;
        
        if (this.isActive && this.moveCount > 0) {
           if (!this.whiteSocket || !this.blackSocket) {
               this.endGame(this.matchId, "1/2-1/2", "abandoned");
           }
        }
    });
  }

  broadcastStatus() {
    const statusSync = create(MatchUpdateSchema, {
      event: {
         case: "status",
         value: { 
            fen: this.engine.fen(), 
            isActive: this.isActive, 
            whiteId: "", blackId: "",
            result: "", reason: "",
            whiteTimeMs: this.isUnlimited ? -1 : Math.max(0, this.whiteTimeMs),
            blackTimeMs: this.isUnlimited ? -1 : Math.max(0, this.blackTimeMs),
            whiteName: this.whiteName,
            blackName: this.blackName,
            spectators: Math.max(0, this.sessions.size - (this.whiteSocket ? 1 : 0) - (this.blackSocket ? 1 : 0))
         }
      }
    });
    const binary = toBinary(MatchUpdateSchema, statusSync);
    this.sessions.forEach(s => s.send(binary));
  }

  endGame(matchId: string, result: string, reason: string) {
    this.isActive = false;
    const finalSync = create(MatchUpdateSchema, {
       event: {
          case: "status",
          value: { 
             fen: this.engine.fen(), 
             isActive: false, 
             whiteId: "", blackId: "",
             result, reason,
             whiteTimeMs: this.isUnlimited ? -1 : Math.max(0, this.whiteTimeMs),
             blackTimeMs: this.isUnlimited ? -1 : Math.max(0, this.blackTimeMs),
             whiteName: this.whiteName,
             blackName: this.blackName,
             spectators: Math.max(0, this.sessions.size - (this.whiteSocket ? 1 : 0) - (this.blackSocket ? 1 : 0))
          }
       }
    });
    const binary = toBinary(MatchUpdateSchema, finalSync);
    this.sessions.forEach(s => s.send(binary));
    
    if (this.db) {
       const p = this.db.update(matches)
         .set({ status: 'finished', result, reason, pgn: this.engine.pgn(), fen: this.engine.fen(), updatedAt: new Date() })
         .where(eq(matches.id, matchId))
         .execute().catch(console.error);
       this.state.waitUntil(p);
    }
  }
}
