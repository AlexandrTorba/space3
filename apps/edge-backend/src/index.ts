import { ChessMatch } from "./ChessMatch";
import { Lobby } from "./Lobby";
import { createDb, matches } from "@antigravity/database";
import { eq, desc } from "drizzle-orm";

export { ChessMatch, Lobby };

export interface Env {
  CHESS_MATCH: DurableObjectNamespace;
  LOBBY: DurableObjectNamespace;
  TURSO_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  LIBSQL_URL?: string;
  LIBSQL_AUTH_TOKEN?: string;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Upgrade", // Added Upgrade for WS check
};

function wrapResponse(response: Response): Response {
  if (response.status === 101) return response; // Don't touch WebSocket handshakes

  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    newHeaders.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    let response: Response;

    // Single global lobby for HyperBullet Matchmaking
    if (path.startsWith("/lobby")) {
      const id = env.LOBBY.idFromName("global-hyperbullet-lobby");
      const stub = env.LOBBY.get(id);
      response = await stub.fetch(request);
    }
    // Individual Match Routing
    else if (path.startsWith("/match/")) {
      const matchId = path.split("/")[2];
      if (matchId) {
        const id = env.CHESS_MATCH.idFromName(matchId);
        const stub = env.CHESS_MATCH.get(id);
        response = await stub.fetch(request);
      } else {
        response = new Response("Match ID missing", { status: 400 });
      }
    }
    // Archive History Endpoint
    else if (path.startsWith("/api/archive")) {
      const dbUrl = env.TURSO_URL || env.LIBSQL_URL;
      const dbToken = env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN;

      if (!dbUrl || !dbToken) {
        console.error("CRITICAL: Database configuration is missing! Neither TURSO_URL/LIBSQL_URL nor flags are set.");
        response = new Response(JSON.stringify({ 
          error: "Database configuration missing", 
          details: "Please set LIBSQL_URL and LIBSQL_AUTH_TOKEN in Cloudflare Dashboard" 
        }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      } else {
        try {
          const db = createDb(dbUrl, dbToken);
          const matchId = path.split("/")[3];

          if (matchId) {
            const singleMatch = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
            response = new Response(JSON.stringify(singleMatch[0] || null), { headers: { "Content-Type": "application/json" } });
          } else {
            const history = await db.select()
              .from(matches)
              .where(eq(matches.status, "finished"))
              .orderBy(desc(matches.createdAt))
              .limit(50);
            response = new Response(JSON.stringify(history), { headers: { "Content-Type": "application/json" } });
          }
        } catch (e) {
          console.error("Archive fetch error:", e);
          response = new Response(JSON.stringify({ error: "Failed to fetch archive" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      }
    }
    // Live active matches Endpoint
    else if (path.startsWith("/api/live")) {
      const dbUrl = env.TURSO_URL || env.LIBSQL_URL;
      const dbToken = env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN;

      if (!dbUrl || !dbToken) {
        response = new Response(JSON.stringify({ error: "Database configuration missing" }), { status: 500, headers: { "Content-Type": "application/json" } });
      } else {
        try {
          const db = createDb(dbUrl, dbToken);
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
            } catch (e) {
              return { ...m, spectators: 0 };
            }
          }));
          response = new Response(JSON.stringify(enriched), { headers: { "Content-Type": "application/json" } });
        } catch (e) {
          console.error("Live fetch error:", e);
          response = new Response(JSON.stringify({ error: "Failed to fetch live matches" }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      }
    }
    // Admin Cleanup Endpoint
    else if (path === "/api/admin/clear") {
      const dbUrl = env.TURSO_URL || env.LIBSQL_URL;
      const dbToken = env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN;

      if (!dbUrl || !dbToken) {
        response = new Response(JSON.stringify({ error: "Database configuration missing" }), { status: 500 });
      } else {
        try {
          const db = createDb(dbUrl, dbToken);
          // Set all active games to 'finished' with reason 'abandoned'
          await db.update(matches)
            .set({ status: 'finished', result: '1/2-1/2', reason: 'cleanup', updatedAt: new Date() })
            .where(eq(matches.status, 'active'))
            .execute();
          
          // Clear Lobby challenges
          try {
             const id = env.LOBBY.idFromName("global-hyperbullet-lobby");
             const stub = env.LOBBY.get(id);
             await stub.fetch("http://internal/clear", { method: "POST" });
          } catch(e) {}

          response = new Response(JSON.stringify({ success: true, message: "All active matches cleared" }), { 
            headers: { "Content-Type": "application/json" } 
          });
        } catch (e) {
          console.error("Cleanup error:", e);
          response = new Response(JSON.stringify({ error: "Failed to clear matches" }), { status: 500 });
        }
      }
    } else {
      response = new Response(
        "AntigravityChess Edge Backend.\n- WSS /lobby to find a match\n- WSS /match/<match_id> to connect to a game.\n- GET /api/archive for game history.\n- GET /api/admin/clear to clear live games.",
        { headers: { "Content-Type": "text/plain" } }
      );
    }

    return wrapResponse(response);
  }
};


