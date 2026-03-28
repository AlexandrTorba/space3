import { MatchUpdateSchema, BughouseStatusSchema, MatchStatusSchema, ChatMessageSchema } from "@antigravity/contracts";
import { fromBinary, toBinary, create } from "@bufbuild/protobuf";
import { Chess } from "chess.js";
import { createDb, matches } from "@antigravity/database";
import { eq } from "drizzle-orm";
import type { Env } from "./index";

console.log("BUGHOUSE_VERSION_LOBBY_V2_FIXED");

interface SessionData {
  id: string;
  name: string;
  role: string;
}

export class BughouseMatch {
  state: DurableObjectState;
  env: Env;
  sessions: Map<WebSocket, SessionData> = new Map();
  debugLogs: string[] = [];
  
  log(msg: string) {
    console.log(msg);
    this.debugLogs.push(`[${new Date().toISOString()}] ${msg}`);
    if (this.debugLogs.length > 100) this.debugLogs.shift();
  }
  
  engine0 = new Chess();
  engine1 = new Chess();
  promotedSquares0: Set<string> = new Set();
  promotedSquares1: Set<string> = new Set();
  
  bank0w: string[] = [];
  bank0b: string[] = [];
  bank1w: string[] = [];
  bank1b: string[] = [];

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
  dbInserted: boolean = false;
  db: any;

  lobby = {
    slots: {
      w0: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
      b0: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
      w1: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
      b1: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
    },
    isAllReady: false,
    timeControlMs: 3 * 60 * 1000,
    team0Name: "Team White",
    team1Name: "Team Black",
    adminSessionId: ""
  };

  time0w = 3 * 60 * 1000;
  time0b = 3 * 60 * 1000;
  time1w = 3 * 60 * 1000;
  time1b = 3 * 60 * 1000;
  lastMove0 = 0;
  lastMove1 = 0;
  moveCount0 = 0;
  moveCount1 = 0;

