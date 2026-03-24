"use client";

import { useState, useEffect, useRef } from "react";
import { 
  Loader2, Swords, Timer, User, Activity, Play, X, Trophy, 
  Zap, Shield, Globe, Crown, Info, Settings as SettingsIcon,
  ChevronRight, Users, MessageSquare
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/i18n";
import { motion, AnimatePresence } from "framer-motion";
import { useSettings, boardThemes } from "@/hooks/useSettings";

export default function Home() {
  const router = useRouter();
  const { t } = useTranslation();
  const { settings } = useSettings();
  
  const [status, setStatus] = useState("Connecting...");
  const wsRef = useRef<WebSocket | null>(null);
  
  const [playerName, setPlayerName] = useState("");
  const [timeControl, setTimeControl] = useState("3");
  const [colorPref, setColorPref] = useState<"white" | "black" | "random">("random");
  
  const [challenges, setChallenges] = useState<{id: string, playerName: string, tc: string, colorPref: string, mode?: string, playersCount?: number}[]>([]);
  const [liveMatches, setLiveMatches] = useState<{id: string, whiteName: string, blackName: string, timeControl: string, spectators?: number}[]>([]);
  const [myChallengeId, setMyChallengeId] = useState<string | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [isBughouse, setIsBughouse] = useState(false);
  const [activeTab, setActiveTab] = useState<"lobby" | "live">("lobby");

  useEffect(() => {
     let name = localStorage.getItem("ag_name");
     if (!name) {
         name = `Player${Math.floor(Math.random() * 9000) + 1000}`;
         localStorage.setItem("ag_name", name);
     }
     setPlayerName(name);

     const fetchLive = () => {
         const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || (typeof window !== "undefined" ? window.location.hostname + ":8787" : "localhost:8787");
         let host = rawUrl;
         try {
           if (rawUrl?.includes("://")) {
             host = new URL(rawUrl).host;
           }
         } catch (e) {}
         const protocol = window.location.protocol === "https:" ? "https:" : "http:";
         fetch(`${protocol}//${host}/api/live`)
           .then(res => res.json())
           .then(data => setLiveMatches(data))
           .catch(() => {});
     };
     fetchLive();
     const interval = setInterval(fetchLive, 5000);
     return () => clearInterval(interval);
  }, []);

  useEffect(() => {
     const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
     const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? window.location.hostname + ":8787" : "localhost:8787");
     let host = rawUrl;
     try {
       if (rawUrl?.includes("://")) {
         host = new URL(rawUrl).host;
       }
     } catch (e) {}
     const ws = new WebSocket(`${protocol}//${host}/lobby`);
     wsRef.current = ws;

     ws.onopen = () => setStatus("Connected");
     ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "challenges_list") setChallenges(data.challenges);
        else if (data.type === "waiting_created") setMyChallengeId(data.id);
        else if (data.type === "MATCH_FOUND") {
            setIsMatching(true);
            setTimeout(() => {
                const wName = data.color === "black" ? data.opponent : data.myName;
                const bName = data.color === "black" ? data.myName : data.opponent;
                if (data.mode === "bughouse") {
                   router.push(`/play/bughouse/${data.matchId}?role=${data.role}&tc=${data.tc}`);
                } else {
                   router.push(`/play/${data.matchId}?color=${data.color}&tc=${data.tc}&w=${encodeURIComponent(wName)}&b=${encodeURIComponent(bName)}`);
                }
            }, 800);
        }
     };
     return () => ws.close();
  }, [router]);

  const getNameOrDefault = () => {
      let finalName = playerName.trim();
      if (!finalName) {
          finalName = `Player${Math.floor(Math.random() * 9000) + 1000}`;
          setPlayerName(finalName);
      }
      localStorage.setItem("ag_name", finalName);
      return finalName;
  };

  const handleCreateChallenge = () => {
      const finalName = getNameOrDefault();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ 
             type: "create", playerName: finalName, timeControl, colorPref,
             mode: isBughouse ? "bughouse" : "standard"
          }));
      }
  };

  const handleCancelChallenge = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "cancel" }));
      }
      setMyChallengeId(null);
  };

  const handleAcceptChallenge = (id: string) => {
      const finalName = getNameOrDefault();
      setIsMatching(true);
      if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "accept", challengeId: id, playerName: finalName }));
      }
  };

  return (
    <main className="min-h-screen bg-[#05060B] text-slate-100 flex flex-col p-4 md:p-10 relative overflow-x-hidden selection:bg-blue-500/30">
      
      {/* Background Orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
         <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-600/10 blur-[120px] rounded-full" />
      </div>

      {/* Floating Header */}
      <header className="fixed top-6 left-6 right-6 z-50 flex justify-between items-center sm:px-8 py-3 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-2xl">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Crown className="w-6 h-6 text-white" />
             </div>
             <div className="hidden sm:block">
                <h1 className="text-xl font-black tracking-tighter">ANTIGRAVITY</h1>
                <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                   <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">Edge Node: {status}</span>
                </div>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="hidden md:flex items-center gap-1 bg-black/40 px-3 py-1.5 rounded-full border border-white/5">
                <User className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs font-black tracking-tight">{playerName}</span>
             </div>
             <button onClick={() => router.push("/analysis")} className="p-2.5 bg-white/5 hover:bg-white/10 transition-colors rounded-full border border-white/10">
                <Activity className="w-5 h-5 text-slate-400" />
             </button>
             <button className="p-2.5 bg-white/5 hover:bg-white/10 transition-colors rounded-full border border-white/10">
                <SettingsIcon className="w-5 h-5 text-slate-400" />
             </button>
          </div>
      </header>

      {/* Main Hub Layout */}
      <div className="max-w-[1400px] w-full mx-auto mt-24 z-10 grid grid-cols-1 xl:grid-cols-12 gap-8">
          
          {/* Left: Mode Selection (3 columns) */}
          <div className="xl:col-span-3 flex flex-col gap-4">
              <h2 className="text-xs font-black text-slate-500 uppercase tracking-widest ml-1">Play Mode</h2>
              <div className="grid grid-cols-1 gap-4">
                  <motion.button 
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setIsBughouse(false); handleCreateChallenge(); }}
                    className={`group relative h-40 rounded-3xl overflow-hidden border transition-all ${!isBughouse && myChallengeId ? 'border-blue-500 bg-blue-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                  >
                     <div className="absolute top-6 left-6 text-left">
                        <Zap className="w-8 h-8 text-blue-400 mb-2" />
                        <div className="text-lg font-black">{t("color_random")}</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">Standard Match</div>
                     </div>
                     <div className="absolute bottom-[-20px] right-[-20px] opacity-10 group-hover:opacity-20 transition-opacity">
                        <Swords className="w-40 h-40" />
                     </div>
                  </motion.button>

                  <motion.button 
                    whileHover={{ y: -4, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setIsBughouse(true); handleCreateChallenge(); }}
                    className={`group relative h-40 rounded-3xl overflow-hidden border transition-all ${isBughouse && myChallengeId ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-white/5 hover:bg-white/10'}`}
                  >
                     <div className="absolute top-6 left-6 text-left">
                        <Users className="w-8 h-8 text-indigo-400 mb-2" />
                        <div className="text-lg font-black">Bughouse</div>
                        <div className="text-[10px] text-slate-500 font-bold uppercase">2v2 Cooperative</div>
                     </div>
                     <div className="absolute bottom-[-20px] right-[-20px] opacity-10 group-hover:opacity-20 transition-opacity">
                        <Users className="w-40 h-40" />
                     </div>
                  </motion.button>

                  <div className="h-40 bg-gradient-to-br from-slate-900 to-slate-950 rounded-3xl border border-white/5 flex flex-col items-center justify-center p-6 text-center opacity-40">
                      <Trophy className="w-8 h-8 text-amber-500/50 mb-2" />
                      <div className="text-xs font-black uppercase text-slate-500">Arena Tournaments</div>
                      <div className="text-[10px] text-slate-700">Coming Soon</div>
                  </div>
              </div>
          </div>

          {/* Center: Lobby & Settings (6 columns) */}
          <div className="xl:col-span-6 flex flex-col gap-6">
              
              {/* Challenge Settings */}
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-8 rounded-[2.5rem] shadow-xl">
                  <div className="flex flex-col md:flex-row items-center gap-6">
                      <div className="flex-1 flex flex-col gap-2 w-full">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Time Control</label>
                          <div className="bg-black/40 border border-white/5 rounded-2xl px-5 h-14 flex items-center gap-3">
                             <Timer className="w-5 h-5 text-blue-400" />
                             <select 
                               value={timeControl}
                               onChange={e => setTimeControl(e.target.value)}
                               className="bg-transparent border-none text-sm font-black w-full focus:outline-none appearance-none cursor-pointer"
                             >
                                <option value="1">1 Minute (Bullet)</option>
                                <option value="3">3 Minutes (Blitz)</option>
                                <option value="10">10 Minutes (Rapid)</option>
                                <option value="Unlimited">Unlimited</option>
                             </select>
                          </div>
                      </div>

                      <div className="flex-1 flex flex-col gap-2 w-full">
                          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-2">Color Pref</label>
                          <div className="bg-black/40 border border-white/5 rounded-2xl px-5 h-14 flex items-center gap-3">
                             <Shield className={`w-5 h-5 ${colorPref === 'white' ? 'text-white' : colorPref === 'black' ? 'text-slate-600' : 'text-blue-400'}`} />
                             <select 
                               value={colorPref}
                               onChange={e => setColorPref(e.target.value as any)}
                               className="bg-transparent border-none text-sm font-black w-full focus:outline-none appearance-none cursor-pointer"
                             >
                                <option value="random">Randomized</option>
                                <option value="white">Play as White</option>
                                <option value="black">Play as Black</option>
                             </select>
                          </div>
                      </div>
                  </div>

                  {myChallengeId && (
                     <motion.div 
                       initial={{ opacity: 0, scale: 0.95 }}
                       animate={{ opacity: 1, scale: 1 }}
                       className="mt-6 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between"
                     >
                        <div className="flex items-center gap-3">
                           <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                           <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Searching Match...</span>
                        </div>
                        <button onClick={handleCancelChallenge} className="text-xs font-black text-slate-400 hover:text-white uppercase">Cancel</button>
                     </motion.div>
                  )}
              </div>

              {/* Lobby List */}
              <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] flex flex-col overflow-hidden min-h-[400px]">
                  <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center">
                     <div className="flex gap-6">
                        <button 
                           onClick={() => setActiveTab("lobby")}
                           className={`text-sm font-black uppercase tracking-widest transition-colors ${activeTab === 'lobby' ? 'text-white' : 'text-slate-600'}`}
                        >
                           Lobby <span className="ml-1 text-[10px] opacity-30">{challenges.length}</span>
                        </button>
                        <button 
                           onClick={() => setActiveTab("live")}
                           className={`text-sm font-black uppercase tracking-widest transition-colors ${activeTab === 'live' ? 'text-emerald-400' : 'text-slate-600'}`}
                        >
                           Live Games <span className="ml-1 text-[10px] opacity-30">{liveMatches.length}</span>
                        </button>
                     </div>
                     <Globe className="w-5 h-5 text-slate-700" />
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-3">
                      <AnimatePresence mode="popLayout">
                      {activeTab === "lobby" ? (
                         challenges.map((c, i) => (
                           <motion.div 
                             key={c.id}
                             initial={{ opacity: 0, x: -20 }}
                             animate={{ opacity: 1, x: 0 }}
                             transition={{ delay: i * 0.05 }}
                             className="flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 p-4 rounded-2xl transition-all group"
                           >
                              <div className="flex items-center gap-4">
                                 <div className={`w-2 h-10 rounded-full ${c.mode === 'bughouse' ? 'bg-indigo-500' : 'bg-blue-500'}`} />
                                 <div>
                                    <div className="flex items-center gap-2">
                                       <span className="font-black text-sm">{c.playerName}</span>
                                       {c.mode === 'bughouse' && <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-black uppercase">BH {c.playersCount}/4</span>}
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{c.tc} min • {c.colorPref}</div>
                                 </div>
                              </div>
                              <button 
                                 onClick={() => handleAcceptChallenge(c.id)}
                                 className="bg-white/5 hover:bg-blue-600 border border-white/10 hover:border-blue-500 px-6 py-2 rounded-xl text-xs font-black transition-all group-hover:scale-105 active:scale-95"
                              >
                                 JOIN
                              </button>
                           </motion.div>
                         ))
                      ) : (
                         liveMatches.map((m, i) => (
                           <motion.button 
                              key={m.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              onClick={() => router.push(`/play/${m.id}?color=spectator`)}
                              className="w-full flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 p-4 rounded-2xl transition-all group"
                           >
                              <div className="flex items-center gap-4 flex-1">
                                 <div className="text-sm font-bold truncate max-w-[100px]">{m.whiteName}</div>
                                 <div className="text-[10px] text-slate-700 font-black">VS</div>
                                 <div className="text-sm font-bold truncate max-w-[100px]">{m.blackName}</div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="flex items-center gap-1 text-[10px] font-black text-emerald-500/50">
                                    <Activity className="w-3 h-3" /> {m.spectators || 0}
                                 </div>
                                 <ChevronRight className="w-4 h-4 text-slate-700" />
                              </div>
                           </motion.button>
                         ))
                      )}
                      </AnimatePresence>

                      {((activeTab === "lobby" && challenges.length === 0) || (activeTab === "live" && liveMatches.length === 0)) && (
                         <div className="flex flex-col items-center justify-center py-20 text-slate-600 opacity-20">
                            <Info className="w-12 h-12 mb-4" />
                            <div className="text-sm font-black uppercase tracking-widest">No Active Sessions</div>
                         </div>
                      )}
                  </div>
              </div>
          </div>

          {/* Right: Social & Info (3 columns) */}
          <div className="xl:col-span-3 flex flex-col gap-6">
              
              {/* Leaderboard/Stats Mini */}
              <div className="bg-white/5 border border-white/10 rounded-[2.5rem] p-6">
                  <div className="flex items-center justify-between mb-4">
                     <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">Top Players</h3>
                     <Crown className="w-4 h-4 text-amber-500" />
                  </div>
                  <div className="space-y-4">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex items-center gap-3 opacity-50">
                           <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-black">{i}</div>
                           <div className="flex-1 h-2 bg-white/5 rounded-full" />
                        </div>
                      ))}
                  </div>
                  <div className="mt-6 pt-6 border-t border-white/5 text-center">
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest italic">Global Ranking Locked</span>
                  </div>
              </div>

              {/* Server Stats */}
              <div className="bg-gradient-to-br from-indigo-900/10 to-blue-900/10 border border-white/5 rounded-[2.5rem] p-6 relative overflow-hidden group">
                  <div className="relative z-10">
                     <div className="text-sm font-black flex items-center gap-2 mb-1">
                        <Activity className="w-4 h-4 text-blue-400" />
                        Edge Latency
                     </div>
                     <div className="text-2xl font-black text-blue-400">12<span className="text-sm ml-1 opacity-50">ms</span></div>
                     <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">System core is healthy and responding from the closest edge node.</p>
                  </div>
                  <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-blue-500/10 blur-2xl group-hover:bg-blue-500/20 transition-all" />
              </div>

              <div className="mt-auto flex items-center justify-center gap-4 text-slate-700">
                  <MessageSquare className="w-5 h-5 hover:text-slate-400 transition-colors cursor-pointer" />
                  <Info className="w-5 h-5 hover:text-slate-400 transition-colors cursor-pointer" />
                  <div className="h-4 w-px bg-white/5" />
                  <span className="text-[9px] font-black uppercase tracking-[0.3em]">v2.4.0</span>
              </div>
          </div>

      </div>

      {/* Match Router Overlay */}
      <AnimatePresence>
      {isMatching && (
         <motion.div 
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           exit={{ opacity: 0 }}
           className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center text-center p-10"
         >
            <div className="relative">
               <Loader2 className="w-24 h-24 text-blue-500 animate-spin opacity-20" />
               <Swords className="w-10 h-10 text-white absolute inset-0 m-auto animate-bounce" />
            </div>
            <h2 className="text-3xl font-black mt-8 tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-400">INITIALIZING ARENA</h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.4em] mt-2">Connecting to distributed edge instance...</p>
         </motion.div>
      )}
      </AnimatePresence>

    </main>
  );
}
