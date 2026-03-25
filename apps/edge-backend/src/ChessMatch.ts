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
    
    if (url.searchParams.has("tc")) {
       const tc = url.searchParams.get("tc") || "3";
       const w = url.searchParams.get("w") || "White";
       const b = url.searchParams.get("b") || "Black";
       
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
           const p = this.db.insert(matches).values({
              id: this.matchId, whiteName: this.whiteName, blackName: this.blackName,
              timeControl: this.tc + (this.isUnlimited ? "" : "m"),
              status: 'active', fen: this.engine.fen(),
              createdAt: new Date(), updatedAt: new Date()
           }).onConflictDoNothing().execute().catch(() => {});
           this.state.waitUntil(p);
       }

       if (url.searchParams.get("isBot") === "true") {
           this.isBotMatch = true;
           this.botColor = url.searchParams.get("color") === "white" ? "b" : "w";
       }
    }

    const alarm = await this.state.storage.getAlarm();
    if (!alarm) {
       await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);
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

    if (this.isBotMatch && !this.botTimer) {
       this.botTimer = setInterval(() => this.handleBotTurn(), 2000);
    }

    server.addEventListener("message", (event) => {
      try {
        if (!(event.data instanceof ArrayBuffer)) return;
        const buffer = new Uint8Array(event.data);
        const matchUpdate = fromBinary(MatchUpdateSchema, buffer);
        
        if (this.deductTime()) return;

        if (matchUpdate.event.case === "action") {
            const action = matchUpdate.event.value;
            const claimColor = action.playerColor;
            if (claimColor === 'w') this.whiteSocket = server;
            else if (claimColor === 'b') this.blackSocket = server;
           
           if (!this.isActive) {
               if (action.actionType === "rematch") {
                   this.rematchOffers.add(action.playerColor);
                   this.sessions.forEach(s => { if (s !== server) s.send(event.data); });
                   if (this.rematchOffers.has("w") && this.rematchOffers.has("b")) {
                      const newMatchId = crypto.randomUUID();
                      this.rematchOffers.clear();
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
              this.endGame(this.matchId, action.playerColor === "w" ? "0-1" : "1-0", "resignation");
           } else if (action.actionType === "draw_offer") {
              this.drawOffer = action.playerColor;
              this.sessions.forEach(s => { if (s !== server) s.send(event.data); });
           } else if (action.actionType === "draw_accept") {
              if (this.drawOffer && this.drawOffer !== action.playerColor) {
                 this.endGame(this.matchId, "1/2-1/2", "agreement");
              }
           }
           return;
        }

        if (matchUpdate.event.case === "move" && this.isActive) {
          const move = matchUpdate.event.value;
          const turn = this.engine.turn();
          if (turn === 'w') this.whiteSocket = server;
          else this.blackSocket = server;
          
          try {
             const from = move.uci.substring(0, 2);
             const to = move.uci.substring(2, 4);
             const promotion = move.uci.length > 4 ? move.uci[4] : undefined;
             this.engine.move({ from, to, promotion });
          } catch(e) {
             this.broadcastStatus();
             return;
          }

          this.moveCount++;
          this.drawOffer = null;
          if (this.moveCount === 1 && !this.isUnlimited) this.lastMoveTimestamp = Date.now();
          this.state.storage.setAlarm(Date.now() + 5 * 60 * 1000);
          this.sessions.forEach(session => { if (session !== server) session.send(event.data); });

          if (this.engine.isGameOver()) {
             let reason = "unknown";
             if (this.engine.isCheckmate()) reason = "checkmate";
             else if (this.engine.isDraw()) reason = "draw";
             let result = this.engine.isCheckmate() ? (this.engine.turn() === "w" ? "0-1" : "1-0") : "1/2-1/2";
             this.endGame(this.matchId, result, reason);
          } else {
             this.broadcastStatus();
          }
        }
      } catch (err) {}
    });

    server.addEventListener("close", () => { 
        this.sessions.delete(server); 
        if (this.isActive && this.moveCount === 0 && this.sessions.size === 0 && this.db) {
           const p = this.db.delete(matches).where(eq(matches.id, this.matchId)).execute().catch(() => {});
           this.state.waitUntil(p);
        }
    });
  }

  handleBotTurn() {
    if (!this.isActive || this.engine.turn() !== this.botColor || (this.moveCount === 0 && this.botColor === "b")) return;
    const moves = this.engine.moves();
    if (moves.length === 0) return;
    this.engine.move(moves[Math.floor(Math.random() * moves.length)]);
    this.moveCount++;
    this.drawOffer = null;
    if (this.moveCount === 1 && !this.isUnlimited) this.lastMoveTimestamp = Date.now();
    else this.deductTime();
    this.broadcastStatus();
  }

  broadcastStatus() {
    const statusSync = create(MatchUpdateSchema, {
      event: {
         case: "status",
         value: { 
            fen: this.engine.fen(), isActive: this.isActive, 
            whiteTimeMs: this.isUnlimited ? -1 : Math.max(0, this.whiteTimeMs),
            blackTimeMs: this.isUnlimited ? -1 : Math.max(0, this.blackTimeMs),
            whiteName: this.whiteName, blackName: this.blackName,
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
             fen: this.engine.fen(), isActive: false, result, reason,
             whiteTimeMs: this.isUnlimited ? -1 : Math.max(0, this.whiteTimeMs),
             blackTimeMs: this.isUnlimited ? -1 : Math.max(0, this.blackTimeMs),
             whiteName: this.whiteName, blackName: this.blackName
          }
       }
    });
    const binary = toBinary(MatchUpdateSchema, finalSync);
    this.sessions.forEach(s => s.send(binary));
    if (this.db) {
       const p = this.db.update(matches)
         .set({ status: 'finished', result, reason, pgn: this.engine.pgn(), fen: this.engine.fen(), updatedAt: new Date() })
         .where(eq(matches.id, matchId)).execute().catch(() => {});
       this.state.waitUntil(p);
    }
  }

  async alarm() {
    const matchData: any = await this.state.storage.get("createdAt");
    const createdTime = matchData ? new Date(matchData).getTime() : Date.now();
    const ageMs = Date.now() - createdTime;
    if (ageMs > 240 * 60 * 60 * 1000) {
        this.endGame(this.matchId, "0-0", "stale");
        return;
    }
    const lastActivity = this.lastMoveTimestamp || createdTime;
    const inactiveMs = Date.now() - lastActivity;
    if (this.isActive && this.sessions.size === 0 && inactiveMs > 5 * 60 * 1000) {
        this.endGame(this.matchId, "0-0", "abandoned");
    } else if (this.isActive) {
        await this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);
    }
  }
}
