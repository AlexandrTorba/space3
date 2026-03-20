import { createDb, matches } from "@antigravity/database";

type Challenge = {
  id: string;
  socket: WebSocket;
  playerName: string;
  tc: string;
  colorPref: string;
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
          const id = crypto.randomUUID();
          
          this.removeUserChallenges(server);
          this.challenges.set(id, { id, socket: server, playerName: pName, tc, colorPref });
          this.broadcastChallenges();
          server.send(JSON.stringify({ type: "waiting_created", id }));
        }
        else if (data.type === "accept") {
          const challenge = this.challenges.get(data.challengeId);
          if (challenge && challenge.socket !== server) {
             const matchId = crypto.randomUUID();
             const pName = data.playerName || "Гравець";
             
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
             
             // Acceptor message
             server.send(JSON.stringify({ 
                type: "MATCH_FOUND", matchId, color: acceptorColor, 
                tc: challenge.tc, opponent: challenge.playerName, myName: pName
             }));
             // Creator message
             try {
                challenge.socket.send(JSON.stringify({ 
                   type: "MATCH_FOUND", matchId, color: creatorColor, 
                   tc: challenge.tc, opponent: pName, myName: challenge.playerName
                }));
             } catch(e) {}
             
             if (this.db) {
                const whiteName = creatorColor === "white" ? challenge.playerName : pName;
                const blackName = creatorColor === "black" ? challenge.playerName : pName;
                
                const p = this.db.insert(matches).values({
                   id: matchId,
                   whiteName,
                   blackName,
                   timeControl: challenge.tc + (challenge.tc === "Unlimited" ? "" : "m"),
                   status: 'active',
                   fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
                   createdAt: new Date(),
                   updatedAt: new Date()
                }).onConflictDoNothing().execute().catch(console.error);
                
                this.state.waitUntil(p);
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
  
  sendChallenges(server: WebSocket) {
     const list = Array.from(this.challenges.values()).map(c => ({
         id: c.id, playerName: c.playerName, tc: c.tc, colorPref: c.colorPref
     }));
     server.send(JSON.stringify({ type: "challenges_list", challenges: list }));
  }
  
  broadcastChallenges() {
     const list = Array.from(this.challenges.values()).map(c => ({
         id: c.id, playerName: c.playerName, tc: c.tc, colorPref: c.colorPref
     }));
     const msg = JSON.stringify({ type: "challenges_list", challenges: list });
     this.sessions.forEach(s => {
         try { s.send(msg); } catch(e) {}
     });
  }
}
