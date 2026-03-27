import { ChessMatch } from "./ChessMatch";
import { BughouseMatch } from "./BughouseMatch";
import { Lobby } from "./Lobby";
import { createDb, matches } from "@antigravity/database";
import { eq, desc } from "drizzle-orm";

export { ChessMatch, BughouseMatch, Lobby };

export interface Env {
  CHESS_MATCH: DurableObjectNamespace;
  BUGHOUSE_MATCH: DurableObjectNamespace;
  LOBBY: DurableObjectNamespace;
  TURSO_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  LIBSQL_URL?: string;
  LIBSQL_AUTH_TOKEN?: string;
  DAILY_API_KEY?: string;
  DAILY_DOMAIN?: string;
  ADMIN_SECRET?: string;
}

const CORS_HEADERS = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin || "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Admin-Secret",
});

// Note: localMatchRegistry removed as we use DB in production

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    const origin = request.headers.get("Origin");
    
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS(origin) });
    }

    let response: Response | undefined; // Initialize as undefined

    if (path.startsWith("/lobby")) {
      const id = env.LOBBY.idFromName("global-hyperbullet-lobby");
      const stub = env.LOBBY.get(id);
      
      // Monitor match creation events from lobby logs (simplified for local proxy)
      const res = await stub.fetch(request);
      if (res.status === 101) return res; // WebSocket
      response = res;
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
    // Bughouse Match Routing
    else if (path.startsWith("/bughouse/")) {
      const matchId = path.split("/")[2];
      if (matchId) {
        const id = env.BUGHOUSE_MATCH.idFromName(matchId);
        const stub = env.BUGHOUSE_MATCH.get(id);
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
          response = new Response(JSON.stringify({ error: "Failed to fetch archive" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }
    // Live active matches Endpoint
    else if (path.startsWith("/api/live")) {
      const dbUrl = env.TURSO_URL || env.LIBSQL_URL;
      const dbToken = env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN;

      if (!dbUrl || !dbToken) {
        response = new Response(JSON.stringify({ error: "Database configuration missing" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
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
          response = new Response(JSON.stringify({ error: "Failed to fetch live matches" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }
    }
    // Admin Video Control Endpoint
    else if (path.startsWith("/api/admin/match/video")) {
       const matchId = url.searchParams.get("matchId");
       const enabled = url.searchParams.get("enabled") === "true";
       const secret = request.headers.get("X-Admin-Secret");

       if (env.ADMIN_SECRET && secret !== env.ADMIN_SECRET) {
          response = new Response("Unauthorized", { status: 401, headers: CORS_HEADERS(origin) });
       } else if (!env.ADMIN_SECRET) {
          response = new Response("Admin Secret not configured", { status: 500, headers: CORS_HEADERS(origin) });
       } else if (!matchId) {
          response = new Response("Match ID missing", { status: 400, headers: CORS_HEADERS(origin) });
       } else {
          // Send to BOTH Chess AND Bughouse namespaces to be sure
          const chessStub = env.CHESS_MATCH.get(env.CHESS_MATCH.idFromName(matchId));
          const bughouseStub = env.BUGHOUSE_MATCH.get(env.BUGHOUSE_MATCH.idFromName(matchId));
          
          await chessStub.fetch(request.clone());
          await bughouseStub.fetch(request.clone());

          // Also update the database status if possible
          const dbUrl = env.TURSO_URL || env.LIBSQL_URL;
          const dbToken = env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN;
          if (dbUrl && dbToken) {
             try {
                const db = createDb(dbUrl, dbToken);
                await db.update(matches).set({ videoEnabled: enabled }).where(eq(matches.id, matchId));
             } catch(e) {}
          }
          
          response = new Response("OK");
       }
    }
    // Admin Cleanup Endpoint
    else if (path.startsWith("/api/admin/clear")) {
      const dbUrl = env.TURSO_URL || env.LIBSQL_URL;
      const dbToken = env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN;

      if (!dbUrl || !dbToken) {
        response = new Response(JSON.stringify({ error: "Database configuration missing" }), { status: 500 });
      } else {
        try {
          const db = createDb(dbUrl, dbToken);
          // Delete ALL matches for a clean start
          await db.delete(matches).execute();
          
          // Clear Lobby challenges
          try {
             const id = env.LOBBY.idFromName("global-hyperbullet-lobby");
             const stub = env.LOBBY.get(id);
             await stub.fetch("http://internal/clear", { method: "POST" });
          } catch(e) {}

          response = new Response(JSON.stringify({ success: true, message: "All matches cleared from database" }), { 
            headers: { "Content-Type": "application/json" } 
          });
        } catch (e) {
          console.error("Cleanup error:", e);
          response = new Response(JSON.stringify({ error: "Failed to clear matches" }), { status: 500 });
        }
      }
    }
    // Admin Video Rooms Flush Endpoint (Daily.co)
    else if (path.startsWith("/api/admin/video/flush")) {
       const apiKey = env.DAILY_API_KEY;
       const secret = request.headers.get("X-Admin-Secret");

       if (env.ADMIN_SECRET && secret !== env.ADMIN_SECRET) {
          response = new Response("Unauthorized", { status: 401 });
       } else if (!apiKey) {
          response = new Response("DAILY_API_KEY missing", { status: 400 });
       } else {
          try {
             // 1. Get List of rooms
             const listRes = await fetch("https://api.daily.co/v1/rooms", {
                headers: { "Authorization": `Bearer ${apiKey}` }
             });
             const rooms: any = await listRes.json();
             
             // 2. Delete each room
             if (rooms.data) {
                for (const room of rooms.data) {
                   await fetch(`https://api.daily.co/v1/rooms/${room.name}`, {
                      method: "DELETE",
                      headers: { "Authorization": `Bearer ${apiKey}` }
                   });
                }
             }
             
             response = new Response(JSON.stringify({ success: true, count: rooms.total_count || 0 }), { 
                headers: { "Content-Type": "application/json" } 
             });
          } catch (e) {
             response = new Response(JSON.stringify({ error: "Flush failed" }), { status: 500 });
          }
       }
    }
    // Video Chat Token Endpoint (Daily.co)
    else if (path.startsWith("/api/video/token")) {
       const matchId = url.searchParams.get("matchId");
       const apiKey = env.DAILY_API_KEY;

       if (!matchId || !apiKey) {
          response = new Response(JSON.stringify({ 
             error: "Insufficient configuration",
             details: matchId ? "DAILY_API_KEY missing" : "matchId missing"
          }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
       } else {
          const dbUrl = env.TURSO_URL || env.LIBSQL_URL;
          const dbToken = env.TURSO_AUTH_TOKEN || env.LIBSQL_AUTH_TOKEN;

          if (!dbUrl || !dbToken) {
            response = new Response(JSON.stringify({ error: "Database configuration missing for video check" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          } else {
            try {
              const db = createDb(dbUrl, dbToken);
              console.log(`[BACKEND] Checking video for match: ${matchId}`);
              const matchRecord = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
              console.log(`[BACKEND] Match found: ${matchRecord.length > 0}, enabled: ${matchRecord[0]?.videoEnabled}`);

              if (!matchRecord || matchRecord.length === 0 || !matchRecord[0].videoEnabled) {
                response = new Response(JSON.stringify({ 
                  error: "Video chat not available for this match",
                  details: "Match not found or video is not enabled."
                }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
              } else {
                // 1. Create room (ignoring if it already exists)
                const roomRes = await fetch("https://api.daily.co/v1/rooms", {
                   method: "POST",
                   headers: {
                      "Authorization": `Bearer ${apiKey}`,
                      "Content-Type": "application/json"
                   },
                   body: JSON.stringify({
                      name: matchId,
                      privacy: "private",
                      properties: {
                         exp: Math.round(Date.now() / 1000) + 7200, // 2 hours
                         enable_chat: true
                      }
                   })
                });
                
                // 2. Generate Meeting Token
                const tokenRes = await fetch("https://api.daily.co/v1/meeting-tokens", {
                   method: "POST",
                   headers: {
                      "Authorization": `Bearer ${apiKey}`,
                      "Content-Type": "application/json"
                   },
                   body: JSON.stringify({
                      properties: {
                         room_name: matchId,
                         is_owner: false,
                         exp: Math.round(Date.now() / 1000) + 7200
                      }
                   })
                });

                const tokenData: any = await tokenRes.json();
                if (!tokenData.token) {
                  console.error("Daily Token Error:", tokenData);
                  throw new Error(`Daily.co API failure: ${JSON.stringify(tokenData)}`);
                }
                const domain = (env.DAILY_DOMAIN || 'antigravity'); 

                response = new Response(JSON.stringify({ 
                   roomUrl: `https://${domain}.daily.co/${matchId}`,
                   token: tokenData.token,
                }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
              }

            } catch (e) {
               console.error("Daily API Error:", e);
               response = new Response(JSON.stringify({ error: "Failed to create secure video session", details: e.message || e.toString() }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
          }
       }
    }
    // Admin Dashboard Route
    else if (path === "/admin") {
       const html = `
       <!DOCTYPE html>
       <html lang="en">
       <head>
           <meta charset="UTF-8">
           <meta name="viewport" content="width=device-width, initial-scale=1.0">
           <title>Antigravity Admin</title>
           <script src="https://cdn.tailwindcss.com"></script>
           <style>
               body { background: #0f172a; color: white; font-family: 'Inter', sans-serif; }
               .card { background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); backdrop-filter: blur(10px); }
           </style>
       </head>
       <body class="p-4 md:p-8">
           <div class="max-w-4xl mx-auto space-y-6">
               <header class="flex justify-between items-center bg-slate-800/50 p-6 rounded-3xl border border-white/5 shadow-2xl">
                   <div>
                       <h1 class="text-2xl font-black tracking-tighter uppercase italic">Admin <span class="text-blue-500">Antigravity</span></h1>
                       <p class="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Operational Bridge</p>
                   </div>
                   <input type="password" id="adminSecret" placeholder="Admin Secret" class="bg-black/50 border border-white/10 rounded-full px-4 py-2 text-xs outline-none focus:border-blue-500 transition-all font-mono">
               </header>

               <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div class="card p-6 rounded-3xl shadow-xl space-y-4">
                       <h2 class="text-sm font-black uppercase tracking-widest text-slate-400">Controls</h2>
                       <button onclick="clearMatches()" class="w-full py-4 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-500 text-xs font-black uppercase tracking-widest rounded-2xl transition-all">Clear All Matches</button>
                       <button onclick="flushVideoRooms()" class="w-full py-4 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 text-orange-500 text-xs font-black uppercase tracking-widest rounded-2xl transition-all">Flush Video Rooms</button>
                       <button onclick="refreshMatches()" class="w-full py-4 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-500 text-xs font-black uppercase tracking-widest rounded-2xl transition-all">Refresh Live Data</button>
                   </div>
                   <div class="card p-6 rounded-3xl shadow-xl space-y-4">
                       <h2 class="text-sm font-black uppercase tracking-widest text-slate-400">Manual Control</h2>
                       <input type="text" id="manualId" placeholder="Match ID (UUID)" class="w-full bg-black/50 border border-white/10 rounded-2xl px-4 py-3 text-xs outline-none focus:border-blue-500 transition-all font-mono">
                       <div class="flex gap-2">
                           <button onclick="toggleVideo(document.getElementById('manualId').value, true)" class="flex-1 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-emerald-500/20 transition-all">Enable Video</button>
                           <button onclick="toggleVideo(document.getElementById('manualId').value, false)" class="flex-1 py-3 bg-slate-500/10 border border-slate-500/20 text-slate-400 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-500/20 transition-all">Disable</button>
                       </div>
                   </div>
               </div>

               <div class="space-y-4">
                   <h2 class="text-sm font-black uppercase tracking-widest text-slate-400 px-2">Live Matches</h2>
                   <div id="matchList" class="grid gap-3">
                       <div class="p-8 text-center text-slate-500 italic text-sm">No active matches found.</div>
                   </div>
               </div>
           </div>

           <script>
               const getSecret = () => document.getElementById('adminSecret').value;
               
               async function refreshMatches() {
                   const res = await fetch('/api/live');
                   let matches = [];
                   try { matches = await res.json(); } catch(e) {}
                   
                   const list = document.getElementById('matchList');
                   list.innerHTML = '';
                   
                   if (matches.length === 0) {
                      const manualId = document.getElementById('manualId').value;
                      if (!manualId) {
                         list.innerHTML = '<div class="p-8 text-center text-slate-500 italic text-sm">No DB matches. Use manual ID above.</div>';
                         return;
                      }
                      matches = [{ id: manualId, whiteName: 'Manual Match', blackName: '' }];
                   }

                   matches.forEach(m => {
                       const div = document.createElement('div');
                       div.className = 'card p-4 rounded-2xl flex justify-between items-center group hover:border-blue-500/50 cursor-pointer transition-all active:scale-[0.98]';
                       div.onclick = () => {
                          document.getElementById('manualId').value = m.id;
                          // Brief visual feedback
                          document.getElementById('manualId').classList.add('border-blue-500');
                          setTimeout(() => document.getElementById('manualId').classList.remove('border-blue-500'), 500);
                       };
                       div.innerHTML = \`
                           <div class="space-y-1">
                               <div class="text-[10px] font-mono text-slate-500 uppercase tracking-tighter">\${m.id}</div>
                               <div class="text-xs font-bold">\${m.whiteName || 'Guest'} vs \${m.blackName || 'Guest'}</div>
                           </div>
                           <div class="flex gap-2">
                               <button onclick="event.stopPropagation(); toggleVideo('\${m.id}', true)" class="px-3 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-500 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all">On</button>
                               <button onclick="event.stopPropagation(); toggleVideo('\${m.id}', false)" class="px-3 py-2 bg-slate-500/10 hover:bg-slate-500/20 border border-slate-500/20 text-slate-400 text-[9px] font-black uppercase tracking-widest rounded-xl transition-all">Off</button>
                           </div>
                       \`;
                       list.appendChild(div);
                   });
               }

               async function toggleVideo(id, enabled) {
                   const res = await fetch(\`/api/admin/match/video?matchId=\${id}&enabled=\${enabled}\`, {
                       method: 'POST',
                       headers: { 'X-Admin-Secret': getSecret() }
                   });
                   if (res.ok) {
                       const status = enabled ? 'ENABLED' : 'DISABLED';
                       alert(\`Match \${id}: Video \${status}\`);
                       refreshMatches();
                   } else {
                       alert('Error: ' + await res.text());
                   }
               }

               async function flushVideoRooms() {
                   const res = await fetch('/api/admin/video/flush', {
                       method: 'POST',
                       headers: { 'X-Admin-Secret': getSecret() }
                   });
                   if (res.ok) {
                       const data = await res.json();
                       alert(\`Success: Cleared \${data.count} rooms.\`);
                   } else {
                       alert('Error: ' + await res.text());
                   }
               }

               async function clearMatches() {
                   if (!confirm('Are you sure you want to delete ALL matches?')) return;
                   const res = await fetch('/api/admin/clear', {
                       method: 'POST',
                       headers: { 'X-Admin-Secret': getSecret() }
                   });
                   if (res.ok) refreshMatches();
                   else alert('Error: ' + await res.text());
               }

               refreshMatches();
               setInterval(refreshMatches, 10000);
           </script>
       </body>
       </html>
       `;
       response = new Response(html, { headers: { "Content-Type": "text/html" } });
    }
    if (!response) {
      response = new Response(
        "AntigravityChess Edge Backend.\n- WSS /lobby to find a match\n- WSS /match/<match_id> to connect to a game.\n- GET /api/archive for game history.\n- GET /api/video/token?matchId=ID for video chat.",
        { status: 200 }
      );
    }

    // Apply CORS to all non-WebSocket responses
    if (response.status !== 101) {
       const newHeaders = new Headers(response.headers);
       const cors = CORS_HEADERS(origin);
       Object.entries(cors).forEach(([k, v]) => newHeaders.set(k, v));
       return new Response(response.body, {
          status: response.status,
          headers: newHeaders
       });
    }

    return response;
  },
};
