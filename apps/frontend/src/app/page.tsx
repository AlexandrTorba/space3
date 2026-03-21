"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, Swords, Timer, User, Activity, Play, X, Trophy } from "lucide-react";
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
  
  const [challenges, setChallenges] = useState<{id: string, playerName: string, tc: string, colorPref: string}[]>([]);
  const [liveMatches, setLiveMatches] = useState<{id: string, whiteName: string, blackName: string, timeControl: string, spectators?: number}[]>([]);
  const [myChallengeId, setMyChallengeId] = useState<string | null>(null);
  const [isMatching, setIsMatching] = useState(false);
  const [activeTab, setActiveTab] = useState<"lobby" | "live">("lobby");
  const [bottomTab, setBottomTab] = useState<"tournaments" | "clubs">("tournaments");

  useEffect(() => {
     let name = localStorage.getItem("ag_name");
     if (!name) {
         name = `Гравець${Math.floor(Math.random() * 9000) + 1000}`;
         localStorage.setItem("ag_name", name);
     }
     setPlayerName(name);

     // Fetch Live Matches
     const fetchLive = () => {
         const rawUrl = process.env.NEXT_PUBLIC_BACKEND_URL || (typeof window !== "undefined" ? window.location.hostname + ":8787" : "localhost:8787");
         let host = rawUrl;
         try {
           if (rawUrl.includes("://")) {
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
       if (rawUrl.includes("://")) {
         host = new URL(rawUrl).host;
       }
     } catch (e) {}
     const ws = new WebSocket(`${protocol}//${host}/lobby`);
     wsRef.current = ws;

     ws.onopen = () => {
        setStatus("Connected");
     };

     ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        if (data.type === "challenges_list") {
            setChallenges(data.challenges);
        }
        else if (data.type === "waiting_created") {
            setMyChallengeId(data.id);
        }
        else if (data.type === "MATCH_FOUND") {
            setIsMatching(true);
            setTimeout(() => {
                const wName = data.color === "black" ? data.opponent : data.myName;
                const bName = data.color === "black" ? data.myName : data.opponent;
                router.push(`/play/${data.matchId}?color=${data.color}&tc=${data.tc}&w=${encodeURIComponent(wName)}&b=${encodeURIComponent(bName)}`);
            }, 800);
        }
     };

     return () => ws.close();
  }, [router]);

  const getNameOrDefault = () => {
      let finalName = playerName.trim();
      if (!finalName) {
          // eslint-disable-next-line react-hooks/purity
          finalName = `Гравець${Math.floor(Math.random() * 9000) + 1000}`;
          setPlayerName(finalName);
      }
      localStorage.setItem("ag_name", finalName);
      return finalName;
  };

  const handleCreateChallenge = () => {
      const finalName = getNameOrDefault();
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "create", playerName: finalName, timeControl, colorPref }));
      }
  };

  const handleCancelChallenge = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "cancel" }));
      }
      setMyChallengeId(null);
  };

  const handleAcceptChallenge = (id: string) => {
      const finalName = getNameOrDefault();
      setIsMatching(true);
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "accept", challengeId: id, playerName: finalName }));
      }
  };


  return (
    <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative">
      
      <div className="max-w-4xl w-full text-center z-10">
        <div className="inline-block mb-4 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 font-mono text-sm tracking-widest uppercase">
          {status === 'Connected' ? `${t("status_connected")} Edge` : status}
        </div>
        
        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight mb-8 bg-clip-text text-transparent bg-gradient-to-br from-white via-gray-200 to-gray-500">
          {t("hero_title")}
        </h1>
        
        <AnimatePresence mode="wait">
        {isMatching ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-20">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                <h2 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-300 to-emerald-300 animate-pulse">
                    Routing match...
                </h2>
            </motion.div>
        ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left max-w-4xl mx-auto">
            {/* Create Challenge Panel */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col h-full">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Swords className="w-5 h-5 text-blue-400"/> {t("new_game")}</h2>
                
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 focus-within:border-blue-500/50 transition-colors shadow-inner">
                        <User className="w-5 h-5 text-slate-400" />
                        <input 
                            type="text" 
                            placeholder={t("enter_name")}
                            value={playerName}
                            maxLength={20}
                            onChange={e => setPlayerName(e.target.value)}
                            onBlur={getNameOrDefault}
                            className="bg-transparent border-none text-white w-full font-bold focus:outline-none placeholder-slate-600"
                        />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 flex flex-col gap-1 w-full">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 pl-1">{t("time_control")}</span>
                            <div className="flex-1 flex items-center gap-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 focus-within:border-blue-500/50 transition-colors shadow-inner cursor-pointer hover:bg-slate-900/40">
                                <Timer className="w-4 h-4 text-emerald-400" />
                                <select 
                                    value={timeControl} 
                                    onChange={e => setTimeControl(e.target.value)} 
                                    className="bg-transparent border-none text-white w-full font-bold focus:outline-none appearance-none cursor-pointer text-sm"
                                >
                                <option value="1" className="bg-slate-900">1 {t("minute")} ⚡️</option>
                                <option value="3" className="bg-slate-900">3 {t("minutes")} 🔥</option>
                                <option value="10" className="bg-slate-900">10 {t("minutes")} ⏱</option>
                                <option value="Unlimited" className="bg-slate-900">{t("unlimited")} ♾️</option>
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col gap-1 w-full">
                            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 pl-1">{t("play_as")}</span>
                            <div className="flex-1 flex items-center gap-3 bg-slate-950/80 p-3.5 rounded-2xl border border-slate-800 focus-within:border-blue-500/50 transition-colors shadow-inner cursor-pointer hover:bg-slate-900/40">
                                <span className={`w-3 h-3 rounded-full ${colorPref === 'white' ? 'bg-slate-200' : colorPref === 'black' ? 'bg-slate-800 border border-slate-600' : 'bg-gradient-to-tr from-slate-900 to-slate-200 border border-slate-600'}`}></span>
                                <select 
                                    value={colorPref} 
                                    onChange={e => setColorPref(e.target.value as "white" | "black" | "random")} 
                                    className="bg-transparent border-none text-white w-full font-bold focus:outline-none appearance-none cursor-pointer text-sm"
                                >
                                <option value="random" className="bg-slate-900">🎲 {t("color_random")}</option>
                                <option value="white" className="bg-slate-900">⚪ {t("color_white")}</option>
                                <option value="black" className="bg-slate-900">⚫ {t("color_black")}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex-1 flex flex-col justify-end">
                    {myChallengeId ? (
                        <div className="flex flex-col gap-3">
                            <div className="bg-blue-900/20 border border-blue-500/30 text-blue-300 p-4 rounded-2xl text-center font-bold animate-pulse flex flex-col items-center justify-center h-[60px]">
                                {t("searching")}
                            </div>
                            <button onClick={handleCancelChallenge} className="flex items-center justify-center gap-2 w-full bg-slate-800 hover:bg-slate-700 text-slate-300 h-[60px] rounded-2xl font-bold transition-all">
                                <X className="w-5 h-5" /> Cancel
                            </button>
                        </div>
                    ) : (
                        <button 
                            onClick={handleCreateChallenge}
                            disabled={!playerName.trim()}
                            className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 disabled:text-slate-500 text-white h-[60px] rounded-2xl font-bold transition-all text-lg shadow-[0_0_30px_rgba(59,130,246,0.2)]"
                        >
                            <Play className="w-5 h-5 fill-current" /> Create Game
                        </button>
                    )}
                </div>
                
                <button onClick={() => router.push("/analysis")} className="w-full mt-4 flex items-center justify-center gap-2 bg-indigo-900/20 hover:bg-indigo-900/40 border border-indigo-500/20 p-4 rounded-2xl text-indigo-300 font-bold transition-all uppercase tracking-widest text-xs">
                    <Activity className="w-4 h-4" /> {t("analysis_board")}
                </button>
            </div>

            {/* Lobby List Panel */}
            <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl flex flex-col h-full min-h-[500px]">
                <div className="flex items-center gap-2 mb-4 bg-slate-950/50 p-1.5 rounded-xl border border-slate-800">
                    <button 
                        onClick={() => setActiveTab("lobby")}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === "lobby" ? "bg-slate-800 text-emerald-400 shadow-md" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"}`}
                    >
                        <div className="flex items-center justify-center gap-2"><User className="w-4 h-4"/> {t("lobby_tab")} <span className="text-xs bg-emerald-500/20 px-2 py-0.5 rounded-full">{challenges.length}</span></div>
                    </button>
                    <button 
                        onClick={() => setActiveTab("live")}
                        className={`flex-1 py-3 px-4 rounded-lg font-bold text-sm transition-all ${activeTab === "live" ? "bg-slate-800 text-purple-400 shadow-md" : "text-slate-500 hover:text-slate-300 hover:bg-slate-800/50"}`}
                    >
                        <div className="flex items-center justify-center gap-2"><Activity className="w-4 h-4"/> {t("live_games")} <span className="text-xs bg-purple-500/20 px-2 py-0.5 rounded-full">{liveMatches.length}</span></div>
                    </button>
                </div>
                
                {activeTab === "lobby" && (
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
                        {challenges.map(c => (
                            <div key={c.id} className="flex items-center justify-between bg-slate-950/50 border border-slate-800 hover:border-slate-700 p-3 rounded-2xl transition-all group">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col justify-center gap-0.5">
                                      {c.colorPref === "white" && <div title="Plays White" className="w-4 h-4 rounded-full bg-slate-200 border border-slate-400"></div>}
                                      {c.colorPref === "black" && <div title="Plays Black" className="w-4 h-4 rounded-full bg-slate-900 border border-slate-600"></div>}
                                      {c.colorPref === "random" && <div title="Random Color" className="w-4 h-4 rounded-full bg-gradient-to-tr from-slate-900 to-slate-200 border border-slate-500"></div>}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-200">{c.playerName}</span>
                                        <span className="text-xs text-slate-500 font-mono flex items-center gap-1 mt-1">
                                            <Timer className="w-3 h-3"/> {c.tc === "Unlimited" ? "Unlimited" : `${c.tc} min`}
                                        </span>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => handleAcceptChallenge(c.id)}
                                    disabled={myChallengeId === c.id}
                                    className="bg-emerald-600/20 hover:bg-emerald-500/30 disabled:opacity-30 border border-emerald-500/30 text-emerald-400 px-5 py-2 rounded-xl font-bold text-sm transition-all shadow-lg"
                                >
                                    Play
                                </button>
                            </div>
                        ))}
                        {challenges.length === 0 && (
                            <div className="text-center text-slate-500 mt-20 flex flex-col items-center">
                                <User className="w-8 h-8 mb-2 opacity-20"/>
                                {t("no_challenges")}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "live" && (
                    <div className="flex-1 overflow-y-auto pr-2 space-y-2 scrollbar-thin scrollbar-thumb-slate-700">
                        {liveMatches.length > 0 && (
                            <div className="text-xs text-slate-500 font-bold uppercase tracking-widest px-2 mb-3 mt-1 flex items-center justify-between">
                                 <span>{t("live_games")} ({liveMatches.length})</span>
                                 <span className="flex items-center gap-1 text-emerald-400"><Activity className="w-3 h-3 animate-pulse" /> Live</span>
                            </div>
                        )}
                        {liveMatches.map((m: {id: string, whiteName: string, blackName: string, timeControl: string, spectators?: number}) => (
                            <button key={m.id} onClick={() => router.push(`/play/${m.id}?color=spectator&tc=${m.timeControl.replace('m','')}&w=${encodeURIComponent(m.whiteName)}&b=${encodeURIComponent(m.blackName)}`)} className="w-full flex flex-col items-center justify-center bg-slate-950/30 hover:bg-slate-800/50 border border-slate-800 hover:border-slate-700 p-4 rounded-xl transition-all group relative">
                                <div className="absolute top-2 right-3 text-[10px] font-bold text-slate-500 bg-slate-900 border border-slate-800 px-2 flex items-center gap-1 py-0.5 rounded-full shadow-inner"><Activity className="w-3 h-3 text-emerald-400" /> {m.spectators || 0}</div>
                                <div className="w-full flex justify-between items-center text-base font-bold text-slate-300">
                                    <span className="truncate">{m.whiteName}</span>
                                    <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 font-mono text-purple-400 mx-2">vs</span>
                                    <span className="truncate">{m.blackName}</span>
                                </div>
                                <div className="text-xs text-slate-500 mt-2 uppercase tracking-widest flex items-center gap-1"> {t("spectate")} <Timer className="w-3 h-3"/> {m.timeControl}</div>
                            </button>
                        ))}
                        {liveMatches.length === 0 && (
                            <div className="text-center text-slate-500 mt-20 flex flex-col items-center text-sm">
                                <Activity className="w-8 h-8 mb-2 opacity-20"/>
                                {t("no_live_games")}
                            </div>
                        )}
                    </div>
                )}
            </div>
            
        </motion.div>
        )}
        </AnimatePresence>
        
        {/* Tournaments & Clubs Block */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-8 max-w-4xl mx-auto bg-slate-900/60 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="flex items-center gap-6 mb-6 border-b border-white/5 pb-4">
                <button 
                    onClick={() => setBottomTab("tournaments")}
                    className={`text-xl font-bold flex items-center gap-2 transition-all ${bottomTab === 'tournaments' ? 'text-amber-500' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <Trophy className="w-5 h-5"/> {t("tournaments")}
                    {bottomTab === 'tournaments' && <motion.div layoutId="bottomUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-500" />}
                </button>
                <button 
                    onClick={() => setBottomTab("clubs")}
                    className={`text-xl font-bold flex items-center gap-2 transition-all ${bottomTab === 'clubs' ? 'text-blue-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <User className="w-5 h-5"/> {t("clubs")}
                </button>
            </div>

            <AnimatePresence mode="wait">
                {bottomTab === "tournaments" ? (
                    <motion.div 
                        key="tournaments"
                        initial={{ opacity: 0, x: -10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: 10 }}
                        className="flex flex-col items-center justify-center p-8 bg-slate-950/50 rounded-2xl border border-slate-800/50 border-dashed"
                    >
                        <Trophy className="w-10 h-10 text-amber-500/20 mb-3" />
                        <p className="text-slate-300 font-bold text-center">{t("no_tournaments")}</p>
                        <p className="text-slate-500/80 text-sm mt-1 text-center max-w-sm">{t("tournaments_desc")}</p>
                    </motion.div>
                ) : (
                    <motion.div 
                        key="clubs"
                        initial={{ opacity: 0, x: 10 }} 
                        animate={{ opacity: 1, x: 0 }} 
                        exit={{ opacity: 0, x: -10 }}
                        className="flex flex-col items-center justify-center p-8 bg-slate-950/50 rounded-2xl border border-slate-800/50 border-dashed"
                    >
                        <User className="w-10 h-10 text-blue-400/20 mb-3" />
                        <p className="text-slate-300 font-bold text-center">{t("no_clubs")}</p>
                        <p className="text-slate-500/80 text-sm mt-1 text-center max-w-sm">{t("clubs_desc")}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
      </div>
    </main>
  );
}
