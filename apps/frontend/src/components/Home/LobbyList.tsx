"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Globe, Info, Activity, ChevronRight, Swords, Zap } from "lucide-react";
import MagicMenu from "./MagicMenu";

interface LobbyListProps {
    activeTab: "lobby" | "bughouse" | "live";
    onTabChange: (tab: "lobby" | "bughouse" | "live") => void;
    challenges: any[];
    liveMatches: any[];
    onAcceptChallenge: (id: string) => void;
    onSpectateMatch: (id: string) => void;
}

export default function LobbyList({ 
    activeTab, onTabChange, 
    challenges, liveMatches, 
    onAcceptChallenge, onSpectateMatch 
}: LobbyListProps) {
  return (
    <div className="flex-1 bg-white/5 backdrop-blur-xl border border-white/10 rounded-[2.5rem] flex flex-col overflow-hidden min-h-[400px]">
          <div className="px-6 py-6 border-b border-white/5 flex flex-col gap-6">
             <div className="flex justify-between items-center px-4">
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-500">Matchmaking Lobby</div>
                <Globe className="w-4 h-4 text-slate-700" />
             </div>
             
             <MagicMenu 
                activeTab={activeTab}
                onChange={(id) => onTabChange(id as any)}
                tabs={[
                  { id: "lobby", label: "Standard", icon: <Swords />, color: "blue", count: challenges.filter(c => c.mode !== 'bughouse').length },
                  { id: "bughouse", label: "Bughouse", icon: <Zap />, color: "indigo", count: challenges.filter(c => c.mode === 'bughouse').length },
                  { id: "live", label: "Live", icon: <Activity />, color: "emerald", count: Array.isArray(liveMatches) ? liveMatches.length : 0 },
                ]}
             />
          </div>
         <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-3">
             <AnimatePresence mode="popLayout">
             {activeTab === "lobby" || activeTab === "bughouse" ? (
                challenges
                  .filter(c => activeTab === "bughouse" ? c.mode === "bughouse" : c.mode !== "bughouse")
                  .map((c, i) => (
                    <motion.div 
                      key={c.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-center justify-between bg-white/[0.03] hover:bg-white/[0.08] border border-white/5 p-4 rounded-2xl transition-all group"
                    >
                       <div className="flex items-center gap-4">
                          <div className={`w-2 h-10 rounded-full ${c.mode === 'bughouse' ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]' : 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.5)]'}`} />
                          <div>
                             <div className="flex items-center gap-2">
                                <span className="font-black text-sm truncate max-w-[120px] md:max-w-[200px]" title={c.playerName}>{c.playerName}</span>
                                {c.mode === 'bughouse' && <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-black uppercase">BH {c.playersCount || 0}/4</span>}
                             </div>
                             <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{c.tc} min • {c.colorPref}</div>
                          </div>
                       </div>
                       <button 
                          onClick={() => onAcceptChallenge(c.id)}
                          className={`px-6 py-2 rounded-xl text-xs font-black transition-all group-hover:scale-105 active:scale-95 border ${
                              c.mode === 'bughouse' 
                                  ? 'bg-indigo-500/10 hover:bg-indigo-600 border-indigo-500/20 hover:border-indigo-400' 
                                  : 'bg-blue-500/10 hover:bg-blue-600 border-blue-500/20 hover:border-blue-400'
                          }`}
                       >
                          JOIN
                       </button>
                    </motion.div>
                  ))
             ) : (
              Array.isArray(liveMatches) && liveMatches.map((m, i) => (
                  <motion.button 
                     key={m.id}
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     onClick={() => onSpectateMatch(m.id)}
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

              {((activeTab === "lobby" && challenges.filter(c => c.mode !== 'bughouse').length === 0) || 
                (activeTab === "bughouse" && challenges.filter(c => c.mode === 'bughouse').length === 0) || 
                (activeTab === "live" && (!Array.isArray(liveMatches) || liveMatches.length === 0))) && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-600 opacity-20">
                   <Info className="w-12 h-12 mb-4" />
                   <div className="text-sm font-black uppercase tracking-widest">No Active Sessions</div>
                </div>
             )}
         </div>
    </div>
  );
}
