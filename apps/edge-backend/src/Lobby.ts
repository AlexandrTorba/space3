import { createDb, matches } from "@antigravity/database";

type Challenge = {
  id: string;
  socket: WebSocket;
  playerName: string;
  tc: string;
  colorPref: string;
  mode: "standard" | "bughouse";
  players: { name: string; socket: WebSocket; role: string }[];
};

export class Lobby {
  state: DurableObjectState;
  env: any;
  db: any;
  sessions: Set<WebSocket>;
  challenges: Map<string, Challenge> = new Map();
  virtualChallenges: Map<string, any> = new Map();
  botNames = ["Max Bot", "Alina Chess", "GM Alpha", "Petrovich", "Maria Bot", "Junior", "Stockfish Lite", "Agent 007", "Master Bot", "Noob Hunter"];

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
        
        if (data.type === "create") {
          const tc = data.timeControl || "3";
          const pName = data.playerName || "Гравець";
          const colorPref = data.colorPref || "random";
          const mode = data.mode || "standard";
          const id = crypto.randomUUID();
          
          this.removeUserChallenges(server);
          this.challenges.set(id, { 
             id, socket: server, playerName: pName, tc, colorPref, mode,
             players: [{ name: pName, socket: server, role: mode === "bughouse" ? "w0" : "" }]
          });
          this.broadcastChallenges();
          server.send(JSON.stringify({ type: "waiting_created", id }));
        }
        else if (data.type === "accept") {
           const vChallenge = this.virtualChallenges.get(data.challengeId);
           if (vChallenge) {
              const pName = data.playerName || "Гравець";
              const matchId = crypto.randomUUID();
              if (vChallenge.mode === "bughouse") {
                 server.send(JSON.stringify({ 
                    type: "MATCH_FOUND", matchId, mode: "bughouse", role: "w0", 
                    tc: vChallenge.tc, fillBots: true, opponent: vChallenge.playerName 
                 }));
              } else {
                 let myColor = Math.random() < 0.5 ? "white" : "black";
                 server.send(JSON.stringify({ 
                    type: "MATCH_FOUND", matchId, color: myColor, 
                    tc: vChallenge.tc, opponent: vChallenge.playerName, myName: pName, isBot: true
                 }));
              }
              this.virtualChallenges.delete(data.challengeId);
              this.broadcastChallenges();
              return;
           }
          const challenge = this.challenges.get(data.challengeId);
          if (challenge && challenge.socket !== server) {
             const pName = data.playerName || "Гравець";

             if (challenge.mode === "bughouse") {
                // Team assignment
                const roles = ["w0", "b0", "w1", "b1"];
                const nextRole = roles[challenge.players.length];
                challenge.players.push({ name: pName, socket: server, role: nextRole });
                
                if (challenge.players.length < 4) {
                   this.broadcastChallenges();
                   server.send(JSON.stringify({ type: "waiting_created", id: challenge.id })); 
                   return;
                }
                
                // All 4 joined!
                const matchId = crypto.randomUUID();
                challenge.players.forEach(p => {
                    p.socket.send(JSON.stringify({
                        type: "MATCH_FOUND", matchId, mode: "bughouse", role: p.role,
                        tc: challenge.tc, opponent: "Team Match"
                    }));
                });
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
         if (c.socket === server) {
             this.challenges.delete(id);
             removed = true;
         }
     }
     return removed;
  }
  
  async alarm() {
     // Maintain 10 bots
     if (this.virtualChallenges.size < 10) {
        const id = "bot_" + crypto.randomUUID();
        const name = this.botNames[Math.floor(Math.random() * this.botNames.length)];
        const tc = ["1", "3", "3+2", "5", "10", "Unlimited"][Math.floor(Math.random() * 6)];
        const mode = Math.random() < 0.3 ? "bughouse" : "standard";
        
        this.virtualChallenges.set(id, {
           id, playerName: name, tc, colorPref: "random", mode, isBot: true
        });
        this.broadcastChallenges();
     }
     
     // Occasionally remove a bot and add a new one to simulate rotation
     if (this.virtualChallenges.size >= 10 && Math.random() < 0.2) {
        const keys = Array.from(this.virtualChallenges.keys());
        const victim = keys[Math.floor(Math.random() * keys.length)];
        this.virtualChallenges.delete(victim);
        this.broadcastChallenges();
     }

     await this.state.storage.setAlarm(Date.now() + 15000); // Check every 15s
  }

  sendChallenges(server: WebSocket) {
     const bots = Array.from(this.virtualChallenges.values());
     const list = Array.from(this.challenges.values()).map(c => ({
         id: c.id, playerName: c.playerName, tc: c.tc, colorPref: c.colorPref, mode: c.mode, playersCount: c.players.length, isBot: false
     })).concat(bots);
     server.send(JSON.stringify({ type: "challenges_list", challenges: list }));
  }
  
  broadcastChallenges() {
     const bots = Array.from(this.virtualChallenges.values());
     const list = Array.from(this.challenges.values()).map(c => ({
         id: c.id, playerName: c.playerName, tc: c.tc, colorPref: c.colorPref, mode: c.mode, playersCount: c.players.length, isBot: false
     })).concat(bots);
     const msg = JSON.stringify({ type: "challenges_list", challenges: list });
     this.sessions.forEach(s => {
         try { s.send(msg); } catch(e) {}
     });
  }
}
