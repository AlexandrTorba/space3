"use client";

import { Crown, Settings as SettingsIcon, Activity, User } from "lucide-react";

interface LobbyHeaderProps {
    status: string;
    playerName: string;
    onToggleSettings: () => void;
    onAnalysisClick: () => void;
}

export default function LobbyHeader({ status, playerName, onToggleSettings, onAnalysisClick }: LobbyHeaderProps) {
  return (
    <header className="fixed top-6 left-6 right-6 z-50 flex justify-between items-center sm:px-8 py-3 bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2rem] shadow-2xl">
        <div className="flex items-center gap-3">
           <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-500 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Crown className="w-6 h-6 text-white" />
           </div>
           <div className="flex flex-col justify-center">
              <h1 className="text-xs sm:text-xl font-black tracking-tighter uppercase leading-tight text-white whitespace-nowrap">AntigravityChess</h1>
              <div className="flex items-center gap-1.5 sm:gap-2">
                 <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-500 animate-ping" />
                 <span className="text-[7px] sm:text-[9px] font-black text-emerald-500 uppercase tracking-widest leading-none">Edge: {status}</span>
              </div>
           </div>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
           <div className="flex items-center gap-1 bg-black/40 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full border border-white/5">
              <User className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-blue-400" />
              <span className="text-[10px] sm:text-xs font-black tracking-tight max-w-[60px] sm:max-w-none truncate">{playerName}</span>
           </div>
           <button onClick={onAnalysisClick} className="p-2.5 bg-white/5 hover:bg-white/10 transition-colors rounded-full border border-white/10">
              <Activity className="w-5 h-5 text-slate-400" />
           </button>
           <button onClick={onToggleSettings} className="p-2.5 bg-white/5 hover:bg-white/10 transition-colors rounded-full border border-white/10">
              <SettingsIcon className="w-5 h-5 text-slate-400" />
           </button>
        </div>
    </header>
  );
}
