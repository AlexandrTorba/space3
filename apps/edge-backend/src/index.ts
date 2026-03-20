import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client/web';

import { ChessMatch } from "./ChessMatch";
import { Lobby } from "./Lobby";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
 // "Access-Control-Allow-Origin": "https://space3-frontend.vercel.app",
 // "Access-Control-Allow-Headers": "Content-Type",
}
export { ChessMatch, Lobby };

export interface Env {
  CHESS_MATCH: DurableObjectNamespace;
  LOBBY: DurableObjectNamespace;
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;
};

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders, });  
    }

    try {
      const client = createClient({
        url: env.TURSO_URL,
        authToken: env.TURSO_AUTH_TOKEN,
      });
      const db = drizzle(client);

    // Single global lobby for HyperBullet Matchmaking
    if (path.startsWith("/lobby")) {
      const id = env.LOBBY.idFromName("global-hyperbullet-lobby");
      const stub = env.LOBBY.get(id);
      return stub.fetch(request);
    }

    // Individual Match Routing
    if (path.startsWith("/match/")) {
      const matchId = path.split("/")[2];
      if (matchId) {
        const id = env.CHESS_MATCH.idFromName(matchId);
        const stub = env.CHESS_MATCH.get(id);
        return stub.fetch(request);
      }
    }

    // Archive History Endpoint
    if (path.startsWith("/api/archive")) {
      if (env.TURSO_URL && env.TURSO_AUTH_TOKEN) {
        try {
          const { createDb, matches } = await import("@antigravity/database");
          const { eq, desc } = await import("drizzle-orm");
          const db = createDb(env.TURSO_URL, env.TURSO_AUTH_TOKEN);
          
          const matchId = path.split("/")[3];

          if (matchId) {
              const singleMatch = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
              return new Response(JSON.stringify(singleMatch[0] || null), {
                 headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
              });
          }

          const history = await db.select()
              .from(matches)
              .where(eq(matches.status, "finished"))
              .orderBy(desc(matches.createdAt))
              .limit(50);
              
          return new Response(JSON.stringify(history), {
             headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: "Failed to fetch archive" }), { status: 500 });
        }
      }
      return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    // Live active matches Endpoint
    if (path.startsWith("/api/live")) {
      if (env.TURSO_URL && env.TURSO_AUTH_TOKEN) {
        try {
          const { createDb, matches } = await import("@antigravity/database");
          const { eq, desc } = await import("drizzle-orm");
          const db = createDb(env.TURSO_URL, env.TURSO_AUTH_TOKEN);
          
          const live = await db.select()
              .from(matches)
              .where(eq(matches.status, "active"))
              .orderBy(desc(matches.updatedAt))
              .limit(50);
              
          const enriched = await Promise.all(live.map(async m => {
              try {
                  const id = env.CHESS_MATCH.idFromName(m.id);
                  const stub = env.CHESS_MATCH.get(id);
                  const res = await stub.fetch(`http://localhost/match/${m.id}/spectators`);
                  const data: any = await res.json();
                  return { ...m, spectators: data.count || 0 };
              } catch(e) {
                  return { ...m, spectators: 0 };
              }
          }));
              
          return new Response(JSON.stringify(enriched), {
             headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
          });
        } catch (e) {
          return new Response(JSON.stringify({ error: "Failed to fetch live matches" }), { status: 500 });
        }
      }
      return new Response(JSON.stringify([]), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
    }

    return new Response(
      "AntigravityChess Edge Backend.\n- WSS /lobby to find a match\n- WSS /match/<match_id> to connect to a game.\n- GET /api/archive for game history."
    );
  }
};
