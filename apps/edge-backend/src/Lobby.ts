import { createDb, matches } from "@antigravity/database";

type Challenge = {
  id: string;
  socket: WebSocket;
  playerName: string;
  tc: string;
  colorPref: string;
  mode: "standard" | "bughouse";
  players: { name: string; socket: WebSocket; role: string }[];
  vsBots?: boolean;
};

export class Lobby {
  state: DurableObjectState;
  env: any;
  db: any;
  sessions: Set<WebSocket>;
  challenges: Map<string, Challenge> = new Map();

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    
    const url = this.env.TURSO_URL || this.env.LIBSQL_URL;
    const token = this.env.TURSO_AUTH_TOKEN || this.env.LIBSQL_AUTH_TOKEN;
    
    if (url && token) {
       this.db = createDb(url, token);
    }
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/clear")) {
       this.challenges.clear();
       this.broadcastChallenges();
       return new Response(JSON.stringify({ success: true }));
    }

    if (request.headers.get("Upgrade") !== "websocket") {
       return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    server.accept();
    this.sessions.add(server);
    
    this.sendChallenges(server);

    server.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data as string);
        if (!data || typeof data !== "object") return;

        // Rate limiting (simple)
        (server as any).lastMessageTime = (server as any).lastMessageTime || 0;
        const now = Date.now();
        if (now - (server as any).lastMessageTime < 100) return; // 10 ops/sec max
        (server as any).lastMessageTime = now;
        
        if (data.type === "ping") {
          server.send(JSON.stringify({ type: "pong" }));
          return;
        }

        if (data.type === "create") {
          const tc = String(data.timeControl || "3").substring(0, 10);
          let pName = String(data.playerName || "Player").trim().substring(0, 32);
          if (!pName) pName = "Player";
          
          const colorPref = data.colorPref || "random";
          const mode = data.mode || "standard";
          
          // Limit total challenges to prevent memory exhaustion
          if (this.challenges.size > 100) {
             server.send(JSON.stringify({ type: "error", message: "Lobby full, please try again later" }));
             return;
          }
          const fillBots = !!data.fillBots || !!data.vsBots;
          const vsBots = fillBots;
          const id = crypto.randomUUID();
          
          this.removeUserChallenges(server);

          if (vsBots) {
              const matchId = crypto.randomUUID();
              if (mode === "bughouse") {
                  let initialRole = "w0";
                  if (colorPref === "black") {
                     initialRole = Math.random() > 0.5 ? "b0" : "b1";
                  } else if (colorPref === "white") {
                     initialRole = Math.random() > 0.5 ? "w0" : "w1";
                  } else {
                     const roles = ["w0", "b0", "w1", "b1"] as const;
                     initialRole = roles[Math.floor(Math.random() * roles.length)];
                  }

                  server.send(JSON.stringify({
                      type: "MATCH_FOUND", matchId, mode: "bughouse", role: initialRole,
                      tc, opponent: "AI Practice", fillBots: true
                  }));
              } else {
                  let myColor = colorPref === "random" ? (Math.random() > 0.5 ? "white" : "black") : colorPref;
                  server.send(JSON.stringify({
                      type: "MATCH_FOUND", matchId, color: myColor,
                      tc, opponent: "Stockfish Lite", isBot: true
                  }));
              }
              return;
          }

          if (mode === "bughouse") {
             const matchId = crypto.randomUUID();
             const initialRole = (colorPref === "black") 
                ? (Math.random() > 0.5 ? "b0" : "b1") 
                : (colorPref === "white" 
                    ? (Math.random() > 0.5 ? "w0" : "w1") 
                    : (["w0", "b0", "w1", "b1"] as const)[Math.floor(Math.random() * 4)]);
             
             this.challenges.set(matchId, { 
                id: matchId, socket: server, playerName: pName, tc, colorPref: colorPref || "random", mode,
                players: [{ name: pName, socket: server, role: initialRole }]
             });
             this.broadcastChallenges();
             server.send(JSON.stringify({ 
                type: "MATCH_FOUND", matchId, mode: "bughouse", role: initialRole, tc, opponent: "Bughouse Arena", fillBots: fillBots
             }));
             return;
          }

          this.challenges.set(id, { 
             id, socket: server, playerName: pName, tc, colorPref, mode,
             players: [{ name: pName, socket: server, role: "" }]
          });
          this.broadcastChallenges();
          server.send(JSON.stringify({ type: "waiting_created", id }));
        }
        else if (data.type === "accept") {
          const challenge = this.challenges.get(String(data.challengeId));
          if (challenge && challenge.socket !== server) {
             const pName = String(data.playerName || "Player").trim().substring(0, 32);

             if (challenge.mode === "bughouse") {
                server.send(JSON.stringify({
                   type: "MATCH_FOUND", matchId: challenge.id, mode: "bughouse", role: "spectator",
                   tc: challenge.tc, opponent: challenge.playerName
                }));
                return;
             } else {
                const matchId = crypto.randomUUID();
                let creatorColor = "white";
                let acceptorColor = "black";
                if (challenge.colorPref === "black") {
                   creatorColor = "black";
                   acceptorColor = "white";
                } else if (challenge.colorPref === "random") {
                   if (Math.random() > 0.5) {
                      creatorColor = "black";
                      acceptorColor = "white";
                   }
                }
                
                server.send(JSON.stringify({ 
                   type: "MATCH_FOUND", matchId, color: acceptorColor, 
                   tc: challenge.tc, opponent: challenge.playerName, myName: pName
                }));
                challenge.socket.send(JSON.stringify({ 
                   type: "MATCH_FOUND", matchId, color: creatorColor, 
                   tc: challenge.tc, opponent: pName, myName: challenge.playerName
                }));

                if (this.db) {
                   const whiteName = creatorColor === "white" ? challenge.playerName : pName;
                   const blackName = creatorColor === "black" ? challenge.playerName : pName;
                   const p = this.db.insert(matches).values({
                      id: matchId, whiteName, blackName,
                      timeControl: challenge.tc + (challenge.tc === "Unlimited" ? "" : "m"),
                      status: 'active',
                      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                      createdAt: new Date(), updatedAt: new Date()
                   }).onConflictDoNothing().execute().catch(console.error);
                   this.state.waitUntil(p);
                }
             }

             this.removeUserChallenges(server);
             this.removeUserChallenges(challenge.socket);
             this.broadcastChallenges();
          } else {
             server.send(JSON.stringify({ type: "error", message: "Challenge not an option" }));
          }
        }
        else if (data.type === "cancel") {
          this.removeUserChallenges(server);
          this.broadcastChallenges();
        }
        else if (data.type === "clear") {
          this.challenges.clear();
          this.broadcastChallenges();
        }
      } catch (err) {
        server.send(JSON.stringify({ error: "Invalid JSON format" }));
      }
    });

    server.addEventListener("close", () => {
      this.sessions.delete(server);
      if (this.removeUserChallenges(server)) {
         this.broadcastChallenges();
      }
    });

    server.addEventListener("error", () => {
      this.sessions.delete(server);
      if (this.removeUserChallenges(server)) {
         this.broadcastChallenges();
      }
    });

    return new Response(null, { status: 101, webSocket: client });
  }
  
  removeUserChallenges(server: WebSocket): boolean {
     let removed = false;
     for (const [id, c] of this.challenges.entries()) {
         if (c.socket === server && c.mode !== "bughouse") {
             this.challenges.delete(id);
             removed = true;
         }
     }
     return removed;
  }
  
  sendChallenges(server: WebSocket) {
     const list = Array.from(this.challenges.values()).map(c => ({
         id: c.id, playerName: c.playerName, tc: c.tc, colorPref: c.colorPref, mode: c.mode, playersCount: c.players.length
     }));
     server.send(JSON.stringify({ type: "challenges_list", challenges: list }));
  }
  
  broadcastChallenges() {
     const list = Array.from(this.challenges.values()).map(c => ({
         id: c.id, playerName: c.playerName, tc: c.tc, colorPref: c.colorPref, mode: c.mode, playersCount: c.players.length
     }));
     const msg = JSON.stringify({ type: "challenges_list", challenges: list });
     this.sessions.forEach(s => {
         try { s.send(msg); } catch(e) {}
     });
  }
}