  rematchOffers: Set<string> = new Set();
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
       this.sessions.forEach((_, s) => s.send(msg));
       return new Response("OK");
    }

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    if (!this.dbInserted && this.db) {
       this.dbInserted = true;
       const tc = url.searchParams.get("tc") || "3m";
       const p = this.db.insert(matches).values({
          id: this.matchId,
          whiteName: "White Team", blackName: "Black Team",
          timeControl: tc,
          status: 'active',
          videoEnabled: true,
          createdAt: new Date(), updatedAt: new Date()
       }).onConflictDoNothing().execute().catch(() => {});
       this.state.waitUntil(p);
       this.state.storage.setAlarm(Date.now() + 10 * 60 * 1000);
    }
 
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.handleSession(server, url.searchParams.get("role") || "spectator", url);
    return new Response(null, { status: 101, webSocket: client });
  }

  handleSession(server: WebSocket, initialRole: string, url: URL) {
    server.accept();
    const sessionId = crypto.randomUUID();
    const name = url.searchParams.get("name") || "Player";
    this.sessions.set(server, { id: sessionId, name, role: initialRole });

    if (this.disconnectTimer) {
       clearTimeout(this.disconnectTimer);
       this.disconnectTimer = null;
    }

    server.send(JSON.stringify({ type: "session_id", id: sessionId }));
    server.send(JSON.stringify({ type: "video_enabled", enabled: this.videoEnabled }));

    // Auto-claim if role provided in URL or find free slot
    let finalRole = initialRole;
    if (finalRole === "spectator") {
       // try to find free slot (or slot with disconnected socket)
       for(const r of ["w0", "b0", "w1", "b1"] as const) {
          const slot = this.lobby.slots[r];
          const hasActiveSocket = (this.sockets as any)[r];
          if (!slot.isClaimed || (!hasActiveSocket && !slot.isBot)) {
             finalRole = r;
             break;
          }
       }
    }

    if (["w0", "b0", "w1", "b1"].includes(finalRole)) {
       const slot = (this.lobby.slots as any)[finalRole];
       if (slot && !slot.isClaimed) {
          slot.isClaimed = true;
          slot.isReady = true;
          slot.playerName = name;
          slot.sessionId = sessionId;
          (this.sockets as any)[finalRole] = server;
          this.sessions.get(server)!.role = finalRole;
          
          if (!this.lobby.adminSessionId) {
             this.lobby.adminSessionId = sessionId;
          }
       }
    }

    this.broadcastStatus();

    server.addEventListener("message", (event) => {
      let ratelimit = this.messageCounts.get(server);
      const now = Date.now();
      if (!ratelimit || now - ratelimit.lastReset > 1000) ratelimit = { count: 0, lastReset: now };
      ratelimit.count++;
      this.messageCounts.set(server, ratelimit);
      if (ratelimit.count > 20) return;

      if (!(event.data instanceof ArrayBuffer)) return;
      const buffer = new Uint8Array(event.data);
      try {
        const update = fromBinary(MatchUpdateSchema, buffer);
        if (update.event.case === "move") this.handleMove(update.event.value.uci, server);
        else if (update.event.case === "lobby") this.handleLobbyAction(update.event.value, server);
        else if (update.event.case === "action") this.handleAction(update.event.value, server);
        else if (update.event.case === "chat") this.handleChat(update.event.value, server);
      } catch (e) { console.error("Proto decode error", e); }
    });

    server.addEventListener("close", () => {
      const sData = this.sessions.get(server);
      const closedId = sData?.id;
      this.sessions.delete(server);
      for (const r of ["w0", "b0", "w1", "b1"] as const) {
        if ((this.sockets as any)[r] === server) {
          (this.sockets as any)[r] = null;
          this.lobby.slots[r].isClaimed = false;
          this.lobby.slots[r].isReady = false;
          this.lobby.slots[r].sessionId = "";
        }
      }
      // Reassign admin if left
      if (this.lobby.adminSessionId === closedId) {
         const nextSession = Array.from(this.sessions.values())[0];
         this.lobby.adminSessionId = nextSession ? nextSession.id : "";
      }

      if (this.isActive && this.sessions.size === 0) {
         this.disconnectTimer = setTimeout(() => this.forceCleanup(), 60000);
      } else {
         this.broadcastStatus();
      }
    });
  }

  handleLobbyAction(action: any, server: WebSocket) {
    const sData = this.sessions.get(server);
    if (!sData) return;
    const { type, role, name } = action;

    if (type === "claim" && !this.isStarted) {
       if (!["w0", "b0", "w1", "b1"].includes(role)) return;
       // Unclaim previous
       for(const r in this.lobby.slots) {
         if (this.lobby.slots[r as keyof typeof this.lobby.slots].sessionId === sData.id) {
            this.lobby.slots[r as keyof typeof this.lobby.slots] = { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false };
            (this.sockets as any)[r] = null;
         }
       }
       const target = (this.lobby.slots as any)[role];
       const hasActiveSocket = (this.sockets as any)[role];
       if (target && (!target.isClaimed || !hasActiveSocket)) {
          target.isClaimed = true;
          target.playerName = name || sData.name;
          target.isReady = true;
          target.sessionId = sData.id;
          target.isBot = false;
          (this.sockets as any)[role] = server;
          if (!this.lobby.adminSessionId) this.lobby.adminSessionId = sData.id;
       }
    } else if (type === "ready") {
       for(const r in this.lobby.slots) {
         const slot = this.lobby.slots[r as keyof typeof this.lobby.slots];
         if (slot.sessionId === sData.id) slot.isReady = !slot.isReady;
       }
    } else if (type === "force_assign" && sData.id === this.lobby.adminSessionId) {
        this.log(`Admin force assign: ${name} to ${role}`);
        // Clear target session from any slot
        for (const r in this.lobby.slots) {
            if (this.lobby.slots[r as keyof typeof this.lobby.slots].sessionId === name) {
               this.lobby.slots[r as keyof typeof this.lobby.slots] = { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false };
               (this.sockets as any)[r] = null;
            }
        }
        if (role !== "spectator") {
           const targetSlot = (this.lobby.slots as any)[role];
           if (targetSlot) {
              if (name === "bot") {
                 targetSlot.isClaimed = true;
                 targetSlot.playerName = "Bot Engine";
                 targetSlot.isReady = true;
                 targetSlot.sessionId = "bot-" + Math.random();
                 targetSlot.isBot = true;
              } else {
                 // find session by id
                 for (const [ws, data] of this.sessions.entries()) {
                    if (data.id === name) {
                       targetSlot.isClaimed = true;
                       targetSlot.playerName = data.name;
                       targetSlot.isReady = true;
                       targetSlot.sessionId = data.id;
                       (this.sockets as any)[role] = ws;
                       break;
                    }
                 }
              }
           }
        }
    } else if (type === "team_name" && sData.id === this.lobby.adminSessionId) {
       if (role === "team0") this.lobby.team0Name = name;
       if (role === "team1") this.lobby.team1Name = name;
     } else if (type === "bot_remove" && sData.id === this.lobby.adminSessionId) {
        const target = (this.lobby.slots as any)[role];
        if (target && target.isBot) {
           target.isClaimed = false;
           target.playerName = "";
           target.isReady = false;
           target.sessionId = "";
           target.isBot = false;
        }
     } else if (type === "start" && sData.id === this.lobby.adminSessionId) {
        const slots = Object.values(this.lobby.slots);
        if (slots.every(s => s.isClaimed)) {
           this.lobby.isAllReady = true;
           this.isStarted = true;
           this.lastMove0 = Date.now();
           this.lastMove1 = Date.now();
        }
     }

     this.broadcastStatus();
  }

  handleAction(action: any, server: WebSocket) {
    const sData = this.sessions.get(server);
    if (!sData) return;
    if (action.actionType === "resign" && this.isActive) {
       if (server === this.sockets.w0 || server === this.sockets.b1) this.endGame("0-1", "resignation");
       else if (server === this.sockets.b0 || server === this.sockets.w1) this.endGame("1-0", "resignation");
    }
  }

  handleChat(content: any, server: WebSocket) {
    const sData = this.sessions.get(server);
    const chatUpdate = create(MatchUpdateSchema, {
      event: { case: "chat", value: { sender: sData?.name || "Guest", text: String(content.text).substring(0, 500), timestamp: BigInt(Date.now()) } }
    });
    const binary = toBinary(MatchUpdateSchema, chatUpdate);
    this.sessions.forEach((_, s) => s.send(binary));
  }

  handleMove(uci: string, server: WebSocket) {
    if (!this.isActive || !this.isStarted) return;
    let boardIdx = -1, player = "";
    if (server === this.sockets.w0) { boardIdx = 0; player = "w"; }
    else if (server === this.sockets.b0) { boardIdx = 0; player = "b"; }
    else if (server === this.sockets.w1) { boardIdx = 1; player = "w"; }
    else if (server === this.sockets.b1) { boardIdx = 1; player = "b"; }
    if (boardIdx === -1) return;

    const engine = boardIdx === 0 ? this.engine0 : this.engine1;
    if (engine.turn() !== player) return;

    this.deductTimeThroughMove(boardIdx);

    if (uci.includes("@")) {
       const [pChar, target] = uci.split("@");
       const pieceType = pChar.toLowerCase();
       let bank = (boardIdx===0) ? (player==="w"?this.bank0w:this.bank0b) : (player==="w"?this.bank1w:this.bank1b);
       const idx = bank.findIndex(p => p.toLowerCase() === pieceType);
       if (idx === -1) return;
       if (engine.put({ type: pieceType as any, color: player as any }, target as any)) {
          if (engine.isCheck()) { engine.remove(target as any); return; }
          bank.splice(idx, 1);
          const f = engine.fen().split(" ");
          f[1] = f[1]==="w"?"b":"w"; f[3]="-"; f[4]="0";
          engine.load(f.join(" "));
       }
    } else {
       const move = engine.move({ from: uci.substring(0,2), to: uci.substring(2,4), promotion: uci[4] });
       if (!move) return;
       const promotedSquares = boardIdx===0?this.promotedSquares0:this.promotedSquares1;
       promotedSquares.delete(uci.substring(0,2));
       if (uci[4]) promotedSquares.add(uci.substring(2,4));
       if (move.captured) {
          const actualCaptured = promotedSquares.has(uci.substring(2,4)) ? "p" : move.captured;
          promotedSquares.delete(uci.substring(2,4));
          this.transferCapture(actualCaptured, boardIdx, player);
       }
    }
    if (boardIdx===0) this.moveCount0++; else this.moveCount1++;
    this.checkGameOver();
    this.broadcastStatus();
  }

  deductTimeThroughMove(boardIdx: number) {
     const now = Date.now();
     const last = boardIdx===0?this.lastMove0:this.lastMove1;
     const elapsed = now - last;
     const engine = boardIdx===0?this.engine0:this.engine1;
     const turn = engine.turn();
     if (boardIdx===0) {
        if (turn==='w') this.time0w-=elapsed; else this.time0b-=elapsed;
        this.lastMove0=now;
     } else {
        if (turn==='w') this.time1w-=elapsed; else this.time1b-=elapsed;
        this.lastMove1=now;
     }
  }

  transferCapture(piece: string, bIdx: number, pCol: string) {
    const p = piece.toUpperCase();
    if (bIdx===0) { if (pCol==='w') this.bank1b.push(p); else this.bank1w.push(p); }
    else { if (pCol==='w') this.bank0b.push(p); else this.bank0w.push(p); }
  }

  checkGameOver() {
    [0,1].forEach(i => {
       const e = i===0?this.engine0:this.engine1;
       if (e.isCheckmate() || e.isStalemate() || e.isThreefoldRepetition()) this.endGame(e.turn()==='w'?"0-1":"1-0", "checkmate_or_draw");
    });
  }

  endGame(res: string, reas: string) { this.isActive = false; this.result = res; this.reason = reas; this.broadcastStatus(); }

  broadcastStatus() {
    const createStatus = (e: Chess, tW: number, tB: number) => create(MatchStatusSchema, {
       fen: e.fen(), isActive: this.isActive, result: this.result, reason: this.reason,
       whiteTimeMs: Math.max(0, tW), blackTimeMs: Math.max(0, tB)
    });
    
    // Build spectator list for admin
    const connectedSpecs: {id: string, name: string}[] = [];
    this.sessions.forEach((data) => {
       // check if this session is NOT in any slot
       const inSlot = Object.values(this.lobby.slots).some(s => s.sessionId === data.id);
       if (!inSlot) connectedSpecs.push({id: data.id, name: data.name});
    });

    // Safety check for adminSessionId: ensure it points to a valid connected session
    const currentSessionsIds = Array.from(this.sessions.values()).map(s => s.id);
    if (!this.lobby.adminSessionId || !currentSessionsIds.includes(this.lobby.adminSessionId)) {
       const firstSession = Array.from(this.sessions.values())[0];
       this.lobby.adminSessionId = firstSession ? firstSession.id : "";
    }

    const bughouseStatus = create(BughouseStatusSchema, {
       board0: createStatus(this.engine0, this.time0w, this.time0b),
       board1: createStatus(this.engine1, this.time1w, this.time1b),
       bank0w: this.bank0w, bank0b: this.bank0b, bank1w: this.bank1w, bank1b: this.bank1b,
       lobby: {
          ...this.lobby,
          spectators: connectedSpecs as any // injection for admin
       } as any
    });

    const update = create(MatchUpdateSchema, { event: { case: "bughouse", value: { matchId: this.matchId, event: { case: "status", value: bughouseStatus } } } });
    const binary = toBinary(MatchUpdateSchema, update);
    
    const syncMsg = JSON.stringify({ 
      type: "lobby_sync", 
      adminSessionId: this.lobby.adminSessionId,
      spectators: connectedSpecs 
    });

    this.sessions.forEach((_, s) => {
      s.send(binary);
      s.send(syncMsg);
    });
  }

  forceCleanup() { if (this.sessions.size===0) this.isActive=false; }
}
