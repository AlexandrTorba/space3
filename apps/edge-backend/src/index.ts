import { ChessMatch } from "./ChessMatch";
import { Lobby } from "./Lobby";
import { createDb, matches } from "@antigravity/database";
import { eq, desc } from "drizzle-orm";

export { ChessMatch, Lobby };

export interface Env {
  CHESS_MATCH: DurableObjectNamespace;
  LOBBY: DurableObjectNamespace;
  TURSO_URL: string;
  TURSO_AUTH_TOKEN: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
    },
  });
}

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

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
      if (!env.TURSO_URL || !env.TURSO_AUTH_TOKEN) {
        return jsonResponse({ error: "Database configuration missing" }, 500);
      }

      try {
        const db = createDb(env.TURSO_URL, env.TURSO_AUTH_TOKEN);
        const matchId = path.split("/")[3];

        if (matchId) {
          const singleMatch = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
          return jsonResponse(singleMatch[0] || null);
        }

        const history = await db.select()
          .from(matches)
          .where(eq(matches.status, "finished"))
          .orderBy(desc(matches.createdAt))
          .limit(50);
          
        return jsonResponse(history);
      } catch (e) {
        console.error("Archive fetch error:", e);
        return jsonResponse({ error: "Failed to fetch archive" }, 500);
      }
    }

    // Live active matches Endpoint
    if (path.startsWith("/api/live")) {
      if (!env.TURSO_URL || !env.TURSO_AUTH_TOKEN) {
        return jsonResponse({ error: "Database configuration missing" }, 500);
      }

      try {
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
            const res = await stub.fetch(`http://internal/match/${m.id}/spectators`);
            if (res.ok) {
              const data: any = await res.json();
              return { ...m, spectators: data.count || 0 };
            }
            return { ...m, spectators: 0 };
          } catch(e) {
            return { ...m, spectators: 0 };
          }
        }));
            
        return jsonResponse(enriched);
      } catch (e) {
        console.error("Live fetch error:", e);
        return jsonResponse({ error: "Failed to fetch live matches" }, 500);
      }
    }

    return new Response(
      "AntigravityChess Edge Backend.\n- WSS /lobby to find a match\n- WSS /match/<match_id> to connect to a game.\n- GET /api/archive for game history.",
      { headers: { "Content-Type": "text/plain" } }
    );
  }
};

