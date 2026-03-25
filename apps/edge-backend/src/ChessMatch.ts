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
  isBotMatch: boolean = false;
  botColor: string = "b";
  botTimer: any = null;
  
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
    if (url.searchParams.has("tc")) {
       const tc = url.searchParams.get("tc") || "3";
       const w = url.searchParams.get("w") || "White";
       const b = url.searchParams.get("b") || "Black";
       
       console.log(`[MTCH] Init match ${this.matchId}: tc=${tc}, w=${w}, b=${b}`);

       if (this.moveCount === 0) {
          this.tc = tc;
          this.isUnlimited = this.tc === "Unlimited";
          if (!this.isUnlimited) {
             const minutes = parseInt(this.tc, 10);
             if (!isNaN(minutes)) {
                this.whiteTimeMs = minutes * 60 * 1000;
                this.blackTimeMs = minutes * 60 * 1000;
             }
          }
          this.whiteName = w;
          this.blackName = b;
          this.state.storage.put("createdAt", Date.now());
       }

       if (!this.dbInserted && this.db && w !== "White" && b !== "Black") {
           this.dbInserted = true;
           console.log(`[MTCH] Syncing match ${this.matchId} to DB`);
           const p = this.db.insert(matches).values({
              id: this.matchId,
              whiteName: this.whiteName,
              blackName: this.blackName,
              timeControl: this.tc + (this.isUnlimited ? "" : "m"),
              status: 'active',
              fen: this.engine.fen(),
              createdAt: new Date(),
              updatedAt: new Date()
           }).onConflictDoNothing().execute().catch((err: any) => console.error("[DB ERROR]", err));
           this.state.waitUntil(p);
       }
        if (url.searchParams.get("isBot") === "true") {
           this.isBotMatch = true;
           this.botColor = url.searchParams.get("color") === "white" ? "b" : "w";
           console.log(`[MTCH] Bot enabled for match ${this.matchId} as ${this.botColor}`);
        }
    }

    // Ensure an alarm is set to check for abandonment even if no moves are made
    const alarm = await this.state.storage.getAlarm();
    if (!alarm) {
       await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000); // 10 mins initial grace
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
    console.log(`[MTCH] Session added to match ${this.matchId}. Total: ${this.sessions.size}`);

    this.broadcastStatus();

    if (this.isBotMatch && !this.botTimer) {
       this.botTimer = setInterval(() => this.handleBotTurn(), 2000);
    }

    server.addEventListener("message", (event) => {
      try {
        if (!(event.data instanceof ArrayBuffer)) {
          console.warn("[MTCH] Received non-binary message");
          return;
        }
        const buffer = new Uint8Array(event.data);
        const matchUpdate = fromBinary(MatchUpdateSchema, buffer);
        console.log(`[MTCH] Event ${matchUpdate.event.case} in ${this.matchId}`);
        
        // Timeout implicit check before processing any action
        if (this.deductTime()) return;

        // 1. Process Actions (Resign, Draw, Rematch)
        if (matchUpdate.event.case === "action") {
           const action = matchUpdate.event.value;
                      // Authenticate player actions loosely to allow reconnection
            const claimColor = action.playerColor; // 'w' or 'b'
            if (claimColor === 'w') {
                this.whiteSocket = server;
            } else if (claimColor === 'b') {
                this.blackSocket = server;
            }
           
           if (!this.isActive) {
               // Post-game actions
               if (action.actionType === "rematch") {
                   this.rematchOffers.add(action.playerColor);
                   this.sessions.forEach(s => { if (s !== server) s.send(event.data); }); // Forward offer
                   
                   if (this.rematchOffers.has("w") && this.rematchOffers.has("b")) {
                      const newMatchId = crypto.randomUUID();
                      this.rematchOffers.clear(); // Clear so multiple messages don't spawn multiple games
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
           // Identify which socket belongs to which player on the fly
           const turn = this.engine.turn(); // 'w' or 'b'
           if (turn === 'w') {
               this.whiteSocket = server;
           } else {
               this.blackSocket = server;
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

            // Schedule / Reschedule cleanup alarm on move
            this.state.storage.setAlarm(Date.now() + 5 * 60 * 1000); // Check in 5 mins
            
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
        
        if (server === this.whiteSocket) {
             console.log(`[MTCH] White socket disconnected in ${this.matchId}`);
             // Note: Don't set to null immediately to allow grace period if needed, 
             // but sessions tracker handles the cleanup for broadcast.
        }
        if (server === this.blackSocket) {
             console.log(`[MTCH] Black socket disconnected in ${this.matchId}`);
        }
        
        if (this.isActive && this.moveCount === 0 && this.sessions.size === 0 && this.db) {
           const p = this.db.delete(matches).where(eq(matches.id, this.matchId)).execute().catch(() => {});
           this.state.waitUntil(p);
        }
        // Removed aggressive endGame on disconnect to support page refresh
    });
    server.addEventListener("error", () => { 
        this.sessions.delete(server); 
        if (server === this.whiteSocket) this.whiteSocket = null;
        if (server === this.blackSocket) this.blackSocket = null;
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

  async alarm() {
    console.log(`[MTCH] Alarm triggered for ${this.matchId}. Checking for inactivity...`);
    
    // 1. Absolute Sanity Limit: Matches shouldn't live more than 240 hours in DO memory/status
    const matchData: any = await this.state.storage.get("createdAt");
    const createdTime = matchData ? new Date(matchData).getTime() : Date.now();
    const ageMs = Date.now() - createdTime;

    if (ageMs > 240 * 60 * 60 * 1000) {
        console.log(`[MTCH] Force-closing match ${this.matchId} due to absolute age limit (240h)`);
        this.endGame(this.matchId, "0-0", "stale");
        return;
    }

    // 2. Abandonment Check: 
    // If no moves for 5 minutes AND no one is connected, end it as abandoned.
    // If moves happened, we check since lastMoveTimestamp.
    const lastActivity = this.lastMoveTimestamp || createdTime;
    const inactiveMs = Date.now() - lastActivity;

    if (this.isActive && this.sessions.size === 0 && inactiveMs > 5 * 60 * 1000) {
        console.log(`[MTCH] Clean-up: Game ${this.matchId} abandoned (no activity/sessions for 5m)`);
        this.endGame(this.matchId, "0-0", "abandoned");
    } else if (this.isActive) {
        // If still active but not abandoned yet, reschedule check
        await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);
    }
  }
  handleBotTurn() {
    if (!this.isActive || this.engine.turn() !== this.botColor || (this.moveCount === 0 && this.botColor === "b")) return;
    
    const moves = this.engine.moves();
    if (moves.length === 0) return;
    
    // Pick a random move
    const move = moves[Math.floor(Math.random() * moves.length)];
    this.engine.move(move);
    this.moveCount++;
    this.drawOffer = null;
    
    if (this.moveCount === 1 && !this.isUnlimited) {
       this.lastMoveTimestamp = Date.now();
    } else {
       this.deductTime();
    }
    
    this.broadcastStatus();
  }
}
