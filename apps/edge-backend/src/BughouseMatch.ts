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
  activityLogs: string[] = [];
  
  log(msg: string, isPublic: boolean = false) {
    console.log(msg);
    const stamped = `[${new Date().toLocaleTimeString()}] ${msg}`;
    this.debugLogs.push(stamped);
    if (this.debugLogs.length > 100) this.debugLogs.shift();
    if (isPublic) {
       this.activityLogs.push(msg);
       if (this.activityLogs.length > 50) this.activityLogs.shift();
    }
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

  isActive = false;
  isStarted = false;
  private videoEnabled: boolean = true;
  private matchId: string = "unknown";
  result = "";
  reason = "";
  private disconnectTimer: any = null;
  private tickInterval: any = null;
  dbInserted: boolean = false;
  db: any;

  lobby = {
    w0: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
    b0: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
    w1: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
    b1: { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false },
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
    this.log(`New session: ${sessionId} (${name}), initialRole: ${initialRole}`);
    
    this.sessions.set(server, { id: sessionId, name, role: "spectator" }); // default to spec

    if (this.disconnectTimer) {
       clearTimeout(this.disconnectTimer);
       this.disconnectTimer = null;
    }

    server.send(JSON.stringify({ type: "session_id", id: sessionId }));
    server.send(JSON.stringify({ type: "video_enabled", enabled: this.videoEnabled }));

    // Auto-claim logic
    let finalRole = initialRole;
    if (finalRole === "spectator") {
       for(const r of ["w0", "b0", "w1", "b1"] as const) {
          const slot = (this.lobby as any)[r];
          const hasActiveSocket = (this.sockets as any)[r];
          if (!slot.isClaimed || (!hasActiveSocket && !slot.isBot)) {
             finalRole = r;
             break;
          }
       }
    }

    this.log(`Attempting to seat ${sessionId} in ${finalRole}`);
    if (["w0", "b0", "w1", "b1"].includes(finalRole)) {
       const slot = (this.lobby as any)[finalRole];
       // In an active match: only reassign if the slot has no active socket (reconnect case)
       // or if the slot is not claimed yet.
       // Never overwrite a human's slot with a new session if they're still connected.
       // Use readyState to check if the existing socket is actually alive
       const existingSocket = (this.sockets as any)[finalRole];
       const hasActiveSocket = !!(existingSocket && existingSocket.readyState === WebSocket.OPEN);
       const isBotSlot = slot?.isBot;
       if (slot && (!slot.isClaimed || (!hasActiveSocket && !isBotSlot))) {
          slot.isClaimed = true;
          slot.isReady = true;
          slot.playerName = name;
          slot.sessionId = sessionId;
          slot.isBot = false;
          (this.sockets as any)[finalRole] = server;
          this.sessions.get(server)!.role = finalRole;
          this.log(`Seated ${sessionId} successfully in ${finalRole}`);
          
          if (!this.lobby.adminSessionId) {
             this.lobby.adminSessionId = sessionId;
             this.log(`Assigned admin to ${sessionId}`);
          }
       } else if (slot && hasActiveSocket && slot.sessionId !== sessionId) {
          this.log(`Slot ${finalRole} already taken by ${slot.sessionId}. ${sessionId} becomes spectator.`);
       } else if (slot && !hasActiveSocket && isBotSlot) {
          // Slot has a bot, but no socket — allow human to reclaim if match hasn't started
          if (!this.isStarted) {
             slot.isClaimed = true;
             slot.isReady = true;
             slot.playerName = name;
             slot.sessionId = sessionId;
             slot.isBot = false;
             (this.sockets as any)[finalRole] = server;
             this.sessions.get(server)!.role = finalRole;
             this.log(`Reclaimed bot slot ${finalRole} for ${sessionId}`);
          } else {
             // Match started, bot slot — reconnect as the owner by updating the socket
             // This handles the case where the same player reconnects
             this.log(`Match started, slot ${finalRole} has a bot. ${sessionId} becomes spectator.`);
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

      if (!(event.data instanceof ArrayBuffer)) {
         try {
            const json = JSON.parse(event.data as string);
            if (json.type === "lobby") {
               // Handle both {type: "lobby", action: {...}} and flat structure
               const lobbyAction = json.action || json;
               this.handleLobbyAction(lobbyAction, server);
            }
         } catch(e){}
         return;
      }
      const update = fromBinary(MatchUpdateSchema, new Uint8Array(event.data));
      this.handleUpdate(update, server);
    });

    server.addEventListener("close", () => {
      this.log(`Session closed: ${sessionId}`);
      const s = this.sessions.get(server);
      if (s) {
         this.sessions.delete(server);
      }
      // Clear socket slot so the player can reconnect
      for (const r of ["w0", "b0", "w1", "b1"] as const) {
         if ((this.sockets as any)[r] === server) {
            (this.sockets as any)[r] = null;
            this.log(`Cleared socket slot ${r} after disconnect`);
         }
      }
      if (this.sessions.size === 0) {
         this.disconnectTimer = setTimeout(() => this.forceCleanup(), 60000);
      } else {
         this.broadcastStatus();
      }
    });

    server.addEventListener("error", (e) => {
       this.log(`WebSocket error for ${sessionId}: ${e}`);
    });
  }

  handleUpdate(update: any, server: WebSocket) {
    if (update.event.case === "move") this.handleMove(update.event.value.uci, server);
    else if (update.event.case === "lobby") this.handleLobbyAction(update.event.value, server);
    else if (update.event.case === "action") this.handleAction(update.event.value, server);
    else if (update.event.case === "chat") this.handleChat(update.event.value, server);
  }

  handleLobbyAction(action: any, server: WebSocket) {
    const sData = this.sessions.get(server);
    if (!sData) {
       this.log(`handleLobbyAction: sData not found for socket!`);
       return;
    }
    const id = sData.id;
    const isAdmin = id === this.lobby.adminSessionId;

    console.log(`[BughouseMatch] handleLobbyAction from ${sData.name} (${id}):`, action);
    const { type, role, name } = action;
    this.log(`LobbyAction: ${type} from ${sData.id} (${sData.role})`);

    if (type === "claim" && !this.isStarted) {
       if (!["w0", "b0", "w1", "b1"].includes(role)) return;
       // Unclaim previous
       for(const r of ["w0", "b0", "w1", "b1"] as const) {
          const s = (this.lobby as any)[r];
          if (s.sessionId === sData.id) {
             this.log(`Clearing old slot ${r} for session ${sData.id}`);
             (this.lobby as any)[r] = { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false };
             (this.sockets as any)[r] = null;
          }
       }
       const target = (this.lobby as any)[role];
       const hasActiveSocket = (this.sockets as any)[role];
       if (target && (!target.isClaimed || !hasActiveSocket)) {
          target.isClaimed = true;
          target.playerName = name || sData.name;
          target.isReady = true;
          target.sessionId = sData.id;
          target.isBot = false;
          (this.sockets as any)[role] = server;
          sData.role = role;
          this.log(`Claimed ${role} for ${sData.id}`);
          if (!this.lobby.adminSessionId) this.lobby.adminSessionId = sData.id;
       }
    } else if (type === "ready") {
       for(const r of ["w0", "b0", "w1", "b1"] as const) {
          const slot = (this.lobby as any)[r];
          if (slot.sessionId === sData.id) {
             slot.isReady = !slot.isReady;
             this.log(`Toggled ready for ${sData.id} on ${r}: ${slot.isReady}`);
          }
       }
    } else if (type === "force_assign" && sData.id === this.lobby.adminSessionId) {
        this.log(`Admin force assign: ${name} to ${role}`);
        // Clear target session from any slot
        for (const r of ["w0", "b0", "w1", "b1"] as const) {
            if ((this.lobby as any)[r].sessionId === name) {
               (this.lobby as any)[r] = { isClaimed: false, playerName: "", isReady: false, sessionId: "", isBot: false };
               (this.sockets as any)[r] = null;
            }
        }
        if (role !== "spectator") {
           const targetSlot = (this.lobby as any)[role];
           if (targetSlot) {
              if (name === "bot") {
                 targetSlot.isClaimed = true;
                 targetSlot.playerName = "Bot Engine";
                 targetSlot.isReady = true;
                 targetSlot.sessionId = "bot-" + Math.random();
                 targetSlot.isBot = true;
                 this.log(`Bot added to ${role}`);
              } else {
                 this.log(`Force assigning player ${name} to ${role}`);
                 for (const [ws, data] of this.sessions.entries()) {
                    if (data.id === name) {
                       targetSlot.isClaimed = true;
                       targetSlot.playerName = data.name;
                       targetSlot.isReady = true;
                       targetSlot.sessionId = data.id;
                       (this.sockets as any)[role] = ws;
                       data.role = role;
                       break;
                    }
                 }
              }
           }
        }
    } else if (type === "team_name" && sData.id === this.lobby.adminSessionId) {
        this.log(`Team name update: ${role} to ${name}`);
        if (role === "team0") this.lobby.team0Name = name;
        if (role === "team1") this.lobby.team1Name = name;
    } else if (type === "bot_remove" && sData.id === this.lobby.adminSessionId) {
        this.log(`Removing bot from ${role}`);
        const target = (this.lobby as any)[role];
        if (target && target.isBot) {
           target.isClaimed = false;
           target.playerName = "";
           target.isReady = false;
           target.sessionId = "";
           target.isBot = false;
        }
    } else if (type === "fill_bots") {
        this.log(`Attempting to fill bots. User: ${sData.id}, Admin: ${this.lobby.adminSessionId}`, true);
        if (sData.id !== this.lobby.adminSessionId) {
             this.log("Fill bots rejected: not admin", true);
             return;
        }
        for (const r of ["w0", "b0", "w1", "b1"] as const) {
           const slot = (this.lobby as any)[r];
           const socket = (this.sockets as any)[r];
           if (!slot.isClaimed || (!socket && !slot.isBot)) {
              slot.isClaimed = true;
              slot.playerName = "Bot Engine";
              slot.isReady = true;
              slot.sessionId = "bot-" + Math.random();
              slot.isBot = true;
           }
        }
    } else if (type === "start" && sData.id === this.lobby.adminSessionId) {
        this.log(`Match start requested by admin`, true);
        const slots = [this.lobby.w0, this.lobby.b0, this.lobby.w1, this.lobby.b1];
        const missing = slots.filter(s => !s.isClaimed);
        if (missing.length === 0) {
           this.startMatch();
        } else {
           this.log(`Cannot start: ${missing.length} slots missing`, true);
           this.systemChat(`Cannot start: Need 4 players or bots. Try 'Fill with Bots' button.`);
        }
    }

    this.broadcastStatus();
  }

  startMatch() {
    if (this.isStarted) {
        this.log("startMatch: Already started.");
        return;
    }
    this.isStarted = true;
    this.isActive = true;
    this.lobby.isAllReady = true;

    // Reset engines
    this.engine0.reset();
    this.engine1.reset();
    this.moveCount0 = 0;
    this.moveCount1 = 0;
    this.bank0w = []; this.bank0b = []; this.bank1w = []; this.bank1b = [];
    this.time0w = this.lobby.timeControlMs;
    this.time0b = this.lobby.timeControlMs;
    this.time1w = this.lobby.timeControlMs;
    this.time1b = this.lobby.timeControlMs;
    this.lastMove0 = Date.now();
    this.lastMove1 = Date.now();

    this.log(`Match started! Timer initialized.`, true);

    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = setInterval(() => {
        if (this.isActive) {
            this.deductTimeThroughMove(0);
            this.deductTimeThroughMove(1);
            this.broadcastStatus();
        } else {
            clearInterval(this.tickInterval);
            this.tickInterval = null;
        }
    }, 1000);
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
    this.log(`handleMove: uci=${uci}, isActive=${this.isActive}, isStarted=${this.isStarted}`);
    if (!this.isActive || !this.isStarted) {
        this.log(`handleMove rejected: not active/started`);
        return;
    }
    let boardIdx = -1, player = "";
    const isW0 = server === this.sockets.w0;
    const isB0 = server === this.sockets.b0;
    const isW1 = server === this.sockets.w1;
    const isB1 = server === this.sockets.b1;
    this.log(`handleMove socket checks: isW0=${isW0}, isB0=${isB0}, isW1=${isW1}, isB1=${isB1}`);
    if (isW0) { boardIdx = 0; player = "w"; }
    else if (isB0) { boardIdx = 0; player = "b"; }
    else if (isW1) { boardIdx = 1; player = "w"; }
    else if (isB1) { boardIdx = 1; player = "b"; }
    if (boardIdx === -1) {
        this.log(`handleMove rejected: server not in sockets map. sockets w0=${!!this.sockets.w0}, b0=${!!this.sockets.b0}, w1=${!!this.sockets.w1}, b1=${!!this.sockets.b1}`);
        return;
    }

    const engine = boardIdx === 0 ? this.engine0 : this.engine1;
    this.log(`handleMove: engine.turn()=${engine.turn()}, player=${player}, fen=${engine.fen().substring(0,30)}`);
    if (engine.turn() !== player) {
        const msg = JSON.stringify({ type: "debug", msg: `move rejected: not your turn. engine.turn=${engine.turn()}, player=${player}` });
        server.send(msg);
        return;
    }

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
        if (!move) {
            const msg = JSON.stringify({ type: "debug", msg: `move rejected by engine: uci=${uci}, from=${uci.substring(0,2)}, to=${uci.substring(2,4)}, fen=${engine.fen().substring(0,40)}` });
            server.send(msg);
            return;
        }
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
       const slots = [this.lobby.w0, this.lobby.b0, this.lobby.w1, this.lobby.b1];
       const inSlot = slots.some(s => s.sessionId === data.id);
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
          spectators: connectedSpecs as any, // injection for admin
          logs: this.activityLogs as any
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

  systemChat(text: string) {
    const update = create(MatchUpdateSchema, {
      event: { case: "chat", value: { sender: "SYSTEM", text, timestamp: BigInt(Date.now()) } }
    });
    const binary = toBinary(MatchUpdateSchema, update);
    this.sessions.forEach((_, s) => s.send(binary));
  }

  forceCleanup() { if (this.sessions.size===0) this.isActive=false; }
}
